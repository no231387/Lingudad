const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Deck name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    language: {
      type: String,
      default: '',
      trim: true
    },
    isOfficial: {
      type: Boolean,
      default: false
    },
    level: {
      type: String,
      enum: ['', 'beginner', 'intermediate', 'advanced'],
      default: ''
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required']
    }
  },
  {
    timestamps: true
  }
);

deckSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Deck', deckSchema);
