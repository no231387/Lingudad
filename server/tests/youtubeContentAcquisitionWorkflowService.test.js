const test = require('node:test');
const assert = require('node:assert/strict');

const { createYoutubeContentAcquisitionWorkflowService } = require('../services/youtubeContentAcquisitionWorkflowService');

const buildUser = (overrides = {}) => ({
  _id: overrides._id || 'user-1',
  username: overrides.username || 'reviewer',
  language: overrides.language || 'Japanese',
  level: overrides.level || 'beginner'
});

const buildCandidate = (overrides = {}) => ({
  contentId: overrides.contentId || 'content-1',
  title: overrides.title || 'Candidate video',
  sourceId: overrides.sourceId || 'video-1',
  relevanceScore: overrides.relevanceScore ?? 12,
  sourcingReasons: overrides.sourcingReasons || ['explicit_query_match'],
  sourcingQuery: overrides.sourcingQuery || 'beginner Japanese listening practice',
  created: overrides.created ?? true,
  persistenceStatus: overrides.persistenceStatus || (overrides.created === false ? 'reused' : 'created')
});

const buildContentDoc = (overrides = {}) => ({
  _id: overrides._id || 'content-1',
  title: overrides.title || 'Candidate video',
  sourceId: overrides.sourceId || 'video-1',
  externalId: overrides.externalId || overrides.sourceId || 'video-1',
  curationStatus: overrides.curationStatus || 'candidate_sourced_pending_review',
  recommendationEligible: overrides.recommendationEligible ?? false,
  transcriptSource: overrides.transcriptSource || 'none',
  metadata: overrides.metadata || {},
  saveCalls: 0,
  async save() {
    this.saveCalls += 1;
    return this;
  }
});

test('orchestrates mixed source-and-promote outcomes without loosening eligibility', async () => {
  const docs = {
    'content-1': buildContentDoc({ _id: 'content-1', sourceId: 'video-1' }),
    'content-2': buildContentDoc({ _id: 'content-2', sourceId: 'video-2' }),
    'content-3': buildContentDoc({
      _id: 'content-3',
      sourceId: 'video-3',
      curationStatus: 'ready_to_practice',
      recommendationEligible: true,
      transcriptSource: 'youtube_caption',
      metadata: {
        readiness: {
          outcome: 'ready_to_practice',
          segmentCount: 4,
          linkedSegmentCount: 2,
          linkedVocabularyCount: 3,
          linkedSentenceCount: 1,
          transcriptSource: 'youtube_caption'
        }
      }
    })
  };
  const service = createYoutubeContentAcquisitionWorkflowService({
    sourceYoutubeCandidatesFn: async () => ({
      items: [
        buildCandidate({ contentId: 'content-1', sourceId: 'video-1', title: 'Promotable item', created: true }),
        buildCandidate({
          contentId: 'content-2',
          sourceId: 'video-2',
          title: 'Transcript failed item',
          created: true,
          relevanceScore: 8,
          sourcingReasons: ['topic_match']
        }),
        buildCandidate({
          contentId: 'content-3',
          sourceId: 'video-3',
          title: 'Already promoted item',
          created: false,
          persistenceStatus: 'reused',
          relevanceScore: 6,
          sourcingReasons: ['register_match']
        })
      ],
      meta: {
        returnedCount: 3,
        createdCount: 2,
        reusedCount: 1,
        sourceStage: 'youtube_search',
        queries: ['beginner Japanese listening practice'],
        rawCandidateCount: 5
      }
    }),
    LearningContentModel: {
      async findById(id) {
        return docs[id] || null;
      }
    },
    promoteSourcedCandidateFn: async ({ contentId }) => {
      if (contentId === 'content-1') {
        docs['content-1'].curationStatus = 'ready_to_practice';
        docs['content-1'].recommendationEligible = true;
        docs['content-1'].transcriptSource = 'youtube_caption';

        return {
          content: {
            _id: 'content-1',
            transcriptSource: 'youtube_caption',
            curationStatus: 'ready_to_practice'
          },
          transcriptSummary: {
            segmentCount: 6,
            linkedSegmentCount: 3,
            linkedVocabularyCount: 4,
            linkedSentenceCount: 2
          },
          readinessOutcome: 'ready_to_practice',
          recommendationEligible: true
        };
      }

      docs['content-2'].curationStatus = 'transcript_failed';
      docs['content-2'].recommendationEligible = false;
      docs['content-2'].transcriptSource = 'none';

      return {
        content: {
          _id: 'content-2',
          transcriptSource: 'none',
          curationStatus: 'transcript_failed'
        },
        transcriptSummary: {
          segmentCount: 0,
          linkedSegmentCount: 0,
          linkedVocabularyCount: 0,
          linkedSentenceCount: 0
        },
        readinessOutcome: 'transcript_failed',
        recommendationEligible: false,
        error: 'No transcript segments were found for this candidate.'
      };
    },
    now: () => '2026-04-21T12:00:00.000Z'
  });

  const result = await service.sourceAndPromoteYoutubeContent({
    user: buildUser(),
    input: { studyQuery: 'station phrases', limit: 3 }
  });

  assert.equal(result.sourcedCount, 3);
  assert.equal(result.persistedCount, 3);
  assert.equal(result.createdCount, 2);
  assert.equal(result.reusedCount, 1);
  assert.equal(result.promotionAttemptedCount, 2);
  assert.equal(result.promotedCount, 2);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.persistenceStatus),
    ['created', 'created', 'reused']
  );
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.promotionStatus),
    ['ready_to_practice', 'transcript_failed', 'ready_to_practice']
  );
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.recommendationEligible),
    [true, false, true]
  );
  assert.equal(result.candidates[1].failureReason, 'No transcript segments were found for this candidate.');
  assert.equal(docs['content-1'].metadata.acquisitionWorkflow.youtubeSourceAndPromote.sourcingScore, 12);
  assert.equal(docs['content-3'].metadata.acquisitionWorkflow.youtubeSourceAndPromote.promotionAttempted, false);
});

test('duplicate reuse still attempts promotion for non-eligible sourced candidates', async () => {
  const doc = buildContentDoc({
    _id: 'content-9',
    sourceId: 'video-9',
    curationStatus: 'candidate_sourced_pending_review'
  });
  let promotionCalls = 0;
  const service = createYoutubeContentAcquisitionWorkflowService({
    sourceYoutubeCandidatesFn: async () => ({
      items: [buildCandidate({ contentId: 'content-9', sourceId: 'video-9', created: false, persistenceStatus: 'reused' })],
      meta: {
        returnedCount: 1,
        createdCount: 0,
        reusedCount: 1
      }
    }),
    LearningContentModel: {
      async findById() {
        return doc;
      }
    },
    promoteSourcedCandidateFn: async () => {
      promotionCalls += 1;
      doc.curationStatus = 'linked_partial';
      doc.recommendationEligible = false;
      doc.transcriptSource = 'youtube_caption';

      return {
        content: {
          _id: 'content-9',
          transcriptSource: 'youtube_caption',
          curationStatus: 'linked_partial'
        },
        transcriptSummary: {
          segmentCount: 3,
          linkedSegmentCount: 1,
          linkedVocabularyCount: 2,
          linkedSentenceCount: 0
        },
        readinessOutcome: 'linked_partial',
        recommendationEligible: false
      };
    }
  });

  const result = await service.sourceAndPromoteYoutubeContent({
    user: buildUser(),
    input: {}
  });

  assert.equal(promotionCalls, 1);
  assert.equal(result.reusedCount, 1);
  assert.equal(result.promotedCount, 0);
  assert.equal(result.candidates[0].persistenceStatus, 'reused');
  assert.equal(result.candidates[0].promotionStatus, 'linked_partial');
  assert.equal(result.candidates[0].recommendationEligible, false);
});

test('promotion exceptions are isolated per candidate and do not fail the batch', async () => {
  const docs = {
    'content-1': buildContentDoc({ _id: 'content-1', sourceId: 'video-1' }),
    'content-2': buildContentDoc({ _id: 'content-2', sourceId: 'video-2' })
  };
  const service = createYoutubeContentAcquisitionWorkflowService({
    sourceYoutubeCandidatesFn: async () => ({
      items: [
        buildCandidate({ contentId: 'content-1', sourceId: 'video-1' }),
        buildCandidate({ contentId: 'content-2', sourceId: 'video-2' })
      ],
      meta: { returnedCount: 2, createdCount: 2, reusedCount: 0 }
    }),
    LearningContentModel: {
      async findById(id) {
        return docs[id] || null;
      }
    },
    promoteSourcedCandidateFn: async ({ contentId }) => {
      if (contentId === 'content-1') {
        throw new Error('provider timeout');
      }

      docs['content-2'].curationStatus = 'ready_to_practice';
      docs['content-2'].recommendationEligible = true;
      docs['content-2'].transcriptSource = 'youtube_caption';

      return {
        content: {
          _id: 'content-2',
          transcriptSource: 'youtube_caption',
          curationStatus: 'ready_to_practice'
        },
        transcriptSummary: {
          segmentCount: 5,
          linkedSegmentCount: 2,
          linkedVocabularyCount: 3,
          linkedSentenceCount: 1
        },
        readinessOutcome: 'ready_to_practice',
        recommendationEligible: true
      };
    }
  });

  const result = await service.sourceAndPromoteYoutubeContent({
    user: buildUser(),
    input: {}
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].failureReason, 'provider timeout');
  assert.equal(result.candidates[0].recommendationEligible, false);
  assert.equal(result.candidates[1].recommendationEligible, true);
  assert.equal(result.promotedCount, 1);
});

test('response summary keeps explainable per-candidate fields for recommendation eligibility', async () => {
  const doc = buildContentDoc({ _id: 'content-7', sourceId: 'video-7' });
  const service = createYoutubeContentAcquisitionWorkflowService({
    sourceYoutubeCandidatesFn: async () => ({
      items: [buildCandidate({ contentId: 'content-7', sourceId: 'video-7', title: 'Threshold-sensitive item' })],
      meta: { returnedCount: 1, createdCount: 1, reusedCount: 0 }
    }),
    LearningContentModel: {
      async findById() {
        return doc;
      }
    },
    promoteSourcedCandidateFn: async () => {
      doc.curationStatus = 'pending_manual_review';
      doc.recommendationEligible = false;
      doc.transcriptSource = 'youtube_caption';

      return {
        content: {
          _id: 'content-7',
          transcriptSource: 'youtube_caption',
          curationStatus: 'pending_manual_review'
        },
        transcriptSummary: {
          segmentCount: 4,
          linkedSegmentCount: 1,
          linkedVocabularyCount: 1,
          linkedSentenceCount: 0
        },
        readinessOutcome: 'pending_manual_review',
        recommendationEligible: false
      };
    }
  });

  const result = await service.sourceAndPromoteYoutubeContent({
    user: buildUser(),
    input: {}
  });

  assert.deepEqual(result.candidates[0], {
    contentId: 'content-7',
    title: 'Threshold-sensitive item',
    youtubeId: 'video-7',
    sourcingScore: 12,
    sourcingReasons: ['explicit_query_match'],
    persistenceStatus: 'created',
    promotionAttempted: true,
    promotionStatus: 'pending_manual_review',
    recommendationEligible: false,
    transcriptSource: 'youtube_caption',
    transcriptSegmentCount: 4,
    linkedSegmentCount: 1,
    linkedVocabularyCount: 1,
    linkedSentenceCount: 0,
    readinessOutcome: 'pending_manual_review',
    failureReason: ''
  });
  assert.equal(result.promotedCount, 0);
});
