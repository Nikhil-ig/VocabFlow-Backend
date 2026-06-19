import { Response } from 'express';
import { prisma } from '../server';

export const getStatistics = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const userId = user.id;

    const histories = await prisma.wordHistory.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' },
      select: { cardId: true, newStatus: true }
    });

    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } });

    const userCardStatus = new Map<string, string>();
    histories.forEach((h: { cardId: string, newStatus: string | null }) => {
      let statusStr: string | null | undefined = h.newStatus;
      if (statusStr) {
        if (statusStr === 'TO_LEARN') statusStr = columns[0]?.id;
        else if (statusStr === 'LEARNING') {
          const learningCol = columns.find((c: any) => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
          statusStr = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
        }
        else if (statusStr === 'MASTERED') statusStr = columns[columns.length - 1]?.id;
        if (statusStr) userCardStatus.set(h.cardId, statusStr);
      }
    });

    const firstColumnId = columns[0]?.id;
    const lastColumnId = columns[columns.length - 1]?.id;

    let baseWhere: any = {};
    const userOrgId = user.organizationId;

    baseWhere.OR = [{ userId }];
    if (userOrgId) {
      baseWhere.OR.push({ organizationId: userOrgId });
    } else {
      baseWhere.OR.push({ organizationId: null, user: { role: 'ADMIN' } });
    }

    const allCards = await prisma.vocabularyCard.findMany({
      where: baseWhere,
      include: { user: { select: { role: true } } }
    });

    let toLearnCards = 0;
    let learningCards = 0;
    let masteredCards = 0;

    allCards.forEach((card: any) => {
      let effectiveColumnId: string | null | undefined = userCardStatus.get(card.id);
      if (!effectiveColumnId) {
        if (card.organizationId === null && card.user?.role === 'ADMIN' && user.role !== 'ADMIN') {
          effectiveColumnId = firstColumnId || undefined;
        } else {
          effectiveColumnId = card.columnId;
          if (!effectiveColumnId && card.status) {
            if (card.status === 'TO_LEARN') effectiveColumnId = columns[0]?.id;
            else if (card.status === 'LEARNING') {
              const learningCol = columns.find((c: any) => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
              effectiveColumnId = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
            }
            else if (card.status === 'MASTERED') effectiveColumnId = columns[columns.length - 1]?.id;
          }
        }
      }

      if (effectiveColumnId === firstColumnId) {
        toLearnCards++;
      } else if (effectiveColumnId === lastColumnId) {
        masteredCards++;
      } else {
        learningCards++;
      }
    });

    const totalCards = allCards.length;
    const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reviewsToday = await prisma.wordHistory.count({
      where: {
        userId,
        action: 'REVIEWED',
        timestamp: { gte: today }
      }
    });

    const statistics = await prisma.userStatistics.upsert({
      where: { userId },
      update: {
        totalCards,
        toLearnCards,
        learningCards,
        masteredCards,
        masteryPercentage,
        totalReviewsToday: reviewsToday,
      },
      create: {
        userId,
        totalCards,
        toLearnCards,
        learningCards,
        masteredCards,
        masteryPercentage,
        totalReviewsToday: reviewsToday,
      }
    });

    res.json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
