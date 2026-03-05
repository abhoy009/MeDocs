import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getAllDocuments,
    deleteDocument,
    exportDocument,
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

export default router;
