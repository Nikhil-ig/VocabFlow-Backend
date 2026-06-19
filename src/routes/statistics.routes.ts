import { Router } from 'express';
import { getStatistics } from '../controllers/statistics.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getStatistics);

export default router;
