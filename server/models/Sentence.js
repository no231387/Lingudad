const mongoose = require('mongoose');

const listField = {
  type: String,
  trim: true
};

const translationSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: [true, 'Translation language is required'],
      trim: true
    },
    text: {
      type: String,
      required: [true, 'Translation text is required'],
      trim: true
    }
  },
  { _id: false }
);

const tokenSchema = new mongoose.Schema(
  {
    surface: {
      type: String,
      trim: true
    },
    reading: {
      type: String,
      trim: true,
      default: ''
    },
    lemma: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const sentenceSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    text: {
      type: String,
      required: [true, 'Sentence text is required'],
      trim: true
    },
    translations: {
      type: [translationSchema],
      default: []
    },
    tokenized: {
      type: [tokenSchema],
      default: []
    },
    linkedVocabularyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary'
      }
    ],
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

sentenceSchema.index({ language: 1, sourceProvider: 1, sourceId: 1 }, { unique: true });
sentenceSchema.index({ language: 1, text: 1 });
sentenceSchema.index({ difficulty: 1, topicTags: 1, registerTags: 1, skillTags: 1 });

module.exports = mongoose.model('Sentence', sentenceSchema);
