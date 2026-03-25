import express from 'express';
import { generateText, autocompleteText } from '../controller/ai-controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Both routes are protected by the auth middleware
router.post('/generate', authMiddleware, generateText);
router.post('/autocomplete', authMiddleware, autocompleteText);

export default router;
