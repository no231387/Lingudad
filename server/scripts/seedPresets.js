const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Preset = require('../models/Preset');
const { PRESET_SEED_SOURCE, SYSTEM_PRESET_ITEMS } = require('../seed/presetSeedData');

dotenv.config();

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeList = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLower(value)).filter(Boolean))];

const buildPresetPayload = (item) => ({
  name: normalizeText(item.name),
  slug: normalizeLower(item.slug),
  code: normalizeLower(item.code || item.slug),
  description: normalizeText(item.description),
  language: normalizeText(item.language),
  registerTags: normalizeList(item.registerTags),
  skillTags: normalizeList(item.skillTags),
  targetDifficulty: normalizeList(item.targetDifficulty),
  levelBand: normalizeText(item.levelBand),
  conversationGoal: normalizeText(item.conversationGoal),
  focusLabel: normalizeText(item.focusLabel),
  visibility: 'global',
  recommendationEligible: true,
  isSystemPreset: true,
  isCurated: true,
  seedSource: PRESET_SEED_SOURCE,
  sortOrder: Number(item.sortOrder || 100),
  metadata: {
    configType: 'system_preset',
    seededBy: PRESET_SEED_SOURCE
  },
  createdBy: null
});

const upsertSystemPresets = async () => {
  const summary = { created: 0, updated: 0 };

  for (const item of SYSTEM_PRESET_ITEMS) {
    const filter = {
      visibility: 'global',
      language: normalizeText(item.language),
      slug: normalizeLower(item.slug)
    };
    const payload = buildPresetPayload(item);
    const existing = await Preset.findOne(filter).lean();

    await Preset.findOneAndUpdate(filter, payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });

    if (existing) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }
  }

  return summary;
};

const seedPresets = async () => {
  try {
    await connectDB();
    const summary = await upsertSystemPresets();

    console.log(
      JSON.stringify(
        {
          seedSource: PRESET_SEED_SOURCE,
          summary,
          totalSeedItems: SYSTEM_PRESET_ITEMS.length
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Preset seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedPresets();
