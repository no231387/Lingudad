const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getTags, createTag } = require('../controllers/tagController');

const router = express.Router();

router.use(protect);

router.route('/').get(getTags).post(createTag);

module.exports = router;
