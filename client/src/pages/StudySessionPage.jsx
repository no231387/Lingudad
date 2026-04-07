import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createStudySession, getDecks, getFlashcards, getTags, reviewFlashcard } from '../services/flashcardService';

const customSessionDefaults = {
  deckId: '',
  tagId: '',
  proficiencyMode: 'all',
  sessionSize: 'all',
  shuffle: true
};

const buildSessionStats = () => ({
  startedAt: new Date().toISOString(),
  reviewedFlashcards: [],
  againCount: 0,
  goodCount: 0,
  easyCount: 0
});

const shuffleCards = (cards) => {
  const nextCards = [...cards];

  for (let index = nextCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextCards[index], nextCards[swapIndex]] = [nextCards[swapIndex], nextCards[index]];
  }

  return nextCards;
};

const applyProficiencyFilter = (cards, proficiencyMode) => {
  if (proficiencyMode === 'new') {
    return cards.filter((card) => card.proficiency === 1);
  }

  if (proficiencyMode === 'learning') {
    return cards.filter((card) => card.proficiency <= 2);
  }

  if (proficiencyMode === 'strong') {
    return cards.filter((card) => card.proficiency >= 3);
  }

  return cards;
};

function StudySessionPage() {
  const [searchParams] = useSearchParams();
  const selectedDeckId = searchParams.get('deck') || '';
  const hasAutoStartedDeck = useRef(false);
  const [availableCards, setAvailableCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState(buildSessionStats);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [activeSessionMeta, setActiveSessionMeta] = useState(null);
  const [customSession, setCustomSession] = useState(() => ({
    ...customSessionDefaults,
    deckId: selectedDeckId
  }));

  useEffect(() => {
    const loadStudySetup = async () => {
      try {
        setIsLoadingSetup(true);
        const [{ data: flashcardData }, { data: deckData }, { data: tagData }] = await Promise.all([
          getFlashcards(),
          getDecks(),
          getTags()
        ]);

        setAvailableCards(flashcardData);
        setDecks(deckData);
        setTags(tagData);
      } catch (error) {
        console.error('Failed to load study setup:', error);
      } finally {
        setIsLoadingSetup(false);
      }
    };

    loadStudySetup();
  }, []);

  const deckPresets = useMemo(
    () =>
      decks
        .map((deck) => ({
          ...deck,
          count: availableCards.filter((card) => String(card.deck?._id || card.deck) === String(deck._id)).length
        }))
        .filter((deck) => deck.count > 0)
        .sort((left, right) => right.count - left.count),
    [availableCards, decks]
  );

  const tagPresets = useMemo(
    () =>
      tags
        .map((tag) => ({
          ...tag,
          count: availableCards.filter((card) => card.tags?.some((cardTag) => String(cardTag._id || cardTag) === String(tag._id))).length
        }))
        .filter((tag) => tag.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 6),
    [availableCards, tags]
  );

  const currentCard = useMemo(() => activeCards[currentIndex], [activeCards, currentIndex]);

  const startStudySession = ({ cards, title, description, deckId = null }) => {
    const nextCards = cards.filter(Boolean);

    if (nextCards.length === 0) {
      alert('No flashcards matched that study setup yet.');
      return;
    }

    setActiveCards(nextCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionSaved(false);
    setSessionStats(buildSessionStats());
    setActiveSessionMeta({
      title,
      description,
      deckId
    });
  };

  const launchPreset = (preset) => {
    startStudySession(preset);
  };

  const buildCustomSessionCards = () => {
    let nextCards = [...availableCards];

    if (customSession.deckId) {
      nextCards = nextCards.filter((card) => String(card.deck?._id || card.deck) === String(customSession.deckId));
    }

    if (customSession.tagId) {
      nextCards = nextCards.filter((card) => card.tags?.some((tag) => String(tag._id || tag) === String(customSession.tagId)));
    }

    nextCards = applyProficiencyFilter(nextCards, customSession.proficiencyMode);

    if (customSession.shuffle) {
      nextCards = shuffleCards(nextCards);
    }

    if (customSession.sessionSize !== 'all') {
      nextCards = nextCards.slice(0, Number(customSession.sessionSize));
    }

    return nextCards;
  };

  const handleCustomChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCustomSession((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleStartCustomSession = () => {
    const selectedDeck = decks.find((deck) => String(deck._id) === String(customSession.deckId));
    const selectedTag = tags.find((tag) => String(tag._id) === String(customSession.tagId));
    const customCards = buildCustomSessionCards();

    const titleParts = ['Custom Study'];

    if (selectedDeck) {
      titleParts.push(selectedDeck.name);
    }

    if (selectedTag) {
      titleParts.push(`#${selectedTag.name}`);
    }

    startStudySession({
      cards: customCards,
      title: titleParts.join(' • '),
      description: 'A study session built from your current filters.',
      deckId: selectedDeck?._id || null
    });
  };

  const handleRating = async (rating) => {
    if (!currentCard || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await reviewFlashcard(currentCard._id, rating);
      setSessionStats((previous) => ({
        ...previous,
        reviewedFlashcards: previous.reviewedFlashcards.includes(currentCard._id)
          ? previous.reviewedFlashcards
          : [...previous.reviewedFlashcards, currentCard._id],
        againCount: previous.againCount + (rating === 'again' ? 1 : 0),
        goodCount: previous.goodCount + (rating === 'good' ? 1 : 0),
        easyCount: previous.easyCount + (rating === 'easy' ? 1 : 0)
      }));

      const remainingCount = activeCards.length - 1;
      setActiveCards((previous) => previous.filter((card) => card._id !== currentCard._id));
      setCurrentIndex((previous) => {
        if (remainingCount <= 0) return 0;
        return previous >= remainingCount ? 0 : previous;
      });
      setShowAnswer(false);
    } catch (error) {
      console.error('Failed to review flashcard:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentIndex((previous) => (activeCards.length === 0 ? 0 : (previous + 1) % activeCards.length));
  };

  const handleExitSession = () => {
    setActiveCards([]);
    setCurrentIndex(0);
    setShowAnswer(false);
    setActiveSessionMeta(null);
    setSessionSaved(false);
    setSessionStats(buildSessionStats());
  };

  useEffect(() => {
    const saveCompletedSession = async () => {
      if (activeCards.length !== 0 || sessionSaved || sessionStats.reviewedFlashcards.length === 0) {
        return;
      }

      try {
        await createStudySession({
          flashcards: sessionStats.reviewedFlashcards,
          reviewedCount: sessionStats.reviewedFlashcards.length,
          againCount: sessionStats.againCount,
          goodCount: sessionStats.goodCount,
          easyCount: sessionStats.easyCount,
          deck: activeSessionMeta?.deckId || null,
          startedAt: sessionStats.startedAt,
          completedAt: new Date().toISOString()
        });
        setSessionSaved(true);
      } catch (error) {
        console.error('Failed to save study session:', error);
      }
    };

    saveCompletedSession();
  }, [activeCards.length, activeSessionMeta, sessionSaved, sessionStats]);

  useEffect(() => {
    if (isLoadingSetup || !selectedDeckId || hasAutoStartedDeck.current || availableCards.length === 0) {
      return;
    }

    const selectedDeck = decks.find((deck) => String(deck._id) === String(selectedDeckId));
    const deckCards = availableCards.filter((card) => String(card.deck?._id || card.deck) === String(selectedDeckId));

    if (deckCards.length > 0) {
      hasAutoStartedDeck.current = true;
      startStudySession({
        cards: deckCards,
        title: selectedDeck ? `${selectedDeck.name} Study` : 'Deck Study',
        description: 'A deck-based study session launched from your decks page.',
        deckId: selectedDeckId
      });
    }
  }, [availableCards, decks, isLoadingSetup, selectedDeckId]);

  const presetSessions = useMemo(
    () => [
      {
        id: 'all',
        title: 'All Flashcards',
        description: 'Study everything currently available in your collection.',
        cards: availableCards
      },
      {
        id: 'new',
        title: 'New Cards',
        description: 'Focus on flashcards that are still brand new.',
        cards: availableCards.filter((card) => card.proficiency === 1)
      },
      {
        id: 'learning',
        title: 'Needs Practice',
        description: 'Review cards that still need repetition.',
        cards: availableCards.filter((card) => card.proficiency <= 2)
      }
    ],
    [availableCards]
  );

  if (activeSessionMeta) {
    if (activeCards.length === 0) {
      return (
        <section className="page-section">
          <div className="card hero-card study-setup-hero">
            <div>
              <h2>{activeSessionMeta.title}</h2>
              <p>{sessionSaved ? 'Your study session is complete and has been saved.' : 'Session complete.'}</p>
            </div>
          </div>

          <div className="stats-grid">
            <article className="card stat-card">
              <h3>Reviewed</h3>
              <p className="stat-number">{sessionStats.reviewedFlashcards.length}</p>
            </article>
            <article className="card stat-card">
              <h3>Again</h3>
              <p className="stat-number">{sessionStats.againCount}</p>
            </article>
            <article className="card stat-card">
              <h3>Good</h3>
              <p className="stat-number">{sessionStats.goodCount}</p>
            </article>
            <article className="card stat-card">
              <h3>Easy</h3>
              <p className="stat-number">{sessionStats.easyCount}</p>
            </article>
          </div>

          <div className="action-row">
            <button type="button" onClick={handleExitSession}>
              Back to Study Setup
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="page-section">
        <div className="card hero-card study-setup-hero">
          <div>
            <h2>{activeSessionMeta.title}</h2>
            <p>{activeSessionMeta.description}</p>
          </div>
          <div className="study-session-progress">
            <span className="mapped-column-tag">{activeCards.length} cards left</span>
            <button type="button" onClick={handleExitSession} className="secondary-button">
              Exit Session
            </button>
          </div>
        </div>

        <article className="card study-card study-card-large">
          <div className="study-card-content">
            <h3>{currentCard.wordOrPhrase}</h3>
            <p className="study-card-meta">
              <strong>Language:</strong> {currentCard.language}
            </p>

            {showAnswer ? (
              <>
                <p className="study-card-answer">
                  <strong>Translation:</strong> {currentCard.translation}
                </p>
                {currentCard.exampleSentence && (
                  <p className="study-card-meta">
                    <strong>Example:</strong> {currentCard.exampleSentence}
                  </p>
                )}
                {currentCard.tags?.length > 0 && (
                  <p className="study-card-meta">
                    <strong>Tags:</strong> {currentCard.tags.map((tag) => tag.name).join(', ')}
                  </p>
                )}
                <div className="rating-row">
                  <p>How did this review feel?</p>
                  <button type="button" onClick={() => handleRating('again')} disabled={isSubmitting} className="danger-button">
                    Again
                  </button>
                  <button type="button" onClick={() => handleRating('good')} disabled={isSubmitting}>
                    Good (+1 Proficiency)
                  </button>
                  <button type="button" onClick={() => handleRating('easy')} disabled={isSubmitting} className="easy-button">
                    Easy (+2 Proficiency)
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setShowAnswer(true)}>
                Reveal Translation
              </button>
            )}
          </div>
        </article>

        <div className="study-footer-actions">
          <button type="button" onClick={nextCard} className="secondary-button">
            Skip Card
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="card hero-card study-setup-hero">
        <div>
          <h2>Study</h2>
          <p>Choose a ready-made session or build your own study run from decks, tags, and progress level.</p>
        </div>
      </div>

      {isLoadingSetup ? (
        <div className="card">
          <p className="muted-text">Loading study options...</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="section-header">
              <div>
                <h3>Quick Start</h3>
                <p className="muted-text">Jump into a premade study session based on your collection.</p>
              </div>
            </div>
            <div className="list-grid study-preset-grid">
              {presetSessions.map((preset) => (
                <article key={preset.id} className="card study-preset-card">
                  <h4>{preset.title}</h4>
                  <p className="muted-text">{preset.description}</p>
                  <p className="study-preset-count">{preset.cards.length} cards</p>
                  <button type="button" onClick={() => launchPreset(preset)} disabled={preset.cards.length === 0}>
                    Start Session
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h3>Study by Deck</h3>
                <p className="muted-text">Use your saved decks as one-click study sessions.</p>
              </div>
            </div>
            <div className="list-grid study-preset-grid">
              {deckPresets.length === 0 ? (
                <p className="muted-text">No decks with flashcards yet.</p>
              ) : (
                deckPresets.map((deck) => (
                  <article key={deck._id} className="card study-preset-card">
                    <h4>{deck.name}</h4>
                    <p className="muted-text">{deck.description || `${deck.language || 'Language not set'} deck ready to study.`}</p>
                    <p className="study-preset-count">{deck.count} cards</p>
                    <button
                      type="button"
                      onClick={() =>
                        launchPreset({
                          title: `${deck.name} Study`,
                          description: 'A premade study session based on this deck.',
                          cards: availableCards.filter((card) => String(card.deck?._id || card.deck) === String(deck._id)),
                          deckId: deck._id
                        })
                      }
                    >
                      Study Deck
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h3>Study by Tag</h3>
                <p className="muted-text">Start fast with the tags you use most.</p>
              </div>
            </div>
            <div className="list-grid study-preset-grid">
              {tagPresets.length === 0 ? (
                <p className="muted-text">No tags with flashcards yet.</p>
              ) : (
                tagPresets.map((tag) => (
                  <article key={tag._id} className="card study-preset-card">
                    <h4>#{tag.name}</h4>
                    <p className="muted-text">A focused session built from this tag.</p>
                    <p className="study-preset-count">{tag.count} cards</p>
                    <button
                      type="button"
                      onClick={() =>
                        launchPreset({
                          title: `Tag Study • #${tag.name}`,
                          description: 'A premade study session based on a flashcard tag.',
                          cards: availableCards.filter((card) => card.tags?.some((cardTag) => String(cardTag._id || cardTag) === String(tag._id)))
                        })
                      }
                    >
                      Study Tag
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>

          <form
            className="card form-card study-builder-card"
            onSubmit={(event) => {
              event.preventDefault();
              handleStartCustomSession();
            }}
          >
            <div className="section-header">
              <div>
                <h3>Build Your Own Session</h3>
                <p className="muted-text">Mix filters together and create a study run that fits what you want to review.</p>
              </div>
            </div>

            <div className="filter-grid">
              <label>
                Deck
                <select name="deckId" value={customSession.deckId} onChange={handleCustomChange}>
                  <option value="">Any deck</option>
                  {decks.map((deck) => (
                    <option key={deck._id} value={deck._id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tag
                <select name="tagId" value={customSession.tagId} onChange={handleCustomChange}>
                  <option value="">Any tag</option>
                  {tags.map((tag) => (
                    <option key={tag._id} value={tag._id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Focus
                <select name="proficiencyMode" value={customSession.proficiencyMode} onChange={handleCustomChange}>
                  <option value="all">All levels</option>
                  <option value="new">New cards only</option>
                  <option value="learning">Needs practice</option>
                  <option value="strong">Strong cards only</option>
                </select>
              </label>

              <label>
                Session Size
                <select name="sessionSize" value={customSession.sessionSize} onChange={handleCustomChange}>
                  <option value="all">All matching cards</option>
                  <option value="10">10 cards</option>
                  <option value="20">20 cards</option>
                  <option value="30">30 cards</option>
                </select>
              </label>
            </div>

            <label className="selection-row study-builder-toggle">
              <input type="checkbox" name="shuffle" checked={customSession.shuffle} onChange={handleCustomChange} />
              <span>Shuffle cards before starting</span>
            </label>

            <div className="action-row">
              <button type="submit">Start Custom Session</button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

export default StudySessionPage;
