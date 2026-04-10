const {
  createContent,
  getAccessibleContentDocumentById,
  getContentDetail,
  getContentList,
  getRecommendedContent,
  serializeContent
} = require('../services/contentService');
const { getContentStudyPack } = require('../services/contentStudyService');
const { createFlashcardsFromContent } = require('../services/studyGenerationService');
const { getTranscriptSegmentsForContent, ingestTranscriptSegments } = require('../services/transcriptService');

exports.getLearningContent = async (req, res) => {
  try {
    const content = await getContentList({ user: req.user, query: req.query });
    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch learning content.', error: error.message });
  }
};

exports.getRecommendedLearningContent = async (req, res) => {
  try {
    const recommendations = await getRecommendedContent({ user: req.user, query: req.query });
    res.status(200).json(recommendations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recommended content.', error: error.message });
  }
};

exports.getLearningContentById = async (req, res) => {
  try {
    const item = await getContentDetail({ id: req.params.id, user: req.user });

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
    const { item, created } = await createContent({ body: req.body, user: req.user });
    res.status(created ? 201 : 200).json(item);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create learning content.', error: error.message });
  }
};

exports.saveLearningContent = async (req, res) => {
  try {
    const item = await getAccessibleContentDocumentById({ id: req.params.id, user: req.user });

    if (!item) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    const alreadySaved = item.savedBy.some((userId) => String(userId) === String(req.user._id));

    if (!alreadySaved) {
      item.savedBy.push(req.user._id);
      await item.save();
    }

    res.status(200).json({ message: 'Content saved.', content: serializeContent(item, req.user._id), contentId: item._id });
  } catch (error) {
    res.status(400).json({ message: 'Failed to save content.', error: error.message });
  }
};

exports.unsaveLearningContent = async (req, res) => {
  try {
    const item = await getAccessibleContentDocumentById({ id: req.params.id, user: req.user });

    if (!item) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    item.savedBy = item.savedBy.filter((userId) => String(userId) !== String(req.user._id));
    await item.save();

    res.status(200).json({ message: 'Content removed from saved list.', content: serializeContent(item, req.user._id), contentId: item._id });
  } catch (error) {
    res.status(400).json({ message: 'Failed to remove saved content.', error: error.message });
  }
};

exports.generateFlashcardsFromContent = async (req, res) => {
  try {
    const result = await createFlashcardsFromContent({
      id: req.params.id,
      user: req.user,
      deckId: req.body.deckId || null
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Failed to generate flashcards from content.', error: error.message });
  }
};

exports.getTranscriptBackedStudyPack = async (req, res) => {
  try {
    const result = await getContentStudyPack({
      contentId: req.params.id,
      user: req.user
    });

    if (!result) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to prepare transcript-backed study.', error: error.message });
  }
};

exports.getContentTranscriptSegments = async (req, res) => {
  try {
    const transcriptSegments = await getTranscriptSegmentsForContent({
      contentId: req.params.id,
      user: req.user
    });

    if (!transcriptSegments) {
      return res.status(404).json({ message: 'Learning content not found.' });
    }

    res.status(200).json(transcriptSegments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transcript segments.', error: error.message });
  }
};

exports.saveContentTranscriptSegments = async (req, res) => {
  try {
    const result = await ingestTranscriptSegments({
      contentId: req.params.id,
      user: req.user,
      body: req.body
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Failed to save transcript segments.', error: error.message });
  }
};
