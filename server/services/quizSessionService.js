const mongoose = require('mongoose');
const QuizItem = require('../models/QuizItem');
const QuizSession = require('../models/QuizSession');
const { getAccessibleContentDocumentById } = require('./contentService');
const { upsertProgress } = require('./userProgressService');

const PLAYABLE_QUIZ_TYPES = new Set(['meaning_recall', 'cloze']);
const TRUSTED_PROGRESS_TYPE_BY_MODEL = Object.freeze({
  Vocabulary: 'vocab',
  Sentence: 'sentence'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeAnswer = (value) => normalizeText(value).replace(/\s+/g, ' ').toLowerCase();
const uniqueValues = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];
const formatQuizTypeLabel = (quizType) => {
  const normalizedType = normalizeText(quizType).toLowerCase();

  if (normalizedType === 'meaning_recall') {
    return 'Meaning recall';
  }

  if (normalizedType === 'cloze') {
    return 'Fill in the blank';
  }

  return normalizedType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildAcceptedAnswers = (quizItem) => uniqueValues([...(quizItem.answers || []), quizItem.correctAnswer]);

const isPlayableQuizItem = (quizItem) =>
  quizItem &&
  PLAYABLE_QUIZ_TYPES.has(normalizeText(quizItem.quizType)) &&
  normalizeText(quizItem.prompt) &&
  buildAcceptedAnswers(quizItem).length > 0;

const buildPromptSupport = (quizItem) => {
  if (quizItem.quizType === 'meaning_recall') {
    return {
      reading: normalizeText(quizItem.metadata?.reading)
    };
  }

  return {};
};

const serializeResult = (result, quizItem) => ({
  quizItemId: String(result.quizItem),
  quizType: result.quizType,
  submittedAnswer: result.submittedAnswer,
  acceptedAnswers: uniqueValues(result.acceptedAnswers),
  canonicalAnswer: result.canonicalAnswer,
  isCorrect: Boolean(result.isCorrect),
  skipped: Boolean(result.skipped),
  responseMs: Number(result.responseMs || 0),
  ratingApplied: normalizeText(result.ratingApplied),
  answeredAt: result.answeredAt,
  progressRecorded: Boolean(result.progressRecorded),
  progressTarget: result.progressTarget?.itemType
    ? {
        model: normalizeText(result.progressTarget.model),
        itemType: normalizeText(result.progressTarget.itemType),
        itemId: result.progressTarget.itemId ? String(result.progressTarget.itemId) : ''
      }
    : null,
  feedback: {
    translations: uniqueValues(quizItem?.metadata?.translations),
    originalText: normalizeText(quizItem?.metadata?.originalText),
    reading: normalizeText(quizItem?.metadata?.reading)
  }
});

const serializeQuizItemForPlay = (quizItem, result = null) => ({
  id: String(quizItem._id),
  quizType: quizItem.quizType,
  quizTypeLabel: formatQuizTypeLabel(quizItem.quizType),
  prompt: quizItem.prompt,
  responseMode: 'text',
  placeholder: quizItem.quizType === 'meaning_recall' ? 'Type the meaning' : 'Type the missing text',
  promptSupport: buildPromptSupport(quizItem),
  topicTags: uniqueValues(quizItem.topicTags),
  registerTags: uniqueValues(quizItem.registerTags),
  createdAt: quizItem.createdAt,
  provenance: {
    generatedFromModel: normalizeText(quizItem.generatedFromModel),
    generatedFromId: normalizeText(quizItem.generatedFromId),
    sourceProvider: normalizeText(quizItem.sourceProvider),
    sourceType: normalizeText(quizItem.sourceType),
    sourceId: normalizeText(quizItem.sourceId)
  },
  result: result ? serializeResult(result, quizItem) : null
});

const serializeQuizSession = (session, quizItems) => {
  const resultMap = new Map((session.results || []).map((result) => [String(result.quizItem), result]));
  const items = quizItems.map((quizItem) => serializeQuizItemForPlay(quizItem, resultMap.get(String(quizItem._id)) || null));

  return {
    id: String(session._id),
    sessionSource: normalizeText(session.sessionSource),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    itemCount: Number(session.itemCount || items.length),
    answeredCount: Number(session.answeredCount || 0),
    correctCount: Number(session.correctCount || 0),
    incorrectCount: Number(session.incorrectCount || 0),
    skippedCount: Number(session.skippedCount || 0),
    sourceMetadata: session.sourceMetadata && typeof session.sourceMetadata === 'object' ? session.sourceMetadata : {},
    items
  };
};

const serializeQuizSeedSummary = (quizItem) => ({
  id: String(quizItem._id),
  quizType: quizItem.quizType,
  quizTypeLabel: formatQuizTypeLabel(quizItem.quizType),
  prompt: normalizeText(quizItem.prompt),
  answerPreview: normalizeText(quizItem.correctAnswer),
  createdAt: quizItem.createdAt,
  topicTags: uniqueValues(quizItem.topicTags),
  registerTags: uniqueValues(quizItem.registerTags),
  promptSupport: buildPromptSupport(quizItem),
  provenance: {
    generatedFromModel: normalizeText(quizItem.generatedFromModel),
    generatedFromId: normalizeText(quizItem.generatedFromId),
    sourceProvider: normalizeText(quizItem.sourceProvider),
    sourceType: normalizeText(quizItem.sourceType),
    sourceId: normalizeText(quizItem.sourceId)
  }
});

const serializeQuizSessionSummary = (session, quizItems) => {
  const answeredItems = (session.results || []).map((result) => String(result.quizItem));
  const latestResult = (session.results || []).slice(-1)[0] || null;
  const firstPrompt = quizItems[0]?.prompt || '';

  return {
    id: String(session._id),
    itemCount: Number(session.itemCount || 0),
    answeredCount: Number(session.answeredCount || 0),
    correctCount: Number(session.correctCount || 0),
    incorrectCount: Number(session.incorrectCount || 0),
    skippedCount: Number(session.skippedCount || 0),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    sessionSource: normalizeText(session.sessionSource),
    firstPrompt,
    latestAnsweredAt: latestResult?.answeredAt || session.completedAt || session.updatedAt,
    quizTypeLabels: [...new Set(quizItems.map((item) => formatQuizTypeLabel(item.quizType)).filter(Boolean))],
    pendingCount: Math.max(0, Number(session.itemCount || 0) - answeredItems.length)
  };
};

const synchronizeSessionState = async (session) => {
  const priorAnsweredCount = Number(session.answeredCount || 0);
  const priorCorrectCount = Number(session.correctCount || 0);
  const priorIncorrectCount = Number(session.incorrectCount || 0);
  const priorSkippedCount = Number(session.skippedCount || 0);
  const hadCompletedAt = Boolean(session.completedAt);

  recalculateSessionCounts(session);

  const hasChanges =
    priorAnsweredCount !== Number(session.answeredCount || 0) ||
    priorCorrectCount !== Number(session.correctCount || 0) ||
    priorIncorrectCount !== Number(session.incorrectCount || 0) ||
    priorSkippedCount !== Number(session.skippedCount || 0) ||
    hadCompletedAt !== Boolean(session.completedAt);

  if (hasChanges) {
    await session.save();
  }

  return session;
};

const getOwnedSession = async ({ sessionId, userId }) => {
  const session = await QuizSession.findOne({ _id: sessionId, owner: userId });

  if (!session) {
    throw new Error('Quiz session not found.');
  }

  return session;
};

const getOwnedQuizItemsForSession = async ({ session, userId }) => {
  const quizItems = await QuizItem.find({
    _id: { $in: session.quizItems || [] },
    owner: userId
  }).sort({ createdAt: -1 });

  const orderedMap = new Map(quizItems.map((item) => [String(item._id), item]));
  return (session.quizItems || []).map((id) => orderedMap.get(String(id))).filter(Boolean);
};

const recalculateSessionCounts = (session) => {
  session.answeredCount = session.results.length;
  session.correctCount = session.results.filter((result) => result.isCorrect).length;
  session.skippedCount = session.results.filter((result) => result.skipped).length;
  session.incorrectCount = session.results.filter((result) => !result.isCorrect && !result.skipped).length;

  if (session.answeredCount >= session.itemCount && session.itemCount > 0 && !session.completedAt) {
    session.completedAt = new Date();
  }
};

const resolveLaunchItems = async ({ userId, quizItemIds = [], limit = 5 }) => {
  const requestedQuizItemIds = Array.isArray(quizItemIds) ? quizItemIds : [];
  const normalizedIds = [
    ...new Set(
      requestedQuizItemIds
        .map((id) => normalizeText(id))
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    )
  ];
  const safeLimit = Math.min(20, Math.max(1, Number(limit || 5)));

  if (requestedQuizItemIds.length > 0 && normalizedIds.length === 0) {
    return {
      playableItems: [],
      skippedItems: [],
      invalidRequestedIds: requestedQuizItemIds.map((id) => normalizeText(id)).filter(Boolean),
      missingRequestedIds: []
    };
  }

  const query = normalizedIds.length
    ? { _id: { $in: normalizedIds }, owner: userId }
    : { owner: userId };

  const quizItems = await QuizItem.find(query)
    .sort(normalizedIds.length ? { createdAt: -1 } : { createdAt: -1 })
    .limit(normalizedIds.length ? normalizedIds.length : safeLimit);

  const orderedItems = normalizedIds.length
    ? normalizedIds.map((id) => quizItems.find((item) => String(item._id) === id)).filter(Boolean)
    : quizItems;

  const playableItems = orderedItems.filter(isPlayableQuizItem);
  const skippedItems = orderedItems.filter((item) => !isPlayableQuizItem(item));
  const missingRequestedIds = normalizedIds.filter((id) => !orderedItems.some((item) => String(item._id) === id));

  return {
    playableItems,
    skippedItems,
    invalidRequestedIds: requestedQuizItemIds
      .map((id) => normalizeText(id))
      .filter((id) => id && !mongoose.Types.ObjectId.isValid(id)),
    missingRequestedIds
  };
};

const launchQuizSession = async ({ userId, quizItemIds = [], limit = 5 }) => {
  const { playableItems, skippedItems, invalidRequestedIds, missingRequestedIds } = await resolveLaunchItems({
    userId,
    quizItemIds,
    limit
  });

  if (playableItems.length === 0) {
    throw new Error(
      Array.isArray(quizItemIds) && quizItemIds.length > 0
        ? 'No playable quiz items were found for the requested selection.'
        : 'No playable quiz items are available yet.'
    );
  }

  const session = await QuizSession.create({
    owner: userId,
    quizItems: playableItems.map((item) => item._id),
    sessionSource: 'quiz_item',
    sourceMetadata: {
      requestedQuizItemIds: [...new Set((Array.isArray(quizItemIds) ? quizItemIds : []).map((id) => normalizeText(id)).filter(Boolean))],
      skippedQuizItemIds: skippedItems.map((item) => String(item._id)),
      invalidRequestedIds,
      missingRequestedIds
    },
    itemCount: playableItems.length,
    answeredCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    skippedCount: 0,
    results: []
  });

  return serializeQuizSession(session, playableItems);
};

const evaluateQuizAnswer = async ({ sessionId, userId, quizItemId, answer = '', eventType = 'answer', responseMs = 0 }) => {
  const session = await getOwnedSession({ sessionId, userId });
  const normalizedEventType = normalizeText(eventType).toLowerCase();

  if (normalizedEventType !== 'answer' && normalizedEventType !== 'skip') {
    throw new Error('Quiz event must be answer or skip.');
  }

  if (!session.quizItems.some((itemId) => String(itemId) === String(quizItemId))) {
    throw new Error('Quiz item is not part of this session.');
  }

  const existingResult = session.results.find((result) => String(result.quizItem) === String(quizItemId));
  const quizItems = await getOwnedQuizItemsForSession({ session, userId });
  const quizItem = quizItems.find((item) => String(item._id) === String(quizItemId));

  if (!quizItem) {
    throw new Error('Quiz item not found.');
  }

  if (existingResult) {
    return {
      session: serializeQuizSession(session, quizItems),
      result: serializeResult(existingResult, quizItem),
      isFinished: Boolean(session.completedAt)
    };
  }

  if (!isPlayableQuizItem(quizItem)) {
    throw new Error('Quiz item is not playable.');
  }

  const acceptedAnswers = buildAcceptedAnswers(quizItem);
  const normalizedAcceptedAnswers = acceptedAnswers.map((item) => normalizeAnswer(item));
  const submittedAnswer = normalizeText(answer);
  const normalizedSubmittedAnswer = normalizeAnswer(answer);
  const skipped = normalizedEventType === 'skip';
  const isCorrect = !skipped && normalizedAcceptedAnswers.includes(normalizedSubmittedAnswer);
  const ratingApplied = skipped ? 'skip' : isCorrect ? 'good' : 'again';
  const progressItemType = TRUSTED_PROGRESS_TYPE_BY_MODEL[normalizeText(quizItem.generatedFromModel)];
  let progressRecorded = false;
  let progressTarget = null;

  if (progressItemType && mongoose.Types.ObjectId.isValid(normalizeText(quizItem.generatedFromId))) {
    await upsertProgress({
      userId,
      itemType: progressItemType,
      itemId: quizItem.generatedFromId,
      correctDelta: isCorrect ? 1 : 0,
      incorrectDelta: !isCorrect && !skipped ? 1 : 0,
      rating: ratingApplied,
      durationMs: responseMs
    });

    progressRecorded = true;
    progressTarget = {
      model: normalizeText(quizItem.generatedFromModel),
      itemType: progressItemType,
      itemId: quizItem.generatedFromId
    };
  }

  session.results.push({
    quizItem: quizItem._id,
    quizType: quizItem.quizType,
    generatedFromModel: normalizeText(quizItem.generatedFromModel),
    generatedFromId: normalizeText(quizItem.generatedFromId),
    sourceProvider: normalizeText(quizItem.sourceProvider),
    sourceType: normalizeText(quizItem.sourceType),
    sourceId: normalizeText(quizItem.sourceId),
    submittedAnswer,
    normalizedAnswer: normalizedSubmittedAnswer,
    acceptedAnswers,
    canonicalAnswer: normalizeText(quizItem.correctAnswer) || acceptedAnswers[0] || '',
    isCorrect,
    skipped,
    responseMs: Math.max(0, Number(responseMs || 0)),
    ratingApplied,
    progressRecorded,
    progressTarget
  });

  recalculateSessionCounts(session);
  await session.save();

  const savedResult = session.results.find((result) => String(result.quizItem) === String(quizItemId));

  return {
    session: serializeQuizSession(session, quizItems),
    result: serializeResult(savedResult, quizItem),
    isFinished: Boolean(session.completedAt)
  };
};

const getQuizSession = async ({ sessionId, userId }) => {
  const session = await synchronizeSessionState(await getOwnedSession({ sessionId, userId }));
  const quizItems = await getOwnedQuizItemsForSession({ session, userId });
  return serializeQuizSession(session, quizItems);
};

const completeQuizSession = async ({ sessionId, userId }) => {
  const session = await synchronizeSessionState(await getOwnedSession({ sessionId, userId }));
  const quizItems = await getOwnedQuizItemsForSession({ session, userId });

  if (!session.completedAt) {
    session.completedAt = new Date();
    await session.save();
  }

  return serializeQuizSession(session, quizItems);
};

const listPlayableQuizItems = async ({ user, limit = 12, learningContentId = null }) => {
  const userId = user?._id;
  if (!userId) {
    throw new Error('User is required.');
  }

  const safeLimit = Math.min(24, Math.max(1, Number(limit || 12)));

  if (learningContentId) {
    const contentDoc = await getAccessibleContentDocumentById({ id: learningContentId, user });

    if (!contentDoc) {
      return {
        items: [],
        total: 0,
        supportedQuizTypes: [...PLAYABLE_QUIZ_TYPES]
      };
    }

    const vocabIds = (contentDoc.linkedVocabularyIds || []).map((id) => String(id));
    const sentenceIds = (contentDoc.linkedSentenceIds || []).map((id) => String(id));

    if (!vocabIds.length && !sentenceIds.length) {
      return {
        items: [],
        total: 0,
        supportedQuizTypes: [...PLAYABLE_QUIZ_TYPES]
      };
    }

    const orClauses = [];
    if (vocabIds.length) {
      orClauses.push({ generatedFromModel: 'Vocabulary', generatedFromId: { $in: vocabIds } });
    }
    if (sentenceIds.length) {
      orClauses.push({ generatedFromModel: 'Sentence', generatedFromId: { $in: sentenceIds } });
    }

    const quizItems = await QuizItem.find({
      owner: userId,
      $or: orClauses
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit * 4);

    const playableItems = quizItems.filter(isPlayableQuizItem).slice(0, safeLimit);

    return {
      items: playableItems.map(serializeQuizSeedSummary),
      total: playableItems.length,
      supportedQuizTypes: [...PLAYABLE_QUIZ_TYPES]
    };
  }

  const quizItems = await QuizItem.find({ owner: userId }).sort({ createdAt: -1 }).limit(safeLimit * 3);
  const playableItems = quizItems.filter(isPlayableQuizItem).slice(0, safeLimit);

  return {
    items: playableItems.map(serializeQuizSeedSummary),
    total: playableItems.length,
    supportedQuizTypes: [...PLAYABLE_QUIZ_TYPES]
  };
};

const listRecentQuizSessions = async ({ userId, limit = 10 }) => {
  const safeLimit = Math.min(20, Math.max(1, Number(limit || 10)));
  const rawSessions = await QuizSession.find({ owner: userId }).sort({ updatedAt: -1 }).limit(safeLimit);
  const sessions = [];

  for (const session of rawSessions) {
    sessions.push(await synchronizeSessionState(session));
  }

  const quizItemIds = [...new Set(sessions.flatMap((session) => (session.quizItems || []).map((itemId) => String(itemId))))];
  const quizItems = quizItemIds.length
    ? await QuizItem.find({ _id: { $in: quizItemIds }, owner: userId }).select('prompt quizType')
    : [];
  const quizItemMap = new Map(quizItems.map((item) => [String(item._id), item]));

  return {
    items: sessions.map((session) =>
      serializeQuizSessionSummary(
        session,
        (session.quizItems || []).map((itemId) => quizItemMap.get(String(itemId))).filter(Boolean)
      )
    ),
    total: sessions.length
  };
};

module.exports = {
  PLAYABLE_QUIZ_TYPES,
  completeQuizSession,
  evaluateQuizAnswer,
  getQuizSession,
  listPlayableQuizItems,
  listRecentQuizSessions,
  launchQuizSession
};
