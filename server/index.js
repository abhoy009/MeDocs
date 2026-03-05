import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as Y from 'yjs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Connection from './database/db.js';
import { authMiddleware, socketAuthMiddleware } from './middleware/auth.js';
import { register, login, refresh, logout } from './controller/auth-controller.js';
import {
    getDocument,
    updateDocument,
    updateTitle,
    getAllDocuments,
    deleteDocument,
    exportDocument
} from './controller/document-controller.js';

const PORT = process.env.PORT || 9000;
const SAVE_INTERVAL_MS = 5000;
const CLEANUP_GRACE_MS = 30000;

Connection();

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ── Auth Routes (public) ───────────────────────────────────
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/refresh', refresh);
app.post('/api/auth/logout', logout);

// ── Document Routes (protected) ────────────────────────────
app.get('/api/documents', authMiddleware, async (req, res) => {
    try {
        const docs = await getAllDocuments(req.user.id);
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/documents/:id/export', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const format = req.query.format || 'txt';
        const result = await exportDocument(id, format);
        if (!result) return res.status(404).json({ error: 'Document not found' });
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="document.${result.ext}"`);
        res.send(result.content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteDocument(id, req.user.id);
        if (!deleted) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true, id });
    } catch (err) {
        res.status(err.message.includes('Unauthorized') ? 403 : 500).json({ error: err.message });
    }
});

// ── Yjs Document Manager ────────────────────────────────────

const activeDocs = new Map();

function getOrCreateYDoc(documentId) {
    if (activeDocs.has(documentId)) {
        const entry = activeDocs.get(documentId);
        if (entry.cleanupTimer) {
            clearTimeout(entry.cleanupTimer);
            entry.cleanupTimer = null;
        }
        return entry;
    }

    const yDoc = new Y.Doc();
    const entry = { yDoc, clients: new Set(), dirty: false, cleanupTimer: null };

    yDoc.on('update', () => {
        entry.dirty = true;
    });

    activeDocs.set(documentId, entry);
    return entry;
}

function deriveQuillDelta(yDoc) {
    const yText = yDoc.getText('quill');
    const delta = yText.toDelta();
    return { ops: delta.length > 0 ? delta : [] };
}

async function persistDoc(documentId) {
    const entry = activeDocs.get(documentId);
    if (!entry || !entry.dirty) return;

    const yState = Buffer.from(Y.encodeStateAsUpdate(entry.yDoc));
    const data = deriveQuillDelta(entry.yDoc);
    await updateDocument(documentId, { yState, data });
    entry.dirty = false;
}

function migrateFromLegacyDelta(yDoc, deltaData) {
    const ops = deltaData?.ops || [];
    if (ops.length === 0) return;

    const yText = yDoc.getText('quill');
    yDoc.transact(() => {
        for (const op of ops) {
            if (typeof op.insert === 'string') {
                const attrs = op.attributes || undefined;
                yText.insert(yText.length, op.insert, attrs);
            }
        }
    });
}

function scheduleCleanup(documentId) {
    const entry = activeDocs.get(documentId);
    if (!entry) return;

    entry.cleanupTimer = setTimeout(async () => {
        await persistDoc(documentId);
        entry.yDoc.destroy();
        activeDocs.delete(documentId);
    }, CLEANUP_GRACE_MS);
}

// Periodic save for all dirty docs
setInterval(async () => {
    for (const [docId] of activeDocs) {
        try {
            await persistDoc(docId);
        } catch (err) {
            console.error(`Failed to persist doc ${docId}:`, err.message);
        }
    }
}, SAVE_INTERVAL_MS);

// ── Socket.IO ──────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'DELETE'],
        credentials: true
    },
    maxHttpBufferSize: 5e6
});

io.use(socketAuthMiddleware);

io.on('connection', socket => {
    const userId = socket.user?.id;
    let currentDocId = null;
    let awarenessClientId = null;

    socket.on('get-document', async documentId => {
        currentDocId = documentId;
        const mongoDoc = await getDocument(documentId, userId);
        const entry = getOrCreateYDoc(documentId);
        entry.clients.add(socket.id);
        socket.join(documentId);

        // Initialize from DB if this Y.Doc was just created (empty)
        const yText = entry.yDoc.getText('quill');
        if (yText.length === 0) {
            if (mongoDoc.yState && mongoDoc.yState.length > 0) {
                Y.applyUpdate(entry.yDoc, new Uint8Array(mongoDoc.yState));
            } else if (mongoDoc.data && mongoDoc.data.ops && mongoDoc.data.ops.length > 0) {
                migrateFromLegacyDelta(entry.yDoc, mongoDoc.data);
            }
            entry.dirty = false;
        }

        const state = Y.encodeStateAsUpdate(entry.yDoc);
        socket.emit('load-document', {
            yState: Buffer.from(state),
            title: mongoDoc.title,
            owner: mongoDoc.owner?.toString() ?? null
        });

        socket.on('yjs-update', (update) => {
            try {
                Y.applyUpdate(entry.yDoc, new Uint8Array(update));
                socket.broadcast.to(documentId).emit('yjs-update', update);
            } catch (err) {
                console.error('Failed to apply yjs update:', err.message);
            }
        });

        socket.on('awareness-init', (clientId) => {
            awarenessClientId = clientId;
        });

        socket.on('awareness-update', (update) => {
            socket.broadcast.to(documentId).emit('awareness-update', update);
        });

        socket.on('save-title', async title => {
            await updateTitle(documentId, title);
            socket.broadcast.to(documentId).emit('title-updated', title);
        });
    });

    socket.on('disconnect', async () => {
        if (!currentDocId) return;

        if (awarenessClientId != null) {
            socket.broadcast.to(currentDocId).emit('awareness-remove', awarenessClientId);
        }

        const entry = activeDocs.get(currentDocId);
        if (!entry) return;

        entry.clients.delete(socket.id);

        if (entry.clients.size === 0) {
            await persistDoc(currentDocId);
            io.in(currentDocId).allSockets().then(sockets => {
                if (sockets.size === 0) {
                    scheduleCleanup(currentDocId);
                }
            });
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
