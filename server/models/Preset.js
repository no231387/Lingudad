const mongoose = require('mongoose');

const tagField = {
  type: String,
  trim: true
};

const presetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Preset name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Preset slug is required'],
      trim: true,
      lowercase: true
    },
    code: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    language: {
      type: String,
      required: [true, 'Preset language is required'],
      trim: true
    },
    registerTags: {
      type: [tagField],
      default: []
    },
    skillTags: {
      type: [tagField],
      default: []
    },
    targetDifficulty: {
      type: [tagField],
      default: []
    },
    levelBand: {
      type: String,
      default: '',
      trim: true
    },
    conversationGoal: {
      type: String,
      default: '',
      trim: true
    },
    focusLabel: {
      type: String,
      default: '',
      trim: true
    },
    visibility: {
      type: String,
      enum: ['private', 'global'],
      default: 'private'
    },
    recommendationEligible: {
      type: Boolean,
      default: true
    },
    isSystemPreset: {
      type: Boolean,
      default: false
    },
    isCurated: {
      type: Boolean,
      default: false
    },
    seedSource: {
      type: String,
      default: '',
      trim: true
    },
    sortOrder: {
      type: Number,
      default: 100,
      min: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

presetSchema.index(
  { visibility: 1, language: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { visibility: 'global' }
  }
);
presetSchema.index(
  { createdBy: 1, language: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { visibility: 'private' }
  }
);
presetSchema.index({ visibility: 1, recommendationEligible: 1, language: 1, sortOrder: 1 });
presetSchema.index({ isSystemPreset: 1, isCurated: 1, seedSource: 1, sortOrder: 1 });
presetSchema.index({ registerTags: 1 });
presetSchema.index({ skillTags: 1 });
presetSchema.index({ targetDifficulty: 1 });

module.exports = mongoose.model('Preset', presetSchema);
