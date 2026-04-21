const express = require('express');
const {
  createLearningContent,
  generateFlashcardsFromContent,
  getContentTranscriptSegments,
  getLearningContent,
  getLearningContentById,
  getRecommendedLearningContent,
  sourceAndPromoteYoutubeCandidates,
  startStudySessionFromContent,
  promoteSourcedCandidate,
  createWorkspaceCopy,
  getTranscriptBackedStudyPack,
  saveContentTranscriptSegments,
  saveLearningContent,
  sourceYoutubeCandidates,
  unsaveLearningContent
} = require('../controllers/contentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/recommended', getRecommendedLearningContent);
router.post('/source/youtube-candidates', sourceYoutubeCandidates);
router.post('/source-and-promote/youtube', sourceAndPromoteYoutubeCandidates);
router.post('/:id/promote-sourced-candidate', promoteSourcedCandidate);
router.route('/').get(getLearningContent).post(createLearningContent);
router.get('/:id', getLearningContentById);
router.post('/:id/workspace-copy', createWorkspaceCopy);
router.get('/:id/study-pack', getTranscriptBackedStudyPack);
router.post('/:id/start-study', startStudySessionFromContent);
router.route('/:id/transcript-segments').get(getContentTranscriptSegments).post(saveContentTranscriptSegments);
router.post('/:id/generate-flashcards', generateFlashcardsFromContent);
router.post('/:id/save', saveLearningContent);
router.delete('/:id/save', unsaveLearningContent);

module.exports = router;
