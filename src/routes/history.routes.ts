import { Router } from 'express';
import { getHistory, createHistory } from '../controllers/history.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getHistory);
router.post('/', authenticateToken, createHistory);

export default router;
