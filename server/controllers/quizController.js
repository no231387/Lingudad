const {
  createQuizFromSentence: generateQuizFromSentence,
  createQuizFromVocabulary: generateQuizFromVocabulary
} = require('../services/studyGenerationService');
const {
  completeQuizSession: finalizeQuizSession,
  evaluateQuizAnswer,
  getQuizSession: getQuizSessionById,
  listPlayableQuizItems,
  listRecentQuizSessions,
  launchQuizSession: launchPlayableQuizSession
} = require('../services/quizSessionService');

exports.createQuizFromVocabulary = async (req, res) => {
  try {
    const quiz = await generateQuizFromVocabulary({ id: req.params.id, user: req.user });
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create quiz from vocabulary.', error: error.message });
  }
};

exports.createQuizFromSentence = async (req, res) => {
  try {
    const quiz = await generateQuizFromSentence({ id: req.params.id, user: req.user });
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create quiz from sentence.', error: error.message });
  }
};

exports.launchQuizSession = async (req, res) => {
  try {
    const session = await launchPlayableQuizSession({
      userId: req.user._id,
      quizItemIds: req.body.quizItemIds,
      limit: req.body.limit
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ message: 'Failed to launch quiz session.', error: error.message });
  }
};

exports.getQuizSession = async (req, res) => {
  try {
    const session = await getQuizSessionById({
      sessionId: req.params.id,
      userId: req.user._id
    });
    res.status(200).json(session);
  } catch (error) {
    const statusCode = error.message === 'Quiz session not found.' ? 404 : 400;
    res.status(statusCode).json({ message: 'Failed to fetch quiz session.', error: error.message });
  }
};

exports.submitQuizAnswer = async (req, res) => {
  try {
    const result = await evaluateQuizAnswer({
      sessionId: req.params.id,
      userId: req.user._id,
      quizItemId: req.body.quizItemId,
      answer: req.body.answer,
      eventType: req.body.eventType,
      responseMs: req.body.responseMs
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Failed to submit quiz answer.', error: error.message });
  }
};

exports.completeQuizSession = async (req, res) => {
  try {
    const session = await finalizeQuizSession({
      sessionId: req.params.id,
      userId: req.user._id
    });
    res.status(200).json(session);
  } catch (error) {
    const statusCode = error.message === 'Quiz session not found.' ? 404 : 400;
    res.status(statusCode).json({ message: 'Failed to complete quiz session.', error: error.message });
  }
};

exports.getPlayableQuizItems = async (req, res) => {
  try {
    const items = await listPlayableQuizItems({
      userId: req.user._id,
      limit: req.query.limit
    });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch playable quiz items.', error: error.message });
  }
};

exports.getRecentQuizSessions = async (req, res) => {
  try {
    const sessions = await listRecentQuizSessions({
      userId: req.user._id,
      limit: req.query.limit
    });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recent quiz sessions.', error: error.message });
  }
};
