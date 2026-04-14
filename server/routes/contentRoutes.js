const express = require('express');
const {
  createLearningContent,
  generateFlashcardsFromContent,
  getContentTranscriptSegments,
  getLearningContent,
  getLearningContentById,
  getRecommendedLearningContent,
  startStudySessionFromContent,
  getTranscriptBackedStudyPack,
  saveContentTranscriptSegments,
  saveLearningContent,
  unsaveLearningContent
} = require('../controllers/contentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/recommended', getRecommendedLearningContent);
router.route('/').get(getLearningContent).post(createLearningContent);
router.get('/:id', getLearningContentById);
router.get('/:id/study-pack', getTranscriptBackedStudyPack);
router.post('/:id/start-study', startStudySessionFromContent);
router.route('/:id/transcript-segments').get(getContentTranscriptSegments).post(saveContentTranscriptSegments);
router.post('/:id/generate-flashcards', generateFlashcardsFromContent);
router.post('/:id/save', saveLearningContent);
router.delete('/:id/save', unsaveLearningContent);

module.exports = router;
