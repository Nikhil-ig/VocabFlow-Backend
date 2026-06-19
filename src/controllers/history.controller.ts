import { Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';

const historySchema = z.object({
  cardId: z.string().min(1),
  action: z.enum(['CREATED', 'UPDATED', 'STATUS_CHANGED', 'REVIEWED', 'MASTERED', 'DELETED']),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

export const getHistory = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const cardId = req.query.cardId as string;
    const limit = parseInt((req.query.limit as string) || '50');

    let whereClause: any = { userId: user.id };
    if (cardId) {
      whereClause.cardId = cardId;
    }

    const history = await prisma.wordHistory.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        vocabularyCard: {
          select: { word: true, meaning: true }
        }
      }
    });

    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createHistory = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parsed = historySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const card = await prisma.vocabularyCard.findUnique({
      where: { id: parsed.data.cardId }
    });

    if (!card) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    const newHistory = await prisma.wordHistory.create({
      data: {
        userId: user.id,
        cardId: parsed.data.cardId,
        action: parsed.data.action,
        previousStatus: parsed.data.previousStatus,
        newStatus: parsed.data.newStatus,
      }
    });

    res.status(201).json({ success: true, data: newHistory });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
