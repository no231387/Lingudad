const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables } = require('../services/contentRecommendationService');

const createFindQuery = (items) => ({
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return Promise.resolve(items);
  }
});

const createStudySessionQuery = (items) => ({
  select() {
    return Promise.resolve(items);
  }
});

const buildService = ({ contentItems = [], practicedSessions = [], preset = null, now = () => new Date('2026-04-18T12:00:00Z').getTime() } = {}) =>
  __testables.createContentRecommendationService({
    LearningContentModel: {
      find() {
        return createFindQuery(contentItems);
      }
    },
    StudySessionModel: {
      find() {
        return createStudySessionQuery(practicedSessions);
      }
    },
    getPresetByIdFn: async () => preset,
    serializeContentFn: (item) => ({ _id: String(item._id), title: item.title, visibility: item.visibility }),
    now
  });

const buildContent = (overrides = {}) => ({
  _id: overrides._id || 'content-1',
  title: overrides.title || 'Starter lesson',
  sourceProvider: overrides.sourceProvider || 'youtube',
  sourceId: overrides.sourceId || `src-${overrides._id || '1'}`,
  visibility: overrides.visibility || 'global',
  recommendationEligible: overrides.recommendationEligible ?? true,
  transcriptStatus: overrides.transcriptStatus || 'manual_ready',
  transcriptAvailable: overrides.transcriptAvailable ?? false,
  linkedVocabularyIds: overrides.linkedVocabularyIds || [],
  linkedSentenceIds: overrides.linkedSentenceIds || [],
  trustLevel: overrides.trustLevel || 'content_source',
  workspaceType: overrides.workspaceType || 'base',
  isCurated: overrides.isCurated ?? true,
  isSystemContent: overrides.isSystemContent ?? true,
  topicTags: overrides.topicTags || ['daily_conversation'],
  registerTags: overrides.registerTags || ['mixed'],
  skillTags: overrides.skillTags || ['listening'],
  difficulty: overrides.difficulty || 'beginner',
  embedUrl: overrides.embedUrl || 'https://www.youtube.com/embed/test',
  sourceUrl: overrides.sourceUrl || 'https://www.youtube.com/watch?v=test',
  savedBy: overrides.savedBy || [],
  createdAt: overrides.createdAt || new Date('2026-04-10T12:00:00Z')
});

const buildUser = (overrides = {}) => ({
  _id: overrides._id || 'user-1',
  language: overrides.language || 'Japanese',
  level: overrides.level || 'beginner',
  goals: overrides.goals || ['listening'],
  preferredTopics: overrides.preferredTopics || [],
  preferredRegister: overrides.preferredRegister || []
});

test('cold-start user gets non-empty recommendations when usable content exists', async () => {
  const service = buildService({
    contentItems: [
      buildContent({ _id: 'starter-1', title: 'Starter A' }),
      buildContent({ _id: 'starter-2', title: 'Starter B', topicTags: ['travel'] })
    ]
  });

  const result = await service.getRecommendedContent({
    user: buildUser({ goals: [], preferredTopics: [], preferredRegister: [] }),
    query: { limit: 2 }
  });

  assert.equal(result.items.length, 2);
  assert.equal(result.meta.isColdStart, true);
  assert.equal(result.meta.fallbackTierUsed, __testables.FALLBACK_TIERS.STARTER);
  assert.equal(result.meta.source, 'server_recommendation');
});

test('private and recommendation-ineligible content are excluded', async () => {
  const service = buildService({
    contentItems: [
      buildContent({ _id: 'good-1', title: 'Usable public item' }),
      buildContent({ _id: 'private-1', visibility: 'private' }),
      buildContent({ _id: 'ineligible-1', recommendationEligible: false }),
      buildContent({ _id: 'failed-1', trustLevel: 'failed' })
    ]
  });

  const result = await service.getRecommendedContent({
    user: buildUser(),
    query: { limit: 5 }
  });

  assert.deepEqual(
    result.items.map((item) => item._id),
    ['good-1']
  );
});

test('bad query values do not crash and fall back to sane defaults', async () => {
  const service = buildService({
    contentItems: [
      buildContent({ _id: 'one' }),
      buildContent({ _id: 'two' }),
      buildContent({ _id: 'three' }),
      buildContent({ _id: 'four' }),
      buildContent({ _id: 'five' })
    ],
    preset: null
  });

  const result = await service.getRecommendedContent({
    user: buildUser(),
    query: { limit: 'not-a-number', preset: 'bad-preset', debug: 'nope' }
  });

  assert.equal(result.items.length, 4);
  assert.equal(result.meta.totalCandidatesConsidered >= 4, true);
});

test('debug mode adds recommendationDebug but normal mode does not', async () => {
  const contentItems = [buildContent({ _id: 'debug-1' })];
  const service = buildService({ contentItems });

  const normalResult = await service.getRecommendedContent({
    user: buildUser(),
    query: {}
  });
  const debugResult = await service.getRecommendedContent({
    user: buildUser(),
    query: { debug: 'true' }
  });

  assert.equal(Object.hasOwn(normalResult.items[0], 'recommendationDebug'), false);
  assert.equal(Object.hasOwn(debugResult.items[0], 'recommendationDebug'), true);
});
