const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['vocabulary_term', 'sentence_snippet'],
      required: true
    },
    rawText: {
      type: String,
      required: true,
      trim: true
    },
    normalizedText: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['raw_transcript', 'extracted_candidate', 'linked_to_trusted_record', 'validated', 'rejected'],
      default: 'extracted_candidate'
    },
    matchStrategy: {
      type: String,
      default: '',
      trim: true
    },
    linkedVocabularyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      default: null
    },
    linkedSentenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sentence',
      default: null
    }
  },
  { _id: false }
);

const transcriptSegmentSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningContent',
      required: [true, 'Content is required']
    },
    segmentOrder: {
      type: Number,
      min: 0,
      default: 0
    },
    startTimeSeconds: {
      type: Number,
      min: 0,
      required: [true, 'Start time is required']
    },
    endTimeSeconds: {
      type: Number,
      min: 0,
      required: [true, 'End time is required']
    },
    rawText: {
      type: String,
      required: [true, 'Raw text is required'],
      trim: true
    },
    normalizedText: {
      type: String,
      default: '',
      trim: true
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true
    },
    transcriptSource: {
      type: String,
      enum: ['manual', 'youtube_caption', 'uploaded_file', 'trusted_link', 'future_pipeline'],
      default: 'manual'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    validationStatus: {
      type: String,
      enum: ['raw_transcript', 'linked_to_trusted_record', 'validated', 'rejected'],
      default: 'raw_transcript'
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
    extractionCandidates: {
      type: [candidateSchema],
      default: []
    },
    provenance: {
      ingestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Ingested by is required']
      },
      ingestedAt: {
        type: Date,
        default: Date.now
      },
      sourceCapturedAt: {
        type: Date,
        default: Date.now
      },
      notes: {
        type: String,
        default: '',
        trim: true
      }
    }
  },
  {
    timestamps: true
  }
);

transcriptSegmentSchema.index({ contentId: 1, segmentOrder: 1 });
transcriptSegmentSchema.index({ contentId: 1, startTimeSeconds: 1, endTimeSeconds: 1 });
transcriptSegmentSchema.index({ contentId: 1, validationStatus: 1 });
transcriptSegmentSchema.index({ linkedVocabularyIds: 1 });
transcriptSegmentSchema.index({ linkedSentenceIds: 1 });

module.exports = mongoose.model('TranscriptSegment', transcriptSegmentSchema);
