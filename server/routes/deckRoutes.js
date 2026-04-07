const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getDecks,
  getOfficialBeginnerDecks,
  getOfficialBeginnerDeckFlashcards,
  createDeck,
  createOfficialBeginnerDeck,
  importDeckToOfficialBeginnerDeck,
  addFlashcardsToDeck,
  resetDeckProficiency,
  updateDeck,
  updateOfficialBeginnerDeck,
  deleteDeck,
  deleteOfficialBeginnerDeck
} = require('../controllers/deckController');

const router = express.Router();

router.use(protect);

router.route('/').get(getDecks).post(createDeck);
router.get('/official-beginner', getOfficialBeginnerDecks);
router.post('/official-beginner', createOfficialBeginnerDeck);
router.get('/official-beginner/:id/flashcards', getOfficialBeginnerDeckFlashcards);
router.post('/:id/import-to-official-beginner', importDeckToOfficialBeginnerDeck);
router.post('/:id/flashcards', addFlashcardsToDeck);
router.patch('/:id/reset-proficiency', resetDeckProficiency);
router.route('/:id').put(updateDeck).delete(deleteDeck);
router.put('/official-beginner/:id', updateOfficialBeginnerDeck);
router.delete('/official-beginner/:id', deleteOfficialBeginnerDeck);

module.exports = router;
