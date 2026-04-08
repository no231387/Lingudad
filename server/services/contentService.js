const LearningContent = require('../models/LearningContent');
const { SOURCE_PROVIDERS } = require('./sourceCatalogService');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);
const CONTENT_TYPES = Object.freeze({
  YOUTUBE: 'youtube',
  UPLOADED: 'uploaded',
  OTHER: 'other'
});

const normalizeText = (value) => String(value || '').trim();

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

  return ['true', '1', 'yes'].includes(normalizeText(value).toLowerCase());
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
  const requested = normalizeText(body.contentType).toLowerCase();

  if ([CONTENT_TYPES.YOUTUBE, CONTENT_TYPES.UPLOADED, CONTENT_TYPES.OTHER].includes(requested)) {
    return requested;
  }

  if (extractYouTubeVideoId(body.sourceId || body.externalId || body.videoId || body.url)) {
    return CONTENT_TYPES.YOUTUBE;
  }

  return CONTENT_TYPES.OTHER;
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

  return {
    title,
    description: normalizeText(body.description),
    language,
    contentType,
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

  return {
    ...content,
    sourceId: resolvedSourceId,
    externalId: resolvedSourceId,
    thumbnail: resolvedThumbnail,
    thumbnailUrl: resolvedThumbnail,
    embedUrl: resolvedEmbedUrl,
    isSaved
  };
};

const contentDetailPopulate = [
  { path: 'createdBy', select: 'username language level goals' },
  { path: 'linkedVocabularyIds', select: 'term reading meanings sourceProvider sourceId' },
  { path: 'linkedSentenceIds', select: 'text translations sourceProvider sourceId' }
];

const getContentList = async ({ user, query = {} }) => {
  const filters = {};

  if (query.language) {
    filters.language = normalizeLanguage(query.language);
  }

  if (query.sourceProvider) {
    filters.sourceProvider = normalizeText(query.sourceProvider);
  }

  if (query.contentType) {
    filters.contentType = normalizeText(query.contentType).toLowerCase();
  }

  if (query.saved === 'true') {
    filters.savedBy = user._id;
  }

  const content = await LearningContent.find(filters)
    .populate({ path: 'createdBy', select: 'username language level goals' })
    .sort({ createdAt: -1 });

  return content.map((item) => serializeContent(item, user._id));
};

const getContentDetail = async ({ id, user }) => {
  const item = await LearningContent.findById(id).populate(contentDetailPopulate);

  if (!item) {
    return null;
  }

  return serializeContent(item, user?._id);
};

const createContent = async ({ body, user }) => {
  const payload = buildLearningContentPayload({ body, user });
  const existing = await LearningContent.findOne({
    sourceProvider: payload.sourceProvider,
    $or: [{ sourceId: payload.sourceId }, { externalId: payload.sourceId }]
  }).populate(contentDetailPopulate);

  if (existing) {
    return { item: serializeContent(existing, user._id), created: false };
  }

  const item = await LearningContent.create(payload);
  await item.populate(contentDetailPopulate);

  return { item: serializeContent(item, user._id), created: true };
};

module.exports = {
  CONTENT_TYPES,
  buildLearningContentPayload,
  createContent,
  extractYouTubeVideoId,
  getContentDetail,
  getContentList
};
