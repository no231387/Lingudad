const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const LearningContent = require('../models/LearningContent');
const { STARTER_CONTENT_ITEMS, STARTER_CONTENT_SEED_SOURCE } = require('../seed/starterContentData');

dotenv.config();

const normalizeText = (value) => String(value || '').trim();

const buildYouTubeUrls = (videoId) => ({
  sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
  embedUrl: `https://www.youtube.com/embed/${videoId}`,
  thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
});

const buildStarterContentPayload = (item) => {
  const youtubeUrls = buildYouTubeUrls(item.sourceId);

  return {
    title: normalizeText(item.title),
    description: '',
    language: normalizeText(item.language),
    contentType: 'youtube',
    sourceType: normalizeText(item.sourceType || 'video'),
    visibility: 'global',
    discoverySource: 'community_seed',
    recommendationEligible: true,
    isSystemContent: true,
    isCurated: true,
    seedSource: STARTER_CONTENT_SEED_SOURCE,
    curationStatus: 'seeded_reviewed_basic',
    trustLevel: 'content_source',
    sourceProvider: normalizeText(item.sourceProvider),
    sourceId: normalizeText(item.sourceId),
    externalId: normalizeText(item.sourceId),
    url: youtubeUrls.sourceUrl,
    sourceUrl: youtubeUrls.sourceUrl,
    embedUrl: youtubeUrls.embedUrl,
    thumbnail: youtubeUrls.thumbnail,
    thumbnailUrl: youtubeUrls.thumbnail,
    topicTags: Array.isArray(item.topicTags) ? item.topicTags : [],
    registerTags: Array.isArray(item.registerTags) ? item.registerTags : [],
    skillTags: Array.isArray(item.skillTags) ? item.skillTags : [],
    difficulty: normalizeText(item.difficulty),
    transcriptStatus: normalizeText(item.transcriptStatus || 'manual_ready'),
    transcriptSource: normalizeText(item.transcriptSource || 'manual'),
    transcriptAvailable: false,
    transcript: '',
    linkedVocabularyIds: [],
    linkedSentenceIds: [],
    learningSource: true,
    metadata: {
      seededBy: STARTER_CONTENT_SEED_SOURCE,
      transcriptWorkflow: 'manual_ready'
    },
    provenance: {
      ingestionMethod: 'seed',
      sourceCapturedAt: new Date(),
      sourceSnapshotTitle: normalizeText(item.title),
      sourceSnapshotUrl: youtubeUrls.sourceUrl,
      notes: 'Starter curated system content. Raw content and future transcripts are not trusted truth by default.'
    },
    createdBy: null,
    savedBy: []
  };
};

const upsertStarterContent = async () => {
  const summary = { created: 0, updated: 0 };

  for (const item of STARTER_CONTENT_ITEMS) {
    const filter = {
      visibility: 'global',
      sourceProvider: normalizeText(item.sourceProvider),
      $or: [{ sourceId: normalizeText(item.sourceId) }, { externalId: normalizeText(item.sourceId) }]
    };
    const payload = buildStarterContentPayload(item);
    const existing = await LearningContent.findOne(filter).lean();

    await LearningContent.findOneAndUpdate(filter, payload, {
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

const seedStarterContent = async () => {
  try {
    await connectDB();
    const summary = await upsertStarterContent();

    console.log(
      JSON.stringify(
        {
          seedSource: STARTER_CONTENT_SEED_SOURCE,
          summary,
          totalSeedItems: STARTER_CONTENT_ITEMS.length
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Starter content seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedStarterContent();
