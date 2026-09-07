import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import {
  getTodayDateString,
  awardXP,
  ensureUserGamificationInit,
} from '../services/gamification.service';

const DEFAULT_QUESTS = [
  {
    title: 'Word Discovery',
    description: 'Discover or collect 5 new vocabulary words',
    type: 'LEARN_WORDS',
    targetCount: 5,
    xpReward: 50,
    icon: 'book',
  },
  {
    title: 'Mind Sharpener',
    description: 'Complete 10 vocabulary flashcard reviews',
    type: 'REVIEW_WORDS',
    targetCount: 10,
    xpReward: 40,
    icon: 'brain',
  },
  {
    title: 'Quiz Champion',
    description: 'Score 80% or higher on any quiz',
    type: 'QUIZ_SCORE',
    targetCount: 1,
    xpReward: 80,
    icon: 'trophy',
  },
  {
    title: 'Daily Dedication',
    description: 'Maintain your learning streak today',
    type: 'STREAK_MAINTAIN',
    targetCount: 1,
    xpReward: 30,
    icon: 'flame',
  },
  {
    title: "Botanist's Touch",
    description: 'Plant or water flora in your Vocabulary Garden',
    type: 'GARDEN_ACTION',
    targetCount: 2,
    xpReward: 45,
    icon: 'sprout',
  },
];

export const getDailyQuests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await ensureUserGamificationInit(userId);
    }
    const today = getTodayDateString();

    // Ensure default quests exist
    for (const q of DEFAULT_QUESTS) {
      const existing = await prisma.dailyQuest.findFirst({
        where: { title: q.title },
      });
      if (!existing) {
        await prisma.dailyQuest.create({ data: q });
      }
    }

    const quests = await prisma.dailyQuest.findMany({
      where: { isActive: true },
    });

    // Get user's progress for today
    const progressList = userId
      ? await prisma.questProgress.findMany({
          where: {
            userId,
            date: today,
          },
        })
      : [];

    const progressMap = new Map(progressList.map((p) => [p.questId, p]));

    const result = quests.map((q) => {
      const progress = progressMap.get(q.id);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        targetCount: q.targetCount,
        xpReward: q.xpReward,
        icon: q.icon,
        currentCount: progress ? progress.currentCount : 0,
        completed: progress ? progress.completed : false,
        claimed: progress ? progress.claimed : false,
      };
    });

    res.json({ success: true, data: result, date: today });
  } catch (error: any) {
    console.error('getDailyQuests error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const claimReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const questId = String(req.params.questId);
    const today = getTodayDateString();

    const quest = await prisma.dailyQuest.findUnique({
      where: { id: questId },
    });

    if (!quest) {
      res.status(404).json({ success: false, error: 'Quest not found' });
      return;
    }

    const progress = await prisma.questProgress.findUnique({
      where: {
        userId_questId_date: {
          userId,
          questId,
          date: today,
        },
      },
    });

    if (!progress || !progress.completed) {
      res.status(400).json({ success: false, error: 'Quest is not yet completed' });
      return;
    }

    if (progress.claimed) {
      res.status(400).json({ success: false, error: 'Reward has already been claimed' });
      return;
    }

    // Mark as claimed
    await prisma.questProgress.update({
      where: { id: progress.id },
      data: { claimed: true },
    });

    // Award XP
    const xpResult = await awardXP(
      userId,
      quest.xpReward,
      'DAILY_QUEST',
      `Completed Quest: ${quest.title}`
    );

    res.json({
      success: true,
      message: `Claimed +${quest.xpReward} XP!`,
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('claimReward error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
