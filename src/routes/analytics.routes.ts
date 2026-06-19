import { Router } from 'express';
import { getActivity, getDistribution } from '../controllers/analytics.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/activity', authenticateToken, getActivity);
router.get('/distribution', authenticateToken, getDistribution);

export default router;
