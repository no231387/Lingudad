const mongoose = require('mongoose');

const listField = {
  type: String,
  trim: true
};

const vocabularySchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    term: {
      type: String,
      required: [true, 'Term is required'],
      trim: true
    },
    reading: {
      type: String,
      default: '',
      trim: true
    },
    meanings: {
      type: [listField],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one meaning is required.'
      },
      default: []
    },
    partOfSpeech: {
      type: [listField],
      default: []
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
    difficultyProfile: {
      general: {
        type: String,
        default: '',
        trim: true
      },
      frequencyBand: {
        type: Number,
        default: null
      },
      kanjiLoad: {
        type: Number,
        default: null
      },
      jlptLevel: {
        type: String,
        default: '',
        trim: true
      }
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
    }
  },
  {
    timestamps: true
  }
);

vocabularySchema.index({ language: 1, sourceProvider: 1, sourceId: 1 }, { unique: true });
vocabularySchema.index({ language: 1, term: 1 });
vocabularySchema.index({ language: 1, reading: 1 });
vocabularySchema.index({ language: 1, difficulty: 1 });
vocabularySchema.index({ topicTags: 1 });
vocabularySchema.index({ registerTags: 1 });
vocabularySchema.index({ skillTags: 1 });

module.exports = mongoose.model('Vocabulary', vocabularySchema);
