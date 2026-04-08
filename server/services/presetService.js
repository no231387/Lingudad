const PRESETS = Object.freeze([
  {
    id: 'casual-japanese',
    name: 'Casual Japanese',
    description: 'Focus on casual everyday speech.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'listening'],
    targetDifficulty: ['beginner', 'intermediate']
  },
  {
    id: 'polite-japanese',
    name: 'Polite Japanese',
    description: 'Prioritize polite forms used in common daily interactions.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'reading'],
    targetDifficulty: ['beginner', 'intermediate']
  },
  {
    id: 'keigo-formal-japanese',
    name: 'Keigo / Formal Japanese',
    description: 'Emphasize formal and honorific register patterns.',
    language: 'Japanese',
    registerTags: ['keigo'],
    skillTags: ['vocabulary', 'reading'],
    targetDifficulty: ['intermediate', 'advanced']
  },
  {
    id: 'mixed-everyday-japanese',
    name: 'Mixed Everyday Japanese',
    description: 'Blend casual and polite register for daily use.',
    language: 'Japanese',
    registerTags: ['casual', 'polite'],
    skillTags: ['vocabulary', 'listening'],
    targetDifficulty: ['beginner']
  },
  {
    id: 'listening-casual',
    name: 'Listening Focus (Casual)',
    description: 'Prioritize casual listening-focused material.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening'],
    targetDifficulty: ['beginner', 'intermediate']
  }
]);

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();

const getPresets = ({ language } = {}) => {
  const normalizedLanguage = normalizeLower(language);

  if (!normalizedLanguage) {
    return PRESETS;
  }

  return PRESETS.filter((preset) => normalizeLower(preset.language) === normalizedLanguage || normalizedLanguage === 'ja');
};

const getPresetById = (presetId) => {
  const normalizedId = normalizeLower(presetId);
  return PRESETS.find((preset) => preset.id === normalizedId) || null;
};

module.exports = {
  getPresetById,
  getPresets,
  PRESETS
};
