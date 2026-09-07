import { Router } from 'express';
import {
  getCards,
  createCard,
  getCard,
  updateCard,
  deleteCard,
  getPracticeCards,
  revealWordOfTheDay,
} from '../controllers/cards.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/word-of-the-day/reveal', authenticateToken, revealWordOfTheDay);

// Guest allowed for GET
router.get('/', (req, res, next) => {
  // Try to authenticate, but don't fail if no token (guest mode)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    authenticateToken(req as any, res, next);
  } else {
    next();
  }
}, getCards);

router.post('/', authenticateToken, createCard);
router.get('/practice', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    authenticateToken(req as any, res, next);
  } else {
    next();
  }
}, getPracticeCards);
router.get('/:id', getCard);
router.put('/:id', authenticateToken, updateCard);
router.delete('/:id', authenticateToken, deleteCard);

export default router;
