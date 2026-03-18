import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getAllDocuments,
    deleteDocument,
    exportDocument,
    updateTitle,
    saveVersion,
    getVersions,
    getVersionContent,
    restoreVersion,
} from '../controller/document-controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const docs = await getAllDocuments(req.user.id);
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/export', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteDocument(id, req.user.id);
        if (!deleted) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true, id });
    } catch (err) {
        res.status(err.message.includes('Unauthorized') ? 403 : 500).json({ error: err.message });
    }
});

router.patch('/:id/title', async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required' });
        const doc = await updateTitle(id, title.trim());
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        res.json({ id, title: doc.title });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── Version routes ────────────────────────────────────────────── */

// POST /api/documents/:id/versions — save a new snapshot
router.post('/:id/versions', async (req, res) => {
    try {
        const { id } = req.params;
        const { label, yState, data } = req.body;
        if (!yState) return res.status(400).json({ error: 'yState is required' });
        const version = await saveVersion(id, {
            label,
            authorId: req.user.id,
            yState: Buffer.from(yState),   // client sends Array of bytes
            data,
        });
        res.status(201).json(version);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/documents/:id/versions — list all snapshots (no binary)
router.get('/:id/versions', async (req, res) => {
    try {
        const versions = await getVersions(req.params.id);
        if (versions === null) return res.status(404).json({ error: 'Document not found' });
        res.json(versions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/documents/:id/versions/:vid — get one version's content (yState + data)
router.get('/:id/versions/:vid', async (req, res) => {
    try {
        const { id, vid } = req.params;
        const content = await getVersionContent(id, vid);
        if (!content) return res.status(404).json({ error: 'Version not found' });
        // Send yState as an array of bytes (JSON-serialisable)
        res.json({ yState: Array.from(content.yState), data: content.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/documents/:id/versions/:vid/restore — restore a snapshot
router.post('/:id/versions/:vid/restore', async (req, res) => {
    try {
        const { id, vid } = req.params;
        const result = await restoreVersion(id, vid);
        if (!result) return res.status(404).json({ error: 'Version not found' });
        res.json({ success: true, yState: Array.from(result.yState), data: result.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
