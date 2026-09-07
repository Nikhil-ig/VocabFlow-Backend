import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import {
  awardXP,
  recordQuestProgress,
  updateDailyStreak,
} from '../services/gamification.service';

export const getWordDex = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { rarity, worldSlug, favoriteOnly, search } = req.query;

    const pos = req.query.pos as string;
    const whereClause: any = {};
    if (rarity && rarity !== 'ALL') {
      whereClause.rarity = rarity as string;
    }
    if (worldSlug && worldSlug !== 'ALL') {
      whereClause.worldSlug = worldSlug as string;
    }
    if (pos && pos !== 'ALL') {
      const pLower = pos.toLowerCase();
      const pUpper = pos.toUpperCase();
      const pCapital = pos.charAt(0).toUpperCase() + pos.slice(1).toLowerCase();
      whereClause.pos = { in: [pLower, pUpper, pCapital] };
    }
    if (search) {
      whereClause.OR = [
        { word: { contains: search as string } },
        { meaning: { contains: search as string } },
      ];
    }

    // Get all system cards matching filters
    const totalCardsInDb = await prisma.vocabularyCard.count();
    const cards = await prisma.vocabularyCard.findMany({
      where: whereClause,
      orderBy: [{ rarity: 'desc' }, { word: 'asc' }],
    });

    // User entries, masteries, and garden plots
    let userEntries: any[] = [];
    let userMasteries: any[] = [];
    let userPlots: any[] = [];

    if (userId) {
      userEntries = await prisma.wordDexEntry.findMany({
        where: { userId },
      });
      userMasteries = await prisma.wordMastery.findMany({
        where: { userId },
      });
      userPlots = await prisma.gardenPlot.findMany({
        where: { userId },
      });
    } else {
      // Guest demo entries: top 18 cards discovered
      userEntries = cards.slice(0, 18).map((c, i) => ({
        cardId: c.id,
        rarity: c.rarity || 'COMMON',
        discoveredAt: new Date(),
        favorite: i % 4 === 0,
      }));
      userMasteries = cards.slice(0, 18).map((c, i) => ({
        cardId: c.id,
        stage: 'FAMILIAR',
        stageLevel: 2,
        timesReviewed: 3,
        timesCorrect: 3,
      }));
      userPlots = cards.slice(0, 4).map((c, i) => ({
        cardId: c.id,
        slotIndex: 6 + i,
        plantType: i === 0 ? 'BONSAI' : i === 1 ? 'CRYSTAL_TREE' : i === 2 ? 'ORCHID' : 'GOLDEN_OAK',
      }));
    }

    const entryMap = new Map(userEntries.map((e) => [e.cardId, e]));
    const masteryMap = new Map(userMasteries.map((m) => [m.cardId, m]));
    const plotMap = new Map(userPlots.map((p) => [p.cardId, p]));

    let items = cards.map((c) => {
      const entry = entryMap.get(c.id);
      const mastery = masteryMap.get(c.id);
      const plot = plotMap.get(c.id);
      const isDiscovered = !!entry;

      return {
        id: c.id,
        word: c.word,
        meaning: c.meaning,
        example: c.example,
        pos: c.pos,
        pronunciation: c.pronunciation,
        difficulty: c.difficulty,
        rarity: c.rarity || 'COMMON',
        worldSlug: c.worldSlug || 'everyday-realm',
        synonyms: c.synonyms,
        antonyms: c.antonyms,
        rootWords: c.rootWords,
        connotation: c.connotation,
        isDiscovered,
        discoveredAt: entry?.discoveredAt || null,
        favorite: entry?.favorite || false,
        masteryStage: mastery?.stage || (isDiscovered ? 'SEEN' : 'UNSEEN'),
        stageLevel: mastery?.stageLevel || 0,
        timesReviewed: mastery?.timesReviewed || 0,
        timesCorrect: mastery?.timesCorrect || 0,
        isPlanted: !!plot,
        gardenSlot: plot ? plot.slotIndex : null,
        plantType: plot ? plot.plantType : null,
      };
    });

    if (favoriteOnly === 'true') {
      items = items.filter((i) => i.favorite);
    }

    const discoveredCount = userEntries.length;

    // Rarity distribution of collected words
    const rarityCounts = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    };
    userEntries.forEach((e) => {
      const r = (e.rarity || 'COMMON') as keyof typeof rarityCounts;
      if (rarityCounts[r] !== undefined) rarityCounts[r]++;
    });

    res.json({
      success: true,
      data: {
        items,
        stats: {
          totalDiscovered: discoveredCount,
          totalCards: totalCardsInDb,
          discoveryPercentage:
            totalCardsInDb > 0
              ? Math.round((discoveredCount / totalCardsInDb) * 100)
              : 0,
          rarityCounts,
        },
      },
    });
  } catch (error: any) {
    console.error('getWordDex error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const discoverWord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { cardId } = req.body;
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

    const existing = await prisma.wordDexEntry.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId,
        },
      },
    });

    if (existing) {
      res.json({ success: true, message: 'Already discovered', data: existing });
      return;
    }

    const entry = await prisma.wordDexEntry.create({
      data: {
        userId,
        cardId,
        rarity: card.rarity || 'COMMON',
      },
    });

    // Also initialize mastery stage to SEEN
    await prisma.wordMastery.upsert({
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
        stage: 'SEEN',
        stageLevel: 1,
        timesReviewed: 1,
        lastReviewedAt: new Date(),
      },
    });

    // Award XP
    const xpResult = await awardXP(
      userId,
      20,
      'WORD_DISCOVERED',
      `Discovered "${card.word}" (${card.rarity || 'COMMON'})`
    );

    // Record quest progress and streak
    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'LEARN_WORDS', 1);

    res.json({
      success: true,
      message: `Discovered "${card.word}"! +20 XP`,
      data: entry,
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('discoverWord error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const cardId = String(req.params.cardId);

    const entry = await prisma.wordDexEntry.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId,
        },
      },
    });

    if (!entry) {
      // Create it with favorite = true
      const card = await prisma.vocabularyCard.findUnique({ where: { id: cardId } });
      const newEntry = await prisma.wordDexEntry.create({
        data: {
          userId,
          cardId,
          favorite: true,
          rarity: card?.rarity || 'COMMON',
        },
      });
      res.json({ success: true, favorite: true, data: newEntry });
      return;
    }

    const updated = await prisma.wordDexEntry.update({
      where: { id: entry.id },
      data: { favorite: !entry.favorite },
    });

    res.json({ success: true, favorite: updated.favorite, data: updated });
  } catch (error: any) {
    console.error('toggleFavorite error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
