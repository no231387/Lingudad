import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecommendationItems, normalizeRecommendationResponse } from './recommendationResponse.js';

test('normalizes the recommended content response shape with items and meta', () => {
  const payload = {
    items: [{ _id: 'content-1' }],
    meta: { isColdStart: true, source: 'server_recommendation' }
  };

  assert.deepEqual(normalizeRecommendationResponse(payload), payload);
});

test('falls back safely when the recommendation response is a legacy array', () => {
  const payload = [{ _id: 'content-2' }];

  assert.deepEqual(normalizeRecommendationResponse(payload), {
    items: payload,
    meta: null
  });
});

test('drops malformed recommendation fields without throwing', () => {
  assert.deepEqual(normalizeRecommendationResponse({ items: 'wrong', meta: 'wrong' }), {
    items: [],
    meta: null
  });

  assert.deepEqual(normalizeRecommendationItems(undefined), []);
});
