const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables, CONTENT_VISIBILITY } = require('../services/contentService');

test('shared content query filters include language and text search without applying scope', () => {
  const filters = __testables.applySharedContentQueryFilters(
    { $or: [{ visibility: CONTENT_VISIBILITY.COMMUNITY }] },
    { language: 'Japanese', q: 'travel' },
    { _id: 'user-1' }
  );

  assert.deepEqual(filters.language, { $in: ['Japanese', 'ja'] });
  assert.equal(Array.isArray(filters.$and), true);
  assert.equal(filters.$and.length, 1);
  assert.equal(filters.visibility, undefined);
});

test('scoped content filters narrow the shared filter set for the selected tab', () => {
  const communityFilters = __testables.applyScopedContentFilters({}, { scope: 'community' }, { _id: 'user-1' });
  const uploadsFilters = __testables.applyScopedContentFilters({}, { scope: 'my_uploads' }, { _id: 'user-1' });

  assert.deepEqual(communityFilters.visibility, { $in: ['community', 'global'] });
  assert.equal(uploadsFilters.visibility, 'private');
  assert.equal(uploadsFilters.createdBy, 'user-1');
});

test('content summary counts only the filtered inventory and includes legacy recommendation-ready starter items', () => {
  const items = [
    { visibility: 'global', contentType: 'youtube', recommendationEligible: true, savedBy: [], createdBy: null },
    { visibility: 'global', contentType: 'youtube', recommendationEligible: undefined, isCurated: true, isSystemContent: true, savedBy: [], createdBy: null },
    { visibility: 'private', contentType: 'uploaded', recommendationEligible: false, savedBy: ['user-1'], createdBy: 'user-1' }
  ];

  const summary = __testables.buildContentSummary({ items, userId: 'user-1' });

  assert.deepEqual(summary, {
    totalVisible: 3,
    communityCount: 2,
    myUploadsCount: 1,
    savedCount: 1,
    recommendationReadyCount: 2
  });
});
