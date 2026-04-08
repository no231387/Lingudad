const mongoose = require('mongoose');

const tagField = {
  type: String,
  trim: true
};

const learningContentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    contentType: {
      type: String,
      enum: ['youtube', 'uploaded', 'other'],
      default: 'youtube'
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
    },
    externalId: {
      type: String,
      default: '',
      trim: true
    },
    url: {
      type: String,
      default: '',
      trim: true
    },
    embedUrl: {
      type: String,
      default: '',
      trim: true
    },
    thumbnail: {
      type: String,
      default: '',
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true
    },
    duration: {
      type: Number,
      default: null,
      min: 0
    },
    topicTags: {
      type: [tagField],
      default: []
    },
    registerTags: {
      type: [tagField],
      default: []
    },
    skillTags: {
      type: [tagField],
      default: []
    },
    difficulty: {
      type: String,
      default: '',
      trim: true
    },
    transcriptStatus: {
      type: String,
      enum: ['none', 'pending', 'ready'],
      default: 'none'
    },
    transcriptAvailable: {
      type: Boolean,
      default: false
    },
    transcript: {
      type: String,
      default: '',
      trim: true
    },
    linkedVocabularyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary'
      }
    ],
    linkedSentenceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sentence'
      }
    ],
    learningSource: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    },
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

learningContentSchema.index({ sourceProvider: 1, sourceId: 1 }, { unique: true });
learningContentSchema.index({ language: 1, contentType: 1, createdAt: -1 });
learningContentSchema.index({ transcriptStatus: 1, transcriptAvailable: 1 });
learningContentSchema.index({ topicTags: 1 });
learningContentSchema.index({ registerTags: 1 });
learningContentSchema.index({ skillTags: 1 });

module.exports = mongoose.model('LearningContent', learningContentSchema);
