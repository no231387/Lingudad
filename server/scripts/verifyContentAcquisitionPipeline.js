require('dotenv').config();
const mongoose = require('mongoose');
const LearningContent = require('../models/LearningContent');

const API_BASE_URL = (process.env.LINGUA_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN = String(process.env.LINGUA_E2E_TOKEN || process.env.TOKEN || '').trim();
const STUDY_QUERY = process.env.LINGUA_STUDY_QUERY || 'beginner Japanese greetings';
const LANGUAGE = process.env.LINGUA_LANGUAGE || 'Japanese';
const LEVEL = process.env.LINGUA_LEVEL || 'beginner';
const TOPICS = String(process.env.LINGUA_TOPICS || 'greetings')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const REGISTERS = String(process.env.LINGUA_REGISTERS || 'casual')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const LIMIT = Number.parseInt(process.env.LINGUA_LIMIT || '3', 10);
const TRANSCRIPT_TEXT =
  process.env.LINGUA_PROMOTION_TRANSCRIPT ||
  '\u3053\u3093\u306b\u3061\u306f\u3002\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059\u3002\u3053\u3093\u3070\u3093\u306f\u3002\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002\u3059\u307f\u307e\u305b\u3093\u3002\u306f\u3058\u3081\u307e\u3057\u3066\u3002\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3057\u307e\u3059\u3002\u304a\u5143\u6c17\u3067\u3059\u304b\u3002';

const normalizeText = (value) => String(value || '').trim();
const toCount = (value) => Number(value || 0);
const divider = () => console.log('-------------------------------------');

const fail = (stage, message) => {
  console.error(`FAIL [${stage}] ${message}`);
  process.exitCode = 1;
};

const authHeaders = () => {
  if (!TOKEN) {
    throw new Error('Missing LINGUA_E2E_TOKEN (or TOKEN) environment variable.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`
  };
};

const requestJson = async ({ method, path, body }) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}${payload?.message ? `: ${payload.message}` : ''}`);
  }

  return payload;
};

const logCandidateRows = (candidates = []) => {
  candidates.forEach((candidate, index) => {
    console.log(
      `${index + 1}. ${candidate.title || 'Untitled'} | contentId=${candidate.contentId || '-'} | status=${candidate.promotionStatus || '-'} | eligible=${candidate.recommendationEligible ? 'yes' : 'no'}`
    );
  });
};

const logTranscriptDebug = () => {
  console.log(`manual transcript env present: ${process.env.LINGUA_PROMOTION_TRANSCRIPT ? 'yes' : 'no'}`);
  console.log(`manual transcript length: ${normalizeText(TRANSCRIPT_TEXT).length}`);
  console.log('manual fallback request keys: transcriptText');
};

const main = async () => {
  let promotedContentId = '';
  let mongoConnected = false;

  try {
    divider();
    console.log('STEP 1 - Source candidates');
    const sourcingBody = {
      studyQuery: STUDY_QUERY,
      language: LANGUAGE,
      level: LEVEL,
      preferredTopics: TOPICS,
      preferredRegister: REGISTERS,
      limit: Number.isFinite(LIMIT) ? LIMIT : 3
    };
    const sourcingResult = await requestJson({
      method: 'POST',
      path: '/content/source-and-promote/youtube',
      body: sourcingBody
    });

    console.log(`sourcedCount: ${toCount(sourcingResult.sourcedCount)}`);
    console.log(`persistedCount: ${toCount(sourcingResult.persistedCount)}`);
    console.log(`promotedCount: ${toCount(sourcingResult.promotedCount)}`);
    logCandidateRows(sourcingResult.candidates || []);

    const readyCandidate = (sourcingResult.candidates || []).find(
      (candidate) => candidate.recommendationEligible === true || normalizeText(candidate.promotionStatus) === 'ready_to_practice'
    );
    const fallbackCandidate = (sourcingResult.candidates || []).find((candidate) => normalizeText(candidate.contentId));

    if (!fallbackCandidate) {
      fail('sourcing', 'No persisted or reused content item was returned from source-and-promote.');
      return;
    }

    promotedContentId = normalizeText(readyCandidate?.contentId || fallbackCandidate.contentId);

    if (!readyCandidate) {
      divider();
      console.log('STEP 2 - Manual promotion fallback');
      console.log(`No item reached ready_to_practice during sourcing. Retrying promotion for contentId=${promotedContentId}`);
      logTranscriptDebug();

      const promotionResult = await requestJson({
        method: 'POST',
        path: `/content/${promotedContentId}/promote-sourced-candidate`,
        body: {
          transcriptText: normalizeText(TRANSCRIPT_TEXT)
        }
      });

      console.log(`promotionStatus: ${normalizeText(promotionResult.readinessOutcome || promotionResult.content?.curationStatus) || '-'}`);
      console.log(`recommendationEligible: ${promotionResult.recommendationEligible === true ? 'true' : 'false'}`);
      console.log(`linkedVocabularyCount: ${toCount(promotionResult.transcriptSummary?.linkedVocabularyCount)}`);
      console.log(`linkedSentenceCount: ${toCount(promotionResult.transcriptSummary?.linkedSentenceCount)}`);
      if (promotionResult.transcriptInputDebug) {
        console.log(`transcript raw input length: ${toCount(promotionResult.transcriptInputDebug.rawInputLength)}`);
        console.log(`transcript normalized input length: ${toCount(promotionResult.transcriptInputDebug.normalizedInputLength)}`);
        console.log(
          `transcript parsed segment count: ${toCount(
            promotionResult.transcriptInputDebug.acceptedSegmentCount || promotionResult.transcriptInputDebug.parsedSegmentCount
          )}`
        );
        const preview = Array.isArray(promotionResult.transcriptInputDebug.parsedSegmentPreview)
          ? promotionResult.transcriptInputDebug.parsedSegmentPreview
          : [];
        preview.slice(0, 2).forEach((segment, index) => {
          console.log(
            `parsed segment ${index + 1}: start=${segment.startTimeSeconds ?? 'null'} end=${segment.endTimeSeconds ?? 'null'} text="${segment.rawTextPreview || ''}"`
          );
        });
        if (promotionResult.transcriptInputDebug.rejectionRule) {
          console.log(`transcript rejection rule: ${promotionResult.transcriptInputDebug.rejectionRule}`);
        }
      }
      if (promotionResult.failureReason || promotionResult.error) {
        console.log(`failureReason: ${normalizeText(promotionResult.failureReason || promotionResult.error)}`);
      }

      if (promotionResult.recommendationEligible !== true) {
        fail(
          'promotion',
          `Promotion did not reach recommendationEligible=true. Final status: ${normalizeText(
            promotionResult.readinessOutcome || promotionResult.content?.curationStatus || promotionResult.failureReason || promotionResult.error
          )}`
        );
        return;
      }
    } else {
      divider();
      console.log('STEP 2 - Manual promotion fallback');
      console.log(`Skipped. contentId=${promotedContentId} already reached ready_to_practice during sourcing.`);
    }

    divider();
    console.log('STEP 3 - Verify DB state');
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
    mongoConnected = true;
    const contentDoc = await LearningContent.findById(promotedContentId).lean();

    if (!contentDoc) {
      fail('db', `No LearningContent document found for contentId=${promotedContentId}.`);
      return;
    }

    console.log(`recommendationEligible: ${contentDoc.recommendationEligible === true ? 'true' : 'false'}`);
    console.log(`curationStatus: ${normalizeText(contentDoc.curationStatus) || '-'}`);

    if (contentDoc.recommendationEligible !== true || normalizeText(contentDoc.curationStatus) !== 'ready_to_practice') {
      fail(
        'db',
        `Expected recommendationEligible=true and curationStatus=ready_to_practice, received recommendationEligible=${contentDoc.recommendationEligible} curationStatus=${contentDoc.curationStatus}`
      );
      return;
    }

    divider();
    console.log('STEP 4 - Verify recommendation endpoint');
    const recommendationResult = await requestJson({
      method: 'GET',
      path: '/content/recommended?debug=true'
    });
    const recommendationItems = Array.isArray(recommendationResult.items) ? recommendationResult.items : [];
    const recommendationMeta = recommendationResult.meta || {};
    const recommendationDebug = recommendationMeta.debug || {};

    console.log(`items.length: ${recommendationItems.length}`);
    console.log(`meta.totalCandidatesConsidered: ${toCount(recommendationMeta.totalCandidatesConsidered)}`);
    console.log(`meta.isColdStart: ${recommendationMeta.isColdStart === true ? 'true' : 'false'}`);
    if (Object.keys(recommendationDebug).length > 0) {
      console.log(`meta.debug.emptyReason: ${normalizeText(recommendationDebug.emptyReason) || '-'}`);
    }

    const recommendedMatch = recommendationItems.find((item) => normalizeText(item._id) === promotedContentId);
    if (!recommendationItems.length) {
      fail('recommendation filtering', 'GET /api/content/recommended returned no items.');
      return;
    }

    if (!recommendedMatch) {
      fail('recommendation filtering', `Promoted contentId=${promotedContentId} was not returned by GET /api/content/recommended.`);
      return;
    }

    divider();
    console.log('STEP 5 - Verify dashboard integration');
    const dashboardResult = await requestJson({
      method: 'GET',
      path: '/dashboard/overview'
    });
    const dashboardRecommended = Array.isArray(dashboardResult.recommendedContent) ? dashboardResult.recommendedContent : [];
    console.log(`recommendedContent.length: ${dashboardRecommended.length}`);

    const dashboardMatch = dashboardRecommended.find((item) => normalizeText(item._id) === promotedContentId);
    if (!dashboardRecommended.length) {
      fail('dashboard', 'Dashboard recommendedContent was empty.');
      return;
    }

    if (!dashboardMatch) {
      fail('dashboard', `Dashboard recommendedContent did not include promoted contentId=${promotedContentId}.`);
      return;
    }

    divider();
    console.log('STEP 6 - Final result');
    console.log(`SUCCESS contentId=${promotedContentId} passed sourcing, promotion, recommendation, and dashboard checks.`);
  } catch (error) {
    const message = normalizeText(error.message || error);
    if (message.includes('/content/source-and-promote/youtube')) {
      fail('sourcing', message);
    } else if (message.includes('/promote-sourced-candidate')) {
      fail('promotion', message);
    } else if (message.includes('/content/recommended')) {
      fail('recommendation filtering', message);
    } else if (message.includes('/dashboard/overview')) {
      fail('dashboard', message);
    } else {
      fail('transcript', message);
    }
  } finally {
    if (mongoConnected) {
      await mongoose.disconnect();
    }
  }
};

main();
