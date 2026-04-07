const express = require('express');
const {
  getRecommendedSentences,
  getSentenceById,
  searchSentences
} = require('../controllers/sentenceController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/search', searchSentences);
router.get('/recommended', getRecommendedSentences);
router.get('/:id', getSentenceById);

module.exports = router;
