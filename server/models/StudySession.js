const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required']
    },
    deck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      default: null
    },
    presetId: {
      type: String,
      default: '',
      trim: true
    },
    shapingStrategy: {
      type: String,
      default: '',
      trim: true
    },
    sessionSource: {
      type: String,
      enum: ['flashcard', 'content'],
      default: 'flashcard'
    },
    sourceContentId: {
      type: String,
      default: '',
      trim: true
    },
    sourceContentTitle: {
      type: String,
      default: '',
      trim: true
    },
    itemCount: {
      type: Number,
      min: 0,
      default: 0
    },
    flashcards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flashcard'
      }
    ],
    sessionItems: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    sourceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reviewedCount: {
      type: Number,
      min: 0,
      default: 0
    },
    againCount: {
      type: Number,
      min: 0,
      default: 0
    },
    goodCount: {
      type: Number,
      min: 0,
      default: 0
    },
    easyCount: {
      type: Number,
      min: 0,
      default: 0
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StudySession', studySessionSchema);
