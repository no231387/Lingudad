const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Vocabulary = require('../models/Vocabulary');
const Sentence = require('../models/Sentence');
const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('../services/sourceCatalogService');

dotenv.config();

const vocabularySeedData = [
  {
    term: 'やあ',
    reading: 'やあ',
    meanings: ['hey'],
    registerTags: ['casual'],
    skillTags: ['vocabulary'],
    difficulty: 'beginner',
    sourceId: 'preset-test-vocab-yaa'
  },
  {
    term: 'じゃあね',
    reading: 'じゃあね',
    meanings: ['see you'],
    registerTags: ['casual'],
    skillTags: ['vocabulary'],
    difficulty: 'beginner',
    sourceId: 'preset-test-vocab-jaane'
  },
  {
    term: 'ありがとう',
    reading: 'ありがとう',
    meanings: ['thanks'],
    registerTags: ['casual'],
    skillTags: ['vocabulary'],
    difficulty: 'beginner',
    sourceId: 'preset-test-vocab-arigatou'
  },
  {
    term: 'こんにちは',
    reading: 'こんにちは',
    meanings: ['hello'],
    registerTags: ['polite'],
    skillTags: ['vocabulary'],
    difficulty: 'beginner',
    sourceId: 'preset-test-vocab-konnichiwa'
  },
  {
    term: 'ありがとうございます',
    reading: 'ありがとうございます',
    meanings: ['thank you'],
    registerTags: ['polite'],
    skillTags: ['vocabulary'],
    difficulty: 'beginner',
    sourceId: 'preset-test-vocab-arigatou-gozaimasu'
  },
  {
    term: '失礼します',
    reading: 'しつれいします',
    meanings: ['excuse me'],
    registerTags: ['polite'],
    skillTags: ['vocabulary'],
    difficulty: 'intermediate',
    sourceId: 'preset-test-vocab-shitsurei-shimasu'
  },
  {
    term: 'お世話になっております',
    reading: 'おせわになっております',
    meanings: ['thank you for your continued support'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary'],
    difficulty: 'advanced',
    sourceId: 'preset-test-vocab-osewa'
  },
  {
    term: 'ありがとうございます（formal context）',
    reading: 'ありがとうございます',
    meanings: ['thank you (formal context)'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary'],
    difficulty: 'intermediate',
    sourceId: 'preset-test-vocab-arigatou-formal'
  },
  {
    term: '申し訳ございません',
    reading: 'もうしわけございません',
    meanings: ['I sincerely apologize'],
    registerTags: ['keigo'],
    skillTags: ['vocabulary'],
    difficulty: 'advanced',
    sourceId: 'preset-test-vocab-moushiwake'
  }
];

const sentenceSeedData = [
  {
    text: '元気？',
    translations: [{ language: 'English', text: 'How are you?' }],
    registerTags: ['casual'],
    skillTags: ['listening'],
    difficulty: 'beginner',
    sourceId: 'preset-test-sentence-genki'
  },
  {
    text: 'またね！',
    translations: [{ language: 'English', text: 'See you later!' }],
    registerTags: ['casual'],
    skillTags: ['listening'],
    difficulty: 'beginner',
    sourceId: 'preset-test-sentence-matane'
  },
  {
    text: 'お元気ですか？',
    translations: [{ language: 'English', text: 'How are you?' }],
    registerTags: ['polite'],
    skillTags: ['reading'],
    difficulty: 'beginner',
    sourceId: 'preset-test-sentence-ogenki'
  },
  {
    text: 'またお会いしましょう。',
    translations: [{ language: 'English', text: 'Let’s meet again.' }],
    registerTags: ['polite'],
    skillTags: ['reading'],
    difficulty: 'intermediate',
    sourceId: 'preset-test-sentence-mataoaishimashou'
  },
  {
    text: 'お世話になっております。',
    translations: [{ language: 'English', text: 'Thank you for your continued support.' }],
    registerTags: ['keigo'],
    skillTags: ['reading'],
    difficulty: 'advanced',
    sourceId: 'preset-test-sentence-osewa'
  },
  {
    text: 'よろしくお願いいたします。',
    translations: [{ language: 'English', text: 'Thank you in advance for your consideration.' }],
    registerTags: ['keigo'],
    skillTags: ['reading'],
    difficulty: 'advanced',
    sourceId: 'preset-test-sentence-yoroshiku'
  }
];

const buildVocabularyPayload = (entry) => ({
  language: 'Japanese',
  term: entry.term,
  reading: entry.reading,
  meanings: entry.meanings,
  registerTags: entry.registerTags,
  skillTags: entry.skillTags,
  difficulty: entry.difficulty,
  sourceProvider: SOURCE_PROVIDERS.USER,
  sourceType: SOURCE_TYPES.DICTIONARY,
  sourceId: entry.sourceId
});

const buildSentencePayload = (entry) => ({
  language: 'Japanese',
  text: entry.text,
  translations: entry.translations,
  registerTags: entry.registerTags,
  skillTags: entry.skillTags,
  difficulty: entry.difficulty,
  sourceProvider: SOURCE_PROVIDERS.USER,
  sourceType: SOURCE_TYPES.SENTENCE,
  sourceId: entry.sourceId
});

const seedTestPresetData = async () => {
  try {
    await connectDB();

    for (const entry of vocabularySeedData) {
      await Vocabulary.findOneAndUpdate(
        { language: 'Japanese', sourceProvider: SOURCE_PROVIDERS.USER, sourceId: entry.sourceId },
        buildVocabularyPayload(entry),
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    for (const entry of sentenceSeedData) {
      await Sentence.findOneAndUpdate(
        { language: 'Japanese', sourceProvider: SOURCE_PROVIDERS.USER, sourceId: entry.sourceId },
        buildSentencePayload(entry),
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log(`Preset test seed complete: ${vocabularySeedData.length} vocabulary items, ${sentenceSeedData.length} sentence items.`);
  } catch (error) {
    console.error('Preset test seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedTestPresetData();
