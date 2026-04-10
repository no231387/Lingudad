const PRESETS = Object.freeze([
  {
    id: 'beginner-casual-conversation',
    name: 'Beginner Casual Conversation',
    description: 'Starter-friendly everyday Japanese for greetings, simple replies, and relaxed social exchanges.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'listening', 'speaking'],
    targetDifficulty: ['beginner'],
    conversationGoal: 'everyday social basics',
    levelBand: 'Beginner'
  },
  {
    id: 'beginner-polite-conversation',
    name: 'Beginner Polite Conversation',
    description: 'Early polite Japanese for greetings, basic requests, and courteous everyday interactions.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'reading', 'speaking'],
    targetDifficulty: ['beginner'],
    conversationGoal: 'polite daily interaction',
    levelBand: 'Beginner'
  },
  {
    id: 'beginner-mixed-conversation',
    name: 'Beginner Mixed Conversation',
    description: 'A blended track across casual and polite speech so beginners can switch between common situations.',
    language: 'Japanese',
    registerTags: ['casual', 'polite'],
    skillTags: ['vocabulary', 'listening', 'speaking'],
    targetDifficulty: ['beginner'],
    conversationGoal: 'flexible day-to-day conversation',
    levelBand: 'Beginner'
  },
  {
    id: 'intermediate-casual-conversation',
    name: 'Intermediate Casual Conversation',
    description: 'More natural casual phrasing for follow-up questions, reactions, and relaxed spoken flow.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    conversationGoal: 'natural casual flow',
    levelBand: 'Intermediate'
  },
  {
    id: 'intermediate-polite-conversation',
    name: 'Intermediate Polite Conversation',
    description: 'Polite interaction patterns for clearer explanations, requests, and socially appropriate responses.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    conversationGoal: 'clear polite interaction',
    levelBand: 'Intermediate'
  },
  {
    id: 'intro-workplace-japanese',
    name: 'Intro Workplace Japanese',
    description: 'An on-ramp to office and service-language situations with practical polite and formal expressions.',
    language: 'Japanese',
    registerTags: ['polite', 'keigo'],
    skillTags: ['reading', 'listening', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    conversationGoal: 'early workplace communication',
    levelBand: 'Intermediate'
  },
  {
    id: 'advanced-casual-nuance',
    name: 'Advanced Casual Nuance',
    description: 'Higher-context casual Japanese with nuance, tone shifts, and more expressive conversational choices.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking', 'vocabulary'],
    targetDifficulty: ['advanced'],
    conversationGoal: 'nuanced informal conversation',
    levelBand: 'Advanced'
  },
  {
    id: 'advanced-polite-interaction',
    name: 'Advanced Polite Interaction',
    description: 'Refined polite Japanese for explanations, negotiation, and sustained social or professional exchanges.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking', 'vocabulary'],
    targetDifficulty: ['advanced'],
    conversationGoal: 'refined polite communication',
    levelBand: 'Advanced'
  },
  {
    id: 'keigo-formal-workplace-japanese',
    name: 'Keigo / Formal Workplace Japanese',
    description: 'Formal workplace Japanese focused on honorific phrasing, service etiquette, and professional register control.',
    language: 'Japanese',
    registerTags: ['keigo'],
    skillTags: ['reading', 'listening', 'vocabulary'],
    targetDifficulty: ['advanced'],
    conversationGoal: 'formal workplace interaction',
    levelBand: 'Advanced'
  }
]);

const { rankPresetsForUser } = require('./learningEngineService');

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

const getRecommendedPresets = ({ user, language, limit = 4 }) => {
  const presets = getPresets({ language: language || user?.language || 'Japanese' });
  const rankedPresets = rankPresetsForUser({
    user,
    presets,
    tieBreaker: (left, right) => left.name.localeCompare(right.name)
  });

  return rankedPresets.slice(0, Math.min(10, Math.max(1, Number(limit) || 4))).map(({ item, recommendationDebug }) => ({
    ...item,
    recommendationDebug
  }));
};

module.exports = {
  getPresetById,
  getPresets,
  getRecommendedPresets,
  PRESETS
};
