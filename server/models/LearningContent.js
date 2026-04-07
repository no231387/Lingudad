const mongoose = require('mongoose');

const learningContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['video', 'sentence_set', 'article'],
      required: [true, 'Content type is required']
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    sourceProvider: {
      type: String,
      required: [true, 'Source provider is required'],
      trim: true
    },
    externalId: {
      type: String,
      required: [true, 'External id is required'],
      trim: true
    },
    transcript: {
      type: String,
      default: '',
      trim: true
    },
    difficulty: {
      type: String,
      default: '',
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true
    },
    url: {
      type: String,
      default: '',
      trim: true
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
    timestamps: true
  }
);

learningContentSchema.index({ sourceProvider: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model('LearningContent', learningContentSchema);
