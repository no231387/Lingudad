import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStudyQueue } from './studySession.js';

test('requeues the current card at the end when rating is again', () => {
  const cards = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
  const result = updateStudyQueue(cards, 0, 'again');

  assert.deepEqual(
    result.cards.map((card) => card._id),
    ['b', 'c', 'a']
  );
  assert.equal(result.nextIndex, 0);
});

test('removes the current card from the queue for good/easy ratings', () => {
  const cards = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
  const result = updateStudyQueue(cards, 1, 'good');

  assert.deepEqual(
    result.cards.map((card) => card._id),
    ['a', 'c']
  );
  assert.equal(result.nextIndex, 1);
});

test('keeps a single-card again queue stable', () => {
  const cards = [{ _id: 'a' }];
  const result = updateStudyQueue(cards, 0, 'again');

  assert.deepEqual(
    result.cards.map((card) => card._id),
    ['a']
  );
  assert.equal(result.nextIndex, 0);
});
