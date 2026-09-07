import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  completeOnboarding,
} from '../controllers/user-profile.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/me', authenticateToken, getProfile);
router.put('/me', authenticateToken, updateProfile);
router.post('/onboarding', authenticateToken, completeOnboarding);

export default router;
