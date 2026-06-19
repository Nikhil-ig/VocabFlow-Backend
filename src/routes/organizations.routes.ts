import { Router } from 'express';
import { getOrganizations, createOrganization, updateOrganization } from '../controllers/organizations.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getOrganizations);
router.post('/', authenticateToken, createOrganization);
router.put('/:id', authenticateToken, updateOrganization);

export default router;
