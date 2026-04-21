const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../services/youtubeTranscriptProviderService');

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

test('resolves YouTube video ids across content field variants', async () => {
  const { __testables } = require('../services/youtubeTranscriptProviderService');

  assert.equal(
    __testables.resolveYoutubeVideoIdFromContent({ sourceUrl: 'https://www.youtube.com/watch?v=abc12345678' }),
    'abc12345678'
  );
  assert.equal(
    __testables.resolveYoutubeVideoIdFromContent({ embedUrl: 'https://www.youtube.com/embed/xyz98765432' }),
    'xyz98765432'
  );
});

test('fails clearly when no usable YouTube id can be resolved', async () => {
  const { __testables } = require('../services/youtubeTranscriptProviderService');

  assert.throws(
    () => __testables.resolveYoutubeVideoIdFromContent({ sourceId: '', sourceUrl: '', embedUrl: '' }),
    /No usable YouTube video id/
  );
});

test('normalizes timed provider transcript responses', async () => {
  const { __testables } = require('../services/youtubeTranscriptProviderService');

  const segments = __testables.normalizeTranscriptSegments({
    segments: [
      { text: 'こんにちは', start: 1, duration: 2 },
      { text: 'ありがとう', startTimeSeconds: 5, endTimeSeconds: 7 }
    ]
  });

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: 1,
      endTimeSeconds: 3,
      rawText: 'こんにちは',
      confidence: undefined
    },
    {
      segmentOrder: 1,
      startTimeSeconds: 5,
      endTimeSeconds: 7,
      rawText: 'ありがとう',
      confidence: undefined
    }
  ]);
});

test('normalizes plain-text provider transcript responses without inventing timing', async () => {
  const { __testables } = require('../services/youtubeTranscriptProviderService');

  const segments = __testables.normalizeTranscriptSegments({
    transcriptText: 'line one\nline two'
  });

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: 'line one',
      confidence: undefined
    },
    {
      segmentOrder: 1,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: 'line two',
      confidence: undefined
    }
  ]);
});

test('fetches and normalizes transcript segments from the configured provider', async () => {
  const originalUrl = process.env.YOUTUBE_TRANSCRIPT_API_URL;
  const originalKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;
  delete require.cache[servicePath];
  process.env.YOUTUBE_TRANSCRIPT_API_URL = 'https://transcripts.example.com/fetch';
  process.env.YOUTUBE_TRANSCRIPT_API_KEY = 'secret';
  const { fetchTranscriptFromProvider } = require('../services/youtubeTranscriptProviderService');

  let requestedUrl = '';
  const result = await fetchTranscriptFromProvider({
    content: { sourceId: 'abc12345678' },
    fetchFn: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers['x-api-key'], 'secret');

      return buildFetchResponse({
        payload: {
          language: 'ja',
          segments: [{ text: 'こんにちは', start: 0, duration: 2 }]
        }
      });
    }
  });

  assert.equal(requestedUrl.includes('videoId=abc12345678'), true);
  assert.equal(result.segmentCount, 1);
  assert.equal(result.transcriptSource, 'youtube_caption');

  process.env.YOUTUBE_TRANSCRIPT_API_URL = originalUrl;
  process.env.YOUTUBE_TRANSCRIPT_API_KEY = originalKey;
  delete require.cache[servicePath];
});

test('fails safely when the provider returns no usable transcript', async () => {
  const originalUrl = process.env.YOUTUBE_TRANSCRIPT_API_URL;
  delete require.cache[servicePath];
  process.env.YOUTUBE_TRANSCRIPT_API_URL = 'https://transcripts.example.com/fetch';
  const { fetchTranscriptFromProvider } = require('../services/youtubeTranscriptProviderService');

  await assert.rejects(
    () =>
      fetchTranscriptFromProvider({
        content: { sourceId: 'abc12345678' },
        fetchFn: async () =>
          buildFetchResponse({
            payload: { segments: [] }
          })
      }),
    /no usable transcript segments/i
  );

  process.env.YOUTUBE_TRANSCRIPT_API_URL = originalUrl;
  delete require.cache[servicePath];
});
