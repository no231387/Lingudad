import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

  const refreshHub = async ({ requestedIdsOverride } = {}) => {
    try {
      setIsLoadingHub(true);
      const [{ data: itemData }, { data: sessionData }] = await Promise.all([
        getPlayableQuizItems({ limit: 12 }),
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
      setSearchParams({ sessionId: data.id });
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

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Quiz"
        title="Quiz practice"
        description="Start a quick quiz, move through a few questions, and come back to old results anytime."
        actions={
          <>
            <button
              type="button"
              onClick={() => handleStartQuiz({ quizItemIds: selectedQuizItemIds })}
              disabled={!hasHub || isStarting || isLoadingHub}
            >
              {isStarting ? 'Starting...' : selectedQuizItemIds.length > 0 ? `Start selected (${selectedQuizItemIds.length})` : 'Start a quick quiz'}
            </button>
            {session ? (
              <button type="button" className="secondary-button" onClick={handleReturnToHub}>
                Back to quizzes
              </button>
            ) : null}
          </>
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
                    <p className="muted-text">See how each question went and compare your answer with the checked answer.</p>
                  </div>
                  <span className="mapped-column-tag">{correctRate}% correct</span>
                </div>

                <div className="profile-stats">
                  <div className="profile-stat">
                    <span className="profile-stat-value">{session.itemCount}</span>
                    <span className="muted-text">Items</span>
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
                  <button type="button" onClick={handleReturnToHub} disabled={isLoadingHub}>
                    Back to quizzes
                  </button>
                  <button type="button" className="secondary-button" onClick={() => handleStartQuiz({ quizItemIds: selectedQuizItemIds })} disabled={isStarting}>
                    Start another quiz
                  </button>
                </div>
              </div>
            </div>

            <aside className="dashboard-secondary">
              <div className="card dashboard-section">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Session</p>
                  <h3>Recent quizzes</h3>
                  <p className="muted-text">Open an older result again whenever you want a quick review.</p>
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
          </div>
        ) : currentItem ? (
          <div className="dashboard-grid">
            <div className="dashboard-primary">
              <div className="card form-card form-shell">
                <div className="section-header">
                  <div className="section-stack-tight">
                    <p className="eyebrow-label">In session</p>
                    <h3>{currentQuizTypeCopy?.title || 'Quiz question'}</h3>
                    <p className="muted-text">Answer first, then move on. Skips are tracked separately so you can see where you hesitated.</p>
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
                        {isSubmitting ? 'Submitting...' : 'Check answer'}
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

            <aside className="dashboard-secondary">
              <div className="card dashboard-section">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Progress</p>
                  <h3>This session</h3>
                  <p className="muted-text">Go one question at a time, then review the whole round at the end.</p>
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
          </div>
        ) : null
      ) : (
        <div className="dashboard-grid">
          <div className="dashboard-primary">
            <div className="card dashboard-section">
              <div className="section-header">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Launch</p>
                  <h3>Available quiz questions</h3>
                  <p className="muted-text">Pick a few questions for a custom round, or let Lingua start one from your recent quiz-ready items.</p>
                </div>
                <span className="mapped-column-tag">{playableItems.length} ready</span>
              </div>

              {isLoadingHub ? (
                <div className="empty-state">
                  <h4>Loading quiz library</h4>
                  <p className="muted-text">Loading your available questions and recent quiz rounds.</p>
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
                <div className="empty-state">
                  <h4>No quiz questions yet</h4>
                  <p className="muted-text">Create a quiz from Vocabulary or Sentences and it will appear here.</p>
                </div>
              )}
            </div>

            <div className="card dashboard-section">
              <div className="section-header">
                <div className="section-stack-tight">
                  <h3>Your next quiz</h3>
                  <p className="muted-text">Use a hand-picked set, or leave this empty and start from your recent quiz-ready questions.</p>
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
                <div className="empty-state compact-empty-state">
                  <h4>No quiz items selected</h4>
                  <p className="muted-text">You can still start a quick quiz, or pick a few questions for a more intentional round.</p>
                </div>
              )}
            </div>
          </div>

          <aside className="dashboard-secondary">
            <div className="card dashboard-section">
              <div className="section-stack-tight">
                <p className="eyebrow-label">History</p>
                <h3>Recent quizzes</h3>
                <p className="muted-text">Open a finished review again or pick up an unfinished round where you left off.</p>
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
                  <div className="empty-state compact-empty-state">
                    <h4>No quiz sessions yet</h4>
                    <p className="muted-text">Finished or in-progress quiz sessions will show up here.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card dashboard-section">
              <div className="section-stack-tight">
                <p className="eyebrow-label">Available now</p>
                <h3>Quiz types</h3>
                <p className="muted-text">Right now Lingua only uses quiz formats it can check clearly and consistently.</p>
              </div>
              <div className="dashboard-stack-list">
                <div className="dashboard-list-row">
                  <div>
                    <strong>Meaning recall</strong>
                    <p className="muted-text detail-support-copy">A word prompt checked against accepted meanings.</p>
                  </div>
                  <span className="mapped-column-tag">Vocabulary</span>
                </div>
                <div className="dashboard-list-row">
                  <div>
                    <strong>Fill in the blank</strong>
                    <p className="muted-text detail-support-copy">Fill in the blank using a checked sentence target.</p>
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
