const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;

const getJwtSecret = () => process.env.JWT_SECRET || 'development_jwt_secret_change_me';

const buildAuthResponse = (user) => {
  const token = jwt.sign({ userId: user._id }, getJwtSecret(), {
    expiresIn: '7d'
  });

  return {
    token,
    user: {
      _id: user._id,
      username: user.username
    }
  };
};

exports.registerUser = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ message: 'That username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      username,
      passwordHash
    });

    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Failed to register user.', error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    res.status(200).json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Failed to log in.', error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  res.status(200).json({
    user: {
      _id: req.user._id,
      username: req.user.username
    }
  });
};
