const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getStudySessions, createStudySession, deleteStudySession } = require('../controllers/studySessionController');

const router = express.Router();

router.use(protect);

router.route('/').get(getStudySessions).post(createStudySession);
router.route('/:id').delete(deleteStudySession);

module.exports = router;
