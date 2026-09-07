import { Router } from 'express';
import {
  getDueReviews,
  recordReview,
  recordQuizCompletion,
} from '../controllers/word-mastery.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/due', optionalAuth, getDueReviews);
router.post('/review', authenticateToken, recordReview);
router.post('/quiz-complete', optionalAuth, recordQuizCompletion);

export default router;
