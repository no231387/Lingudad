const Vocabulary = require('../models/Vocabulary');
const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('./sourceCatalogService');
const { getPresetById } = require('./presetService');
const { rankRecommendationItems } = require('./learningEngineService');
const jmdictAdapter = require('../providers/jmdictAdapter');

const LANGUAGE_ALIASES = Object.freeze({
  ja: 'Japanese',
  japanese: 'Japanese'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
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

const buildRecommendationDebug = ({ item, preset, scoreBreakdown }) => ({
  registerTags: Array.isArray(item.registerTags) ? item.registerTags : [],
  skillTags: Array.isArray(item.skillTags) ? item.skillTags : [],
  difficulty: item.difficulty || item.difficultyProfile?.general || '',
  activePreset: preset
    ? {
        id: preset.id,
        name: preset.name
      }
    : null,
  scoreBreakdown
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

const searchVocabulary = async ({ query = {} }) => {
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filters = buildSearchFilters(query);
  const results = await Vocabulary.find(filters).sort({ term: 1, reading: 1 }).limit(limit);

  return results
    .map(serializeVocabulary);
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
  const preset = getPresetById(query.preset);
  const filters = buildSearchFilters({
    language: preset?.language || requestedLanguage,
    difficulty: query.difficulty,
    topic: query.topic,
    register: query.register
  });

  const items = await Vocabulary.find(filters).limit(60);
  const rankedItems = await rankRecommendationItems({
    user,
    preset,
    items,
    itemType: 'vocabulary',
    modelName: 'Vocabulary',
    serializeItem: serializeVocabulary,
    tieBreaker: (left, right) => left.term.localeCompare(right.term)
  });

  const sortedItems = rankedItems.slice(0, Math.min(20, Math.max(1, Number(query.limit) || 8)));

  return {
    items: sortedItems.map(({ item, serializedItem, recommendationDebug }) => ({
      ...serializedItem,
      recommendationDebug: buildRecommendationDebug({
        item,
        preset,
        scoreBreakdown: recommendationDebug.scoreBreakdown
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
