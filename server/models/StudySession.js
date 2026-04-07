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
    flashcards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flashcard'
      }
    ],
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
