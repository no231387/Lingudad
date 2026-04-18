const mongoose = require('mongoose');

const progressTargetSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      default: '',
      trim: true
    },
    itemType: {
      type: String,
      default: '',
      trim: true
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  { _id: false }
);

const quizResultSchema = new mongoose.Schema(
  {
    quizItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizItem',
      required: [true, 'Quiz item is required']
    },
    quizType: {
      type: String,
      required: [true, 'Quiz type is required'],
      trim: true
    },
    generatedFromModel: {
      type: String,
      default: '',
      trim: true
    },
    generatedFromId: {
      type: String,
      default: '',
      trim: true
    },
    sourceProvider: {
      type: String,
      default: '',
      trim: true
    },
    sourceType: {
      type: String,
      default: '',
      trim: true
    },
    sourceId: {
      type: String,
      default: '',
      trim: true
    },
    submittedAnswer: {
      type: String,
      default: '',
      trim: true
    },
    normalizedAnswer: {
      type: String,
      default: '',
      trim: true
    },
    acceptedAnswers: {
      type: [String],
      default: []
    },
    canonicalAnswer: {
      type: String,
      default: '',
      trim: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    skipped: {
      type: Boolean,
      default: false
    },
    responseMs: {
      type: Number,
      min: 0,
      default: 0
    },
    ratingApplied: {
      type: String,
      enum: ['', 'again', 'good', 'skip'],
      default: ''
    },
    progressRecorded: {
      type: Boolean,
      default: false
    },
    progressTarget: {
      type: progressTargetSchema,
      default: () => ({})
    },
    answeredAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const quizSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required']
    },
    quizItems: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'QuizItem'
        }
      ],
      default: []
    },
    sessionSource: {
      type: String,
      default: 'quiz_item',
      trim: true
    },
    sourceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    itemCount: {
      type: Number,
      min: 0,
      default: 0
    },
    answeredCount: {
      type: Number,
      min: 0,
      default: 0
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
    skippedCount: {
      type: Number,
      min: 0,
      default: 0
    },
    results: {
      type: [quizResultSchema],
      default: []
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

quizSessionSchema.index({ owner: 1, createdAt: -1 });
quizSessionSchema.index({ owner: 1, completedAt: -1 });

module.exports = mongoose.model('QuizSession', quizSessionSchema);
