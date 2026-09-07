import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import {
  awardXP,
  updateDailyStreak,
  recordQuestProgress,
  getUserGamificationSnapshot,
} from '../services/gamification.service';

const STAGES = ['NEW', 'SEEN', 'FAMILIAR', 'PRACTICED', 'LEARNED', 'MASTERED'];

const INTERVAL_HOURS = [0, 4, 24, 72, 168, 336]; // Stage 0 to 5

export const getDueReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const worldSlug = (req.query.world || req.query.worldSlug) as string;
    const targetCardId = req.query.cardId as string;
    const now = new Date();

    const cardWhere: any = {};
    if (worldSlug && worldSlug !== 'ALL') {
      cardWhere.worldSlug = worldSlug;
    }

    if (!userId) {
      // Guest practice cards
      let guestCards = await prisma.vocabularyCard.findMany({
        where: cardWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      if (targetCardId && !guestCards.some((c) => c.id === targetCardId)) {
        const target = await prisma.vocabularyCard.findUnique({ where: { id: targetCardId } });
        if (target) guestCards = [target, ...guestCards.slice(0, limit - 1)];
      }

      const formatted = guestCards.map((c) => ({
        ...c,
        mastery: {
          stage: 'PRACTICED',
          stageLevel: 3,
          timesReviewed: 3,
          timesCorrect: 2,
        },
      }));
      res.json({ success: true, data: formatted });
      return;
    }

    // 1. If targetCardId specified, fetch it first
    let prioritizedCards: any[] = [];
    if (targetCardId) {
      const targetCard = await prisma.vocabularyCard.findUnique({ where: { id: targetCardId } });
      if (targetCard) {
        const targetMastery = await prisma.wordMastery.findUnique({
          where: { userId_cardId: { userId, cardId: targetCardId } },
        });
        prioritizedCards.push({
          ...targetCard,
          mastery: targetMastery
            ? {
                stage: targetMastery.stage,
                stageLevel: targetMastery.stageLevel,
                timesReviewed: targetMastery.timesReviewed,
                timesCorrect: targetMastery.timesCorrect,
              }
            : {
                stage: 'NEW',
                stageLevel: 0,
                timesReviewed: 0,
                timesCorrect: 0,
              },
        });
      }
    }

    // 2. Find cards with mastery due
    const masteryWhere: any = {
      userId,
      nextReviewDue: { lte: now },
    };
    if (worldSlug && worldSlug !== 'ALL') {
      masteryWhere.card = { worldSlug };
    }

    const dueMasteries = await prisma.wordMastery.findMany({
      where: masteryWhere,
      include: {
        card: true,
      },
      take: limit,
      orderBy: { nextReviewDue: 'asc' },
    });

    let dueCards = [
      ...prioritizedCards,
      ...dueMasteries
        .filter((m) => !prioritizedCards.some((p) => p.id === m.card.id))
        .map((m) => ({
          ...m.card,
          mastery: {
            stage: m.stage,
            stageLevel: m.stageLevel,
            timesReviewed: m.timesReviewed,
            timesCorrect: m.timesCorrect,
          },
        })),
    ];

    // 3. If fewer than limit, fetch additional cards from world
    if (dueCards.length < limit) {
      const remainingCount = limit - dueCards.length;
      const existingIds = dueCards.map((c) => c.id);

      const additionalCards = await prisma.vocabularyCard.findMany({
        where: {
          id: { notIn: existingIds },
          ...(worldSlug && worldSlug !== 'ALL' ? { worldSlug } : {}),
        },
        take: remainingCount,
        orderBy: { createdAt: 'desc' },
      });

      const cardIds = additionalCards.map((c) => c.id);
      const masteries = await prisma.wordMastery.findMany({
        where: {
          userId,
          cardId: { in: cardIds },
        },
      });
      const masteryMap = new Map(masteries.map((m) => [m.cardId, m]));

      const formattedAdditional = additionalCards.map((c) => {
        const m = masteryMap.get(c.id);
        return {
          ...c,
          mastery: m
            ? {
                stage: m.stage,
                stageLevel: m.stageLevel,
                timesReviewed: m.timesReviewed,
                timesCorrect: m.timesCorrect,
              }
            : {
                stage: 'NEW',
                stageLevel: 0,
                timesReviewed: 0,
                timesCorrect: 0,
              },
        };
      });

      dueCards = [...dueCards, ...formattedAdditional];
    }

    res.json({ success: true, data: dueCards });
  } catch (error: any) {
    console.error('getDueReviews error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const recordReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { cardId, isCorrect } = req.body;
    if (!cardId) {
      res.status(400).json({ success: false, error: 'cardId is required' });
      return;
    }

    const card = await prisma.vocabularyCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    const existing = await prisma.wordMastery.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId,
        },
      },
    });

    let newLevel = 0;
    let timesReviewed = 1;
    let timesCorrect = isCorrect ? 1 : 0;
    let justMastered = false;

    if (existing) {
      timesReviewed = existing.timesReviewed + 1;
      timesCorrect = existing.timesCorrect + (isCorrect ? 1 : 0);
      if (isCorrect) {
        newLevel = Math.min(5, existing.stageLevel + 1);
      } else {
        newLevel = Math.max(0, existing.stageLevel - 1);
      }
      if (existing.stageLevel < 5 && newLevel === 5) {
        justMastered = true;
      }
    } else {
      newLevel = isCorrect ? 1 : 0;
    }

    const nextStage = STAGES[newLevel];
    const intervalHours = INTERVAL_HOURS[newLevel];
    const nextReviewDue = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    const updatedMastery = await prisma.wordMastery.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId,
        },
      },
      update: {
        stage: nextStage,
        stageLevel: newLevel,
        timesReviewed,
        timesCorrect,
        lastReviewedAt: new Date(),
        nextReviewDue,
      },
      create: {
        userId,
        cardId,
        stage: nextStage,
        stageLevel: newLevel,
        timesReviewed,
        timesCorrect,
        lastReviewedAt: new Date(),
        nextReviewDue,
      },
    });

    // Also ensure card is collected in WordDex
    await prisma.wordDexEntry.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId,
        },
      },
      update: {},
      create: {
        userId,
        cardId,
        rarity: card.rarity || 'COMMON',
      },
    });

    // Calculate XP
    let earnedXP = isCorrect ? 15 : 5;
    if (justMastered) {
      earnedXP += 50; // Mastered Word Milestone bonus!
    }

    const xpResult = await awardXP(
      userId,
      earnedXP,
      justMastered ? 'WORD_MASTERED' : 'QUIZ_CORRECT',
      justMastered ? `Mastered word "${card.word}"!` : `Reviewed "${card.word}"`
    );

    // Update streak and advance quest progress
    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'REVIEW_WORDS', 1);

    // Check if card is planted in user's garden; if correct, nourish and hydrate the plant!
    let gardenPlotBoosted = false;
    let gardenPlotSlot: number | null = null;
    if (isCorrect) {
      const plantedPlot = await prisma.gardenPlot.findFirst({
        where: { userId, cardId },
      });
      if (plantedPlot) {
        gardenPlotBoosted = true;
        gardenPlotSlot = plantedPlot.slotIndex;
        await prisma.gardenPlot.update({
          where: { id: plantedPlot.id },
          data: {
            health: 100,
            wateredAt: new Date(),
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        mastery: updatedMastery,
        xpAwarded: earnedXP,
        justMastered,
        unlockedForGarden: justMastered,
        gardenPlotBoosted,
        gardenPlotSlot,
      },
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('recordReview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const recordQuizCompletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.json({ success: true, message: 'Guest quiz recorded' });
      return;
    }

    const { score, correctCount, totalQuestions, xpEarned } = req.body;

    // Advance QUIZ_SCORE quest if score >= 80%
    if (score >= 80) {
      await recordQuestProgress(userId, 'QUIZ_SCORE', 1);
    }

    // Maintain daily streak
    await updateDailyStreak(userId);

    const gamificationSnapshot = await getUserGamificationSnapshot(userId);

    res.json({
      success: true,
      message: 'Quiz session recorded and synced with cosmos',
      gamification: gamificationSnapshot,
    });
  } catch (error: any) {
    console.error('recordQuizCompletion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
