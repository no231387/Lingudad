const TranscriptSegment = require('../models/TranscriptSegment');
const { getAccessibleContentDocumentById, serializeContent } = require('./contentService');
const { buildSentenceQuizPayload, buildVocabularyQuizPayload } = require('./studyGenerationService');

const normalizeText = (value) => String(value || '').trim();
const uniqueValues = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];

const buildAnchorSummary = ({ sentence = null, vocabulary = null }) => {
  if (sentence) {
    return {
      model: 'Sentence',
      id: String(sentence._id),
      sourceProvider: normalizeText(sentence.sourceProvider),
      sourceId: normalizeText(sentence.sourceId),
      text: normalizeText(sentence.text),
      translations: uniqueValues((sentence.translations || []).map((entry) => entry.text))
    };
  }

  if (vocabulary) {
    return {
      model: 'Vocabulary',
      id: String(vocabulary._id),
      sourceProvider: normalizeText(vocabulary.sourceProvider),
      sourceId: normalizeText(vocabulary.sourceId),
      term: normalizeText(vocabulary.term),
      reading: normalizeText(vocabulary.reading),
      meanings: uniqueValues(vocabulary.meanings)
    };
  }

  return null;
};

const buildSharedStudyFields = ({ content, segment, generationType, trustState, trustedAnchor, eligibilityReason }) => ({
  id: `${generationType}:${String(segment._id)}`,
  studyLayer: 'transcript_backed',
  generationType,
  trustState,
  promptMode: generationType === 'listening_recall' ? 'self_check' : 'quiz_seed',
  contentId: String(content._id),
  transcriptSegmentId: String(segment._id),
  transcriptText: normalizeText(segment.rawText),
  language: normalizeText(content.language),
  trustedAnchor,
  provenance: {
    contentId: String(content._id),
    transcriptSegmentId: String(segment._id),
    startTimeSeconds: Number(segment.startTimeSeconds || 0),
    endTimeSeconds: Number(segment.endTimeSeconds || 0),
    contentSourceProvider: normalizeText(content.sourceProvider),
    contentSourceId: normalizeText(content.sourceId),
    transcriptSource: normalizeText(segment.transcriptSource || content.transcriptSource || 'none'),
    validationStatus: normalizeText(segment.validationStatus || 'raw_transcript')
  },
  debug: {
    eligibilityReason,
    linkedSentenceCount: Array.isArray(segment.linkedSentenceIds) ? segment.linkedSentenceIds.length : 0,
    linkedVocabularyCount: Array.isArray(segment.linkedVocabularyIds) ? segment.linkedVocabularyIds.length : 0,
    transcriptCandidateCount: Array.isArray(segment.extractionCandidates) ? segment.extractionCandidates.length : 0
  }
});

const buildListeningTask = ({ content, segment, sentence, vocabulary }) => {
  const trustedAnchor = buildAnchorSummary({ sentence, vocabulary });

  return {
    ...buildSharedStudyFields({
      content,
      segment,
      generationType: 'listening_recall',
      trustState: trustedAnchor ? 'trusted_anchor' : 'transcript_backed_only',
      trustedAnchor,
      eligibilityReason: trustedAnchor ? 'segment_has_trusted_anchor' : 'segment_has_transcript_text'
    }),
    title: trustedAnchor ? 'Listen and recall with trusted anchor' : 'Listen and recall',
    prompt: trustedAnchor
      ? 'Replay the segment, recall what you hear, then self-check against the trusted anchor.'
      : 'Replay the segment, recall what you hear, then self-check against the transcript-backed line.',
    answers: [],
    correctAnswer: '',
    metadata: {
      replaySuggested: true,
      transcriptBackedOnly: !trustedAnchor,
      trustedAnchorModel: trustedAnchor?.model || ''
    }
  };
};

const buildSentenceComprehensionTask = ({ content, segment, sentence }) => {
  const translations = uniqueValues((sentence.translations || []).map((entry) => entry.text));

  if (!translations.length) {
    return null;
  }

  return {
    ...buildSharedStudyFields({
      content,
      segment,
      generationType: 'sentence_comprehension',
      trustState: 'trusted_anchor',
      trustedAnchor: buildAnchorSummary({ sentence }),
      eligibilityReason: 'trusted_sentence_link'
    }),
    title: 'Trusted sentence comprehension',
    prompt: 'Listen to the segment, then recall the meaning of the trusted linked sentence.',
    answers: translations,
    correctAnswer: translations[0],
    metadata: {
      originalText: normalizeText(sentence.text),
      translations,
      scaffoldOnly: false
    }
  };
};

const buildSentenceClozeTask = ({ content, segment, sentence, user }) => {
  try {
    const seed = buildSentenceQuizPayload(sentence, user);

    return {
      ...buildSharedStudyFields({
        content,
        segment,
        generationType: 'sentence_cloze',
        trustState: 'trusted_anchor',
        trustedAnchor: buildAnchorSummary({ sentence }),
        eligibilityReason: 'trusted_sentence_link_with_safe_cloze_target'
      }),
      title: 'Trusted sentence cloze',
      prompt: seed.prompt,
      answers: uniqueValues(seed.answers),
      correctAnswer: normalizeText(seed.correctAnswer),
      metadata: {
        ...(seed.metadata || {}),
        scaffoldOnly: false
      }
    };
  } catch (error) {
    return null;
  }
};

const buildVocabularyRecognitionTask = ({ content, segment, vocabulary, user }) => {
  try {
    const seed = buildVocabularyQuizPayload(vocabulary, user);

    return {
      ...buildSharedStudyFields({
        content,
        segment,
        generationType: 'vocabulary_recognition',
        trustState: 'trusted_anchor',
        trustedAnchor: buildAnchorSummary({ vocabulary }),
        eligibilityReason: 'trusted_vocabulary_link'
      }),
      title: 'Trusted vocabulary recognition',
      prompt: `Meaning for the trusted term heard in this segment: ${normalizeText(vocabulary.term)}`,
      answers: uniqueValues(seed.answers),
      correctAnswer: normalizeText(seed.correctAnswer),
      metadata: {
        ...(seed.metadata || {}),
        term: normalizeText(vocabulary.term),
        reading: normalizeText(vocabulary.reading),
        scaffoldOnly: false
      }
    };
  } catch (error) {
    return null;
  }
};

const summarizeStudyPack = ({ segments, items }) => {
  const trustedLinkedSegments = segments.filter(
    (segment) =>
      (Array.isArray(segment.linkedSentenceIds) && segment.linkedSentenceIds.length > 0) ||
      (Array.isArray(segment.linkedVocabularyIds) && segment.linkedVocabularyIds.length > 0)
  );
  const sentenceLinkedSegments = segments.filter((segment) => Array.isArray(segment.linkedSentenceIds) && segment.linkedSentenceIds.length > 0);
  const vocabularyLinkedSegments = segments.filter(
    (segment) => Array.isArray(segment.linkedVocabularyIds) && segment.linkedVocabularyIds.length > 0
  );

  return {
    segmentCount: segments.length,
    trustedLinkedSegmentCount: trustedLinkedSegments.length,
    listeningReadySegmentCount: segments.filter((segment) => normalizeText(segment.rawText)).length,
    quizReadySegmentCount: trustedLinkedSegments.length,
    sentenceLinkedSegmentCount: sentenceLinkedSegments.length,
    vocabularyLinkedSegmentCount: vocabularyLinkedSegments.length,
    listeningTaskCount: items.filter((item) => item.generationType === 'listening_recall').length,
    quizCandidateCount: items.filter((item) => item.promptMode === 'quiz_seed').length,
    transcriptOnlyListeningCount: items.filter((item) => item.trustState === 'transcript_backed_only').length
  };
};

const buildSessionItemFromStudyPackItem = ({ item, content, index }) => ({
  id: item.id,
  queuePosition: index + 1,
  sessionItemType: 'content_study',
  sessionSource: 'content',
  generationType: normalizeText(item.generationType),
  promptMode: normalizeText(item.promptMode),
  trustState: normalizeText(item.trustState),
  validationState: normalizeText(item.provenance?.validationStatus || 'raw_transcript'),
  title: normalizeText(item.title),
  wordOrPhrase:
    normalizeText(item.trustedAnchor?.term) ||
    normalizeText(item.trustedAnchor?.text) ||
    normalizeText(item.title) ||
    'Content study item',
  translation: normalizeText(item.correctAnswer),
  meaning: uniqueValues(item.answers).join(' / '),
  exampleSentence: normalizeText(item.transcriptText),
  transcriptText: normalizeText(item.transcriptText),
  prompt: normalizeText(item.prompt),
  answers: uniqueValues(item.answers),
  correctAnswer: normalizeText(item.correctAnswer),
  language: normalizeText(item.language || content.language),
  proficiency: 1,
  sourceType: 'media',
  sourceProvider: normalizeText(item.provenance?.contentSourceProvider || content.sourceProvider),
  sourceId: String(item.contentId || content._id),
  generatedFromModel: normalizeText(item.trustedAnchor?.model || 'TranscriptSegment'),
  generatedFromId: normalizeText(item.trustedAnchor?.id || item.transcriptSegmentId),
  contentId: String(item.contentId || content._id),
  transcriptSegmentId: normalizeText(item.transcriptSegmentId),
  trustedAnchor: item.trustedAnchor || null,
  metadata: item.metadata || {},
  provenance: {
    ...item.provenance,
    contentId: String(item.contentId || content._id),
    contentTitle: normalizeText(content.title),
    contentUrl: normalizeText(content.sourceUrl || content.url),
    startTimeSeconds: Number(item.provenance?.startTimeSeconds || 0),
    endTimeSeconds: Number(item.provenance?.endTimeSeconds || 0)
  }
});

const buildContentStudySession = ({ content, items, summary, message }) => ({
  sessionSource: 'content',
  title: `${normalizeText(content.title)} Study`,
  description: 'Transcript-backed content study in segment order.',
  shapingStrategy: 'content_pack_chronological',
  itemCount: items.length,
  content,
  summary,
  items: items.map((item, index) => buildSessionItemFromStudyPackItem({ item, content, index })),
  message
});

const getContentStudyPack = async ({ contentId, user }) => {
  const content = await getAccessibleContentDocumentById({ id: contentId, user });

  if (!content) {
    return null;
  }

  const segments = await TranscriptSegment.find({ contentId: content._id })
    .populate({
      path: 'linkedSentenceIds',
      select: 'text translations sourceProvider sourceId linkedVocabularyIds',
      populate: {
        path: 'linkedVocabularyIds',
        select: 'term reading meanings sourceProvider sourceId'
      }
    })
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' })
    .sort({ segmentOrder: 1, startTimeSeconds: 1 });

  const items = [];

  segments.forEach((segment) => {
    const linkedSentence = Array.isArray(segment.linkedSentenceIds) && segment.linkedSentenceIds.length > 0 ? segment.linkedSentenceIds[0] : null;
    const linkedVocabulary = Array.isArray(segment.linkedVocabularyIds) && segment.linkedVocabularyIds.length > 0 ? segment.linkedVocabularyIds[0] : null;

    items.push(
      buildListeningTask({
        content,
        segment,
        sentence: linkedSentence,
        vocabulary: linkedSentence ? null : linkedVocabulary
      })
    );

    if (linkedSentence) {
      const comprehensionTask = buildSentenceComprehensionTask({
        content,
        segment,
        sentence: linkedSentence
      });
      const clozeTask = buildSentenceClozeTask({
        content,
        segment,
        sentence: linkedSentence,
        user
      });

      if (comprehensionTask) {
        items.push(comprehensionTask);
      }

      if (clozeTask) {
        items.push(clozeTask);
      }

      return;
    }

    if (linkedVocabulary) {
      const vocabularyTask = buildVocabularyRecognitionTask({
        content,
        segment,
        vocabulary: linkedVocabulary,
        user
      });

      if (vocabularyTask) {
        items.push(vocabularyTask);
      }
    }
  });

  const filteredItems = items.filter(Boolean);

  return {
    content: serializeContent(content, user._id),
    summary: summarizeStudyPack({
      segments,
      items: filteredItems
    }),
    items: filteredItems,
    message:
      filteredItems.length > 0
        ? 'Transcript-backed study is ready. Listening tasks are available for transcript segments, and quiz seeds only use trusted anchors.'
        : 'No transcript-backed study items are available yet.'
  };
};

const startContentStudySession = async ({ contentId, user }) => {
  const studyPack = await getContentStudyPack({ contentId, user });

  if (!studyPack) {
    return null;
  }

  if (!Array.isArray(studyPack.items) || studyPack.items.length === 0) {
    return {
      ...buildContentStudySession({
        content: studyPack.content,
        items: [],
        summary: studyPack.summary,
        message: 'No study items available yet. Add transcript or trusted links.'
      }),
      empty: true
    };
  }

  return buildContentStudySession({
    content: studyPack.content,
    items: studyPack.items,
    summary: studyPack.summary,
    message: studyPack.message
  });
};

module.exports = {
  getContentStudyPack,
  startContentStudySession
};
