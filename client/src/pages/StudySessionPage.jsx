import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createStudySession,
  getDecks,
  getFlashcards,
  getLearningPresets,
  getTags,
  recordFlashcardStudyFeedback,
  reviewFlashcard,
  shapeStudySessionFlashcards
} from '../services/flashcardService';
import DisclosurePanel from '../components/DisclosurePanel';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../context/AuthContext';
import { updateStudyQueue } from '../utils/studySession';

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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedDeckId = searchParams.get('deck') || '';
  const hasAutoStartedDeck = useRef(false);
  const cardSeenAtRef = useRef(Date.now());
  const [availableCards, setAvailableCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [presets, setPresets] = useState([]);
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState(buildSessionStats);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [activeSessionMeta, setActiveSessionMeta] = useState(null);
  const [selectedStudyPresetId, setSelectedStudyPresetId] = useState('');
  const [customSession, setCustomSession] = useState(() => ({
    ...customSessionDefaults,
    deckId: selectedDeckId
  }));

  useEffect(() => {
    const loadStudySetup = async () => {
      try {
        setIsLoadingSetup(true);
        const [{ data: flashcardData }, { data: deckData }, { data: tagData }, { data: presetData }] = await Promise.all([
          getFlashcards(),
          getDecks(),
          getTags(),
          getLearningPresets({
            language: user?.language || 'Japanese'
          })
        ]);

        startTransition(() => {
          setAvailableCards(flashcardData);
          setDecks(deckData);
          setTags(tagData);
          setPresets(presetData.items || []);
          setSelectedStudyPresetId((current) => current || '');
        });
      } catch (error) {
        console.error('Failed to load study setup:', error);
      } finally {
        setIsLoadingSetup(false);
      }
    };

    loadStudySetup();
  }, [user?.language]);

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

  useEffect(() => {
    cardSeenAtRef.current = Date.now();
  }, [currentCard?._id]);

  const startStudySession = ({ cards, title, description, deckId = null, presetId = '', shapingStrategy = 'rank_by_fit_then_light_mix' }) => {
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
      deckId,
      presetId,
      shapingStrategy
    });
  };

  const shapeSessionCards = async ({ cards, presetId = '' }) => {
    if (!cards.length) {
      return [];
    }

    try {
      const { data } = await shapeStudySessionFlashcards({
        flashcardIds: cards.map((card) => card._id),
        presetId
      });

      return data.items || cards;
    } catch (error) {
      console.error('Failed to shape study session:', error);
      return cards;
    }
  };

  const launchStudySession = async ({ cards, title, description, deckId = null }) => {
    const nextCards = cards.filter(Boolean);

    if (nextCards.length === 0) {
      alert('No flashcards matched that study setup yet.');
      return;
    }

    try {
      setIsPreparingSession(true);
      const shapedCards = await shapeSessionCards({
        cards: nextCards,
        presetId: selectedStudyPresetId
        ,
        shapingStrategy: 'rank_by_fit_then_light_mix'
      });

      startStudySession({
        cards: shapedCards,
        title,
        description: selectedStudyPresetId
          ? `${description} Guided by your goals and selected preset.`
          : `${description} Guided by your goals and review needs.`,
        deckId,
        presetId: selectedStudyPresetId
      });
    } finally {
      setIsPreparingSession(false);
    }
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

    if (customSession.sessionSize !== 'all') {
      nextCards = nextCards.slice(0, Number(customSession.sessionSize));
    }

    if (customSession.shuffle) {
      nextCards = shuffleCards(nextCards);
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

  const handleStartCustomSession = async () => {
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

    await launchStudySession({
      cards: customCards,
      title: titleParts.join(' / '),
      description: 'Built from your current filters.',
      deckId: selectedDeck?._id || null
    });
  };

  const handleRating = async (rating) => {
    if (!currentCard || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await reviewFlashcard(currentCard._id, rating, {
        durationMs: Math.max(0, Date.now() - cardSeenAtRef.current)
      });
      const nextQueueState = updateStudyQueue(activeCards, currentIndex, rating);
      startTransition(() => {
        setSessionStats((previous) => ({
          ...previous,
          reviewedFlashcards: previous.reviewedFlashcards.includes(currentCard._id)
            ? previous.reviewedFlashcards
            : [...previous.reviewedFlashcards, currentCard._id],
          againCount: previous.againCount + (rating === 'again' ? 1 : 0),
          goodCount: previous.goodCount + (rating === 'good' ? 1 : 0),
          easyCount: previous.easyCount + (rating === 'easy' ? 1 : 0)
        }));
        setActiveCards(nextQueueState.cards);
        setCurrentIndex(nextQueueState.nextIndex);
        setShowAnswer(false);
      });
    } catch (error) {
      console.error('Failed to review flashcard:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextCard = () => {
    if (currentCard?._id) {
      recordFlashcardStudyFeedback(currentCard._id, {
        eventType: 'skip',
        durationMs: Math.max(0, Date.now() - cardSeenAtRef.current)
      }).catch((error) => {
        console.error('Failed to record skip feedback:', error);
      });
    }

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
          presetId: activeSessionMeta?.presetId || null,
          shapingStrategy: activeSessionMeta?.shapingStrategy || '',
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
      launchStudySession({
        cards: deckCards,
        title: selectedDeck ? `${selectedDeck.name} Study` : 'Deck Study',
        description: 'A deck-based session launched from your decks page.',
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
  const primaryPreset =
    presetSessions.find((preset) => preset.id === 'learning' && preset.cards.length > 0) ||
    presetSessions.find((preset) => preset.id === 'new' && preset.cards.length > 0) ||
    presetSessions.find((preset) => preset.cards.length > 0) ||
    presetSessions[0];
  const secondaryPresets = presetSessions.filter((preset) => preset.id !== primaryPreset?.id);
  const selectedLearningPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedStudyPresetId) || null,
    [presets, selectedStudyPresetId]
  );

  if (activeSessionMeta) {
    if (activeCards.length === 0) {
      return (
        <section className="page-section">
          <PageIntro
            eyebrow="Study complete"
            title={activeSessionMeta.title}
            description={sessionSaved ? 'Your session is complete and has been saved to recent activity.' : 'Session complete.'}
          />

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
      <section className="page-section active-study-layout">
        <div className="card study-session-banner">
          <div className="study-session-banner-copy">
            <p className="eyebrow-label">Active study session</p>
            <h2>{activeSessionMeta.title}</h2>
            <p className="muted-text">{activeSessionMeta.description}</p>
          </div>
          <div className="study-session-progress">
            <span className="mapped-column-tag">{activeCards.length} in queue</span>
            <button type="button" onClick={handleExitSession} className="secondary-button">
              Exit session
            </button>
          </div>
        </div>

        <article className="card study-card study-card-large study-session-card">
          <div className="study-card-content">
            <h3>{currentCard.wordOrPhrase}</h3>
            <div className="study-card-facts">
              <p className="study-card-meta">
                <strong>Language:</strong> {currentCard.language}
              </p>
              <p className="study-card-meta">
                <strong>Proficiency:</strong> {currentCard.proficiency || 1}
              </p>
            </div>

            {showAnswer ? (
              <>
                <p className="study-card-answer">
                  <strong>Translation:</strong> {currentCard.translation}
                </p>
                {currentCard.exampleSentence ? (
                  <p className="study-card-meta">
                    <strong>Example:</strong> {currentCard.exampleSentence}
                  </p>
                ) : null}
                {currentCard.tags?.length > 0 ? (
                  <p className="study-card-meta">
                    <strong>Tags:</strong> {currentCard.tags.map((tag) => tag.name).join(', ')}
                  </p>
                ) : null}
                <div className="study-review-panel">
                  <p className="study-review-label">How did this review feel?</p>
                  <p className="muted-text study-review-hint">Again keeps this card in the session and brings it back soon.</p>
                  <div className="study-review-actions">
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
                </div>
              </>
            ) : (
              <div className="study-review-panel">
                <p className="study-review-label">Focus on the card first</p>
                <p className="muted-text study-review-hint">Reveal the answer when you are ready to check recall.</p>
                <button type="button" onClick={() => setShowAnswer(true)} className="study-reveal-button">
                  Reveal Translation
                </button>
              </div>
            )}
          </div>

          <div className="study-footer-actions">
            <button type="button" onClick={nextCard} className="secondary-button">
              Skip Card
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="page-section">
      <PageIntro eyebrow="Study" title="Study" description="Start with one clear session option, then use decks, tags, or filters when you need them." />

      {isLoadingSetup ? (
        <div className="card">
          <p className="muted-text">Loading study options...</p>
        </div>
      ) : (
        <>
          <div className="card elevated-panel study-primary-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Start</p>
                <h3>Start here</h3>
                <p className="muted-text">Lead with the strongest next session instead of making every option compete equally.</p>
              </div>
            </div>

            <div className="subsurface-panel study-guidance-panel">
              <label>
                Study preset
                <select value={selectedStudyPresetId} onChange={(event) => setSelectedStudyPresetId(event.target.value)}>
                  <option value="">No preset guidance</option>
                  {!presets.length ? <option value="">No presets available</option> : null}
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted-text">
                Guided by your goals, review need, and {selectedLearningPreset ? `${selectedLearningPreset.name.toLowerCase()}` : 'your selected preset'}.
              </p>
            </div>

            <div className="study-start-hero">
              <div className="study-start-copy">
                <h4>{primaryPreset.title}</h4>
                <p className="muted-text">
                  {primaryPreset.id === 'learning'
                    ? 'Items with weaker performance, lower proficiency, and higher review need are pulled forward first.'
                    : primaryPreset.description}
                </p>
                <p className="muted-text">Study adapts over time from your ratings, skips, and review history.</p>
              </div>
              <div className="study-start-meta">
                <p className="study-preset-count">{primaryPreset.cards.length} cards</p>
                <button type="button" onClick={() => launchStudySession(primaryPreset)} disabled={primaryPreset.cards.length === 0 || isPreparingSession}>
                  {isPreparingSession ? 'Preparing...' : 'Start Session'}
                </button>
              </div>
            </div>

            <div className="study-secondary-actions">
              {secondaryPresets.map((preset) => (
                <article key={preset.id} className="subsurface-panel study-secondary-card">
                  <div className="section-stack-tight">
                    <h4>{preset.title}</h4>
                    <p className="muted-text">{preset.description}</p>
                  </div>
                  <div className="study-secondary-card-footer">
                    <span className="mapped-column-tag">{preset.cards.length} cards</span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => launchStudySession(preset)}
                      disabled={preset.cards.length === 0 || isPreparingSession}
                    >
                      Start
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="card study-secondary-panel">
            <div className="section-header">
              <div>
                <h3>Continue by deck</h3>
                <p className="muted-text">Use saved decks as lightweight one-click session starters.</p>
              </div>
            </div>
            <div className="list-grid study-preset-grid">
              {deckPresets.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No decks ready yet</h4>
                  <p className="muted-text">Add flashcards to a deck first, then you can launch one-click deck sessions here.</p>
                </div>
              ) : (
                deckPresets.map((deck) => (
                  <article key={deck._id} className="card study-preset-card">
                    <h4>{deck.name}</h4>
                    <p className="muted-text">{deck.description || `${deck.language || 'Language not set'} deck ready to study.`}</p>
                    <p className="study-preset-count">{deck.count} cards</p>
                    <button
                      type="button"
                      onClick={() =>
                        launchStudySession({
                          title: `${deck.name} Study`,
                          description: 'A preset session for this deck.',
                          cards: availableCards.filter((card) => String(card.deck?._id || card.deck) === String(deck._id)),
                          deckId: deck._id
                        })
                      }
                      disabled={isPreparingSession}
                    >
                      {isPreparingSession ? 'Preparing...' : 'Study Deck'}
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="card study-secondary-panel">
            <div className="section-header">
              <div>
                <h3>Continue by tag</h3>
                <p className="muted-text">Use the tags you rely on most when you want a narrower session.</p>
              </div>
            </div>
            <div className="list-grid study-preset-grid">
              {tagPresets.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No tags ready yet</h4>
                  <p className="muted-text">Once your flashcards include tags, you can start tag-based sessions here.</p>
                </div>
              ) : (
                tagPresets.map((tag) => (
                  <article key={tag._id} className="card study-preset-card">
                    <h4>#{tag.name}</h4>
                    <p className="muted-text">A focused session built from this tag.</p>
                    <p className="study-preset-count">{tag.count} cards</p>
                    <button
                      type="button"
                      onClick={() =>
                        launchStudySession({
                          title: `Tag Study / #${tag.name}`,
                          description: 'A preset session for this tag.',
                          cards: availableCards.filter((card) => card.tags?.some((cardTag) => String(cardTag._id || cardTag) === String(tag._id)))
                        })
                      }
                      disabled={isPreparingSession}
                    >
                      {isPreparingSession ? 'Preparing...' : 'Study Tag'}
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>

          <DisclosurePanel
            title="Custom session"
            description="Use extra filters only when the guided starts above are not enough."
            className="card study-builder-card study-secondary-panel"
          >
            <form
              className="form-card form-shell"
              onSubmit={(event) => {
                event.preventDefault();
                handleStartCustomSession();
              }}
            >
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
                <button type="submit" disabled={isPreparingSession}>
                  {isPreparingSession ? 'Preparing...' : 'Start Custom Session'}
                </button>
              </div>
            </form>
          </DisclosurePanel>
        </>
      )}
    </section>
  );
}

export default StudySessionPage;
