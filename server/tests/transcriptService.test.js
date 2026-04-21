const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables } = require('../services/transcriptService');

test('plain transcript text stays ingestible without invented timing', () => {
  const segments = __testables.parseTranscriptText('\u3053\u3093\u306b\u3061\u306f\u3002\n\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059\u3002');

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u3053\u3093\u306b\u3061\u306f\u3002'
    },
    {
      segmentOrder: 1,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059\u3002'
    }
  ]);
});

test('japanese paragraph transcript text splits into multiple untimed sentence segments', () => {
  const segments = __testables.parseTranscriptText(
    '\u3053\u3093\u306b\u3061\u306f\u3002\u306f\u3058\u3081\u307e\u3057\u3066\u3002\u4eca\u65e5\u306f\u3044\u3044\u5929\u6c17\u3067\u3059\u306d\u3002\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002'
  );

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u3053\u3093\u306b\u3061\u306f\u3002'
    },
    {
      segmentOrder: 1,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u306f\u3058\u3081\u307e\u3057\u3066\u3002'
    },
    {
      segmentOrder: 2,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u4eca\u65e5\u306f\u3044\u3044\u5929\u6c17\u3067\u3059\u306d\u3002'
    },
    {
      segmentOrder: 3,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002'
    }
  ]);
});

test('timed transcript text still keeps parsed timing', () => {
  const segments = __testables.buildSegmentInputs({
    transcriptText: '0:00 | hello\n0:05-0:09 | there'
  });

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: 0,
      endTimeSeconds: 0,
      rawText: 'hello'
    },
    {
      segmentOrder: 1,
      startTimeSeconds: 5,
      endTimeSeconds: 9,
      rawText: 'there'
    }
  ]);
});

test('empty segments array falls back to transcriptText instead of discarding it', () => {
  const segments = __testables.buildSegmentInputs({
    segments: [],
    transcriptText: '\u3053\u3093\u306b\u3061\u306f\u3002\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002'
  });

  assert.deepEqual(segments, [
    {
      segmentOrder: 0,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u3053\u3093\u306b\u3061\u306f\u3002'
    },
    {
      segmentOrder: 1,
      startTimeSeconds: null,
      endTimeSeconds: null,
      rawText: '\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002'
    }
  ]);
});

test('transcript input debug shows parsed plain-text segment state', () => {
  const debug = __testables.buildTranscriptInputDebug({
    segments: [],
    transcriptText: '\u3053\u3093\u306b\u3061\u306f\u3002\u306f\u3058\u3081\u307e\u3057\u3066\u3002'
  });

  assert.equal(debug.rawInputLength > 0, true);
  assert.equal(debug.parsedSegmentCount, 2);
  assert.equal(debug.parsedSegmentPreview[0].startTimeSeconds, null);
  assert.equal(debug.parsedSegmentPreview[0].rawTextPreview, '\u3053\u3093\u306b\u3061\u306f\u3002');
});
