import { Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';

const cardSchema = z.object({
  word: z.string().min(1, 'Word is required'),
  meaning: z.string().min(1, 'Meaning is required'),
  example: z.string().optional().nullable(),
  status: z.string().optional(),
  columnId: z.string().optional(),
  pos: z.string().optional().nullable(),
  synonyms: z.string().optional().nullable(),
  antonyms: z.string().optional().nullable(),
  pronunciation: z.string().optional().nullable(),
  rootWords: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  connotation: z.string().optional().nullable(),
});

const cardUpdateSchema = z.object({
  word: z.string().min(1).optional(),
  meaning: z.string().min(1).optional(),
  example: z.string().optional().nullable(),
  status: z.string().optional(),
  columnId: z.string().optional(),
  pos: z.string().optional().nullable(),
  synonyms: z.string().optional().nullable(),
  antonyms: z.string().optional().nullable(),
  pronunciation: z.string().optional().nullable(),
  rootWords: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  connotation: z.string().optional().nullable(),
});

export const getCards = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const isGuest = !user;

    const query = req.query.q as string;
    const status = req.query.status as string;
    let columnId = req.query.columnId as string;
    const sortBy = (req.query.sortBy as string) || 'default';
    const pos = req.query.pos as string;
    const mood = req.query.mood as string;
    const connotation = req.query.connotation as string;
    const difficulty = req.query.difficulty as string;
    const page = parseInt((req.query.page as string) || '1');
    let limit = parseInt((req.query.limit as string) || '50');

    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } });
    const firstColumnId = columns[0]?.id || null;

    if (isGuest) {
      limit = Math.min(limit, 20);

      if (columnId && columnId !== firstColumnId) {
        res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
        return;
      }
      columnId = firstColumnId as string;
    }

    let baseWhere: any = {};

    if (!isGuest) {
      const userOrgId = user.organizationId;

      baseWhere.OR = [
        { userId: user.id },
      ];

      if (userOrgId) {
        baseWhere.OR.push({ organizationId: userOrgId });
      } else {
        baseWhere.OR.push({ organizationId: null, user: { role: 'ADMIN' } });
      }
    } else {
      baseWhere = { organizationId: null, user: { role: 'ADMIN' } };
    }

    if (query) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          OR: [
            { word: { contains: query } },
            { meaning: { contains: query } },
            { example: { contains: query } },
            { synonyms: { contains: query } },
          ]
        }
      ];
    }

    if (status && ['TO_LEARN', 'LEARNING', 'MASTERED'].includes(status)) {
      baseWhere.status = status;
    }
    if (pos) baseWhere.pos = pos;
    if (mood) baseWhere.mood = mood;
    if (connotation) baseWhere.connotation = connotation;
    if (difficulty) baseWhere.difficulty = difficulty;

    let orderByClause: any = { createdAt: 'desc' };
    if (sortBy === 'alphabetical') {
      orderByClause = { word: 'asc' };
    } else if (sortBy === 'recentlyAdded') {
      orderByClause = { createdAt: 'desc' };
    }

    const offset = (page - 1) * limit;

    const [allCards, histories] = await Promise.all([
      prisma.vocabularyCard.findMany({
        where: baseWhere,
        orderBy: orderByClause,
        include: { user: { select: { role: true } } }
      }),
      !isGuest ? prisma.wordHistory.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'asc' },
        select: { cardId: true, newStatus: true }
      }) : Promise.resolve([])
    ]);

    const userOverrides = new Map<string, string>();
    histories.forEach((h: any) => {
      let statusStr = h.newStatus;
      if (statusStr) {
        if (statusStr === 'TO_LEARN') statusStr = columns[0]?.id;
        else if (statusStr === 'LEARNING') {
          const learningCol = columns.find(c => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
          statusStr = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
        }
        else if (statusStr === 'MASTERED') statusStr = columns[columns.length - 1]?.id;
        userOverrides.set(h.cardId, statusStr);
      }
    });

    const filteredCards = allCards.filter((card: any) => {
      let effectiveColumnId: string | null | undefined = userOverrides.get(card.id);

      if (!effectiveColumnId) {
        if (card.organizationId === null && card.user?.role === 'ADMIN' && (!user || user.role !== 'ADMIN')) {
          effectiveColumnId = firstColumnId || undefined;
        } else {
          effectiveColumnId = card.columnId;
          if (!effectiveColumnId && card.status) {
            if (card.status === 'TO_LEARN') effectiveColumnId = columns[0]?.id;
            else if (card.status === 'LEARNING') {
              const learningCol = columns.find(c => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
              effectiveColumnId = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
            }
            else if (card.status === 'MASTERED') effectiveColumnId = columns[columns.length - 1]?.id;
          }
        }
      }

      card.columnId = effectiveColumnId;

      if (columnId && effectiveColumnId !== columnId) return false;
      return true;
    });

    const total = filteredCards.length;
    const paginatedCards = filteredCards.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedCards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/cards ERROR:", error);
    res.status(500).json({ success: false, error: error.message || error.toString() });
  }
};

export const createCard = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parsed = cardSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const existingCard = await prisma.vocabularyCard.findFirst({
      where: {
        userId: user.id,
        word: {
          equals: parsed.data.word,
        },
      },
    });

    if (existingCard) {
      res.status(400).json({ success: false, error: 'You already have this word in your vocabulary.' });
      return;
    }

    const newCard = await prisma.vocabularyCard.create({
      data: {
        ...parsed.data,
        userId: user.id,
        organizationId: user.organizationId || null,
        status: parsed.data.status || 'TO_LEARN',
        rootWords: parsed.data.rootWords,
        mood: parsed.data.mood,
        difficulty: parsed.data.difficulty,
        connotation: parsed.data.connotation,
      },
    });

    await prisma.wordHistory.create({
      data: {
        cardId: newCard.id,
        userId: user.id,
        action: 'CREATED',
        newStatus: newCard.status,
      }
    });

    res.status(201).json({ success: true, data: newCard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCard = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const card = await prisma.vocabularyCard.findUnique({ where: { id } });

    if (!card) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    res.json({ success: true, data: card });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCard = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const parsed = cardUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const card = await prisma.vocabularyCard.findUnique({ where: { id } });

    if (!card) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    if (parsed.data.word && parsed.data.word !== card.word) {
      const existingCard = await prisma.vocabularyCard.findFirst({
        where: {
          userId: user.id,
          word: { equals: parsed.data.word },
          id: { not: id },
        },
      });

      if (existingCard) {
        res.status(400).json({ success: false, error: 'You already have this word in your vocabulary.' });
        return;
      }
    }

    if (user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Only admins can edit cards' });
      return;
    }

    const updatedCard = await prisma.vocabularyCard.update({
      where: { id },
      data: parsed.data,
    });

    const action = parsed.data.columnId && parsed.data.columnId !== card.columnId 
      ? 'STATUS_CHANGED' 
      : 'UPDATED';

    await prisma.wordHistory.create({
      data: {
        cardId: id,
        userId: user.id,
        action,
        previousStatus: card.columnId || card.status,
        newStatus: updatedCard.columnId || updatedCard.status,
      }
    });

    res.json({ success: true, data: updatedCard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteCard = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const card = await prisma.vocabularyCard.findUnique({ where: { id } });

    if (!card) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    if (user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    await prisma.vocabularyCard.delete({ where: { id } });
    
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPracticeCards = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const isGuest = !user;
    const limit = parseInt((req.query.limit as string) || '10');

    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } });
    const firstColumnId = columns[0]?.id;
    const lastColumnId = columns[columns.length - 1]?.id;

    if (isGuest) {
      const guestCards = await prisma.vocabularyCard.findMany({
        where: { organizationId: null, user: { role: 'ADMIN' } },
        take: limit,
        orderBy: { updatedAt: 'desc' }
      });
      
      res.json({ success: true, data: guestCards.sort(() => Math.random() - 0.5) });
      return;
    }

    let baseWhere: any = {};
    const userOrgId = user.organizationId;
    
    baseWhere.OR = [
      { userId: user.id },
    ];
    
    if (userOrgId) {
      baseWhere.OR.push({ organizationId: userOrgId });
    } else {
      baseWhere.OR.push({ organizationId: null, user: { role: 'ADMIN' } });
    }

    const [allCards, histories] = await Promise.all([
      prisma.vocabularyCard.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.wordHistory.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'asc' },
        select: { cardId: true, newStatus: true }
      })
    ]);

    const userOverrides = new Map<string, string>();
    histories.forEach((h: any) => {
      let statusStr = h.newStatus;
      if (statusStr) {
        if (statusStr === 'TO_LEARN') statusStr = columns[0]?.id;
        else if (statusStr === 'LEARNING') {
          const learningCol = columns.find(c => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
          statusStr = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
        }
        else if (statusStr === 'MASTERED') statusStr = columns[columns.length - 1]?.id;
        userOverrides.set(h.cardId, statusStr);
      }
    });

    allCards.forEach((card: any) => {
      let effectiveColumnId: string | null | undefined = userOverrides.get(card.id);
      if (!effectiveColumnId) {
        if (card.organizationId === null && card.user?.role === 'ADMIN' && user.role !== 'ADMIN') {
          effectiveColumnId = firstColumnId || undefined;
        } else {
          effectiveColumnId = card.columnId;
          if (!effectiveColumnId && card.status) {
            if (card.status === 'TO_LEARN') effectiveColumnId = columns[0]?.id;
            else if (card.status === 'LEARNING') {
              const learningCol = columns.find(c => c.name.toLowerCase().includes('learn') && !c.name.toLowerCase().includes('to'));
              effectiveColumnId = learningCol ? learningCol.id : (columns[1]?.id || columns[0]?.id);
            }
            else if (card.status === 'MASTERED') effectiveColumnId = columns[columns.length - 1]?.id;
          }
        }
      }
      card.columnId = effectiveColumnId;
    });

    const getSemanticStatus = (card: any) => {
      if (card.columnId === lastColumnId) return 'MASTERED';
      if (card.columnId === firstColumnId) return 'TO_LEARN';
      return 'LEARNING';
    };

    const learningCards = allCards
      .filter((c: any) => getSemanticStatus(c) === 'LEARNING')
      .slice(0, limit);

    let practicePool = [...learningCards];

    if (practicePool.length < limit) {
      const needed = limit - practicePool.length;
      const toLearnCards = allCards
        .filter((c: any) => getSemanticStatus(c) === 'TO_LEARN')
        .slice(0, needed);
      
      practicePool = [...practicePool, ...toLearnCards];
    }

    practicePool = practicePool.sort(() => Math.random() - 0.5);

    res.json({ success: true, data: practicePool });
  } catch (error: any) {
    console.error('Practice API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
