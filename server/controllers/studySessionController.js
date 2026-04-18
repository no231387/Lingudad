const StudySession = require('../models/StudySession');
const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const mongoose = require('mongoose');
const { upsertProgress } = require('../services/userProgressService');

const SESSION_POPULATION = [
  { path: 'owner', select: 'username' },
  { path: 'deck', select: 'name language' },
  { path: 'flashcards', select: 'wordOrPhrase translation language' }
];

const buildAccessFilter = (user) => ({ owner: user._id });

const ownsRecord = (record, user) => String(record.owner) === String(user._id);
const REVIEW_RATINGS = new Set(['again', 'hard', 'good', 'easy']);
const CONTENT_PROGRESS_TYPE_BY_MODEL = Object.freeze({
  Vocabulary: 'vocab',
  Sentence: 'sentence'
});

exports.getStudySessions = async (req, res) => {
  try {
    const sessions = await StudySession.find(buildAccessFilter(req.user)).populate(SESSION_POPULATION).sort({ completedAt: -1 }).limit(20);
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch study sessions.', error: error.message });
  }
};

exports.createStudySession = async (req, res) => {
  try {
    const flashcardIds = Array.isArray(req.body.flashcards) ? req.body.flashcards : [];
    const sessionItems = Array.isArray(req.body.sessionItems) ? req.body.sessionItems : [];
    const sessionSource = String(req.body.sessionSource || 'flashcard').trim() === 'content' ? 'content' : 'flashcard';
    const sourceContentId = String(req.body.sourceContentId || '').trim();
    const sourceContentTitle = String(req.body.sourceContentTitle || '').trim();
    const itemCount = Number(req.body.itemCount || flashcardIds.length || sessionItems.length || 0);
    const reviewedCount = Number(req.body.reviewedCount || flashcardIds.length || sessionItems.length || 0);
    const againCount = Number(req.body.againCount || 0);
    const hardCount = Number(req.body.hardCount || 0);
    const goodCount = Number(req.body.goodCount || 0);
    const easyCount = Number(req.body.easyCount || 0);
    const deckId = req.body.deck || null;
    const presetId = String(req.body.presetId || '').trim();
    const shapingStrategy = String(req.body.shapingStrategy || '').trim();
    const sourceMetadata = req.body.sourceMetadata && typeof req.body.sourceMetadata === 'object' ? req.body.sourceMetadata : {};

    if (flashcardIds.length > 0) {
      const flashcards = await Flashcard.find({
        _id: { $in: flashcardIds },
        ...buildAccessFilter(req.user)
      });

      if (flashcards.length !== flashcardIds.length) {
        return res.status(403).json({ message: 'You can only save study sessions for accessible flashcards.' });
      }
    }

    if (deckId) {
      const deck = await Deck.findById(deckId);

      if (!deck || !ownsRecord(deck, req.user)) {
        return res.status(403).json({ message: 'You can only use decks you have access to.' });
      }
    }

    if (sessionSource === 'content' && sessionItems.length === 0) {
      return res.status(400).json({ message: 'Content study sessions need session items.' });
    }

    const session = await StudySession.create({
      owner: req.user._id,
      deck: deckId,
      presetId,
      shapingStrategy,
      sessionSource,
      sourceContentId,
      sourceContentTitle,
      itemCount,
      flashcards: flashcardIds,
      sessionItems,
      sourceMetadata,
      reviewedCount,
      againCount,
      hardCount,
      goodCount,
      easyCount,
      startedAt: req.body.startedAt || new Date(),
      completedAt: req.body.completedAt || new Date()
    });

    await session.populate(SESSION_POPULATION);

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ message: 'Failed to save study session.', error: error.message });
  }
};

exports.recordContentStudyFeedback = async (req, res) => {
  try {
    const rating = String(req.body.rating || '').trim().toLowerCase();
    const durationMs = Number(req.body.durationMs || 0);
    const eventType = String(req.body.eventType || '').trim().toLowerCase();
    const trustedAnchor = req.body.trustedAnchor && typeof req.body.trustedAnchor === 'object' ? req.body.trustedAnchor : null;

    if (eventType !== 'rating' && eventType !== 'skip') {
      return res.status(400).json({ message: 'Content study feedback event must be rating or skip.' });
    }

    if (eventType === 'rating' && !REVIEW_RATINGS.has(rating)) {
      return res.status(400).json({ message: 'Rating must be one of: again, hard, good, easy.' });
    }

    if (!trustedAnchor?.model || !trustedAnchor?.id) {
      return res.status(200).json({
        recorded: false,
        ignored: true,
        reason: 'no_trusted_anchor'
      });
    }

    const itemType = CONTENT_PROGRESS_TYPE_BY_MODEL[String(trustedAnchor.model).trim()];

    if (!itemType) {
      return res.status(200).json({
        recorded: false,
        ignored: true,
        reason: 'unsupported_trusted_anchor'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(trustedAnchor.id))) {
      return res.status(400).json({ message: 'Trusted anchor id is invalid.' });
    }

    const normalizedRating = eventType === 'skip' ? 'skip' : rating;
    const isCorrect = normalizedRating === 'good' || normalizedRating === 'easy';
    const isIncorrect = normalizedRating === 'again';

    const progress = await upsertProgress({
      userId: req.user._id,
      itemType,
      itemId: trustedAnchor.id,
      correctDelta: isCorrect ? 1 : 0,
      incorrectDelta: isIncorrect ? 1 : 0,
      rating: normalizedRating,
      durationMs
    });

    res.status(200).json({
      recorded: true,
      ignored: false,
      target: {
        model: trustedAnchor.model,
        id: String(trustedAnchor.id),
        itemType
      },
      progress
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to record content study feedback.', error: error.message });
  }
};

exports.deleteStudySession = async (req, res) => {
  try {
    const session = await StudySession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Study session not found.' });
    }

    if (!ownsRecord(session, req.user)) {
      return res.status(403).json({ message: 'You can only delete your own study sessions.' });
    }

    await session.deleteOne();

    res.status(200).json({ message: 'Study session deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete study session.', error: error.message });
  }
};
