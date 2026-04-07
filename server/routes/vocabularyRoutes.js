const express = require('express');
const {
  getRecommendedVocabulary,
  getVocabularyById,
  searchVocabulary
} = require('../controllers/vocabularyController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/search', searchVocabulary);
router.get('/recommended', getRecommendedVocabulary);
router.get('/:id', getVocabularyById);

module.exports = router;
