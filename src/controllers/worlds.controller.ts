import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';

const DEFAULT_WORLDS = [
  {
    slug: 'everyday-realm',
    name: 'Everyday Realm',
    description: 'Essential conversational fluency, social idioms, and daily interactions.',
    icon: 'compass',
    themeColor: '#10b981', // Emerald
    order: 1,
  },
  {
    slug: 'business-citadel',
    name: 'Business Citadel',
    description: 'Corporate diplomacy, strategic negotiation, finance, and boardroom leadership.',
    icon: 'briefcase',
    themeColor: '#3b82f6', // Blue
    order: 2,
  },
  {
    slug: 'academic-nexus',
    name: 'Academic Nexus',
    description: 'Scholarly discourse, GRE/TOEFL vocabulary, cognitive frameworks, and analytical prose.',
    icon: 'book-open',
    themeColor: '#8b5cf6', // Purple
    order: 3,
  },
  {
    slug: 'tech-frontier',
    name: 'Tech Frontier',
    description: 'Artificial intelligence, system architectures, engineering paradigms, and cyber concepts.',
    icon: 'cpu',
    themeColor: '#06b6d4', // Cyan
    order: 4,
  },
  {
    slug: 'literary-wilds',
    name: 'Literary Wilds',
    description: 'Evocative imagery, archaic elegance, poetic devices, and classical rhetoric.',
    icon: 'feather',
    themeColor: '#f59e0b', // Amber
    order: 5,
  },
];

export const getWorlds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Ensure default worlds exist
    let worlds = await prisma.vocabWorld.findMany({
      orderBy: { order: 'asc' },
    });

    if (worlds.length === 0) {
      for (const w of DEFAULT_WORLDS) {
        await prisma.vocabWorld.create({ data: w });
      }
      worlds = await prisma.vocabWorld.findMany({
        orderBy: { order: 'asc' },
      });
    }

    // If authenticated, get user's stats per world
    let userWordDexSet = new Set<string>();
    if (userId) {
      const userEntries = await prisma.wordDexEntry.findMany({
        where: { userId },
        select: { cardId: true },
      });
      userWordDexSet = new Set(userEntries.map((e) => e.cardId));
    }

    // Get cards grouped by worldSlug
    const allCards = await prisma.vocabularyCard.findMany({
      select: { id: true, worldSlug: true },
    });

    const worldCardsMap = new Map<string, string[]>();
    allCards.forEach((c) => {
      const slug = c.worldSlug || 'everyday-realm';
      const list = worldCardsMap.get(slug) || [];
      list.push(c.id);
      worldCardsMap.set(slug, list);
    });

    const result = worlds.map((w) => {
      const cardIds = worldCardsMap.get(w.slug) || [];
      const totalWords = cardIds.length;
      const discoveredWords = cardIds.filter((id) => userWordDexSet.has(id)).length;
      const progressPct =
        totalWords > 0 ? Math.round((discoveredWords / totalWords) * 100) : 0;

      return {
        ...w,
        totalWords,
        discoveredWords,
        progressPct,
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('getWorlds error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
