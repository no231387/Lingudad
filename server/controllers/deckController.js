const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');

const DECK_POPULATION = { path: 'owner', select: 'username' };
const FLASHCARD_POPULATION = [
  { path: 'owner', select: 'username' },
  { path: 'deck', select: 'name language description isOfficial level' },
  { path: 'tags', select: 'name' }
];

const buildStandardDeckFilter = (user) => ({ owner: user._id, isOfficial: false });

const buildOfficialDeckFilter = () => ({ isOfficial: true, level: 'beginner' });

const ownsRecord = (record, user) => String(record.owner) === String(user._id);

const normalizeDeckPayload = (body, existingDeck = null) => ({
  name: String(body.name || existingDeck?.name || '').trim(),
  description: String(body.description ?? existingDeck?.description ?? '').trim(),
  language: String(body.language ?? existingDeck?.language ?? '').trim(),
  isOfficial: Boolean(body.isOfficial ?? existingDeck?.isOfficial ?? false),
  level: String(body.level ?? existingDeck?.level ?? '').trim()
});

exports.getDecks = async (req, res) => {
  try {
    const decks = await Deck.find(buildStandardDeckFilter(req.user)).populate(DECK_POPULATION).sort({ name: 1 });
    res.status(200).json(decks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch decks.', error: error.message });
  }
};

exports.getOfficialBeginnerDecks = async (req, res) => {
  try {
    const decks = await Deck.find(buildOfficialDeckFilter()).populate(DECK_POPULATION).sort({ name: 1 });
    res.status(200).json(decks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch official beginner decks.', error: error.message });
  }
};

exports.getOfficialBeginnerDeckFlashcards = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck || !deck.isOfficial || deck.level !== 'beginner') {
      return res.status(404).json({ message: 'Official beginner deck not found.' });
    }

    const flashcards = await Flashcard.find({ deck: deck._id }).populate(FLASHCARD_POPULATION).sort({ createdAt: -1 });

    res.status(200).json(flashcards);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch official beginner deck flashcards.', error: error.message });
  }
};

exports.createDeck = async (req, res) => {
  try {
    const payload = normalizeDeckPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ message: 'Deck name is required.' });
    }

    if (payload.isOfficial) {
      return res.status(403).json({ message: 'Official beginner decks must be created through the official deck flow.' });
    }

    const deck = await Deck.create({
      ...payload,
      isOfficial: false,
      level: '',
      owner: req.user._id
    });

    await deck.populate(DECK_POPULATION);
    res.status(201).json(deck);
  } catch (error) {
    const message = error.code === 11000 ? 'You already have a deck with that name.' : 'Failed to create deck.';
    res.status(400).json({ message, error: error.message });
  }
};

exports.createOfficialBeginnerDeck = async (req, res) => {
  try {
    const payload = normalizeDeckPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ message: 'Deck name is required.' });
    }

    const deck = await Deck.create({
      ...payload,
      isOfficial: true,
      level: 'beginner',
      owner: req.user._id
    });

    await deck.populate(DECK_POPULATION);
    res.status(201).json(deck);
  } catch (error) {
    const message = error.code === 11000 ? 'An official beginner deck with that name already exists.' : 'Failed to create official beginner deck.';
    res.status(400).json({ message, error: error.message });
  }
};

exports.updateDeck = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      return res.status(404).json({ message: 'Deck not found.' });
    }

    if (deck.isOfficial) {
      return res.status(403).json({ message: 'Official beginner decks must be updated through the official deck flow.' });
    }

    if (!ownsRecord(deck, req.user)) {
      return res.status(403).json({ message: 'You can only update your own decks.' });
    }

    const payload = normalizeDeckPayload(req.body, deck);

    deck.name = payload.name;
    deck.description = payload.description;
    deck.language = payload.language;
    deck.isOfficial = false;
    deck.level = '';

    await deck.save();
    await deck.populate(DECK_POPULATION);

    res.status(200).json(deck);
  } catch (error) {
    const message = error.code === 11000 ? 'You already have a deck with that name.' : 'Failed to update deck.';
    res.status(400).json({ message, error: error.message });
  }
};

exports.updateOfficialBeginnerDeck = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck || !deck.isOfficial || deck.level !== 'beginner') {
      return res.status(404).json({ message: 'Official beginner deck not found.' });
    }

    const payload = normalizeDeckPayload(req.body, deck);

    deck.name = payload.name;
    deck.description = payload.description;
    deck.language = payload.language;
    deck.isOfficial = true;
    deck.level = 'beginner';
    deck.owner = req.user._id;

    await deck.save();
    await deck.populate(DECK_POPULATION);

    res.status(200).json(deck);
  } catch (error) {
    const message = error.code === 11000 ? 'An official beginner deck with that name already exists.' : 'Failed to update official beginner deck.';
    res.status(400).json({ message, error: error.message });
  }
};

exports.deleteDeck = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      return res.status(404).json({ message: 'Deck not found.' });
    }

    if (deck.isOfficial) {
      return res.status(403).json({ message: 'Official beginner decks must be deleted through the official deck flow.' });
    }

    if (!ownsRecord(deck, req.user)) {
      return res.status(403).json({ message: 'You can only delete your own decks.' });
    }

    await Flashcard.updateMany({ deck: deck._id }, { $set: { deck: null, category: 'General' } });
    await deck.deleteOne();

    res.status(200).json({ message: 'Deck deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete deck.', error: error.message });
  }
};

exports.deleteOfficialBeginnerDeck = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck || !deck.isOfficial || deck.level !== 'beginner') {
      return res.status(404).json({ message: 'Official beginner deck not found.' });
    }

    await Flashcard.updateMany({ deck: deck._id }, { $set: { deck: null, category: 'General' } });
    await deck.deleteOne();

    res.status(200).json({ message: 'Official beginner deck deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete official beginner deck.', error: error.message });
  }
};

exports.importDeckToOfficialBeginnerDeck = async (req, res) => {
  try {
    const sourceDeck = await Deck.findById(req.params.id);

    if (!sourceDeck || sourceDeck.isOfficial) {
      return res.status(404).json({ message: 'Source deck not found.' });
    }

    if (String(sourceDeck.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only import your own decks into Official Beginner Decks.' });
    }

    const officialDeck = await Deck.create({
      name: `${sourceDeck.name} (Official Beginner)`,
      description: sourceDeck.description,
      language: sourceDeck.language,
      isOfficial: true,
      level: 'beginner',
      owner: req.user._id
    });

    const sourceFlashcards = await Flashcard.find({ deck: sourceDeck._id });

    if (sourceFlashcards.length > 0) {
      await Flashcard.insertMany(
        sourceFlashcards.map((flashcard) => ({
          wordOrPhrase: flashcard.wordOrPhrase,
          translation: flashcard.translation,
          owner: req.user._id,
          deck: officialDeck._id,
          language: flashcard.language,
          category: officialDeck.name,
          tags: flashcard.tags || [],
          exampleSentence: flashcard.exampleSentence || '',
          proficiency: flashcard.proficiency || 1,
          reviewCount: 0
        }))
      );
    }

    await officialDeck.populate(DECK_POPULATION);

    res.status(201).json({
      message: 'Deck imported into Official Beginner Decks successfully.',
      deck: officialDeck
    });
  } catch (error) {
    const message = error.code === 11000 ? 'An official beginner deck with that imported name already exists.' : 'Failed to import deck into Official Beginner Decks.';
    res.status(400).json({ message, error: error.message });
  }
};

exports.addFlashcardsToDeck = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      return res.status(404).json({ message: 'Deck not found.' });
    }

    if (deck.isOfficial) {
      return res.status(403).json({ message: 'Flashcards can only be added to normal decks through this menu.' });
    }

    if (!ownsRecord(deck, req.user)) {
      return res.status(403).json({ message: 'You can only add flashcards to your own decks.' });
    }

    const flashcardIds = Array.isArray(req.body.flashcardIds)
      ? [...new Set(req.body.flashcardIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (flashcardIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one flashcard to add to this deck.' });
    }

    const flashcards = await Flashcard.find({ _id: { $in: flashcardIds } });

    if (flashcards.length !== flashcardIds.length) {
      return res.status(404).json({ message: 'One or more selected flashcards were not found.' });
    }

    const unauthorizedFlashcard = flashcards.find((flashcard) => !ownsRecord(flashcard, req.user));

    if (unauthorizedFlashcard) {
      return res.status(403).json({ message: 'You can only add flashcards you have permission to manage.' });
    }

    await Flashcard.updateMany(
      { _id: { $in: flashcardIds } },
      {
        $set: {
          deck: deck._id,
          category: deck.name
        }
      }
    );

    res.status(200).json({
      message: 'Flashcards added to deck successfully.',
      addedCount: flashcardIds.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add flashcards to deck.', error: error.message });
  }
};

exports.resetDeckProficiency = async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      return res.status(404).json({ message: 'Deck not found.' });
    }

    if (deck.isOfficial) {
      return res.status(403).json({ message: 'Official beginner decks must be managed through the official deck flow.' });
    }

    if (!ownsRecord(deck, req.user)) {
      return res.status(403).json({ message: 'You can only reset proficiency for your own decks.' });
    }

    const result = await Flashcard.updateMany(
      { deck: deck._id },
      {
        $set: {
          proficiency: 1
        }
      }
    );

    res.status(200).json({
      message: 'Deck proficiency reset successfully.',
      updatedCount: result.modifiedCount ?? 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset deck proficiency.', error: error.message });
  }
};
