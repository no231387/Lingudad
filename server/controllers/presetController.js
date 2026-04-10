const { getPresets, getRecommendedPresets } = require('../services/presetService');

exports.getLearningPresets = async (req, res) => {
  try {
    const presets = getPresets({ language: req.query.language || req.user?.language || 'Japanese' });
    res.status(200).json({ items: presets });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load learning presets.', error: error.message });
  }
};

exports.getRecommendedLearningPresets = async (req, res) => {
  try {
    const presets = getRecommendedPresets({
      user: req.user,
      language: req.query.language || req.user?.language || 'Japanese',
      limit: req.query.limit
    });
    res.status(200).json({ items: presets });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load recommended learning presets.', error: error.message });
  }
};
