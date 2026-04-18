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
    sourceType: {
      type: String,
      enum: ['video', 'uploaded_media', 'external_link'],
      default: 'video'
    },
    visibility: {
      type: String,
      enum: ['community', 'private', 'global'],
      default: 'community'
    },
    discoverySource: {
      type: String,
      enum: ['manual', 'upload', 'community_seed', 'future_search'],
      default: 'manual'
    },
    recommendationEligible: {
      type: Boolean,
      default: false
    },
    isSystemContent: {
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
    curationStatus: {
      type: String,
      default: '',
      trim: true
    },
    trustLevel: {
      type: String,
      default: '',
      trim: true
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
    sourceUrl: {
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
    durationSeconds: {
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
      enum: ['none', 'pending', 'ready', 'manual_ready', 'linked'],
      default: 'none'
    },
    transcriptSource: {
      type: String,
      enum: ['none', 'manual', 'youtube_caption', 'uploaded_file', 'trusted_link', 'future_pipeline'],
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
    workspaceType: {
      type: String,
      enum: ['base', 'study_copy'],
      default: 'base'
    },
    workspaceSourceContentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningContent',
      default: null
    },
    workspaceSourceVisibility: {
      type: String,
      enum: ['', 'community', 'private', 'global'],
      default: ''
    },
    workspaceSourceOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    provenance: {
      ingestionMethod: {
        type: String,
        default: 'manual',
        trim: true
      },
      sourceCapturedAt: {
        type: Date,
        default: Date.now
      },
      sourceSnapshotTitle: {
        type: String,
        default: '',
        trim: true
      },
      sourceSnapshotUrl: {
        type: String,
        default: '',
        trim: true
      },
      notes: {
        type: String,
        default: '',
        trim: true
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
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

learningContentSchema.index(
  { visibility: 1, sourceProvider: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { visibility: { $in: ['community', 'global'] } }
  }
);
learningContentSchema.index(
  { createdBy: 1, sourceProvider: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { visibility: 'private' }
  }
);
learningContentSchema.index({ language: 1, contentType: 1, createdAt: -1 });
learningContentSchema.index({ language: 1, sourceType: 1, createdAt: -1 });
learningContentSchema.index({ visibility: 1, recommendationEligible: 1, language: 1, createdAt: -1 });
learningContentSchema.index({ isSystemContent: 1, isCurated: 1, seedSource: 1, createdAt: -1 });
learningContentSchema.index({ transcriptStatus: 1, transcriptAvailable: 1 });
learningContentSchema.index({ createdBy: 1, workspaceSourceContentId: 1 });
learningContentSchema.index({ topicTags: 1 });
learningContentSchema.index({ registerTags: 1 });
learningContentSchema.index({ skillTags: 1 });
learningContentSchema.index(
  { title: 'text', description: 'text', sourceId: 'text', sourceUrl: 'text' },
  { language_override: '_textLanguageOverride' }
);

module.exports = mongoose.model('LearningContent', learningContentSchema);
