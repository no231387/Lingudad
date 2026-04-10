const Flashcard = require('../models/Flashcard');
const UserProgress = require('../models/UserProgress');

const SCORE_WEIGHTS = Object.freeze({
  presetRegisterMatch: 16,
  presetSkillMatch: 7,
  presetDifficultyMatch: 5,
  presetRegisterMissPenalty: -10,
  preferredTopicMatch: 5,
  preferredRegisterMatch: 7,
  goalSkillMatch: 6,
  goalTopicMatch: 4,
  levelDifficultyMatch: 8,
  levelAdjacentMatch: 3,
  weaknessBoost: 10,
  reviewNeedBoost: 8,
  skipFrictionBoost: 3,
  slowResponseBoost: 3,
  sourceBackedBoost: 1,
  confidenceDampening: -5,
  overexposurePenalty: -6
});

const LEVEL_DIFFICULTY_MAP = Object.freeze({
  beginner: ['starter', 'beginner', 'basic'],
  intermediate: ['common', 'intermediate'],
  advanced: ['advanced', 'rare', 'broad']
});

const ADJACENT_LEVEL_DIFFICULTY_MAP = Object.freeze({
  beginner: ['common'],
  intermediate: ['beginner', 'advanced'],
  advanced: ['intermediate']
});

const GOAL_WEIGHT_RULES = Object.freeze({
  vocabulary: ['vocabulary', 'core_vocab', 'core', 'context'],
  reading: ['reading', 'written', 'kanji', 'literary'],
  listening: ['listening', 'spoken', 'dialogue', 'common'],
  kanji: ['kanji', 'written'],
  speaking: ['speaking', 'spoken', 'dialogue', 'common']
});

const ITEM_PROGRESS_TYPE = Object.freeze({
  vocabulary: 'vocab',
  sentence: null,
  flashcard: 'flashcard'
});

const CONTENT_DISCOVERY_WEIGHTS = Object.freeze({
  transcriptReadyBonus: 2,
  transcriptLinkedBonus: 4,
  trustedLinkBonus: 2,
  providerQualityBonus: 2,
  communityReadyBonus: 1
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeTagList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLower(value)).filter(Boolean))];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundScore = (value) => Math.round(value * 10) / 10;
const daysSince = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
};

const buildItemKey = ({ modelName, item }) =>
  `${normalizeLower(modelName)}:${String(item._id || item.id || item.generatedFromId || item.sourceId || '')}`;

const buildSourceKey = (item) => {
  const provider = normalizeLower(item.sourceProvider);
  const sourceType = normalizeLower(item.sourceType);
  const sourceId = normalizeText(item.sourceId);

  if (!provider || !sourceType || !sourceId) {
    return '';
  }

  return `${provider}:${sourceType}:${sourceId}`;
};

const buildGeneratedKey = (flashcard) => {
  const modelName = normalizeLower(flashcard.generatedFromModel);
  const generatedId = normalizeText(flashcard.generatedFromId);

  if (!modelName || !generatedId) {
    return '';
  }

  return `${modelName}:${generatedId}`;
};

const createEmptySignals = () => ({
  flashcards: [],
  progress: null,
  reviewCount: 0,
  averageProficiency: 0,
  latestReviewedAt: null,
  lastSeenAt: null,
  correctCount: 0,
  incorrectCount: 0,
  skipCount: 0,
  lastRating: '',
  consecutiveCorrect: 0,
  consecutiveMisses: 0,
  easeTrend: 0,
  weaknessScore: 0,
  reviewUrgency: 0,
  averageResponseMs: 0,
  recentOutcomeSummary: [],
  strengthScore: 0
});

const mergeSignals = (current, next) => {
  const flashcards = [...current.flashcards, ...next.flashcards];
  const latestReviewedAt = [current.latestReviewedAt, next.latestReviewedAt]
    .filter(Boolean)
    .sort((left, right) => new Date(right) - new Date(left))[0] || null;

  return {
    flashcards,
    progress: current.progress || next.progress || null,
    reviewCount: current.reviewCount + next.reviewCount,
    averageProficiency: flashcards.length
      ? flashcards.reduce((sum, flashcard) => sum + Number(flashcard.proficiency || 0), 0) / flashcards.length
      : 0,
    latestReviewedAt,
    lastSeenAt: next.lastSeenAt || current.lastSeenAt || null,
    correctCount: current.correctCount + next.correctCount,
    incorrectCount: current.incorrectCount + next.incorrectCount,
    skipCount: current.skipCount + next.skipCount,
    lastRating: next.lastRating || current.lastRating || '',
    consecutiveCorrect: Math.max(current.consecutiveCorrect, next.consecutiveCorrect),
    consecutiveMisses: Math.max(current.consecutiveMisses, next.consecutiveMisses),
    easeTrend: Number((current.easeTrend + next.easeTrend).toFixed(2)),
    weaknessScore: Number((current.weaknessScore + next.weaknessScore).toFixed(2)),
    reviewUrgency: Math.max(current.reviewUrgency, next.reviewUrgency),
    averageResponseMs:
      current.averageResponseMs && next.averageResponseMs
        ? Math.round((current.averageResponseMs + next.averageResponseMs) / 2)
        : current.averageResponseMs || next.averageResponseMs || 0,
    recentOutcomeSummary: [...current.recentOutcomeSummary, ...next.recentOutcomeSummary].slice(-8),
    strengthScore: current.strengthScore + next.strengthScore
  };
};

const buildSignalSnapshot = ({ flashcards = [], progress = null }) => {
  const latestReviewedAt = flashcards
    .map((flashcard) => flashcard.updatedAt || flashcard.createdAt || null)
    .filter(Boolean)
    .sort((left, right) => new Date(right) - new Date(left))[0] || progress?.lastReviewed || null;

  return {
    flashcards,
    progress,
    reviewCount:
      flashcards.reduce((sum, flashcard) => sum + Number(flashcard.reviewCount || 0), 0) +
      Number(progress?.correctCount || 0) +
      Number(progress?.incorrectCount || 0),
    averageProficiency: flashcards.length
      ? flashcards.reduce((sum, flashcard) => sum + Number(flashcard.proficiency || 0), 0) / flashcards.length
      : 0,
    latestReviewedAt,
    lastSeenAt: progress?.lastSeenAt || latestReviewedAt,
    correctCount: Number(progress?.correctCount || 0),
    incorrectCount: Number(progress?.incorrectCount || 0),
    skipCount: Number(progress?.skipCount || 0),
    lastRating: normalizeLower(progress?.lastRating),
    consecutiveCorrect: Number(progress?.consecutiveCorrect || 0),
    consecutiveMisses: Number(progress?.consecutiveMisses || 0),
    easeTrend: Number(progress?.easeTrend || 0),
    weaknessScore: Number(progress?.weaknessScore || 0),
    reviewUrgency: Number(progress?.reviewUrgency || 0),
    averageResponseMs: Number(progress?.averageResponseMs || 0),
    recentOutcomeSummary: Array.isArray(progress?.recentOutcomeSummary) ? progress.recentOutcomeSummary : [],
    strengthScore: Number(progress?.strengthScore || 0)
  };
};

const collectTagMatches = (needleTags = [], haystacks = []) => {
  const normalizedNeedles = normalizeTagList(needleTags);
  const normalizedHaystacks = haystacks.flatMap((values) => normalizeTagList(values));
  return normalizedNeedles.filter((tag) => normalizedHaystacks.includes(tag)).length;
};

const buildRecommendationBand = ({ totalScore, presetResult, userFitResult, reviewBreakdown }) => {
  const reviewPressure =
    Number(reviewBreakdown.weaknessBoost || 0) +
    Number(reviewBreakdown.reviewNeedBoost || 0) +
    Number(reviewBreakdown.skipFrictionBoost || 0) +
    Number(reviewBreakdown.slowResponseBoost || 0);
  const fitStrength = Number(presetResult.score || 0) + Number(userFitResult.score || 0);
  const stabilityDrag =
    Math.abs(Number(reviewBreakdown.confidenceDampening || 0)) +
    Math.abs(Number(reviewBreakdown.overexposurePenalty || 0));

  if (
    reviewPressure >= 16 ||
    Number(reviewBreakdown.reviewUrgency || 0) >= 8 ||
    Number(reviewBreakdown.consecutiveMisses || 0) >= 3 ||
    reviewBreakdown.lastRating === 'again'
  ) {
    return 'urgent_review';
  }

  if (
    reviewPressure >= 8 ||
    Number(reviewBreakdown.skipCount || 0) >= 2 ||
    Number(reviewBreakdown.weaknessScore || 0) >= 4
  ) {
    return 'needs_practice';
  }

  if (stabilityDrag >= 7 && fitStrength <= 10 && totalScore <= 18) {
    return 'lower_priority';
  }

  return 'good_fit_now';
};

const buildDiscoveryBand = ({ totalScore, topicMatches, registerMatches, transcriptReadinessScore }) => {
  if (transcriptReadinessScore >= 5 && (topicMatches >= 1 || registerMatches >= 1) && totalScore >= 18) {
    return 'high_confidence_discovery';
  }

  if (totalScore >= 12) {
    return 'good_fit_now';
  }

  return 'explore_later';
};

const scorePresetFit = ({ item, preset }) => {
  if (!preset) {
    return {
      score: 0,
      breakdown: {
        presetRegisterMatches: 0,
        presetSkillMatches: 0,
        presetDifficultyMatches: 0,
        presetRegisterPenalty: 0
      }
    };
  }

  const registers = normalizeTagList(item.registerTags);
  const skills = normalizeTagList(item.skillTags);
  const difficulty = normalizeLower(item.difficulty || item.difficultyProfile?.general);

  // Preset alignment is the strongest signal because presets are the user's
  // explicit study lane. Register is weighted highest, then skill, then difficulty.
  const registerMatches = collectTagMatches(preset.registerTags, [registers]);
  const skillMatches = collectTagMatches(preset.skillTags, [skills]);
  const difficultyMatches = preset.targetDifficulty.filter((tag) => normalizeLower(tag) === difficulty).length;
  const registerPenalty = registers.length > 0 && registerMatches === 0 ? SCORE_WEIGHTS.presetRegisterMissPenalty : 0;

  return {
    score:
      registerMatches * SCORE_WEIGHTS.presetRegisterMatch +
      skillMatches * SCORE_WEIGHTS.presetSkillMatch +
      difficultyMatches * SCORE_WEIGHTS.presetDifficultyMatch +
      registerPenalty,
    breakdown: {
      presetRegisterMatches: registerMatches,
      presetSkillMatches: skillMatches,
      presetDifficultyMatches: difficultyMatches,
      presetRegisterPenalty: registerPenalty
    }
  };
};

const scoreGoalAndLevelFit = ({ item, user }) => {
  const goals = normalizeTagList(user?.goals);
  const registers = normalizeTagList(item.registerTags);
  const skills = normalizeTagList(item.skillTags);
  const topics = normalizeTagList(item.topicTags);
  const difficulty = normalizeLower(item.difficulty || item.difficultyProfile?.general);
  const level = normalizeLower(user?.level);

  let goalScore = 0;
  let goalMatches = 0;

  goals.forEach((goal) => {
    const weightedTags = GOAL_WEIGHT_RULES[goal] || [];
    const skillMatch = weightedTags.some((tag) => skills.includes(tag) || registers.includes(tag));
    const topicMatch = weightedTags.some((tag) => topics.includes(tag));

    if (skillMatch) {
      goalScore += SCORE_WEIGHTS.goalSkillMatch;
      goalMatches += 1;
    } else if (topicMatch) {
      goalScore += SCORE_WEIGHTS.goalTopicMatch;
      goalMatches += 1;
    }
  });

  let levelScore = 0;
  let levelMatch = 'none';

  // Difficulty matching is deterministic: direct level matches score highest,
  // adjacent difficulty bands still get a smaller boost for graceful fallback.
  if (LEVEL_DIFFICULTY_MAP[level]?.includes(difficulty)) {
    levelScore += SCORE_WEIGHTS.levelDifficultyMatch;
    levelMatch = 'direct';
  } else if (ADJACENT_LEVEL_DIFFICULTY_MAP[level]?.includes(difficulty)) {
    levelScore += SCORE_WEIGHTS.levelAdjacentMatch;
    levelMatch = 'adjacent';
  } else if (!difficulty && level === 'beginner') {
    levelScore += SCORE_WEIGHTS.levelAdjacentMatch;
    levelMatch = 'fallback';
  }

  return {
    score: goalScore + levelScore,
    breakdown: {
      goalMatches,
      goalScore,
      levelScore,
      levelMatch
    }
  };
};

const scoreUserProfileFit = ({ item, user }) => {
  const preferredTopics = normalizeTagList(user?.preferredTopics);
  const preferredRegister = normalizeTagList(user?.preferredRegister);
  const itemTopics = normalizeTagList(item.topicTags);
  const itemRegisters = normalizeTagList(item.registerTags);

  const topicMatches = collectTagMatches(preferredTopics, [itemTopics]);
  const registerMatches = collectTagMatches(preferredRegister, [itemRegisters]);

  return {
    score:
      topicMatches * SCORE_WEIGHTS.preferredTopicMatch +
      registerMatches * SCORE_WEIGHTS.preferredRegisterMatch,
    breakdown: {
      preferredTopicMatches: topicMatches,
      preferredRegisterMatches: registerMatches
    }
  };
};

const scoreContentReadiness = ({ item }) => {
  const transcriptStatus = normalizeLower(item.transcriptStatus);
  const linkedVocabularyCount = Number(item.linkedVocabularyIds?.length || 0);
  const linkedSentenceCount = Number(item.linkedSentenceIds?.length || 0);
  const trustedLinkCount = linkedVocabularyCount + linkedSentenceCount;
  const provider = normalizeLower(item.sourceProvider);

  let score = 0;
  const breakdown = {
    transcriptReadinessScore: 0,
    transcriptTrustedLinkBonus: 0,
    providerQualityBonus: 0,
    communityReadyBonus: 0
  };

  if (transcriptStatus === 'linked') {
    score += CONTENT_DISCOVERY_WEIGHTS.transcriptLinkedBonus;
    breakdown.transcriptReadinessScore += CONTENT_DISCOVERY_WEIGHTS.transcriptLinkedBonus;
  } else if (transcriptStatus === 'ready') {
    score += CONTENT_DISCOVERY_WEIGHTS.transcriptReadyBonus;
    breakdown.transcriptReadinessScore += CONTENT_DISCOVERY_WEIGHTS.transcriptReadyBonus;
  }

  if (trustedLinkCount > 0) {
    const trustedLinkBonus = Math.min(6, trustedLinkCount * CONTENT_DISCOVERY_WEIGHTS.trustedLinkBonus);
    score += trustedLinkBonus;
    breakdown.transcriptTrustedLinkBonus = trustedLinkBonus;
  }

  if (provider === 'lingua_curated') {
    score += CONTENT_DISCOVERY_WEIGHTS.providerQualityBonus;
    breakdown.providerQualityBonus = CONTENT_DISCOVERY_WEIGHTS.providerQualityBonus;
  } else if (provider === 'youtube') {
    score += 1;
    breakdown.providerQualityBonus = 1;
  }

  if (item.recommendationEligible) {
    score += CONTENT_DISCOVERY_WEIGHTS.communityReadyBonus;
    breakdown.communityReadyBonus = CONTENT_DISCOVERY_WEIGHTS.communityReadyBonus;
  }

  return {
    score,
    breakdown
  };
};

const scorePresetRecommendationFit = ({ preset, user }) => {
  const preferredRegister = normalizeTagList(user?.preferredRegister);
  const goals = normalizeTagList(user?.goals);
  const level = normalizeLower(user?.level);
  const presetRegisters = normalizeTagList(preset.registerTags);
  const presetSkills = normalizeTagList(preset.skillTags);
  const targetDifficulty = normalizeTagList(preset.targetDifficulty);

  const registerMatches = collectTagMatches(preferredRegister, [presetRegisters]);
  const goalMatches = collectTagMatches(
    goals.flatMap((goal) => GOAL_WEIGHT_RULES[goal] || [goal]),
    [presetSkills, presetRegisters]
  );

  let levelScore = 0;
  let levelMatch = 'none';

  if (targetDifficulty.includes(level)) {
    levelScore = SCORE_WEIGHTS.levelDifficultyMatch;
    levelMatch = 'direct';
  } else if (
    targetDifficulty.some((difficulty) => ADJACENT_LEVEL_DIFFICULTY_MAP[level]?.includes(difficulty))
  ) {
    levelScore = SCORE_WEIGHTS.levelAdjacentMatch;
    levelMatch = 'adjacent';
  }

  return {
    score:
      registerMatches * SCORE_WEIGHTS.preferredRegisterMatch +
      goalMatches * SCORE_WEIGHTS.goalSkillMatch +
      levelScore,
    breakdown: {
      preferredRegisterMatches: registerMatches,
      presetGoalMatches: goalMatches,
      levelScore,
      levelMatch
    }
  };
};

const scoreReviewSignals = ({ item, signals }) => {
  let score = 0;
  const reviewAgeDays = daysSince(signals.lastSeenAt || signals.latestReviewedAt);
  const weaknessSignal =
    clamp(Number(signals.weaknessScore || 0), 0, 10) * 0.55 +
    clamp(Number(signals.consecutiveMisses || 0), 0, 4) * 1.8 +
    (signals.lastRating === 'again' ? 2.6 : 0) +
    (signals.lastRating === 'hard' ? 1.2 : 0) +
    clamp(Number(signals.skipCount || 0), 0, 4) * 0.35;
  const reviewUrgencySignal =
    clamp(Number(signals.reviewUrgency || 0), 0, 10) * 0.7 +
    clamp(reviewAgeDays, 0, 14) * 0.45 +
    (signals.reviewCount === 0 ? 2.5 : 0);
  const confidenceSignal =
    clamp(Number(signals.consecutiveCorrect || 0), 0, 6) * 0.9 +
    clamp(Number(signals.easeTrend || 0), 0, 4) * 1.1 +
    clamp(Number(signals.averageProficiency || 0), 0, 5) * 0.6 +
    clamp(Number(signals.strengthScore || 0), 0, 12) * 0.3;
  const slowResponseSignal =
    signals.averageResponseMs >= 9000
      ? 3
      : signals.averageResponseMs >= 6500
        ? 2
        : signals.averageResponseMs >= 4000
          ? 1
          : 0;
  const reviewCoverageRatio =
    signals.reviewCount > 0 ? Number(signals.correctCount || 0) / Math.max(1, signals.reviewCount) : 0;

  const breakdown = {
    weaknessBoost: 0,
    reviewNeedBoost: 0,
    skipFrictionBoost: 0,
    slowResponseBoost: 0,
    confidenceDampening: 0,
    overexposurePenalty: 0,
    reviewCount: signals.reviewCount,
    incorrectCount: signals.incorrectCount,
    skipCount: signals.skipCount,
    lastRating: signals.lastRating || '',
    consecutiveCorrect: signals.consecutiveCorrect,
    consecutiveMisses: signals.consecutiveMisses,
    averageResponseMs: signals.averageResponseMs,
    weaknessScore: signals.weaknessScore,
    reviewUrgency: signals.reviewUrgency,
    reviewAgeDays: roundScore(reviewAgeDays),
    recentOutcomeSummary: signals.recentOutcomeSummary,
    averageProficiency: roundScore(Number(signals.averageProficiency || 0)),
    strengthScore: signals.strengthScore
  };

  // Weakness is intentionally capped and damped so one rough review can help
  // reprioritize an item without making it dominate every future session.
  if (
    weaknessSignal >= 3 ||
    signals.strengthScore < 0 ||
    (signals.averageProficiency > 0 && signals.averageProficiency <= 2.2)
  ) {
    const weaknessBoost = roundScore(
      clamp(SCORE_WEIGHTS.weaknessBoost * 0.4 + weaknessSignal, 0, 14)
    );
    score += weaknessBoost;
    breakdown.weaknessBoost = weaknessBoost;
  }

  if (
    reviewUrgencySignal >= 4.5 ||
    signals.averageProficiency === 0 ||
    signals.averageProficiency <= 2.5 ||
    reviewAgeDays >= 5
  ) {
    const reviewNeedBoost = roundScore(
      clamp(SCORE_WEIGHTS.reviewNeedBoost * 0.45 + reviewUrgencySignal, 0, 13)
    );
    score += reviewNeedBoost;
    breakdown.reviewNeedBoost = reviewNeedBoost;
  }

  if (signals.skipCount > 0 || signals.lastRating === 'hard') {
    const skipFrictionBoost = roundScore(
      clamp(
        (signals.lastRating === 'hard' ? 1.2 : 0) +
          clamp(Number(signals.skipCount || 0), 0, 3) * 0.8 +
          SCORE_WEIGHTS.skipFrictionBoost * 0.2,
        0,
        4
      )
    );
    score += skipFrictionBoost;
    breakdown.skipFrictionBoost = skipFrictionBoost;
  }

  if (slowResponseSignal > 0 && signals.averageProficiency < 4.5) {
    const slowResponseBoost = roundScore(
      clamp(slowResponseSignal + SCORE_WEIGHTS.slowResponseBoost * 0.25, 0, 4)
    );
    score += slowResponseBoost;
    breakdown.slowResponseBoost = slowResponseBoost;
  }

  const hasGrowingConfidence =
    confidenceSignal >= 5 &&
    Number(signals.consecutiveMisses || 0) === 0 &&
    reviewCoverageRatio >= 0.65;
  if (hasGrowingConfidence) {
    const confidenceDampening = roundScore(
      -clamp(Math.max(1, confidenceSignal - 4.5), 1, Math.abs(SCORE_WEIGHTS.confidenceDampening))
    );
    score += confidenceDampening;
    breakdown.confidenceDampening = confidenceDampening;
  }

  const hasOverexposure =
    signals.reviewCount >= 6 &&
    signals.correctCount > signals.incorrectCount * 2 &&
    signals.consecutiveCorrect >= 3 &&
    signals.averageProficiency >= 4 &&
    signals.easeTrend >= 1.5 &&
    reviewAgeDays <= 10;
  if (hasOverexposure) {
    const overexposurePenalty = roundScore(
      -clamp(
        Math.abs(SCORE_WEIGHTS.overexposurePenalty) * 0.5 +
          clamp(Number(signals.consecutiveCorrect || 0), 0, 6) * 0.5 +
          Math.max(0, 2 - reviewAgeDays * 0.15),
        2,
        8
      )
    );
    score += overexposurePenalty;
    breakdown.overexposurePenalty = overexposurePenalty;
  }

  if (normalizeText(item.sourceProvider)) {
    score += SCORE_WEIGHTS.sourceBackedBoost;
  }

  return {
    score,
    breakdown
  };
};

const loadRecommendationSignals = async ({ user, modelName, itemType, items }) => {
  if (!user?._id || !Array.isArray(items) || items.length === 0) {
    return new Map();
  }

  const generatedKeys = items
    .map((item) => buildItemKey({ modelName, item }))
    .filter(Boolean);
  const sourceKeys = items.map((item) => buildSourceKey(item)).filter(Boolean);
  const flashcardOrFilters = [
    { generatedFromModel: modelName, generatedFromId: { $in: items.map((item) => String(item._id || '')) } }
  ];

  if (sourceKeys.length > 0) {
    flashcardOrFilters.push(
      ...items
        .filter((item) => buildSourceKey(item))
        .map((item) => ({
          sourceProvider: item.sourceProvider,
          sourceType: item.sourceType,
          sourceId: item.sourceId
        }))
    );
  }

  const flashcards = await Flashcard.find({
    owner: user._id,
    $or: flashcardOrFilters
  }).select('generatedFromModel generatedFromId sourceProvider sourceType sourceId proficiency reviewCount updatedAt createdAt');

  const progressType = ITEM_PROGRESS_TYPE[itemType];
  const progressRecords = progressType
    ? await UserProgress.find({
        userId: user._id,
        itemType: progressType,
        itemId: { $in: items.map((item) => item._id) }
      }).select('itemId correctCount incorrectCount skipCount lastReviewed lastSeenAt lastRating consecutiveCorrect consecutiveMisses easeTrend weaknessScore reviewUrgency averageResponseMs recentOutcomeSummary strengthScore')
    : [];

  const progressMap = new Map(progressRecords.map((record) => [String(record.itemId), record]));
  const signalMap = new Map();

  items.forEach((item) => {
    signalMap.set(buildItemKey({ modelName, item }), buildSignalSnapshot({ progress: progressMap.get(String(item._id)) || null }));
  });

  flashcards.forEach((flashcard) => {
    const generatedKey = buildGeneratedKey(flashcard);
    const sourceKey = buildSourceKey(flashcard);

    generatedKeys
      .filter((key) => key === generatedKey)
      .forEach((key) => {
        signalMap.set(
          key,
          mergeSignals(signalMap.get(key) || createEmptySignals(), buildSignalSnapshot({ flashcards: [flashcard] }))
        );
      });

    if (sourceKey && sourceKeys.includes(sourceKey)) {
      items
        .filter((item) => buildSourceKey(item) === sourceKey)
        .forEach((item) => {
          const key = buildItemKey({ modelName, item });
          signalMap.set(
            key,
            mergeSignals(signalMap.get(key) || createEmptySignals(), buildSignalSnapshot({ flashcards: [flashcard] }))
          );
        });
    }
  });

  return signalMap;
};

const rankRecommendationItems = async ({ user, preset, items, itemType, modelName, serializeItem, tieBreaker }) => {
  const signalsByItem = await loadRecommendationSignals({ user, modelName, itemType, items });

  return items
    .map((item) => {
      const presetResult = scorePresetFit({ item, preset });
      const userFitResult = scoreGoalAndLevelFit({ item, user });
      const reviewSignalResult = scoreReviewSignals({
        item,
        signals: signalsByItem.get(buildItemKey({ modelName, item })) || createEmptySignals()
      });

      const totalScore = presetResult.score + userFitResult.score + reviewSignalResult.score;
      const recommendationBand = buildRecommendationBand({
        totalScore,
        presetResult,
        userFitResult,
        reviewBreakdown: reviewSignalResult.breakdown
      });

      return {
        item,
        totalScore,
        serializedItem: serializeItem(item),
        recommendationDebug: {
          activePreset: preset
            ? {
                id: preset.id,
                name: preset.name
              }
            : null,
          scoreBreakdown: {
            totalScore,
            presetScore: presetResult.score,
            userFitScore: userFitResult.score,
            reviewScore: reviewSignalResult.score,
            recommendationBand,
            ...presetResult.breakdown,
            ...userFitResult.breakdown,
            ...reviewSignalResult.breakdown
          }
        }
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return tieBreaker(left.item, right.item);
    });
};

const rankContentItems = async ({
  user,
  items = [],
  serializeItem = (item) => item,
  tieBreaker = (left, right) => String(left._id || '').localeCompare(String(right._id || ''))
}) => {
  return items
    .map((item) => {
      const userFitResult = scoreGoalAndLevelFit({ item, user });
      const profileFitResult = scoreUserProfileFit({ item, user });
      const contentReadinessResult = scoreContentReadiness({ item });
      const totalScore = userFitResult.score + profileFitResult.score + contentReadinessResult.score;
      const recommendationBand = buildDiscoveryBand({
        totalScore,
        topicMatches: profileFitResult.breakdown.preferredTopicMatches,
        registerMatches: profileFitResult.breakdown.preferredRegisterMatches,
        transcriptReadinessScore:
          contentReadinessResult.breakdown.transcriptReadinessScore +
          contentReadinessResult.breakdown.transcriptTrustedLinkBonus
      });

      return {
        item,
        totalScore,
        serializedItem: serializeItem(item),
        recommendationDebug: {
          scoreBreakdown: {
            totalScore,
            userFitScore: userFitResult.score,
            profileFitScore: profileFitResult.score,
            contentReadinessScore: contentReadinessResult.score,
            recommendationBand,
            ...userFitResult.breakdown,
            ...profileFitResult.breakdown,
            ...contentReadinessResult.breakdown
          }
        }
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return tieBreaker(left.item, right.item);
    });
};

const rankPresetsForUser = ({
  user,
  presets = [],
  tieBreaker = (left, right) => String(left.id || '').localeCompare(String(right.id || ''))
}) => {
  return presets
    .map((preset) => {
      const presetFitResult = scorePresetRecommendationFit({ preset, user });
      const recommendationBand =
        presetFitResult.score >= 20 ? 'strong_match' : presetFitResult.score >= 10 ? 'good_fit_now' : 'explore_later';

      return {
        item: preset,
        totalScore: presetFitResult.score,
        recommendationDebug: {
          scoreBreakdown: {
            totalScore: presetFitResult.score,
            recommendationBand,
            ...presetFitResult.breakdown
          }
        }
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return tieBreaker(left.item, right.item);
    });
};

const rankStudyItems = async ({ user, items = [], modelName = 'Flashcard', tieBreaker = (left, right) => String(left._id || '').localeCompare(String(right._id || '')) }) => {
  return rankStudyItemsWithPreset({
    user,
    preset: null,
    items,
    modelName,
    tieBreaker
  });
};

const rankStudyItemsWithPreset = async ({
  user,
  preset = null,
  items = [],
  modelName = 'Flashcard',
  tieBreaker = (left, right) => String(left._id || '').localeCompare(String(right._id || ''))
}) => {
  const signalsByItem = await loadRecommendationSignals({
    user,
    modelName,
    itemType: 'flashcard',
    items
  });

  return items
    .map((item) => {
      const presetResult = scorePresetFit({ item, preset });
      const userFitResult = scoreGoalAndLevelFit({ item, user });
      const reviewSignalResult = scoreReviewSignals({
        item,
        signals: signalsByItem.get(buildItemKey({ modelName, item })) || createEmptySignals()
      });

      const totalScore = presetResult.score + userFitResult.score + reviewSignalResult.score;
      const recommendationBand = buildRecommendationBand({
        totalScore,
        presetResult,
        userFitResult,
        reviewBreakdown: reviewSignalResult.breakdown
      });

      return {
        item,
        totalScore,
        recommendationDebug: {
          scoreBreakdown: {
            totalScore,
            presetScore: presetResult.score,
            userFitScore: userFitResult.score,
            reviewScore: reviewSignalResult.score,
            recommendationBand,
            ...presetResult.breakdown,
            ...userFitResult.breakdown,
            ...reviewSignalResult.breakdown
          }
        }
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return tieBreaker(left.item, right.item);
    });
};

const shapeStudySessionItems = async ({ user, preset = null, items = [] }) => {
  const rankedItems = await rankStudyItemsWithPreset({
    user,
    preset,
    items,
    modelName: 'Flashcard'
  });
  const shapedItems = [];
  const sourceTypeStreaks = new Map();
  const sourceClusterStreaks = new Map();
  const remainingItems = [...rankedItems];

  // Keep the session deterministic while preventing one source type or category
  // from dominating the early part of the queue.
  while (remainingItems.length > 0) {
    const currentType = normalizeLower(shapedItems[shapedItems.length - 1]?.item.sourceType);
    const currentCluster =
      normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromModel) &&
      normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromId)
        ? `${normalizeLower(shapedItems[shapedItems.length - 1]?.item.generatedFromModel)}:${normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromId)}`
        : buildSourceKey(shapedItems[shapedItems.length - 1]?.item || {});
    const nextIndex = remainingItems.findIndex(({ item }) => {
      const itemType = normalizeLower(item.sourceType);
      const currentStreak = sourceTypeStreaks.get(itemType) || 0;
      const itemCluster =
        normalizeText(item.generatedFromModel) && normalizeText(item.generatedFromId)
          ? `${normalizeLower(item.generatedFromModel)}:${normalizeText(item.generatedFromId)}`
          : buildSourceKey(item);
      const clusterStreak = sourceClusterStreaks.get(itemCluster) || 0;

      if (!currentType) {
        return true;
      }

      if (itemType !== currentType || itemCluster !== currentCluster) {
        return true;
      }

      return currentStreak < 2 && clusterStreak < 1;
    });

    const safeIndex = nextIndex >= 0 ? nextIndex : 0;
    const [nextItem] = remainingItems.splice(safeIndex, 1);
    const itemType = normalizeLower(nextItem.item.sourceType);
    const itemCluster =
      normalizeText(nextItem.item.generatedFromModel) && normalizeText(nextItem.item.generatedFromId)
        ? `${normalizeLower(nextItem.item.generatedFromModel)}:${normalizeText(nextItem.item.generatedFromId)}`
        : buildSourceKey(nextItem.item);

    if (itemType) {
      const previousType = normalizeLower(shapedItems[shapedItems.length - 1]?.item.sourceType);

      if (previousType && previousType !== itemType) {
        sourceTypeStreaks.set(previousType, 0);
      }

      sourceTypeStreaks.set(itemType, (sourceTypeStreaks.get(itemType) || 0) + 1);
    }

    if (itemCluster) {
      const previousCluster =
        normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromModel) &&
        normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromId)
          ? `${normalizeLower(shapedItems[shapedItems.length - 1]?.item.generatedFromModel)}:${normalizeText(shapedItems[shapedItems.length - 1]?.item.generatedFromId)}`
          : buildSourceKey(shapedItems[shapedItems.length - 1]?.item || {});

      if (previousCluster && previousCluster !== itemCluster) {
        sourceClusterStreaks.set(previousCluster, 0);
      }

      sourceClusterStreaks.set(itemCluster, (sourceClusterStreaks.get(itemCluster) || 0) + 1);
    }

    shapedItems.push(nextItem);
  }

  return shapedItems.map((entry, index) => ({
    ...entry,
    queuePosition: index + 1
  }));
};

module.exports = {
  SCORE_WEIGHTS,
  rankContentItems,
  rankPresetsForUser,
  rankRecommendationItems,
  rankStudyItems,
  shapeStudySessionItems
};
