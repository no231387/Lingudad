const PRESET_SEED_SOURCE = 'system_curated_presets_v1';

const SYSTEM_PRESET_ITEMS = Object.freeze([
  {
    slug: 'beginner-casual-conversation',
    code: 'beginner-casual-conversation',
    name: 'Casual Japanese',
    description: 'Starter-friendly everyday Japanese for greetings, quick replies, and relaxed social exchanges.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['vocabulary', 'listening', 'speaking'],
    targetDifficulty: ['beginner'],
    levelBand: 'Beginner',
    conversationGoal: 'everyday social basics',
    focusLabel: 'casual conversation',
    sortOrder: 10
  },
  {
    slug: 'beginner-polite-conversation',
    code: 'beginner-polite-conversation',
    name: 'Polite Japanese',
    description: 'Early polite Japanese for greetings, basic requests, and courteous everyday interaction.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['vocabulary', 'reading', 'speaking'],
    targetDifficulty: ['beginner'],
    levelBand: 'Beginner',
    conversationGoal: 'polite daily interaction',
    focusLabel: 'polite conversation',
    sortOrder: 20
  },
  {
    slug: 'beginner-mixed-conversation',
    code: 'beginner-mixed-conversation',
    name: 'Mixed Everyday Japanese',
    description: 'A blended lane across casual and polite speech so beginners can move between common situations cleanly.',
    language: 'Japanese',
    registerTags: ['casual', 'polite'],
    skillTags: ['vocabulary', 'listening', 'speaking'],
    targetDifficulty: ['beginner'],
    levelBand: 'Beginner',
    conversationGoal: 'flexible day-to-day conversation',
    focusLabel: 'mixed everyday conversation',
    sortOrder: 30
  },
  {
    slug: 'listening-focus-casual',
    code: 'listening-focus-casual',
    name: 'Listening Focus (Casual)',
    description: 'Casual Japanese tuned toward listening-heavy study with spoken phrasing, reactions, and common flow.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking', 'vocabulary'],
    targetDifficulty: ['beginner', 'intermediate'],
    levelBand: 'Beginner to Intermediate',
    conversationGoal: 'casual listening comprehension',
    focusLabel: 'listening-first casual study',
    sortOrder: 40
  },
  {
    slug: 'intermediate-casual-conversation',
    code: 'intermediate-casual-conversation',
    name: 'Casual Japanese / Intermediate',
    description: 'More natural casual phrasing for follow-up questions, reactions, and relaxed spoken flow.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    levelBand: 'Intermediate',
    conversationGoal: 'natural casual flow',
    focusLabel: 'intermediate casual conversation',
    sortOrder: 50
  },
  {
    slug: 'intermediate-polite-conversation',
    code: 'intermediate-polite-conversation',
    name: 'Polite Japanese / Intermediate',
    description: 'Polite interaction patterns for clearer explanations, requests, and socially appropriate responses.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    levelBand: 'Intermediate',
    conversationGoal: 'clear polite interaction',
    focusLabel: 'intermediate polite conversation',
    sortOrder: 60
  },
  {
    slug: 'intro-workplace-japanese',
    code: 'intro-workplace-japanese',
    name: 'Workplace Japanese',
    description: 'An on-ramp to office and service-language situations with practical polite and formal expressions.',
    language: 'Japanese',
    registerTags: ['polite', 'keigo'],
    skillTags: ['reading', 'listening', 'vocabulary'],
    targetDifficulty: ['intermediate'],
    levelBand: 'Intermediate',
    conversationGoal: 'early workplace communication',
    focusLabel: 'workplace communication',
    sortOrder: 70
  },
  {
    slug: 'advanced-casual-nuance',
    code: 'advanced-casual-nuance',
    name: 'Casual Japanese / Advanced Nuance',
    description: 'Higher-context casual Japanese with nuance, tone shifts, and more expressive conversational choices.',
    language: 'Japanese',
    registerTags: ['casual'],
    skillTags: ['listening', 'speaking', 'vocabulary'],
    targetDifficulty: ['advanced'],
    levelBand: 'Advanced',
    conversationGoal: 'nuanced informal conversation',
    focusLabel: 'advanced casual nuance',
    sortOrder: 80
  },
  {
    slug: 'advanced-polite-interaction',
    code: 'advanced-polite-interaction',
    name: 'Polite Japanese / Advanced Interaction',
    description: 'Refined polite Japanese for explanations, negotiation, and sustained social or professional exchanges.',
    language: 'Japanese',
    registerTags: ['polite'],
    skillTags: ['reading', 'speaking', 'vocabulary'],
    targetDifficulty: ['advanced'],
    levelBand: 'Advanced',
    conversationGoal: 'refined polite communication',
    focusLabel: 'advanced polite interaction',
    sortOrder: 90
  },
  {
    slug: 'keigo-formal-workplace-japanese',
    code: 'keigo-formal-workplace-japanese',
    name: 'Keigo / Formal Japanese',
    description: 'Formal workplace Japanese focused on honorific phrasing, service etiquette, and professional register control.',
    language: 'Japanese',
    registerTags: ['keigo'],
    skillTags: ['reading', 'listening', 'vocabulary'],
    targetDifficulty: ['advanced'],
    levelBand: 'Advanced',
    conversationGoal: 'formal workplace interaction',
    focusLabel: 'keigo and formal register',
    sortOrder: 100
  }
]);

module.exports = {
  PRESET_SEED_SOURCE,
  SYSTEM_PRESET_ITEMS
};
