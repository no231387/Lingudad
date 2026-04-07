const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema(
  {
    wordOrPhrase: {
      type: String,
      required: [true, 'Word or phrase is required'],
      trim: true
    },
    translation: {
      type: String,
      required: [true, 'Translation is required'],
      trim: true
    },
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
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
      }
    ],
    exampleSentence: {
      type: String,
      default: '',
      trim: true
    },
    proficiency: {
      type: Number,
      min: 1,
      max: 5,
      default: 1
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0
    },
    dateCreated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Flashcard', flashcardSchema);
