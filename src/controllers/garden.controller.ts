import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../server';
import {
  awardXP,
  ensureUserGamificationInit,
  updateDailyStreak,
  recordQuestProgress,
} from '../services/gamification.service';
import {
  generateRoboticChallenge,
  evaluateRoboticSentence,
  getFallbackDailyChaosExample,
} from '../services/robot-ai.service';

const PLANT_TYPES = ['FLOWER', 'BONSAI', 'CRYSTAL_TREE', 'FERN', 'ORCHID', 'GOLDEN_OAK'];

export const resolveUserId = async (req: AuthRequest): Promise<string | null> => {
  if (req.user?.id) return req.user.id;
  const demoUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  return demoUser?.id || null;
};

export const getGarden = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);


    if (userId) {
      await ensureUserGamificationInit(userId);
    }

    // Get all garden plots with rich card details
    const plots = userId
      ? await prisma.gardenPlot.findMany({
          where: { userId },
          include: {
            card: {
              select: {
                id: true,
                word: true,
                meaning: true,
                example: true,
                pos: true,
                pronunciation: true,
                rarity: true,
                difficulty: true,
                worldSlug: true,
              },
            },
          },
          orderBy: { slotIndex: 'asc' },
        })
      : [];

    const plantedCardIds = plots.map((p) => p.cardId);

    // Get words available to plant:
    // 1. User's mastered or practiced words
    let availableWords: any[] = [];
    if (userId) {
      const masteries = await prisma.wordMastery.findMany({
        where: {
          userId,
          cardId: { notIn: plantedCardIds },
        },
        include: {
          card: {
            select: {
              id: true,
              word: true,
              meaning: true,
              example: true,
              pos: true,
              pronunciation: true,
              rarity: true,
              difficulty: true,
              worldSlug: true,
            },
          },
        },
        orderBy: { stageLevel: 'desc' },
        take: 20,
      });

      availableWords = masteries.map((m) => ({
        ...m.card,
        stage: m.stage,
        stageLevel: m.stageLevel,
      }));

      // 2. If fewer than 5, also look up discovered WordDex cards
      if (availableWords.length < 5) {
        const existingWordIds = new Set(availableWords.map((w) => w.id));
        const dexEntries = await prisma.wordDexEntry.findMany({
          where: {
            userId,
            cardId: { notIn: [...plantedCardIds, ...Array.from(existingWordIds)] },
          },
          include: {
            card: {
              select: {
                id: true,
                word: true,
                meaning: true,
                example: true,
                pos: true,
                pronunciation: true,
                rarity: true,
                difficulty: true,
                worldSlug: true,
              },
            },
          },
          take: 10,
        });

        for (const d of dexEntries) {
          if (!existingWordIds.has(d.card.id)) {
            availableWords.push({
              ...d.card,
              stage: 'DISCOVERED',
              stageLevel: 1,
            });
            existingWordIds.add(d.card.id);
          }
        }
      }
    }

    // 3. Fallback to system cards if still empty
    if (availableWords.length === 0) {
      const fallback = await prisma.vocabularyCard.findMany({
        where: { id: { notIn: plantedCardIds } },
        take: 8,
        select: {
          id: true,
          word: true,
          meaning: true,
          example: true,
          pos: true,
          pronunciation: true,
          rarity: true,
          difficulty: true,
          worldSlug: true,
        },
      });
      availableWords = fallback.map((c) => ({
        ...c,
        stage: 'NEW',
        stageLevel: 0,
      }));
    }

    // Build 25 slots grid (5x5)
    const plotMap = new Map(plots.map((p) => [p.slotIndex, p]));
    const grid = Array.from({ length: 25 }, (_, index) => {
      const plot = plotMap.get(index);
      return (
        plot || {
          slotIndex: index,
          isEmpty: true,
        }
      );
    });

    res.json({
      success: true,
      data: {
        grid,
        plantedCount: plots.length,
        totalCapacity: 25,
        availableToPlant: availableWords,
        plantTypes: PLANT_TYPES,
      },
    });
  } catch (error: any) {
    console.error('getGarden error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const plantWord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }


    const { cardId, slotIndex, plantType } = req.body;
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

    // Check if this card is already planted for this user
    const existingPlotForCard = await prisma.gardenPlot.findFirst({
      where: { userId, cardId },
      include: { card: true },
    });

    if (existingPlotForCard) {
      res.json({
        success: true,
        message: `"${card.word}" is already planted in Garden Slot #${existingPlotForCard.slotIndex + 1}!`,
        data: {
          plot: existingPlotForCard,
          alreadyPlanted: true,
        },
      });
      return;
    }

    // Determine target slot
    let targetSlot: number | null = null;
    if (slotIndex !== undefined && slotIndex !== null) {
      const parsedSlot = Number(slotIndex);
      if (parsedSlot < 0 || parsedSlot >= 25) {
        res.status(400).json({ success: false, error: 'slotIndex must be between 0 and 24' });
        return;
      }
      const existingPlot = await prisma.gardenPlot.findUnique({
        where: {
          userId_slotIndex: {
            userId,
            slotIndex: parsedSlot,
          },
        },
      });
      if (existingPlot) {
        res.status(400).json({ success: false, error: `Garden slot #${parsedSlot + 1} is already occupied` });
        return;
      }
      targetSlot = parsedSlot;
    } else {
      // Auto-assign first available empty slot (0..24)
      const occupiedPlots = await prisma.gardenPlot.findMany({
        where: { userId },
        select: { slotIndex: true },
      });
      const occupiedSet = new Set(occupiedPlots.map((p) => p.slotIndex));
      for (let i = 0; i < 25; i++) {
        if (!occupiedSet.has(i)) {
          targetSlot = i;
          break;
        }
      }
      if (targetSlot === null) {
        res.status(400).json({ success: false, error: 'Garden is full! All 25 slots are currently occupied.' });
        return;
      }
    }

    // Theme plant type based on rarity if not explicitly supplied
    let chosenPlantType = plantType;
    if (!chosenPlantType || !PLANT_TYPES.includes(chosenPlantType)) {
      if (card.rarity === 'LEGENDARY') chosenPlantType = 'GOLDEN_OAK';
      else if (card.rarity === 'EPIC') chosenPlantType = 'CRYSTAL_TREE';
      else if (card.rarity === 'RARE') chosenPlantType = 'ORCHID';
      else if (card.rarity === 'UNCOMMON') chosenPlantType = 'BONSAI';
      else chosenPlantType = 'FLOWER';
    }

    const plot = await prisma.gardenPlot.create({
      data: {
        userId,
        cardId,
        slotIndex: targetSlot,
        plantType: chosenPlantType,
        growthStage: 1, // Seedling
        health: 100,
        wateredAt: new Date(),
      },
      include: {
        card: true,
      },
    });

    // Award garden planting XP!
    const xpResult = await awardXP(
      userId,
      25,
      'GARDEN_PLANT',
      `Planted "${card.word}" in Vocabulary Garden`
    );

    // Update streak and advance quest
    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'GARDEN_ACTION', 1);

    res.json({
      success: true,
      message: `🌱 Planted "${card.word}" in Garden Slot #${targetSlot + 1}! +25 XP`,
      data: {
        ...plot,
        plot,
        slotIndex: targetSlot,
      },
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('plantWord error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getNourishChallenge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { slotIndex } = req.params;
    const plot = await prisma.gardenPlot.findUnique({
      where: {
        userId_slotIndex: {
          userId,
          slotIndex: Number(slotIndex),
        },
      },
      include: {
        card: true,
      },
    });

    if (!plot) {
      res.status(404).json({ success: false, error: 'Garden plot not found' });
      return;
    }

    const card = plot.card;

    // Fetch other vocabulary cards as realistic distractors
    const otherCards = await prisma.vocabularyCard.findMany({
      where: {
        id: { not: card.id },
      },
      take: 12,
      select: {
        id: true,
        word: true,
        meaning: true,
        pos: true,
      },
    });

    // 1. Build Definition Challenge
    const samePosCards = otherCards.filter(
      (c) => c.pos && card.pos && c.pos.toLowerCase() === card.pos.toLowerCase()
    );
    let meaningDistractors = (samePosCards.length >= 3 ? samePosCards : otherCards)
      .map((c) => c.meaning)
      .filter((m) => m && m.toLowerCase() !== card.meaning.toLowerCase())
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const fallbackDefinitions = [
      'To express subtle logical nuances during an analytical discussion.',
      'An intrinsic quality embodying harmony, resilience, and balance.',
      'Marked by keen attention to precision, depth, and deliberate care.',
    ];

    while (meaningDistractors.length < 3) {
      meaningDistractors.push(
        fallbackDefinitions[meaningDistractors.length] || 'A distinct grammatical construct.'
      );
    }

    const quizOptions = [...meaningDistractors, card.meaning].sort(() => 0.5 - Math.random());
    const correctIndex = quizOptions.indexOf(card.meaning);

    // 2. Build Sentence Cloze if example exists
    let clozeSentence = '';
    let clozeOptions: string[] = [];
    let clozeCorrectIndex = 0;
    if (card.example && card.example.length > 10) {
      const wordRegex = new RegExp(`\\b${card.word}\\b`, 'gi');
      if (wordRegex.test(card.example)) {
        clozeSentence = card.example.replace(wordRegex, '[ _____ ]');
      } else {
        clozeSentence = `In thoughtful context, the phrase "[ _____ ]" conveys: ${card.meaning}`;
      }
      const wordDistractors = otherCards
        .map((c) => c.word)
        .filter((w) => w.toLowerCase() !== card.word.toLowerCase())
        .slice(0, 3);
      const fallbackWords = ['Serendipity', 'Eloquent', 'Resilient'];
      while (wordDistractors.length < 3) {
        wordDistractors.push(fallbackWords[wordDistractors.length] || 'Harmonious');
      }
      clozeOptions = [...wordDistractors, card.word].sort(() => 0.5 - Math.random());
      clozeCorrectIndex = clozeOptions.indexOf(card.word);
    }

    // 3. Fast instant robotic challenge retrieval (0ms latency, zero lag!)
    const fallbackChaos = getFallbackDailyChaosExample(card.word, card.meaning, card.pos);
    let roboticChallenge = null;
    try {
      // Fast call with short timeout or cache retrieval
      roboticChallenge = await generateRoboticChallenge(card);
    } catch (e: any) {
      console.warn('Using instant fallback for robotic challenge:', e.message);
    }

    res.json({
      success: true,
      data: {
        slotIndex: Number(slotIndex),
        plantType: plot.plantType,
        growthStage: plot.growthStage,
        health: plot.health,
        card: {
          id: card.id,
          word: card.word,
          meaning: card.meaning,
          vibe:
            roboticChallenge?.vibe ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).vibe,
          mnemonic:
            roboticChallenge?.mnemonic ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).mnemonic,
          example: roboticChallenge?.dailyChaosExample || card.example,
          dailyChaosExample:
            roboticChallenge?.dailyChaosExample ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).example,
          pos: card.pos,
          pronunciation: card.pronunciation,
          synonyms: card.synonyms,
        },
        robotic: roboticChallenge,
        quiz: {
          question: roboticChallenge?.question || `What is the accurate meaning of "${card.word}"?`,
          options: roboticChallenge?.options || quizOptions,
          correctIndex: typeof roboticChallenge?.correctIndex === 'number' ? roboticChallenge.correctIndex : correctIndex,
          clue: roboticChallenge?.robotHint || `Functions as a ${card.pos || 'Term'} • Pronounced: ${card.pronunciation || 'standard'}`,
          cloze: clozeSentence
            ? {
                sentence: clozeSentence,
                options: clozeOptions,
                correctIndex: clozeCorrectIndex,
              }
            : null,
        },
        sentencePrompt: {
          targetWord: card.word,
          meaning: card.meaning,
          vibe:
            roboticChallenge?.vibe ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).vibe,
          mnemonic:
            roboticChallenge?.mnemonic ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).mnemonic,
          example: card.example,
          starters: roboticChallenge?.starters || [
            `In modern life, ${card.word}...`,
            `I experienced pure ${card.word} when...`,
            `It was completely ${card.word} when my phone...`,
          ],
          sentenceBlocks:
            roboticChallenge?.sentenceBlocks ||
            getFallbackDailyChaosExample(card.word, card.meaning, card.pos).sentenceBlocks,
          directiveTitle: roboticChallenge?.directiveTitle || '[DAILY CHAOS SENTENCE LAB]',
        },
      },
    });
  } catch (error: any) {
    console.error('getNourishChallenge error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const waterPlant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { slotIndex } = req.params;
    const { mode, sentence, quizAnswer, approvedEvaluation } = req.body || {};

    const plot = await prisma.gardenPlot.findUnique({
      where: {
        userId_slotIndex: {
          userId,
          slotIndex: Number(slotIndex),
        },
      },
      include: { card: true },
    });

    if (!plot) {
      res.status(404).json({ success: false, error: 'Garden plot not found' });
      return;
    }

    // Responsive debounce: prevent rapid accidental double-clicks within 10 seconds
    const secondsSinceWater =
      (Date.now() - new Date(plot.wateredAt).getTime()) / 1000;

    if (secondsSinceWater < 10) {
      const waitSecs = Math.ceil(10 - secondsSinceWater);
      res.json({
        success: false,
        error: `Flora was hydrated moments ago! Ready in ${waitSecs}s.`,
        data: plot,
      });
      return;
    }

    let xpAmount = 15;
    let xpDesc = `Nurtured ${plot.card.word} (${plot.plantType})`;
    let successMessage = `Watered "${plot.card.word}"! +15 XP`;

    // 1. SENTENCE WEAVER MODE
    if (mode === 'SENTENCE' && sentence) {
      const trimmedSentence = sentence.trim();

      let evaluation: any = null;
      // Fast path: reuse pre-validated live evaluation if already approved
      if (approvedEvaluation && approvedEvaluation.approved) {
        const targetLower = plot.card.word.toLowerCase();
        const root = targetLower.length > 4 ? targetLower.slice(0, -1) : targetLower;
        const sentenceLower = trimmedSentence.toLowerCase();
        const hasWord = sentenceLower.includes(targetLower) || sentenceLower.includes(root);
        const words = trimmedSentence.split(/\s+/).filter(Boolean);

        if (hasWord && words.length >= 4) {
          evaluation = approvedEvaluation;
        }
      }

      // If no valid pre-evaluation, evaluate now
      if (!evaluation) {
        evaluation = await evaluateRoboticSentence(plot.card, trimmedSentence);
      }

      if (!evaluation.approved) {
        res.status(400).json({
          success: false,
          error: evaluation.roboticCritique,
          evaluation,
        });
        return;
      }

      xpAmount = 25; // Bonus XP for sentence crafting!
      xpDesc = `Crafted sentence for "${plot.card.word}": "${trimmedSentence}"`;
      successMessage = evaluation.roboticCritique;

      // Log into WordHistory
      try {
        await prisma.wordHistory.create({
          data: {
            cardId: plot.cardId,
            userId,
            action: 'SENTENCE_CRAFTED',
            previousStatus: plot.card.status,
            newStatus: 'PRACTICED',
          },
        });
      } catch (e) {
        // Non-fatal
      }
    } else if (mode === 'QUIZ') {
      xpAmount = 20; // Bonus XP for active quiz recall!
      xpDesc = `Recalled definition for "${plot.card.word}" in Sanctuary`;
      successMessage = `BEEP BOOP! 🎯 Neural diagnostic validated! "${plot.card.word}" is locked into memory. +20 XP awarded!`;
    }

    // Advance growth stage if healthy (up to 4)
    const newStage = Math.min(4, plot.growthStage + 1);

    const updated = await prisma.gardenPlot.update({
      where: { id: plot.id },
      data: {
        health: 100,
        growthStage: newStage,
        wateredAt: new Date(),
      },
      include: { card: true },
    });

    // Reinforce the underlying card's mastery
    await prisma.wordMastery.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId: plot.cardId,
        },
      },
      update: {
        timesReviewed: { increment: 1 },
        timesCorrect: mode === 'QUIZ' || mode === 'SENTENCE' ? { increment: 1 } : undefined,
        lastReviewedAt: new Date(),
      },
      create: {
        userId,
        cardId: plot.cardId,
        stage: 'PRACTICED',
        stageLevel: 3,
        timesReviewed: 1,
        timesCorrect: 1,
        lastReviewedAt: new Date(),
      },
    });

    const xpResult = await awardXP(
      userId,
      xpAmount,
      'GARDEN_HARVEST',
      xpDesc
    );

    // Update streak and quests
    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'GARDEN_ACTION', 1);
    await recordQuestProgress(userId, 'REVIEW_WORDS', 1);

    res.json({
      success: true,
      message: successMessage,
      data: {
        ...updated,
        newStage: updated.growthStage,
        isMaxStage: updated.growthStage >= 4,
        xpAwarded: xpAmount,
        craftedSentence: mode === 'SENTENCE' ? sentence : undefined,
      },
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('waterPlant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const removePlant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { slotIndex } = req.params;

    const plot = await prisma.gardenPlot.findUnique({
      where: {
        userId_slotIndex: {
          userId,
          slotIndex: Number(slotIndex),
        },
      },
      include: { card: true },
    });

    if (!plot) {
      res.status(404).json({ success: false, error: 'Garden plot not found' });
      return;
    }

    await prisma.gardenPlot.delete({
      where: { id: plot.id },
    });

    res.json({
      success: true,
      message: `Uprooted "${plot.card?.word || 'plant'}" from Plot #${Number(slotIndex) + 1}.`,
      data: { slotIndex: Number(slotIndex) },
    });
  } catch (error: any) {
    console.error('removePlant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const harvestPlant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { slotIndex } = req.params;

    const plot = await prisma.gardenPlot.findUnique({
      where: {
        userId_slotIndex: {
          userId,
          slotIndex: Number(slotIndex),
        },
      },
      include: { card: true },
    });

    if (!plot) {
      res.status(404).json({ success: false, error: 'Garden plot not found' });
      return;
    }

    if (plot.growthStage < 4) {
      res.status(400).json({
        success: false,
        error: `Flora must reach Sacred Bloom (Stage 4) before harvesting. Current stage: ${plot.growthStage}/4.`,
      });
      return;
    }

    // Delete the plot so user can plant fresh words
    await prisma.gardenPlot.delete({
      where: { id: plot.id },
    });

    // Elevate word mastery to MASTERED
    await prisma.wordMastery.upsert({
      where: {
        userId_cardId: {
          userId,
          cardId: plot.cardId,
        },
      },
      update: {
        stage: 'MASTERED',
        stageLevel: 5,
        timesReviewed: { increment: 1 },
        lastReviewedAt: new Date(),
      },
      create: {
        userId,
        cardId: plot.cardId,
        stage: 'MASTERED',
        stageLevel: 5,
        timesReviewed: 1,
        lastReviewedAt: new Date(),
      },
    });

    // Award +50 XP bonus for harvesting fully matured flora!
    const xpResult = await awardXP(
      userId,
      50,
      'GARDEN_HARVEST',
      `Harvested Sacred Bloom: "${plot.card?.word}" (+50 XP Bonus)`
    );

    await updateDailyStreak(userId);
    await recordQuestProgress(userId, 'GARDEN_ACTION', 1);

    res.json({
      success: true,
      message: `✨ Harvested sacred bloom "${plot.card?.word}"! +50 XP Bonus!`,
      data: {
        slotIndex: Number(slotIndex),
        harvestedWord: plot.card?.word,
        card: plot.card,
      },
      gamification: xpResult,
    });
  } catch (error: any) {
    console.error('harvestPlant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getHarvestedWords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Find all XP transactions from garden harvests
    const harvestTxs = await prisma.xPTransaction.findMany({
      where: {
        userId,
        source: 'GARDEN_HARVEST',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Find all cards with MASTERED word mastery
    const masteredWords = await prisma.wordMastery.findMany({
      where: {
        userId,
        stage: 'MASTERED',
      },
      include: {
        card: {
          select: {
            id: true,
            word: true,
            meaning: true,
            example: true,
            pos: true,
            pronunciation: true,
            rarity: true,
            difficulty: true,
            worldSlug: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Extract crafted sentences from XP transactions
    const craftedSentences = harvestTxs
      .filter((tx) => tx.description.startsWith('Crafted sentence for'))
      .map((tx) => {
        const match = tx.description.match(/^Crafted sentence for "([^"]+)":\s*"?([^"]*)"?$/);
        return {
          id: tx.id,
          createdAt: tx.createdAt,
          word: match ? match[1] : '',
          sentence: match ? match[2] : tx.description,
        };
      });

    res.json({
      success: true,
      data: {
        harvestTransactions: harvestTxs,
        craftedSentences,
        masteredWords: masteredWords.map((m) => ({
          ...m.card,
          masteredAt: m.updatedAt,
          timesReviewed: m.timesReviewed,
        })),
        totalHarvestedCount: harvestTxs.length,
      },
    });
  } catch (error: any) {
    console.error('getHarvestedWords error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Live AI sentence evaluation endpoint powered by OpenRouter (Unit V-BOT 9000)
 */
export const evaluateSentence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slotIndex, wordId, sentence, conversationHistory, userDirective } = req.body || {};
    if (!sentence || sentence.trim().length < 2) {
      res.status(400).json({ success: false, error: 'BEEP BOOP! Please input a sentence for V-BOT analysis.' });
      return;
    }

    let card: any = null;
    if (typeof slotIndex === 'number') {
      const userId = await resolveUserId(req);
      const plot = await prisma.gardenPlot.findUnique({
        where: { userId_slotIndex: { userId: userId || '', slotIndex } },
        include: { card: true },
      });
      card = plot?.card;
    } else if (wordId) {
      card = await prisma.vocabularyCard.findUnique({ where: { id: wordId } });
    }

    if (!card) {
      res.status(404).json({ success: false, error: 'Word data not found for evaluation' });
      return;
    }

    const evaluation = await evaluateRoboticSentence(card, sentence, conversationHistory, userDirective);
    res.json({ success: true, data: evaluation });
  } catch (error: any) {
    console.error('evaluateSentence error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


