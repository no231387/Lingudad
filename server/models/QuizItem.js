const mongoose = require('mongoose');

const listField = {
  type: String,
  trim: true
};

const quizMetadataSchema = new mongoose.Schema(
  {
    originalText: {
      type: String,
      default: '',
      trim: true
    },
    reading: {
      type: String,
      default: '',
      trim: true
    },
    translations: {
      type: [listField],
      default: []
    },
    scaffoldOnly: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const quizItemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required']
    },
    quizType: {
      type: String,
      required: [true, 'Quiz type is required'],
      trim: true
    },
    prompt: {
      type: String,
      required: [true, 'Prompt is required'],
      trim: true
    },
    answers: {
      type: [listField],
      default: []
    },
    correctAnswer: {
      type: String,
      required: [true, 'Correct answer is required'],
      trim: true
    },
    sourceProvider: {
      type: String,
      required: [true, 'Source provider is required'],
      trim: true
    },
    sourceType: {
      type: String,
      required: [true, 'Source type is required'],
      trim: true
    },
    sourceId: {
      type: String,
      required: [true, 'Source id is required'],
      trim: true
    },
    generatedFromModel: {
      type: String,
      required: [true, 'Generated-from model is required'],
      trim: true
    },
    generatedFromId: {
      type: String,
      required: [true, 'Generated-from id is required'],
      trim: true
    },
    topicTags: {
      type: [listField],
      default: []
    },
    registerTags: {
      type: [listField],
      default: []
    },
    skillTags: {
      type: [listField],
      default: []
    },
    difficulty: {
      type: String,
      default: '',
      trim: true
    },
    metadata: {
      type: quizMetadataSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

quizItemSchema.index({ owner: 1, createdAt: -1 });
quizItemSchema.index({ sourceProvider: 1, sourceType: 1, sourceId: 1 });
quizItemSchema.index({ generatedFromModel: 1, generatedFromId: 1 });

module.exports = mongoose.model('QuizItem', quizItemSchema);
