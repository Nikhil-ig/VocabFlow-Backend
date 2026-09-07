import { prisma } from '../server';

export interface LevelInfo {
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPct: number;
  title: string;
}

export const getTitleForLevel = (level: number): string => {
  if (level >= 30) return 'Lexical Grandmaster';
  if (level >= 20) return 'Arch-Linguist';
  if (level >= 15) return 'Word Alchemist';
  if (level >= 10) return 'Vocabulary Sage';
  if (level >= 7) return 'Cosmic Wordsmith';
  if (level >= 5) return 'Grammar Knight';
  if (level >= 3) return 'Pathfinder';
  if (level >= 2) return 'Eager Novice';
  return 'Cosmic Seeker';
};

export const calculateLevelInfo = (xp: number): LevelInfo => {
  // Level formula: level = floor(sqrt(xp / 100)) + 1
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
  const currentLevelMinXP = Math.pow(level - 1, 2) * 100;
  const nextLevelXP = Math.pow(level, 2) * 100;
  const range = nextLevelXP - currentLevelMinXP;
  const currentXPInRange = Math.max(0, xp - currentLevelMinXP);
  const progressPct = Math.min(100, Math.round((currentXPInRange / range) * 100));

  return {
    level,
    currentLevelXP: currentXPInRange,
    nextLevelXP: range,
    progressPct,
    title: getTitleForLevel(level),
  };
};

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayDateString = (): string => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const year = yesterday.getUTCFullYear();
  const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Ensure user has Profile, Streak, and initial setups
 */
export const ensureUserGamificationInit = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, streak: true },
  });

  if (!user) return null;

  if (!user.profile) {
    await prisma.userProfile.create({
      data: {
        userId,
        nativeLanguage: 'en',
        englishLevel: 'INTERMEDIATE',
        dailyGoalMinutes: 15,
        targetWordsPerDay: 5,
        preferredWorld: 'everyday-realm',
      },
    });
  }

  if (!user.streak) {
    await prisma.userStreak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: getTodayDateString(),
      },
    });
  }

  return user;
};

export interface GamificationSnapshot {
  xp: number;
  xpAwarded: number;
  level: number;
  leveledUp: boolean;
  levelInfo: LevelInfo;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
  };
  stats: {
    collectedWords: number;
    masteredWords: number;
    gardenPlants: number;
  };
}

/**
 * Fetch full real-time gamification snapshot for a user
 */
export const getUserGamificationSnapshot = async (
  userId: string,
  extra: { xpAwarded?: number; leveledUp?: boolean } = {}
): Promise<GamificationSnapshot> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      xp: true,
      level: true,
      streak: {
        select: {
          currentStreak: true,
          longestStreak: true,
          lastActiveDate: true,
        },
      },
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

  const xp = user?.xp || 0;
  const levelInfo = calculateLevelInfo(xp);

  return {
    xp,
    xpAwarded: extra.xpAwarded ?? 0,
    level: levelInfo.level,
    leveledUp: extra.leveledUp ?? false,
    levelInfo,
    streak: user?.streak || {
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: getTodayDateString(),
    },
    stats: {
      collectedWords: user?._count.wordDexEntries || 0,
      masteredWords: user?._count.wordMasteries || 0,
      gardenPlants: user?._count.gardenPlots || 0,
    },
  };
};

/**
 * Award XP to a user with ledger entry and level calculation
 */
export const awardXP = async (
  userId: string,
  amount: number,
  source: string,
  description: string
): Promise<GamificationSnapshot> => {
  await ensureUserGamificationInit(userId);

  // Record ledger entry
  await prisma.xPTransaction.create({
    data: {
      userId,
      amount,
      source,
      description,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  const previousLevel = user?.level || 1;
  const newXP = (user?.xp || 0) + amount;
  const levelInfo = calculateLevelInfo(newXP);
  const leveledUp = levelInfo.level > previousLevel;

  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: newXP,
      level: levelInfo.level,
    },
  });

  return getUserGamificationSnapshot(userId, { xpAwarded: amount, leveledUp });
};

/**
 * Update daily streak
 */
export const updateDailyStreak = async (userId: string) => {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  let streak = await prisma.userStreak.findUnique({
    where: { userId },
  });

  if (!streak) {
    streak = await prisma.userStreak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
      },
    });
    return streak;
  }

  if (streak.lastActiveDate === today) {
    return streak; // Already active today
  }

  let newStreakCount = 1;
  if (streak.lastActiveDate === yesterday) {
    newStreakCount = streak.currentStreak + 1;
  }

  const longest = Math.max(newStreakCount, streak.longestStreak);

  const updated = await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreakCount,
      longestStreak: longest,
      lastActiveDate: today,
    },
  });

  // Record streak quest
  await recordQuestProgress(userId, 'STREAK_MAINTAIN', 1);

  return updated;
};

/**
 * Record progress towards today's quests
 */
export const recordQuestProgress = async (
  userId: string,
  questType: string,
  incrementBy: number = 1
) => {
  const today = getTodayDateString();

  // Find active quests of this type
  const matchingQuests = await prisma.dailyQuest.findMany({
    where: { type: questType, isActive: true },
  });

  for (const quest of matchingQuests) {
    const existing = await prisma.questProgress.findUnique({
      where: {
        userId_questId_date: {
          userId,
          questId: quest.id,
          date: today,
        },
      },
    });

    if (existing) {
      if (existing.completed) continue;
      const newCount = existing.currentCount + incrementBy;
      const completed = newCount >= quest.targetCount;
      await prisma.questProgress.update({
        where: { id: existing.id },
        data: {
          currentCount: newCount,
          completed,
        },
      });
    } else {
      const completed = incrementBy >= quest.targetCount;
      await prisma.questProgress.create({
        data: {
          userId,
          questId: quest.id,
          date: today,
          currentCount: incrementBy,
          completed,
        },
      });
    }
  }
};
