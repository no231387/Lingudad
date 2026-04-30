import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import {
  createFlashcardFromSentence,
  createQuizFromSentence,
  getLearningPresets,
  getRecommendedSentences,
  searchSentences
} from '../services/apiService';
import { useAuth } from '../context/AuthContext';

const TUTORIAL_STORAGE_KEY = 'lingua_sentences_tutorial_dismissed';

function SentencesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [selectedSentenceId, setSelectedSentenceId] = useState('');
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [message, setMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(true);
  const [isCreatingFlashcard, setIsCreatingFlashcard] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [lastFlashcard, setLastFlashcard] = useState(null);
  const [lastQuiz, setLastQuiz] = useState(null);
  const [isTutorialDismissed, setIsTutorialDismissed] = useState(false);
  const [isTutorialExpanded, setIsTutorialExpanded] = useState(true);
  const [showPresetSummary, setShowPresetSummary] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
      setIsTutorialDismissed(isDismissed);
      setIsTutorialExpanded(!isDismissed);
    } catch (error) {
      console.warn('Could not read sentence tutorial state:', error);
    }
  }, []);

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const { data } = await getLearningPresets({
          language: user?.language || 'Japanese'
        });
        setPresets(data.items || []);
        setSelectedPresetId((current) => current || data.items?.[0]?.id || '');
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    };

    loadPresets();
  }, [user?.language]);

  useEffect(() => {
    const loadRecommended = async () => {
      try {
        setIsLoadingRecommended(true);
        const { data } = await getRecommendedSentences({
          language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja',
          preset: selectedPresetId
        });
        setRecommended(data.items || []);
        setSelectedSentenceId(data.items?.[0]?._id || '');
      } catch (error) {
        console.error('Failed to load recommended sentences:', error);
      } finally {
        setIsLoadingRecommended(false);
      }
    };

    loadRecommended();
  }, [selectedPresetId, user?.language, user?.level, user?.goals]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );

  const selectedItem = useMemo(() => {
    const combined = [...recommended, ...searchResults];
    return combined.find((item) => item._id === selectedSentenceId) || recommended[0] || searchResults[0] || null;
  }, [recommended, searchResults, selectedSentenceId]);

  const dismissTutorial = () => {
    setIsTutorialDismissed(true);
    setIsTutorialExpanded(false);

    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    } catch (error) {
      console.warn('Could not store sentence tutorial state:', error);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    try {
      setIsSearching(true);
      setMessage('');
      setHasSearched(true);
      const { data } = await searchSentences({
        q: query,
        difficulty,
        language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja'
      });
      setSearchResults(data);
      setSelectedSentenceId(data[0]?._id || '');
    } catch (error) {
      console.error('Failed to search sentences:', error);
      setMessage(error.response?.data?.message || 'Could not search sentences.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateFlashcard = async () => {
    if (!selectedItem) {
      return;
    }

    try {
      setIsCreatingFlashcard(true);
      setMessage('');
      const { data } = await createFlashcardFromSentence(selectedItem._id);
      setLastFlashcard(data);
      setMessage('Flashcard created from sentence.');
    } catch (error) {
      console.error('Failed to create flashcard from sentence:', error);
      setMessage(error.response?.data?.message || 'Could not create a flashcard from this sentence.');
    } finally {
      setIsCreatingFlashcard(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!selectedItem) {
      return;
    }

    try {
      setIsCreatingQuiz(true);
      setMessage('');
      const { data } = await createQuizFromSentence(selectedItem._id);
      setLastQuiz(data);
      setMessage('Quiz question added from this sentence.');
    } catch (error) {
      console.error('Failed to create quiz from sentence:', error);
      setMessage(error.response?.data?.message || 'Could not create a quiz from this sentence.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const primaryItems = hasSearched ? searchResults : recommended;
  const primaryTitle = hasSearched ? 'Matching sentences' : 'Recommended';
  const primaryDescription = hasSearched
    ? 'Results replace the main list for review.'
    : selectedPreset?.description || 'Suggested from your profile and recent activity.';
  const secondaryTitle = hasSearched ? 'More ideas' : 'Search results';
  const secondaryDescription = hasSearched
    ? 'Keep a few suggested sentences nearby while you inspect search matches.'
    : 'Search when you want an exact phrase or translation.';
  const secondaryItems = hasSearched ? recommended.slice(0, 4) : searchResults.slice(0, 4);
  const shouldShowCompactTutorial = isTutorialDismissed && !isTutorialExpanded;

  return (
    <section className="page-section learning-page">
      <PageIntro
        eyebrow="Sentences"
        title="Example sentences"
        description="Browse and search on the left, read the full sentence on the right, then add flashcards or quiz questions."
      />

      {!shouldShowCompactTutorial ? (
        <div className="card elevated-panel tutorial-banner">
          <div className="tutorial-banner-header">
            <div className="section-stack-tight">
              <p className="eyebrow-label">How it works</p>
              <h3>Find, select, study</h3>
              <p className="muted-text">Narrow the list, pick one sentence, then study it from the detail panel.</p>
            </div>
            <div className="tutorial-banner-actions">
              {isTutorialDismissed ? (
                <button type="button" className="secondary-button tutorial-dismiss" onClick={() => setIsTutorialExpanded(false)}>
                  Hide guide
                </button>
              ) : (
                <button type="button" className="secondary-button tutorial-dismiss" onClick={dismissTutorial}>
                  Minimize for next time
                </button>
              )}
            </div>
          </div>
          {isTutorialExpanded ? (
            <div className="tutorial-steps tutorial-steps-compact">
              <div className="tutorial-step"><strong>1</strong><span>Pick a preset or run a focused search.</span></div>
              <div className="tutorial-step"><strong>2</strong><span>Select one sentence from the main list.</span></div>
              <div className="tutorial-step"><strong>3</strong><span>Add a flashcard or quiz question from the detail panel.</span></div>
            </div>
          ) : null}
        </div>
      ) : null}

      {shouldShowCompactTutorial ? (
        <div className="card elevated-panel tutorial-banner tutorial-banner-minimal">
          <div className="tutorial-banner-header">
            <div className="section-stack-tight">
              <p className="eyebrow-label">How it works</p>
              <p className="muted-text">Find, select, study.</p>
            </div>
            <button type="button" className="secondary-button tutorial-dismiss" onClick={() => setIsTutorialExpanded(true)}>
              Show guide
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className={`learning-page-grid learning-flow-grid ${selectedItem ? 'has-selection' : ''}`}>
        <div className="content-column learning-sidebar-column learning-flow-sidebar">
          <form className="card form-card form-shell elevated-panel learning-tool-panel learning-tool-rail" onSubmit={handleSearch}>
            <div className="section-stack-tight">
              <p className="eyebrow-label">Discover</p>
              <h3>Find sentences</h3>
              <p className="muted-text">Preset shapes suggestions; search finds exact text or a translation.</p>
            </div>

            <div className="learning-tool-block">
              <label>
                Study style
                <select
                  value={selectedPresetId}
                  onChange={(event) => {
                    setSelectedPresetId(event.target.value);
                    setShowPresetSummary(true);
                  }}
                >
                  {!presets.length ? <option value="">No presets available</option> : null}
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Search text
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sentence text or translation" />
              </label>

              <details className="subsurface-panel compact-disclosure" open={showAdvancedFilters} onToggle={(event) => setShowAdvancedFilters(event.currentTarget.open)}>
                <summary>Advanced filters</summary>
                <div className="compact-disclosure-content">
                  <label>
                    Difficulty
                    <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                      <option value="">Any difficulty</option>
                      <option value="starter">Starter</option>
                      <option value="beginner">Beginner</option>
                      <option value="common">Common</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>
                </div>
              </details>

              <button type="submit" disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Find sentences'}
              </button>
            </div>

            {selectedPreset ? (
              <div className="subsurface-panel preset-summary preset-summary-compact">
                <div className="preset-summary-header">
                  <strong>{selectedPreset.name}</strong>
                  <button
                    type="button"
                    className="secondary-button inline-toggle-button"
                    onClick={() => setShowPresetSummary((current) => !current)}
                  >
                    {showPresetSummary ? 'Less' : 'More'}
                  </button>
                </div>
                <p className="muted-text">{selectedPreset.description}</p>
                {showPresetSummary ? (
                  <div className="preset-summary-meta">
                    <p className="muted-text">Level: {selectedPreset.levelBand || 'Mixed'} | Goal: {selectedPreset.conversationGoal || 'General conversation'}</p>
                    <p className="muted-text">
                      Register: {selectedPreset.registerTags?.join(', ') || 'mixed'} | Difficulty target: {selectedPreset.targetDifficulty?.join(', ') || 'mixed'}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>

        <div className="content-column learning-results-column">
          <div className="card elevated-panel results-panel results-panel-primary">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Select</p>
                <h3>{primaryTitle}</h3>
                <p className="muted-text">{primaryDescription}</p>
              </div>
            </div>

            <div className="content-list">
              {!hasSearched && isLoadingRecommended ? (
                <div className="empty-state compact-empty-state">
                  <h4>Loading suggestions</h4>
                  <p className="muted-text">Finding sentences that fit your study style and profile.</p>
                </div>
              ) : primaryItems.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>{hasSearched ? 'No matching sentences' : 'No sentence suggestions yet'}</h4>
                  <p className="muted-text">
                    {hasSearched
                      ? 'Try a broader phrase or remove filters to bring more matches into the main list.'
                      : 'Sentences will appear here once Lingua has more material ready for your language.'}
                  </p>
                </div>
              ) : (
                primaryItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`content-list-item sentence-list-item ${selectedSentenceId === item._id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSentenceId(item._id)}
                  >
                    <div className="content-list-item-copy">
                      <strong>{item.text}</strong>
                      <span className="muted-text">{item.primaryTranslation || 'No translation provided'}</span>
                      <span className="list-tag-line">
                        {item.recommendationDebug?.registerTags?.length ? item.recommendationDebug.registerTags.join(', ') : 'unspecified'}
                      </span>
                    </div>
                    <span className="content-list-item-state">{hasSearched ? item.sourceProvider : item.difficulty || 'Sentence'}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card elevated-panel results-panel results-panel-secondary">
            <div className="section-header">
              <div>
                <h3>{secondaryTitle}</h3>
                <p className="muted-text">{secondaryDescription}</p>
              </div>
            </div>

            <div className="content-list content-list-compact">
              {secondaryItems.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>{hasSearched ? 'No extra suggestions yet' : 'No search results yet'}</h4>
                  <p className="muted-text">
                    {hasSearched
                      ? 'More suggestions will appear here when Lingua finds sentences that fit this study style.'
                      : 'Run a search when you want to inspect a specific phrase or translation.'}
                  </p>
                </div>
              ) : (
                secondaryItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`content-list-item sentence-list-item ${selectedSentenceId === item._id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSentenceId(item._id)}
                  >
                    <div className="content-list-item-copy">
                      <strong>{item.text}</strong>
                      <span className="muted-text">{item.primaryTranslation || 'No translation provided'}</span>
                    </div>
                    <span className="content-list-item-state content-list-item-state-muted">{hasSearched ? item.difficulty || 'Sentence' : item.sourceProvider}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="content-column learning-detail-column learning-flow-detail">
          {selectedItem ? (
            <div className="card content-viewer-card elevated-panel sentence-detail-card learning-detail-focus">
              <div className="section-header">
                <div className="sentence-hero-copy">
                  <p className="detail-kicker">Inspect</p>
                  <h3 className="detail-primary-text">{selectedItem.text}</h3>
                  <p className="muted-text detail-support-copy">{selectedItem.language}</p>
                </div>
              </div>

              <div className="study-action-panel learning-action-panel">
                <div className="study-action-copy">
                  <p className="eyebrow-label">Turn it into practice</p>
                  <h4>Flashcards & questions</h4>
                  <p className="muted-text">Source-backed sentences only—Lingua does not invent translations.</p>
                </div>
                <div className="study-action-grid">
                  <button type="button" className="study-action-card" onClick={handleCreateFlashcard} disabled={isCreatingFlashcard}>
                    <span className="study-action-card-title">{isCreatingFlashcard ? 'Adding...' : 'Add flashcard'}</span>
                    <span className="study-action-card-copy">Review meaning and reading</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button study-action-card"
                    title="Add a fill-in quiz question from this sentence"
                    onClick={handleCreateQuiz}
                    disabled={isCreatingQuiz}
                  >
                    <span className="study-action-card-title">{isCreatingQuiz ? 'Adding...' : 'Add question (fill-in)'}</span>
                    <span className="study-action-card-copy">Test recall from context</span>
                  </button>
                </div>
              </div>

              <div className="detail-section-card">
                <h4>Translations</h4>
                <ul className="stacked-detail-list">
                  {(selectedItem.translations || []).map((translation) => (
                    <li key={`${translation.language}-${translation.text}`}>
                      <strong>{translation.language}:</strong> {translation.text}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedItem.linkedVocabularyIds?.length ? (
                <div className="detail-section-card">
                  <h4>Linked vocabulary</h4>
                  <div className="choice-chip-row">
                    {selectedItem.linkedVocabularyIds.map((entry) => (
                      <span key={entry._id} className="choice-chip">
                        {entry.term}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(selectedItem.skillTags?.length || selectedItem.topicTags?.length || selectedItem.registerTags?.length) ? (
                <details className="subsurface-panel compact-disclosure detail-section-card">
                  <summary>Tags and learning details</summary>
                  <div className="detail-chip-groups compact-disclosure-content">
                    {selectedItem.registerTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Register</h4>
                        <div className="choice-chip-row">
                          {selectedItem.registerTags.map((tag) => (
                            <span key={tag} className="choice-chip">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedItem.skillTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Skill tags</h4>
                        <div className="choice-chip-row">
                          {selectedItem.skillTags.map((tag) => (
                            <span key={tag} className="choice-chip">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedItem.topicTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Topic tags</h4>
                        <div className="choice-chip-row">
                          {selectedItem.topicTags.map((tag) => (
                            <span key={tag} className="choice-chip">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}

              <details className="subsurface-panel compact-disclosure detail-section-card">
                <summary>Source details</summary>
                <div className="compact-disclosure-content">
                  <p className="muted-text detail-support-copy">
                    {selectedItem.sourceProvider} | {selectedItem.sourceType} | {selectedItem.sourceId}
                  </p>
                </div>
              </details>

              {import.meta.env.DEV && selectedItem.recommendationDebug ? (
                <details className="subsurface-panel preset-debug-panel">
                  <summary>Recommendation debug</summary>
                  <p className="muted-text">
                    Register: {selectedItem.recommendationDebug.registerTags?.length ? selectedItem.recommendationDebug.registerTags.join(', ') : 'unspecified'}
                  </p>
                  <p className="muted-text">
                    Score: {selectedItem.recommendationDebug.scoreBreakdown.totalScore} ({selectedItem.recommendationDebug.activePreset?.name || 'No preset'})
                  </p>
                </details>
              ) : null}

              {lastFlashcard ? (
                <div className="study-preview-card">
                  <div className="section-stack-tight">
                    <h4>Latest flashcard</h4>
                    <p className="muted-text">
                      {lastFlashcard.wordOrPhrase}
                      {' -> '}
                      {lastFlashcard.translation}
                    </p>
                  </div>
                </div>
              ) : null}

              {lastQuiz ? (
                <div className="study-preview-card">
                  <div className="section-stack-tight">
                    <h4>New quiz question</h4>
                    <p>{lastQuiz.prompt}</p>
                    <p className="muted-text">Answer: {lastQuiz.correctAnswer}</p>
                    <div className="action-row">
                      <button type="button" className="secondary-button" onClick={() => navigate(`/quiz?quizItemId=${lastQuiz._id}`)}>
                        Start
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis learning-detail-empty">
              <p className="eyebrow-label">Detail</p>
              <h4>Select a sentence</h4>
              <p className="muted-text">Choose a row in the lists to see translations, links, and study actions here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default SentencesPage;
