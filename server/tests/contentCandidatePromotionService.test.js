const test = require('node:test');
const assert = require('node:assert/strict');

const { createContentCandidatePromotionService, PROMOTION_READINESS_OUTCOMES, __testables } = require('../services/contentCandidatePromotionService');

const buildContentDoc = (overrides = {}) => ({
  _id: overrides._id || 'content-1',
  title: overrides.title || 'Candidate video',
  contentType: overrides.contentType || 'youtube',
  sourceProvider: overrides.sourceProvider || 'YouTube',
  seedSource: overrides.seedSource === undefined ? 'youtube_candidate_source_v1' : overrides.seedSource,
  curationStatus: overrides.curationStatus || 'candidate_sourced_pending_review',
  recommendationEligible: overrides.recommendationEligible ?? false,
  transcriptAvailable: overrides.transcriptAvailable ?? false,
  transcriptStatus: overrides.transcriptStatus || 'none',
  sourceId: overrides.sourceId || 'video-1',
  sourceUrl: overrides.sourceUrl || 'https://www.youtube.com/watch?v=video-1',
  embedUrl: overrides.embedUrl || 'https://www.youtube.com/embed/video-1',
  metadata: overrides.metadata || {},
  saveCalls: 0,
  async save() {
    this.saveCalls += 1;
    return this;
  }
});

const buildUser = (overrides = {}) => ({
  _id: overrides._id || 'user-1',
  username: overrides.username || 'reviewer'
});

test('rejects non-sourced content items', async () => {
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => buildContentDoc({ seedSource: '', curationStatus: 'manual' })
  });

  await assert.rejects(
    () =>
      service.promoteSourcedCandidate({
        contentId: 'content-1',
        user: buildUser(),
        body: {}
      }),
    /not a promotable sourced YouTube candidate/
  );
});

test('missing transcript does not promote and records transcript_failed state', async () => {
  const contentDoc = buildContentDoc();
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    fetchFn: async () => ({
      ok: true,
      async json() {
        return { segments: [] };
      }
    }),
    now: () => '2026-04-18T12:00:00.000Z'
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: {}
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED);
  assert.equal(result.recommendationEligible, false);
  assert.equal(result.failureReason, 'transcript_provider_failed');
  assert.equal(contentDoc.curationStatus, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED);
  assert.equal(contentDoc.transcriptStatus, 'pending');
});

test('unlinked transcript stays non-promotable with transcript_ready_unlinked', async () => {
  const contentDoc = buildContentDoc();
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 5,
        linkedSentenceCount: 0,
        linkedVocabularyCount: 0,
        linkedSegmentCount: 0
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 5,
        quizCandidateCount: 0
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: '0:00 | hello\n0:05 | there' }
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_READY_UNLINKED);
  assert.equal(result.recommendationEligible, false);
  assert.equal(contentDoc.curationStatus, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_READY_UNLINKED);
  assert.equal(result.transcriptFetchSource, 'request_text');
  assert.equal(result.failureReason, '');
});

test('partially linked transcript remains non-promotable', async () => {
  const contentDoc = buildContentDoc({ transcriptStatus: 'linked', transcriptAvailable: true });
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 4,
        linkedSentenceCount: 0,
        linkedVocabularyCount: 2,
        linkedSegmentCount: 1
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 4,
        quizCandidateCount: 1
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: '0:00 | phrase one' }
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.LINKED_PARTIAL);
  assert.equal(result.recommendationEligible, false);
  assert.equal(contentDoc.curationStatus, PROMOTION_READINESS_OUTCOMES.LINKED_PARTIAL);
});

test('sufficiently linked transcript promotes content to ready_to_practice', async () => {
  const contentDoc = buildContentDoc({ transcriptStatus: 'linked', transcriptAvailable: true });
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 6,
        linkedSentenceCount: 2,
        linkedVocabularyCount: 4,
        linkedSegmentCount: 3
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 6,
        quizCandidateCount: 3
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: '0:00 | phrase one' }
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.READY_TO_PRACTICE);
  assert.equal(result.recommendationEligible, true);
  assert.equal(contentDoc.recommendationEligible, true);
  assert.equal(contentDoc.curationStatus, PROMOTION_READINESS_OUTCOMES.READY_TO_PRACTICE);
  assert.equal(result.transcriptFetchSource, 'request_text');
});

test('normalizes fetched transcript payloads into transcript segments', async () => {
  const segments = __testables.normalizeTranscriptSegmentsFromPayload({
    segments: [
      { text: 'こんにちは', start: 1, duration: 2.5 },
      { text: 'ありがとう', startTimeSeconds: 5, endTimeSeconds: 7 }
    ]
  });

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: 1,
      endTimeSeconds: 3.5,
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

test('provider transcript path is used when no request transcript is supplied', async () => {
  const contentDoc = buildContentDoc({ transcriptStatus: 'linked', transcriptAvailable: true });
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    fetchTranscriptFromProviderFn: async () => ({
      transcriptSource: 'youtube_caption',
      fetchDebug: { transcriptFetchSource: 'provider_fetch' },
      segments: [{ segmentOrder: 0, startTimeSeconds: null, endTimeSeconds: null, rawText: 'こんにちは' }]
    }),
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 4,
        linkedSentenceCount: 1,
        linkedVocabularyCount: 3,
        linkedSegmentCount: 2
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 4,
        quizCandidateCount: 2
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: {}
  });

  assert.equal(result.transcriptFetchSource, 'provider_fetch');
  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.READY_TO_PRACTICE);
});

test('request transcript text takes precedence over provider fetch', async () => {
  const contentDoc = buildContentDoc();
  let providerCalled = false;
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    fetchTranscriptFromProviderFn: async () => {
      providerCalled = true;
      return { segments: [] };
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 2,
        linkedSentenceCount: 0,
        linkedVocabularyCount: 0,
        linkedSegmentCount: 0
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 2,
        quizCandidateCount: 0
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: '0:00 | hello' }
  });

  assert.equal(providerCalled, false);
  assert.equal(result.transcriptFetchSource, 'request_text');
});

test('manual transcript text reaches ingestion with allowMissingTiming enabled', async () => {
  const contentDoc = buildContentDoc();
  let ingestArgs = null;
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async (args) => {
      ingestArgs = args;
      return {
        summary: {
          segmentCount: 1,
          linkedSentenceCount: 0,
          linkedVocabularyCount: 0,
          linkedSegmentCount: 0
        }
      };
    },
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 1,
        quizCandidateCount: 0
      }
    })
  });

  await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: 'hello there' }
  });

  assert.equal(ingestArgs.allowMissingTiming, true);
  assert.equal(ingestArgs.body.transcriptText, 'hello there');
  assert.deepEqual(ingestArgs.body.segments, []);
});

test('manual transcript text can proceed past input acceptance even when later readiness stays unlinked', async () => {
  const contentDoc = buildContentDoc();
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 4,
        linkedSentenceCount: 0,
        linkedVocabularyCount: 0,
        linkedSegmentCount: 0
      },
      transcriptInputDebug: {
        rawInputLength: 24,
        normalizedInputLength: 24,
        parsedSegmentCount: 4,
        parsedSegmentPreview: [{ segmentOrder: 0, startTimeSeconds: null, endTimeSeconds: null, rawTextPreview: 'hello' }]
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 4,
        quizCandidateCount: 0
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: 'hello. there. thanks. bye.' }
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_READY_UNLINKED);
  assert.equal(result.failureReason, '');
  assert.equal(result.transcriptInputDebug.parsedSegmentCount, 4);
});

test('clear failure reason is returned when transcript input is rejected', async () => {
  const contentDoc = buildContentDoc();
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    ingestTranscriptSegmentsFn: async () => {
      const error = new Error('Provide at least one transcript segment or transcript text line to save.');
      error.transcriptInputDebug = {
        rawInputLength: 11,
        normalizedInputLength: 11,
        parsedSegmentCount: 0,
        parsedSegmentPreview: [],
        rejectionRule: 'no_valid_segments_after_parsing'
      };
      throw error;
    }
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { transcriptText: 'hello there' }
  });

  assert.equal(result.readinessOutcome, PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED);
  assert.equal(result.failureReason, 'transcript_input_rejected');
  assert.equal(result.transcriptInputDebug.rejectionRule, 'no_valid_segments_after_parsing');
});

test('request segments take precedence over provider fetch', async () => {
  const contentDoc = buildContentDoc();
  let providerCalled = false;
  const service = createContentCandidatePromotionService({
    getAccessibleContentDocumentByIdFn: async () => contentDoc,
    LearningContentModel: {
      async findById() {
        return contentDoc;
      }
    },
    fetchTranscriptFromProviderFn: async () => {
      providerCalled = true;
      return { segments: [] };
    },
    ingestTranscriptSegmentsFn: async () => ({
      summary: {
        segmentCount: 2,
        linkedSentenceCount: 0,
        linkedVocabularyCount: 0,
        linkedSegmentCount: 0
      }
    }),
    getContentStudyPackFn: async () => ({
      summary: {
        listeningReadySegmentCount: 2,
        quizCandidateCount: 0
      }
    })
  });

  const result = await service.promoteSourcedCandidate({
    contentId: 'content-1',
    user: buildUser(),
    body: { segments: [{ rawText: 'hello', startTimeSeconds: 0, endTimeSeconds: 1 }] }
  });

  assert.equal(providerCalled, false);
  assert.equal(result.transcriptFetchSource, 'request_segments');
});
