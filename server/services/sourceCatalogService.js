const SOURCE_TYPES = Object.freeze({
  DICTIONARY: 'dictionary',
  SENTENCE: 'sentence',
  MEDIA: 'media',
  USER: 'user'
});

const SOURCE_PROVIDERS = Object.freeze({
  JMDICT: 'JMdict',
  TATOEBA: 'Tatoeba',
  YOUTUBE: 'YouTube',
  USER: 'user'
});

const JAPANESE_PROVIDER_CATALOG = Object.freeze({
  dictionaryProviders: [
    {
      key: 'jmdict',
      label: SOURCE_PROVIDERS.JMDICT,
      enabled: false
    }
  ],
  sentenceProviders: [
    {
      key: 'tatoeba',
      label: SOURCE_PROVIDERS.TATOEBA,
      enabled: false
    }
  ],
  kanjiProviders: [
    {
      key: 'placeholder_kanji',
      label: 'Kanji Provider Placeholder',
      enabled: false
    }
  ]
});

const normalizeSourceFields = ({ sourceType, sourceProvider, sourceId }) => ({
  sourceType: sourceType || SOURCE_TYPES.USER,
  sourceProvider: sourceProvider || SOURCE_PROVIDERS.USER,
  sourceId: String(sourceId || '').trim()
});

module.exports = {
  SOURCE_TYPES,
  SOURCE_PROVIDERS,
  JAPANESE_PROVIDER_CATALOG,
  normalizeSourceFields
};
