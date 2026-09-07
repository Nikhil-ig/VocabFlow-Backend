import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import {
  calculateLevelInfo,
  ensureUserGamificationInit,
  awardXP,
} from '../services/gamification.service';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await ensureUserGamificationInit(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        avatar: true,
        role: true,
        xp: true,
        level: true,
        onboardingComplete: true,
        subscriptionTier: true,
        profile: true,
        streak: true,
        _count: {
          select: {
            wordDexEntries: true,
            gardenPlots: true,
            wordMasteries: {
              where: { stage: 'MASTERED' },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const levelInfo = calculateLevelInfo(user.xp);

    // Get recent 5 XP transactions
    const recentXP = await prisma.xPTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get unlocked achievements
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        ...user,
        levelInfo,
        recentXP,
        achievements,
        stats: {
          collectedWords: user._count.wordDexEntries,
          masteredWords: user._count.wordMasteries,
          gardenPlants: user._count.gardenPlots,
        },
      },
    });
  } catch (error: any) {
    console.error('getProfile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      displayName,
      avatar,
      nativeLanguage,
      englishLevel,
      dailyGoalMinutes,
      targetWordsPerDay,
      preferredWorld,
    } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName !== undefined ? displayName : undefined,
        avatar: avatar !== undefined ? avatar : undefined,
      },
    });

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        nativeLanguage: nativeLanguage !== undefined ? nativeLanguage : undefined,
        englishLevel: englishLevel !== undefined ? englishLevel : undefined,
        dailyGoalMinutes: dailyGoalMinutes !== undefined ? Number(dailyGoalMinutes) : undefined,
        targetWordsPerDay: targetWordsPerDay !== undefined ? Number(targetWordsPerDay) : undefined,
        preferredWorld: preferredWorld !== undefined ? preferredWorld : undefined,
      },
      create: {
        userId,
        nativeLanguage: nativeLanguage || 'en',
        englishLevel: englishLevel || 'INTERMEDIATE',
        dailyGoalMinutes: dailyGoalMinutes ? Number(dailyGoalMinutes) : 15,
        targetWordsPerDay: targetWordsPerDay ? Number(targetWordsPerDay) : 5,
        preferredWorld: preferredWorld || 'everyday-realm',
      },
    });

    res.json({ success: true, data: updatedProfile });
  } catch (error: any) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      displayName,
      avatar,
      englishLevel,
      dailyGoalMinutes,
      preferredWorld,
    } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName || req.user?.name || 'Cosmic Traveler',
        avatar: avatar || 'explorer',
        onboardingComplete: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        englishLevel: englishLevel || 'INTERMEDIATE',
        dailyGoalMinutes: dailyGoalMinutes ? Number(dailyGoalMinutes) : 15,
        preferredWorld: preferredWorld || 'everyday-realm',
      },
      create: {
        userId,
        englishLevel: englishLevel || 'INTERMEDIATE',
        dailyGoalMinutes: dailyGoalMinutes ? Number(dailyGoalMinutes) : 15,
        preferredWorld: preferredWorld || 'everyday-realm',
      },
    });

    // Award initial welcoming XP bonus!
    const xpResult = await awardXP(userId, 50, 'ONBOARDING_BONUS', 'Completed VocabVerse Onboarding');

    res.json({
      success: true,
      message: 'Onboarding completed successfully!',
      xpAwarded: 50,
      levelInfo: xpResult.levelInfo,
    });
  } catch (error: any) {
    console.error('completeOnboarding error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
