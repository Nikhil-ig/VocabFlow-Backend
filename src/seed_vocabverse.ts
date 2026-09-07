import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WORLDS = [
  {
    slug: 'everyday-realm',
    name: 'Everyday Realm',
    description: 'Essential conversational fluency, social idioms, and daily interactions.',
    icon: 'compass',
    themeColor: '#10b981',
    order: 1,
  },
  {
    slug: 'business-citadel',
    name: 'Business Citadel',
    description: 'Corporate diplomacy, strategic negotiation, finance, and boardroom leadership.',
    icon: 'briefcase',
    themeColor: '#3b82f6',
    order: 2,
  },
  {
    slug: 'academic-nexus',
    name: 'Academic Nexus',
    description: 'Scholarly discourse, GRE/TOEFL vocabulary, cognitive frameworks, and analytical prose.',
    icon: 'book-open',
    themeColor: '#8b5cf6',
    order: 3,
  },
  {
    slug: 'tech-frontier',
    name: 'Tech Frontier',
    description: 'Artificial intelligence, system architectures, engineering paradigms, and cyber concepts.',
    icon: 'cpu',
    themeColor: '#06b6d4',
    order: 4,
  },
  {
    slug: 'literary-wilds',
    name: 'Literary Wilds',
    description: 'Evocative imagery, archaic elegance, poetic devices, and classical rhetoric.',
    icon: 'feather',
    themeColor: '#f59e0b',
    order: 5,
  },
];

const ACHIEVEMENTS = [
  {
    code: 'FIRST_STEP',
    title: 'First Step into the Cosmos',
    description: 'Discovered your first vocabulary word in VocabVerse.',
    category: 'WORDS',
    icon: 'compass',
    xpReward: 50,
  },
  {
    code: 'WORD_COLLECTOR_10',
    title: 'Codex Gatherer',
    description: 'Collected 10 distinct words in your WordDex.',
    category: 'WORDS',
    icon: 'book',
    xpReward: 100,
  },
  {
    code: 'WORD_COLLECTOR_25',
    title: 'Lexical Hoarder',
    description: 'Discovered 25 vocabulary cards across the worlds.',
    category: 'WORDS',
    icon: 'gem',
    xpReward: 250,
  },
  {
    code: 'GARDEN_SPROUT',
    title: 'Green Thumb of Wisdom',
    description: 'Planted your very first mastered word in the Vocabulary Garden.',
    category: 'GARDEN',
    icon: 'sprout',
    xpReward: 100,
  },
  {
    code: 'GARDEN_BLOOM_3',
    title: 'Botanical Sanctuary',
    description: 'Nurtured 3 words into vibrant blooming plants.',
    category: 'GARDEN',
    icon: 'flower',
    xpReward: 200,
  },
  {
    code: 'STREAK_3',
    title: 'Kindled Flame',
    description: 'Maintained a 3-day continuous learning streak.',
    category: 'STREAK',
    icon: 'flame',
    xpReward: 150,
  },
  {
    code: 'STREAK_7',
    title: 'Inferno of Discipline',
    description: 'Maintained a 7-day unbroken learning streak.',
    category: 'STREAK',
    icon: 'zap',
    xpReward: 300,
  },
  {
    code: 'QUIZ_ACE',
    title: 'Flawless Mind',
    description: 'Achieved a perfect 100% score on a vocabulary quiz.',
    category: 'QUIZ',
    icon: 'crown',
    xpReward: 150,
  },
];

const CURATED_WORDS = [
  // Everyday Realm
  {
    word: 'Serendipity',
    meaning: 'The occurrence of events by chance in a happy or beneficial way.',
    example: 'Finding a $20 bill in my old jeans when I had zero money was pure serendipity.',
    pos: 'noun',
    pronunciation: '/ˌser.ənˈdɪp.ə.ti/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'everyday-realm',
    mood: 'uplifting',
    connotation: 'positive',
  },
  {
    word: 'Resilience',
    meaning: 'The capacity to recover quickly from difficulties; mental toughness.',
    example: "It takes real resilience to smile after accidentally calling your teacher 'Mom' in class.",
    pos: 'noun',
    pronunciation: '/rɪˈzɪl.jəns/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'everyday-realm',
    mood: 'empowering',
    connotation: 'positive',
  },
  {
    word: 'Ephemeral',
    meaning: 'Lasting for a very short time; fleeting or momentary.',
    example: 'My phone battery was at 100%, but it was ephemeral—it died after two minutes in the cold.',
    pos: 'adjective',
    pronunciation: '/ɪˈfem.ər.əl/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'everyday-realm',
    mood: 'reflective',
    connotation: 'neutral',
  },
  {
    word: 'Ubiquitous',
    meaning: 'Present, appearing, or found everywhere simultaneously.',
    example: 'Tangled charger cables are ubiquitous—they are in every drawer in my house.',
    pos: 'adjective',
    pronunciation: '/juːˈbɪk.wə.təs/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'everyday-realm',
    mood: 'analytical',
    connotation: 'neutral',
  },
  {
    word: 'Empathy',
    meaning: 'The ability to understand and share the feelings of another.',
    example: 'I felt deep empathy for the kid whose ice cream scoop fell off the cone onto the sidewalk.',
    pos: 'noun',
    pronunciation: '/ˈem.pə.θi/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'everyday-realm',
    mood: 'warm',
    connotation: 'positive',
  },

  // Business Citadel
  {
    word: 'Synergy',
    meaning: 'The interaction of elements that when combined produce a total effect greater than the sum of the individual elements.',
    example: 'A heavy rainstorm and a cozy blanket created the perfect synergy for an afternoon nap.',
    pos: 'noun',
    pronunciation: '/ˈsɪn.ə.dʒi/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'business-citadel',
    mood: 'collaborative',
    connotation: 'positive',
  },
  {
    word: 'Hegemony',
    meaning: 'Leadership or predominant influence exercised by one nation or dominant enterprise over others.',
    example: 'The company maintained its market hegemony through continuous patent acquisitions.',
    pos: 'noun',
    pronunciation: '/hɪˈdʒem.ə.ni/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'business-citadel',
    mood: 'commanding',
    connotation: 'neutral',
  },
  {
    word: 'Pragmatic',
    meaning: 'Dealing with things sensibly and realistically based on practical considerations rather than theoretical ones.',
    example: 'We adopted a pragmatic roadmap that prioritized revenue generation over perfection.',
    pos: 'adjective',
    pronunciation: '/præɡˈmæt.ɪk/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'business-citadel',
    mood: 'grounded',
    connotation: 'positive',
  },
  {
    word: 'Leverage',
    meaning: 'The power to influence a person or situation in order to achieve a desired outcome.',
    example: 'Our strong financial reserves provided immense leverage during cross-table negotiations.',
    pos: 'noun',
    pronunciation: '/ˈliː.vər.ɪdʒ/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'business-citadel',
    mood: 'strategic',
    connotation: 'positive',
  },
  {
    word: 'Disruption',
    meaning: 'Radical change in an industry or market caused by technological innovation.',
    example: 'Cloud computing brought seismic disruption to traditional data centers.',
    pos: 'noun',
    pronunciation: '/dɪsˈrʌp.ʃən/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'business-citadel',
    mood: 'bold',
    connotation: 'neutral',
  },

  // Academic Nexus
  {
    word: 'Epistemology',
    meaning: 'The philosophical theory of knowledge, investigating what distinguishes justified belief from opinion.',
    example: 'His thesis explored how algorithmic curation influences modern epistemological assumptions.',
    pos: 'noun',
    pronunciation: '/ɪˌpɪs.təˈmɒl.ə.dʒi/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'academic-nexus',
    mood: 'intellectual',
    connotation: 'neutral',
  },
  {
    word: 'Paradigm',
    meaning: 'A distinct set of concepts or thought patterns, including theories, research methods, and standards for what constitutes legitimate contributions.',
    example: 'Quantum computing represents a fundamental paradigm shift in computational complexity.',
    pos: 'noun',
    pronunciation: '/ˈpær.ə.daɪm/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'academic-nexus',
    mood: 'philosophical',
    connotation: 'positive',
  },
  {
    word: 'Juxtaposition',
    meaning: 'The fact of two things being seen or placed close together with contrasting effect.',
    example: 'The juxtaposition of ancient stone columns beside glass skyscrapers creates striking visual tension.',
    pos: 'noun',
    pronunciation: '/ˌdʒʌk.stə.pəˈzɪʃ.ən/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'academic-nexus',
    mood: 'analytical',
    connotation: 'neutral',
  },
  {
    word: 'Empirical',
    meaning: 'Based on, concerned with, or verifiable by observation or experience rather than theory or pure logic.',
    example: 'The peer review requested additional empirical evidence before approving the publication.',
    pos: 'adjective',
    pronunciation: '/ɪmˈpɪr.ɪ.kəl/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'academic-nexus',
    mood: 'scientific',
    connotation: 'positive',
  },
  {
    word: 'Dichotomy',
    meaning: 'A division or contrast between two things that are or are represented as being opposed or entirely different.',
    example: 'The paper dismantles the false dichotomy between economic prosperity and environmental stewardship.',
    pos: 'noun',
    pronunciation: '/daɪˈkɒt.ə.mi/',
    difficulty: 'ADVANCED',
    rarity: 'RARE',
    worldSlug: 'academic-nexus',
    mood: 'scholarly',
    connotation: 'neutral',
  },

  // Tech Frontier
  {
    word: 'Heuristic',
    meaning: 'Enabling a person or algorithm to discover or learn something for themselves through practical approximation.',
    example: 'The navigation engine uses A* search with an admissible heuristic to plot optimal paths.',
    pos: 'adjective',
    pronunciation: '/hjʊəˈrɪs.tɪk/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'tech-frontier',
    mood: 'ingenious',
    connotation: 'positive',
  },
  {
    word: 'Deterministic',
    meaning: 'Relating to an algorithm or process that always produces the exact same output given a specific initial state.',
    example: 'Cryptographic hash functions must be strictly deterministic across all computing architectures.',
    pos: 'adjective',
    pronunciation: '/dɪˌtɜː.mɪˈnɪs.tɪk/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'tech-frontier',
    mood: 'precise',
    connotation: 'neutral',
  },
  {
    word: 'Idempotent',
    meaning: 'Denoting an operation that can be applied multiple times without changing the result beyond the initial application.',
    example: 'HTTP PUT requests should be strictly idempotent to prevent unintended data duplication.',
    pos: 'adjective',
    pronunciation: '/ˌaɪ.dəmˈpəʊ.tənt/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'tech-frontier',
    mood: 'technical',
    connotation: 'positive',
  },
  {
    word: 'Latency',
    meaning: 'The delay before a transfer of data begins following an instruction for its transfer.',
    example: 'Edge CDN caching drastically lowered round-trip latency for global users.',
    pos: 'noun',
    pronunciation: '/ˈleɪ.tən.si/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'tech-frontier',
    mood: 'metric',
    connotation: 'neutral',
  },
  {
    word: 'Abstraction',
    meaning: 'The process of removing unnecessary details to focus on essential core behaviors and interfaces.',
    example: 'A clean software abstraction shields developers from low-level memory allocation intricacies.',
    pos: 'noun',
    pronunciation: '/æbˈstræk.ʃən/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'tech-frontier',
    mood: 'architectural',
    connotation: 'positive',
  },

  // Literary Wilds
  {
    word: 'Halcyon',
    meaning: 'Denoting a period of time in the past that was idyllically happy and peaceful.',
    example: 'He nostalgically recalled the halcyon days of youth spent wandering coastal meadows.',
    pos: 'adjective',
    pronunciation: '/ˈhæl.si.ən/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'literary-wilds',
    mood: 'poetic',
    connotation: 'positive',
  },
  {
    word: 'Petrichor',
    meaning: 'A pleasant, distinctive smell that frequently accompanies the first rain after a long period of warm, dry weather.',
    example: 'The rich petrichor rose from the forest floor as gentle droplets broke the summer drought.',
    pos: 'noun',
    pronunciation: '/ˈpet.rɪ.kɔːr/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'literary-wilds',
    mood: 'sensory',
    connotation: 'positive',
  },
  {
    word: 'Mellifluous',
    meaning: 'Pleasingly smooth and musical to hear; flowing sweetly.',
    example: 'Her mellifluous voice captivated the audience from the opening stanza.',
    pos: 'adjective',
    pronunciation: '/meˈlɪf.lu.əs/',
    difficulty: 'ADVANCED',
    rarity: 'RARE',
    worldSlug: 'literary-wilds',
    mood: 'harmonious',
    connotation: 'positive',
  },
  {
    word: 'Labyrinthine',
    meaning: 'Irregular and twisting; intricate and confusing like a maze.',
    example: 'The old quarter was a labyrinthine network of cobblestone alleyways and shadowy archways.',
    pos: 'adjective',
    pronunciation: '/ˌlæb.əˈrɪn.θaɪn/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'literary-wilds',
    mood: 'mysterious',
    connotation: 'neutral',
  },
  {
    word: 'Ineffable',
    meaning: 'Too great, beautiful, or sacred to be expressed or described in words.',
    example: 'Standing atop the misty alpine summit, he felt an ineffable sense of wonder.',
    pos: 'adjective',
    pronunciation: '/ɪnˈef.ə.bəl/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'literary-wilds',
    mood: 'sublime',
    connotation: 'positive',
  },

  // Additional Everyday Realm
  {
    word: 'Catharsis',
    meaning: 'The process of releasing and thereby providing relief from strong or repressed emotions.',
    example: 'Writing poetry provided a necessary emotional catharsis during difficult times.',
    pos: 'noun',
    pronunciation: '/kəˈθɑː.sɪs/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'everyday-realm',
    mood: 'healing',
    connotation: 'positive',
  },
  {
    word: 'Eloquent',
    meaning: 'Fluent or persuasive in speaking or writing; clearly expressing ideas.',
    example: 'Her eloquent defense of civic liberty moved the entire assembly to applause.',
    pos: 'adjective',
    pronunciation: '/ˈel.ə.kwənt/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'everyday-realm',
    mood: 'persuasive',
    connotation: 'positive',
  },
  {
    word: 'Euphoria',
    meaning: 'A feeling or state of intense excitement and happiness.',
    example: 'The team erupted in euphoria when their spacecraft touched down successfully.',
    pos: 'noun',
    pronunciation: '/juːˈfɔː.ri.ə/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'everyday-realm',
    mood: 'joyful',
    connotation: 'positive',
  },
  {
    word: 'Quintessential',
    meaning: 'Representing the most perfect or typical example of a quality or class.',
    example: 'A warm fireplace and hot cider is the quintessential winter sanctuary.',
    pos: 'adjective',
    pronunciation: '/ˌkwɪn.tɪˈsen.ʃəl/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'everyday-realm',
    mood: 'archetypal',
    connotation: 'positive',
  },
  {
    word: 'Tenacious',
    meaning: 'Tending to keep a firm hold of something; clinging or adhering closely; persistent.',
    example: 'Her tenacious pursuit of the truth uncovered decades of hidden records.',
    pos: 'adjective',
    pronunciation: '/təˈneɪ.ʃəs/',
    difficulty: 'INTERMEDIATE',
    rarity: 'COMMON',
    worldSlug: 'everyday-realm',
    mood: 'determined',
    connotation: 'positive',
  },

  // Additional Business Citadel
  {
    word: 'Acumen',
    meaning: 'The ability to make good judgments and quick decisions, typically in a particular domain.',
    example: 'His sharp financial acumen steered the startup through volatile market quarters.',
    pos: 'noun',
    pronunciation: '/ˈæk.jə.mən/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'business-citadel',
    mood: 'shrewd',
    connotation: 'positive',
  },
  {
    word: 'Solvency',
    meaning: 'The ability to pay all financial debts; the possession of assets exceeding liabilities.',
    example: 'Prudent cash flow controls guaranteed long-term institutional solvency.',
    pos: 'noun',
    pronunciation: '/ˈsɒl.vən.si/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'business-citadel',
    mood: 'stable',
    connotation: 'positive',
  },
  {
    word: 'Fiduciary',
    meaning: 'Involving trust, especially with regard to the relationship between a trustee and a beneficiary.',
    example: 'Directors bear a sacred fiduciary duty to protect shareholder capital.',
    pos: 'adjective',
    pronunciation: '/fɪˈdjuː.ʃi.ə.ri/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'business-citadel',
    mood: 'legal',
    connotation: 'neutral',
  },
  {
    word: 'Arbitrage',
    meaning: 'The simultaneous buying and selling of securities or commodities in different markets to profit from unequal prices.',
    example: 'High-frequency algorithmic trading exploits tiny cross-exchange arbitrage windows.',
    pos: 'noun',
    pronunciation: '/ˈɑː.bɪ.trɑːʒ/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'business-citadel',
    mood: 'lucrative',
    connotation: 'neutral',
  },
  {
    word: 'Benchmark',
    meaning: 'A standard or point of reference against which things may be compared or assessed.',
    example: 'Our Q3 performance became the industry benchmark for client retention.',
    pos: 'noun',
    pronunciation: '/ˈbentʃ.mɑːk/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'business-citadel',
    mood: 'comparative',
    connotation: 'neutral',
  },

  // Additional Academic Nexus
  {
    word: 'Hermeneutics',
    meaning: 'The theory and methodology of interpretation, especially the interpretation of scriptural, legal, or literary texts.',
    example: 'Post-structural hermeneutics explores how historical biases shape linguistic meaning.',
    pos: 'noun',
    pronunciation: '/ˌhɜː.məˈnjuː.tɪks/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'academic-nexus',
    mood: 'philosophical',
    connotation: 'neutral',
  },
  {
    word: 'Dialectic',
    meaning: 'The art of investigating or discussing the truth of opinions through reasoned back-and-forth arguments.',
    example: 'Socratic dialectic interrogates underlying assumptions to unmask core truths.',
    pos: 'noun',
    pronunciation: '/ˌdaɪ.əˈlek.tɪk/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'academic-nexus',
    mood: 'deliberative',
    connotation: 'positive',
  },
  {
    word: 'Anachronism',
    meaning: 'A thing belonging or appropriate to a period other than that in which it exists, especially a thing that is conspicuously old-fashioned.',
    example: 'Using a wax seal on an encrypted email was a charming anachronism.',
    pos: 'noun',
    pronunciation: '/əˈnæk.rə.nɪ.zəm/',
    difficulty: 'ADVANCED',
    rarity: 'RARE',
    worldSlug: 'academic-nexus',
    mood: 'historical',
    connotation: 'neutral',
  },
  {
    word: 'Pernicious',
    meaning: 'Having a harmful effect, especially in a gradual or subtle way.',
    example: 'Confirmation bias exerts a pernicious influence on scientific inquiry if left unchecked.',
    pos: 'adjective',
    pronunciation: '/pəˈnɪʃ.əs/',
    difficulty: 'ADVANCED',
    rarity: 'RARE',
    worldSlug: 'academic-nexus',
    mood: 'critical',
    connotation: 'negative',
  },
  {
    word: 'Syllogism',
    meaning: 'An instance of a form of reasoning in which a conclusion is drawn from two given or assumed propositions.',
    example: 'All mortals die; humans are mortal; therefore humans die is a classic syllogism.',
    pos: 'noun',
    pronunciation: '/ˈsɪl.ə.dʒɪ.zəm/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'academic-nexus',
    mood: 'logical',
    connotation: 'neutral',
  },

  // Additional Tech Frontier
  {
    word: 'Polymorphism',
    meaning: 'The provision of a single interface to entities of different types or the ability of different classes to respond to the same message.',
    example: 'Object-oriented polymorphism allows payment processors to share a uniform checkout interface.',
    pos: 'noun',
    pronunciation: '/ˌpɒl.iˈmɔː.fɪ.zəm/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'tech-frontier',
    mood: 'computational',
    connotation: 'positive',
  },
  {
    word: 'Throughput',
    meaning: 'The amount of material or data passing through a system or process per unit time.',
    example: 'Optimizing database connection pooling increased transaction throughput by 400%.',
    pos: 'noun',
    pronunciation: '/ˈθruː.pʊt/',
    difficulty: 'BEGINNER',
    rarity: 'COMMON',
    worldSlug: 'tech-frontier',
    mood: 'performance',
    connotation: 'positive',
  },
  {
    word: 'Consensus',
    meaning: 'A general agreement reached by autonomous nodes in a distributed computational network.',
    example: 'Raft consensus ensures consistent state replication even across network partitions.',
    pos: 'noun',
    pronunciation: '/kənˈsen.səs/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'tech-frontier',
    mood: 'collaborative',
    connotation: 'positive',
  },
  {
    word: 'Asynchronous',
    meaning: 'Not occurring at the same time; computing processes that operate independently without blocking.',
    example: 'Asynchronous event queues keep user interfaces responsive during heavy background jobs.',
    pos: 'adjective',
    pronunciation: '/eɪˈsɪŋ.krə.nəs/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'tech-frontier',
    mood: 'concurrent',
    connotation: 'positive',
  },
  {
    word: 'Fault-tolerant',
    meaning: 'Enabling a system to continue operating properly in the event of the failure of one or more of its components.',
    example: 'Geographically dispersed clusters provide fault-tolerant disaster recovery.',
    pos: 'adjective',
    pronunciation: '/ˌfɒltˈtɒl.ər.ənt/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'tech-frontier',
    mood: 'resilient',
    connotation: 'positive',
  },

  // Additional Literary Wilds
  {
    word: 'Susurrus',
    meaning: 'Whispering, murmuring, or rustling sound.',
    example: 'The gentle susurrus of willow leaves brought calm to the twilight meadow.',
    pos: 'noun',
    pronunciation: '/səˈsʌr.əs/',
    difficulty: 'ADVANCED',
    rarity: 'LEGENDARY',
    worldSlug: 'literary-wilds',
    mood: 'lyrical',
    connotation: 'positive',
  },
  {
    word: 'Chiaroscuro',
    meaning: 'The treatment of light and shade in drawing and painting, or stark contrast in prose.',
    example: 'The novel masterfully balanced tragic sorrow and radiant humor in rich literary chiaroscuro.',
    pos: 'noun',
    pronunciation: '/kiˌɑː.rəˈskjʊə.rəʊ/',
    difficulty: 'ADVANCED',
    rarity: 'EPIC',
    worldSlug: 'literary-wilds',
    mood: 'artistic',
    connotation: 'positive',
  },
  {
    word: 'Limerence',
    meaning: 'The state of being infatuated or obsessed with another person, typically involuntarily.',
    example: 'His youthful sonnets vividly captured the torment and ecstasies of limerence.',
    pos: 'noun',
    pronunciation: '/ˈlɪm.ər.əns/',
    difficulty: 'ADVANCED',
    rarity: 'RARE',
    worldSlug: 'literary-wilds',
    mood: 'romantic',
    connotation: 'neutral',
  },
  {
    word: 'Soliloquy',
    meaning: 'An act of speaking one\'s thoughts aloud when by oneself or regardless of any hearers, especially by a character in a play.',
    example: 'Hamlet\'s contemplative soliloquy probes the deepest enigmas of human existence.',
    pos: 'noun',
    pronunciation: '/səˈlɪl.ə.kwi/',
    difficulty: 'INTERMEDIATE',
    rarity: 'UNCOMMON',
    worldSlug: 'literary-wilds',
    mood: 'dramatic',
    connotation: 'neutral',
  },
  {
    word: 'Panacea',
    meaning: 'A solution or remedy for all difficulties or diseases; a cure-all.',
    example: 'Technology is a powerful accelerator, but it is not a panacea for systemic inequality.',
    pos: 'noun',
    pronunciation: '/ˌpæn.əˈsiː.ə/',
    difficulty: 'INTERMEDIATE',
    rarity: 'RARE',
    worldSlug: 'literary-wilds',
    mood: 'idealistic',
    connotation: 'neutral',
  },
];

async function seed() {
  console.log('🌟 Starting VocabVerse Universe Seeding...');

  // 1. Seed Worlds
  for (const w of WORLDS) {
    await prisma.vocabWorld.upsert({
      where: { slug: w.slug },
      update: w,
      create: w,
    });
  }
  console.log(`✅ Seeded ${WORLDS.length} Themed Worlds`);

  // 2. Seed Achievements
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: a,
      create: a,
    });
  }
  console.log(`✅ Seeded ${ACHIEVEMENTS.length} Achievements`);

  // 3. Find or Create Default Admin / Test User
  let admin = await prisma.user.findFirst({
    where: { email: 'test@test.com' },
  });

  if (!admin) {
    const hashedPassword = await bcrypt.hash('password123', 12);
    admin = await prisma.user.create({
      data: {
        name: 'Nikhil (Explorer)',
        displayName: 'Nikhil',
        email: 'test@test.com',
        password: hashedPassword,
        role: 'ADMIN',
        avatar: 'explorer',
        xp: 2350,
        level: 5,
        onboardingComplete: true,
      },
    });
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        displayName: admin.displayName || 'Nikhil',
        avatar: admin.avatar || 'explorer',
        xp: Math.max(admin.xp, 2350),
        level: Math.max(admin.level, 5),
        onboardingComplete: true,
      },
    });
  }

  // Ensure Admin Profile & Streak
  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {
      englishLevel: 'ADVANCED',
      dailyGoalMinutes: 20,
      targetWordsPerDay: 5,
      preferredWorld: 'everyday-realm',
    },
    create: {
      userId: admin.id,
      nativeLanguage: 'en',
      englishLevel: 'ADVANCED',
      dailyGoalMinutes: 20,
      targetWordsPerDay: 5,
      preferredWorld: 'everyday-realm',
    },
  });

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  await prisma.userStreak.upsert({
    where: { userId: admin.id },
    update: {
      currentStreak: 12,
      longestStreak: 14,
      lastActiveDate: todayStr,
    },
    create: {
      userId: admin.id,
      currentStreak: 12,
      longestStreak: 14,
      lastActiveDate: todayStr,
    },
  });

  // 4. Seed Curated Vocabulary Cards
  const createdCards = [];
  for (const cardData of CURATED_WORDS) {
    const existing = await prisma.vocabularyCard.findFirst({
      where: { word: cardData.word },
    });

    if (existing) {
      const updated = await prisma.vocabularyCard.update({
        where: { id: existing.id },
        data: cardData,
      });
      createdCards.push(updated);
    } else {
      const created = await prisma.vocabularyCard.create({
        data: {
          ...cardData,
          userId: admin.id,
          status: 'LEARNING',
        },
      });
      createdCards.push(created);
    }
  }
  console.log(`✅ Seeded ${createdCards.length} Curated Vocabulary Cards`);

  // Also distribute worldSlug and rarity for any cards missing them
  const unassignedCards = await prisma.vocabularyCard.findMany({
    where: {
      OR: [
        { worldSlug: null },
        { rarity: null },
      ],
    },
  });

  const worldSlugs = ['everyday-realm', 'business-citadel', 'academic-nexus', 'tech-frontier', 'literary-wilds'];
  const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

  for (let idx = 0; idx < unassignedCards.length; idx++) {
    const c = unassignedCards[idx];
    await prisma.vocabularyCard.update({
      where: { id: c.id },
      data: {
        worldSlug: c.worldSlug || worldSlugs[idx % worldSlugs.length],
        rarity: c.rarity || rarities[idx % rarities.length],
      },
    });
  }

  // 5. Populate gamification data for ALL users in DB
  const allUsers = await prisma.user.findMany();
  const plantTypes = ['BONSAI', 'CRYSTAL_TREE', 'ORCHID', 'GOLDEN_OAK'];
  const plantSlots = [6, 7, 11, 12];

  for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
    const usr = allUsers[uIdx];

    const targetXP = usr.role === 'ADMIN' ? 2450 : 1200 + uIdx * 350;
    const targetLevel = usr.role === 'ADMIN' ? 5 : 3 + uIdx;

    await prisma.user.update({
      where: { id: usr.id },
      data: {
        displayName: usr.displayName || usr.name || (usr.email ? usr.email.split('@')[0] : 'Explorer'),
        avatar: usr.avatar || (uIdx === 0 ? 'explorer' : uIdx === 1 ? 'scholar' : 'wizard'),
        xp: Math.max(usr.xp, targetXP),
        level: Math.max(usr.level, targetLevel),
        onboardingComplete: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: usr.id },
      update: {
        englishLevel: 'ADVANCED',
        dailyGoalMinutes: 15,
        targetWordsPerDay: 5,
        preferredWorld: worldSlugs[uIdx % worldSlugs.length],
      },
      create: {
        userId: usr.id,
        nativeLanguage: 'en',
        englishLevel: 'ADVANCED',
        dailyGoalMinutes: 15,
        targetWordsPerDay: 5,
        preferredWorld: worldSlugs[uIdx % worldSlugs.length],
      },
    });

    await prisma.userStreak.upsert({
      where: { userId: usr.id },
      update: {
        currentStreak: 7 + uIdx * 3,
        longestStreak: 10 + uIdx * 4,
        lastActiveDate: todayStr,
      },
      create: {
        userId: usr.id,
        currentStreak: 7 + uIdx * 3,
        longestStreak: 10 + uIdx * 4,
        lastActiveDate: todayStr,
      },
    });

    // Seed WordDex & Mastery
    for (let i = 0; i < Math.min(22, createdCards.length); i++) {
      const card = createdCards[i];
      await prisma.wordDexEntry.upsert({
        where: {
          userId_cardId: {
            userId: usr.id,
            cardId: card.id,
          },
        },
        update: { favorite: i % 3 === 0 },
        create: {
          userId: usr.id,
          cardId: card.id,
          rarity: card.rarity || 'COMMON',
          favorite: i % 3 === 0,
        },
      });

      const stage = i < 5 ? 'MASTERED' : i < 12 ? 'LEARNED' : 'FAMILIAR';
      const stageLevel = i < 5 ? 5 : i < 12 ? 4 : 2;
      await prisma.wordMastery.upsert({
        where: {
          userId_cardId: {
            userId: usr.id,
            cardId: card.id,
          },
        },
        update: {
          stage,
          stageLevel,
          timesReviewed: 5 + i,
          timesCorrect: 4 + i,
        },
        create: {
          userId: usr.id,
          cardId: card.id,
          stage,
          stageLevel,
          timesReviewed: 5 + i,
          timesCorrect: 4 + i,
          nextReviewDue: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    // Seed Garden Plots
    const masteredCards = createdCards.slice(0, 4);
    for (let i = 0; i < masteredCards.length; i++) {
      await prisma.gardenPlot.upsert({
        where: {
          userId_slotIndex: {
            userId: usr.id,
            slotIndex: plantSlots[i],
          },
        },
        update: {
          plantType: plantTypes[i],
          growthStage: 3 + (i % 2),
          health: 95,
        },
        create: {
          userId: usr.id,
          cardId: masteredCards[i].id,
          slotIndex: plantSlots[i],
          plantType: plantTypes[i],
          growthStage: 3 + (i % 2),
          health: 95,
          wateredAt: new Date(),
        },
      });
    }

    // Unlock achievement
    const firstAchievement = await prisma.achievement.findFirst({
      where: { code: 'FIRST_STEP' },
    });
    if (firstAchievement) {
      await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId: usr.id,
            achievementId: firstAchievement.id,
          },
        },
        update: {},
        create: {
          userId: usr.id,
          achievementId: firstAchievement.id,
        },
      });
    }
  }

  // 6. Seed initial Daily Quests
  const defaultQuests = [
    {
      title: 'Word Discovery',
      description: 'Discover or collect 5 new vocabulary words',
      type: 'LEARN_WORDS',
      targetCount: 5,
      xpReward: 50,
      icon: 'book',
    },
    {
      title: 'Mind Sharpener',
      description: 'Complete 10 vocabulary flashcard reviews',
      type: 'REVIEW_WORDS',
      targetCount: 10,
      xpReward: 40,
      icon: 'brain',
    },
    {
      title: 'Quiz Champion',
      description: 'Score 80% or higher on any quiz',
      type: 'QUIZ_SCORE',
      targetCount: 1,
      xpReward: 80,
      icon: 'trophy',
    },
    {
      title: 'Daily Dedication',
      description: 'Maintain your learning streak today',
      type: 'STREAK_MAINTAIN',
      targetCount: 1,
      xpReward: 30,
      icon: 'flame',
    },
  ];

  for (const q of defaultQuests) {
    const existingQ = await prisma.dailyQuest.findFirst({
      where: { title: q.title },
    });
    if (!existingQ) {
      await prisma.dailyQuest.create({ data: q });
    }
  }

  console.log('🚀 VocabVerse Universe fully populated with rich seed data!');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
