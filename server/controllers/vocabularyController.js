const {
  getRecommendedVocabulary,
  getVocabularyById,
  searchVocabulary
} = require('../services/vocabularyService');

exports.searchVocabulary = async (req, res) => {
  try {
    const items = await searchVocabulary({ query: req.query });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search vocabulary.', error: error.message });
  }
};

exports.getVocabularyById = async (req, res) => {
  try {
    const item = await getVocabularyById({ id: req.params.id, user: req.user });
    res.status(200).json(item);
  } catch (error) {
    const statusCode = error.message === 'Vocabulary item not found.' ? 404 : 400;
    res.status(statusCode).json({ message: error.message });
  }
};

exports.getRecommendedVocabulary = async (req, res) => {
  try {
    const payload = await getRecommendedVocabulary({ user: req.user, query: req.query });
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load recommended vocabulary.', error: error.message });
  }
};
