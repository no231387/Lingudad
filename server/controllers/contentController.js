const LearningContent = require('../models/LearningContent');
const { buildLearningContentPayload, getContentList } = require('../services/contentService');

exports.getLearningContent = async (req, res) => {
  try {
    const content = await getContentList({ user: req.user, query: req.query });
    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch learning content.', error: error.message });
  }
};

exports.getLearningContentById = async (req, res) => {
  try {
    const item = await LearningContent.findById(req.params.id).populate({ path: 'createdBy', select: 'username language level' });

    if (!item) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch learning content.', error: error.message });
  }
};

exports.createLearningContent = async (req, res) => {
  try {
    const payload = buildLearningContentPayload({ body: req.body, user: req.user });
    const existing = await LearningContent.findOne({
      sourceProvider: payload.sourceProvider,
      externalId: payload.externalId
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const item = await LearningContent.create(payload);
    await item.populate({ path: 'createdBy', select: 'username language level' });

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create learning content.', error: error.message });
  }
};

exports.saveLearningContent = async (req, res) => {
  try {
    const item = await LearningContent.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    const alreadySaved = item.savedBy.some((userId) => String(userId) === String(req.user._id));

    if (!alreadySaved) {
      item.savedBy.push(req.user._id);
      await item.save();
    }

    res.status(200).json({ message: 'Content saved.', contentId: item._id });
  } catch (error) {
    res.status(400).json({ message: 'Failed to save content.', error: error.message });
  }
};

exports.unsaveLearningContent = async (req, res) => {
  try {
    const item = await LearningContent.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    item.savedBy = item.savedBy.filter((userId) => String(userId) !== String(req.user._id));
    await item.save();

    res.status(200).json({ message: 'Content removed from saved list.', contentId: item._id });
  } catch (error) {
    res.status(400).json({ message: 'Failed to remove saved content.', error: error.message });
  }
};
