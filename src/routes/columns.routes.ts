import { Router } from 'express';
import { getColumns, createColumn, updateColumn, deleteColumn } from '../controllers/columns.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', getColumns); // Public/Guest allowed
router.post('/', authenticateToken, createColumn);
router.put('/:id', authenticateToken, updateColumn);
router.delete('/:id', authenticateToken, deleteColumn);

export default router;
