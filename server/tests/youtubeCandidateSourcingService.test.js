const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../services/youtubeCandidateSourcingService');

const buildFetchResponse = ({ ok = true, status = 200, payload = {} }) => ({
  ok,
  status,
  async json() {
    return payload;
  },
  async text() {
    return JSON.stringify(payload);
  }
});

const buildYoutubeSearchPayload = (items = []) => ({
  items: items.map((item) => ({
    id: { videoId: item.videoId },
    snippet: {
      title: item.title,
      description: item.description,
      channelTitle: item.channelTitle || 'Lingua Channel',
      channelId: item.channelId || 'channel-1',
      publishedAt: item.publishedAt || '2026-04-18T10:00:00Z',
      thumbnails: {
        high: { url: item.thumbnail || 'https://img.youtube.com/example.jpg' }
      }
    }
  }))
});

const buildUser = (overrides = {}) => ({
  _id: overrides._id || 'user-1',
  username: overrides.username || 'tester',
  language: overrides.language || 'Japanese',
  level: overrides.level || 'beginner',
  goals: overrides.goals || ['listening'],
  preferredTopics: overrides.preferredTopics || ['travel'],
  preferredRegister: overrides.preferredRegister || ['polite']
});

test('builds deterministic fallback YouTube queries from user intent', async () => {
  const { __testables } = require('../services/youtubeCandidateSourcingService');

  const intent = __testables.buildSourcingIntent({
    user: buildUser(),
    input: { studyQuery: 'station phrases' }
  });
  const queries = __testables.buildRuleBasedQueries(intent);

  assert.deepEqual(queries, [
    'station phrases Japanese',
    'beginner Japanese listening practice',
    'Japanese travel phrases listening practice',
    'Japanese polite conversation travel phrases',
    'Japanese listening practice video'
  ]);
});

test('sources normalized YouTube candidates deterministically when API results exist', async () => {
  const originalApiKey = process.env.YOUTUBE_DATA_API_KEY;
  process.env.YOUTUBE_DATA_API_KEY = 'test-key';
  delete require.cache[servicePath];
  const { createYoutubeCandidateSourcingService } = require('../services/youtubeCandidateSourcingService');

  const seenUrls = [];
  const service = createYoutubeCandidateSourcingService({
    fetchFn: async (url) => {
      seenUrls.push(url);

      return buildFetchResponse({
        payload: buildYoutubeSearchPayload([
          {
            videoId: 'vid-1',
            title: 'Beginner Japanese travel phrases listening practice',
            description: 'Polite conversation and listening practice for travel.'
          },
          {
            videoId: 'vid-2',
            title: 'Japanese cooking vlog',
            description: 'A casual day in the kitchen.'
          }
        ])
      });
    },
    now: () => '2026-04-18T12:00:00.000Z'
  });

  const result = await service.sourceYoutubeCandidates({
    user: buildUser(),
    input: { limit: 2 }
  });

  assert.equal(seenUrls.length > 0, true);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].sourceId, 'vid-1');
  assert.equal(result.items[0].relevanceScore > result.items[1].relevanceScore, true);
  assert.equal(result.meta.persisted, false);
  assert.equal(result.meta.sourcingStrategy, 'rules');

  process.env.YOUTUBE_DATA_API_KEY = originalApiKey;
  delete require.cache[servicePath];
});

test('persists sourced candidates into LearningContent with candidate-safe fields', async () => {
  const originalApiKey = process.env.YOUTUBE_DATA_API_KEY;
  process.env.YOUTUBE_DATA_API_KEY = 'test-key';
  delete require.cache[servicePath];
  const { createYoutubeCandidateSourcingService } = require('../services/youtubeCandidateSourcingService');

  const createdPayloads = [];
  const service = createYoutubeCandidateSourcingService({
    fetchFn: async () =>
      buildFetchResponse({
        payload: buildYoutubeSearchPayload([
          {
            videoId: 'vid-3',
            title: 'Beginner Japanese listening practice',
            description: 'Daily conversation for beginners.'
          }
        ])
      }),
    LearningContentModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        createdPayloads.push(payload);
        return { _id: 'content-1' };
      }
    },
    now: () => '2026-04-18T12:00:00.000Z'
  });

  const result = await service.sourceYoutubeCandidates({
    user: buildUser(),
    input: { persist: true, limit: 1 }
  });

  assert.equal(result.meta.persisted, true);
  assert.equal(result.meta.createdCount, 1);
  assert.equal(createdPayloads.length, 1);
  assert.equal(createdPayloads[0].recommendationEligible, false);
  assert.equal(createdPayloads[0].visibility, 'global');
  assert.equal(createdPayloads[0].curationStatus, 'candidate_sourced_pending_review');
  assert.equal(createdPayloads[0].metadata.sourcing.sourceStage, 'youtube_search');

  process.env.YOUTUBE_DATA_API_KEY = originalApiKey;
  delete require.cache[servicePath];
});

test('returns an empty candidate set safely when YouTube results are empty', async () => {
  const originalApiKey = process.env.YOUTUBE_DATA_API_KEY;
  process.env.YOUTUBE_DATA_API_KEY = 'test-key';
  delete require.cache[servicePath];
  const { createYoutubeCandidateSourcingService } = require('../services/youtubeCandidateSourcingService');

  const service = createYoutubeCandidateSourcingService({
    fetchFn: async () =>
      buildFetchResponse({
        payload: buildYoutubeSearchPayload([])
      }),
    now: () => '2026-04-18T12:00:00.000Z'
  });

  const result = await service.sourceYoutubeCandidates({
    user: buildUser(),
    input: { limit: 3 }
  });

  assert.deepEqual(result.items, []);
  assert.equal(result.meta.returnedCount, 0);

  process.env.YOUTUBE_DATA_API_KEY = originalApiKey;
  delete require.cache[servicePath];
});
