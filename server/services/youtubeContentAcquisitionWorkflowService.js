const LearningContent = require('../models/LearningContent');
const { sourceYoutubeCandidates } = require('./youtubeCandidateSourcingService');
const { promoteSourcedCandidate } = require('./contentCandidatePromotionService');

const normalizeText = (value) => String(value || '').trim();
const normalizeArray = (value) => (Array.isArray(value) ? value : []);
const toCount = (value) => Number(value || 0);

const buildWorkflowMetadata = ({
  previousMetadata,
  workflowRunAt,
  candidate,
  content,
  persistenceStatus,
  promotionAttempted,
  promotionResult,
  failureReason
}) => ({
  ...(previousMetadata || {}),
  acquisitionWorkflow: {
    ...((previousMetadata && previousMetadata.acquisitionWorkflow) || {}),
    youtubeSourceAndPromote: {
      workflowRunAt,
      sourceQuery: normalizeText(candidate?.sourcingQuery),
      sourcingScore: toCount(candidate?.relevanceScore),
      sourcingReasons: normalizeArray(candidate?.sourcingReasons),
      persistenceStatus,
      promotionAttempted,
      promotionAttemptedAt: promotionAttempted ? workflowRunAt : '',
      promotionStatus:
        normalizeText(promotionResult?.readinessOutcome) ||
        normalizeText(promotionResult?.content?.curationStatus) ||
        normalizeText(content?.curationStatus),
      recommendationEligible:
        promotionResult?.recommendationEligible !== undefined
          ? Boolean(promotionResult.recommendationEligible)
          : Boolean(content?.recommendationEligible),
      transcriptSource: normalizeText(promotionResult?.content?.transcriptSource || content?.transcriptSource),
      transcriptSegmentCount: toCount(promotionResult?.transcriptSummary?.segmentCount),
      linkedSegmentCount: toCount(promotionResult?.transcriptSummary?.linkedSegmentCount),
      linkedVocabularyCount: toCount(promotionResult?.transcriptSummary?.linkedVocabularyCount),
      linkedSentenceCount: toCount(promotionResult?.transcriptSummary?.linkedSentenceCount),
      failureReason: normalizeText(failureReason)
    }
  }
});

const buildCandidateSummary = ({ content, candidate, persistenceStatus, promotionAttempted, promotionResult, failureReason }) => {
  const transcriptSummary = promotionResult?.transcriptSummary || {};
  const readinessMetadata = content?.metadata?.readiness || {};

  return {
    contentId: normalizeText(content?._id || candidate?.contentId),
    title: normalizeText(candidate?.title || content?.title),
    youtubeId: normalizeText(candidate?.sourceId || content?.sourceId || content?.externalId),
    sourcingScore: toCount(candidate?.relevanceScore),
    sourcingReasons: normalizeArray(candidate?.sourcingReasons),
    persistenceStatus,
    promotionAttempted,
    promotionStatus:
      normalizeText(promotionResult?.readinessOutcome) ||
      normalizeText(content?.curationStatus) ||
      'not_attempted',
    recommendationEligible:
      promotionResult?.recommendationEligible !== undefined
        ? Boolean(promotionResult.recommendationEligible)
        : Boolean(content?.recommendationEligible),
    transcriptSource: normalizeText(content?.transcriptSource || readinessMetadata.transcriptSource),
    transcriptSegmentCount: toCount(transcriptSummary.segmentCount || readinessMetadata.segmentCount),
    linkedSegmentCount: toCount(transcriptSummary.linkedSegmentCount || readinessMetadata.linkedSegmentCount),
    linkedVocabularyCount: toCount(transcriptSummary.linkedVocabularyCount || readinessMetadata.linkedVocabularyCount),
    linkedSentenceCount: toCount(transcriptSummary.linkedSentenceCount || readinessMetadata.linkedSentenceCount),
    readinessOutcome:
      normalizeText(promotionResult?.readinessOutcome) ||
      normalizeText(content?.curationStatus) ||
      normalizeText(readinessMetadata.outcome),
    failureReason: normalizeText(failureReason || promotionResult?.error || readinessMetadata.errorMessage)
  };
};

const createYoutubeContentAcquisitionWorkflowService = ({
  LearningContentModel = LearningContent,
  sourceYoutubeCandidatesFn = sourceYoutubeCandidates,
  promoteSourcedCandidateFn = promoteSourcedCandidate,
  now = () => new Date().toISOString()
} = {}) => {
  const sourceAndPromoteYoutubeContent = async ({ user, input = {} }) => {
    const workflowRunAt = now();
    const sourcingResult = await sourceYoutubeCandidatesFn({
      user,
      input: {
        ...input,
        persist: true
      }
    });
    const candidates = [];
    let promotionAttemptedCount = 0;

    for (const candidate of normalizeArray(sourcingResult?.items)) {
      const persistenceStatus = candidate.persistenceStatus || (candidate.created ? 'created' : 'reused');
      const contentId = normalizeText(candidate.contentId);

      if (!contentId) {
        candidates.push(
          buildCandidateSummary({
            candidate,
            persistenceStatus: 'skipped_duplicate',
            promotionAttempted: false,
            promotionResult: null,
            failureReason: 'content_not_persisted'
          })
        );
        continue;
      }

      let content = await LearningContentModel.findById(contentId);
      let promotionResult = null;
      let promotionAttempted = false;
      let failureReason = '';

      if (!content) {
        candidates.push(
          buildCandidateSummary({
            candidate,
            persistenceStatus,
            promotionAttempted: false,
            promotionResult: null,
            failureReason: 'content_not_found_after_persist'
          })
        );
        continue;
      }

      if (content.recommendationEligible === true) {
        failureReason = '';
      } else {
        try {
          promotionAttempted = true;
          promotionAttemptedCount += 1;
          promotionResult = await promoteSourcedCandidateFn({
            contentId,
            user,
            body: {}
          });
          failureReason = normalizeText(promotionResult?.error);
        } catch (error) {
          failureReason = normalizeText(error.message || error);
        }

        content = (await LearningContentModel.findById(contentId)) || content;
      }

      if (content && typeof content.save === 'function') {
        content.metadata = buildWorkflowMetadata({
          previousMetadata: content.metadata,
          workflowRunAt,
          candidate,
          content,
          persistenceStatus,
          promotionAttempted,
          promotionResult,
          failureReason
        });
        await content.save();
      }

      candidates.push(
        buildCandidateSummary({
          content,
          candidate,
          persistenceStatus,
          promotionAttempted,
          promotionResult,
          failureReason
        })
      );
    }

    return {
      sourcedCount: toCount(sourcingResult?.meta?.returnedCount || candidates.length),
      persistedCount: candidates.filter((candidate) => normalizeText(candidate.contentId)).length,
      createdCount: toCount(sourcingResult?.meta?.createdCount),
      reusedCount: toCount(sourcingResult?.meta?.reusedCount),
      promotionAttemptedCount,
      promotedCount: candidates.filter((candidate) => candidate.recommendationEligible === true).length,
      candidates,
      meta: {
        workflow: 'youtube_source_and_promote',
        workflowRunAt,
        sourceStage: normalizeText(sourcingResult?.meta?.sourceStage),
        queries: normalizeArray(sourcingResult?.meta?.queries),
        rawCandidateCount: toCount(sourcingResult?.meta?.rawCandidateCount)
      }
    };
  };

  return {
    sourceAndPromoteYoutubeContent
  };
};

const defaultService = createYoutubeContentAcquisitionWorkflowService();

module.exports = {
  createYoutubeContentAcquisitionWorkflowService,
  sourceAndPromoteYoutubeContent: defaultService.sourceAndPromoteYoutubeContent
};
