const express = require('express');
const { getLearningPresets } = require('../controllers/presetController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getLearningPresets);

module.exports = router;
