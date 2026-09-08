import { Router } from 'express';
import { register, login, me, logout, telegramAuth } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/telegram', telegramAuth);
router.get('/me', authenticateToken, me);

export default router;
