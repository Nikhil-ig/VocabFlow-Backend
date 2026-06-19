import { Response } from 'express';
import { prisma } from '../server';

export const getColumns = async (req: any, res: Response): Promise<void> => {
  try {
    const columns = await prisma.boardColumn.findMany({
      orderBy: { order: 'asc' }
    });
    
    res.json({ success: true, data: columns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createColumn = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const { name, order, color } = req.body;
    
    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const newColumn = await prisma.boardColumn.create({
      data: {
        name,
        order: order || 0,
        color: color || 'bg-slate-100',
      }
    });

    res.status(201).json({ success: true, data: newColumn });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateColumn = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    const { name, order, color } = req.body;

    const column = await prisma.boardColumn.findUnique({ where: { id } });
    if (!column) {
      res.status(404).json({ success: false, error: 'Column not found' });
      return;
    }

    const updatedColumn = await prisma.boardColumn.update({
      where: { id },
      data: {
        name: name || undefined,
        order: order !== undefined ? order : undefined,
        color: color || undefined,
      }
    });

    res.json({ success: true, data: updatedColumn });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteColumn = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    
    // Check if there are cards in this column natively
    const cardCount = await prisma.vocabularyCard.count({
      where: { columnId: id }
    });

    if (cardCount > 0) {
      res.status(400).json({ success: false, error: 'Cannot delete a column that contains cards natively.' });
      return;
    }

    // Also check if any wordHistory points to this column
    const historyCount = await prisma.wordHistory.count({
      where: { newStatus: id }
    });

    if (historyCount > 0) {
      res.status(400).json({ success: false, error: 'Cannot delete a column that users have moved cards to.' });
      return;
    }

    await prisma.boardColumn.delete({ where: { id } });

    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
