import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import { enhanceWithOpenRouter } from '../services/chat-ai.service';
import { awardXP, getUserGamificationSnapshot, updateDailyStreak, recordQuestProgress } from '../services/gamification.service';

/**
 * Curated real-life daily conversation starter prompts
 */
export const QUICK_PROMPTS = [
  {
    label: '😂 Tell Me a Joke',
    text: 'Tell me a funny joke about office life or adulting, I need a laugh today!',
    category: 'Humor & Fun',
  },
  {
    label: '🦉 Life Wisdom',
    text: 'I feel like I am falling behind in life and everyone else has it figured out.',
    category: 'Wisdom & Soul',
  },
  {
    label: '☕ Spilled Coffee Disaster',
    text: 'I was so nervous when I spilled hot coffee all over my shirt right before the interview.',
    category: 'Everyday Chaos',
  },
  {
    label: '💼 Boss Zoom Nightmare',
    text: 'My computer froze during a big meeting and my boss was angry with me.',
    category: 'Work Drama',
  },
  {
    label: '🎡 Chaotic Dare',
    text: 'Dare me to use the wildest, funniest vocabulary word in my next conversation.',
    category: 'Fun & Games',
  },
  {
    label: '🍕 2 AM Pizza Guilt',
    text: 'I promised myself I would eat healthy, but I ate an entire large pizza at midnight.',
    category: 'Relatable Life',
  },
  {
    label: '🎉 Big Job Offer',
    text: 'I finally got the dream job offer today and I feel very happy and surprised!',
    category: 'Milestones',
  },
];

/**
 * Handle conversation enhancement request
 */
export const enhanceMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, history = [], userVocab = [], gardenWords: clientGardenWords = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'A valid text message is required.' });
      return;
    }

    const trimmedMsg = message.trim();
    const userId = req.user?.id;
    const knownWordsSet = new Set<string>(
      userVocab.map((w: string) => (w || '').toLowerCase().trim())
    );

    let gardenWordsList: Array<{
      word: string;
      plantType: string;
      growthStage: number;
      slotIndex: number;
      health: number;
      plotId?: string;
      meaning?: string;
    }> = [];

    // If client supplied garden words, seed them
    if (Array.isArray(clientGardenWords) && clientGardenWords.length > 0) {
      clientGardenWords.forEach((gw: any) => {
        if (typeof gw === 'string') {
          gardenWordsList.push({
            word: gw,
            plantType: 'FLOWER',
            growthStage: 2,
            slotIndex: 0,
            health: 100,
          });
        } else if (gw && gw.word) {
          gardenWordsList.push({
            word: gw.word,
            plantType: gw.plantType || 'FLOWER',
            growthStage: gw.growthStage || 2,
            slotIndex: gw.slotIndex ?? 0,
            health: gw.health ?? 100,
            meaning: gw.meaning,
          });
        }
      });
    }

    // If authenticated, also fetch user's saved cards, WordDex, and living Garden flora
    if (userId) {
      try {
        const [cards, worddex, gardenPlots] = await Promise.all([
          prisma.vocabularyCard.findMany({
            where: { userId },
            select: { word: true },
            take: 60,
          }),
          prisma.wordDexEntry.findMany({
            where: { userId },
            select: { card: { select: { word: true } } },
            take: 60,
          }),
          prisma.gardenPlot.findMany({
            where: { userId },
            include: {
              card: {
                select: { word: true, meaning: true },
              },
            },
            take: 30,
          }),
        ]);

        cards.forEach((c) => knownWordsSet.add(c.word.toLowerCase().trim()));
        worddex.forEach((w) => {
          if (w.card?.word) {
            knownWordsSet.add(w.card.word.toLowerCase().trim());
          }
        });

        // Merge DB garden plots
        if (gardenPlots && gardenPlots.length > 0) {
          const dbGardenWords = gardenPlots.map((p) => ({
            word: p.card.word,
            plantType: p.plantType,
            growthStage: p.growthStage,
            slotIndex: p.slotIndex,
            health: p.health,
            plotId: p.id,
            meaning: p.card.meaning || undefined,
          }));

          // Deduplicate by word
          const existingWordSet = new Set(gardenWordsList.map((g) => g.word.toLowerCase()));
          dbGardenWords.forEach((dg) => {
            if (!existingWordSet.has(dg.word.toLowerCase())) {
              gardenWordsList.push(dg);
              existingWordSet.add(dg.word.toLowerCase());
            }
            knownWordsSet.add(dg.word.toLowerCase());
          });
        }
      } catch (dbErr) {
        console.warn('Could not fetch user vocabulary list or garden plots:', dbErr);
      }
    }

    const mergedUserVocab = Array.from(knownWordsSet).filter(Boolean);

    // Check if user spoke any of their living Garden Words in this message!
    const gardenWordsUsedByClient: typeof gardenWordsList = [];
    for (const gw of gardenWordsList) {
      if (gw.word) {
        const regex = new RegExp(`\\b${gw.word.toLowerCase().trim()}\\b`, 'i');
        if (regex.test(trimmedMsg)) {
          gardenWordsUsedByClient.push(gw);
        }
      }
    }

    // If garden words were spoken, water and nurture them in the database!
    const nourishedWords: string[] = [];
    if (userId && gardenWordsUsedByClient.length > 0) {
      for (const gw of gardenWordsUsedByClient) {
        if (gw.plotId) {
          try {
            await prisma.gardenPlot.update({
              where: { id: gw.plotId },
              data: {
                health: 100,
                wateredAt: new Date(),
              },
            });
            nourishedWords.push(gw.word);
          } catch (plotErr) {
            console.warn('Could not auto-water garden plot:', plotErr);
          }
        } else {
          nourishedWords.push(gw.word);
        }
      }
    } else if (gardenWordsUsedByClient.length > 0) {
      gardenWordsUsedByClient.forEach((g) => nourishedWords.push(g.word));
    }

    // Enhance message with AI service passing garden words for recognition & memory
    const result = await enhanceWithOpenRouter(
      trimmedMsg,
      history,
      mergedUserVocab,
      gardenWordsList
    );

    // Award XP for engaging in real-life English conversation practice + Garden bonus!
    let gamificationSnapshot = null;
    let xpAwarded = 10;
    let gardenBonusXP = 0;

    if (userId) {
      try {
        if (nourishedWords.length > 0) {
          gardenBonusXP = nourishedWords.length * 15;
          xpAwarded += gardenBonusXP;
        }

        await awardXP(
          userId,
          xpAwarded,
          'CHAT_CONVERSATION',
          nourishedWords.length > 0
            ? `Practiced English & nourished ${nourishedWords.length} garden plant(s): ${nourishedWords.join(', ')}`
            : 'Practiced real-life English daily conversation & vocabulary upgrades'
        );
        gamificationSnapshot = await getUserGamificationSnapshot(userId, { xpAwarded });
      } catch (xpErr) {
        console.warn('Could not award XP for chat interaction:', xpErr);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        xpAwarded,
        gardenNourished: nourishedWords,
      },
      gamification: gamificationSnapshot,
    });
  } catch (error: any) {
    console.error('enhanceMessage error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to enhance message' });
  }
};

/**
 * Get user's active garden words for chat memory & practice
 */
export const getChatGardenWords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.json({ success: true, data: [] });
      return;
    }

    const plots = await prisma.gardenPlot.findMany({
      where: { userId },
      include: {
        card: {
          select: { word: true, meaning: true },
        },
      },
      orderBy: { slotIndex: 'asc' },
    });

    const data = plots.map((p) => ({
      word: p.card.word,
      meaning: p.card.meaning,
      plantType: p.plantType,
      growthStage: p.growthStage,
      slotIndex: p.slotIndex,
      health: p.health,
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('getChatGardenWords error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch garden words' });
  }
};

/**
 * Get quick starter prompts
 */
export const getChatQuickPrompts = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: QUICK_PROMPTS,
  });
};

/**
 * Add a word to the user's Learning list directly from chat
 */
export const addWordToLearning = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { word, meaning, example, originalWord, tone } = req.body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      res.status(400).json({ success: false, error: 'A valid word is required.' });
      return;
    }

    const cleanWord = word.trim();
    const cleanMeaning =
      meaning?.trim() ||
      (originalWord
        ? `Natural conversational upgrade for "${originalWord}"`
        : `Vocabulary word learned in conversation`);
    const cleanExample = example?.trim() || null;

    if (!userId) {
      // Guest mode response: return mock card so frontend can track locally
      res.status(200).json({
        success: true,
        data: {
          id: `guest-${Date.now()}`,
          word: cleanWord,
          meaning: cleanMeaning,
          example: cleanExample,
          status: 'LEARNING',
          synonyms: originalWord || null,
        },
        message: `"${cleanWord}" added to your Learning list (Guest)!`,
        gamification: { xpAwarded: 25, newTotalXP: 25 },
      });
      return;
    }

    // Find the learning column
    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } });
    const learningCol =
      columns.find(
        (c) => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to')
      ) ||
      columns[1] ||
      columns[0];

    // Check if card already exists for this user
    const existingCard = await prisma.vocabularyCard.findFirst({
      where: {
        userId,
        OR: [
          { word: cleanWord },
          { word: cleanWord.toLowerCase() },
          { word: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase() },
        ],
      },
    });

    if (existingCard) {
      // If already in learning status
      if (existingCard.status === 'LEARNING') {
        res.status(200).json({
          success: true,
          data: existingCard,
          alreadyInLearning: true,
          message: `"${cleanWord}" is already in your Learning list!`,
        });
        return;
      }

      // Move to learning list
      const updatedCard = await prisma.vocabularyCard.update({
        where: { id: existingCard.id },
        data: {
          status: 'LEARNING',
          columnId: learningCol?.id || existingCard.columnId,
          meaning: cleanMeaning || existingCard.meaning,
          example: cleanExample || existingCard.example,
        },
      });

      await prisma.wordHistory.create({
        data: {
          cardId: updatedCard.id,
          userId,
          action: 'STATUS_CHANGED',
          previousStatus: existingCard.status,
          newStatus: 'LEARNING',
        },
      });

      await prisma.wordDexEntry.upsert({
        where: {
          userId_cardId: {
            userId,
            cardId: updatedCard.id,
          },
        },
        update: {},
        create: {
          userId,
          cardId: updatedCard.id,
          rarity: updatedCard.rarity || 'COMMON',
        },
      });

      const gamification = await awardXP(
        userId,
        15,
        'CARD_UPDATED',
        `Moved "${cleanWord}" to Learning list`
      );
      await updateDailyStreak(userId);
      await recordQuestProgress(userId, 'LEARN_WORDS', 1);

      res.status(200).json({
        success: true,
        data: updatedCard,
        alreadyInLearning: false,
        message: `"${cleanWord}" moved to your Learning list! 📚`,
        gamification,
      });
      return;
    }

    // Create brand new card in LEARNING status
    const newCard = await prisma.vocabularyCard.create({
      data: {
        userId,
        word: cleanWord,
        meaning: cleanMeaning,
        example: cleanExample,
        synonyms: originalWord || null,
        status: 'LEARNING',
        columnId: learningCol?.id || null,
        difficulty: 'MEDIUM',
        connotation: 'POSITIVE',
        rarity: 'RARE',
        worldSlug: 'everyday-realm',
      },
    });

    await prisma.wordHistory.create({
      data: {
        cardId: newCard.id,
        userId,
        action: 'CREATED',
        newStatus: 'LEARNING',
      },
    });

    await prisma.wordDexEntry.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId: newCard.id,
        },
      },
      update: {},
      create: {
        userId,
        cardId: newCard.id,
        rarity: newCard.rarity || 'RARE',
      },
    });

    await prisma.wordMastery.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId: newCard.id,
        },
      },
      update: {
        stage: 'SEEN',
        stageLevel: 1,
      },
      create: {
        userId,
        cardId: newCard.id,
        stage: 'SEEN',
        stageLevel: 1,
        timesReviewed: 1,
        lastReviewedAt: new Date(),
      },
    });

    // Award +25 Discovery & Learning XP
    const gamification = await awardXP(
      userId,
      25,
      'WORD_DISCOVERED',
      `Added "${cleanWord}" to Learning list from chat!`
    );
    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'LEARN_WORDS', 1);

    res.status(201).json({
      success: true,
      data: newCard,
      alreadyInLearning: false,
      message: `Added "${cleanWord}" to your Learning list! 📚✨`,
      gamification,
    });
  } catch (error: any) {
    console.error('Error adding word to learning:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add word to learning list.',
    });
  }
};

