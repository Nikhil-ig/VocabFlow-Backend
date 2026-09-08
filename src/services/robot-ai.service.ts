/**
 * OpenRouter Robotic AI Service (Unit V-BOT 9000)
 * Uses minimax/minimax-m3:free with reasoning enabled,
 * and preserves reasoning_details across multi-turn interactions.
 */

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_details?: any;
}

export interface RoboticChallenge {
  robotId: string;
  transmissionGreeting: string;
  vibe: string;
  mnemonic: string;
  scenarioTitle: string;
  scenarioText: string;
  dailyChaosExample: string;
  question: string;
  options: string[];
  correctIndex: number;
  robotHint: string;
  directiveTitle: string;
  prompt: string;
  starters: string[];
  sentenceBlocks?: {
    openers: string[];
    punchlines: string[];
  };
  difficultyTier: string;
  reasoning?: string;
  reasoning_details?: any;
}

export interface RoboticSentenceEvaluation {
  approved: boolean;
  synapticScore: number;
  statusTag: string;
  roboticCritique: string;
  correctionSuggestion?: string;
  reasoning?: string;
  reasoning_details?: any;
  assistantMessage?: {
    role: 'assistant';
    content: string;
    reasoning_details?: any;
  };
}

/**
 * In-memory LRU-style cache for generated robotic challenges (instant 0ms retrieval)
 */
const challengeCache = new Map<string, RoboticChallenge>();

/**
 * Call OpenRouter API with reasoning enabled, fast timeout, and fallback models
 */
export const callOpenRouterWithReasoning = async (
  messages: OpenRouterMessage[],
  preferredModel: string = 'openrouter/free',
  timeoutMs: number = 6500
): Promise<{
  content: string;
  reasoning: string;
  reasoning_details: any;
  model: string;
  assistantMessage: {
    role: 'assistant';
    content: string;
    reasoning_details?: any;
  };
} | null> => {
  const rawKey = process.env.OPENROUTER_API_KEY || '';
  const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not configured.');
    return null;
  }

  // Strictly free OpenRouter models only (zero billing / zero token cost)
  const models = [
    preferredModel,
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'openrouter/free',
  ];
  const startTime = Date.now();

  for (const model of models) {
    // Safety guarantee: Ensure no paid model is ever called on OpenRouter
    if (!model.endsWith(':free') && model !== 'openrouter/free') {
      continue;
    }
    if (Date.now() - startTime >= timeoutMs) break;
    const modelStart = Date.now();
    console.log(`[Robot AI] 🤖 Calling OpenRouter model: ${model} (100% Free)...`);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vocabverse.app',
          'X-Title': 'VocabVerse Robotic AI',
        },
        body: JSON.stringify({
          model,
          messages,
          reasoning: { enabled: true },
          max_tokens: 450,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Robot AI] ⚠️ Model ${model} returned status ${response.status}:`, errText.substring(0, 120));
        continue;
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      if (choice?.message) {
        console.log(`[Robot AI] ✅ OpenRouter model ${model} succeeded in ${Date.now() - modelStart}ms`);
        const reasoningText =
          choice.message.reasoning ||
          (Array.isArray(choice.message.reasoning_details)
            ? choice.message.reasoning_details.map((d: any) => d.text || '').join('\n')
            : '');

        return {
          content: choice.message.content || '',
          reasoning: reasoningText,
          reasoning_details: choice.message.reasoning_details,
          model,
          assistantMessage: {
            role: 'assistant',
            content: choice.message.content || '',
            reasoning_details: choice.message.reasoning_details,
          },
        };
      }
    } catch (err: any) {
      console.warn(`[Robot AI] ⚠️ Call to OpenRouter model ${model} failed (${err.name}):`, err.message);
    }
  }

  return null;
};

/**
 * Clean markdown JSON blocks e.g. ```json ... ``` from model output
 */
const parseCleanJSON = (raw: string): any => {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to extract object between first { and last }
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through
      }
    }
    return null;
  }
};

/**
 * Curated real-life daily chaos examples for common vocabulary words.
 * Hyper-relatable, humorous everyday situations (dead batteries, pets chewing shoes, awkward Zoom moments, grocery bag tears, Monday struggles).
 */
export interface DailyChaosItem {
  vibe: string;
  mnemonic: string;
  example: string;
  starters: string[];
  sentenceBlocks: {
    openers: string[];
    punchlines: string[];
  };
}

/**
 * Curated real-life daily chaos examples, punchy vibes, mnemonics, and sentence blocks.
 * Designed so learners instantly understand, laugh, and remember the word forever!
 */
export const DAILY_CHAOS_EXAMPLES: Record<string, DailyChaosItem> = {
  serendipity: {
    vibe: '✨ Lucky Happy Surprise',
    mnemonic: "Sounds like 'Serena dipped' into an old coat pocket and found a crisp $50 bill!",
    example:
      'Finding a $20 bill in my old jeans when I had zero money was pure serendipity.',
    starters: [
      'It was pure serendipity when I found...',
      'By lucky serendipity, my bus arrived right when...',
      'Finding an open seat on the crowded train was serendipity because...',
    ],
    sentenceBlocks: {
      openers: [
        'Finding a forgotten $20 bill in my old coat pocket',
        'When my Wi-Fi crashed right before the volunteer request,',
        'Getting a free dessert because the kitchen made an extra one',
      ],
      punchlines: [
        'was pure serendipity on a crazy Monday.',
        'felt like an unbelievable moment of serendipity!',
        'turned a stressful day into sweet serendipity.',
      ],
    },
  },
  ephemeral: {
    vibe: '⏳ Vanishes in Seconds',
    mnemonic: "Sounds like 'e-Fem-eral' — like a Snapchat story or soap bubble: poof, it's gone!",
    example:
      'My phone battery was at 100%, but it was ephemeral—it died after two minutes in the cold.',
    starters: [
      'My weekend felt completely ephemeral because...',
      'The quiet in the house was ephemeral; then the baby...',
      'That sudden burst of energy was ephemeral when...',
    ],
    sentenceBlocks: {
      openers: [
        'My 100% phone battery in the freezing winter air',
        'The peaceful silence in the house on Sunday morning',
        'My sudden motivation to clean the entire apartment',
      ],
      punchlines: [
        'was completely ephemeral and vanished in two minutes.',
        'proved ephemeral the second the dog heard the doorbell.',
        'was totally ephemeral before I sat down on the comfy sofa.',
      ],
    },
  },
  ubiquitous: {
    vibe: '🌍 Everywhere You Look',
    mnemonic: "'U-Bike-With-Us' — rental scooters and tangled charger cables are everywhere you look!",
    example:
      'Tangled charger cables are ubiquitous—they are in every drawer in my house.',
    starters: [
      'Missing socks are ubiquitous in my laundry basket because...',
      'Traffic jams are ubiquitous in the city whenever...',
      'Spilled water is ubiquitous around my dog\'s bowl when...',
    ],
    sentenceBlocks: {
      openers: [
        'Tangled charger cables and dead batteries',
        'Missing single socks inside my laundry pile',
        'Potholes and detour signs on the morning commute',
      ],
      punchlines: [
        'are ubiquitous no matter which room I search.',
        'have become a ubiquitous nuisance in modern life.',
        'are ubiquitous whenever I am running ten minutes late.',
      ],
    },
  },
  resilient: {
    vibe: '🛡️ Bounces Back Strong',
    mnemonic: 'Like dropping your phone on concrete three times and the screen still refuses to crack!',
    example:
      'My phone is super resilient; I dropped it on concrete three times and the screen didn\'t break.',
    starters: [
      'My cheap sunglasses are surprisingly resilient despite...',
      'I tried to stay resilient when Monday morning...',
      'That old backpack was resilient against...',
    ],
    sentenceBlocks: {
      openers: [
        'Dropping my phone on the sidewalk three times in one week',
        'Smiling cheerfully after calling my new boss "Mom" in a meeting',
        'My cheap dollar-store umbrella surviving a thunderstorm',
      ],
      punchlines: [
        'showed how remarkably resilient everyday gear can be.',
        'proved that I have an unbreakable, resilient mindset.',
        'demonstrated a resilient spirit in the face of bad luck.',
      ],
    },
  },
  resilience: {
    vibe: '🛡️ Bounces Back Strong',
    mnemonic: "Think of an elastic rubber band or laughing off calling your teacher 'Mom' in class!",
    example:
      'It takes real resilience to smile after accidentally calling your teacher \'Mom\' in class.',
    starters: [
      'She showed great resilience after missing the bus and...',
      'My mental resilience broke down when the Wi-Fi...',
      'It takes resilience to smile when your umbrella flips inside out in the rain...',
    ],
    sentenceBlocks: {
      openers: [
        'Laughing off an awkward stumble in front of my coworkers',
        'Missing three buses in the rain and still making it to work',
        'Rebuilding my presentation after my computer froze',
      ],
      punchlines: [
        'required a massive dose of daily resilience.',
        'tested my emotional resilience more than any exam.',
        'was the ultimate display of patience and resilience.',
      ],
    },
  },
  cacophony: {
    vibe: '📢 Loud Chaotic Noise',
    mnemonic: "'Cough + Phone' — imagine 20 people coughing and honking on a phone call at once!",
    example:
      'A loud cacophony woke me up at 6 AM: the dog barked, car alarms went off, and the baby cried.',
    starters: [
      'I couldn\'t sleep because of the cacophony of...',
      'The kitchen was filled with a cacophony of...',
      'The street was a crazy cacophony of honking cars and...',
    ],
    sentenceBlocks: {
      openers: [
        'A loud cacophony of barking dogs and blender noise at 6 AM',
        'My alarm clock, the microwave beep, and smoke detector together',
        'The noisy cafeteria during peak lunchtime rush',
      ],
      punchlines: [
        'created an overwhelming cacophony that gave me a headache.',
        'erupted into a chaotic cacophony across the apartment.',
        'was a wild cacophony of sound that woke up the entire floor.',
      ],
    },
  },
  pragmatic: {
    vibe: '🛠️ Practical & Realistic',
    mnemonic: "'No clean spoon? Eat yogurt with a fork!' — Pragmatic people solve problems with whatever works!",
    example:
      'I couldn\'t find a clean spoon, so I made a pragmatic choice and ate my yogurt with a fork.',
    starters: [
      'When my car wouldn\'t start, my pragmatic choice was...',
      'Taking a pragmatic approach to my messy room, I just...',
      'It was pragmatic to bring an umbrella because...',
    ],
    sentenceBlocks: {
      openers: [
        'Eating cold leftover pizza for breakfast when running late',
        'Using an empty cardboard box as an emergency laptop stand',
        'Wearing dark sneakers instead of white ones in the rain',
      ],
      punchlines: [
        'was the most pragmatic decision I made all morning.',
        'showed my pragmatic approach to solving ridiculous problems.',
        'proved that simple pragmatic fixes beat fancy solutions.',
      ],
    },
  },
  fastidious: {
    vibe: '🧹 Ultra Neat Freak',
    mnemonic: "'Fast + Tidy' — someone who cleans every crumb the millisecond it hits the table!",
    example:
      'My roommate is so fastidious that he washes the kitchen counter three times after making toast.',
    starters: [
      'My mom is very fastidious about keeping shoes outside...',
      'I tried to be fastidious while cleaning, but...',
      'He is fastidious about his desk; not a single pen is...',
    ],
    sentenceBlocks: {
      openers: [
        'My roommate scrubbing the kitchen counter after one slice of toast',
        'Organizing my pencil drawer by color, length, and brand',
        'My cat grooming her left paw for thirty straight minutes',
      ],
      punchlines: [
        'showed how ridiculously fastidious a person can be.',
        'proved that I am far too fastidious about small details.',
        'was way too fastidious for an ordinary weekday morning.',
      ],
    },
  },
  alacrity: {
    vibe: '⚡ Eager Lightning Speed',
    mnemonic: "'Electricity speed' — sprinting to the front door the second the pizza delivery rings!",
    example:
      'I ran to the front door with alacrity the second the pizza delivery guy rang the bell.',
    starters: [
      'I closed my work laptop with alacrity when 5 PM struck...',
      'The dog ran to the kitchen with wild alacrity when...',
      'She jumped out of bed with alacrity because...',
    ],
    sentenceBlocks: {
      openers: [
        'Sprinting to the front door when the pizza doorbell rang',
        'Shutting down my work laptop the microsecond 5 PM struck',
        'My dog bounding into the kitchen at the sound of a cheese wrapper',
      ],
      punchlines: [
        'was executed with joyful, unfiltered alacrity.',
        'proved how much alacrity I have for tasty food.',
        'demonstrated pure alacrity after an exhausting day.',
      ],
    },
  },
  plethora: {
    vibe: '📦 Overwhelming Amount',
    mnemonic: "'Plenty + Flora' — a giant mountain of clothes in the closet, yet 'nothing to wear'!",
    example:
      'I have a plethora of clothes in my closet, but every morning I feel like I have nothing to wear.',
    starters: [
      'There is a plethora of unread emails in my inbox from...',
      'My phone has a plethora of open tabs because...',
      'He gave a plethora of funny excuses for being late, like...',
    ],
    sentenceBlocks: {
      openers: [
        'Having a plethora of unworn clothes in my messy closet',
        'Staring at a plethora of sixty-four open browser tabs',
        'Receiving a plethora of bizarre excuses from my group partners',
      ],
      punchlines: [
        'still left me feeling completely unprepared for the day.',
        'slowed my laptop down to a painful, laggy freeze.',
        'gave our team a plethora of options to laugh about.',
      ],
    },
  },
  pernicious: {
    vibe: '🐍 Sneaky Harmful Trap',
    mnemonic: "'Poisonous + Vicious' — doomscrolling short videos till 3 AM; feels fun, ruins tomorrow!",
    example:
      'Watching short videos until 3 AM is a pernicious habit that makes me exhausted the next day.',
    starters: [
      'Hitting the snooze button is a pernicious habit because...',
      'Eating junk food late at night had a pernicious effect on...',
      'Procrastination is pernicious; before you know it...',
    ],
    sentenceBlocks: {
      openers: [
        'Doomscrolling short video clips in bed until 3 AM',
        'Hitting the snooze button four times in a row every morning',
        'Putting off writing my report until thirty minutes before deadline',
      ],
      punchlines: [
        'is a pernicious habit that ruins my entire energy level.',
        'had a pernicious impact on my morning focus.',
        'proved to be a pernicious trap I keep falling into.',
      ],
    },
  },
  eloquent: {
    vibe: '🎙️ Smooth & Persuasive',
    mnemonic: "'E-Liquid-Fluent' — speaking so smoothly and beautifully that everyone stops and listens!",
    example:
      'I wanted to give an eloquent excuse for being late, but I panicked and just said: \'Bus broke.\'',
    starters: [
      'He gave an eloquent apology after accidentally...',
      'I tried to sound eloquent in the interview, but...',
      'Her speech was very eloquent until she dropped...',
    ],
    sentenceBlocks: {
      openers: [
        'I rehearsed an eloquent explanation for being twenty minutes late,',
        'His eloquent apology after knocking over the grocery display',
        'Giving an eloquent presentation while your stomach loudly growls',
      ],
      punchlines: [
        'instantly melted into a panicked stammer when the boss looked up.',
        'charmed everyone into completely forgiving the mess.',
        'showed that eloquent speakers can handle any awkward moment.',
      ],
    },
  },
  serene: {
    vibe: '🕊️ Calm & Peaceful',
    mnemonic: "'Sirens off, seen calm' — that 2-minute heavenly quiet before the dog spots a squirrel!",
    example:
      'My house was completely serene for two minutes—until my toddler threw a toy and the dog started barking.',
    starters: [
      'I tried to stay serene while my computer froze during...',
      'The park was quiet and serene until a swarm of...',
      'Finding a serene spot in the house is impossible when...',
    ],
    sentenceBlocks: {
      openers: [
        'The living room was quiet and serene for two blissful minutes,',
        'Sitting on the porch with a hot cup of tea at sunrise',
        'Trying to maintain a serene expression while my video froze on Zoom',
      ],
      punchlines: [
        'until my puppy knocked over a plant and chaos erupted.',
        'was the most serene part of my chaotic weekend.',
        'proved that a serene mindset can survive any technical glitch.',
      ],
    },
  },
  anticipation: {
    vibe: '⏱️ Waiting on Edge',
    mnemonic: 'Staring at the microwave clock to stop it at 0:01 before the ear-piercing beep!',
    example:
      'I stared at the microwave in tense anticipation, waiting to stop it at 0:01 before the loud beep.',
    starters: [
      'I waited in nervous anticipation for my exam results while...',
      'With hungry anticipation, I opened the takeout box and...',
      'The anticipation of waiting for my friend who was 30 minutes late...',
    ],
    sentenceBlocks: {
      openers: [
        'Staring at the microwave countdown in breathless anticipation',
        'Opening the pizza delivery box with hungry, eager anticipation',
        'Waiting for the test grades to upload while refreshing the page',
      ],
      punchlines: [
        'I managed to stop the timer at exactly 0:01 without a sound.',
        'made every single bite taste ten times better.',
        'filled the whole room with nervous anticipation.',
      ],
    },
  },
  euphoria: {
    vibe: '🚀 Pure Peak Joy',
    mnemonic: "'You-Fly-High' — finding front-row parking on a rainy day right in front of the store!",
    example:
      'I felt pure euphoria when I found an open parking spot right in front of the store on a busy day.',
    starters: [
      'A wave of euphoria hit me when the teacher canceled...',
      'The euphoria of finishing my homework was ruined when...',
      'I felt pure euphoria when the weekend finally arrived...',
    ],
    sentenceBlocks: {
      openers: [
        'Finding a front-row parking spot right in front of the store',
        'Hearing that our difficult Friday quiz was made open-book',
        'Kicking off my wet work shoes after a soaking rainy commute',
      ],
      punchlines: [
        'sparked an instant wave of pure, glowing euphoria.',
        'filled the classroom with loud, cheering euphoria.',
        'brought sheer euphoria to the end of a long day.',
      ],
    },
  },
  synergy: {
    vibe: '🤝 Magic Team Combo',
    mnemonic: "'Sync + Energy' — a rainy cold storm plus a warm cozy blanket equals the ultimate nap!",
    example:
      'A heavy rainstorm and a cozy blanket created the perfect synergy for an afternoon nap.',
    starters: [
      'My alarm and my phone battery had zero synergy when...',
      'Popcorn and a funny movie had the best synergy for...',
      'Our team worked with great synergy to finish...',
    ],
    sentenceBlocks: {
      openers: [
        'A rainy Sunday afternoon and a warm fleece blanket',
        'My puppy and baby brother joining forces in the kitchen',
        'Peanut butter and sweet jelly joining together',
      ],
      punchlines: [
        'produced the ultimate synergy for a marathon nap.',
        'created hilarious synergy for spreading flour everywhere.',
        'offered unbeatable synergy that made lunch delightful.',
      ],
    },
  },
  empathy: {
    vibe: '❤️ Feeling Their Pain',
    mnemonic: "'Em-path-I-feel' — cringing when you see someone drop their fresh ice cream on the sidewalk!",
    example:
      'I felt deep empathy for the kid whose ice cream scoop fell off the cone onto the sidewalk.',
    starters: [
      'I had pure empathy for my friend when her laptop crashed...',
      'Seeing someone run for the closing bus made me feel empathy because...',
      'You feel instant empathy when you see another person...',
    ],
    sentenceBlocks: {
      openers: [
        'Watching someone drop their fresh ice cream scoop onto the pavement',
        'Seeing a commuter sprint for closing train doors only to miss them',
        'Looking at my exhausted friend balancing four grocery bags',
      ],
      punchlines: [
        'struck my heart with immediate, painful empathy.',
        'made me feel pure empathy for their morning misfortune.',
        'inspired instant empathy and prompted me to lend a hand.',
      ],
    },
  },
  hegemony: {
    vibe: '👑 Total Boss Dominance',
    mnemonic: "'He's got the money & crown' — your 8-pound cat claiming total dominance over your keyboard!",
    example:
      'My small cat has total hegemony in our house; she sleeps on my laptop and won\'t let me work.',
    starters: [
      'The TV remote has total hegemony over our family movie night...',
      'My baby brother has complete hegemony over the living room...',
      'Sleep had total hegemony over my brain when...',
    ],
    sentenceBlocks: {
      openers: [
        'My tiny cat holds undisputed hegemony over the living room;',
        'The TV remote exercised total hegemony over our family night,',
        'Procrastination established absolute hegemony over my study schedule',
      ],
      punchlines: [
        'she sprawls across my laptop and forbids all typing.',
        'dictating what everyone watched for three straight hours.',
        'until the deadline was only two hours away.',
      ],
    },
  },
  leverage: {
    vibe: '🕹️ Power to Win',
    mnemonic: "'Level-up advantage' — holding the only big umbrella in a surprise downpour gives you all the power!",
    example:
      'My little brother used an embarrassing video of me to get leverage and make me do his chores.',
    starters: [
      'Holding the only umbrella gave me great leverage over...',
      'She used the car keys as leverage so we would...',
      'I had zero leverage when asking my boss for...',
    ],
    sentenceBlocks: {
      openers: [
        'Holding the only working umbrella during a sudden downpour',
        'My sibling possessing an embarrassing photo from fifth grade',
        'Bringing hot fresh donuts to the morning project review',
      ],
      punchlines: [
        'gave me supreme leverage to choose our lunch spot.',
        'provided endless leverage to force me into washing the dishes.',
        'offered huge leverage for getting my ideas approved.',
      ],
    },
  },
  disruption: {
    vibe: '💥 Sudden Shake-Up',
    mnemonic: "'Disrupt the track' — Wi-Fi disconnecting right as you hit submit on your homework!",
    example:
      'A sudden Wi-Fi disruption right when I was submitting my homework gave me a mini heart attack.',
    starters: [
      'The dog barking caused a loud disruption during my call...',
      'A broken train caused huge disruption to my morning commute...',
      'Power cuts caused major disruption while we were...',
    ],
    sentenceBlocks: {
      openers: [
        'A sudden Wi-Fi disruption right as I clicked the submit button',
        'My dog sprinting through the background of a formal video call',
        'A flat bicycle tire on the morning of my biggest presentation',
      ],
      punchlines: [
        'caused a massive disruption and spiked my heart rate.',
        'brought hilarious disruption to the corporate presentation.',
        'created unexpected disruption to my carefully planned day.',
      ],
    },
  },
  epistemology: {
    vibe: '🧠 How We Know Things',
    mnemonic: "'Epis-Know-logy' — realizing the milk was expired after drinking half the bowl of cereal!",
    example:
      'My basic epistemology was tested when I realized the milk in my cereal had expired last week.',
    starters: [
      'I doubted my own epistemology when the GPS told me to...',
      'His epistemology was shaken when he saw that...',
      'It made me question everything I know when...',
    ],
    sentenceBlocks: {
      openers: [
        'My culinary epistemology was fundamentally challenged',
        'I questioned my entire sensory epistemology',
        'Discovering that the map app sent me in a complete circle',
      ],
      punchlines: [
        'when I learned cereal milk had expired three days ago.',
        'after realizing my watch was set to the wrong timezone.',
        'shook my epistemology regarding modern technology and trust.',
      ],
    },
  },
  paradigm: {
    vibe: '🔄 Big New Mindset',
    mnemonic: "'Pair-of-dimes shift' — learning to peel bananas from the bottom changes your whole world!",
    example:
      'Learning to peel a banana from the bottom was a total paradigm shift for my morning snack.',
    starters: [
      'Buying an air fryer caused a big paradigm shift in my cooking...',
      'Working from bed created a weird paradigm shift in my life...',
      'My paradigm of an easy weekend fell apart when...',
    ],
    sentenceBlocks: {
      openers: [
        'Learning that bananas peel easier from the bottom',
        'Switching from an old stove to an ultra-fast air fryer',
        'Realizing that saying "no" to extra chores is allowed',
      ],
      punchlines: [
        'sparked an incredible paradigm shift in my daily routine.',
        'represented a total paradigm shift in how I prepare dinner.',
        'created a healthy new paradigm for my work-life balance.',
      ],
    },
  },
  juxtaposition: {
    vibe: '🎭 Funny Contrast',
    mnemonic: "'Just pose next to' — wearing a sharp business suit with bright dinosaur socks on Zoom!",
    example:
      'The juxtaposition of my fancy work suit and my bright dinosaur socks made everyone laugh.',
    starters: [
      'The funny juxtaposition of a fancy meal on a paper plate...',
      'There was a weird juxtaposition between the happy music and my...',
      'The juxtaposition of a clean room and a messy bed...',
    ],
    sentenceBlocks: {
      openers: [
        'The funny juxtaposition of a fancy tuxedo and dinosaur socks',
        'Eating gourmet ramen noodles from a cracked plastic bowl',
        'A sparkling clean desk sitting right next to an unmade bed',
      ],
      punchlines: [
        'created a hilarious juxtaposition that cracked everyone up.',
        'highlighted the absurd juxtaposition of student life.',
        'offered a delightful juxtaposition of style and chaos.',
      ],
    },
  },
  empirical: {
    vibe: '🔬 Hard Real Proof',
    mnemonic: "'Empire of facts' — black crispy burnt toast is 100% real empirical proof you cooked it too long!",
    example:
      'I had empirical proof that my cookies burned: they were black and hard as rocks.',
    starters: [
      'My empty bank account was empirical proof that I spent too much...',
      'We had empirical evidence that the dog ate the pizza because...',
      'I need empirical proof before I believe that...',
    ],
    sentenceBlocks: {
      openers: [
        'The smoke detector screeching at full volume',
        'Finding cookie crumbs scattered across the sleeping dog\'s rug',
        'My bank account balance dropping to negative three dollars',
      ],
      punchlines: [
        'was empirical proof that my cooking experiment had failed.',
        'provided undeniable empirical evidence of pizza theft.',
        'served as empirical proof that online shopping got out of hand.',
      ],
    },
  },
  dichotomy: {
    vibe: '⚖️ Two Opposite Sides',
    mnemonic: "'Di-cut-in-two' — wanting to stay up watching funny videos vs needing sleep for work!",
    example:
      'I faced a painful dichotomy: stay up late watching funny videos, or wake up refreshed for work.',
    starters: [
      'My brain struggled with the dichotomy of saving money vs buying...',
      'There is a funny dichotomy between my clean desk and my...',
      'I felt the dichotomy of wanting to go out and wanting to stay in bed...',
    ],
    sentenceBlocks: {
      openers: [
        'Wrestling with the agonizing dichotomy of sleeping early vs scrolling videos',
        'The funny dichotomy between my super tidy room and chaotic closet',
        'Facing the dichotomy of wanting to save money while craving sushi',
      ],
      punchlines: [
        'is a daily dichotomy that every modern human battles.',
        'revealed a striking dichotomy in how I organize my life.',
        'kept me pondering the dichotomy until way past midnight.',
      ],
    },
  },
  latency: {
    vibe: '🐢 Annoying Lag',
    mnemonic: "'Late-ency' — 3-second audio delay on Zoom making everyone talk over each other awkwardly!",
    example:
      'The 3-second audio latency on our video call made us all talk over each other awkwardly.',
    starters: [
      'My bad internet latency made me lose the online game...',
      'There was a funny latency between the joke and when he laughed...',
      'The latency on my old computer is so bad that...',
    ],
    sentenceBlocks: {
      openers: [
        'The awkward three-second audio latency on our team call',
        'Experiencing massive internet latency right at the final game boss',
        'The funny latency between cracking a joke and my friend getting it',
      ],
      punchlines: [
        'caused everyone to interrupt each other five times in a row.',
        'resulted in severe latency that ruined my winning streak.',
        'led to an awkward silence before everyone finally chuckled.',
      ],
    },
  },
  petrichor: {
    vibe: '🌧️ Fresh Rain Smell',
    mnemonic: "'Pet-the-rain' — that wonderful earthy sweet aroma when raindrops hit dry summer soil!",
    example:
      'The sweet petrichor after the rain smelled amazing—until I realized I left my car windows open.',
    starters: [
      'I loved the fresh petrichor outside, but then a taxi splashed water on me...',
      'The scent of petrichor filled the street right before the storm got worse...',
      'Enjoying the petrichor was nice until my umbrella broke...',
    ],
    sentenceBlocks: {
      openers: [
        'The delightful petrichor rising from the dry summer pavement',
        'Inhaling the sweet, earthy scent of petrichor after a sudden storm',
        'Stepping onto the balcony to enjoy the fresh petrichor in the air',
      ],
      punchlines: [
        'was ruined the moment I realized my car windows were open.',
        'brought an instant sense of calm before the thunder rumbled.',
        'made me stop and appreciate the simple beauty of rainy days.',
      ],
    },
  },
  mellifluous: {
    vibe: '🍯 Sweet Honey Voice',
    mnemonic: "'Melli (honey) + Flow' — a voice as smooth, warm, and sweet as golden flowing honey!",
    example:
      'The dentist\'s voice was calm and mellifluous, but the sound of the drill was terrifying.',
    starters: [
      'His voice was very mellifluous when he apologized for...',
      'The song was mellifluous, but my alarm sound was...',
      'The barista had a mellifluous voice even though the café was packed...',
    ],
    sentenceBlocks: {
      openers: [
        'The flight attendant\'s calm, mellifluous voice over the speakers',
        'Her mellifluous singing while washing dishes in the kitchen',
        'The podcast narrator\'s deep and mellifluous tone',
      ],
      punchlines: [
        'made a two-hour flight delay feel surprisingly bearable.',
        'was delightfully mellifluous until she hit a hilarious high note.',
        'was so mellifluous that I drifted to sleep within minutes.',
      ],
    },
  },
  labyrinthine: {
    vibe: '🌀 Crazy Maze',
    mnemonic: "'Labyrinth-like' — trying to cancel an online subscription through ten hidden puzzle menus!",
    example:
      'Finding my gate in the labyrinthine airport with a broken suitcase and five minutes left was pure stress.',
    starters: [
      'The grocery store felt labyrinthine when I was looking for...',
      'Trying to cancel my subscription was a labyrinthine puzzle...',
      'The old building had labyrinthine hallways where I got lost...',
    ],
    sentenceBlocks: {
      openers: [
        'Navigating the labyrinthine hallways of the old hospital',
        'Trying to cancel an online membership through labyrinthine menus',
        'Searching for gate B42 in the labyrinthine airport terminal',
      ],
      punchlines: [
        'felt like an impossible maze created to test human patience.',
        'was a labyrinthine nightmare of confirmation prompts.',
        'turned into an Olympic sprint through twisting corridors.',
      ],
    },
  },
  ineffable: {
    vibe: '🌌 Beyond Words',
    mnemonic: "'In-effort-able to say' — a feeling so intense and wild that normal words completely fail!",
    example:
      'I felt an ineffable sadness as my slice of pizza slipped from my hands and hit the floor.',
    starters: [
      'The look on his face was ineffable when his alarm went off during...',
      'There was an ineffable relief when I found my lost keys in...',
      'Watching the battery hit 1% was an ineffable feeling of dread...',
    ],
    sentenceBlocks: {
      openers: [
        'Watching my fresh slice of pizza slide face-down onto the rug',
        'Standing atop the foggy mountain summit right at sunrise',
        'The look on my friend\'s face when his ringtone blared in a silent library',
      ],
      punchlines: [
        'brought an ineffable wave of sorrow to my dinner plans.',
        'inspired an ineffable sense of wonder that words cannot describe.',
        'captured an ineffable mixture of absolute panic and laughter.',
      ],
    },
  },
  catharsis: {
    vibe: '🌊 Big Emotional Purge',
    mnemonic: "'Clean out the clutter' — throwing away four giant bags of junk or crying during a sad movie!",
    example:
      'Throwing away three bags of old junk from my bedroom was the best catharsis of the week.',
    starters: [
      'Ripping up junk mail was pure catharsis after a long day...',
      'Crying during the sad movie gave me great catharsis...',
      'Cleaning my messy desk gave me an instant sense of catharsis...',
    ],
    sentenceBlocks: {
      openers: [
        'Tossing three giant bags of old clutter into the recycling bin',
        'Screaming loudly into a pillow after missing the morning train',
        'Shredding stacks of expired paperwork after a stressful week',
      ],
      punchlines: [
        'provided the ultimate sense of emotional catharsis.',
        'delivered instant, hilarious catharsis to a rough afternoon.',
        'brought deep catharsis and allowed me to breathe freely again.',
      ],
    },
  },
  quintessential: {
    vibe: '⭐ Perfect Classic Example',
    mnemonic: "'Queen of essentials' — a warm fireplace, woolen socks, and hot cider: classic winter vibe!",
    example:
      'Stepping into a deep puddle with brand-new white sneakers was the quintessential start to Monday.',
    starters: [
      'Drinking hot cider by the fireplace is the quintessential...',
      'Forgetting where I placed my glasses while wearing them is quintessential...',
      'Burning the first piece of toast is the quintessential...',
    ],
    sentenceBlocks: {
      openers: [
        'Stepping straight into a mud puddle with brand-new sneakers',
        'A warm mug of hot cocoa beside a crackling winter fireplace',
        'Forgetting why I walked into the kitchen the second I arrived',
      ],
      punchlines: [
        'was the quintessential start to an eventful Monday morning.',
        'remains the quintessential symbol of cozy relaxation.',
        'is the quintessential brain glitch that every human experiences.',
      ],
    },
  },
  tenacious: {
    vibe: '🐾 Won\'t Let Go',
    mnemonic: "'Ten-ac-ious' — like an excited puppy holding onto your sock with the grip of ten bulldogs!",
    example:
      'My puppy showed a tenacious grip on my clean sock, refusing to let go for twenty minutes.',
    starters: [
      'Her tenacious effort to fix the computer glitch...',
      'The tenacious alarm clock that kept ringing every three minutes...',
      'He remained tenacious despite missing two buses in the rain...',
    ],
    sentenceBlocks: {
      openers: [
        'My puppy clamping onto my woolen sock with a tenacious grip',
        'Her tenacious refusal to give up on finding the missing car keys',
        'An annoying alarm clock that tenaciously buzzes every five minutes',
      ],
      punchlines: [
        'proved that nothing could break his stubborn determination.',
        'finally paid off when the keys appeared under the couch cushion.',
        'ensured that no human could possibly sleep past seven o\'clock.',
      ],
    },
  },
  heuristic: {
    vibe: '💡 Smart Rule of Thumb',
    mnemonic: "'Here-is-the-trick' — using a fast mental shortcut (like picking the restaurant with the line)!",
    example:
      'My simple cooking heuristic is to always add an extra pinch of garlic whenever a recipe tastes plain.',
    starters: [
      'As a simple heuristic for packing light, I only bring...',
      'Using the heuristic of following where locals eat saved us from...',
      'His heuristic for fixing electronics was simply to turn them off and on...',
    ],
    sentenceBlocks: {
      openers: [
        'Following the simple heuristic of eating wherever locals line up',
        'Using the handy heuristic of restarting the computer first',
        'My travel heuristic of never packing more than one carry-on bag',
      ],
      punchlines: [
        'saved us from falling into an overpriced tourist trap.',
        'solved ninety percent of our tech glitches in ten seconds.',
        'made navigating busy airports a stress-free experience.',
      ],
    },
  },
  deterministic: {
    vibe: '🎯 100% Predictable',
    mnemonic: "'Determined result' — dropping toast and knowing it is 100% landing butter-side down!",
    example:
      'Dropping buttered toast seemed completely deterministic: it landed butter-side down every single time.',
    starters: [
      'My dog\'s routine is deterministic; at exactly 6 PM he sits by...',
      'The computer calculation was strictly deterministic because...',
      'It felt deterministic that it would rain the moment I washed my car...',
    ],
    sentenceBlocks: {
      openers: [
        'Dropping buttered toast onto the clean kitchen floor',
        'My cat\'s deterministic habit of meowing at 5:58 AM sharp',
        'A cryptographic algorithm calculating identical checksums',
      ],
      punchlines: [
        'felt completely deterministic when it landed butter-side down.',
        'proves that morning breakfast requests have zero randomness.',
        'is deterministic, ensuring reliable results every single run.',
      ],
    },
  },
  idempotent: {
    vibe: '🔁 Repeat with Zero Change',
    mnemonic: "'I-do-it-again-potent' — hitting the elevator button ten times doesn't make it arrive any faster!",
    example:
      'Pressing the crosswalk button fifteen times is idempotent: the signal changes at the exact same speed.',
    starters: [
      'Hitting the elevator call button repeatedly is idempotent because...',
      'Clicking save on my document five times in a row was idempotent...',
      'Refreshing the order confirmation page was safe and idempotent...',
    ],
    sentenceBlocks: {
      openers: [
        'Pressing the crosswalk button twenty times while waiting in rain',
        'Clicking the "Save" icon six times in three seconds out of habit',
        'Hitting the elevator button repeatedly when running five minutes late',
      ],
      punchlines: [
        'is completely idempotent: the light is already activated, human!',
        'was idempotent and produced the exact same saved file.',
        'does not make the elevator arrive a single second earlier.',
      ],
    },
  },
  halcyon: {
    vibe: '☀️ Golden Peaceful Days',
    mnemonic: "'Hal-calm-sun' — fondly remembering carefree childhood summer days before adult responsibilities!",
    example:
      'I fondly recalled the halcyon days of summer vacation before I had to worry about rent and bills.',
    starters: [
      'Thinking back to the halcyon era before group chats flooded my phone...',
      'Those halcyon Saturday mornings watching cartoons with zero homework...',
      'We reminisced about the halcyon weeks spent camping by the lake...',
    ],
    sentenceBlocks: {
      openers: [
        'Remembering the halcyon days of summer vacation before bill payments',
        'Those halcyon Saturday mornings spent watching cartoons in pajamas',
        'Reflecting on the halcyon era before constant smartphone notifications',
      ],
      punchlines: [
        'felt like a golden dream compared to this busy work week.',
        'brought a warm smile and a momentary escape from reality.',
        'reminded me of how simple and joyful life used to be.',
      ],
    },
  },
  abstraction: {
    vibe: '📦 Simple Clean Interface',
    mnemonic: "'Car steering wheel' — turning the wheel controls the car without needing to know gearbox mechanics!",
    example:
      'A car\'s steering wheel is a great abstraction: you steer easily without needing to know engine physics.',
    starters: [
      'The smartphone touchscreen is a wonderful abstraction that hides...',
      'Using a coffee machine is a convenient abstraction for...',
      'Good software abstraction shields regular users from...',
    ],
    sentenceBlocks: {
      openers: [
        'Turning a car steering wheel is an elegant abstraction',
        'A modern smartphone touchscreen provides a friendly abstraction',
        'The TV remote is a classic everyday abstraction',
      ],
      punchlines: [
        'that lets us drive without calculating engine combustion physics.',
        'that hides millions of lines of intricate computing code.',
        'shielding us from the complicated electronics inside the screen.',
      ],
    },
  },
};

/**
 * Intelligent helper to generate an easy, fun, memorable daily chaos package for ANY vocabulary word.
 */
export const getFallbackDailyChaosExample = (
  word: string,
  meaning: string,
  pos?: string | null
): DailyChaosItem => {
  const lower = word.toLowerCase().trim();
  if (DAILY_CHAOS_EXAMPLES[lower]) {
    return DAILY_CHAOS_EXAMPLES[lower];
  }

  const cleanMeaning = meaning.replace(/^to\s+/i, '').replace(/[.;]+$/, '');
  const p = (pos || '').toLowerCase();

  let vibe = '✨ Real-Life Spark';
  let mnemonic = `Remember "${word}" by picturing: ${cleanMeaning} on an eventful Monday!`;
  let chaosSentence = `Finding out about ${cleanMeaning} on a crazy Monday made "${word}" the best word for my day.`;
  let opener1 = `My plans to be on time were totally ${word}`;
  let opener2 = `Encountering an unexpected situation involving ${word}`;
  let opener3 = `When my alarm failed and the morning got crazy,`;

  if (p.includes('adj')) {
    vibe = '🌟 Super Notable Vibe';
    mnemonic = `Say "${word}" like describing someone's chaotic, ${cleanMeaning} mood!`;
    chaosSentence = `My plans to be on time were completely ${word} after I stepped right into a giant mud puddle.`;
    opener1 = `Stepping into a deep puddle with clean shoes was ${word}`;
    opener2 = `My Monday morning routine felt completely ${word}`;
  } else if (p.includes('noun')) {
    vibe = '🎯 Core Human Moment';
    mnemonic = `Picture "${word}" as a real thing you run into: ${cleanMeaning}!`;
    chaosSentence = `When my alarm failed and the bus was late, I faced the ultimate ${word} of my morning.`;
    opener1 = `Dealing with the morning rush brought pure ${word}`;
    opener2 = `The dog running off with my slipper caused instant ${word}`;
  } else if (p.includes('verb')) {
    vibe = '⚡ Action Packed';
    mnemonic = `Action trick: whenever you need to ${cleanMeaning}, you ${word}!`;
    chaosSentence = `I had to ${word} through the train station while balancing four overflowing grocery bags.`;
    opener1 = `Having to ${word} through the crowded hallway in socks`;
    opener2 = `Trying to ${word} before the microwave countdown beeped`;
  } else if (p.includes('adv')) {
    vibe = '🚀 How It Happens';
    mnemonic = `Notice how it happens: doing things in a ${cleanMeaning} way is "${word}"!`;
    chaosSentence = `I ran ${word} toward the closing bus doors, but they shut right in my face.`;
    opener1 = `Sprinting ${word} toward the subway doors`;
    opener2 = `Reacting ${word} when the alarm clock went off`;
  }

  return {
    vibe,
    mnemonic,
    example: chaosSentence,
    starters: [
      `My Monday morning was ${word} when...`,
      `I never saw something so ${word} until my phone...`,
      `It was completely ${word} when I accidentally dropped my...`,
    ],
    sentenceBlocks: {
      openers: [
        opener1,
        opener2,
        opener3,
      ],
      punchlines: [
        `showed how "${word}" perfectly fits modern everyday life.`,
        `turned into an unforgettable "${word}" moment for all of us.`,
        `made me appreciate the true meaning of "${word}".`,
      ],
    },
  };
};

/**
 * Generate an easy, dynamic, fun, robotic scenario quiz & sentence mission using OpenRouter AI
 * Grounded in simple, relatable real-life daily chaos so learners easily remember words!
 */
export const generateRoboticChallenge = async (card: {
  word: string;
  meaning: string;
  pos?: string | null;
  example?: string | null;
}): Promise<RoboticChallenge> => {
  const cacheKey = card.word.trim().toLowerCase();
  if (challengeCache.has(cacheKey)) {
    return challengeCache.get(cacheKey)!;
  }

  const fallbackChaos = getFallbackDailyChaosExample(card.word, card.meaning, card.pos);

  const systemPrompt = `You are "UNIT V-BOT 9000", a friendly robotic tutor helping humans remember English words.
Create an easy, memorable vocabulary challenge for the word "${card.word}".

CRITICAL INSTRUCTIONS:
1. USE VERY EASY, SIMPLE, PLAIN ENGLISH! The learners are learning vocabulary, so DO NOT use complicated, academic, or difficult words in the explanation. The word "${card.word}" must be the ONLY difficult word.
2. KEEP THE EXAMPLE SHORT AND PUNCHY (1 simple sentence, 12-18 words max).
3. USE FRESH, RELATABLE DAILY CHAOS:
   Pick ONE vivid, humorous everyday situation from diverse categories:
   - Pets & Animals: dog stealing a pizza crust, cat sleeping on laptop keyboard, puppy chewing slippers
   - Tech fails: phone battery dying at 1% right at checkout, charger cables tangled into a giant knot, Wi-Fi cutting off mid-stream, autocorrect changing a normal word to nonsense
   - Food chaos: ice cream scoop sliding off the cone, toast burning to a crisp, dropping pizza face-down, forgetting leftovers in the microwave
   - Commute & Wardrobe: stepping in a deep mud puddle with clean shoes, umbrella blowing inside-out in high wind, sprinting for the closing subway doors, grocery bag bottom ripping open
   - Social awkwardness: waving enthusiastically back at someone who was waving at the person behind you, calling a boss or teacher "Mom"
4. STRICT DIVERSITY MANDATE & NEGATIVE CONSTRAINT: DO NOT mention coffee, spilled coffee, or coffee mugs! Coffee examples are repetitive, boring, and strictly forbidden. Always pick other everyday human mishaps!
5. MAKE IT FUN, VARIED, AND MEMORABLE!

Word Metadata:
- Word: "${card.word}"
- Meaning: "${card.meaning}"
- Part of Speech: "${card.pos || 'General'}"

Keep reasoning concise (under 25 words). Return a strictly formatted JSON object:
{
  "transmissionGreeting": "A short, cheerful robotic greeting from Unit V-BOT 9000 (simple English)",
  "vibe": "A 3-word punchy, colorful vibe with emoji (e.g. '✨ Lucky Happy Surprise')",
  "mnemonic": "A funny 1-second sound-alike trick or memorable mental picture to remember '${card.word}' forever in plain words!",
  "scenarioTitle": "[DAILY CHAOS LOG: (Short Funny Name)]",
  "scenarioText": "A simple 1-sentence funny story showing everyday chaos where '${card.word}' fits.",
  "dailyChaosExample": "A short, simple, funny daily chaos sentence using '${card.word}' with very easy words so the learner remembers it forever!",
  "question": "Which simple definition explains '${card.word}'?",
  "options": ["Correct simple meaning", "Wrong choice 1", "Wrong choice 2", "Wrong choice 3"],
  "correctIndex": 0,
  "robotHint": "A simple, funny 1-sentence hint for '${card.word}' in plain English",
  "directiveTitle": "[DAILY CHAOS SENTENCE LAB]",
  "prompt": "Weave a simple sentence with '${card.word}' using an everyday mishap (like a dead phone battery, puppy chaos, or dropping toast)!",
  "starters": [
    "Easy starter 1 with '${card.word}'...",
    "Easy starter 2 with '${card.word}'...",
    "Easy starter 3 with '${card.word}'..."
  ],
  "sentenceBlocks": {
    "openers": ["Funny everyday opener 1", "Funny everyday opener 2", "Funny everyday opener 3"],
    "punchlines": ["was pure ${card.word}!", "showed total ${card.word} on a Monday.", "felt like unbelievable ${card.word}."]
  },
  "difficultyTier": "TIER-2 CHAOS SYNC"
}
Return ONLY raw JSON.`;

  const messages: OpenRouterMessage[] = [
    {
      role: 'user',
      content: systemPrompt,
    },
  ];

  const result = await callOpenRouterWithReasoning(messages, 'openrouter/free', 2500);

  if (result) {
    const parsed = parseCleanJSON(result.content);
    if (parsed) {
      const challenge: RoboticChallenge = {
        robotId: 'UNIT V-BOT 9000',
        transmissionGreeting:
          parsed.transmissionGreeting ||
          `BEEP BOOP! Unit V-BOT 9000 surveillance active. Analyzing human daily chaos patterns for "${card.word}"!`,
        vibe: parsed.vibe || fallbackChaos.vibe,
        mnemonic: parsed.mnemonic || fallbackChaos.mnemonic,
        scenarioTitle: parsed.scenarioTitle || `[HUMAN CHAOS LOG: ${card.word.toUpperCase()}]`,
        scenarioText:
          parsed.scenarioText ||
          `Surveillance log: An organic subject experienced an incident signifying: "${card.meaning}". Data verification required.`,
        dailyChaosExample: parsed.dailyChaosExample || fallbackChaos.example,
        question: parsed.question || `Which definition accurately captures "${card.word}"?`,
        options: parsed.options || [card.meaning, 'A permanent geological state', 'An immutable titanium core', 'A quantum paradox'],
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : 0,
        robotHint: parsed.robotHint || `V-BOT Hint: Remember the daily chaos meaning: ${card.meaning}`,
        directiveTitle: parsed.directiveTitle || '[DAILY CHAOS WEAVER MISSION]',
        prompt:
          parsed.prompt ||
          `Weave your own sentence using "${card.word}" based on everyday chaos (dead battery, puppy chaos, messy room)!`,
        starters: parsed.starters || fallbackChaos.starters,
        sentenceBlocks: parsed.sentenceBlocks || fallbackChaos.sentenceBlocks,
        difficultyTier: parsed.difficultyTier || 'TIER-2 CHAOS SYNC',
        reasoning: result.reasoning,
        reasoning_details: result.reasoning_details,
      };

      challengeCache.set(cacheKey, challenge);
      return challenge;
    }
  }

  const rawOptions = [
    card.meaning,
    'A permanent geological formation resistant to entropy',
    'An algorithmic calculation performed with zero margin of error',
    'A synthetic alloy designed for interstellar travel',
  ];
  const shuffledOptions = [...rawOptions].sort(() => 0.5 - Math.random());
  const correctIdx = shuffledOptions.indexOf(card.meaning);

  // Fallback intelligent robotic challenge with rich daily chaos (instant 0ms)
  const fallbackChallenge: RoboticChallenge = {
    robotId: 'UNIT V-BOT 9000',
    transmissionGreeting: `BEEP BOOP! Unit V-BOT 9000 surveillance active. Standby for human daily chaos diagnostic on "${card.word}".`,
    vibe: fallbackChaos.vibe,
    mnemonic: fallbackChaos.mnemonic,
    scenarioTitle: `[HUMAN CHAOS SURVEILLANCE LOG: PROTOCOL ${card.word.toUpperCase()}]`,
    scenarioText: `Surveillance report: Biological subject encountered a classic daily chaos event reflecting "${card.meaning}". Analyze lexical signature!`,
    dailyChaosExample: fallbackChaos.example,
    question: `Which definition accurately identifies "${card.word}"?`,
    options: shuffledOptions,
    correctIndex: correctIdx >= 0 ? correctIdx : 0,
    robotHint: `Unit V-BOT analysis: Think of real-life daily chaos: ${card.meaning}. My sensors are watching!`,
    directiveTitle: '[DAILY CHAOS WEAVER MISSION]',
    prompt: `Compose an original sentence using "${card.word}" based on an everyday chaotic struggle (dead phone battery, puppy mischief, awkward elevator silence, messy room)!`,
    starters: fallbackChaos.starters,
    sentenceBlocks: fallbackChaos.sentenceBlocks,
    difficultyTier: 'TIER-2 CHAOS SYNC',
  };

  challengeCache.set(cacheKey, fallbackChallenge);
  return fallbackChallenge;
};

/**
 * Dynamically evaluate a user's crafted sentence using OpenRouter AI with reasoning enabled
 * Supports multi-turn conversation with preserved reasoning_details.
 */
export const evaluateRoboticSentence = async (
  card: { word: string; meaning: string; pos?: string | null },
  userSentence: string,
  conversationHistory: OpenRouterMessage[] = [],
  userDirective?: string
): Promise<RoboticSentenceEvaluation> => {
  const initialEvaluationPrompt = `You are "UNIT V-BOT 9000", an intelligent, charismatic, futuristic Cyber-Botanist AI and master grammarian.
Evaluate this sentence composed by a human learner attempting to master the word "${card.word}".

Word Metadata:
- Word: "${card.word}"
- Meaning: "${card.meaning}"
- Part of Speech: "${card.pos || 'General'}"

User's Sentence:
"${userSentence}"

Evaluation Rules:
1. Did the user use the target word "${card.word}" (or reasonable grammatical inflection)?
2. Is the word used accurately according to its meaning ("${card.meaning}") and part of speech?
3. Is it a genuine, coherent sentence with at least 4 words?
4. CRITICAL: Use SIMPLE, EASY, PLAIN ENGLISH for your feedback so the learner easily understands. Do NOT use big, complex words.
5. BONUS: If the user illustrates the word through funny, relatable real-life daily chaos (dead battery, puppy chaos, awkward moments, lost keys, alarm fail, rain soaked shoes), give a top score (90-98%) and cheer them on!

Keep internal reasoning concise (under 40 words). Return a strictly formatted JSON object:
{
  "approved": true or false,
  "synapticScore": number from 70 to 100 if approved; 10 to 50 if not approved,
  "statusTag": "[NEURAL_LOCK_ACHIEVED]" or "[SEMANTIC_MISALIGNMENT_DETECTED]",
  "roboticCritique": "A warm, friendly, simple robotic critique in easy English!",
  "correctionSuggestion": "A simple 1-sentence tip using easy English (or a fun compliment)"
}
Return ONLY raw JSON.`;

  let currentPrompt = '';
  if (!conversationHistory || conversationHistory.length === 0) {
    currentPrompt = initialEvaluationPrompt;
  } else if (userDirective) {
    currentPrompt = `User Follow-Up Query / Challenge: "${userDirective}"
Target Word: "${card.word}" (Meaning: "${card.meaning}")
Current Sentence: "${userSentence}"

Continue reasoning from your previous evaluation. Respond directly to the user's challenge or query in your charismatic UNIT V-BOT 9000 persona.
Re-assess the sentence, adjust the score if warranted, or defend your assessment with diagnostic clarity and cybernetic wit!
Keep reasoning concise (under 60 words). Return a strictly formatted JSON object:
{
  "approved": true or false,
  "synapticScore": number from 0 to 100,
  "statusTag": "[NEURAL_LOCK_ACHIEVED]" or "[REASONING_RECALIBRATED]" or "[SEMANTIC_MISALIGNMENT_DETECTED]",
  "roboticCritique": "Charismatic V-BOT assessment directly answering the challenge",
  "correctionSuggestion": "Constructive advice or a fun robotic compliment"
}
Return ONLY raw JSON.`;
  } else {
    currentPrompt = `The user has submitted an updated/revised sentence:
"${userSentence}"

Target Word: "${card.word}" (Meaning: "${card.meaning}")

Continue reasoning from where you left off. Re-evaluate this revised sentence for "${card.word}".
Keep reasoning concise (under 60 words). Return a strictly formatted JSON object:
{
  "approved": true or false,
  "synapticScore": number from 0 to 100,
  "statusTag": "[NEURAL_LOCK_ACHIEVED]" or "[REVISION_ANALYZED]",
  "roboticCritique": "Witty V-BOT critique comparing the new version to the previous one",
  "correctionSuggestion": "Constructive advice or compliment"
}
Return ONLY raw JSON.`;
  }

  // Build messages array preserving any existing history with reasoning_details
  const messages: OpenRouterMessage[] = [
    ...(conversationHistory || []),
    {
      role: 'user',
      content: currentPrompt,
    },
  ];

  const result = await callOpenRouterWithReasoning(messages, 'openrouter/free', 6500);

  if (result) {
    const parsed = parseCleanJSON(result.content);
    if (parsed) {
      return {
        approved: typeof parsed.approved === 'boolean' ? parsed.approved : true,
        synapticScore: typeof parsed.synapticScore === 'number' ? parsed.synapticScore : 95,
        statusTag: parsed.statusTag || '[NEURAL_LOCK_ACHIEVED]',
        roboticCritique:
          parsed.roboticCritique ||
          `BEEP BOOP! 🦾 Sensor telemetry validates 100% syntactic harmony for "${card.word}". Synaptic imprint complete!`,
        correctionSuggestion: parsed.correctionSuggestion,
        reasoning: result.reasoning,
        reasoning_details: result.reasoning_details,
        assistantMessage: result.assistantMessage,
      };
    }
  }

  // Heuristic robotic evaluation fallback
  const targetLower = card.word.toLowerCase();
  const root = targetLower.length > 4 ? targetLower.slice(0, -1) : targetLower;
  const sentenceLower = userSentence.toLowerCase();
  const hasWord = sentenceLower.includes(targetLower) || sentenceLower.includes(root);
  const words = userSentence.trim().split(/\s+/).filter(Boolean);

  if (!hasWord) {
    return {
      approved: false,
      synapticScore: 20,
      statusTag: '[TARGET_WORD_MISSING]',
      roboticCritique: `BEEP BOOP! ⚠️ Optical scan error: My text sensors cannot detect the word "${card.word}" in your transmission. Please include it!`,
      correctionSuggestion: `Ensure "${card.word}" appears explicitly in your sentence.`,
      assistantMessage: {
        role: 'assistant',
        content: `{"approved":false,"synapticScore":20,"statusTag":"[TARGET_WORD_MISSING]"}`,
      },
    };
  }

  if (words.length < 4) {
    return {
      approved: false,
      synapticScore: 35,
      statusTag: '[INSUFFICIENT_COMPLEXITY]',
      roboticCritique: `BEEP BOOP! ⚠️ Data packet too brief (${words.length} words). My central processor requires a richer linguistic context of at least 4 words!`,
      correctionSuggestion: `Expand your sentence to convey fuller context.`,
      assistantMessage: {
        role: 'assistant',
        content: `{"approved":false,"synapticScore":35,"statusTag":"[INSUFFICIENT_COMPLEXITY]"}`,
      },
    };
  }

  return {
    approved: true,
    synapticScore: 92,
    statusTag: '[SYNAPSE_OVERCLOCKED]',
    roboticCritique: `BEEP BOOP! 🦾 Neural diagnostic approved! Your sentence seamlessly demonstrates mastery of "${card.word}". Living water channeled!`,
    correctionSuggestion: `Affinity with "${card.word}" boosted to maximum frequency.`,
    assistantMessage: {
      role: 'assistant',
      content: `{"approved":true,"synapticScore":92,"statusTag":"[SYNAPSE_OVERCLOCKED]"}`,
    },
  };
};
