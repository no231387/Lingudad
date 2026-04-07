const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema(
  {
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
    meaning: {
      type: String,
      required: [true, 'Meaning is required'],
      trim: true
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    difficulty: {
      type: String,
      default: '',
      trim: true
    },
    sourceProvider: {
      type: String,
      required: [true, 'Source provider is required'],
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

module.exports = mongoose.model('Vocabulary', vocabularySchema);
