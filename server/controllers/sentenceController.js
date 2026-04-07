const {
  getRecommendedSentences,
  getSentenceById,
  searchSentences
} = require('../services/sentenceService');

exports.searchSentences = async (req, res) => {
  try {
    const items = await searchSentences({ query: req.query });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search sentences.', error: error.message });
  }
};

exports.getSentenceById = async (req, res) => {
  try {
    const item = await getSentenceById({ id: req.params.id, user: req.user });
    res.status(200).json(item);
  } catch (error) {
    const statusCode = error.message === 'Sentence not found.' ? 404 : 400;
    res.status(statusCode).json({ message: error.message });
  }
};

exports.getRecommendedSentences = async (req, res) => {
  try {
    const payload = await getRecommendedSentences({ user: req.user, query: req.query });
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load recommended sentences.', error: error.message });
  }
};
