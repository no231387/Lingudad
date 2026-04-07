const express = require('express');
const {
  createLearningContent,
  getLearningContent,
  getLearningContentById,
  saveLearningContent,
  unsaveLearningContent
} = require('../controllers/contentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getLearningContent).post(createLearningContent);
router.get('/:id', getLearningContentById);
router.post('/:id/save', saveLearningContent);
router.delete('/:id/save', unsaveLearningContent);

module.exports = router;
