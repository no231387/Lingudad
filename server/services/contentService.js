const LearningContent = require('../models/LearningContent');
const { SOURCE_PROVIDERS } = require('./sourceCatalogService');
const { rankContentItems } = require('./learningEngineService');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);
const CONTENT_TYPES = Object.freeze({
  YOUTUBE: 'youtube',
  UPLOADED: 'uploaded',
  OTHER: 'other'
});
const CONTENT_VISIBILITY = Object.freeze({
  COMMUNITY: 'community',
  PRIVATE: 'private',
  GLOBAL: 'global'
});
const CONTENT_DISCOVERY_SOURCES = Object.freeze({
  MANUAL: 'manual',
  UPLOAD: 'upload',
  COMMUNITY_SEED: 'community_seed',
  FUTURE_SEARCH: 'future_search'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLanguage = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  return /^(ja|japanese)$/i.test(normalized) ? 'Japanese' : normalized;
};

const buildLanguageMatch = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  if (/^(ja|japanese)$/i.test(normalized)) {
    return { $in: ['Japanese', 'ja'] };
  }

  return normalizeLanguage(normalized);
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  return normalizeText(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return ['true', '1', 'yes'].includes(normalizeLower(value));
};

const normalizeContentSourceType = (contentType) => {
  if (contentType === CONTENT_TYPES.YOUTUBE) {
    return 'video';
  }

  if (contentType === CONTENT_TYPES.UPLOADED) {
    return 'uploaded_media';
  }

  return 'external_link';
};

const extractYouTubeVideoId = (value) => {
  const input = normalizeText(value);

  if (!input) {
    return '';
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();

    if (!YOUTUBE_HOSTS.has(hostname)) {
      return '';
    }

    if (hostname === 'youtu.be') {
      return url.pathname.replace('/', '').slice(0, 11);
    }

    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.replace('/embed/', '').slice(0, 11);
    }

    if (url.pathname.startsWith('/shorts/')) {
      return url.pathname.replace('/shorts/', '').slice(0, 11);
    }

    return normalizeText(url.searchParams.get('v')).slice(0, 11);
  } catch (error) {
    return '';
  }
};

const buildYouTubeUrls = (videoId) => ({
  url: `https://www.youtube.com/watch?v=${videoId}`,
  embedUrl: `https://www.youtube.com/embed/${videoId}`,
  thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
});

const inferContentType = (body = {}) => {
  const requested = normalizeLower(body.contentType);

  if ([CONTENT_TYPES.YOUTUBE, CONTENT_TYPES.UPLOADED, CONTENT_TYPES.OTHER].includes(requested)) {
    return requested;
  }

  if (extractYouTubeVideoId(body.sourceId || body.externalId || body.videoId || body.url)) {
    return CONTENT_TYPES.YOUTUBE;
  }

  return CONTENT_TYPES.OTHER;
};

const normalizeVisibility = ({ requestedVisibility, contentType }) => {
  if (contentType === CONTENT_TYPES.UPLOADED) {
    return CONTENT_VISIBILITY.PRIVATE;
  }

  return [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.PRIVATE].includes(normalizeLower(requestedVisibility))
    ? normalizeLower(requestedVisibility)
    : CONTENT_VISIBILITY.COMMUNITY;
};

const normalizeDiscoverySource = ({ requestedSource, contentType, visibility }) => {
  if (contentType === CONTENT_TYPES.UPLOADED) {
    return CONTENT_DISCOVERY_SOURCES.UPLOAD;
  }

  const normalized = normalizeLower(requestedSource);

  if (Object.values(CONTENT_DISCOVERY_SOURCES).includes(normalized)) {
    return normalized;
  }

  return visibility === CONTENT_VISIBILITY.COMMUNITY
    ? CONTENT_DISCOVERY_SOURCES.MANUAL
    : CONTENT_DISCOVERY_SOURCES.MANUAL;
};

const canUserAccessContent = (item, user) => {
  if (!item) {
    return false;
  }

  if (item.visibility === CONTENT_VISIBILITY.COMMUNITY || item.visibility === CONTENT_VISIBILITY.GLOBAL) {
    return true;
  }

  return Boolean(user?._id) && String(item.createdBy?._id || item.createdBy) === String(user._id);
};

const buildLearningContentPayload = ({ body, user }) => {
  const contentType = inferContentType(body);
  const title = normalizeText(body.title);
  const language = normalizeLanguage(body.language);

  if (!title) {
    throw new Error('Title is required.');
  }

  if (!language) {
    throw new Error('Language is required.');
  }

  const visibility = normalizeVisibility({
    requestedVisibility: body.visibility,
    contentType
  });
  const discoverySource = normalizeDiscoverySource({
    requestedSource: body.discoverySource,
    contentType,
    visibility
  });
  const sourceType = normalizeText(body.sourceType) || normalizeContentSourceType(contentType);

  let sourceProvider = normalizeText(body.sourceProvider);
  let sourceId = normalizeText(body.sourceId || body.externalId || body.videoId);
  let url = normalizeText(body.url);
  let sourceUrl = normalizeText(body.sourceUrl || url);
  let embedUrl = normalizeText(body.embedUrl);
  let thumbnail = normalizeText(body.thumbnail || body.thumbnailUrl);

  if (contentType === CONTENT_TYPES.YOUTUBE) {
    sourceProvider = sourceProvider || SOURCE_PROVIDERS.YOUTUBE;
    sourceId = extractYouTubeVideoId(sourceId || url);

    if (!sourceId) {
      throw new Error('A valid YouTube video ID or URL is required.');
    }

    const youtubeUrls = buildYouTubeUrls(sourceId);
    url = url || youtubeUrls.url;
    sourceUrl = sourceUrl || youtubeUrls.url;
    embedUrl = youtubeUrls.embedUrl;
    thumbnail = thumbnail || youtubeUrls.thumbnail;
  } else {
    sourceProvider = sourceProvider || SOURCE_PROVIDERS.USER;
    sourceId = sourceId || sourceUrl || url;

    if (!sourceId) {
      throw new Error('A source identifier is required.');
    }
  }

  const transcriptStatus = ['none', 'pending', 'ready', 'manual_ready', 'linked'].includes(normalizeLower(body.transcriptStatus))
    ? normalizeLower(body.transcriptStatus)
    : 'none';
  const transcriptSource = ['none', 'manual', 'youtube_caption', 'uploaded_file', 'trusted_link', 'future_pipeline'].includes(
    normalizeLower(body.transcriptSource)
  )
    ? normalizeLower(body.transcriptSource)
    : ['ready', 'manual_ready'].includes(transcriptStatus)
      ? 'manual'
      : 'none';
  const transcriptAvailable = normalizeBoolean(body.transcriptAvailable) || ['ready', 'linked'].includes(transcriptStatus);
  const durationValue = Number(body.durationSeconds || body.duration);
  const recommendationEligible =
    [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL].includes(visibility) &&
    contentType === CONTENT_TYPES.YOUTUBE &&
    normalizeBoolean(body.recommendationEligible !== undefined ? body.recommendationEligible : true);

  return {
    title,
    description: normalizeText(body.description),
    language,
    contentType,
    sourceType,
    visibility,
    discoverySource,
    recommendationEligible,
    isSystemContent: normalizeBoolean(body.isSystemContent),
    isCurated: normalizeBoolean(body.isCurated),
    seedSource: normalizeText(body.seedSource),
    curationStatus: normalizeText(body.curationStatus),
    trustLevel: normalizeText(body.trustLevel),
    sourceProvider,
    sourceId,
    externalId: sourceId,
    url,
    sourceUrl,
    embedUrl,
    thumbnail,
    thumbnailUrl: thumbnail,
    duration: Number.isFinite(durationValue) && durationValue > 0 ? durationValue : null,
    durationSeconds: Number.isFinite(durationValue) && durationValue > 0 ? durationValue : null,
    topicTags: normalizeList(body.topicTags),
    registerTags: normalizeList(body.registerTags),
    skillTags: normalizeList(body.skillTags),
    difficulty: normalizeText(body.difficulty),
    transcriptStatus,
    transcriptSource,
    transcriptAvailable,
    transcript: normalizeText(body.transcript),
    linkedVocabularyIds: Array.isArray(body.linkedVocabularyIds) ? body.linkedVocabularyIds : [],
    linkedSentenceIds: Array.isArray(body.linkedSentenceIds) ? body.linkedSentenceIds : [],
    learningSource: true,
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {},
    provenance: {
      ingestionMethod: contentType === CONTENT_TYPES.UPLOADED ? 'upload' : 'manual',
      sourceCapturedAt: new Date(),
      sourceSnapshotTitle: title,
      sourceSnapshotUrl: sourceUrl || url,
      notes: normalizeText(body.provenanceNotes)
    },
    createdBy: body.createdBy === null || visibility === CONTENT_VISIBILITY.GLOBAL ? null : user._id
  };
};

const serializeContent = (item, userId) => {
  const content = item.toObject ? item.toObject() : item;
  const resolvedSourceId = content.sourceId || content.externalId || '';
  const resolvedThumbnail = content.thumbnail || content.thumbnailUrl || '';
  const resolvedSourceUrl = content.sourceUrl || content.url || '';
  const resolvedEmbedUrl =
    content.embedUrl || (content.contentType === CONTENT_TYPES.YOUTUBE && resolvedSourceId ? buildYouTubeUrls(resolvedSourceId).embedUrl : '');
  const isSaved = content.savedBy?.some((savedUserId) => String(savedUserId) === String(userId));
  const isOwnedByCurrentUser = Boolean(userId) && String(content.createdBy?._id || content.createdBy) === String(userId);
  const visibilityLabel =
    content.visibility === CONTENT_VISIBILITY.PRIVATE
      ? 'Private upload'
      : content.visibility === CONTENT_VISIBILITY.GLOBAL
        ? 'Global starter content'
        : 'Community video';

  return {
    ...content,
    sourceId: resolvedSourceId,
    externalId: resolvedSourceId,
    sourceUrl: resolvedSourceUrl,
    url: resolvedSourceUrl,
    thumbnail: resolvedThumbnail,
    thumbnailUrl: resolvedThumbnail,
    embedUrl: resolvedEmbedUrl,
    durationSeconds: content.durationSeconds || content.duration || null,
    duration: content.durationSeconds || content.duration || null,
    transcriptSource: content.transcriptSource || 'none',
    contentLinkCount:
      Number(content.linkedVocabularyIds?.length || 0) + Number(content.linkedSentenceIds?.length || 0),
    studyGenerationReady:
      Number(content.linkedVocabularyIds?.length || 0) + Number(content.linkedSentenceIds?.length || 0) > 0,
    isSaved,
    isOwnedByCurrentUser,
    visibilityLabel,
    visibilityBadge:
      content.visibility === CONTENT_VISIBILITY.PRIVATE ? 'Private' : content.visibility === CONTENT_VISIBILITY.GLOBAL ? 'Global' : 'Community'
  };
};

const contentDetailPopulate = [
  { path: 'createdBy', select: 'username language level goals' },
  { path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' },
  { path: 'linkedSentenceIds', select: 'text translations sourceProvider sourceId' }
];

const buildAccessibleContentFilter = (user) => ({
  $or: [
    { visibility: CONTENT_VISIBILITY.COMMUNITY },
    { visibility: CONTENT_VISIBILITY.GLOBAL },
    { createdBy: user._id }
  ]
});

const getAccessibleContentDocumentById = async ({ id, user, populate = [] }) => {
  const item = await LearningContent.findById(id).populate(populate);

  if (!item || !canUserAccessContent(item, user)) {
    return null;
  }

  return item;
};

const getContentList = async ({ user, query = {} }) => {
  const filters = buildAccessibleContentFilter(user);
  const scope = normalizeLower(query.scope || 'all');

  if (query.language) {
    filters.language = buildLanguageMatch(query.language);
  }

  if (query.sourceProvider) {
    filters.sourceProvider = normalizeText(query.sourceProvider);
  }

  if (query.contentType) {
    filters.contentType = normalizeLower(query.contentType);
  }

  if (query.sourceType) {
    filters.sourceType = normalizeText(query.sourceType);
  }

  if (
    query.visibility &&
    [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.PRIVATE, CONTENT_VISIBILITY.GLOBAL].includes(normalizeLower(query.visibility))
  ) {
    filters.visibility = normalizeLower(query.visibility);
  }

  if (scope === 'community') {
    filters.visibility = { $in: [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL] };
  } else if (scope === 'my_uploads') {
    filters.visibility = CONTENT_VISIBILITY.PRIVATE;
    filters.createdBy = user._id;
  } else if (scope === 'saved') {
    filters.savedBy = user._id;
  }

  if (query.saved === 'true') {
    filters.savedBy = user._id;
  }

  if (query.q) {
    const pattern = new RegExp(escapeRegex(normalizeText(query.q)), 'i');
    filters.$and = [
      ...(filters.$and || []),
      {
        $or: [{ title: pattern }, { description: pattern }, { sourceId: pattern }, { sourceUrl: pattern }, { url: pattern }]
      }
    ];
  }

  const [items, visibleItems] = await Promise.all([
    LearningContent.find(filters)
      .populate({ path: 'createdBy', select: 'username language level goals' })
      .sort({ createdAt: -1 }),
    LearningContent.find(buildAccessibleContentFilter(user)).select('visibility contentType createdBy recommendationEligible savedBy')
  ]);

  const summary = {
    totalVisible: visibleItems.length,
    communityCount: visibleItems.filter(
      (item) => item.visibility === CONTENT_VISIBILITY.COMMUNITY || item.visibility === CONTENT_VISIBILITY.GLOBAL
    ).length,
    myUploadsCount: visibleItems.filter(
      (item) => item.visibility === CONTENT_VISIBILITY.PRIVATE && String(item.createdBy) === String(user._id)
    ).length,
    savedCount: visibleItems.filter((item) => item.savedBy?.some((savedUserId) => String(savedUserId) === String(user._id))).length,
    recommendationReadyCount: visibleItems.filter(
      (item) => [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL].includes(item.visibility) && item.recommendationEligible
    ).length
  };

  return {
    items: items.map((item) => serializeContent(item, user._id)),
    summary
  };
};

const getContentDetail = async ({ id, user }) => {
  const item = await getAccessibleContentDocumentById({ id, user, populate: contentDetailPopulate });

  if (!item) {
    return null;
  }

  return serializeContent(item, user?._id);
};

const getRecommendedContent = async ({ user, query = {} }) => {
  const limit = Math.min(12, Math.max(1, Number(query.limit) || 4));
  const items = await LearningContent.find({
    language: buildLanguageMatch(query.language || user?.language || 'Japanese'),
    visibility: { $in: [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.GLOBAL] },
    recommendationEligible: true,
    savedBy: { $ne: user._id }
  })
    .populate({ path: 'createdBy', select: 'username language level goals' })
    .sort({ createdAt: -1 })
    .limit(40);

  const rankedItems = await rankContentItems({
    user,
    items,
    serializeItem: (item) => serializeContent(item, user._id),
    tieBreaker: (left, right) => normalizeText(left.title).localeCompare(normalizeText(right.title))
  });

  return {
    items: rankedItems.slice(0, limit).map(({ serializedItem, recommendationDebug }) => ({
      ...serializedItem,
      recommendationDebug
    }))
  };
};

const createContent = async ({ body, user }) => {
  const payload = buildLearningContentPayload({ body, user });
  const lookup =
    payload.visibility === CONTENT_VISIBILITY.COMMUNITY || payload.visibility === CONTENT_VISIBILITY.GLOBAL
      ? {
          visibility: payload.visibility,
          sourceProvider: payload.sourceProvider,
          $or: [{ sourceId: payload.sourceId }, { externalId: payload.sourceId }]
        }
      : {
          visibility: CONTENT_VISIBILITY.PRIVATE,
          createdBy: user._id,
          sourceProvider: payload.sourceProvider,
          $or: [{ sourceId: payload.sourceId }, { externalId: payload.sourceId }]
        };

  const existing = await LearningContent.findOne(lookup).populate(contentDetailPopulate);

  if (existing) {
    return { item: serializeContent(existing, user._id), created: false };
  }

  const item = await LearningContent.create(payload);
  await item.populate(contentDetailPopulate);

  return { item: serializeContent(item, user._id), created: true };
};

module.exports = {
  CONTENT_DISCOVERY_SOURCES,
  CONTENT_TYPES,
  CONTENT_VISIBILITY,
  buildLearningContentPayload,
  canUserAccessContent,
  createContent,
  extractYouTubeVideoId,
  getAccessibleContentDocumentById,
  getContentDetail,
  getContentList,
  getRecommendedContent,
  serializeContent
};
