const Sentence = require('../models/Sentence');
const Vocabulary = require('../models/Vocabulary');
const tatoebaAdapter = require('../providers/tatoebaAdapter');
const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('./sourceCatalogService');
const { getPresetById } = require('./presetService');
const { resolveLanguage } = require('./vocabularyService');

const LEVEL_WEIGHTS = Object.freeze({
  beginner: ['starter', 'beginner', 'basic'],
  intermediate: ['intermediate', 'common'],
  advanced: ['advanced', 'rare', 'broad']
});

const GOAL_WEIGHT_RULES = Object.freeze({
  reading: ['reading', 'written', 'kanji'],
  listening: ['listening', 'spoken', 'common'],
  vocabulary: ['vocabulary', 'core_vocab', 'context'],
  speaking: ['speaking', 'spoken', 'dialogue'],
  kanji: ['kanji', 'written']
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeTagList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeLower(item)).filter(Boolean))];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildLanguageFilter = (languageInput) => {
  const canonicalLanguage = resolveLanguage(languageInput);
  const aliases = canonicalLanguage === 'Japanese' ? ['ja', 'japanese'] : [normalizeLower(canonicalLanguage)];
  return {
    $in: [...new Set([canonicalLanguage, ...aliases])]
  };
};

const buildSearchFilters = ({ q, language, difficulty, topic, register }) => {
  const filters = {
    language: buildLanguageFilter(language)
  };

  if (difficulty) {
    filters.difficulty = new RegExp(`^${escapeRegex(normalizeText(difficulty))}$`, 'i');
  }

  if (topic) {
    filters.topicTags = new RegExp(`^${escapeRegex(normalizeText(topic))}$`, 'i');
  }

  if (register) {
    filters.registerTags = new RegExp(`^${escapeRegex(normalizeText(register))}$`, 'i');
  }

  if (q) {
    const pattern = new RegExp(escapeRegex(normalizeText(q)), 'i');
    filters.$and = [
      ...(filters.$and || []),
      {
        $or: [{ text: pattern }, { 'translations.text': pattern }]
      }
    ];
  }

  return filters;
};

const buildSentenceFlashcardSeed = (sentence) => ({
  wordOrPhrase: sentence.text,
  translation: sentence.translations?.[0]?.text || '',
  reading: '',
  meaning: Array.isArray(sentence.translations) ? sentence.translations.map((item) => item.text).join('; ') : '',
  language: sentence.language,
  category: sentence.topicTags?.[0] || 'Sentence',
  sourceType: sentence.sourceType || SOURCE_TYPES.SENTENCE,
  sourceProvider: sentence.sourceProvider || SOURCE_PROVIDERS.TATOEBA,
  sourceId: sentence.sourceId || ''
});

const buildSentenceClozeSeed = (sentence) => {
  const linkedTerms = (sentence.linkedVocabularyIds || [])
    .map((entry) => entry.term || entry.wordOrPhrase || '')
    .filter(Boolean);

  return {
    mode: 'cloze',
    text: sentence.text,
    hiddenTerms: linkedTerms.slice(0, 3),
    sourceType: sentence.sourceType || SOURCE_TYPES.SENTENCE,
    sourceProvider: sentence.sourceProvider || SOURCE_PROVIDERS.TATOEBA,
    sourceId: sentence.sourceId || ''
  };
};

const buildRecommendationDebug = ({ item, preset, presetScore, userScore, breakdown }) => ({
  registerTags: Array.isArray(item.registerTags) ? item.registerTags : [],
  skillTags: Array.isArray(item.skillTags) ? item.skillTags : [],
  difficulty: item.difficulty || '',
  activePreset: preset
    ? {
        id: preset.id,
        name: preset.name
      }
    : null,
  scoreBreakdown: {
    userScore,
    presetScore,
    totalScore: userScore + presetScore,
    ...breakdown
  }
});

const serializeSentence = (item) => {
  const sentence = typeof item.toObject === 'function' ? item.toObject() : { ...item };

  return {
    ...sentence,
    primaryTranslation: sentence.translations?.[0]?.text || '',
    flashcardSeed: buildSentenceFlashcardSeed(sentence),
    clozeSeed: buildSentenceClozeSeed(sentence)
  };
};

const linkSentenceToVocabulary = async (sentenceInput) => {
  const sentence =
    sentenceInput instanceof Sentence ? sentenceInput : await Sentence.findById(sentenceInput).populate('linkedVocabularyIds');

  if (!sentence) {
    throw new Error('Sentence not found.');
  }

  const language = resolveLanguage(sentence.language);
  const vocabCandidates = await Vocabulary.find({
    language: buildLanguageFilter(language)
  })
    .select('term reading')
    .limit(300);

  const matchedIds = vocabCandidates
    .filter((entry) => {
      const term = normalizeText(entry.term);
      const reading = normalizeText(entry.reading);
      return (term && sentence.text.includes(term)) || (reading && sentence.text.includes(reading));
    })
    .slice(0, 12)
    .map((entry) => entry._id);

  sentence.linkedVocabularyIds = matchedIds;
  await sentence.save();
  await sentence.populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' });

  return serializeSentence(sentence);
};

const scoreSentenceForUser = (item, user) => {
  let score = 0;
  const difficulty = normalizeLower(item.difficulty);
  const userLevel = normalizeLower(user?.level);
  const goals = normalizeTagList(user?.goals);
  const topics = normalizeTagList(item.topicTags);
  const registers = normalizeTagList(item.registerTags);
  const skills = normalizeTagList(item.skillTags);

  if (LEVEL_WEIGHTS[userLevel]?.includes(difficulty)) {
    score += 4;
  } else if (difficulty === 'common') {
    score += 2;
  } else if (!difficulty && userLevel === 'beginner') {
    score += 1;
  }

  goals.forEach((goal) => {
    const weighted = GOAL_WEIGHT_RULES[goal] || [];

    if (weighted.some((tag) => skills.includes(tag) || topics.includes(tag) || registers.includes(tag))) {
      score += 3;
    }
  });

  if (item.linkedVocabularyIds?.length) {
    score += 1;
  }

  return score;
};

const scoreSentenceForPreset = (item, preset) => {
  if (!preset) {
    return {
      score: 0,
      breakdown: {
        registerMatches: 0,
        skillMatches: 0,
        difficultyMatches: 0,
        registerPenalty: 0,
        unlabeledRegister: false
      }
    };
  }

  let score = 0;
  const registers = normalizeTagList(item.registerTags);
  const skills = normalizeTagList(item.skillTags);
  const difficulty = normalizeLower(item.difficulty);

  const registerMatches = preset.registerTags.filter((tag) => registers.includes(normalizeLower(tag))).length;
  const skillMatches = preset.skillTags.filter((tag) => skills.includes(normalizeLower(tag))).length;
  const difficultyMatches = preset.targetDifficulty.filter((tag) => normalizeLower(tag) === difficulty).length;
  const hasRegisterTags = registers.length > 0;
  const registerPenalty = hasRegisterTags && registerMatches === 0 ? -12 : 0;

  score += registerMatches * 14;
  score += skillMatches * 4;
  score += difficultyMatches * 2;
  score += registerPenalty;

  return {
    score,
    breakdown: {
      registerMatches,
      skillMatches,
      difficultyMatches,
      registerPenalty,
      unlabeledRegister: !hasRegisterTags
    }
  };
};

const searchSentences = async ({ query = {} }) => {
  const filters = buildSearchFilters(query);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const results = await Sentence.find(filters)
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' })
    .sort({ createdAt: -1 })
    .limit(limit);

  return results.map(serializeSentence);
};

const getSentenceById = async ({ id, user }) => {
  const item = await Sentence.findById(id).populate({
    path: 'linkedVocabularyIds',
    select: 'term reading meanings sourceProvider sourceId'
  });

  if (!item) {
    throw new Error('Sentence not found.');
  }

  const requestedLanguage = resolveLanguage(user?.language);
  const itemLanguage = resolveLanguage(item.language);

  if (requestedLanguage && requestedLanguage !== itemLanguage) {
    throw new Error('Sentence not found.');
  }

  if (!item.linkedVocabularyIds?.length) {
    return linkSentenceToVocabulary(item);
  }

  return serializeSentence(item);
};

const getRecommendedSentences = async ({ user, query = {} }) => {
  const requestedLanguage = query.language || user?.language || 'Japanese';
  const preset = getPresetById(query.preset);
  const filters = buildSearchFilters({
    language: preset?.language || requestedLanguage,
    difficulty: query.difficulty,
    topic: query.topic,
    register: query.register
  });

  const items = await Sentence.find(filters)
    .populate({ path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' })
    .limit(60);

  const sortedItems = items
    .map((item) => ({
      item,
      userScore: scoreSentenceForUser(item, user),
      presetResult: scoreSentenceForPreset(item, preset)
    }))
    .sort((left, right) => {
      const leftScore = left.userScore + left.presetResult.score;
      const rightScore = right.userScore + right.presetResult.score;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.item.text.localeCompare(right.item.text);
    })
    .slice(0, Math.min(20, Math.max(1, Number(query.limit) || 8)));

  return {
    items: sortedItems.map(({ item, userScore, presetResult }) => ({
      ...serializeSentence(item),
      recommendationDebug: buildRecommendationDebug({
        item,
        preset,
        presetScore: presetResult.score,
        userScore,
        breakdown: presetResult.breakdown
      })
    })),
    personalization: {
      language: resolveLanguage(preset?.language || requestedLanguage),
      level: user?.level || '',
      goals: Array.isArray(user?.goals) ? user.goals : [],
      preset: preset
        ? {
            id: preset.id,
            name: preset.name,
            registerTags: preset.registerTags,
            skillTags: preset.skillTags,
            targetDifficulty: preset.targetDifficulty
          }
        : null
    }
  };
};

const normalizeSentenceRecord = (payload = {}, providerKey = 'tatoeba') => {
  if (providerKey === 'tatoeba') {
    return tatoebaAdapter.normalizeTatoebaSentence(payload);
  }

  throw new Error(`Unsupported sentence provider: ${providerKey}`);
};

module.exports = {
  buildSentenceClozeSeed,
  buildSentenceFlashcardSeed,
  getRecommendedSentences,
  getSentenceById,
  linkSentenceToVocabulary,
  normalizeSentenceRecord,
  searchSentences
};
