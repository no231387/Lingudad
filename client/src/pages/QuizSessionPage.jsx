import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import {
  completeQuizSession,
  getPlayableQuizItems,
  getQuizSession,
  getRecentQuizSessions,
  launchQuizSession,
  submitQuizAnswer
} from '../services/flashcardService';

const QUIZ_TYPE_COPY = Object.freeze({
  meaning_recall: {
    title: 'Meaning recall',
    shortLabel: 'Meaning',
    promptLabel: 'Meaning prompt'
  },
  cloze: {
    title: 'Fill in the blank',
    shortLabel: 'Cloze',
    promptLabel: 'Sentence prompt'
  }
});

const getQuizTypeCopy = (quizType, fallbackLabel = '') =>
  QUIZ_TYPE_COPY[quizType] || {
    title: fallbackLabel || quizType || 'Quiz',
    shortLabel: fallbackLabel || quizType || 'Quiz',
    promptLabel: 'Prompt'
  };

const parseQuizItemIds = (searchParams) => {
  const directId = String(searchParams.get('quizItemId') || '').trim();
  const list = String(searchParams.get('quizItemIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([directId, ...list].filter(Boolean))];
};

const findNextUnansweredIndex = (items, startIndex = -1) => {
  if (!Array.isArray(items) || items.length === 0) {
    return -1;
  }

  for (let index = startIndex + 1; index < items.length; index += 1) {
    if (!items[index]?.result) {
      return index;
    }
  }

  return -1;
};

function QuizSessionPage() {
  const autoLaunchAttempted = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [message, setMessage] = useState('');
  const [playableItems, setPlayableItems] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [selectedQuizItemIds, setSelectedQuizItemIds] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingHub, setIsLoadingHub] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemStartedAt, setItemStartedAt] = useState(Date.now());

  const sessionId = String(searchParams.get('sessionId') || '').trim();
  const requestedQuizItemIds = useMemo(() => parseQuizItemIds(searchParams), [searchParams]);
  const sourceMode = String(searchParams.get('sourceMode') || '').trim();
  const isFromPractice = sourceMode === 'from_practice';
  const practiceContentId = String(searchParams.get('contentId') || '').trim();
  const practiceContentTitle = useMemo(() => {
    const raw = searchParams.get('contentTitle');
    return raw ? String(raw) : '';
  }, [searchParams]);

  const refreshHub = async ({ requestedIdsOverride } = {}) => {
    try {
      setIsLoadingHub(true);
      const fromPractice = searchParams.get('sourceMode') === 'from_practice';
      const contentIdForItems = String(searchParams.get('contentId') || '').trim();
      const itemParams =
        fromPractice && contentIdForItems ? { limit: 12, learningContentId: contentIdForItems } : { limit: 12 };
      const [{ data: itemData }, { data: sessionData }] = await Promise.all([
        getPlayableQuizItems(itemParams),
        getRecentQuizSessions({ limit: 8 })
      ]);
      const effectiveRequestedIds = Array.isArray(requestedIdsOverride) ? requestedIdsOverride : requestedQuizItemIds;
      setPlayableItems(itemData.items || []);
      setRecentSessions(sessionData.items || []);
      setSelectedQuizItemIds((current) => {
        if (effectiveRequestedIds.length > 0) {
          return effectiveRequestedIds;
        }

        return current.filter((id) => (itemData.items || []).some((item) => item.id === id));
      });
    } catch (error) {
      console.error('Failed to load quiz hub:', error);
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not load quiz data.');
    } finally {
      setIsLoadingHub(false);
    }
  };

  useEffect(() => {
    refreshHub();
  }, []);

  useEffect(() => {
    if (requestedQuizItemIds.length > 0) {
      autoLaunchAttempted.current = false;
      setSelectedQuizItemIds(requestedQuizItemIds);
    }
  }, [requestedQuizItemIds]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const loadSession = async () => {
      try {
        setIsLoadingSession(true);
        const { data } = await getQuizSession(sessionId);
        setSession(data);
        const nextIndex = findNextUnansweredIndex(data.items);
        setCurrentIndex(nextIndex >= 0 ? nextIndex : Math.max(0, data.items.length - 1));
        setFeedback(nextIndex >= 0 ? null : data.items[data.items.length - 1]?.result || null);
        setMessage('');
      } catch (error) {
        console.error('Failed to load quiz session:', error);
        setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not load this quiz session.');
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId && requestedQuizItemIds.length > 0 && !session && !isStarting && !autoLaunchAttempted.current) {
      autoLaunchAttempted.current = true;
      handleStartQuiz({ quizItemIds: requestedQuizItemIds, autoStart: true });
    }
  }, [isStarting, requestedQuizItemIds, session, sessionId]);

  useEffect(() => {
    setItemStartedAt(Date.now());
    setAnswer('');
  }, [currentIndex, session?.id]);

  const items = session?.items || [];
  const currentItem = items[currentIndex] || null;
  const isFinished = Boolean(session?.completedAt);
  const selectedPlayableItems = playableItems.filter((item) => selectedQuizItemIds.includes(item.id));
  const hasHub = !session;

  async function handleStartQuiz({ quizItemIds = [], autoStart = false } = {}) {
    try {
      const cleanedIds = [...new Set((Array.isArray(quizItemIds) ? quizItemIds : []).filter(Boolean))];
      setIsStarting(true);
      setMessage('');
      setFeedback(null);
      const { data } = await launchQuizSession({
        quizItemIds: cleanedIds,
        limit: cleanedIds.length > 0 ? cleanedIds.length : 6
      });
      setSession(data);
      setCurrentIndex(0);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sessionId', data.id);
        return next;
      });
      if (!autoStart) {
        setMessage('Quiz session ready.');
      }
      await refreshHub();
    } catch (error) {
      console.error('Failed to launch quiz session:', error);
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not launch a quiz session.');
    } finally {
      setIsStarting(false);
    }
  }

  const handleSubmit = async (eventType = 'answer') => {
    if (!session || !currentItem) {
      return;
    }

    if (eventType === 'answer' && !answer.trim()) {
      setMessage('Enter an answer before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const responseMs = Math.max(0, Date.now() - itemStartedAt);
      const { data } = await submitQuizAnswer(session.id, {
        quizItemId: currentItem.id,
        answer,
        eventType,
        responseMs
      });
      setSession(data.session);
      setFeedback(data.result);
      setAnswer('');
    } catch (error) {
      console.error('Failed to submit quiz answer:', error);
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not submit that answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!session) {
      return;
    }

    const nextIndex = findNextUnansweredIndex(session.items, currentIndex);

    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
      setFeedback(null);
      return;
    }

    try {
      setIsCompleting(true);
      const { data } = await completeQuizSession(session.id);
      setSession(data);
      setFeedback(null);
      await refreshHub();
    } catch (error) {
      console.error('Failed to complete quiz session:', error);
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not finish this quiz.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleToggleSeed = (quizItemId) => {
    setSelectedQuizItemIds((current) =>
      current.includes(quizItemId) ? current.filter((id) => id !== quizItemId) : [...current, quizItemId]
    );
  };

  const handleOpenSession = async (targetSessionId) => {
    setSearchParams({ sessionId: targetSessionId });
    setFeedback(null);
    setMessage('');
  };

  const handleReturnToHub = async () => {
    autoLaunchAttempted.current = true;
    setSearchParams({});
    setSession(null);
    setFeedback(null);
    setCurrentIndex(0);
    setAnswer('');
    setSelectedQuizItemIds([]);
    await refreshHub({ requestedIdsOverride: [] });
  };

  const correctRate = session?.itemCount
    ? Math.round((Number(session.correctCount || 0) / Number(session.itemCount || 1)) * 100)
    : 0;
  const progressCopy = currentItem ? `${currentIndex + 1} / ${session?.itemCount || items.length}` : 'Ready';
  const currentQuizTypeCopy = currentItem ? getQuizTypeCopy(currentItem.quizType, currentItem.quizTypeLabel) : null;

  const hubStartLabel =
    isStarting ? 'Starting...' : selectedQuizItemIds.length > 0 ? `Start quiz (${selectedQuizItemIds.length})` : 'Start quiz';
  const hasQuizItems = playableItems.length > 0;
  const showQuizHubEmptyGuidance = hasHub && !isLoadingHub && !hasQuizItems && !isFromPractice;
  const pageIntroEyebrow = isFromPractice ? 'Quick check' : 'Quiz';
  const pageIntroTitle = isFromPractice ? 'Quick check' : 'Quiz mode';
  const pageIntroDescription = session
    ? 'Answer at your pace, then review the round when you are done.'
    : isFromPractice
      ? 'Test what you practiced.'
      : 'Optionally pick questions below, then start a round.';
  const pageIntroMeta =
    isFromPractice && practiceContentTitle ? (
      <p className="muted-text content-practice-context">
        From: <span className="content-practice-context-title">{practiceContentTitle}</span>
      </p>
    ) : null;
  const backToContentPath = practiceContentId ? `/content?contentId=${practiceContentId}` : '/content';

  return (
    <section className="page-section">
      <PageIntro
        eyebrow={pageIntroEyebrow}
        title={pageIntroTitle}
        description={pageIntroDescription}
        meta={pageIntroMeta}
        actions={
          session ? (
            isFromPractice && practiceContentId ? (
              <Link to={backToContentPath} className="secondary-button">
                Back to content
              </Link>
            ) : (
              <button type="button" className="secondary-button" onClick={handleReturnToHub}>
                Back to hub
              </button>
            )
          ) : isFromPractice && practiceContentId ? (
            <Link to={backToContentPath} className="secondary-button">
              Back to content
            </Link>
          ) : null
        }
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      {session ? (
        isFinished ? (
          <div className="dashboard-grid">
            <div className="dashboard-primary">
              <div className="card form-card form-shell">
                <div className="section-header">
                  <div className="section-stack-tight">
                    <p className="eyebrow-label">Review</p>
                    <h3>Quiz results</h3>
                    <p className="muted-text">Review each question and compare answers.</p>
                  </div>
                  <span className="mapped-column-tag">{correctRate}% correct</span>
                </div>

                <div className="profile-stats">
                  <div className="profile-stat">
                    <span className="profile-stat-value">{session.itemCount}</span>
                    <span className="muted-text">Questions</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">{session.correctCount}</span>
                    <span className="muted-text">Correct</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">{session.incorrectCount}</span>
                    <span className="muted-text">Incorrect</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">{session.skippedCount}</span>
                    <span className="muted-text">Skipped</span>
                  </div>
                </div>

                <div className="content-list">
                  {session.items.map((item, index) => {
                    const typeCopy = getQuizTypeCopy(item.quizType, item.quizTypeLabel);

                    return (
                      <article key={item.id} className="content-list-item">
                        <div className="content-list-item-copy">
                          <strong>{index + 1}. {typeCopy.title}</strong>
                          <span>{item.prompt}</span>
                          <span className="muted-text">
                            {item.result?.skipped
                              ? 'Skipped'
                              : item.result?.isCorrect
                                ? 'Correct'
                                : 'Incorrect'}
                          </span>
                          {item.result?.submittedAnswer ? <span className="muted-text">Your answer: {item.result.submittedAnswer}</span> : null}
                          <span className="muted-text">Correct answer: {item.result?.canonicalAnswer || 'Unavailable'}</span>
                          {item.result?.feedback?.reading ? <span className="muted-text">Reading: {item.result.feedback.reading}</span> : null}
                          {item.result?.feedback?.originalText ? <span className="muted-text">Original sentence: {item.result.feedback.originalText}</span> : null}
                          {item.result?.feedback?.translations?.length ? (
                            <span className="muted-text">Translations: {item.result.feedback.translations.join('; ')}</span>
                          ) : null}
                        </div>
                        <span className="content-list-item-state">{typeCopy.shortLabel}</span>
                      </article>
                    );
                  })}
                </div>

                <div className="action-row">
                  {isFromPractice && practiceContentId ? (
                    <>
                      <Link to={backToContentPath} className="primary-button">
                        Continue practice
                      </Link>
                      <Link to="/content" className="secondary-button">
                        Back to content
                      </Link>
                      <button type="button" className="text-action" onClick={handleReturnToHub} disabled={isLoadingHub}>
                        Quiz hub
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={handleReturnToHub} disabled={isLoadingHub}>
                        Back
                      </button>
                      <button type="button" className="secondary-button" onClick={() => handleStartQuiz({ quizItemIds: selectedQuizItemIds })} disabled={isStarting}>
                        New quiz
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!isFromPractice ? (
              <aside className="dashboard-secondary">
                <div className="card dashboard-section">
                  <div className="section-stack-tight">
                    <p className="eyebrow-label">Session</p>
                    <h3>Recent quizzes</h3>
                    <p className="muted-text">Reopen past results for review.</p>
                  </div>
                  <div className="dashboard-stack-list">
                    {recentSessions.length ? (
                      recentSessions.map((entry) => (
                        <button key={entry.id} type="button" className="selection-row" onClick={() => handleOpenSession(entry.id)}>
                          <div className="content-list-item-copy">
                            <strong>{entry.quizTypeLabels.join(', ') || 'Quiz session'}</strong>
                            <span className="muted-text">{entry.firstPrompt || 'Quiz review'}</span>
                            <span className="muted-text">
                              {entry.correctCount} correct | {entry.incorrectCount} incorrect | {entry.skippedCount} skipped
                            </span>
                          </div>
                          <span className="mapped-column-tag">{entry.completedAt ? 'Finished' : 'Open'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state compact-empty-state">
                        <h4>No quiz history yet</h4>
                        <p className="muted-text">Completed quiz sessions will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        ) : currentItem ? (
          <div className="dashboard-grid">
            <div className="dashboard-primary">
              <div className="card form-card form-shell">
                <div className="section-header">
                  <div className="section-stack-tight">
                    <p className="eyebrow-label">In session</p>
                    <h3>{currentQuizTypeCopy?.title || 'Question'}</h3>
                    <p className="muted-text">Answer, then continue. Skips are recorded separately.</p>
                  </div>
                  <span className="mapped-column-tag">{progressCopy}</span>
                </div>

                <div className="detail-section-card">
                  <strong>{currentQuizTypeCopy?.promptLabel}</strong>
                  <p>{currentItem.prompt}</p>
                  {currentItem.promptSupport?.reading ? <p className="muted-text">Reading: {currentItem.promptSupport.reading}</p> : null}
                  {currentItem.topicTags?.length ? <p className="muted-text">Topics: {currentItem.topicTags.join(', ')}</p> : null}
                </div>

                {!feedback ? (
                  <>
                    <label>
                      Your answer
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder={currentItem.placeholder}
                        autoFocus
                      />
                    </label>

                    <div className="action-row">
                      <button type="button" onClick={() => handleSubmit('answer')} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => handleSubmit('skip')} disabled={isSubmitting}>
                        Skip for now
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="detail-section-card">
                      <strong>{feedback.skipped ? 'Skipped' : feedback.isCorrect ? 'Correct' : 'Not quite'}</strong>
                      {feedback.submittedAnswer ? <p className="muted-text">Your answer: {feedback.submittedAnswer}</p> : null}
                      <p className="muted-text">Correct answer: {feedback.canonicalAnswer}</p>
                      {feedback.feedback?.reading ? <p className="muted-text">Reading: {feedback.feedback.reading}</p> : null}
                      {feedback.feedback?.originalText ? <p className="muted-text">Original sentence: {feedback.feedback.originalText}</p> : null}
                      {feedback.feedback?.translations?.length ? (
                        <p className="muted-text">Translations: {feedback.feedback.translations.join('; ')}</p>
                      ) : null}
                    </div>

                    <div className="action-row">
                      <button type="button" onClick={handleContinue} disabled={isCompleting}>
                        {findNextUnansweredIndex(session.items, currentIndex) >= 0 ? 'Next question' : isCompleting ? 'Finishing...' : 'Finish and review'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {!isFromPractice ? (
              <aside className="dashboard-secondary">
                <div className="card dashboard-section">
                  <div className="section-stack-tight">
                    <p className="eyebrow-label">Progress</p>
                    <h3>This session</h3>
                    <p className="muted-text">One question at a time; review the full round when you finish.</p>
                  </div>
                  <div className="dashboard-stack-list">
                    {session.items.map((item, index) => {
                      const typeCopy = getQuizTypeCopy(item.quizType, item.quizTypeLabel);
                      const status = item.result
                        ? item.result.skipped
                          ? 'Skipped'
                          : item.result.isCorrect
                            ? 'Correct'
                            : 'Incorrect'
                        : index === currentIndex
                          ? 'Current'
                          : 'Queued';

                      return (
                        <div key={item.id} className="dashboard-list-row">
                          <div>
                            <strong>{index + 1}. {typeCopy.shortLabel}</strong>
                            <p className="muted-text detail-support-copy">{item.prompt}</p>
                          </div>
                          <span className="mapped-column-tag">{status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        ) : null
      ) : isFromPractice && requestedQuizItemIds.length > 0 ? (
        <div className="card form-card form-shell quiz-from-practice-launch">
          <p className="muted-text">{isStarting || isLoadingHub ? 'Starting quick check...' : 'Preparing your quick check.'}</p>
        </div>
      ) : isFromPractice ? (
        <div className="card form-card form-shell">
          <p className="muted-text">No quiz items for this content yet.</p>
          <div className="action-row">
            <Link to={backToContentPath} className="secondary-button">
              Back to content
            </Link>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid quiz-hub-page">
          {showQuizHubEmptyGuidance ? (
            <div className="card elevated-panel step35-empty-guidance quiz-hub-guidance-banner">
              <h3>You need flashcards or practice items before starting a quiz.</h3>
              <p className="muted-text">Build cards from content first—quiz questions come from your trusted vocabulary and sentences.</p>
              <div className="action-row step35-empty-actions">
                <Link to="/content" className="primary-button">
                  Learn from content
                </Link>
                <Link to="/flashcards" className="secondary-button">
                  Build flashcards
                </Link>
              </div>
            </div>
          ) : null}

          <div className={`dashboard-primary quiz-hub-main ${showQuizHubEmptyGuidance ? 'quiz-hub-main-muted' : ''}`}>
            <div className="card dashboard-section quiz-launch-primary quiz-launch-cluster">
              <div className="section-header quiz-launch-header">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Select</p>
                  <h3>Questions</h3>
                  <p className="muted-text">Optional: tick a few, or start without selecting—Lingua will use recent-ready items.</p>
                </div>
                <div className="quiz-launch-header-actions">
                  <span className="mapped-column-tag">{playableItems.length} ready</span>
                  <div className="quiz-launch-cta-stack">
                    <button
                      type="button"
                      className={!hasQuizItems && !isLoadingHub ? 'quiz-start-awaiting-items' : undefined}
                      onClick={() => handleStartQuiz({ quizItemIds: selectedQuizItemIds })}
                      disabled={!hasHub || isStarting || isLoadingHub || !hasQuizItems}
                      title={!hasQuizItems && !isLoadingHub ? 'Add flashcards or study content first—questions appear when ready.' : undefined}
                    >
                      {hubStartLabel}
                    </button>
                    {!hasQuizItems && !isLoadingHub ? (
                      <p className="muted-text quiz-start-hint">Nothing ready to quiz yet. Build flashcards from content first.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {isLoadingHub ? (
                <div className="empty-state">
                  <h4>Loading questions</h4>
                  <p className="muted-text">Fetching your questions and recent rounds.</p>
                </div>
              ) : playableItems.length ? (
                <div className="content-list">
                  {playableItems.map((item) => {
                    const typeCopy = getQuizTypeCopy(item.quizType, item.quizTypeLabel);
                    const isSelected = selectedQuizItemIds.includes(item.id);

                    return (
                      <label key={item.id} className={`selection-row ${isSelected ? 'is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSeed(item.id)}
                        />
                        <div className="content-list-item-copy">
                          <strong>{typeCopy.title}</strong>
                          <span>{item.prompt}</span>
                          {item.promptSupport?.reading ? <span className="muted-text">Reading: {item.promptSupport.reading}</span> : null}
                          <span className="muted-text">
                            From {item.provenance.generatedFromModel} • {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="mapped-column-tag">{typeCopy.shortLabel}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state quiz-guided-empty">
                  <h4>No questions yet</h4>
                  <p className="muted-text">Add questions from Vocabulary or Sentences—they show up here automatically.</p>
                </div>
              )}
            </div>

            <div className="card dashboard-section quiz-launch-secondary">
              <div className="section-header">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Selection</p>
                  <h3>Optional selection</h3>
                  <p className="muted-text">What you have ticked above—only used if you want a focused round.</p>
                </div>
                <span className="mapped-column-tag">{selectedPlayableItems.length} selected</span>
              </div>

              {selectedPlayableItems.length ? (
                <div className="content-list">
                  {selectedPlayableItems.map((item) => (
                    <div key={item.id} className="dashboard-list-row">
                      <div>
                        <strong>{item.quizTypeLabel}</strong>
                        <p className="muted-text detail-support-copy">{item.prompt}</p>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => handleToggleSeed(item.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty-state quiz-guided-empty">
                  <h4>No questions selected</h4>
                  <p className="muted-text">That is fine—use Start quiz above to launch from recent-ready items, or pick questions first.</p>
                </div>
              )}
            </div>
          </div>

          <aside className={`dashboard-secondary quiz-hub-aside quiz-aside-muted ${showQuizHubEmptyGuidance ? 'quiz-hub-aside-priority' : ''}`}>
            <div className="card dashboard-section quiz-aside-history quiz-aside-panel">
              <div className="section-stack-tight">
                <p className="eyebrow-label">Resume</p>
                <h3>Recent quizzes</h3>
                <p className="muted-text">Reopen a finished review or continue an open round.</p>
              </div>
              <div className="dashboard-stack-list">
                {recentSessions.length ? (
                  recentSessions.map((entry) => (
                    <button key={entry.id} type="button" className="selection-row" onClick={() => handleOpenSession(entry.id)}>
                      <div className="content-list-item-copy">
                        <strong>{entry.quizTypeLabels.join(', ') || 'Quiz session'}</strong>
                        <span className="muted-text">{entry.firstPrompt || 'Quiz review'}</span>
                        <span className="muted-text">
                          {entry.correctCount} correct | {entry.incorrectCount} incorrect | {entry.skippedCount} skipped
                        </span>
                      </div>
                      <span className="mapped-column-tag">{entry.completedAt ? 'Review' : `${entry.pendingCount} left`}</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state compact-empty-state quiz-guided-empty">
                    <h4>No history yet</h4>
                    <p className="muted-text">Finish a round and it will list here for quick review.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card dashboard-section quiz-aside-types quiz-aside-panel">
              <div className="section-stack-tight">
                <p className="eyebrow-label">Formats</p>
                <h3>Quiz types</h3>
                <p className="muted-text">Formats Lingua scores today.</p>
              </div>
              <div className="dashboard-stack-list">
                <div className="dashboard-list-row">
                  <div>
                    <strong>Meaning recall</strong>
                    <p className="muted-text detail-support-copy">Short prompt; answer with an accepted meaning.</p>
                  </div>
                  <span className="mapped-column-tag">Vocabulary</span>
                </div>
                <div className="dashboard-list-row">
                  <div>
                    <strong>Fill in the blank</strong>
                    <p className="muted-text detail-support-copy">Fill the blank using the sentence target.</p>
                  </div>
                  <span className="mapped-column-tag">Sentence</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default QuizSessionPage;
