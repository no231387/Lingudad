const UserProgress = require('../models/UserProgress');

const MAX_RECENT_OUTCOMES = 8;
const RATING_TREND_DELTA = Object.freeze({
  again: -1.2,
  hard: -0.4,
  good: 0.45,
  easy: 1,
  skip: -0.15
});

const clampMin = (value, min = 0) => Math.max(min, value);
const normalizeRating = (value) => String(value || '').trim().toLowerCase();

const calculateStrengthScore = (progress) => {
  const baseScore = progress.correctCount - progress.incorrectCount;
  const streakAdjustment = progress.consecutiveCorrect * 0.4 - progress.consecutiveMisses * 0.9;
  const skipPenalty = progress.skipCount * 0.15;
  return Number((baseScore + streakAdjustment - skipPenalty).toFixed(2));
};

const calculateWeaknessScore = (progress) => {
  const missWeight = progress.incorrectCount * 1.6;
  const streakWeight = progress.consecutiveMisses * 2.4;
  const skipWeight = progress.skipCount * 0.35;
  const easePenalty = progress.easeTrend < 0 ? Math.abs(progress.easeTrend) * 1.4 : 0;
  const successRelief = progress.correctCount * 0.18 + progress.consecutiveCorrect * 0.5;

  return Number(clampMin(missWeight + streakWeight + skipWeight + easePenalty - successRelief).toFixed(2));
};

const calculateReviewUrgency = (progress) => {
  const now = Date.now();
  const lastSeenAt = progress.lastSeenAt ? new Date(progress.lastSeenAt).getTime() : 0;
  const daysSinceSeen = lastSeenAt ? (now - lastSeenAt) / (1000 * 60 * 60 * 24) : 0;
  const freshnessBoost = progress.lastSeenAt ? Math.min(5, daysSinceSeen * 0.7) : 5;
  const weaknessContribution = progress.weaknessScore * 0.55;
  const lowConfidenceContribution = progress.lastRating === 'again' || progress.lastRating === 'hard' ? 2 : 0;
  const easeRelief = progress.easeTrend > 1.5 ? 1.5 : 0;

  return Number(clampMin(freshnessBoost + weaknessContribution + lowConfidenceContribution - easeRelief).toFixed(2));
};

const appendRecentOutcome = (progress, outcome) => {
  progress.recentOutcomeSummary = [...(Array.isArray(progress.recentOutcomeSummary) ? progress.recentOutcomeSummary : []), outcome].slice(-MAX_RECENT_OUTCOMES);
};

const updateTrendAndStreaks = ({ progress, rating }) => {
  const normalizedRating = normalizeRating(rating);

  if (!normalizedRating) {
    return;
  }

  if (normalizedRating === 'skip') {
    progress.skipCount += 1;
  }

  if (normalizedRating === 'again') {
    progress.consecutiveMisses += 1;
    progress.consecutiveCorrect = 0;
  } else if (normalizedRating === 'good' || normalizedRating === 'easy') {
    progress.consecutiveCorrect += 1;
    progress.consecutiveMisses = 0;
  } else if (normalizedRating === 'hard') {
    progress.consecutiveCorrect = 0;
    progress.consecutiveMisses = 0;
  }

  progress.easeTrend = Number((progress.easeTrend + (RATING_TREND_DELTA[normalizedRating] || 0)).toFixed(2));
  progress.lastRating = normalizedRating;
  appendRecentOutcome(progress, normalizedRating);
};

const updateAverageResponse = ({ progress, durationMs }) => {
  const safeDuration = Number(durationMs || 0);

  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    return;
  }

  const priorInteractions =
    progress.correctCount + progress.incorrectCount + progress.skipCount;

  if (priorInteractions <= 1 || progress.averageResponseMs <= 0) {
    progress.averageResponseMs = Math.round(safeDuration);
    return;
  }

  progress.averageResponseMs = Math.round((progress.averageResponseMs * 0.7) + (safeDuration * 0.3));
};

const upsertProgress = async ({
  userId,
  itemType,
  itemId,
  correctDelta = 0,
  incorrectDelta = 0,
  rating = '',
  durationMs = 0
}) => {
  const progress = await UserProgress.findOneAndUpdate(
    { userId, itemType, itemId },
    {
      $setOnInsert: {
        userId,
        itemType,
        itemId
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  progress.correctCount += Math.max(0, correctDelta);
  progress.incorrectCount += Math.max(0, incorrectDelta);
  progress.lastSeenAt = new Date();
  progress.lastReviewed = new Date();
  updateTrendAndStreaks({ progress, rating });
  updateAverageResponse({ progress, durationMs });
  progress.strengthScore = calculateStrengthScore(progress);
  progress.weaknessScore = calculateWeaknessScore(progress);
  progress.reviewUrgency = calculateReviewUrgency(progress);

  await progress.save();

  return progress;
};

module.exports = {
  upsertProgress
};
