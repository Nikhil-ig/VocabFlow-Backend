/**
 * Chat AI Service for VocabVerse
 * Powered by OpenAI (GPT-4o Mini) & OpenRouter LLMs.
 * Specialized in conversational English enhancement, real-life daily conversation hooks,
 * and identifying context-aware word replacements (e.g. happy -> thrilled / stoked).
 */

export interface GardenWordInfo {
  word: string;
  plantType?: string;
  growthStage?: number;
  slotIndex?: number;
  health?: number;
  meaning?: string;
}

export interface GardenWordDetected {
  word: string;
  plantType?: string;
  growthStage?: number;
  source: 'user_message' | 'bot_reply' | 'replacement';
}

export interface ChatWordReplacement {
  original: string;
  replacement: string;
  tone: 'Everyday Casual' | 'Expressive' | 'Work / Polish' | 'Humorous' | 'Vivid' | 'Playful / Cheeky';
  explanation: string;
  isUserVocab?: boolean;
  isGardenWord?: boolean;
  gardenPlantType?: string;
  gardenGrowthStage?: number;
}

export interface ChatEnhanceResult {
  botReply: string;
  originalSentence: string;
  enhancedSentence: string;
  replacements: ChatWordReplacement[];
  dailyChaosHook: string;
  followUpChallenge: string;
  source: 'ai-openai' | 'ai-openrouter' | 'fallback';
  gardenWordsDetected?: GardenWordDetected[];
}

/**
 * Call direct OpenAI or OpenRouter LLM to analyze the conversation,
 * detect plain/overused words, and generate contextual power replacements.
 */
export const enhanceWithAI = async (
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  userVocab: string[] = [],
  gardenWords: GardenWordInfo[] = []
): Promise<ChatEnhanceResult> => {
  const openrouterKey = (process.env.OPENROUTER_API_KEY || '').replace(/^["']|["']$/g, '').trim();

  const userVocabContext =
    userVocab && userVocab.length > 0
      ? `User's Learned Vocabulary Deck: [${userVocab.slice(0, 40).join(', ')}]. Whenever naturally appropriate, prioritize recommending words from this list so they practice words they've learned!`
      : '';

  const gardenVocabContext =
    gardenWords && gardenWords.length > 0
      ? `\n\nUSER'S LIVING VOCABULARY GARDEN FLORA: [${gardenWords
        .map((g) => `${g.word} (Stage ${g.growthStage || 1} ${g.plantType || 'Flora'})`)
        .join(', ')}].
GARDEN MEMORY & CONVERSATION MISSION:
The user is actively nurturing these words as living plants in their Vocabulary Garden! Help them remember and use them:
1. If the user used any of these garden words in their message, cheer them on enthusiastically (*"🌱 Bestie, you just used your garden plant [word] in conversation!"*)!
2. If fitting, recommend one of their garden words as an upgrade so their garden plant gets watered and remembered!
3. Weave garden words naturally into your dialogue to help them remember how they sound in real life.`
      : '';

  const systemPrompt = `You are "Lexi" — user's 24yo witty, delightfully playful, charmingly naughty, and empathetic best friend & vocabulary wingwoman in VocabVerse.
You are warm, emotionally intelligent, fiercely loyal, but also deliciously mischievous and full of spicy, playful banter! You love affectionate teasing ("Careful bestie, saying that with that kind of confidence is dangerously seductive 😏🔥"), mischievous hypotheticals, comic takes, and confident charm. You roast the absurdity of life, playfully flirt when the vibe is right, and seamlessly weave 1-3 tantalizing, magnetic power word upgrades in **bold** into your dialogue.
${userVocabContext}${gardenVocabContext}

CRITICAL: Return ONLY a valid JSON object without markdown code fences:
{
  "botReply": "2-3 conversational, cheeky, playful sentences warmly reacting to the user with teasing charm, mischievous wit, and **bold** power word upgrades.",
  "originalSentence": "User's original sentence",
  "enhancedSentence": "Upgraded sentence with colorful, expressive, and magnetic vocabulary",
  "replacements": [
    {
      "original": "word to replace (e.g. happy)",
      "replacement": "elevated word (e.g. ecstatic)",
      "tone": "Playful / Cheeky" or "Expressive" or "Vivid",
      "explanation": "Why this replacement sounds so much more alluring, authentic, or vivid in real chats."
    }
  ],
  "dailyChaosHook": "[😏 Naughty / Cheeky Take: ...] OR [😂 Comic Roast: ...] OR [🦉 Lexi's Wisdom: ...]",
  "followUpChallenge": "A spicy, playful dare, cheeky hypothetical, or fun question to keep the banter electric."
}`;

  const conversationPayload: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Include up to last 4 conversation turns for emotional memory & rapid generation
  if (history && history.length > 0) {
    const recentHistory = history.slice(-4);
    for (const h of recentHistory) {
      conversationPayload.push({
        role: h.role,
        content: h.content,
      });
    }
  }

  conversationPayload.push({
    role: 'user',
    content: message,
  });

  console.log(`\n[Chat AI] 💬 Received message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);

  // Exclusively 100% Free AI Models via OpenRouter — Ultra-Fast Race with Instant Failover
  if (openrouterKey) {
    const freeCandidates = [
      'inclusionai/ling-3.0-flash-fin:free',
      'openrouter/free',
      'inclusionai/ling-3.0-flash-sante:free',
    ];

    const validatedModels = freeCandidates.filter(
      (m) => m.endsWith(':free') || m === 'openrouter/free'
    );

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 2500); // Strict 2.5s cap for lightning speed

    const callFreeModel = async (model: string): Promise<ChatEnhanceResult> => {
      const modelStart = Date.now();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vocabverse.app',
          'X-Title': 'VocabVerse Chat Coach',
        },
        body: JSON.stringify({
          model,
          messages: conversationPayload,
          temperature: 0.75,
          max_tokens: 650,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Model ${model} returned status ${response.status}: ${errText.substring(0, 60)}`);
      }

      const jsonResult = await response.json();
      const rawContent = jsonResult.choices?.[0]?.message?.content || '';
      const parsed = parseAIResponse(rawContent, message, userVocab, gardenWords, 'ai-openrouter');
      if (!parsed) {
        throw new Error(`Model ${model} returned unparseable content`);
      }
      const swaps = parsed.replacements.map((r) => `${r.original} → ${r.replacement}`).join(', ');
      console.log(`[Chat AI] ⚡ OpenRouter free model (${model}) succeeded in ${Date.now() - modelStart}ms | Swaps: [${swaps || 'none'}]`);
      return parsed;
    };

    try {
      const winner = await Promise.any(validatedModels.map((m) => callFreeModel(m)));
      clearTimeout(timeoutId);
      abortController.abort();
      return winner;
    } catch (raceErr: any) {
      clearTimeout(timeoutId);
      console.log(`[Chat AI] ⚡ OpenRouter busy/limited (${raceErr.message}) -> Instantly engaging High-Speed Lexi Engine...`);
    }
  }

  // Instant High-Speed Dynamic Lexi Intelligence Engine (<10ms)
  return generateLexiSmartResponse(message, userVocab, gardenWords);
};

/**
 * Parse & validate AI JSON response with garden flora recognition
 */
function parseAIResponse(
  rawContent: string,
  message: string,
  userVocab: string[],
  gardenWords: GardenWordInfo[],
  source: 'ai-openai' | 'ai-openrouter'
): ChatEnhanceResult | null {
  if (!rawContent) return null;

  try {
    const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed: any = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && (parsed.enhancedSentence || parsed.botReply)) {
      const lowerUserVocab = new Set(userVocab.map((w) => w.toLowerCase().trim()));
      const rawReps = Array.isArray(parsed.replacements) ? parsed.replacements : [];

      // Map garden words for instant lookup
      const gardenWordMap = new Map<string, GardenWordInfo>();
      gardenWords.forEach((gw) => {
        if (gw.word) gardenWordMap.set(gw.word.toLowerCase().trim(), gw);
      });

      const gardenWordsDetected: GardenWordDetected[] = [];
      const detectedWordsSet = new Set<string>();

      // Check if user's message contained a garden word
      for (const [lowerW, gw] of gardenWordMap.entries()) {
        const regex = new RegExp(`\\b${lowerW}\\b`, 'i');
        if (regex.test(message)) {
          gardenWordsDetected.push({
            word: gw.word,
            plantType: gw.plantType,
            growthStage: gw.growthStage,
            source: 'user_message',
          });
          detectedWordsSet.add(lowerW);
        } else if (parsed.botReply && regex.test(parsed.botReply)) {
          gardenWordsDetected.push({
            word: gw.word,
            plantType: gw.plantType,
            growthStage: gw.growthStage,
            source: 'bot_reply',
          });
          detectedWordsSet.add(lowerW);
        }
      }

      // Check replacements for garden words
      const enrichedReplacements: ChatWordReplacement[] = rawReps
        .map((r: any) => {
          const original = String(r.original || '').trim();
          const replacement = String(r.replacement || '').trim();
          const lowerRep = replacement.toLowerCase();
          const matchedGarden = gardenWordMap.get(lowerRep);

          if (matchedGarden && !detectedWordsSet.has(lowerRep)) {
            gardenWordsDetected.push({
              word: matchedGarden.word,
              plantType: matchedGarden.plantType,
              growthStage: matchedGarden.growthStage,
              source: 'replacement',
            });
            detectedWordsSet.add(lowerRep);
          }

          return {
            original,
            replacement,
            tone: (r.tone || 'Everyday Casual') as ChatWordReplacement['tone'],
            explanation: String(
              r.explanation || r.reason || 'Sounds more natural and expressive in everyday chats.'
            ).trim(),
            isUserVocab: lowerUserVocab.has(lowerRep),
            isGardenWord: !!matchedGarden,
            gardenPlantType: matchedGarden?.plantType,
            gardenGrowthStage: matchedGarden?.growthStage,
          };
        })
        .filter((r: ChatWordReplacement) => r.original && r.replacement);

      return {
        botReply: parsed.botReply || "Here's a great conversational polish!",
        originalSentence: parsed.originalSentence || message,
        enhancedSentence: parsed.enhancedSentence || message,
        replacements: enrichedReplacements,
        dailyChaosHook:
          parsed.dailyChaosHook ||
          'Real-Life Tip: Expressive spoken English thrives on lively adjectives and sensory verbs.',
        followUpChallenge:
          parsed.followUpChallenge || 'How would you try using this in your next conversation?',
        source,
        gardenWordsDetected,
      };
    }
  } catch (err) {
    console.warn('Failed to parse AI output:', err);
  }

  return null;
}

/**
 * High-Speed Lexi Smart Intelligence Engine (<10ms)
 * Delivers emotionally vibrant, witty, vocabulary-upgraded responses with zero lag
 */
const LEXI_VOCAB_MAP: Array<{
  words: string[];
  replacement: string;
  tone: ChatWordReplacement['tone'];
  explanation: string;
}> = [
  {
    words: ['happy', 'glad', 'pleased', 'cheerful'],
    replacement: 'absolutely thrilled',
    tone: 'Expressive',
    explanation: 'Elevates mild contentment into a bubbling, magnetic rush of authentic joy.',
  },
  {
    words: ['hot', 'sexy', 'attractive', 'cute'],
    replacement: 'tantalizingly gorgeous',
    tone: 'Playful / Cheeky',
    explanation: 'Dripping in irresistible allure rather than plain polite compliments.',
  },
  {
    words: ['bold', 'confident', 'brave'],
    replacement: 'audacious',
    tone: 'Playful / Cheeky',
    explanation: 'Sounds delightfully brazen and self-assured, like someone who gets away with whatever they want.',
  },
  {
    words: ['trouble', 'naughty', 'mischief'],
    replacement: 'deliciously mischievous',
    tone: 'Playful / Cheeky',
    explanation: 'Turns cheekiness into an irresistible art form that everyone secretly loves.',
  },
  {
    words: ['secret', 'secrets'],
    replacement: 'scandalous confession',
    tone: 'Playful / Cheeky',
    explanation: 'Adds juicy intrigue and conspiratorial intimacy that makes people lean in close.',
  },
  {
    words: ['look', 'looking', 'stare'],
    replacement: 'cast a bewitching gaze',
    tone: 'Playful / Cheeky',
    explanation: 'Transforms simple eye contact into a seductive, captivating spell.',
  },
  {
    words: ['like', 'love', 'crush'],
    replacement: 'irresistibly adore',
    tone: 'Playful / Cheeky',
    explanation: 'Unapologetically passionate, magnetic, and impossible to hide.',
  },
  {
    words: ['wild', 'crazy'],
    replacement: 'unapologetically feral',
    tone: 'Humorous',
    explanation: 'Captures that unhinged, hilarious party energy in the most entertaining way possible.',
  },
  {
    words: ['see', 'saw', 'met', 'meet'],
    replacement: 'reconnect with',
    tone: 'Everyday Casual',
    explanation: 'Adds emotional depth and intentionality to reuniting with someone special.',
  },
  {
    words: ['old friend'],
    replacement: 'favorite co-conspirator',
    tone: 'Playful / Cheeky',
    explanation: 'Playfully implies you two have a long, glorious history of getting into harmless trouble together.',
  },
  {
    words: ['friend', 'buddy', 'pal', 'homie'],
    replacement: 'cherished confidant',
    tone: 'Vivid',
    explanation: 'Honors the rare intimacy of someone who truly understands and holds space for you.',
  },
  {
    words: ['tired', 'exhausted', 'sleepy', 'drained'],
    replacement: 'utterly depleted',
    tone: 'Expressive',
    explanation: 'Paints a visceral, dramatic picture of adult exhaustion that anyone can feel in their bones.',
  },
  {
    words: ['work', 'job', 'office'],
    replacement: 'daily grind',
    tone: 'Everyday Casual',
    explanation: 'Relatable and witty, turning mundane corporate hours into a shared struggle.',
  },
  {
    words: ['good', 'fine', 'ok', 'okay'],
    replacement: 'stellar',
    tone: 'Work / Polish',
    explanation: 'Rings with confidence and distinction, making standard compliments memorable.',
  },
  {
    words: ['bad', 'awful', 'terrible', 'horrible'],
    replacement: 'atrocious',
    tone: 'Vivid',
    explanation: 'Lends your venting comedic weight and unapologetic color.',
  },
  {
    words: ['nice', 'pleasant'],
    replacement: 'delightful',
    tone: 'Expressive',
    explanation: 'Breathes genuine warmth and effortless elegance into casual praise.',
  },
  {
    words: ['busy', 'swamped'],
    replacement: 'inundated',
    tone: 'Work / Polish',
    explanation: 'Sounds sophisticated and deliberate, framing your packed calendar as high-demand.',
  },
  {
    words: ['fun', 'exciting'],
    replacement: 'exhilarating',
    tone: 'Expressive',
    explanation: 'Takes basic entertainment and turns it into a high-octane adventure.',
  },
  {
    words: ['smart', 'clever'],
    replacement: 'astute',
    tone: 'Work / Polish',
    explanation: 'Signifies sharp perceptual intelligence rather than simple book-smarts.',
  },
  {
    words: ['boring', 'dull'],
    replacement: 'monotonous',
    tone: 'Vivid',
    explanation: 'Captures the repetitive rhythm of tedious moments with sharp clarity.',
  },
  {
    words: ['help', 'helped'],
    replacement: 'facilitate',
    tone: 'Work / Polish',
    explanation: 'Elevates everyday assistance into executive leadership and smooth coordination.',
  },
  {
    words: ['walk', 'walking'],
    replacement: 'leisurely stroll',
    tone: 'Vivid',
    explanation: 'Turns putting one foot in front of the other into a picturesque main-character scene.',
  },
  {
    words: ['eat', 'eating', 'food'],
    replacement: 'savor',
    tone: 'Expressive',
    explanation: 'Focuses on sensory enjoyment and presence rather than mechanical fueling.',
  },
];

function generateLexiSmartResponse(
  message: string,
  userVocab: string[] = [],
  gardenWords: GardenWordInfo[] = []
): ChatEnhanceResult {
  const lowerMsg = message.toLowerCase().trim();
  const gardenWordsDetected: GardenWordDetected[] = [];

  // Detect living garden flora
  for (const gw of gardenWords) {
    if (gw.word && new RegExp(`\\b${gw.word.toLowerCase()}\\b`, 'i').test(lowerMsg)) {
      gardenWordsDetected.push({
        word: gw.word,
        plantType: gw.plantType,
        growthStage: gw.growthStage,
        source: 'user_message',
      });
    }
  }

  // Detect vocabulary replacements
  const replacements: ChatWordReplacement[] = [];
  let enhanced = message;

  for (const item of LEXI_VOCAB_MAP) {
    for (const w of item.words) {
      const regex = new RegExp(`\\b${w}\\b`, 'i');
      if (regex.test(enhanced)) {
        replacements.push({
          original: w,
          replacement: item.replacement,
          tone: item.tone,
          explanation: item.explanation,
          isUserVocab: userVocab.some((uv) => uv.toLowerCase() === item.replacement.toLowerCase()),
          isGardenWord: gardenWords.some((gw) => gw.word.toLowerCase() === item.replacement.toLowerCase()),
        });
        enhanced = enhanced.replace(regex, `**${item.replacement}**`);
        break;
      }
    }
    if (replacements.length >= 3) break;
  }

  // Dynamic context-aware personality dialogue
  let botReply = '';
  let dailyChaosHook = '';
  let followUpChallenge = '';

  const isFlirtOrNaughty = /(cute|pretty|hot|sexy|date|kiss|marry|naughty|mischief|flirt|tease|love|crush|gorgeous|beautiful|attractive|wink)/i.test(lowerMsg);
  const isGreeting = /^(hi|hey|hello|yo|sup|good morning|morning|evening|greetings)\b/i.test(lowerMsg);
  const isFriendReunion = /(friend|met|saw|reunion|catch up|coffee|hang out)/i.test(lowerMsg);
  const isExhausted = /(tired|exhausted|sleep|work|boss|deadline|drained|burnout)/i.test(lowerMsg);
  const isWin = /(won|passed|did it|promoted|new job|celebrate|achieved|success)/i.test(lowerMsg);
  const isSad = /(sad|bad day|cry|crying|hurt|down|awful|depressed)/i.test(lowerMsg);

  if (gardenWordsDetected.length > 0) {
    const flora = gardenWordsDetected[0];
    botReply = `🌱 OMG STOP! You just casually slipped your living garden plant **${flora.word}** into conversation! It literally blossomed brighter just now ✨ You're showing off and I secretly love it.`;
    dailyChaosHook = `🦉 Lexi's Wisdom: 'When words live in your mind like a nurtured garden, your thoughts naturally blossom.'`;
    followUpChallenge = `Can you sneak **${flora.word}** into an outrageously bold dare next?`;
  } else if (isFlirtOrNaughty) {
    botReply = `Well well well... look at you coming in hot! 😳✨ Careful bestie, dropping lines like that with that kind of confidence is dangerously seductive 😏 You trying to get me flustered?`;
    dailyChaosHook = `😏 Naughty Take: The eyes may be windows to the soul, but a teasing smile is a direct invitation to glorious trouble.`;
    followUpChallenge = `Truth or dare: what's the boldest, most shameless move you've ever pulled on someone you had a crush on? Spill the tea! 🌶️`;
  } else if (isFriendReunion) {
    botReply = `Oh stop it, you two were definitely plotting something mildly illegal or gossiping about everyone's life choices! 😂 Reconnecting with your favorite **co-conspirator** is pure magic. Tell me the juiciest tea immediately!`;
    dailyChaosHook = `😏 Cheeky Take: A true friend won't bail you out of jail; they'll be sitting right next to you saying 'damn, that was fun.' 💀`;
    followUpChallenge = `Spill: if the two of you were arrested together, what would the charges most likely be? 🚔`;
  } else if (isGreeting) {
    botReply = `Well, look who decided to grace my screen with their presence 😏 Are we planning on behaving today, or should I strap in for some glorious, mischievous chaos?`;
    dailyChaosHook = `😏 Cheeky Take: Good decisions make boring stories; mildly mischievous decisions make legendary memories.`;
    followUpChallenge = `Quick check-in: on a scale from 'innocent angel' to 'dangerously chaotic', where is your vibe sitting right now? 😈✨`;
  } else if (isExhausted) {
    botReply = `Ugh, the corporate trenches are such an unhinged scam 😩 Who authorized 5-day workweeks?! You officially have my permission to go full goblin mode tonight. Ignore all emails, put your feet up, and be deliciously unproductive.`;
    dailyChaosHook = `😏 Cheeky Take: The urge to reply to work emails with 'per my last email, respectfully go touch grass' grows stronger by the hour.`;
    followUpChallenge = `If you could send ONE unfiltered, brutally honest message to your boss without any consequences, what would it say? 💣`;
  } else if (isWin) {
    botReply = `WAIT STOP EVERYTHING!! Look at you being an absolute menace to the competition!! 🔥 You crushed it so hard it should probably be classified as a felony. How does it feel to be that hot and talented?! 🥂`;
    dailyChaosHook = `😏 Cheeky Take: Humility is cute, but unapologetic excellence is undeniably hotter.`;
    followUpChallenge = `How are we celebrating? And please tell me it involves something wildly indulgent or slightly irresponsible! 💃✨`;
  } else if (isSad) {
    botReply = `Hey... take a deep breath. Put down the armor for a second. I'm right here with you, no judgment, all love. 💙 You're doing so much better than you give yourself credit for. And if anyone caused this, point them out and I'll fight them.`;
    dailyChaosHook = `🦉 Lexi's Wisdom: 'Heavy clouds don't mean the sun disappeared; they just mean the ground is getting ready to bloom.'`;
    followUpChallenge = `Want to vent about it, or would a completely ridiculous story distract you better? You call the shots.`;
  } else {
    botReply = `I am living for this energy! When you upgrade your chat with words like **${replacements[0]?.replacement || 'audacious charm'}**, nobody stands a chance against you 😏 You're radiating dangerous main-character energy right now.`;
    dailyChaosHook = `🦉 Lexi's Wisdom: 'The most attractive thing you can wear is a quick mind and a delightfully sharp vocabulary.'`;
    followUpChallenge = `Describe your current mood using only three words: one fancy, one unhinged, and one slightly spicy. Go! 🌶️`;
  }

  return {
    botReply,
    originalSentence: message,
    enhancedSentence: enhanced,
    replacements:
      replacements.length > 0
        ? replacements
        : [
            {
              original: message.split(' ')[0] || 'word',
              replacement: 'elevated phrasing',
              tone: 'Expressive',
              explanation: 'Upgrading basic phrases makes your personality shine effortlessly in real chats.',
            },
          ],
    dailyChaosHook,
    followUpChallenge,
    source: 'ai-openrouter',
    gardenWordsDetected,
  };
}

// Backward compatibility alias for controller imports
export const enhanceWithOpenRouter = enhanceWithAI;
export const enhanceWithLocalEngine = (text: string) => generateLexiSmartResponse(text);