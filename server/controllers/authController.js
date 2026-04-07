const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;

const getJwtSecret = () => process.env.JWT_SECRET || 'development_jwt_secret_change_me';

const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const GOALS = new Set(['listening', 'reading', 'vocabulary', 'kanji', 'speaking']);

const normalizeText = (value) => String(value || '').trim();
const normalizeTextList = (value) => {
  const rawValues = Array.isArray(value) ? value : [];
  return [...new Set(rawValues.map((item) => normalizeText(item)).filter(Boolean))];
};

const normalizeGoals = (value) => {
  const rawGoals = Array.isArray(value) ? value : [];
  return [...new Set(rawGoals.map((goal) => normalizeText(goal).toLowerCase()).filter((goal) => GOALS.has(goal)))];
};

const buildUserProfile = (user) => ({
  _id: user._id,
  username: user.username,
  language: user.language || '',
  level: user.level || '',
  goals: Array.isArray(user.goals) ? user.goals : [],
  preferredTopics: Array.isArray(user.preferredTopics) ? user.preferredTopics : [],
  preferredRegister: Array.isArray(user.preferredRegister) ? user.preferredRegister : [],
  dailyGoal: user.dailyGoal ?? null,
  onboardingCompleted: Boolean(user.onboardingCompleted)
});

const buildAuthResponse = (user) => {
  const token = jwt.sign({ userId: user._id }, getJwtSecret(), {
    expiresIn: '7d'
  });

  return {
    token,
    user: buildUserProfile(user)
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
    user: buildUserProfile(req.user)
  });
};

exports.updateCurrentUserProfile = async (req, res) => {
  try {
    const language = normalizeText(req.body.language);
    const level = normalizeText(req.body.level).toLowerCase();
    const goals = normalizeGoals(req.body.goals);
    const preferredTopics = normalizeTextList(req.body.preferredTopics);
    const preferredRegister = normalizeTextList(req.body.preferredRegister);
    const dailyGoal = req.body.dailyGoal === '' || req.body.dailyGoal === null || req.body.dailyGoal === undefined
      ? null
      : Number(req.body.dailyGoal);

    if (!language) {
      return res.status(400).json({ message: 'Language is required.' });
    }

    if (!LEVELS.has(level)) {
      return res.status(400).json({ message: 'Level must be beginner, intermediate, or advanced.' });
    }

    if (goals.length === 0) {
      return res.status(400).json({ message: 'Select at least one learning goal.' });
    }

    if (dailyGoal !== null && (!Number.isInteger(dailyGoal) || dailyGoal < 0)) {
      return res.status(400).json({ message: 'Daily goal must be a whole number.' });
    }

    req.user.language = language;
    req.user.level = level;
    req.user.goals = goals;
    req.user.preferredTopics = preferredTopics;
    req.user.preferredRegister = preferredRegister;
    req.user.dailyGoal = dailyGoal;
    req.user.onboardingCompleted = true;

    await req.user.save();

    res.status(200).json({
      user: buildUserProfile(req.user)
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update profile.', error: error.message });
  }
};
