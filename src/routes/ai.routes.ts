import { Router } from 'express';
import { getRecommendations, enrichWord, getWordOfTheDay } from '../controllers/ai.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/recommendations', authenticateToken, getRecommendations);
router.post('/enrich', authenticateToken, enrichWord);
router.get('/word-of-the-day', getWordOfTheDay); // Public endpoint so anyone can see it

export default router;
