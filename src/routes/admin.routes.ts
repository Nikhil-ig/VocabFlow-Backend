import { Router } from 'express';
import { getStats, getSettings, updateSettings } from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// In a real app, we would add an isAdmin middleware here
router.get('/stats', authenticateToken, getStats);
router.get('/settings', getSettings); // public to allow AppInitializer to load themes
router.put('/settings', authenticateToken, updateSettings);

export default router;
