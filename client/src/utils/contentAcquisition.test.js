import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentAcquisitionPayload, splitCsvValues, summarizeContentAcquisitionResult } from './contentAcquisition.js';

test('splitCsvValues keeps unique trimmed values', () => {
  assert.deepEqual(splitCsvValues(' travel, daily_conversation, travel , '), ['travel', 'daily_conversation']);
});

test('buildContentAcquisitionPayload keeps the form lightweight and profile-backed', () => {
  const payload = buildContentAcquisitionPayload({
    formState: {
      studyQuery: ' beginner Japanese listening ',
      language: '',
      level: '',
      preferredTopics: 'travel, food',
      preferredRegister: 'casual'
    },
    user: {
      language: 'Japanese',
      level: 'beginner',
      goals: ['listening', 'speaking']
    }
  });

  assert.deepEqual(payload, {
    studyQuery: 'beginner Japanese listening',
    language: 'Japanese',
    level: 'beginner',
    preferredTopics: ['travel', 'food'],
    preferredRegister: ['casual'],
    goals: ['listening', 'speaking'],
    limit: 4
  });
});

test('summarizeContentAcquisitionResult returns ready-now messaging for promotable items', () => {
  const summary = summarizeContentAcquisitionResult({
    createdCount: 2,
    reusedCount: 1,
    candidates: [
      { recommendationEligible: true, contentId: '1' },
      { recommendationEligible: false, contentId: '2' },
      { recommendationEligible: true, contentId: '3' }
    ]
  });

  assert.equal(summary.tone, 'success');
  assert.equal(summary.title, '2 items are ready to practice');
  assert.equal(summary.facts[0], '2 ready now');
});

test('summarizeContentAcquisitionResult returns calm empty messaging when nothing usable was added', () => {
  const summary = summarizeContentAcquisitionResult({
    sourcedCount: 0,
    candidates: []
  });

  assert.equal(summary.title, 'No matching content was added');
  assert.equal(summary.summary, 'Try a broader study query or a less specific topic.');
});
