const assert = require('assert');
const { buildSentenceQuizPayload } = require('../services/studyGenerationService');

const mockUser = { _id: 'test-user-id' };

const mockSentence = {
  _id: 'sentence-id',
  language: 'Japanese',
  text: 'またね！',
  translations: [{ language: 'English', text: 'See you later!' }],
  sourceProvider: 'user',
  sourceType: 'sentence',
  sourceId: 'preset-test-sentence-matane',
  topicTags: [],
  registerTags: ['casual'],
  skillTags: ['listening'],
  difficulty: 'beginner',
  linkedVocabularyIds: [],
  tokenized: []
};

const quiz = buildSentenceQuizPayload(mockSentence, mockUser);

assert.equal(quiz.quizType, 'cloze');
assert.equal(quiz.prompt, '____！');
assert.equal(quiz.correctAnswer, 'またね');
assert.equal(quiz.metadata.originalText, 'またね！');

console.log('Sentence cloze verification passed.');
