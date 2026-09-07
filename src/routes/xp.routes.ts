import { Router } from 'express';
import {
  getLeaderboard,
  getXPHistory,
  award,
} from '../controllers/xp.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/leaderboard', authenticateToken, getLeaderboard);
router.get('/history', authenticateToken, getXPHistory);
router.post('/award', authenticateToken, award);

export default router;
