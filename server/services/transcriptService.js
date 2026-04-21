const LearningContent = require('../models/LearningContent');
const Sentence = require('../models/Sentence');
const TranscriptSegment = require('../models/TranscriptSegment');
const Vocabulary = require('../models/Vocabulary');
const { getAccessibleContentDocumentById } = require('./contentService');

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const uniqueValues = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];

const normalizeSegmentText = (value) => normalizeText(value).replace(/\s+/g, ' ');
const splitPlainTranscriptLine = (line) => {
  const normalizedLine = normalizeText(line);

  if (!normalizedLine) {
    return [];
  }

  const sentenceMatches = normalizedLine.match(/[^。！？!?]+[。！？!?]?/g);
  const segments = (sentenceMatches || []).map((entry) => normalizeText(entry)).filter(Boolean);

  return segments.length > 1 ? segments : [normalizedLine];
};

const parseSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber) && directNumber >= 0) {
    return directNumber;
  }

  const timeParts = normalized.split(':').map((part) => Number(part));
  if (timeParts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (timeParts.length === 3) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  }

  if (timeParts.length === 2) {
    return timeParts[0] * 60 + timeParts[1];
  }

  return null;
};

const parseTranscriptText = (value) => {
  const lines = normalizeText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .flatMap((line) => {
      const fullRangeMatch = line.match(/^(.+?)\s*(?:-->|-)\s*(.+?)\s*\|\s*(.+)$/);
      const pointMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);

      if (fullRangeMatch) {
        const start = parseSeconds(fullRangeMatch[1]);
        const end = parseSeconds(fullRangeMatch[2]);

        if (start === null || end === null) {
          return [];
        }

        return [
          {
            startTimeSeconds: start,
            endTimeSeconds: end,
            rawText: fullRangeMatch[3]
          }
        ];
      }

      if (pointMatch) {
        const start = parseSeconds(pointMatch[1]);

        if (start === null) {
          return [];
        }

        return [
          {
            startTimeSeconds: start,
            endTimeSeconds: start,
            rawText: pointMatch[2]
          }
        ];
      }

      return splitPlainTranscriptLine(line).map((sentence) => ({
        startTimeSeconds: null,
        endTimeSeconds: null,
        rawText: sentence
      }));
    })
    .filter((segment) => normalizeText(segment.rawText))
    .map((segment, index) => ({
      segmentOrder: index,
      ...segment
    }));
};

const buildSegmentInputs = (body = {}) => {
  if (Array.isArray(body.segments) && body.segments.length > 0) {
    return body.segments.map((segment, index) => ({
      segmentOrder: Number(segment.segmentOrder ?? index),
      startTimeSeconds: parseSeconds(segment.startTimeSeconds),
      endTimeSeconds: parseSeconds(segment.endTimeSeconds),
      rawText: segment.rawText,
      confidence: segment.confidence
    }));
  }

  return parseTranscriptText(body.transcriptText || body.segmentsText);
};

const buildTranscriptInputDebug = (body = {}) => {
  const rawTranscriptText = String(body.transcriptText || body.segmentsText || '');
  const normalizedTranscriptText = normalizeText(rawTranscriptText);
  const parsedSegments = buildSegmentInputs(body);

  return {
    rawInputLength: rawTranscriptText.length,
    normalizedInputLength: normalizedTranscriptText.length,
    providedSegmentsCount: Array.isArray(body.segments) ? body.segments.length : 0,
    parsedSegmentCount: parsedSegments.length,
    parsedSegmentPreview: parsedSegments.slice(0, 2).map((segment) => ({
      segmentOrder: Number(segment.segmentOrder),
      startTimeSeconds: segment.startTimeSeconds,
      endTimeSeconds: segment.endTimeSeconds,
      rawTextPreview: normalizeText(segment.rawText).slice(0, 80)
    }))
  };
};

const buildSentenceLookupMap = (sentences = []) =>
  new Map(sentences.map((sentence) => [normalizeSegmentText(sentence.text), sentence]));

const findConservativeVocabularyMatches = async ({ contentLanguage, texts = [] }) => {
  const normalizedTexts = uniqueValues(texts.map((text) => normalizeSegmentText(text)));

  if (normalizedTexts.length === 0) {
    return new Map();
  }

  const exactVocabulary = await Vocabulary.find({
    language: contentLanguage,
    $or: [{ term: { $in: normalizedTexts } }, { reading: { $in: normalizedTexts } }]
  }).select('term reading meanings sourceProvider sourceId language');

  const vocabularyMap = new Map();

  exactVocabulary.forEach((entry) => {
    const keys = uniqueValues([entry.term, entry.reading]).map((value) => normalizeSegmentText(value));

    keys.forEach((key) => {
      if (!vocabularyMap.has(key)) {
        vocabularyMap.set(key, []);
      }

      vocabularyMap.get(key).push(entry);
    });
  });

  return vocabularyMap;
};

const serializeTranscriptSegment = (segment) => {
  const item = typeof segment.toObject === 'function' ? segment.toObject() : segment;

  return {
    ...item,
    linkedVocabularyIds: Array.isArray(item.linkedVocabularyIds) ? item.linkedVocabularyIds : [],
    linkedSentenceIds: Array.isArray(item.linkedSentenceIds) ? item.linkedSentenceIds : [],
    extractionCandidates: Array.isArray(item.extractionCandidates) ? item.extractionCandidates : [],
    candidateCount: Array.isArray(item.extractionCandidates) ? item.extractionCandidates.length : 0,
    trustedLinkCount:
      Number(Array.isArray(item.linkedVocabularyIds) ? item.linkedVocabularyIds.length : 0) +
      Number(Array.isArray(item.linkedSentenceIds) ? item.linkedSentenceIds.length : 0)
  };
};

const createSegmentPayloads = async ({ content, user, body = {}, allowMissingTiming = false }) => {
  const transcriptInputDebug = buildTranscriptInputDebug(body);
  const segmentInputs = buildSegmentInputs(body)
    .map((segment, index) => ({
      segmentOrder: Number.isFinite(Number(segment.segmentOrder)) ? Number(segment.segmentOrder) : index,
      startTimeSeconds: parseSeconds(segment.startTimeSeconds),
      endTimeSeconds: parseSeconds(segment.endTimeSeconds),
      rawText: normalizeText(segment.rawText),
      confidence:
        segment.confidence === '' || segment.confidence === undefined || segment.confidence === null
          ? null
          : Math.max(0, Math.min(1, Number(segment.confidence)))
    }))
    .filter((segment) => {
      if (!segment.rawText) {
        return false;
      }

      if (allowMissingTiming) {
        return true;
      }

      return segment.startTimeSeconds !== null && segment.endTimeSeconds !== null;
    });

  if (segmentInputs.length === 0) {
    const error = new Error('Provide at least one transcript segment or transcript text line to save.');
    error.transcriptInputDebug = {
      ...transcriptInputDebug,
      rejectionRule: 'no_valid_segments_after_parsing'
    };
    throw error;
  }

  const normalizedSegmentTexts = segmentInputs.map((segment) => normalizeSegmentText(segment.rawText));
  const trustedSentences = await Sentence.find({
    language: content.language,
    text: { $in: normalizedSegmentTexts }
  })
    .select('text linkedVocabularyIds sourceProvider sourceId')
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId language' });
  const sentenceMap = buildSentenceLookupMap(trustedSentences);
  const vocabularyMap = await findConservativeVocabularyMatches({
    contentLanguage: content.language,
    texts: normalizedSegmentTexts
  });

  const allLinkedSentenceIds = new Set();
  const allLinkedVocabularyIds = new Set();

  const payloads = segmentInputs.map((segment) => {
    const normalizedText = normalizeSegmentText(segment.rawText);
    const linkedSentence = sentenceMap.get(normalizedText) || null;
    const linkedVocabulary = vocabularyMap.get(normalizedText) || [];
    const derivedSentenceVocabulary = linkedSentence?.linkedVocabularyIds || [];
    const trustedVocabulary = [
      ...linkedVocabulary,
      ...derivedSentenceVocabulary.filter(
        (entry) => !linkedVocabulary.some((vocabulary) => String(vocabulary._id) === String(entry._id))
      )
    ];

    const linkedSentenceIds = linkedSentence ? [linkedSentence._id] : [];
    const linkedVocabularyIds = trustedVocabulary.map((entry) => entry._id);

    linkedSentenceIds.forEach((id) => allLinkedSentenceIds.add(String(id)));
    linkedVocabularyIds.forEach((id) => allLinkedVocabularyIds.add(String(id)));

    const extractionCandidates = [];

    extractionCandidates.push({
      kind: 'sentence_snippet',
      rawText: segment.rawText,
      normalizedText,
      status: linkedSentence ? 'linked_to_trusted_record' : 'extracted_candidate',
      matchStrategy: linkedSentence ? 'exact_sentence_text' : 'segment_snippet',
      linkedSentenceId: linkedSentence?._id || null,
      linkedVocabularyId: null
    });

    trustedVocabulary.forEach((entry) => {
      extractionCandidates.push({
        kind: 'vocabulary_term',
        rawText: entry.term,
        normalizedText: normalizeSegmentText(entry.term || entry.reading),
        status: 'linked_to_trusted_record',
        matchStrategy: linkedVocabulary.some((candidate) => String(candidate._id) === String(entry._id))
          ? 'exact_segment_term'
          : 'sentence_linked_vocabulary',
        linkedVocabularyId: entry._id,
        linkedSentenceId: linkedSentence?._id || null
      });
    });

    return {
      contentId: content._id,
      segmentOrder: segment.segmentOrder,
      startTimeSeconds: segment.startTimeSeconds,
      endTimeSeconds:
        segment.startTimeSeconds === null || segment.endTimeSeconds === null
          ? null
          : Math.max(segment.startTimeSeconds, segment.endTimeSeconds),
      rawText: segment.rawText,
      normalizedText,
      language: content.language,
      transcriptSource:
        ['manual', 'youtube_caption', 'uploaded_file', 'trusted_link', 'future_pipeline'].includes(
          normalizeLower(body.transcriptSource)
        )
          ? normalizeLower(body.transcriptSource)
          : 'manual',
      confidence: Number.isFinite(segment.confidence) ? segment.confidence : null,
      validationStatus: linkedSentence || linkedVocabularyIds.length > 0 ? 'linked_to_trusted_record' : 'raw_transcript',
      linkedVocabularyIds,
      linkedSentenceIds,
      extractionCandidates,
      provenance: {
        ingestedBy: user._id,
        ingestedAt: new Date(),
        sourceCapturedAt: content.provenance?.sourceCapturedAt || new Date(),
        notes: normalizeText(body.provenanceNotes)
      }
    };
  });

  return {
    payloads,
    linkedSentenceIds: [...allLinkedSentenceIds],
    linkedVocabularyIds: [...allLinkedVocabularyIds],
    transcriptInputDebug: {
      ...transcriptInputDebug,
      acceptedSegmentCount: segmentInputs.length
    }
  };
};

const buildTranscriptSummary = (segments = []) => {
  const candidateCount = segments.reduce((sum, segment) => sum + Number(segment.candidateCount || 0), 0);
  const linkedSentenceCount = segments.reduce(
    (sum, segment) => sum + Number(Array.isArray(segment.linkedSentenceIds) ? segment.linkedSentenceIds.length : 0),
    0
  );
  const linkedVocabularyCount = segments.reduce(
    (sum, segment) => sum + Number(Array.isArray(segment.linkedVocabularyIds) ? segment.linkedVocabularyIds.length : 0),
    0
  );

  return {
    segmentCount: segments.length,
    candidateCount,
    linkedSentenceCount,
    linkedVocabularyCount,
    validatedSegmentCount: segments.filter((segment) => segment.validationStatus === 'validated').length,
    linkedSegmentCount: segments.filter((segment) => segment.validationStatus === 'linked_to_trusted_record').length
  };
};

const ingestTranscriptSegments = async ({ contentId, user, body = {}, allowSystemIngestion = false, allowMissingTiming = false }) => {
  const content = await getAccessibleContentDocumentById({ id: contentId, user });

  if (!content) {
    throw new Error('Learning content not found.');
  }

  if (!allowSystemIngestion && String(content.createdBy) !== String(user._id)) {
    throw new Error('You can only save transcript segments for content you created.');
  }

  const replaceExisting = body.replaceExisting !== false;
  const { payloads, linkedSentenceIds, linkedVocabularyIds, transcriptInputDebug } = await createSegmentPayloads({
    content,
    user,
    body,
    allowMissingTiming
  });

  if (replaceExisting) {
    await TranscriptSegment.deleteMany({ contentId: content._id });
  }

  const segments = await TranscriptSegment.insertMany(payloads, { ordered: true });
  const existingLinkedSentenceIds = Array.isArray(content.linkedSentenceIds) ? content.linkedSentenceIds.map((id) => String(id)) : [];
  const existingLinkedVocabularyIds = Array.isArray(content.linkedVocabularyIds) ? content.linkedVocabularyIds.map((id) => String(id)) : [];

  content.linkedSentenceIds = [...new Set([...existingLinkedSentenceIds, ...linkedSentenceIds])];
  content.linkedVocabularyIds = [...new Set([...existingLinkedVocabularyIds, ...linkedVocabularyIds])];
  content.transcriptAvailable = true;
  content.transcriptSource =
    ['manual', 'youtube_caption', 'uploaded_file', 'trusted_link', 'future_pipeline'].includes(normalizeLower(body.transcriptSource))
      ? normalizeLower(body.transcriptSource)
      : 'manual';
  content.transcriptStatus = linkedSentenceIds.length > 0 || linkedVocabularyIds.length > 0 ? 'linked' : 'ready';
  content.transcript = payloads.map((segment) => segment.rawText).join('\n');
  content.metadata = {
    ...(content.metadata || {}),
    transcriptSegmentCount: payloads.length,
    transcriptCandidateCount: payloads.reduce((sum, segment) => sum + segment.extractionCandidates.length, 0)
  };
  await content.save();

  const serializedSegments = segments.map(serializeTranscriptSegment);

  return {
    items: serializedSegments,
    summary: buildTranscriptSummary(serializedSegments),
    contentTranscriptStatus: content.transcriptStatus,
    transcriptInputDebug
  };
};

const getTranscriptSegmentsForContent = async ({ contentId, user }) => {
  const content = await getAccessibleContentDocumentById({ id: contentId, user });

  if (!content) {
    return null;
  }

  const segments = await TranscriptSegment.find({ contentId: content._id })
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' })
    .populate({ path: 'linkedSentenceIds', select: 'text translations sourceProvider sourceId' })
    .populate({ path: 'extractionCandidates.linkedVocabularyId', select: 'term reading meanings sourceProvider sourceId' })
    .populate({ path: 'extractionCandidates.linkedSentenceId', select: 'text translations sourceProvider sourceId' })
    .sort({ segmentOrder: 1, startTimeSeconds: 1 });

  const serializedSegments = segments.map(serializeTranscriptSegment);

  return {
    items: serializedSegments,
    summary: buildTranscriptSummary(serializedSegments)
  };
};

module.exports = {
  __testables: {
    buildSegmentInputs,
    buildTranscriptInputDebug,
    parseTranscriptText
  },
  getTranscriptSegmentsForContent,
  ingestTranscriptSegments,
  serializeTranscriptSegment
};
