const LearningContent = require('../models/LearningContent');
const {
  getAccessibleContentDocumentById,
  serializeContent
} = require('./contentService');
const { getContentStudyPack } = require('./contentStudyService');
const { ingestTranscriptSegments } = require('./transcriptService');
const { YOUTUBE_CANDIDATE_SEED_SOURCE } = require('./youtubeCandidateSourcingService');
const { fetchTranscriptFromProvider, __testables: transcriptProviderTestables } = require('./youtubeTranscriptProviderService');

const PROMOTION_READINESS_OUTCOMES = Object.freeze({
  TRANSCRIPT_FAILED: 'transcript_failed',
  TRANSCRIPT_READY_UNLINKED: 'transcript_ready_unlinked',
  LINKED_PARTIAL: 'linked_partial',
  READY_TO_PRACTICE: 'ready_to_practice',
  PENDING_MANUAL_REVIEW: 'pending_manual_review'
});

const PROMOTABLE_CURATION_STATUSES = new Set([
  'candidate_sourced_pending_review',
  PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED,
  PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_READY_UNLINKED,
  PROMOTION_READINESS_OUTCOMES.LINKED_PARTIAL,
  PROMOTION_READINESS_OUTCOMES.PENDING_MANUAL_REVIEW
]);

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return ['true', '1', 'yes'].includes(normalizeLower(value));
};
const normalizeList = (value) =>
  [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((entry) => normalizeText(entry)).filter(Boolean))];

const isContentCandidatePromotionEnabled = () => normalizeBoolean(process.env.ENABLE_CONTENT_CANDIDATE_PROMOTION);
const getPromotionAllowedUsers = () => normalizeList(process.env.CONTENT_CANDIDATE_PROMOTION_ALLOWED_USERS || '');

const canUserPromoteSourcedCandidates = (user) => {
  if (!isContentCandidatePromotionEnabled()) {
    return false;
  }

  const allowedUsers = getPromotionAllowedUsers();
  if (allowedUsers.length === 0) {
    return true;
  }

  return allowedUsers.map((entry) => normalizeLower(entry)).includes(normalizeLower(user?.username));
};

const isSourcedYoutubeCandidate = (content) => {
  if (!content) {
    return false;
  }

  return (
    normalizeLower(content.contentType) === 'youtube' &&
    normalizeLower(content.sourceProvider) === 'youtube' &&
    content.recommendationEligible !== true &&
    (normalizeText(content.seedSource) === YOUTUBE_CANDIDATE_SEED_SOURCE ||
      PROMOTABLE_CURATION_STATUSES.has(normalizeText(content.curationStatus)))
  );
};

const evaluateContentReadiness = ({ content, transcriptSummary, studyPackSummary }) => {
  const linkedSentenceCount = Number(transcriptSummary?.linkedSentenceCount || 0);
  const linkedVocabularyCount = Number(transcriptSummary?.linkedVocabularyCount || 0);
  const linkedSegmentCount = Number(transcriptSummary?.linkedSegmentCount || 0);
  const segmentCount = Number(transcriptSummary?.segmentCount || 0);
  const quizCandidateCount = Number(studyPackSummary?.quizCandidateCount || 0);
  const listeningReadySegmentCount = Number(studyPackSummary?.listeningReadySegmentCount || 0);
  const hasPlayableSource = Boolean(normalizeText(content?.embedUrl || content?.sourceUrl || content?.url || content?.sourceId));

  if (!segmentCount) {
    return {
      outcome: PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED,
      shouldPromote: false,
      reason: 'no_transcript_segments'
    };
  }

  if (linkedSentenceCount + linkedVocabularyCount === 0) {
    return {
      outcome: PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_READY_UNLINKED,
      shouldPromote: false,
      reason: 'transcript_has_no_trusted_links'
    };
  }

  if (!hasPlayableSource || listeningReadySegmentCount < 2) {
    return {
      outcome: PROMOTION_READINESS_OUTCOMES.PENDING_MANUAL_REVIEW,
      shouldPromote: false,
      reason: 'content_needs_manual_review'
    };
  }

  if (linkedSegmentCount >= 2 && (linkedSentenceCount >= 1 || linkedVocabularyCount >= 3) && quizCandidateCount >= 2) {
    return {
      outcome: PROMOTION_READINESS_OUTCOMES.READY_TO_PRACTICE,
      shouldPromote: true,
      reason: 'trusted_links_support_practice'
    };
  }

  return {
    outcome: PROMOTION_READINESS_OUTCOMES.LINKED_PARTIAL,
    shouldPromote: false,
    reason: 'trusted_links_exist_but_threshold_not_met'
  };
};

const buildPromotionMetadata = ({
  previousMetadata,
  readiness,
  transcriptSummary,
  studyPackSummary,
  transcriptInputDebug,
  fetchedTranscript,
  transcriptSource,
  transcriptFetchSource,
  nowValue,
  errorMessage
}) => ({
  ...(previousMetadata || {}),
  readiness: {
    outcome: readiness.outcome,
    reason: readiness.reason,
    transcriptSource,
    segmentCount: Number(transcriptSummary?.segmentCount || 0),
    linkedSentenceCount: Number(transcriptSummary?.linkedSentenceCount || 0),
    linkedVocabularyCount: Number(transcriptSummary?.linkedVocabularyCount || 0),
    linkedSegmentCount: Number(transcriptSummary?.linkedSegmentCount || 0),
    listeningReadySegmentCount: Number(studyPackSummary?.listeningReadySegmentCount || 0),
    quizCandidateCount: Number(studyPackSummary?.quizCandidateCount || 0),
    transcriptInputDebug: transcriptInputDebug || null,
    fetchedTranscript,
    transcriptFetchSource,
    lastPromotionAttemptAt: nowValue,
    ...(errorMessage ? { errorMessage } : {})
  }
});

const PROMOTION_FAILURE_REASONS = Object.freeze({
  TRANSCRIPT_INPUT_MISSING: 'transcript_input_missing',
  TRANSCRIPT_INPUT_REJECTED: 'transcript_input_rejected',
  TRANSCRIPT_PROVIDER_FAILED: 'transcript_provider_failed',
  TRANSCRIPT_INGEST_FAILED: 'transcript_ingest_failed'
});

const createPromotionFailure = (reason, message) => {
  const error = new Error(message);
  error.failureReason = reason;
  return error;
};

const resolvePromotionFailureReason = ({ error, transcriptFetchSource, hadRequestTranscript }) => {
  if (normalizeText(error?.failureReason)) {
    return error.failureReason;
  }

  const message = normalizeLower(error?.message);
  if (message.includes('provide at least one transcript segment') || message.includes('raw text is required')) {
    return PROMOTION_FAILURE_REASONS.TRANSCRIPT_INPUT_REJECTED;
  }

  if (hadRequestTranscript && message.includes('no transcript input provided')) {
    return PROMOTION_FAILURE_REASONS.TRANSCRIPT_INPUT_MISSING;
  }

  if (!hadRequestTranscript && transcriptFetchSource === 'provider_fetch') {
    return PROMOTION_FAILURE_REASONS.TRANSCRIPT_PROVIDER_FAILED;
  }

  return PROMOTION_FAILURE_REASONS.TRANSCRIPT_INGEST_FAILED;
};

const createContentCandidatePromotionService = ({
  LearningContentModel = LearningContent,
  getAccessibleContentDocumentByIdFn = getAccessibleContentDocumentById,
  ingestTranscriptSegmentsFn = ingestTranscriptSegments,
  getContentStudyPackFn = getContentStudyPack,
  fetchTranscriptFromProviderFn = fetchTranscriptFromProvider,
  fetchFn = global.fetch,
  now = () => new Date().toISOString()
} = {}) => {
  const promoteSourcedCandidate = async ({ contentId, user, body = {} }) => {
    const content = await getAccessibleContentDocumentByIdFn({ id: contentId, user });

    if (!content) {
      throw new Error('Learning content not found.');
    }

    if (!isSourcedYoutubeCandidate(content)) {
      throw new Error('This content item is not a promotable sourced YouTube candidate.');
    }

    const nowValue = now();
    const transcriptText = normalizeText(body.transcriptText);
    let transcriptSegments = Array.isArray(body.segments) ? body.segments : [];
    const hadRequestTranscript = Boolean(transcriptText || transcriptSegments.length);
    let transcriptSource = transcriptText || transcriptSegments.length ? normalizeLower(body.transcriptSource || 'manual') : 'youtube_caption';
    let transcriptFetchSource = transcriptText ? 'request_text' : transcriptSegments.length ? 'request_segments' : 'provider_fetch';
    let fetchedTranscript = false;
    let transcriptSummary = { segmentCount: 0, linkedSentenceCount: 0, linkedVocabularyCount: 0, linkedSegmentCount: 0 };
    let studyPackSummary = { listeningReadySegmentCount: 0, quizCandidateCount: 0 };
    let transcriptInputDebug = {
      rawInputLength: transcriptText.length,
      normalizedInputLength: transcriptText.length,
      providedSegmentsCount: transcriptSegments.length,
      parsedSegmentCount: 0,
      parsedSegmentPreview: []
    };

    try {
      if (!transcriptText && !transcriptSegments.length) {
        if (typeof fetchFn !== 'function') {
          throw new Error('Fetch is not available for transcript sourcing.');
        }

        let providerTranscript;
        try {
          providerTranscript = await fetchTranscriptFromProviderFn({ content, fetchFn });
        } catch (error) {
          throw createPromotionFailure(PROMOTION_FAILURE_REASONS.TRANSCRIPT_PROVIDER_FAILED, error.message);
        }
        transcriptSegments = providerTranscript.segments;
        transcriptSource = providerTranscript.transcriptSource || 'youtube_caption';
        transcriptFetchSource = providerTranscript.fetchDebug?.transcriptFetchSource || 'provider_fetch';
        fetchedTranscript = transcriptSegments.length > 0;
      }

      if (!transcriptText && transcriptSegments.length === 0) {
        throw createPromotionFailure(
          PROMOTION_FAILURE_REASONS.TRANSCRIPT_INPUT_MISSING,
          'No transcript input provided for this candidate.'
        );
      }

      let transcriptResult;
      try {
        transcriptResult = await ingestTranscriptSegmentsFn({
          contentId,
          user,
          allowSystemIngestion: true,
          allowMissingTiming: true,
          body: {
            replaceExisting: true,
            transcriptSource,
            transcriptText,
            segments: transcriptSegments,
            provenanceNotes: fetchedTranscript
              ? 'Transcript ingested during sourced candidate promotion.'
              : 'Transcript provided during sourced candidate promotion.'
          }
        });
      } catch (error) {
        transcriptInputDebug = error.transcriptInputDebug || transcriptInputDebug;
        throw createPromotionFailure(resolvePromotionFailureReason({ error, transcriptFetchSource, hadRequestTranscript }), error.message);
      }

      transcriptSummary = transcriptResult.summary || transcriptSummary;
      transcriptInputDebug = transcriptResult.transcriptInputDebug || transcriptInputDebug;
      const studyPack = await getContentStudyPackFn({ contentId, user });
      studyPackSummary = studyPack?.summary || studyPackSummary;

      const refreshedContent = await LearningContentModel.findById(contentId);
      const readiness = evaluateContentReadiness({
        content: refreshedContent || content,
        transcriptSummary,
        studyPackSummary
      });

      if (refreshedContent) {
        refreshedContent.recommendationEligible = readiness.shouldPromote;
        refreshedContent.curationStatus = readiness.outcome;
        refreshedContent.metadata = buildPromotionMetadata({
          previousMetadata: refreshedContent.metadata,
          readiness,
          transcriptSummary,
          studyPackSummary,
          transcriptInputDebug,
          fetchedTranscript,
          transcriptSource,
          transcriptFetchSource,
          nowValue
        });
        await refreshedContent.save();
      }

      const serializedContent = refreshedContent ? serializeContent(refreshedContent, user?._id) : serializeContent(content, user?._id);

      return {
        content: serializedContent,
        transcriptStatus: normalizeText(serializedContent.transcriptStatus),
        transcriptSummary,
        studyPackSummary,
        readinessOutcome: readiness.outcome,
        recommendationEligible: readiness.shouldPromote,
        fetchedTranscript,
        transcriptFetchSource,
        failureReason: '',
        transcriptInputDebug
      };
    } catch (error) {
      const failedContent = await LearningContentModel.findById(contentId);
      const failureReason = resolvePromotionFailureReason({ error, transcriptFetchSource, hadRequestTranscript });
      transcriptInputDebug = error.transcriptInputDebug || transcriptInputDebug;

      if (failedContent) {
        failedContent.recommendationEligible = false;
        failedContent.curationStatus = PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED;
        failedContent.transcriptAvailable = false;
        failedContent.transcriptStatus = 'pending';
        failedContent.metadata = buildPromotionMetadata({
          previousMetadata: failedContent.metadata,
          readiness: {
            outcome: PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED,
            reason: failureReason
          },
          transcriptSummary,
          studyPackSummary,
          transcriptInputDebug,
          fetchedTranscript,
          transcriptSource,
          transcriptFetchSource,
          nowValue,
          errorMessage: error.message
        });
        await failedContent.save();
      }

      return {
        content: failedContent ? serializeContent(failedContent, user?._id) : serializeContent(content, user?._id),
        transcriptStatus: 'pending',
        transcriptSummary,
        studyPackSummary,
        readinessOutcome: PROMOTION_READINESS_OUTCOMES.TRANSCRIPT_FAILED,
        recommendationEligible: false,
        fetchedTranscript,
        transcriptFetchSource,
        failureReason,
        transcriptInputDebug,
        error: error.message
      };
    }
  };

  return {
    promoteSourcedCandidate
  };
};

const defaultService = createContentCandidatePromotionService();

module.exports = {
  PROMOTION_READINESS_OUTCOMES,
  canUserPromoteSourcedCandidates,
  createContentCandidatePromotionService,
  isContentCandidatePromotionEnabled,
  promoteSourcedCandidate: defaultService.promoteSourcedCandidate,
  __testables: {
    evaluateContentReadiness,
    isSourcedYoutubeCandidate,
    resolvePromotionFailureReason,
    normalizeTranscriptSegmentsFromPayload: transcriptProviderTestables.normalizeTranscriptSegments,
    resolveYoutubeVideoIdFromContent: transcriptProviderTestables.resolveYoutubeVideoIdFromContent
  }
};
