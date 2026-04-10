const express = require('express');
const { getLearningPresets, getRecommendedLearningPresets } = require('../controllers/presetController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/recommended', getRecommendedLearningPresets);
router.get('/', getLearningPresets);

module.exports = router;
