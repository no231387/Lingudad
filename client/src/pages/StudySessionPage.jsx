import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createStudySession,
  getDecks,
  getFlashcards,
  getLearningPresets,
  getTags,
  recordContentStudyFeedback,
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
  reviewedItemIds: [],
  againCount: 0,
  hardCount: 0,
  goodCount: 0,
  easyCount: 0
});

const CONTENT_FEEDBACK_RATINGS = new Set(['again', 'hard', 'good', 'easy']);

const buildTrustedAnchorPayload = (card) => {
  const trustedAnchor = card?.trustedAnchor;

  if (!trustedAnchor?.model || !trustedAnchor?.id) {
    return null;
  }

  if (trustedAnchor.model !== 'Vocabulary' && trustedAnchor.model !== 'Sentence') {
    return null;
  }

  return {
    model: trustedAnchor.model,
    id: trustedAnchor.id
  };
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedDeckId = searchParams.get('deck') || '';
  const hasAutoStartedDeck = useRef(false);
  const hasAutoStartedContent = useRef(false);
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
  }, [currentCard?._id, currentCard?.id]);

  const startStudySession = ({
    cards,
    title,
    description,
    deckId = null,
    presetId = '',
    shapingStrategy = 'rank_by_fit_then_light_mix',
    sessionSource = 'flashcard',
    sourceContentId = '',
    sourceContentTitle = '',
    sourceMetadata = {}
  }) => {
    const nextCards = cards.filter(Boolean);

    if (nextCards.length === 0) {
          alert(sessionSource === 'content' ? 'Your practice set has nothing ready for this content yet.' : 'No flashcards matched that study setup yet.');
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
      shapingStrategy,
      sessionSource,
      sourceContentId,
      sourceContentTitle,
      sourceMetadata
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
      const durationMs = Math.max(0, Date.now() - cardSeenAtRef.current);
      if (activeSessionMeta?.sessionSource !== 'content') {
        await reviewFlashcard(currentCard._id, rating, { durationMs });
      } else {
        const trustedAnchor = buildTrustedAnchorPayload(currentCard);

        if (CONTENT_FEEDBACK_RATINGS.has(rating) && trustedAnchor) {
          await recordContentStudyFeedback({
            eventType: 'rating',
            rating,
            durationMs,
            trustedAnchor
          });
        }
      }
      const nextQueueState = updateStudyQueue(activeCards, currentIndex, rating);
      startTransition(() => {
        setSessionStats((previous) => ({
          ...previous,
          reviewedItemIds: previous.reviewedItemIds.includes(currentCard._id || currentCard.id)
            ? previous.reviewedItemIds
            : [...previous.reviewedItemIds, currentCard._id || currentCard.id],
          againCount: previous.againCount + (rating === 'again' ? 1 : 0),
          hardCount: previous.hardCount + (rating === 'hard' ? 1 : 0),
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
    if (activeSessionMeta?.sessionSource !== 'content' && currentCard?._id) {
      recordFlashcardStudyFeedback(currentCard._id, {
        eventType: 'skip',
        durationMs: Math.max(0, Date.now() - cardSeenAtRef.current)
      }).catch((error) => {
        console.error('Failed to record skip feedback:', error);
      });
    } else if (activeSessionMeta?.sessionSource === 'content') {
      const trustedAnchor = buildTrustedAnchorPayload(currentCard);

      if (trustedAnchor) {
        recordContentStudyFeedback({
          eventType: 'skip',
          durationMs: Math.max(0, Date.now() - cardSeenAtRef.current),
          trustedAnchor
        }).catch((error) => {
          console.error('Failed to record content skip feedback:', error);
        });
      }
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
      if (activeCards.length !== 0 || sessionSaved || sessionStats.reviewedItemIds.length === 0) {
        return;
      }

      try {
        await createStudySession({
          flashcards: activeSessionMeta?.sessionSource === 'content' ? [] : sessionStats.reviewedItemIds,
          sessionItems: activeSessionMeta?.sessionSource === 'content' ? activeSessionMeta?.sourceMetadata?.sessionItems || [] : [],
          reviewedCount: sessionStats.reviewedItemIds.length,
          againCount: sessionStats.againCount,
          hardCount: sessionStats.hardCount,
          goodCount: sessionStats.goodCount,
          easyCount: sessionStats.easyCount,
          deck: activeSessionMeta?.deckId || null,
          presetId: activeSessionMeta?.presetId || null,
          shapingStrategy: activeSessionMeta?.shapingStrategy || '',
          sessionSource: activeSessionMeta?.sessionSource || 'flashcard',
          sourceContentId: activeSessionMeta?.sourceContentId || '',
          sourceContentTitle: activeSessionMeta?.sourceContentTitle || '',
          itemCount: activeSessionMeta?.sourceMetadata?.itemCount || activeSessionMeta?.sourceMetadata?.sessionItems?.length || 0,
          sourceMetadata: activeSessionMeta?.sourceMetadata || {},
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

  useEffect(() => {
    const contentSession = location.state?.contentSession;

    if (!contentSession || hasAutoStartedContent.current || activeSessionMeta) {
      return;
    }

    const sessionItems = Array.isArray(contentSession.items) ? contentSession.items : [];

    if (sessionItems.length === 0) {
      return;
    }

    hasAutoStartedContent.current = true;
    startStudySession({
      cards: sessionItems,
      title: contentSession.title || `${contentSession.content?.title || 'Content'} Study`,
      description: contentSession.description || 'Practice from saved lines and matches.',
      shapingStrategy: contentSession.shapingStrategy || 'content_pack_chronological',
      sessionSource: 'content',
      sourceContentId: contentSession.content?._id || '',
      sourceContentTitle: contentSession.content?.title || '',
      sourceMetadata: {
        content: contentSession.content || null,
        summary: contentSession.summary || {},
        itemCount: contentSession.itemCount || sessionItems.length,
        sessionItems
      }
    });
    navigate('/study', { replace: true });
  }, [activeSessionMeta, location.state, navigate]);

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
  const secondaryPresetRank = { learning: 0, new: 1, all: 2 };
  const orderedSecondaryPresets = useMemo(
    () =>
      [...secondaryPresets].sort((a, b) => (secondaryPresetRank[a.id] ?? 9) - (secondaryPresetRank[b.id] ?? 9)),
    [secondaryPresets]
  );
  const selectedLearningPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedStudyPresetId) || null,
    [presets, selectedStudyPresetId]
  );
  const isContentSession = activeSessionMeta?.sessionSource === 'content';
  const hasFlashcards = availableCards.length > 0;

  if (activeSessionMeta) {
    if (activeCards.length === 0) {
      return (
        <section className="page-section study-complete-layout">
          <PageIntro
            eyebrow="Study complete"
            title={activeSessionMeta.title}
            description={sessionSaved ? 'Nice work—this session is saved to your recent activity.' : 'Session complete.'}
          />

          <div className="stats-grid study-complete-stats">
            <article className="card stat-card">
              <h3>Reviewed</h3>
              <p className="stat-number">{sessionStats.reviewedItemIds.length}</p>
            </article>
            <article className="card stat-card">
              <h3>Again</h3>
              <p className="stat-number">{sessionStats.againCount}</p>
            </article>
            <article className="card stat-card">
              <h3>Hard</h3>
              <p className="stat-number">{sessionStats.hardCount}</p>
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

          <div className="action-row study-complete-actions">
            <button type="button" onClick={handleExitSession}>
              Back to Study
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
              {isContentSession ? (
                <>
                  <p className="study-card-meta">
                    <strong>Practice type:</strong> {String(currentCard.generationType || '').replaceAll('_', ' ')}
                  </p>
                  <p className="study-card-meta">
                    <strong>Clip:</strong> {Math.max(0, Number(currentCard.provenance?.startTimeSeconds || 0)).toFixed(0)}s-
                    {Math.max(0, Number(currentCard.provenance?.endTimeSeconds || 0)).toFixed(0)}s
                  </p>
                </>
              ) : (
                <p className="study-card-meta">
                  <strong>Proficiency:</strong> {currentCard.proficiency || 1}
                </p>
              )}
            </div>

            {showAnswer ? (
              <>
                {isContentSession ? (
                  <>
                    <p className="study-card-answer">
                      <strong>Answer:</strong> {currentCard.correctAnswer || currentCard.transcriptText || 'Replay this clip to verify.'}
                    </p>
                    <p className="study-card-meta">
                      <strong>Prompt:</strong> {currentCard.prompt}
                    </p>
                    {currentCard.transcriptText ? (
                      <p className="study-card-meta">
                        <strong>Line:</strong> {currentCard.transcriptText}
                      </p>
                    ) : null}
                    {currentCard.answers?.length > 1 ? (
                      <p className="study-card-meta">
                        <strong>Accepted answers:</strong> {currentCard.answers.join(', ')}
                      </p>
                    ) : null}
                    {currentCard.trustedAnchor ? (
                      <p className="study-card-meta">
                        <strong>Linked to:</strong>{' '}
                        {currentCard.trustedAnchor.model === 'Vocabulary'
                          ? currentCard.trustedAnchor.term
                          : currentCard.trustedAnchor.text}
                      </p>
                    ) : null}
                  </>
                ) : (
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
                  </>
                )}
                <div className="study-review-panel">
                  <p className="study-review-label">{isContentSession ? 'How did that feel?' : 'How did this review feel?'}</p>
                  <p className="muted-text study-review-hint">Again keeps this card in the session and brings it back soon.</p>
                  <div className="study-review-actions">
                    <button type="button" onClick={() => handleRating('again')} disabled={isSubmitting} className="danger-button">
                      Again
                    </button>
                    <button type="button" onClick={() => handleRating('hard')} disabled={isSubmitting} className="secondary-button">
                      Hard
                    </button>
                    <button type="button" onClick={() => handleRating('good')} disabled={isSubmitting}>
                      {isContentSession ? 'Good' : 'Good (+1 Proficiency)'}
                    </button>
                    <button type="button" onClick={() => handleRating('easy')} disabled={isSubmitting} className="easy-button">
                      {isContentSession ? 'Easy' : 'Easy (+2 Proficiency)'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="study-review-panel">
                <p className="study-review-label">Focus on the card first</p>
                <p className="muted-text study-review-hint">
                  {isContentSession
                    ? 'Listen, recall, then reveal the answer when you are ready.'
                    : 'Reveal the answer when you are ready to check recall.'}
                </p>
                <button type="button" onClick={() => setShowAnswer(true)} className="study-reveal-button">
                  {isContentSession ? 'Show answer' : 'Reveal Translation'}
                </button>
              </div>
            )}
          </div>

          <div className="study-footer-actions">
            <button type="button" onClick={nextCard} className="secondary-button">
              Skip
            </button>
          </div>
        </article>
      </section>
    );
  }

  if (!activeSessionMeta && !isLoadingSetup && !hasFlashcards) {
    return (
      <section className="page-section study-setup-page study-setup-page-empty">
        <PageIntro
          eyebrow="Study"
          title="Study sessions"
          description="You need flashcards before you can run a study session."
        />

        <div className="card elevated-panel step35-empty-guidance step4-study-primary-state">
          <h3>You don&apos;t have anything to study yet.</h3>
          <p className="muted-text">Start by learning from content and creating flashcards.</p>
          <div className="action-row step35-empty-actions">
            <Link to="/content" className="primary-button">
              Go to Content
            </Link>
            <Link to="/flashcards" className="secondary-button">
              Go to Flashcards
            </Link>
          </div>
        </div>

        <div className="card step35-muted-preview" aria-hidden="true">
          <p className="eyebrow-label">When you have cards</p>
          <p className="muted-text">
            Recommended sessions, decks, tags, and custom filters will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section study-setup-page">
      <PageIntro
        eyebrow="Study"
        title="Study sessions"
        description="Start with the suggested session below, or open a deck or tag. Custom filters stay tucked away until you need them."
      />

      {isLoadingSetup ? (
        <div className="card">
          <p className="muted-text">Loading study options...</p>
        </div>
      ) : (
        <>
          <div className="card elevated-panel study-primary-panel study-flow-anchor">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Recommended</p>
                <h3>Your next session</h3>
                <p className="muted-text">We pick a stack that fits how your cards are doing right now.</p>
              </div>
            </div>

            <div className="subsurface-panel study-guidance-panel">
              <label>
                Learning preset (optional)
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
                Nudges card order using your goals and review need
                {selectedLearningPreset ? ` (${selectedLearningPreset.name})` : ''}.
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
                <p className="muted-text">Ratings and skips refine what comes up next.</p>
              </div>
              <div className="study-start-meta">
                <p className="study-preset-count">{primaryPreset.cards.length} cards</p>
                <button type="button" onClick={() => launchStudySession(primaryPreset)} disabled={primaryPreset.cards.length === 0 || isPreparingSession}>
                  {isPreparingSession ? 'Preparing...' : 'Start session'}
                </button>
              </div>
            </div>

            <div className="study-secondary-actions">
              {orderedSecondaryPresets.map((preset) => (
                <article
                  key={preset.id}
                  className={`subsurface-panel study-secondary-card ${preset.id === 'learning' ? 'study-secondary-card-focus' : 'study-secondary-card-quiet'}`}
                >
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

          <div className="study-routes-grid">
            <div className="card study-secondary-panel study-route-panel-quiet">
              <div className="section-header">
                <div>
                  <p className="eyebrow-label">By deck</p>
                  <h3>Study a deck</h3>
                  <p className="muted-text">One deck, one session.</p>
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

            <div className="card study-secondary-panel study-route-panel-quiet">
              <div className="section-header">
                <div>
                  <p className="eyebrow-label">By tag</p>
                  <h3>Study a tag</h3>
                  <p className="muted-text">Narrow to cards with a given tag.</p>
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
          </div>

          <DisclosurePanel
            title="Custom session"
            description="Deck, tag, difficulty, and size—only when the options above are not enough."
            className="card study-builder-card study-secondary-panel study-custom-disclosure study-custom-quiet"
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
                  {isPreparingSession ? 'Preparing...' : 'Start with these filters'}
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
