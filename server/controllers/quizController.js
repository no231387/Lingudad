const {
  createQuizFromSentence: generateQuizFromSentence,
  createQuizFromVocabulary: generateQuizFromVocabulary
} = require('../services/studyGenerationService');

exports.createQuizFromVocabulary = async (req, res) => {
  try {
    const quiz = await generateQuizFromVocabulary({ id: req.params.id, user: req.user });
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create quiz from vocabulary.', error: error.message });
  }
};

exports.createQuizFromSentence = async (req, res) => {
  try {
    const quiz = await generateQuizFromSentence({ id: req.params.id, user: req.user });
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create quiz from sentence.', error: error.message });
  }
};
