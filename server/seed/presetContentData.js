const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('../services/sourceCatalogService');

const CURATED_VOCABULARY = Object.freeze([
  {
    language: 'Japanese',
    term: 'やあ',
    reading: 'やあ',
    meanings: ['hey'],
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-casual-yaa'
  },
  {
    language: 'Japanese',
    term: 'じゃあね',
    reading: 'じゃあね',
    meanings: ['see you'],
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-casual-jaane'
  },
  {
    language: 'Japanese',
    term: 'ありがとう',
    reading: 'ありがとう',
    meanings: ['thanks'],
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-casual-arigatou'
  },
  {
    language: 'Japanese',
    term: 'こんにちは',
    reading: 'こんにちは',
    meanings: ['hello'],
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-polite-konnichiwa'
  },
  {
    language: 'Japanese',
    term: 'ありがとうございます',
    reading: 'ありがとうございます',
    meanings: ['thank you'],
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-polite-arigatou-gozaimasu'
  },
  {
    language: 'Japanese',
    term: '失礼します',
    reading: 'しつれいします',
    meanings: ['excuse me'],
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-polite-shitsurei-shimasu'
  },
  {
    language: 'Japanese',
    term: 'お世話になっております',
    reading: 'おせわになっております',
    meanings: ['thank you for your continued support'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary', 'reading'],
    difficulty: 'advanced',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-keigo-osewani-natteorimasu'
  },
  {
    language: 'Japanese',
    term: '申し訳ございません',
    reading: 'もうしわけございません',
    meanings: ['I sincerely apologize'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary', 'reading'],
    difficulty: 'advanced',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-keigo-moushiwake-gozaimasen'
  },
  {
    language: 'Japanese',
    term: 'よろしくお願いいたします',
    reading: 'よろしくおねがいいたします',
    meanings: ['Thank you in advance for your consideration.'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary', 'reading'],
    difficulty: 'advanced',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-vocab-keigo-yoroshiku-onegai-itashimasu'
  }
]);

const CURATED_SENTENCES = Object.freeze([
  {
    language: 'Japanese',
    text: '元気？',
    translations: [{ language: 'English', text: 'How are you?' }],
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-casual-genki'
  },
  {
    language: 'Japanese',
    text: 'またね！',
    translations: [{ language: 'English', text: 'See you later!' }],
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-casual-matane'
  },
  {
    language: 'Japanese',
    text: 'お元気ですか？',
    translations: [{ language: 'English', text: 'How are you?' }],
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-polite-ogenki-desuka'
  },
  {
    language: 'Japanese',
    text: 'またお会いしましょう。',
    translations: [{ language: 'English', text: 'Let’s meet again.' }],
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking'],
    difficulty: 'beginner',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-polite-mata-oai-shimashou'
  },
  {
    language: 'Japanese',
    text: 'お世話になっております。',
    translations: [{ language: 'English', text: 'Thank you for your continued support.' }],
    registerTags: ['keigo'],
    skillTags: ['reading', 'workplace'],
    difficulty: 'advanced',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-keigo-osewani-natteorimasu'
  },
  {
    language: 'Japanese',
    text: 'よろしくお願いいたします。',
    translations: [{ language: 'English', text: 'Thank you in advance for your consideration.' }],
    registerTags: ['keigo'],
    skillTags: ['reading', 'workplace'],
    difficulty: 'advanced',
    sourceProvider: SOURCE_PROVIDERS.LINGUA_CURATED,
    sourceType: SOURCE_TYPES.SHARED_SEED,
    sourceId: 'preset-sentence-keigo-yoroshiku-onegai-itashimasu'
  }
]);

const LEGACY_PRESET_TEST_VOCABULARY_IDS = Object.freeze([
  'preset-test-vocab-yaa',
  'preset-test-vocab-jaane',
  'preset-test-vocab-arigatou',
  'preset-test-vocab-konnichiwa',
  'preset-test-vocab-arigatou-gozaimasu',
  'preset-test-vocab-shitsurei-shimasu',
  'preset-test-vocab-osewa',
  'preset-test-vocab-arigatou-formal',
  'preset-test-vocab-moushiwake'
]);

const LEGACY_PRESET_TEST_SENTENCE_IDS = Object.freeze([
  'preset-test-sentence-genki',
  'preset-test-sentence-matane',
  'preset-test-sentence-ogenki',
  'preset-test-sentence-mataoaishimashou',
  'preset-test-sentence-osewa',
  'preset-test-sentence-yoroshiku'
]);

module.exports = {
  CURATED_SENTENCES,
  CURATED_VOCABULARY,
  LEGACY_PRESET_TEST_SENTENCE_IDS,
  LEGACY_PRESET_TEST_VOCABULARY_IDS
};
