const Vocabulary = require('../models/Vocabulary');
const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('./sourceCatalogService');
const jmdictAdapter = require('../providers/jmdictAdapter');

const LANGUAGE_ALIASES = Object.freeze({
  ja: 'Japanese',
  japanese: 'Japanese'
});

const LEVEL_WEIGHTS = Object.freeze({
  beginner: ['starter', 'beginner', 'basic'],
  intermediate: ['intermediate', 'common'],
  advanced: ['advanced', 'rare', 'broad']
});

const GOAL_WEIGHT_RULES = Object.freeze({
  vocabulary: ['vocabulary', 'core_vocab', 'core'],
  reading: ['reading', 'written', 'kanji', 'literary'],
  listening: ['listening', 'spoken', 'common'],
  kanji: ['kanji', 'written'],
  speaking: ['speaking', 'spoken', 'common']
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeTagList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLower(value)).filter(Boolean))];

const resolveLanguage = (languageInput) => {
  const normalized = normalizeLower(languageInput);

  if (!normalized) {
    return 'Japanese';
  }

  return LANGUAGE_ALIASES[normalized] || normalizeText(languageInput);
};

const buildLanguageFilter = (languageInput) => {
  const canonicalLanguage = resolveLanguage(languageInput);
  const aliasKeys = Object.keys(LANGUAGE_ALIASES).filter((key) => LANGUAGE_ALIASES[key] === canonicalLanguage);
  return {
    $in: [...new Set([canonicalLanguage, ...aliasKeys])]
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasKanji = (value) => /[\u3400-\u9fbf]/.test(String(value || ''));

const serializeVocabulary = (item) => {
  const vocabulary = typeof item.toObject === 'function' ? item.toObject() : { ...item };

  return {
    ...vocabulary,
    primaryMeaning: vocabulary.meanings?.[0] || '',
    flashcardSeed: buildFlashcardSeedFromVocabulary(vocabulary)
  };
};

const buildFlashcardSeedFromVocabulary = (vocabulary) => ({
  wordOrPhrase: vocabulary.term,
  translation: vocabulary.meanings?.[0] || '',
  reading: vocabulary.reading || '',
  meaning: Array.isArray(vocabulary.meanings) ? vocabulary.meanings.join('; ') : '',
  language: vocabulary.language,
  category: 'Vocabulary',
  sourceType: vocabulary.sourceType || SOURCE_TYPES.DICTIONARY,
  sourceProvider: vocabulary.sourceProvider || SOURCE_PROVIDERS.USER,
  sourceId: vocabulary.sourceId || ''
});

const buildSearchFilters = ({ q, language, difficulty, topic, register }) => {
  const filters = {
    language: buildLanguageFilter(language)
  };

  if (difficulty) {
    filters.$or = [
      { difficulty: new RegExp(`^${escapeRegex(normalizeText(difficulty))}$`, 'i') },
      { 'difficultyProfile.general': new RegExp(`^${escapeRegex(normalizeText(difficulty))}$`, 'i') }
    ];
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
        $or: [{ term: pattern }, { reading: pattern }, { meanings: pattern }]
      }
    ];
  }

  return filters;
};

const scoreVocabularyForUser = (item, user) => {
  let score = 0;
  const difficulty = normalizeLower(item.difficulty || item.difficultyProfile?.general);
  const userLevel = normalizeLower(user?.level);
  const userGoals = normalizeTagList(user?.goals);
  const preferredTopics = normalizeTagList(user?.preferredTopics);
  const preferredRegister = normalizeTagList(user?.preferredRegister);
  const itemTopics = normalizeTagList(item.topicTags);
  const itemRegisters = normalizeTagList(item.registerTags);
  const itemSkills = normalizeTagList(item.skillTags);

  if (LEVEL_WEIGHTS[userLevel]?.includes(difficulty)) {
    score += 4;
  } else if (!difficulty && userLevel === 'beginner') {
    score += 2;
  } else if (difficulty === 'common') {
    score += 2;
  }

  userGoals.forEach((goal) => {
    const weightedTags = GOAL_WEIGHT_RULES[goal] || [];
    if (weightedTags.some((tag) => itemSkills.includes(tag) || itemTopics.includes(tag) || itemRegisters.includes(tag))) {
      score += 3;
    }

    if (goal === 'reading' && hasKanji(item.term) && item.term !== item.reading) {
      score += 2;
    }

    if (goal === 'listening' && itemRegisters.includes('spoken')) {
      score += 2;
    }
  });

  preferredTopics.forEach((topic) => {
    if (itemTopics.includes(topic)) {
      score += 2;
    }
  });

  preferredRegister.forEach((register) => {
    if (itemRegisters.includes(register)) {
      score += 2;
    }
  });

  if (item.sourceProvider === SOURCE_PROVIDERS.JMDICT) {
    score += 1;
  }

  return score;
};

const searchVocabulary = async ({ query = {} }) => {
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filters = buildSearchFilters(query);
  const results = await Vocabulary.find(filters).sort({ term: 1, reading: 1 }).limit(limit);
  return results.map(serializeVocabulary);
};

const getVocabularyById = async ({ id, user }) => {
  const item = await Vocabulary.findById(id);

  if (!item) {
    throw new Error('Vocabulary item not found.');
  }

  const requestedLanguage = resolveLanguage(user?.language);
  const itemLanguage = resolveLanguage(item.language);

  if (requestedLanguage && itemLanguage !== requestedLanguage) {
    throw new Error('Vocabulary item not found.');
  }

  return serializeVocabulary(item);
};

const getRecommendedVocabulary = async ({ user, query = {} }) => {
  const requestedLanguage = query.language || user?.language || 'Japanese';
  const filters = buildSearchFilters({
    language: requestedLanguage,
    difficulty: query.difficulty,
    topic: query.topic,
    register: query.register
  });

  const items = await Vocabulary.find(filters).limit(60);
  const sortedItems = items
    .map((item) => ({
      item,
      score: scoreVocabularyForUser(item, user)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.term.localeCompare(right.item.term);
    })
    .slice(0, Math.min(20, Math.max(1, Number(query.limit) || 8)));

  return {
    items: sortedItems.map(({ item }) => serializeVocabulary(item)),
    personalization: {
      language: resolveLanguage(requestedLanguage),
      level: user?.level || '',
      goals: Array.isArray(user?.goals) ? user.goals : []
    }
  };
};

const normalizeVocabularyRecord = (payload = {}, providerKey = 'jmdict') => {
  if (providerKey === 'jmdict') {
    return jmdictAdapter.normalizeJMdictEntry(payload);
  }

  throw new Error(`Unsupported vocabulary provider: ${providerKey}`);
};

module.exports = {
  buildFlashcardSeedFromVocabulary,
  getRecommendedVocabulary,
  getVocabularyById,
  normalizeVocabularyRecord,
  resolveLanguage,
  searchVocabulary
};
