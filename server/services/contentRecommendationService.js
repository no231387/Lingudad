const LearningContent = require('../models/LearningContent');
const StudySession = require('../models/StudySession');
const { getPresetById } = require('./presetService');
const { CONTENT_VISIBILITY, serializeContent } = require('./contentService');

const MAX_LIMIT = 12;
const DEFAULT_LIMIT = 4;
const MAX_CANDIDATE_SCAN = 120;
const READY_TRANSCRIPT_STATUSES = new Set(['manual_ready', 'ready', 'linked']);
const UNSAFE_TRUST_LEVELS = new Set(['failed', 'invalid', 'blocked', 'rejected']);
const LANGUAGE_ALIASES = Object.freeze({
  ja: 'Japanese',
  japanese: 'Japanese'
});
const GOAL_WEIGHT_RULES = Object.freeze({
  vocabulary: ['vocabulary', 'core_vocab', 'core', 'survival_phrases'],
  reading: ['reading', 'written', 'kanji', 'grammar'],
  listening: ['listening', 'spoken', 'dialogue', 'listening_practice'],
  kanji: ['kanji', 'written', 'reading'],
  speaking: ['speaking', 'spoken', 'dialogue', 'daily_conversation']
});
const LEVEL_DIFFICULTY_MAP = Object.freeze({
  beginner: ['starter', 'beginner', 'basic', 'beginner_intermediate'],
  intermediate: ['common', 'intermediate', 'beginner_intermediate'],
  advanced: ['advanced', 'rare', 'broad']
});
const ADJACENT_LEVEL_DIFFICULTY_MAP = Object.freeze({
  beginner: ['common'],
  intermediate: ['beginner', 'advanced'],
  advanced: ['intermediate']
});
const FALLBACK_TIERS = Object.freeze({
  NONE: null,
  STARTER: 'language_matching_starter_content',
  BEGINNER: 'beginner_appropriate_content',
  LEVEL: 'level_matched_content',
  PROFILE: 'profile_matched_content',
  FRESH: 'fresh_usable_content'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeTagList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLower(value)).filter(Boolean))];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeBoolean = (value) => ['true', '1', 'yes'].includes(normalizeLower(value));
const getNow = () => Date.now();

const resolveLanguage = (value) => {
  const normalized = normalizeLower(value);

  if (!normalized) {
    return '';
  }

  return LANGUAGE_ALIASES[normalized] || normalizeText(value);
};

const buildLanguageMatch = (value) => {
  const canonical = resolveLanguage(value);

  if (!canonical) {
    return undefined;
  }

  const aliases = Object.keys(LANGUAGE_ALIASES).filter((key) => LANGUAGE_ALIASES[key] === canonical);

  return {
    $in: [...new Set([canonical, ...aliases])]
  };
};

const parseRecommendationQuery = (query = {}) => {
  const parsedLimit = Number.parseInt(String(query.limit || DEFAULT_LIMIT), 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit)) : DEFAULT_LIMIT,
    language: normalizeText(query.language),
    preset: normalizeText(query.preset),
    debug: normalizeBoolean(query.debug)
  };
};

const countMatches = (needles = [], haystack = []) => {
  const haystackSet = new Set(normalizeTagList(haystack));
  return normalizeTagList(needles).filter((value) => haystackSet.has(value)).length;
};

const getContentIdentity = (item) => `${normalizeLower(item.sourceProvider)}:${normalizeText(item.sourceId || item._id)}`;
const getPrimaryTopic = (item) => normalizeLower(item.topicTags?.[0] || item.skillTags?.[0] || item.registerTags?.[0] || '');
const getDiversityKey = (item) =>
  [
    normalizeLower(item.sourceProvider),
    getPrimaryTopic(item),
    normalizeLower(item.registerTags?.[0] || ''),
    normalizeLower(item.difficulty || '')
  ].join(':');

const isSafeTrustLevel = (item) => !UNSAFE_TRUST_LEVELS.has(normalizeLower(item.trustLevel));

const isPubliclyRecommendable = (item) =>
  item &&
  [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL].includes(item.visibility) &&
  item.workspaceType !== 'study_copy' &&
  item.recommendationEligible === true &&
  isSafeTrustLevel(item);

const isContentUsable = (item) => {
  if (!isPubliclyRecommendable(item)) {
    return false;
  }

  const transcriptStatus = normalizeLower(item.transcriptStatus);
  const linkedCount = Number(item.linkedVocabularyIds?.length || 0) + Number(item.linkedSentenceIds?.length || 0);
  const hasPlayableSource = Boolean(normalizeText(item.embedUrl || item.sourceUrl || item.url || item.sourceId));
  const hasPracticeReadiness =
    READY_TRANSCRIPT_STATUSES.has(transcriptStatus) ||
    Boolean(item.transcriptAvailable) ||
    linkedCount > 0 ||
    item.isCurated ||
    item.isSystemContent;

  return hasPlayableSource && hasPracticeReadiness;
};

const buildTierBuckets = ({ items, user, coldStart }) => {
  const level = normalizeLower(user?.level);
  const preferredTopics = normalizeTagList(user?.preferredTopics);
  const preferredRegister = normalizeTagList(user?.preferredRegister);
  const goals = normalizeTagList(user?.goals);

  const starter = items.filter((item) => item.visibility === CONTENT_VISIBILITY.GLOBAL && (item.isSystemContent || item.isCurated));
  const beginner = items.filter((item) => LEVEL_DIFFICULTY_MAP.beginner.includes(normalizeLower(item.difficulty)));
  const levelMatched = items.filter((item) => LEVEL_DIFFICULTY_MAP[level]?.includes(normalizeLower(item.difficulty)));
  const profileMatched = items.filter((item) => {
    const topicMatch = countMatches(preferredTopics, item.topicTags);
    const registerMatch = countMatches(preferredRegister, item.registerTags);
    const goalMatch = goals.some((goal) => {
      const mapped = GOAL_WEIGHT_RULES[goal] || [goal];
      return mapped.some(
        (tag) =>
          normalizeTagList(item.topicTags).includes(tag) ||
          normalizeTagList(item.skillTags).includes(tag) ||
          normalizeTagList(item.registerTags).includes(tag)
      );
    });

    return topicMatch > 0 || registerMatch > 0 || goalMatch;
  });
  const fresh = [...items].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

  if (coldStart && starter.length > 0) {
    return { tier: FALLBACK_TIERS.STARTER, items: starter };
  }

  if (coldStart && beginner.length > 0) {
    return { tier: FALLBACK_TIERS.BEGINNER, items: beginner };
  }

  if (levelMatched.length > 0) {
    return { tier: coldStart ? FALLBACK_TIERS.LEVEL : FALLBACK_TIERS.NONE, items: levelMatched };
  }

  if (profileMatched.length > 0) {
    return { tier: coldStart ? FALLBACK_TIERS.PROFILE : FALLBACK_TIERS.NONE, items: profileMatched };
  }

  return { tier: FALLBACK_TIERS.FRESH, items: fresh };
};

const isColdStartUser = ({ user, savedContentIds, practicedContentIds }) => {
  const goalCount = Array.isArray(user?.goals) ? user.goals.length : 0;
  const topicCount = Array.isArray(user?.preferredTopics) ? user.preferredTopics.length : 0;
  const registerCount = Array.isArray(user?.preferredRegister) ? user.preferredRegister.length : 0;

  return savedContentIds.size === 0 && practicedContentIds.size === 0 && goalCount + topicCount + registerCount <= 1;
};

const buildRecommendationReasons = ({
  item,
  preferredTopicMatches,
  preferredRegisterMatches,
  goalMatches,
  levelMatch,
  coldStart,
  isSaved,
  practicedCount,
  freshnessScore
}) => {
  const reasons = [];

  if (READY_TRANSCRIPT_STATUSES.has(normalizeLower(item.transcriptStatus)) || item.transcriptAvailable) {
    reasons.push('ready_to_practice');
  }

  if ((Number(item.linkedVocabularyIds?.length || 0) + Number(item.linkedSentenceIds?.length || 0)) > 0) {
    reasons.push('matched_study_items');
  }

  if (levelMatch === 'direct' && normalizeLower(item.difficulty)) {
    reasons.push(`${normalizeLower(item.difficulty)}_match`);
  } else if (levelMatch === 'adjacent') {
    reasons.push('level_adjacent');
  }

  if (preferredTopicMatches > 0) {
    reasons.push('topic_match');
  }

  if (preferredRegisterMatches > 0) {
    reasons.push('register_match');
  }

  if (goalMatches.includes('listening')) {
    reasons.push('listening_focus');
  }

  if (goalMatches.includes('speaking')) {
    reasons.push('speaking_focus');
  }

  if (coldStart && (item.isSystemContent || item.visibility === CONTENT_VISIBILITY.GLOBAL)) {
    reasons.push('starter_content');
  }

  if (!coldStart && item.visibility === CONTENT_VISIBILITY.GLOBAL) {
    reasons.push('global_content');
  }

  if (isSaved) {
    reasons.push('saved_penalty_applied');
  }

  if (practicedCount > 0) {
    reasons.push('practiced_penalty_applied');
  }

  if (freshnessScore > 0) {
    reasons.push('fresh_content');
  }

  return [...new Set(reasons)].slice(0, 4);
};

const scoreContentItem = ({
  item,
  user,
  preset,
  coldStart,
  savedContentIds,
  practicedContentMap,
  now
}) => {
  let score = 0;
  const breakdown = {
    readinessScore: 0,
    levelScore: 0,
    topicScore: 0,
    registerScore: 0,
    goalScore: 0,
    presetScore: 0,
    coldStartScore: 0,
    freshnessScore: 0,
    savedPenalty: 0,
    practicedPenalty: 0
  };

  const contentTopics = normalizeTagList(item.topicTags);
  const contentRegisters = normalizeTagList(item.registerTags);
  const contentSkills = normalizeTagList(item.skillTags);
  const difficulty = normalizeLower(item.difficulty);
  const transcriptStatus = normalizeLower(item.transcriptStatus);
  const linkedCount = Number(item.linkedVocabularyIds?.length || 0) + Number(item.linkedSentenceIds?.length || 0);
  const preferredTopics = normalizeTagList(user?.preferredTopics);
  const preferredRegister = normalizeTagList(user?.preferredRegister);
  const goals = normalizeTagList(user?.goals);
  const level = normalizeLower(user?.level);
  const practicedStats = practicedContentMap.get(String(item._id)) || { count: 0, lastCompletedAt: null };
  const isSaved = savedContentIds.has(String(item._id));

  if (transcriptStatus === 'linked') {
    breakdown.readinessScore += 10;
  } else if (transcriptStatus === 'manual_ready') {
    breakdown.readinessScore += 8;
  } else if (transcriptStatus === 'ready') {
    breakdown.readinessScore += 6;
  } else if (item.transcriptAvailable) {
    breakdown.readinessScore += 3;
  }

  breakdown.readinessScore += clamp(linkedCount * 2, 0, 6);
  if (item.isCurated) {
    breakdown.readinessScore += 1;
  }
  score += breakdown.readinessScore;

  let levelMatch = 'none';
  if (LEVEL_DIFFICULTY_MAP[level]?.includes(difficulty)) {
    breakdown.levelScore += 10;
    levelMatch = 'direct';
  } else if (ADJACENT_LEVEL_DIFFICULTY_MAP[level]?.includes(difficulty)) {
    breakdown.levelScore += 4;
    levelMatch = 'adjacent';
  } else if (!difficulty && level === 'beginner') {
    breakdown.levelScore += 2;
    levelMatch = 'adjacent';
  }
  score += breakdown.levelScore;

  const preferredTopicMatches = countMatches(preferredTopics, contentTopics);
  const preferredRegisterMatches = countMatches(preferredRegister, contentRegisters);
  breakdown.topicScore += Math.min(8, preferredTopicMatches * 4);
  breakdown.registerScore += Math.min(6, preferredRegisterMatches * 3);
  score += breakdown.topicScore + breakdown.registerScore;

  const goalMatches = [];
  goals.forEach((goal) => {
    const mappedTags = GOAL_WEIGHT_RULES[goal] || [goal];
    const skillMatch = mappedTags.some((tag) => contentSkills.includes(tag));
    const topicMatch = mappedTags.some((tag) => contentTopics.includes(tag) || contentRegisters.includes(tag));

    if (skillMatch || topicMatch) {
      goalMatches.push(goal);
      breakdown.goalScore += skillMatch ? 4 : 2;
    }
  });
  breakdown.goalScore = Math.min(10, breakdown.goalScore);
  score += breakdown.goalScore;

  if (preset) {
    const presetRegisterMatches = countMatches(preset.registerTags, contentRegisters);
    const presetSkillMatches = countMatches(preset.skillTags, contentSkills);
    const presetDifficultyMatches = countMatches(preset.targetDifficulty, [difficulty]);
    breakdown.presetScore =
      Math.min(6, presetRegisterMatches * 3) + Math.min(4, presetSkillMatches * 2) + Math.min(2, presetDifficultyMatches * 2);
    score += breakdown.presetScore;
  }

  if (coldStart && (item.isSystemContent || item.visibility === CONTENT_VISIBILITY.GLOBAL)) {
    breakdown.coldStartScore += item.isCurated ? 5 : 3;
    score += breakdown.coldStartScore;
  }

  const itemAgeDays = Math.max(0, (now - new Date(item.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24));
  if (itemAgeDays <= 30) {
    breakdown.freshnessScore += 2;
  } else if (itemAgeDays <= 120) {
    breakdown.freshnessScore += 1;
  }
  score += breakdown.freshnessScore;

  if (isSaved) {
    breakdown.savedPenalty = -6;
    score += breakdown.savedPenalty;
  }

  if (practicedStats.count > 0) {
    breakdown.practicedPenalty -= Math.min(8, practicedStats.count * 3);

    if (practicedStats.lastCompletedAt) {
      const daysSincePractice = Math.max(0, (now - new Date(practicedStats.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24));

      if (daysSincePractice <= 3) {
        breakdown.practicedPenalty -= 2;
      }
    }

    score += breakdown.practicedPenalty;
  }

  return {
    totalScore: score,
    levelMatch,
    preferredTopicMatches,
    preferredRegisterMatches,
    goalMatches,
    recommendationReasons: buildRecommendationReasons({
      item,
      preferredTopicMatches,
      preferredRegisterMatches,
      goalMatches,
      levelMatch,
      coldStart,
      isSaved,
      practicedCount: practicedStats.count,
      freshnessScore: breakdown.freshnessScore
    }),
    recommendationDebug: {
      scoreBreakdown: {
        totalScore: Math.round(score * 10) / 10,
        ...breakdown,
        practicedCount: practicedStats.count,
        isSaved
      }
    }
  };
};

const applyDeterministicDiversity = (rankedItems, limit) => {
  const selected = [];
  const usedIdentities = new Set();
  const usedDiversityKeys = new Set();

  for (const entry of rankedItems) {
    if (selected.length >= limit) {
      break;
    }

    const identity = getContentIdentity(entry.item);
    const diversityKey = getDiversityKey(entry.item);
    const shouldDelay =
      usedDiversityKeys.has(diversityKey) &&
      rankedItems.some((candidate) => {
        if (selected.includes(candidate) || candidate === entry) {
          return false;
        }

        return !usedDiversityKeys.has(getDiversityKey(candidate.item));
      });

    if (usedIdentities.has(identity) || shouldDelay) {
      continue;
    }

    selected.push(entry);
    usedIdentities.add(identity);
    usedDiversityKeys.add(diversityKey);
  }

  if (selected.length >= limit) {
    return selected;
  }

  for (const entry of rankedItems) {
    if (selected.length >= limit) {
      break;
    }

    if (!selected.includes(entry)) {
      selected.push(entry);
    }
  }

  return selected;
};

const fetchCandidateContent = async ({ LearningContentModel, language }) => {
  const filter = {
    visibility: { $in: [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL] },
    recommendationEligible: true
  };
  const languageMatch = buildLanguageMatch(language);

  if (languageMatch) {
    filter.language = languageMatch;
  }

  const items = await LearningContentModel.find(filter)
    .populate({ path: 'createdBy', select: 'username language level goals' })
    .sort({ isSystemContent: -1, isCurated: -1, createdAt: -1, title: 1, sourceId: 1 })
    .limit(MAX_CANDIDATE_SCAN);

  return items.filter(isContentUsable);
};

const buildPracticedContentMap = async ({ StudySessionModel, userId, candidateIds }) => {
  if (!candidateIds.length) {
    return new Map();
  }

  const practicedSessions = await StudySessionModel.find({
    owner: userId,
    sessionSource: 'content',
    sourceContentId: { $in: candidateIds }
  }).select('sourceContentId completedAt');

  return practicedSessions.reduce((map, session) => {
    const key = String(session.sourceContentId || '').trim();
    const current = map.get(key) || { count: 0, lastCompletedAt: null };

    current.count += 1;

    if (!current.lastCompletedAt || new Date(session.completedAt) > new Date(current.lastCompletedAt)) {
      current.lastCompletedAt = session.completedAt;
    }

    map.set(key, current);
    return map;
  }, new Map());
};

const createContentRecommendationService = ({
  LearningContentModel = LearningContent,
  StudySessionModel = StudySession,
  getPresetByIdFn = getPresetById,
  serializeContentFn = serializeContent,
  now = getNow
} = {}) => {
  const getRecommendedContent = async ({ user, query = {} }) => {
    const parsedQuery = parseRecommendationQuery(query);
    const limit = parsedQuery.limit;
    const language = parsedQuery.language || user?.language || 'Japanese';
    const nowValue = now();

    let preset = null;
    if (parsedQuery.preset) {
      try {
        preset = await getPresetByIdFn(parsedQuery.preset, { user, language });
      } catch (error) {
        preset = null;
      }
    }

    const usableCandidates = await fetchCandidateContent({
      LearningContentModel,
      language
    });

    const candidateIds = usableCandidates.map((item) => String(item._id));
    const practicedContentMap = await buildPracticedContentMap({
      StudySessionModel,
      userId: user._id,
      candidateIds
    });
    const savedContentIds = new Set(
      usableCandidates
        .filter((item) => item.savedBy?.some((savedUserId) => String(savedUserId) === String(user._id)))
        .map((item) => String(item._id))
    );
    const coldStart = isColdStartUser({
      user,
      savedContentIds,
      practicedContentIds: new Set([...practicedContentMap.keys()])
    });
    const tierBucket = buildTierBuckets({
      items: usableCandidates,
      user,
      coldStart
    });
    const candidatesToRank = tierBucket.items;

    const rankedItems = candidatesToRank
      .map((item) => {
        const scoreResult = scoreContentItem({
          item,
          user,
          preset,
          coldStart,
          savedContentIds,
          practicedContentMap,
          now: nowValue
        });

        return {
          item,
          totalScore: scoreResult.totalScore,
          serializedItem: serializeContentFn(item, user._id),
          recommendationReasons: scoreResult.recommendationReasons,
          recommendationDebug: scoreResult.recommendationDebug
        };
      })
      .sort((left, right) => {
        if (right.totalScore !== left.totalScore) {
          return right.totalScore - left.totalScore;
        }

        if (normalizeLower(left.item.title) !== normalizeLower(right.item.title)) {
          return normalizeLower(left.item.title).localeCompare(normalizeLower(right.item.title));
        }

        return normalizeText(left.item.sourceId || left.item._id).localeCompare(normalizeText(right.item.sourceId || right.item._id));
      });

    const diversifiedItems = applyDeterministicDiversity(rankedItems, limit);

    return {
      items: diversifiedItems.map(({ serializedItem, recommendationReasons, recommendationDebug }) => ({
        ...serializedItem,
        recommendationReasons,
        ...(parsedQuery.debug ? { recommendationDebug } : {})
      })),
      meta: {
        source: 'server_recommendation',
        isColdStart: coldStart,
        fallbackTierUsed: tierBucket.tier,
        totalCandidatesConsidered: candidatesToRank.length
      }
    };
  };

  return {
    getRecommendedContent
  };
};

const defaultService = createContentRecommendationService();

module.exports = {
  getRecommendedContent: defaultService.getRecommendedContent,
  __testables: {
    FALLBACK_TIERS,
    applyDeterministicDiversity,
    buildLanguageMatch,
    buildTierBuckets,
    createContentRecommendationService,
    isColdStartUser,
    isContentUsable,
    parseRecommendationQuery,
    scoreContentItem
  }
};
