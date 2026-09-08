import { Response } from 'express';
import { prisma } from '../server';
import OpenAI from 'openai';

const openrouterKey = (process.env.OPENROUTER_API_KEY || '').replace(/^["']|["']$/g, '').trim();

// 100% Free OpenRouter AI Integration
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: openrouterKey || 'openrouter-dummy-key',
  defaultHeaders: {
    'HTTP-Referer': 'https://vocabverse.app',
    'X-Title': 'VocabVerse AI',
  },
});

function parseCleanJson(content: string): any {
  if (!content) return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const getRecommendations = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const userId = user.id;

    const cards = await prisma.vocabularyCard.findMany({
      where: { userId },
      select: { word: true, status: true, difficulty: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const toLearnCards = cards.filter((c: any) => c.status === 'TO_LEARN');
    const hardCards = cards.filter((c: any) => c.difficulty && c.difficulty.toLowerCase().includes('hard'));
    const recentlyAdded = cards.slice(0, 5);

    const recommendations = [];

    if (hardCards.length > 0) {
      const randomHardCard = hardCards[Math.floor(Math.random() * hardCards.length)];
      recommendations.push({
        id: 'rec_hard',
        title: 'Tackle the Tough Ones',
        message: `You've labeled "${randomHardCard.word}" as difficult. A quick review session now could solidify it in your memory!`,
        icon: 'brain',
        actionLabel: 'Practice Now',
        type: 'alert'
      });
    } else {
      recommendations.push({
        id: 'rec_hard',
        title: 'Ready for a Challenge?',
        message: `You don't have many difficult cards right now. Try adding advanced vocabulary to stretch your limits!`,
        icon: 'flame',
        actionLabel: 'Add Words',
        type: 'info'
      });
    }

    if (toLearnCards.length > 10) {
      recommendations.push({
        id: 'rec_backlog',
        title: 'Manage Your Backlog',
        message: `You have ${toLearnCards.length} cards waiting to be learned. Setting a goal to learn 5 new words today is a great start.`,
        icon: 'target',
        actionLabel: 'Set Goal',
        type: 'warning'
      });
    } else if (recentlyAdded.length > 0) {
      recommendations.push({
        id: 'rec_recent',
        title: 'Review Recent Additions',
        message: `You recently added "${recentlyAdded[0].word}". Reviewing new words within 24 hours boosts retention by 60%.`,
        icon: 'clock',
        actionLabel: 'Review Recent',
        type: 'success'
      });
    }

    recommendations.push({
      id: 'rec_streak',
      title: 'Keep the Momentum',
      message: `You're doing great! A short 5-minute spaced repetition session is the best way to end your learning day.`,
      icon: 'sparkles',
      actionLabel: 'Start Quiz',
      type: 'primary'
    });

    res.json({ success: true, data: recommendations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const enrichWord = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { word, meaning } = req.body;
    if (!word) {
      res.status(400).json({ success: false, error: 'Word is required' });
      return;
    }

    if (!openrouterKey) {
      res.status(500).json({ success: false, error: 'OpenRouter API key not configured on server' });
      return;
    }

    const prompt = `You are an expert linguist and dictionary API.
I am adding the word "${word}" to my vocabulary learning app. 
${meaning ? `The user provided this meaning/context: "${meaning}". Please refine it if necessary.` : `Provide a clear, concise definition for this word.`}

Return a strictly formatted JSON object with the following fields:
- meaning (string)
- example (string, a good sentence using the word)
- pos (string, e.g. "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection")
- synonyms (string, comma-separated, max 3)
- antonyms (string, comma-separated, max 3)
- pronunciation (string, phonetic spelling)
- rootWords (string, etymology/roots)
- mood (string, e.g., "Positive", "Melancholic", "Neutral")
- difficulty (string, one of: "Beginner", "Intermediate", "Advanced", "Master")
- connotation (string, one of: "Positive", "Negative", "Neutral")

Return ONLY the raw JSON object, without markdown blocks.`;

    console.log(`[AI Controller] 🌐 Enriching word "${word}" using OpenRouter free model: inclusionai/ling-3.0-flash-fin:free (100% Free)...`);
    let response: any = null;
    try {
      response = await openrouter.chat.completions.create({
        model: "inclusionai/ling-3.0-flash-fin:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 450,
      });
    } catch {
      response = await openrouter.chat.completions.create({
        model: "openrouter/free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 450,
      });
    }

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('Failed to generate metadata');
    }

    const enrichedData = parseCleanJson(aiContent);
    if (!enrichedData) {
      throw new Error('Failed to parse enriched word JSON');
    }
    res.json({ success: true, data: enrichedData });
  } catch (error: any) {
    console.error('Enrich Word Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to enrich word' });
  }
};

const addWordToGlobalList = async (wordData: any): Promise<string | null> => {
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) return null;

    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } });
    const firstColumnId = columns[0]?.id;

    const existing = await prisma.vocabularyCard.findFirst({
      where: { word: wordData.word, userId: adminUser.id }
    });

    if (!existing) {
      const newCard = await prisma.vocabularyCard.create({
        data: {
          word: wordData.word,
          meaning: wordData.meaning,
          example: wordData.example,
          pos: wordData.pos || 'Unknown',
          pronunciation: wordData.pronunciation || '',
          userId: adminUser.id,
          organizationId: null,
          status: 'TO_LEARN',
          columnId: firstColumnId
        }
      });
      return newCard.id;
    }
    
    return existing.id;
  } catch (err) {
    console.error('Failed to add Word of the Day to global list', err);
    return null;
  }
};


export const getWordOfTheDay = async (req: any, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let wordOfTheDay = await prisma.wordOfTheDay.findUnique({
      where: { date: today }
    });

    if (wordOfTheDay) {
      const cardId = await addWordToGlobalList(wordOfTheDay);
      res.json({ success: true, data: { ...wordOfTheDay, cardId } });
      return;
    }

    if (!openrouterKey) {
      console.log('Using fallback Word of the Day since OPENROUTER_API_KEY is not configured');
      const fallbackData = {
        word: "Mellifluous",
        meaning: "(of a voice or words) sweet or musical; pleasant to hear.",
        example: "The voice of the opera singer was mellifluous.",
        pos: "Adjective",
        pronunciation: "muh-lif-loo-uhs"
      };
      
      wordOfTheDay = await prisma.wordOfTheDay.create({
        data: {
          date: today,
          ...fallbackData
        }
      });
      const cardId = await addWordToGlobalList(wordOfTheDay);
      res.json({ success: true, data: { ...wordOfTheDay, cardId } });
      return;
    }

    const pastWordsQuery = await prisma.wordOfTheDay.findMany({ select: { word: true } });
    const existingCardsQuery = await prisma.vocabularyCard.findMany({ select: { word: true } });
    
    const allUsedWords = new Set([
      ...pastWordsQuery.map(w => w.word.toLowerCase()),
      ...existingCardsQuery.map(w => w.word.toLowerCase())
    ]);
    
    const excludeList = allUsedWords.size > 0 
      ? `CRITICAL INSTRUCTION: Do NOT use any of these words: ${Array.from(allUsedWords).join(', ')}.` 
      : '';

    const prompt = `You are an expert linguist and vocabulary app AI.
Provide an interesting, advanced, and beautiful vocabulary word for the "Word of the Day".
It should be a word that sounds elegant or has a profound meaning.
${excludeList}

Return a strictly formatted JSON object with the following fields:
- word (string, the vocabulary word, capitalized)
- meaning (string, clear definition)
- example (string, an inspiring sentence using the word)
- pos (string, e.g. "Noun", "Verb", "Adjective")
- pronunciation (string, phonetic spelling)

Return ONLY the raw JSON object, without markdown blocks.`;

    console.log('[AI Controller] 🌐 Generating Word of the Day using OpenRouter free model: inclusionai/ling-3.0-flash-fin:free (100% Free)...');
    let response: any = null;
    try {
      response = await openrouter.chat.completions.create({
        model: "inclusionai/ling-3.0-flash-fin:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      });
    } catch {
      response = await openrouter.chat.completions.create({
        model: "openrouter/free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      });
    }

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('Failed to generate word of the day');
    }

    const generatedData = parseCleanJson(aiContent);
    if (!generatedData || !generatedData.word) {
      throw new Error('Failed to parse Word of the Day JSON');
    }

    wordOfTheDay = await prisma.wordOfTheDay.create({
      data: {
        date: today,
        word: generatedData.word,
        meaning: generatedData.meaning,
        example: generatedData.example,
        pos: generatedData.pos,
        pronunciation: generatedData.pronunciation,
      }
    });

    const cardId = await addWordToGlobalList(wordOfTheDay);

    res.json({ success: true, data: { ...wordOfTheDay, cardId } });
  } catch (error: any) {
    console.error('Word of the Day Error:', error);
    
    // Fallback if OpenAI crashes unexpectedly
    try {
      const fallbackData = {
        word: "Serendipity",
        meaning: "The occurrence and development of events by chance in a happy or beneficial way.",
        example: "Finding that rare book at a garage sale was pure serendipity.",
        pos: "Noun",
        pronunciation: "ser-uhn-dip-i-tee"
      };
      
      // Attempt to save fallback
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      const fallbackWord = await prisma.wordOfTheDay.create({
        data: {
          date: today,
          ...fallbackData
        }
      });

      const cardId = await addWordToGlobalList(fallbackWord);

      res.json({ success: true, data: { ...fallbackWord, cardId } });
    } catch (fallbackError) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get word of the day' });
    }
  }
};
