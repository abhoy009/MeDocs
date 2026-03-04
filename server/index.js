import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Connection from './database/db.js';
import {
    getDocument,
    updateDocument,
    updateTitle,
    getAllDocuments,
    deleteDocument,
    exportDocument
} from './controller/document-controller.js';

const PORT = process.env.PORT || 9000;

// Connect to MongoDB
Connection();

// Express app + HTTP server
const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ── REST API Routes ────────────────────────────────────────

// List all documents
app.get('/api/documents', async (req, res) => {
    try {
        const docs = await getAllDocuments();
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export a document as TXT or JSON
app.get('/api/documents/:id/export', async (req, res) => {
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

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteDocument(id);
        if (!deleted) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Socket.IO ──────────────────────────────────────────────

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'DELETE']
    }
});

io.on('connection', socket => {
    socket.on('get-document', async documentId => {
        const document = await getDocument(documentId);
        socket.join(documentId);
        socket.emit('load-document', { data: document.data, title: document.title });

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
