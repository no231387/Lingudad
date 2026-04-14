const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');
const LearningContent = require('../models/LearningContent');
const StudySession = require('../models/StudySession');
const { serializeContent, getRecommendedContent } = require('../services/contentService');
const { getRecommendedPresets } = require('../services/presetService');

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

exports.getDashboardOverview = async (req, res) => {
  try {
    const today = startOfToday();
    const userId = req.user._id;

    const [decks, sessions, recommendedContent, savedContent, totalCards, masteredCards, newCards] = await Promise.all([
      Deck.find({ owner: userId }).sort({ updatedAt: -1 }).limit(4),
      StudySession.find({ owner: userId }).populate({ path: 'deck', select: 'name language' }).sort({ completedAt: -1 }).limit(3),
      getRecommendedContent({ user: req.user, query: { limit: 4 } }),
      LearningContent.find({
        savedBy: userId,
        $or: [{ visibility: CONTENT_VISIBILITY.COMMUNITY }, { createdBy: userId }]
      })
        .sort({ updatedAt: -1 })
        .limit(2),
      Flashcard.countDocuments({ owner: userId }),
      Flashcard.countDocuments({ owner: userId, proficiency: 5 }),
      Flashcard.countDocuments({ owner: userId, proficiency: 1 })
    ]);

    const deckIds = decks.map((deck) => deck._id);
    const deckCardCounts = deckIds.length
      ? await Flashcard.aggregate([
          { $match: { owner: userId, deck: { $in: deckIds } } },
          { $group: { _id: '$deck', total: { $sum: 1 } } }
        ])
      : [];
    const deckCountMap = new Map(deckCardCounts.map((entry) => [String(entry._id), entry.total]));

    const reviewedTodaySessions = await StudySession.find({ owner: userId, completedAt: { $gte: today } }).select('reviewedCount');
    const reviewedToday = reviewedTodaySessions.reduce((sum, session) => sum + (session.reviewedCount || 0), 0);
    const dailyGoal = req.user.dailyGoal || 0;
    const recommendedPresets = await getRecommendedPresets({
      user: req.user,
      language: req.user.language || 'Japanese',
      limit: 3
    });

    res.status(200).json({
      stats: {
        total: totalCards,
        mastered: masteredCards,
        newCards
      },
      continueLearning: {
        sessions,
        savedContent: savedContent.map((item) => serializeContent(item, userId))
      },
      dailyPractice: {
        dailyGoal,
        reviewedToday,
        remaining: Math.max(0, dailyGoal - reviewedToday)
      },
      recommendedContent: recommendedContent.items,
      recommendedPresets,
      decks: decks.map((deck) => ({
        ...deck.toObject(),
        flashcardCount: deckCountMap.get(String(deck._id)) || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dashboard overview.', error: error.message });
  }
};
