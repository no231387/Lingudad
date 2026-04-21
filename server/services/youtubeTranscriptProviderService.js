const { extractYouTubeVideoId } = require('./contentService');

const DEFAULT_TIMEOUT_MS = 10_000;

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeList = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((entry) => normalizeText(entry)).filter(Boolean))];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getTranscriptProviderUrl = () => normalizeText(process.env.YOUTUBE_TRANSCRIPT_API_URL);
const getTranscriptProviderApiKey = () => normalizeText(process.env.YOUTUBE_TRANSCRIPT_API_KEY);
const getTranscriptProviderTimeoutMs = () => {
  const parsed = Number.parseInt(String(process.env.YOUTUBE_TRANSCRIPT_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS), 10);
  return Number.isFinite(parsed) ? clamp(parsed, 1_000, 60_000) : DEFAULT_TIMEOUT_MS;
};

const isTranscriptProviderConfigured = () => Boolean(getTranscriptProviderUrl());

const resolveYoutubeVideoIdFromContent = (content) => {
  const candidates = [
    content?.sourceId,
    content?.externalId,
    content?.sourceUrl,
    content?.url,
    content?.embedUrl
  ];

  for (const candidate of candidates) {
    const resolved = extractYouTubeVideoId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('No usable YouTube video id could be resolved for this content item.');
};

const normalizeProviderSegment = (segment, index) => {
  const rawText = normalizeText(segment?.text || segment?.rawText || segment?.snippet || segment?.line);
  if (!rawText) {
    return null;
  }

  const hasExplicitStart =
    segment?.startTimeSeconds !== undefined || segment?.start !== undefined || segment?.offsetSeconds !== undefined;
  const hasExplicitEnd = segment?.endTimeSeconds !== undefined || segment?.end !== undefined;
  const hasExplicitDuration = segment?.durationSeconds !== undefined || segment?.duration !== undefined;

  const startTimeSeconds = hasExplicitStart ? segment?.startTimeSeconds ?? segment?.start ?? segment?.offsetSeconds : null;
  const endTimeSeconds = hasExplicitEnd ? segment?.endTimeSeconds ?? segment?.end : null;
  const durationSeconds = hasExplicitDuration ? segment?.durationSeconds ?? segment?.duration : null;

  const normalizedStart = startTimeSeconds === null ? null : Number.isFinite(Number(startTimeSeconds)) ? Number(startTimeSeconds) : null;
  const normalizedEnd = endTimeSeconds !== null
    ? Number.isFinite(Number(endTimeSeconds))
      ? Number(endTimeSeconds)
      : null
    : durationSeconds !== null && normalizedStart !== null && Number.isFinite(Number(durationSeconds))
      ? normalizedStart + Number(durationSeconds)
      : null;

  return {
    segmentOrder: Number.isFinite(Number(segment?.segmentOrder)) ? Number(segment.segmentOrder) : index,
    startTimeSeconds: normalizedStart,
    endTimeSeconds: normalizedEnd !== null && normalizedStart !== null ? Math.max(normalizedStart, normalizedEnd) : normalizedEnd,
    rawText,
    confidence: Number.isFinite(Number(segment?.confidence)) ? Number(segment.confidence) : undefined
  };
};

const normalizeTranscriptSegments = (payload) => {
  const arrayPayload = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.segments)
      ? payload.segments
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.transcript)
          ? payload.transcript
          : null;

  if (arrayPayload) {
    return arrayPayload.map(normalizeProviderSegment).filter(Boolean);
  }

  const transcriptText = normalizeText(payload?.text || payload?.transcriptText || payload?.transcript || payload?.content || '');
  if (!transcriptText) {
    return [];
  }

  return transcriptText
    .split(/\r?\n/)
    .map((line, index) => normalizeProviderSegment({ text: line, segmentOrder: index }, index))
    .filter(Boolean);
};

const fetchTranscriptFromProvider = async ({ content, fetchFn = global.fetch }) => {
  if (typeof fetchFn !== 'function') {
    throw new Error('Fetch is not available for transcript provider requests.');
  }

  if (!isTranscriptProviderConfigured()) {
    throw new Error('YouTube transcript provider is not configured.');
  }

  const videoId = resolveYoutubeVideoIdFromContent(content);
  const providerUrl = new URL(getTranscriptProviderUrl());
  providerUrl.searchParams.set('videoId', videoId);

  const headers = {};
  if (getTranscriptProviderApiKey()) {
    headers['x-api-key'] = getTranscriptProviderApiKey();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTranscriptProviderTimeoutMs());

  try {
    const response = await fetchFn(providerUrl.toString(), {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Transcript provider failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const segments = normalizeTranscriptSegments(payload);

    if (segments.length === 0) {
      throw new Error('Transcript provider returned no usable transcript segments.');
    }

    return {
      videoId,
      transcriptSource: 'youtube_caption',
      providerUsed: 'configured_http_provider',
      segmentCount: segments.length,
      segments,
      providerLanguage: normalizeText(payload?.language || payload?.detectedLanguage || ''),
      fetchDebug: {
        transcriptFetchSource: 'provider_fetch',
        providerUrl: providerUrl.origin,
        segmentCount: segments.length
      }
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Transcript provider request timed out.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  fetchTranscriptFromProvider,
  getTranscriptProviderApiKey,
  getTranscriptProviderTimeoutMs,
  getTranscriptProviderUrl,
  isTranscriptProviderConfigured,
  __testables: {
    normalizeTranscriptSegments,
    resolveYoutubeVideoIdFromContent
  }
};
