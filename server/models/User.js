const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    language: {
      type: String,
      default: '',
      trim: true
    },
    level: {
      type: String,
      enum: ['', 'beginner', 'intermediate', 'advanced'],
      default: ''
    },
    goals: [
      {
        type: String,
        enum: ['listening', 'reading', 'vocabulary', 'kanji', 'speaking']
      }
    ],
    preferredTopics: [
      {
        type: String,
        trim: true
      }
    ],
    preferredRegister: [
      {
        type: String,
        trim: true
      }
    ],
    dailyGoal: {
      type: Number,
      min: 0,
      default: null
    },
    onboardingCompleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
