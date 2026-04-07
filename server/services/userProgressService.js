const UserProgress = require('../models/UserProgress');

const calculateStrengthScore = (progress) => progress.correctCount - progress.incorrectCount;

const upsertProgress = async ({ userId, itemType, itemId, correctDelta = 0, incorrectDelta = 0 }) => {
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
  progress.lastReviewed = new Date();
  progress.strengthScore = calculateStrengthScore(progress);

  await progress.save();

  return progress;
};

module.exports = {
  upsertProgress
};
