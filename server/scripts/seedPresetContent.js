const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Vocabulary = require('../models/Vocabulary');
const Sentence = require('../models/Sentence');
const {
  CURATED_SENTENCES,
  CURATED_VOCABULARY,
  LEGACY_PRESET_TEST_SENTENCE_IDS,
  LEGACY_PRESET_TEST_VOCABULARY_IDS
} = require('../seed/presetContentData');
const { SOURCE_PROVIDERS } = require('../services/sourceCatalogService');

dotenv.config();

const upsertVocabularyEntries = async () => {
  const summary = { created: 0, updated: 0 };

  for (const entry of CURATED_VOCABULARY) {
    const filter = {
      language: entry.language,
      sourceProvider: entry.sourceProvider,
      sourceId: entry.sourceId
    };
    const existing = await Vocabulary.findOne(filter).lean();

    await Vocabulary.findOneAndUpdate(filter, entry, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });

    if (existing) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }
  }

  return summary;
};

const upsertSentenceEntries = async () => {
  const summary = { created: 0, updated: 0 };

  for (const entry of CURATED_SENTENCES) {
    const filter = {
      language: entry.language,
      sourceProvider: entry.sourceProvider,
      sourceId: entry.sourceId
    };
    const existing = await Sentence.findOne(filter).lean();

    await Sentence.findOneAndUpdate(filter, entry, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });

    if (existing) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }
  }

  return summary;
};

const cleanupLegacyPresetTestData = async () => {
  const [vocabularyResult, sentenceResult] = await Promise.all([
    Vocabulary.deleteMany({
      sourceProvider: SOURCE_PROVIDERS.USER,
      sourceId: { $in: LEGACY_PRESET_TEST_VOCABULARY_IDS }
    }),
    Sentence.deleteMany({
      sourceProvider: SOURCE_PROVIDERS.USER,
      sourceId: { $in: LEGACY_PRESET_TEST_SENTENCE_IDS }
    })
  ]);

  return {
    removedVocabulary: vocabularyResult.deletedCount || 0,
    removedSentences: sentenceResult.deletedCount || 0
  };
};

const seedPresetContent = async () => {
  try {
    await connectDB();

    const cleanupSummary = await cleanupLegacyPresetTestData();
    const vocabularySummary = await upsertVocabularyEntries();
    const sentenceSummary = await upsertSentenceEntries();

    console.log(
      JSON.stringify(
        {
          cleanupSummary,
          vocabularySummary,
          sentenceSummary,
          totals: {
            curatedVocabulary: CURATED_VOCABULARY.length,
            curatedSentences: CURATED_SENTENCES.length
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Preset content seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedPresetContent();
