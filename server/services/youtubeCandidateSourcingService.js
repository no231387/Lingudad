const LearningContent = require('../models/LearningContent');
const { CONTENT_DISCOVERY_SOURCES, CONTENT_VISIBILITY } = require('./contentService');
const { SOURCE_PROVIDERS } = require('./sourceCatalogService');

const MAX_SOURCE_LIMIT = 12;
const DEFAULT_LIMIT = 6;
const SEARCH_RESULTS_PER_QUERY = 5;
const YOUTUBE_SOURCE_STAGE = 'youtube_search';
const YOUTUBE_CANDIDATE_SEED_SOURCE = 'youtube_candidate_source_v1';
const LANGUAGE_QUERY_TOKENS = Object.freeze({
  Japanese: ['Japanese', '日本語'],
  ja: ['Japanese', '日本語']
});
const LEVEL_QUERY_TOKENS = Object.freeze({
  beginner: ['beginner', 'for beginners', 'N5'],
  intermediate: ['intermediate', 'N4', 'N3'],
  advanced: ['advanced', 'N2', 'N1']
});
const GOAL_QUERY_TOKENS = Object.freeze({
  listening: ['listening practice', 'listening'],
  speaking: ['conversation', 'speaking'],
  reading: ['reading practice', 'reading'],
  vocabulary: ['vocabulary', 'words and phrases'],
  kanji: ['kanji']
});
const TOPIC_QUERY_TOKENS = Object.freeze({
  daily_conversation: ['daily conversation'],
  travel: ['travel phrases', 'travel'],
  food: ['food', 'restaurant'],
  workplace: ['workplace', 'business'],
  hobbies: ['hobbies', 'daily life'],
  listening_practice: ['listening practice'],
  shopping: ['shopping'],
  self_intro: ['self introduction'],
  greetings: ['greetings']
});
const REGISTER_QUERY_TOKENS = Object.freeze({
  casual: ['casual conversation'],
  polite: ['polite conversation', 'formal expressions'],
  mixed: ['conversation']
});
const LEVEL_DIFFICULTY_MAP = Object.freeze({
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeList = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((entry) => normalizeText(entry)).filter(Boolean))];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return ['true', '1', 'yes'].includes(normalizeLower(value));
};

const resolveLanguage = (value) => {
  const normalized = normalizeLower(value);

  if (!normalized) {
    return '';
  }

  if (normalized === 'ja' || normalized === 'japanese') {
    return 'Japanese';
  }

  return normalizeText(value);
};

const parseLimit = (value) => {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  return Number.isFinite(parsed) ? clamp(parsed, 1, MAX_SOURCE_LIMIT) : DEFAULT_LIMIT;
};

const getYoutubeApiKey = () => normalizeText(process.env.YOUTUBE_DATA_API_KEY);

const isYoutubeCandidateSourcingEnabled = () => normalizeBoolean(process.env.ENABLE_YOUTUBE_CANDIDATE_SOURCING);

const getAllowedUsernames = () =>
  normalizeList(String(process.env.YOUTUBE_CANDIDATE_SOURCING_ALLOWED_USERS || '').split(','));

const canUserSourceYoutubeCandidates = (user) => {
  if (!isYoutubeCandidateSourcingEnabled()) {
    return false;
  }

  const allowedUsers = getAllowedUsernames();

  if (allowedUsers.length === 0) {
    return true;
  }

  return allowedUsers.map((entry) => normalizeLower(entry)).includes(normalizeLower(user?.username));
};

const buildYouTubeUrls = (videoId) => ({
  sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
  embedUrl: `https://www.youtube.com/embed/${videoId}`,
  thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
});

const buildSourcingIntent = ({ user, input = {} }) => {
  const language = resolveLanguage(input.language || user?.language || 'Japanese');
  const level = normalizeLower(input.level || user?.level || '');
  const goals = normalizeList(input.goals || user?.goals).map((entry) => normalizeLower(entry));
  const preferredTopics = normalizeList(input.preferredTopics || user?.preferredTopics).map((entry) => normalizeLower(entry));
  const preferredRegister = normalizeList(input.preferredRegister || user?.preferredRegister).map((entry) => normalizeLower(entry));
  const studyQuery = normalizeText(input.studyQuery || input.query);

  return {
    language,
    level,
    goals,
    preferredTopics,
    preferredRegister,
    studyQuery
  };
};

const buildRuleBasedQueries = (intent) => {
  const languageTokens = LANGUAGE_QUERY_TOKENS[intent.language] || [intent.language || 'Japanese'];
  const levelTokens = LEVEL_QUERY_TOKENS[intent.level] || [];
  const goalTokens = intent.goals.flatMap((goal) => GOAL_QUERY_TOKENS[goal] || [goal]);
  const topicTokens = intent.preferredTopics.flatMap((topic) => TOPIC_QUERY_TOKENS[topic] || [topic.replaceAll('_', ' ')]);
  const registerTokens = intent.preferredRegister.flatMap((register) => REGISTER_QUERY_TOKENS[register] || [register]);
  const firstLanguage = languageTokens[0] || 'Japanese';
  const firstLevel = levelTokens[0] || 'conversation';
  const firstGoal = goalTokens[0] || 'listening practice';
  const firstTopic = topicTokens[0] || 'daily life';
  const firstRegister = registerTokens[0] || 'conversation';
  const queryPool = [];

  if (intent.studyQuery) {
    queryPool.push(`${intent.studyQuery} ${firstLanguage}`.trim());
  }

  queryPool.push(`${firstLevel} ${firstLanguage} ${firstGoal}`.trim());
  queryPool.push(`${firstLanguage} ${firstTopic} ${firstGoal}`.trim());
  queryPool.push(`${firstLanguage} ${firstRegister} ${firstTopic}`.trim());
  queryPool.push(`${firstLanguage} ${firstGoal} video`.trim());

  return [...new Set(queryPool.map((entry) => entry.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 5);
};

const buildYoutubeSearchUrl = ({ query, maxResults, language }) => {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q: query,
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    key: getYoutubeApiKey()
  });

  if (language === 'Japanese') {
    params.set('relevanceLanguage', 'ja');
  }

  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
};

const inferTagsFromText = ({ title, description, intent }) => {
  const haystack = `${normalizeLower(title)} ${normalizeLower(description)}`;
  const topicTags = new Set(intent.preferredTopics);
  const registerTags = new Set(intent.preferredRegister);
  const skillTags = new Set(intent.goals);

  Object.entries(TOPIC_QUERY_TOKENS).forEach(([key, tokens]) => {
    if (tokens.some((token) => haystack.includes(normalizeLower(token)))) {
      topicTags.add(key);
    }
  });

  Object.entries(REGISTER_QUERY_TOKENS).forEach(([key, tokens]) => {
    if (tokens.some((token) => haystack.includes(normalizeLower(token)))) {
      registerTags.add(key);
    }
  });

  Object.entries(GOAL_QUERY_TOKENS).forEach(([key, tokens]) => {
    if (tokens.some((token) => haystack.includes(normalizeLower(token)))) {
      skillTags.add(key);
    }
  });

  if (haystack.includes('podcast') || haystack.includes('listening')) {
    skillTags.add('listening');
  }

  if (haystack.includes('conversation')) {
    skillTags.add('speaking');
  }

  return {
    topicTags: [...topicTags].slice(0, 6),
    registerTags: [...registerTags].slice(0, 4),
    skillTags: [...skillTags].slice(0, 6)
  };
};

const normalizeYoutubeCandidate = ({ item, sourcingQuery, intent }) => {
  const videoId = normalizeText(item?.id?.videoId);

  if (!videoId) {
    return null;
  }

  const snippet = item?.snippet || {};
  const title = normalizeText(snippet.title);
  const description = normalizeText(snippet.description);
  const thumbnail =
    normalizeText(snippet?.thumbnails?.high?.url) ||
    normalizeText(snippet?.thumbnails?.medium?.url) ||
    normalizeText(snippet?.thumbnails?.default?.url) ||
    buildYouTubeUrls(videoId).thumbnail;
  const inferredTags = inferTagsFromText({ title, description, intent });

  return {
    title,
    description,
    thumbnail,
    thumbnailUrl: thumbnail,
    sourceId: videoId,
    externalId: videoId,
    sourceUrl: buildYouTubeUrls(videoId).sourceUrl,
    url: buildYouTubeUrls(videoId).sourceUrl,
    embedUrl: buildYouTubeUrls(videoId).embedUrl,
    channelTitle: normalizeText(snippet.channelTitle),
    channelId: normalizeText(snippet.channelId),
    publishedAt: snippet.publishedAt || null,
    sourceProvider: SOURCE_PROVIDERS.YOUTUBE,
    contentType: 'youtube',
    sourceType: 'video',
    language: intent.language,
    sourcingQuery,
    ...inferredTags
  };
};

const countTokenMatches = (haystack, tokens = []) => {
  const normalizedHaystack = normalizeLower(haystack);
  return tokens.filter((token) => normalizedHaystack.includes(normalizeLower(token))).length;
};

const scoreYoutubeCandidate = ({ candidate, intent }) => {
  const titleAndDescription = `${candidate.title} ${candidate.description}`;
  let score = 0;
  const reasons = [];

  if (intent.studyQuery) {
    const studyQueryMatches = countTokenMatches(titleAndDescription, intent.studyQuery.split(/\s+/));
    if (studyQueryMatches > 0) {
      score += Math.min(12, studyQueryMatches * 3);
      reasons.push('explicit_query_match');
    }
  }

  const levelTokens = LEVEL_QUERY_TOKENS[intent.level] || [];
  if (countTokenMatches(titleAndDescription, levelTokens) > 0) {
    score += 8;
    reasons.push(`${intent.level || 'level'}_match`);
  }

  intent.goals.forEach((goal) => {
    if (countTokenMatches(titleAndDescription, GOAL_QUERY_TOKENS[goal] || [goal]) > 0) {
      score += 5;
      reasons.push(`${goal}_goal`);
    }
  });

  intent.preferredTopics.forEach((topic) => {
    if (countTokenMatches(titleAndDescription, TOPIC_QUERY_TOKENS[topic] || [topic.replaceAll('_', ' ')]) > 0) {
      score += 4;
      reasons.push('topic_match');
    }
  });

  intent.preferredRegister.forEach((register) => {
    if (countTokenMatches(titleAndDescription, REGISTER_QUERY_TOKENS[register] || [register]) > 0) {
      score += 3;
      reasons.push('register_match');
    }
  });

  if (countTokenMatches(titleAndDescription, ['japanese', '日本語']) > 0) {
    score += 4;
    reasons.push('language_match');
  }

  if (countTokenMatches(titleAndDescription, ['listening', 'conversation', 'practice', 'lesson']) > 0) {
    score += 2;
  }

  return {
    relevanceScore: score,
    sourcingReasons: [...new Set(reasons)].slice(0, 5)
  };
};

const fetchYoutubeSearchResults = async ({ queries, intent, fetchFn }) => {
  if (!getYoutubeApiKey()) {
    throw new Error('Missing YOUTUBE_DATA_API_KEY.');
  }

  const results = [];

  for (const query of queries) {
    const response = await fetchFn(buildYoutubeSearchUrl({ query, maxResults: SEARCH_RESULTS_PER_QUERY, language: intent.language }));

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`YouTube search failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const item of items) {
      results.push({ item, query });
    }
  }

  return results;
};

const rankYoutubeCandidates = ({ rawResults, intent }) => {
  const deduped = new Map();

  for (const { item, query } of rawResults) {
    const candidate = normalizeYoutubeCandidate({ item, sourcingQuery: query, intent });
    if (!candidate) {
      continue;
    }

    const scoring = scoreYoutubeCandidate({ candidate, intent });
    const current = deduped.get(candidate.sourceId);
    const rankedCandidate = {
      ...candidate,
      relevanceScore: scoring.relevanceScore,
      sourcingReasons: scoring.sourcingReasons,
      aiAssisted: false,
      sourcingStrategy: 'rules'
    };

    if (!current || rankedCandidate.relevanceScore > current.relevanceScore) {
      deduped.set(candidate.sourceId, rankedCandidate);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore;
    }

    if (normalizeText(right.publishedAt) !== normalizeText(left.publishedAt)) {
      return normalizeText(right.publishedAt).localeCompare(normalizeText(left.publishedAt));
    }

    if (normalizeLower(left.title) !== normalizeLower(right.title)) {
      return normalizeLower(left.title).localeCompare(normalizeLower(right.title));
    }

    return normalizeText(left.sourceId).localeCompare(normalizeText(right.sourceId));
  });
};

const buildPersistableLearningContentPayload = ({ candidate, intent, fetchedAt }) => ({
  title: candidate.title,
  description: candidate.description,
  language: intent.language,
  contentType: 'youtube',
  sourceType: 'video',
  visibility: CONTENT_VISIBILITY.GLOBAL,
  discoverySource: CONTENT_DISCOVERY_SOURCES.FUTURE_SEARCH,
  recommendationEligible: false,
  isSystemContent: false,
  isCurated: false,
  seedSource: YOUTUBE_CANDIDATE_SEED_SOURCE,
  curationStatus: 'candidate_sourced_pending_review',
  trustLevel: 'content_source',
  sourceProvider: SOURCE_PROVIDERS.YOUTUBE,
  sourceId: candidate.sourceId,
  externalId: candidate.externalId,
  url: candidate.sourceUrl,
  sourceUrl: candidate.sourceUrl,
  embedUrl: candidate.embedUrl,
  thumbnail: candidate.thumbnail,
  thumbnailUrl: candidate.thumbnail,
  duration: null,
  durationSeconds: null,
  topicTags: candidate.topicTags,
  registerTags: candidate.registerTags,
  skillTags: candidate.skillTags,
  difficulty: LEVEL_DIFFICULTY_MAP[intent.level] || '',
  transcriptStatus: 'none',
  transcriptSource: 'none',
  transcriptAvailable: false,
  transcript: '',
  linkedVocabularyIds: [],
  linkedSentenceIds: [],
  learningSource: true,
  metadata: {
    sourcing: {
      sourceStage: YOUTUBE_SOURCE_STAGE,
      sourceQuery: candidate.sourcingQuery,
      sourcingReasons: candidate.sourcingReasons,
      relevanceScore: candidate.relevanceScore,
      aiAssisted: false,
      sourcingStrategy: 'rules',
      sourcedAt: fetchedAt,
      fetchedAt,
      channelTitle: candidate.channelTitle,
      channelId: candidate.channelId,
      publishedAt: candidate.publishedAt,
      explicitStudyQuery: intent.studyQuery || '',
      intent: {
        language: intent.language,
        level: intent.level,
        goals: intent.goals,
        preferredTopics: intent.preferredTopics,
        preferredRegister: intent.preferredRegister
      }
    }
  },
  provenance: {
    ingestionMethod: YOUTUBE_SOURCE_STAGE,
    sourceCapturedAt: new Date(fetchedAt),
    sourceSnapshotTitle: candidate.title,
    sourceSnapshotUrl: candidate.sourceUrl,
    notes: 'YouTube candidate sourced for later transcript and validation review. This is not trusted language truth by default.'
  },
  createdBy: null,
  savedBy: []
});

const persistYoutubeCandidates = async ({ candidates, intent, LearningContentModel, fetchedAt }) => {
  const persistedItems = [];
  let createdCount = 0;
  let reusedCount = 0;

  for (const candidate of candidates) {
    const filter = {
      visibility: { $in: [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL] },
      sourceProvider: SOURCE_PROVIDERS.YOUTUBE,
      $or: [{ sourceId: candidate.sourceId }, { externalId: candidate.externalId }]
    };
    const existing = await LearningContentModel.findOne(filter);

    if (existing) {
      reusedCount += 1;
      persistedItems.push({
        ...candidate,
        persisted: true,
        created: false,
        persistenceStatus: 'reused',
        contentId: String(existing._id)
      });
      continue;
    }

    const item = await LearningContentModel.create(buildPersistableLearningContentPayload({ candidate, intent, fetchedAt }));
    createdCount += 1;
    persistedItems.push({
      ...candidate,
      persisted: true,
      created: true,
      persistenceStatus: 'created',
      contentId: String(item._id)
    });
  }

  return {
    items: persistedItems,
    createdCount,
    reusedCount
  };
};

const createYoutubeCandidateSourcingService = ({
  fetchFn = global.fetch,
  LearningContentModel = LearningContent,
  now = () => new Date().toISOString()
} = {}) => {
  const sourceYoutubeCandidates = async ({ user, input = {} }) => {
    if (typeof fetchFn !== 'function') {
      throw new Error('Fetch is not available for YouTube sourcing.');
    }

    const limit = parseLimit(input.limit);
    const persist = normalizeBoolean(input.persist);
    const intent = buildSourcingIntent({ user, input });
    const queries = buildRuleBasedQueries(intent);
    const fetchedAt = now();
    const rawResults = await fetchYoutubeSearchResults({
      queries,
      intent,
      fetchFn
    });
    const rankedCandidates = rankYoutubeCandidates({
      rawResults,
      intent
    }).slice(0, limit);

    if (!persist) {
      return {
        items: rankedCandidates.map((candidate) => ({
          ...candidate,
          persisted: false
        })),
        meta: {
          sourceStage: YOUTUBE_SOURCE_STAGE,
          sourcingStrategy: 'rules',
          aiAssisted: false,
          queries,
          fetchedAt,
          rawCandidateCount: rawResults.length,
          returnedCount: rankedCandidates.length,
          persisted: false
        }
      };
    }

    const persisted = await persistYoutubeCandidates({
      candidates: rankedCandidates,
      intent,
      LearningContentModel,
      fetchedAt
    });

    return {
      items: persisted.items,
      meta: {
        sourceStage: YOUTUBE_SOURCE_STAGE,
        sourcingStrategy: 'rules',
        aiAssisted: false,
        queries,
        fetchedAt,
        rawCandidateCount: rawResults.length,
        returnedCount: persisted.items.length,
        persisted: true,
        createdCount: persisted.createdCount,
        reusedCount: persisted.reusedCount
      }
    };
  };

  return {
    sourceYoutubeCandidates
  };
};

const defaultService = createYoutubeCandidateSourcingService();

module.exports = {
  YOUTUBE_CANDIDATE_SEED_SOURCE,
  canUserSourceYoutubeCandidates,
  createYoutubeCandidateSourcingService,
  getYoutubeApiKey,
  isYoutubeCandidateSourcingEnabled,
  sourceYoutubeCandidates: defaultService.sourceYoutubeCandidates,
  __testables: {
    buildPersistableLearningContentPayload,
    buildRuleBasedQueries,
    buildSourcingIntent,
    canUserSourceYoutubeCandidates,
    inferTagsFromText,
    normalizeYoutubeCandidate,
    rankYoutubeCandidates,
    scoreYoutubeCandidate
  }
};
