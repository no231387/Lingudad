const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('../services/sourceCatalogService');

const normalizeText = (value) => String(value || '').trim();
const normalizeList = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((item) => normalizeText(item)).filter(Boolean))];

const normalizeTranslations = (translations) =>
  (Array.isArray(translations) ? translations : [])
    .map((entry) => ({
      language: normalizeText(entry.language),
      text: normalizeText(entry.text)
    }))
    .filter((entry) => entry.language && entry.text);

const normalizeTatoebaSentence = (entry = {}) => {
  const text = normalizeText(entry.text || entry.sentence);
  const sourceId = normalizeText(entry.sourceId || entry.id || entry.sentenceId);
  const translations = normalizeTranslations(entry.translations);

  if (!text || !sourceId) {
    throw new Error('Tatoeba sentence entries must include text and a source id.');
  }

  return {
    language: normalizeText(entry.language || 'Japanese'),
    text,
    translations,
    tokenized: Array.isArray(entry.tokenized) ? entry.tokenized : [],
    linkedVocabularyIds: [],
    topicTags: normalizeList(entry.topicTags),
    registerTags: normalizeList(entry.registerTags),
    skillTags: normalizeList(entry.skillTags),
    difficulty: normalizeText(entry.difficulty),
    sourceProvider: SOURCE_PROVIDERS.TATOEBA,
    sourceType: SOURCE_TYPES.SENTENCE,
    sourceId
  };
};

module.exports = {
  key: 'tatoeba',
  label: SOURCE_PROVIDERS.TATOEBA,
  sourceType: SOURCE_TYPES.SENTENCE,
  normalizeTatoebaSentence
};
