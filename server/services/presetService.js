const mongoose = require('mongoose');
const Preset = require('../models/Preset');
const { rankPresetsForUser } = require('./learningEngineService');

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLower(value)).filter(Boolean))];

const LANGUAGE_ALIASES = Object.freeze({
  ja: 'Japanese',
  japanese: 'Japanese'
});

const resolveLanguage = (languageInput) => {
  const normalized = normalizeLower(languageInput);

  if (!normalized) {
    return '';
  }

  return LANGUAGE_ALIASES[normalized] || normalizeText(languageInput);
};

const buildLanguageFilter = (languageInput) => {
  const canonicalLanguage = resolveLanguage(languageInput);

  if (!canonicalLanguage) {
    return null;
  }

  const aliases = Object.keys(LANGUAGE_ALIASES).filter((key) => LANGUAGE_ALIASES[key] === canonicalLanguage);
  return {
    $in: [...new Set([canonicalLanguage, ...aliases])]
  };
};

const buildAccessiblePresetFilter = ({ user, language, recommendationEligibleOnly = false } = {}) => {
  const filter = {
    $or: [{ visibility: 'global' }]
  };

  if (user?._id && mongoose.Types.ObjectId.isValid(String(user._id))) {
    filter.$or.push({ createdBy: user._id });
  }

  const languageFilter = buildLanguageFilter(language);

  if (languageFilter) {
    filter.language = languageFilter;
  }

  if (recommendationEligibleOnly) {
    filter.recommendationEligible = true;
  }

  return filter;
};

const serializePreset = (preset) => {
  const source = typeof preset.toObject === 'function' ? preset.toObject() : { ...preset };
  const { __v, ...rest } = source;

  return {
    ...rest,
    id: rest.slug,
    slug: rest.slug,
    code: rest.code || rest.slug,
    registerTags: normalizeList(rest.registerTags),
    skillTags: normalizeList(rest.skillTags),
    targetDifficulty: normalizeList(rest.targetDifficulty)
  };
};

const getPresets = async ({ user, language, recommendationEligibleOnly = false } = {}) => {
  const presets = await Preset.find(buildAccessiblePresetFilter({ user, language, recommendationEligibleOnly }))
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return presets.map(serializePreset);
};

const getPresetById = async (presetId, { user, language } = {}) => {
  const normalizedId = normalizeLower(presetId);

  if (!normalizedId) {
    return null;
  }

  const accessibleFilter = buildAccessiblePresetFilter({ user, language });
  const query = {
    ...accessibleFilter,
    $and: [
      {
        $or: [{ slug: normalizedId }, { code: normalizedId }]
      }
    ]
  };

  const preset = await Preset.findOne(query).lean();
  return preset ? serializePreset(preset) : null;
};

const getRecommendedPresets = async ({ user, language, limit = 4 }) => {
  const presets = await getPresets({
    user,
    language: language || user?.language || 'Japanese',
    recommendationEligibleOnly: true
  });
  const rankedPresets = rankPresetsForUser({
    user,
    presets,
    tieBreaker: (left, right) => {
      if (Number(left.sortOrder || 0) !== Number(right.sortOrder || 0)) {
        return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
      }

      return left.name.localeCompare(right.name);
    }
  });

  return rankedPresets.slice(0, Math.min(10, Math.max(1, Number(limit) || 4))).map(({ item, recommendationDebug }) => ({
    ...item,
    recommendationDebug
  }));
};

module.exports = {
  getPresetById,
  getPresets,
  getRecommendedPresets,
  serializePreset
};
