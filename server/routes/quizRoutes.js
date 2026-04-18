const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  completeQuizSession,
  createQuizFromSentence,
  createQuizFromVocabulary,
  getPlayableQuizItems,
  getRecentQuizSessions,
  getQuizSession,
  launchQuizSession,
  submitQuizAnswer
} = require('../controllers/quizController');

const router = express.Router();

router.use(protect);

router.post('/from-vocabulary/:id', createQuizFromVocabulary);
router.post('/from-sentence/:id', createQuizFromSentence);
router.get('/items', getPlayableQuizItems);
router.get('/sessions', getRecentQuizSessions);
router.post('/launch', launchQuizSession);
router.get('/sessions/:id', getQuizSession);
router.post('/sessions/:id/answers', submitQuizAnswer);
router.post('/sessions/:id/complete', completeQuizSession);

module.exports = router;
