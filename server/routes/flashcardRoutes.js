const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getFlashcards,
  getFlashcardById,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  updateProficiency,
  resetFlashcardProficiency,
  reviewFlashcard,
  getDashboardStats,
  bulkImportFlashcards,
  removeDuplicateWords,
  getCommunityFlashcards,
  createFlashcardFromVocabulary,
  createFlashcardFromSentence
} = require('../controllers/flashcardController');

const router = express.Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/community', getCommunityFlashcards);
router.post('/from-vocabulary/:id', createFlashcardFromVocabulary);
router.post('/from-sentence/:id', createFlashcardFromSentence);
router.post('/import', bulkImportFlashcards);
router.delete('/duplicates/words', removeDuplicateWords);
router.route('/').get(getFlashcards).post(createFlashcard);
router.route('/:id').get(getFlashcardById).put(updateFlashcard).delete(deleteFlashcard);
router.patch('/:id/proficiency', updateProficiency);
router.patch('/:id/reset-proficiency', resetFlashcardProficiency);
router.patch('/:id/review', reviewFlashcard);

module.exports = router;
