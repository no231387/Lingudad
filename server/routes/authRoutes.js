const express = require('express');
const { registerUser, loginUser, getCurrentUser, updateCurrentUserProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateCurrentUserProfile);

module.exports = router;
