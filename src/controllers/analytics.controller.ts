import { Response } from 'express';
import { prisma } from '../server';

export const getActivity = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const userId = user.id;
    const days = parseInt((req.query.days as string) || '7');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const history = await prisma.wordHistory.findMany({
      where: {
        userId,
        timestamp: { gte: startDate }
      },
      select: {
        action: true,
        timestamp: true
      }
    });

    const activityByDate: Record<string, { reviews: number, masteries: number }> = {};

    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      activityByDate[dateStr] = { reviews: 0, masteries: 0 };
    }

    history.forEach((h: any) => {
      const dateStr = new Date(h.timestamp).toISOString().split('T')[0];
      if (activityByDate[dateStr]) {
        if (h.action === 'REVIEWED') {
          activityByDate[dateStr].reviews++;
        } else if (h.action === 'MASTERED') {
          activityByDate[dateStr].masteries++;
        }
      }
    });

    // Convert object to array sorted by date asc
    const activityList = Object.keys(activityByDate)
      .sort()
      .map(date => ({
        date,
        reviews: activityByDate[date].reviews,
        masteries: activityByDate[date].masteries
      }));

    res.json({ success: true, data: activityList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDistribution = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const userId = user.id;

    const cards = await prisma.vocabularyCard.findMany({
      where: { userId },
      select: { pos: true, status: true }
    });

    const posDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    cards.forEach((c: any) => {
      // POS
      const pos = c.pos || 'Other';
      posDistribution[pos] = (posDistribution[pos] || 0) + 1;

      // Status
      const status = c.status || 'TO_LEARN';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        partOfSpeech: Object.keys(posDistribution).map(name => ({ name, value: posDistribution[name] })),
        status: Object.keys(statusDistribution).map(name => ({ name, value: statusDistribution[name] })),
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
