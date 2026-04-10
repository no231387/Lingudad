const Flashcard = require('../models/Flashcard');
const QuizItem = require('../models/QuizItem');
const LearningContent = require('../models/LearningContent');
const { getVocabularyById } = require('./vocabularyService');
const { getSentenceById } = require('./sentenceService');

const FLASHCARD_POPULATION = [
  { path: 'owner', select: 'username' },
  { path: 'deck', select: 'name language description' },
  { path: 'tags', select: 'name' }
];

const normalizeText = (value) => String(value || '').trim();
const uniqueValues = (values) => [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeText(item)).filter(Boolean))];

const buildStudyMetadata = ({ source, entity, modelName }) => ({
  sourceProvider: source.sourceProvider,
  sourceType: source.sourceType,
  sourceId: source.sourceId,
  generatedFromModel: modelName,
  generatedFromId: String(entity._id || ''),
  topicTags: uniqueValues(entity.topicTags),
  registerTags: uniqueValues(entity.registerTags),
  skillTags: uniqueValues(entity.skillTags),
  difficulty: normalizeText(entity.difficulty)
});

const buildVocabularyFlashcardPayload = (vocabulary, user) => {
  const meanings = uniqueValues(vocabulary.meanings);

  if (!meanings.length) {
    throw new Error('Vocabulary item is missing source-backed meanings.');
  }

  return {
    wordOrPhrase: vocabulary.term,
    translation: meanings[0],
    reading: normalizeText(vocabulary.reading),
    meaning: meanings.join('; '),
    owner: user._id,
    deck: null,
    language: vocabulary.language,
    category: normalizeText(vocabulary.topicTags?.[0]) || 'Vocabulary',
    tags: [],
    exampleSentence: '',
    proficiency: 1,
    ...buildStudyMetadata({
      source: vocabulary,
      entity: vocabulary,
      modelName: 'Vocabulary'
    })
  };
};

const buildSentenceFlashcardPayload = (sentence, user) => {
  const translations = uniqueValues((sentence.translations || []).map((entry) => entry.text));

  if (!translations.length) {
    throw new Error('Sentence is missing source-backed translations.');
  }

  return {
    wordOrPhrase: sentence.text,
    translation: translations[0],
    reading: '',
    meaning: translations.join('; '),
    owner: user._id,
    deck: null,
    language: sentence.language,
    category: normalizeText(sentence.topicTags?.[0]) || 'Sentence',
    tags: [],
    exampleSentence: sentence.text,
    proficiency: 1,
    ...buildStudyMetadata({
      source: sentence,
      entity: sentence,
      modelName: 'Sentence'
    })
  };
};

const buildVocabularyQuizPayload = (vocabulary, user) => {
  const meanings = uniqueValues(vocabulary.meanings);

  if (!meanings.length) {
    throw new Error('Vocabulary item is missing source-backed meanings.');
  }

  return {
    owner: user._id,
    quizType: 'meaning_recall',
    prompt: `Meaning for: ${vocabulary.term}`,
    answers: meanings,
    correctAnswer: meanings[0],
    metadata: {
      reading: normalizeText(vocabulary.reading),
      translations: meanings,
      scaffoldOnly: false
    },
    ...buildStudyMetadata({
      source: vocabulary,
      entity: vocabulary,
      modelName: 'Vocabulary'
    })
  };
};

const isBlankCandidate = (value) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 && /[\p{L}\p{N}]/u.test(normalized);
};

const SENTENCE_END_PUNCTUATION_REGEX = /[\u3002\uFF01\uFF1F!?]/u;
const SENTENCE_STRIP_PUNCTUATION_REGEX = /[\u3001\u3002\uFF0C\uFF01\uFF1F!?]/gu;

const findSentenceClauseFallback = (sentence) => {
  const sentenceText = normalizeText(sentence.text);

  if (!sentenceText) {
    return '';
  }

  const clauseCandidates = sentenceText
    .split(SENTENCE_END_PUNCTUATION_REGEX)
    .map((part) => normalizeText(part))
    .filter((part) => isBlankCandidate(part));

  if (clauseCandidates.length) {
    return clauseCandidates[0];
  }

  const strippedText = normalizeText(sentenceText.replace(SENTENCE_STRIP_PUNCTUATION_REGEX, ''));
  return isBlankCandidate(strippedText) ? strippedText : '';
};

const findSentenceBlankTarget = (sentence) => {
  const linkedCandidates = (sentence.linkedVocabularyIds || [])
    .flatMap((entry) => [entry.term, entry.reading])
    .map((item) => normalizeText(item))
    .filter((item) => isBlankCandidate(item) && sentence.text.includes(item));

  if (linkedCandidates.length) {
    return linkedCandidates[0];
  }

  const tokenCandidates = (sentence.tokenized || [])
    .flatMap((token) => [token.surface, token.lemma])
    .map((item) => normalizeText(item))
    .filter((item) => isBlankCandidate(item) && sentence.text.includes(item));

  if (tokenCandidates.length) {
    return tokenCandidates[0];
  }

  // Fallback for scaffold-mode cloze generation: blank a real sentence clause
  // directly from the source-backed text when finer-grained token data is absent.
  return findSentenceClauseFallback(sentence);
};

const replaceFirstOccurrence = (text, target) => {
  const index = String(text || '').indexOf(target);

  if (index < 0) {
    return text;
  }

  return `${text.slice(0, index)}____${text.slice(index + target.length)}`;
};

const buildSentenceQuizPayload = (sentence, user) => {
  const translations = uniqueValues((sentence.translations || []).map((entry) => entry.text));
  const blankTarget = findSentenceBlankTarget(sentence);

  if (!blankTarget) {
    // No fallback guessing here: cloze seeds only blank source-backed sentence content.
    throw new Error('Sentence does not have a safe cloze target yet.');
  }

  return {
    owner: user._id,
    quizType: 'cloze',
    prompt: replaceFirstOccurrence(sentence.text, blankTarget),
    answers: [blankTarget],
    correctAnswer: blankTarget,
    metadata: {
      originalText: sentence.text,
      translations,
      scaffoldOnly: false
    },
    ...buildStudyMetadata({
      source: sentence,
      entity: sentence,
      modelName: 'Sentence'
    })
  };
};

const createFlashcardFromVocabulary = async ({ id, user }) => {
  const vocabulary = await getVocabularyById({ id, user });
  const flashcard = await Flashcard.create(buildVocabularyFlashcardPayload(vocabulary, user));
  await flashcard.populate(FLASHCARD_POPULATION);
  return flashcard;
};

const createFlashcardFromSentence = async ({ id, user }) => {
  const sentence = await getSentenceById({ id, user });
  const flashcard = await Flashcard.create(buildSentenceFlashcardPayload(sentence, user));
  await flashcard.populate(FLASHCARD_POPULATION);
  return flashcard;
};

const createQuizFromVocabulary = async ({ id, user }) => {
  const vocabulary = await getVocabularyById({ id, user });
  return QuizItem.create(buildVocabularyQuizPayload(vocabulary, user));
};

const createQuizFromSentence = async ({ id, user }) => {
  const sentence = await getSentenceById({ id, user });
  return QuizItem.create(buildSentenceQuizPayload(sentence, user));
};

const mergeContentStudyMetadata = ({ content, payload }) => ({
  ...payload,
  sourceType: 'media',
  sourceProvider: content.sourceProvider,
  sourceId: String(content._id),
  topicTags: uniqueValues([...(payload.topicTags || []), ...(content.topicTags || [])]),
  registerTags: uniqueValues([...(payload.registerTags || []), ...(content.registerTags || [])]),
  skillTags: uniqueValues([...(payload.skillTags || []), ...(content.skillTags || [])]),
  difficulty: normalizeText(content.difficulty) || normalizeText(payload.difficulty),
  exampleSentence: payload.exampleSentence || normalizeText(content.title)
});

const createFlashcardsFromContent = async ({ id, user, deckId = null }) => {
  const content = await LearningContent.findById(id)
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings language topicTags registerTags skillTags difficulty sourceProvider sourceType sourceId' })
    .populate({ path: 'linkedSentenceIds', select: 'text translations language topicTags registerTags skillTags difficulty sourceProvider sourceType sourceId linkedVocabularyIds' });

  if (!content) {
    throw new Error('Learning content not found.');
  }

  if (content.visibility === 'private' && String(content.createdBy) !== String(user._id)) {
    throw new Error('You can only generate study from private content you own.');
  }

  const sourceBackedSeeds = [
    ...(content.linkedVocabularyIds || []).map((entry) => ({
      key: `Vocabulary:${String(entry._id)}`,
      payload: mergeContentStudyMetadata({
        content,
        payload: buildVocabularyFlashcardPayload(entry, user)
      })
    })),
    ...(content.linkedSentenceIds || []).map((entry) => ({
      key: `Sentence:${String(entry._id)}`,
      payload: mergeContentStudyMetadata({
        content,
        payload: buildSentenceFlashcardPayload(entry, user)
      })
    }))
  ];

  if (sourceBackedSeeds.length === 0) {
    return {
      created: [],
      skipped: [],
      createdCount: 0,
      skippedCount: 0,
      message: 'No linked source-backed vocabulary or sentences are attached to this content yet.'
    };
  }

  const existingFlashcards = await Flashcard.find({
    owner: user._id,
    sourceProvider: content.sourceProvider,
    sourceId: String(content._id),
    $or: sourceBackedSeeds.map((entry) => ({
      generatedFromModel: entry.key.split(':')[0],
      generatedFromId: entry.key.split(':')[1]
    }))
  }).select('generatedFromModel generatedFromId');

  const existingKeys = new Set(
    existingFlashcards.map((flashcard) => `${normalizeText(flashcard.generatedFromModel)}:${normalizeText(flashcard.generatedFromId)}`)
  );

  const created = [];
  const skipped = [];

  for (const entry of sourceBackedSeeds) {
    if (existingKeys.has(entry.key)) {
      skipped.push({
        reason: 'already_exists',
        generatedFrom: entry.key
      });
      continue;
    }

    const payload = {
      ...entry.payload,
      deck: deckId || null
    };
    const flashcard = await Flashcard.create(payload);
    await flashcard.populate(FLASHCARD_POPULATION);
    created.push(flashcard);
  }

  return {
    created,
    skipped,
    createdCount: created.length,
    skippedCount: skipped.length,
    message:
      created.length > 0
        ? `Created ${created.length} flashcard${created.length === 1 ? '' : 's'} from linked trusted study sources.`
        : 'All linked study items from this content were already in your flashcards.'
  };
};

module.exports = {
  buildSentenceFlashcardPayload,
  buildSentenceQuizPayload,
  buildVocabularyFlashcardPayload,
  buildVocabularyQuizPayload,
  createFlashcardsFromContent,
  createFlashcardFromSentence,
  createFlashcardFromVocabulary,
  createQuizFromSentence,
  createQuizFromVocabulary
};
