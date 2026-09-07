import { Router } from 'express';
import { getDailyQuests, claimReward } from '../controllers/quest.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/daily', optionalAuth, getDailyQuests);
router.post('/:questId/claim', authenticateToken, claimReward);

export default router;
