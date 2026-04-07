const { SOURCE_PROVIDERS, SOURCE_TYPES } = require('../services/sourceCatalogService');

const normalizeText = (value) => String(value || '').trim();

const normalizeList = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((item) => normalizeText(item)).filter(Boolean))];

const normalizeJMdictEntry = (entry = {}) => {
  const term = normalizeText(entry.term || entry.expression || entry.kanji || entry.keb);
  const reading = normalizeText(entry.reading || entry.kana || entry.reb);
  const meanings = normalizeList(entry.meanings || entry.glosses);
  const partOfSpeech = normalizeList(entry.partOfSpeech);
  const sourceId = normalizeText(entry.sourceId || entry.entSeq || entry.ent_seq);

  if (!term || meanings.length === 0 || !sourceId) {
    throw new Error('JMdict entries must include a term, source id, and at least one meaning.');
  }

  return {
    language: 'Japanese',
    term,
    reading,
    meanings,
    partOfSpeech,
    topicTags: normalizeList(entry.topicTags),
    registerTags: normalizeList(entry.registerTags),
    skillTags: normalizeList(entry.skillTags),
    difficulty: normalizeText(entry.difficulty),
    difficultyProfile: {
      general: normalizeText(entry.difficultyProfile?.general || entry.difficulty),
      frequencyBand: Number.isFinite(Number(entry.difficultyProfile?.frequencyBand))
        ? Number(entry.difficultyProfile.frequencyBand)
        : null,
      kanjiLoad: Number.isFinite(Number(entry.difficultyProfile?.kanjiLoad))
        ? Number(entry.difficultyProfile.kanjiLoad)
        : null,
      jlptLevel: normalizeText(entry.difficultyProfile?.jlptLevel)
    },
    sourceProvider: SOURCE_PROVIDERS.JMDICT,
    sourceType: SOURCE_TYPES.DICTIONARY,
    sourceId
  };
};

module.exports = {
  key: 'jmdict',
  label: SOURCE_PROVIDERS.JMDICT,
  sourceType: SOURCE_TYPES.DICTIONARY,
  normalizeJMdictEntry
};
