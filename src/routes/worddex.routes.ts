import { Router } from 'express';
import {
  getWordDex,
  discoverWord,
  toggleFavorite,
} from '../controllers/worddex.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, getWordDex);
router.post('/discover', authenticateToken, discoverWord);
router.post('/:cardId/favorite', authenticateToken, toggleFavorite);

export default router;
