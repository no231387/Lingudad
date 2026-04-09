const LearningContent = require('../models/LearningContent');
const { SOURCE_PROVIDERS } = require('./sourceCatalogService');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);
const CONTENT_TYPES = Object.freeze({
  YOUTUBE: 'youtube',
  UPLOADED: 'uploaded',
  OTHER: 'other'
});
const CONTENT_VISIBILITY = Object.freeze({
  COMMUNITY: 'community',
  PRIVATE: 'private'
});
const CONTENT_DISCOVERY_SOURCES = Object.freeze({
  MANUAL: 'manual',
  UPLOAD: 'upload',
  COMMUNITY_SEED: 'community_seed',
  FUTURE_SEARCH: 'future_search'
});

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();

const normalizeLanguage = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  return /^(ja|japanese)$/i.test(normalized) ? 'Japanese' : normalized;
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

  if (item.visibility === CONTENT_VISIBILITY.COMMUNITY) {
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

  let sourceProvider = normalizeText(body.sourceProvider);
  let sourceId = normalizeText(body.sourceId || body.externalId || body.videoId);
  let url = normalizeText(body.url);
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
    embedUrl = youtubeUrls.embedUrl;
    thumbnail = thumbnail || youtubeUrls.thumbnail;
  } else {
    sourceProvider = sourceProvider || SOURCE_PROVIDERS.USER;
    sourceId = sourceId || url;

    if (!sourceId) {
      throw new Error('A source identifier is required.');
    }
  }

  const transcriptStatus = ['none', 'pending', 'ready'].includes(normalizeText(body.transcriptStatus))
    ? normalizeText(body.transcriptStatus)
    : 'none';
  const transcriptAvailable = normalizeBoolean(body.transcriptAvailable) || transcriptStatus === 'ready';
  const durationValue = Number(body.duration);
  const recommendationEligible =
    visibility === CONTENT_VISIBILITY.COMMUNITY && contentType === CONTENT_TYPES.YOUTUBE && normalizeBoolean(body.recommendationEligible !== undefined ? body.recommendationEligible : true);

  return {
    title,
    description: normalizeText(body.description),
    language,
    contentType,
    visibility,
    discoverySource,
    recommendationEligible,
    sourceProvider,
    sourceId,
    externalId: sourceId,
    url,
    embedUrl,
    thumbnail,
    thumbnailUrl: thumbnail,
    duration: Number.isFinite(durationValue) && durationValue > 0 ? durationValue : null,
    topicTags: normalizeList(body.topicTags),
    registerTags: normalizeList(body.registerTags),
    skillTags: normalizeList(body.skillTags),
    difficulty: normalizeText(body.difficulty),
    transcriptStatus,
    transcriptAvailable,
    transcript: normalizeText(body.transcript),
    linkedVocabularyIds: Array.isArray(body.linkedVocabularyIds) ? body.linkedVocabularyIds : [],
    linkedSentenceIds: Array.isArray(body.linkedSentenceIds) ? body.linkedSentenceIds : [],
    learningSource: true,
    createdBy: user._id
  };
};

const serializeContent = (item, userId) => {
  const content = item.toObject ? item.toObject() : item;
  const resolvedSourceId = content.sourceId || content.externalId || '';
  const resolvedThumbnail = content.thumbnail || content.thumbnailUrl || '';
  const resolvedEmbedUrl =
    content.embedUrl || (content.contentType === CONTENT_TYPES.YOUTUBE && resolvedSourceId ? buildYouTubeUrls(resolvedSourceId).embedUrl : '');
  const isSaved = content.savedBy?.some((savedUserId) => String(savedUserId) === String(userId));
  const isOwnedByCurrentUser = Boolean(userId) && String(content.createdBy?._id || content.createdBy) === String(userId);
  const visibilityLabel = content.visibility === CONTENT_VISIBILITY.PRIVATE ? 'Private upload' : 'Community video';

  return {
    ...content,
    sourceId: resolvedSourceId,
    externalId: resolvedSourceId,
    thumbnail: resolvedThumbnail,
    thumbnailUrl: resolvedThumbnail,
    embedUrl: resolvedEmbedUrl,
    isSaved,
    isOwnedByCurrentUser,
    visibilityLabel
  };
};

const contentDetailPopulate = [
  { path: 'createdBy', select: 'username language level goals' },
  { path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' },
  { path: 'linkedSentenceIds', select: 'text translations sourceProvider sourceId' }
];

const buildAccessibleContentFilter = (user) => ({
  $or: [{ visibility: CONTENT_VISIBILITY.COMMUNITY }, { createdBy: user._id }]
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
    filters.language = normalizeLanguage(query.language);
  }

  if (query.sourceProvider) {
    filters.sourceProvider = normalizeText(query.sourceProvider);
  }

  if (query.contentType) {
    filters.contentType = normalizeLower(query.contentType);
  }

  if (query.visibility && [CONTENT_VISIBILITY.COMMUNITY, CONTENT_VISIBILITY.PRIVATE].includes(normalizeLower(query.visibility))) {
    filters.visibility = normalizeLower(query.visibility);
  }

  if (scope === 'community') {
    filters.visibility = CONTENT_VISIBILITY.COMMUNITY;
  } else if (scope === 'my_uploads') {
    filters.visibility = CONTENT_VISIBILITY.PRIVATE;
    filters.createdBy = user._id;
  } else if (scope === 'saved') {
    filters.savedBy = user._id;
  }

  if (query.saved === 'true') {
    filters.savedBy = user._id;
  }

  const [items, visibleItems] = await Promise.all([
    LearningContent.find(filters)
      .populate({ path: 'createdBy', select: 'username language level goals' })
      .sort({ createdAt: -1 }),
    LearningContent.find(buildAccessibleContentFilter(user)).select('visibility contentType createdBy recommendationEligible savedBy')
  ]);

  const summary = {
    totalVisible: visibleItems.length,
    communityCount: visibleItems.filter((item) => item.visibility === CONTENT_VISIBILITY.COMMUNITY).length,
    myUploadsCount: visibleItems.filter(
      (item) => item.visibility === CONTENT_VISIBILITY.PRIVATE && String(item.createdBy) === String(user._id)
    ).length,
    savedCount: visibleItems.filter((item) => item.savedBy?.some((savedUserId) => String(savedUserId) === String(user._id))).length,
    recommendationReadyCount: visibleItems.filter(
      (item) => item.visibility === CONTENT_VISIBILITY.COMMUNITY && item.recommendationEligible
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

const createContent = async ({ body, user }) => {
  const payload = buildLearningContentPayload({ body, user });
  const lookup =
    payload.visibility === CONTENT_VISIBILITY.COMMUNITY
      ? {
          visibility: CONTENT_VISIBILITY.COMMUNITY,
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
  serializeContent
};
