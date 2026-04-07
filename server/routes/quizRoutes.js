const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { createQuizFromVocabulary, createQuizFromSentence } = require('../controllers/quizController');

const router = express.Router();

router.use(protect);

router.post('/from-vocabulary/:id', createQuizFromVocabulary);
router.post('/from-sentence/:id', createQuizFromSentence);

module.exports = router;
