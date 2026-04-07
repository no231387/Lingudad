const Flashcard = require('../models/Flashcard');
const Deck = require('../models/Deck');
const Tag = require('../models/Tag');
const { normalizeSourceFields, SOURCE_TYPES } = require('../services/sourceCatalogService');
const { upsertProgress } = require('../services/userProgressService');

const REVIEW_RATINGS = new Set(['again', 'good', 'easy']);
const DUPLICATE_OPTIONS = new Set(['skip', 'import_anyway', 'update_existing']);
const FLASHCARD_POPULATION = [
  { path: 'owner', select: 'username' },
  { path: 'deck', select: 'name language description' },
  { path: 'tags', select: 'name' }
];

const updateProficiencyFromReview = (currentProficiency, rating) => {
  if (rating === 'again') {
    return Math.max(1, currentProficiency - 1);
  }

  if (rating === 'easy') {
    return Math.min(5, currentProficiency + 2);
  }

  return Math.min(5, currentProficiency + 1);
};

const applyReviewRating = (flashcard, rating) => {
  const reviewCount = flashcard.reviewCount || 0;
  flashcard.reviewCount = reviewCount + 1;
  flashcard.proficiency = updateProficiencyFromReview(flashcard.proficiency, rating);
};

const normalizeText = (value) => String(value || '').trim();

const parseTagNames = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
  }

  return [...new Set(String(value || '').split(',').map((item) => normalizeText(item)).filter(Boolean))];
};

const parseProficiency = (value) => {
  if (value === '' || value === null || value === undefined) {
    return { value: 1 };
  }

  const normalizedValue = normalizeText(value).toLowerCase();
  const labelMap = {
    new: 1,
    beginner: 1,
    learning: 2,
    familiar: 3,
    intermediate: 3,
    strong: 4,
    advanced: 4,
    mastered: 5,
    expert: 5
  };

  if (labelMap[normalizedValue]) {
    return { value: labelMap[normalizedValue] };
  }

  const directNumber = Number(normalizedValue);

  if (Number.isInteger(directNumber) && directNumber >= 1 && directNumber <= 5) {
    return { value: directNumber };
  }

  const embeddedDigitMatch = normalizedValue.match(/[1-5]/);

  if (embeddedDigitMatch) {
    return { value: Number(embeddedDigitMatch[0]) };
  }

  return { error: 'Proficiency must map to a level from 1 to 5.' };
};

const buildAccessFilter = (user) => ({ owner: user._id });
const buildOwnedFilter = (user) => ({ owner: user._id });
const buildCommunityFilter = (user) => ({ owner: { $ne: user._id } });

const mergeFilters = (...filters) => Object.assign({}, ...filters);

const getOwnerId = (record) => record.owner?._id || record.owner;

const ownsFlashcard = (record, user) => String(getOwnerId(record)) === String(user._id);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFilters = ({ language, category, proficiency, deck, search }) => {
  const filters = {};

  if (language) filters.language = language;
  if (category) filters.category = category;
  if (deck) filters.deck = deck;
  if (proficiency) filters.proficiency = Number(proficiency);
  if (search) {
    const pattern = new RegExp(escapeRegex(normalizeText(search)), 'i');
    filters.$or = [
      { wordOrPhrase: pattern },
      { translation: pattern },
      { language: pattern },
      { category: pattern },
      { exampleSentence: pattern }
    ];
  }

  return filters;
};

const createDuplicateKey = ({ wordOrPhrase, translation, language, deckName }) =>
  [wordOrPhrase, translation, language, deckName || '']
    .map((value) => normalizeText(value).toLowerCase())
    .join('::');

const getDeckByInput = async ({ deckId, deckName, user }) => {
  if (deckId) {
    const deck = await Deck.findById(deckId);

    if (!deck) {
      throw new Error('Selected deck was not found.');
    }

    if (String(deck.owner) !== String(user._id)) {
      throw new Error('You can only use decks you have access to.');
    }

    return deck;
  }

  if (!deckName) {
    return null;
  }

  const existingDeck = await Deck.findOne({
    name: deckName,
    ...buildAccessFilter(user)
  });

  if (existingDeck) {
    return existingDeck;
  }

  return Deck.create({
    name: deckName,
    language: '',
    description: '',
    owner: user._id
  });
};

const getTagsByNames = async ({ tagNames, user }) => {
  if (tagNames.length === 0) {
    return [];
  }

  const existingTags = await Tag.find({
    name: { $in: tagNames },
    ...buildAccessFilter(user)
  });

  const tagMap = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]));
  const tags = [...existingTags];

  for (const tagName of tagNames) {
    if (tagMap.has(tagName.toLowerCase())) {
      continue;
    }

    const tag = await Tag.create({
      name: tagName,
      owner: user._id
    });

    tagMap.set(tag.name.toLowerCase(), tag);
    tags.push(tag);
  }

  return tags;
};

const buildFlashcardPayload = async ({ body, user, keepOwner, currentOwner }) => {
  const deckNameInput = typeof body.deck === 'string' ? normalizeText(body.deck) : normalizeText(body.deckName);
  const deck = await getDeckByInput({
    deckId: body.deckId || body.deck?._id,
    deckName: deckNameInput,
    user
  });
  const tagNames = parseTagNames(body.tagNames || body.tags?.map?.((tag) => tag.name) || body.tags);
  const tags = await getTagsByNames({ tagNames, user });

  const source = normalizeSourceFields({
    sourceType: body.sourceType,
    sourceProvider: body.sourceProvider,
    sourceId: body.sourceId
  });

  return {
    wordOrPhrase: normalizeText(body.wordOrPhrase),
    translation: normalizeText(body.translation),
    reading: normalizeText(body.reading),
    meaning: normalizeText(body.meaning) || normalizeText(body.translation),
    owner: keepOwner ? currentOwner : user._id,
    deck: deck?._id || null,
    language: normalizeText(body.language),
    category: deck?.name || normalizeText(body.category) || 'General',
    tags: tags.map((tag) => tag._id),
    exampleSentence: normalizeText(body.exampleSentence),
    sourceType: source.sourceType,
    sourceProvider: source.sourceProvider,
    sourceId: source.sourceId,
    proficiency: parseProficiency(body.proficiency).value ?? 1
  };
};

const buildImportPayload = async (row, user, importOptions = {}) => {
  const wordOrPhrase = normalizeText(row.question);
  const translation = normalizeText(row.answer);
  const language = normalizeText(row.language) || 'Unspecified';
  const overrideDeckName = normalizeText(importOptions.targetDeckName);
  const deckName = overrideDeckName || normalizeText(row.deck) || 'General';
  const tagNames = parseTagNames(row.tags);
  const proficiencyResult = parseProficiency(row.proficiency);
  const errors = [];

  if (!wordOrPhrase) errors.push('Question is required.');
  if (!translation) errors.push('Answer is required.');
  if (proficiencyResult.error) errors.push(proficiencyResult.error);

  let deck = null;
  let tags = [];

  try {
    deck = await getDeckByInput({
      deckId: importOptions.targetDeckId,
      deckName,
      user
    });
    tags = await getTagsByNames({ tagNames, user });
  } catch (error) {
    errors.push(error.message);
  }

  const payload = {
    wordOrPhrase,
    translation,
    reading: normalizeText(row.reading),
    meaning: translation,
    owner: user._id,
    deck: deck?._id || null,
    language,
    category: deck?.name || deckName,
    tags: tags.map((tag) => tag._id),
    exampleSentence: '',
    sourceType: SOURCE_TYPES.USER,
    sourceProvider: 'user',
    sourceId: '',
    proficiency: proficiencyResult.value ?? 1
  };

  const validationError = new Flashcard(payload).validateSync();

  if (validationError) {
    errors.push(...Object.values(validationError.errors).map((error) => error.message));
  }

  return {
    payload,
    deckName: payload.category,
    errors: [...new Set(errors)]
  };
};

exports.getFlashcards = async (req, res) => {
  try {
    const filters = mergeFilters(buildOwnedFilter(req.user), buildFilters(req.query));
    const flashcards = await Flashcard.find(filters).populate(FLASHCARD_POPULATION).sort({ createdAt: -1 });
    res.status(200).json(flashcards);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch flashcards.', error: error.message });
  }
};

exports.getCommunityFlashcards = async (req, res) => {
  try {
    const filters = mergeFilters(buildCommunityFilter(req.user), buildFilters(req.query));
    const flashcards = await Flashcard.find(filters).populate(FLASHCARD_POPULATION).sort({ createdAt: -1 });
    res.status(200).json(flashcards);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch community flashcards.', error: error.message });
  }
};

exports.getFlashcardById = async (req, res) => {
  try {
    const flashcard = await Flashcard.findById(req.params.id).populate(FLASHCARD_POPULATION);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this flashcard.' });
    }

    res.status(200).json(flashcard);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch flashcard.', error: error.message });
  }
};

exports.createFlashcard = async (req, res) => {
  try {
    const payload = await buildFlashcardPayload({ body: req.body, user: req.user });
    const flashcard = await Flashcard.create(payload);

    await flashcard.populate(FLASHCARD_POPULATION);
    res.status(201).json(flashcard);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create flashcard.', error: error.message });
  }
};

exports.updateFlashcard = async (req, res) => {
  try {
    const flashcard = await Flashcard.findById(req.params.id);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You can only update your own flashcards.' });
    }

    const payload = await buildFlashcardPayload({
      body: {
        ...flashcard.toObject(),
        ...req.body
      },
      user: req.user,
      keepOwner: true,
      currentOwner: flashcard.owner
    });

    Object.assign(flashcard, payload);
    await flashcard.save();
    await flashcard.populate(FLASHCARD_POPULATION);

    res.status(200).json(flashcard);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update flashcard.', error: error.message });
  }
};

exports.deleteFlashcard = async (req, res) => {
  try {
    const flashcard = await Flashcard.findById(req.params.id);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You can only delete your own flashcards.' });
    }

    await flashcard.deleteOne();

    res.status(200).json({ message: 'Flashcard deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete flashcard.', error: error.message });
  }
};

exports.updateProficiency = async (req, res) => {
  try {
    const { rating } = req.body;
    const flashcard = await Flashcard.findById(req.params.id);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You can only update your own flashcards.' });
    }

    const safeRating = Math.min(5, Math.max(1, Number(rating)));
    flashcard.proficiency = Math.min(5, Math.max(1, Math.round((flashcard.proficiency + safeRating) / 2)));

    await flashcard.save();
    res.status(200).json(flashcard);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update proficiency.', error: error.message });
  }
};

exports.resetFlashcardProficiency = async (req, res) => {
  try {
    const flashcard = await Flashcard.findById(req.params.id);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You can only reset proficiency for your own flashcards.' });
    }

    flashcard.proficiency = 1;
    await flashcard.save();

    res.status(200).json({
      message: 'Flashcard proficiency reset successfully.',
      flashcard
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to reset flashcard proficiency.', error: error.message });
  }
};

exports.reviewFlashcard = async (req, res) => {
  try {
    const rating = String(req.body.rating || '').toLowerCase();

    if (!REVIEW_RATINGS.has(rating)) {
      return res.status(400).json({ message: 'Rating must be one of: again, good, easy.' });
    }

    const flashcard = await Flashcard.findById(req.params.id);

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    if (!ownsFlashcard(flashcard, req.user)) {
      return res.status(403).json({ message: 'You can only review your own flashcards.' });
    }

    applyReviewRating(flashcard, rating);

    await flashcard.save();
    await upsertProgress({
      userId: req.user._id,
      itemType: 'flashcard',
      itemId: flashcard._id,
      correctDelta: rating === 'again' ? 0 : 1,
      incorrectDelta: rating === 'again' ? 1 : 0
    });

    res.status(200).json(flashcard);
  } catch (error) {
    res.status(400).json({ message: 'Failed to review flashcard.', error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const accessFilter = buildOwnedFilter(req.user);
    const [total, mastered, newCards] = await Promise.all([
      Flashcard.countDocuments(accessFilter),
      Flashcard.countDocuments(mergeFilters(accessFilter, { proficiency: 5 })),
      Flashcard.countDocuments(mergeFilters(accessFilter, { proficiency: 1 }))
    ]);

    res.status(200).json({
      total,
      mastered,
      newCards
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dashboard stats.', error: error.message });
  }
};

exports.bulkImportFlashcards = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const duplicateHandling = String(req.body.duplicateHandling || 'skip').toLowerCase();
    const targetDeckId = normalizeText(req.body.targetDeckId);
    const targetDeckName = normalizeText(req.body.targetDeckName);

    if (!DUPLICATE_OPTIONS.has(duplicateHandling)) {
      return res.status(400).json({
        message: 'Duplicate handling must be one of: skip, import_anyway, update_existing.'
      });
    }

    if (targetDeckId && targetDeckName) {
      return res.status(400).json({
        message: 'Choose either an existing deck or a new deck name for this import, not both.'
      });
    }

    const existingCards = await Flashcard.find(buildAccessFilter(req.user)).populate({ path: 'deck', select: 'name' });
    const existingMap = new Map(
      existingCards.map((card) => [
        createDuplicateKey({
          wordOrPhrase: card.wordOrPhrase,
          translation: card.translation,
          language: card.language,
          deckName: card.deck?.name || card.category
        }),
        card
      ])
    );

    const summary = {
      totalRows: rows.length,
      insertedRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      updatedRows: 0,
      results: []
    };

    for (const [index, row] of rows.entries()) {
      const rowNumber = Number(row.rowNumber) || index + 1;
      const { payload, deckName, errors } = await buildImportPayload(row, req.user, {
        targetDeckId,
        targetDeckName
      });

      if (errors.length > 0) {
        summary.invalidRows += 1;
        summary.results.push({
          rowNumber,
          status: 'invalid',
          errors
        });
        continue;
      }

      const duplicateKey = createDuplicateKey({
        wordOrPhrase: payload.wordOrPhrase,
        translation: payload.translation,
        language: payload.language,
        deckName
      });
      const existingCard = existingMap.get(duplicateKey);

      if (existingCard) {
        summary.duplicateRows += 1;

        if (duplicateHandling === 'skip') {
          summary.results.push({
            rowNumber,
            status: 'duplicate_skipped',
            errors: ['Duplicate flashcard skipped.']
          });
          continue;
        }

        if (duplicateHandling === 'update_existing') {
          existingCard.wordOrPhrase = payload.wordOrPhrase;
          existingCard.translation = payload.translation;
          existingCard.deck = payload.deck;
          existingCard.language = payload.language;
          existingCard.category = payload.category;
          existingCard.tags = payload.tags;
          existingCard.proficiency = payload.proficiency;

          await existingCard.save();

          summary.updatedRows += 1;
          summary.results.push({
            rowNumber,
            status: 'updated',
            errors: []
          });
          continue;
        }
      }

      const flashcard = await Flashcard.create(payload);
      existingMap.set(duplicateKey, flashcard);

      summary.insertedRows += 1;
      summary.results.push({
        rowNumber,
        status: existingCard ? 'duplicate_imported' : 'inserted',
        errors: []
      });
    }

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Failed to import flashcards.', error: error.message });
  }
};

exports.removeDuplicateWords = async (req, res) => {
  try {
    const flashcards = await Flashcard.find(buildAccessFilter(req.user)).sort({ createdAt: 1, _id: 1 });
    const seenWords = new Set();
    const duplicateIds = [];

    flashcards.forEach((flashcard) => {
      const normalizedWord = normalizeText(flashcard.wordOrPhrase).toLowerCase();

      if (!normalizedWord) {
        return;
      }

      if (seenWords.has(normalizedWord)) {
        duplicateIds.push(flashcard._id);
      } else {
        seenWords.add(normalizedWord);
      }
    });

    if (duplicateIds.length === 0) {
      return res.status(200).json({
        message: 'No duplicate words were found.',
        removedCount: 0
      });
    }

    await Flashcard.deleteMany({ _id: { $in: duplicateIds } });

    res.status(200).json({
      message: 'Duplicate words removed successfully.',
      removedCount: duplicateIds.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove duplicate words.', error: error.message });
  }
};
