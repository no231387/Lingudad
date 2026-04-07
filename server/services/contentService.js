const LearningContent = require('../models/LearningContent');
const { SOURCE_PROVIDERS } = require('./sourceCatalogService');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);

const normalizeText = (value) => String(value || '').trim();

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

    return normalizeText(url.searchParams.get('v')).slice(0, 11);
  } catch (error) {
    return '';
  }
};

const buildYouTubeUrls = (videoId) => ({
  url: `https://www.youtube.com/watch?v=${videoId}`,
  thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
});

const buildLearningContentPayload = ({ body, user }) => {
  const sourceProvider = normalizeText(body.sourceProvider) || SOURCE_PROVIDERS.YOUTUBE;
  const externalId = extractYouTubeVideoId(body.externalId || body.videoId || body.url);

  if (!externalId) {
    throw new Error('A valid YouTube video ID or URL is required.');
  }

  const { url, thumbnailUrl } = buildYouTubeUrls(externalId);

  return {
    type: 'video',
    language: normalizeText(body.language),
    title: normalizeText(body.title),
    sourceProvider,
    externalId,
    transcript: normalizeText(body.transcript),
    difficulty: normalizeText(body.difficulty),
    description: normalizeText(body.description),
    url,
    thumbnailUrl,
    createdBy: user._id
  };
};

const getContentList = async ({ user, query = {} }) => {
  const filters = {};

  if (query.language) {
    filters.language = normalizeText(query.language);
  }

  if (query.sourceProvider) {
    filters.sourceProvider = normalizeText(query.sourceProvider);
  }

  if (query.saved === 'true') {
    filters.savedBy = user._id;
  }

  return LearningContent.find(filters)
    .populate({ path: 'createdBy', select: 'username language level goals' })
    .sort({ createdAt: -1 });
};

module.exports = {
  buildLearningContentPayload,
  extractYouTubeVideoId,
  getContentList
};
