import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

Connection();

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true   // needed for cookies
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

// ── Socket.IO ──────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'DELETE'],
        credentials: true
    }
});

// Protect all socket connections
io.use(socketAuthMiddleware);

io.on('connection', socket => {
    const userId = socket.user?.id;

    socket.on('get-document', async documentId => {
        const document = await getDocument(documentId, userId);
        socket.join(documentId);
        socket.emit('load-document', {
            data: document.data,
            title: document.title,
            owner: document.owner?.toString() ?? null
        });

        socket.on('send-changes', delta => {
            socket.broadcast.to(documentId).emit('receive-changes', delta);
        });

        socket.on('save-document', async data => {
            await updateDocument(documentId, data);
        });

        socket.on('save-title', async title => {
            await updateTitle(documentId, title);
            socket.broadcast.to(documentId).emit('title-updated', title);
        });
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
