const Tag = require('../models/Tag');

const buildAccessFilter = (user) => ({ owner: user._id });

exports.getTags = async (req, res) => {
  try {
    const tags = await Tag.find(buildAccessFilter(req.user)).sort({ name: 1 });
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tags.', error: error.message });
  }
};

exports.createTag = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Tag name is required.' });
    }

    const tag = await Tag.create({
      name,
      owner: req.user._id
    });

    res.status(201).json(tag);
  } catch (error) {
    const message = error.code === 11000 ? 'You already have a tag with that name.' : 'Failed to create tag.';
    res.status(400).json({ message, error: error.message });
  }
};
