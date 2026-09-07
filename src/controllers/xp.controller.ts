import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import { awardXP, calculateLevelInfo } from '../services/gamification.service';

export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        name: true,
        avatar: true,
        xp: true,
        level: true,
      },
      orderBy: { xp: 'desc' },
      take: 20,
    });

    const formatted = topUsers.map((u, index) => ({
      rank: index + 1,
      id: u.id,
      name: u.displayName || u.name || 'Anonymous Explorer',
      avatar: u.avatar || 'explorer',
      xp: u.xp,
      level: u.level,
      levelInfo: calculateLevelInfo(u.xp),
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    console.error('getLeaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getXPHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const transactions = await prisma.xPTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error('getXPHistory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const award = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { amount, source, description } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid XP amount required' });
      return;
    }

    const result = await awardXP(
      userId,
      Math.min(500, Math.floor(amount)), // Cap single client grant to 500
      source || 'GENERAL_ACTIVITY',
      description || 'Vocabulary activity'
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('award XP error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
