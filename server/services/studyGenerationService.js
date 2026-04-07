const Flashcard = require('../models/Flashcard');
const QuizItem = require('../models/QuizItem');
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

  return tokenCandidates[0] || '';
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

module.exports = {
  buildSentenceFlashcardPayload,
  buildSentenceQuizPayload,
  buildVocabularyFlashcardPayload,
  buildVocabularyQuizPayload,
  createFlashcardFromSentence,
  createFlashcardFromVocabulary,
  createQuizFromSentence,
  createQuizFromVocabulary
};
