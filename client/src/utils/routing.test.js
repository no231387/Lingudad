import test from 'node:test';
import assert from 'node:assert/strict';
import { getPostLoginRedirect } from './routing.js';

test('returns the default dashboard route when no prior route exists', () => {
  assert.equal(getPostLoginRedirect(undefined), '/');
  assert.equal(getPostLoginRedirect({}), '/');
});

test('preserves the intended pathname, query string, and hash after login', () => {
  assert.equal(
    getPostLoginRedirect({
      from: {
        pathname: '/study',
        search: '?deck=abc123',
        hash: '#current'
      }
    }),
    '/study?deck=abc123#current'
  );
});

test('falls back safely when the prior route shape is invalid', () => {
  assert.equal(getPostLoginRedirect({ from: { pathname: 'study' } }), '/');
  assert.equal(getPostLoginRedirect({ from: { pathname: null } }), '/');
});
