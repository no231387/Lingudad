const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    itemType: {
      type: String,
      enum: ['flashcard', 'vocab', 'content'],
      required: [true, 'Item type is required']
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Item id is required']
    },
    correctCount: {
      type: Number,
      min: 0,
      default: 0
    },
    incorrectCount: {
      type: Number,
      min: 0,
      default: 0
    },
    lastReviewed: {
      type: Date,
      default: null
    },
    strengthScore: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

userProgressSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
