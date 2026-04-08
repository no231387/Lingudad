import { useEffect, useMemo, useState } from 'react';
import PageIntro from '../components/PageIntro';
import {
  createFlashcardFromVocabulary,
  createQuizFromVocabulary,
  getLearningPresets,
  getRecommendedVocabulary,
  searchVocabulary
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

const TUTORIAL_STORAGE_KEY = 'lingua_vocabulary_tutorial_dismissed';

function VocabularyPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [selectedVocabularyId, setSelectedVocabularyId] = useState('');
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
  const [showPresetSummary, setShowPresetSummary] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    try {
      setIsTutorialDismissed(localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true');
    } catch (error) {
      console.warn('Could not read vocabulary tutorial state:', error);
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
        const { data } = await getRecommendedVocabulary({
          language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja',
          preset: selectedPresetId
        });
        setRecommended(data.items || []);
        setSelectedVocabularyId(data.items?.[0]?._id || '');
      } catch (error) {
        console.error('Failed to load recommended vocabulary:', error);
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
    return combined.find((item) => item._id === selectedVocabularyId) || recommended[0] || searchResults[0] || null;
  }, [recommended, searchResults, selectedVocabularyId]);

  const dismissTutorial = () => {
    setIsTutorialDismissed(true);

    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    } catch (error) {
      console.warn('Could not store vocabulary tutorial state:', error);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    try {
      setIsSearching(true);
      setMessage('');
      const { data } = await searchVocabulary({
        q: query,
        difficulty,
        language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja'
      });
      setSearchResults(data);
      setSelectedVocabularyId(data[0]?._id || '');
    } catch (error) {
      console.error('Failed to search vocabulary:', error);
      setMessage(error.response?.data?.message || 'Could not search vocabulary.');
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
      const { data } = await createFlashcardFromVocabulary(selectedItem._id);
      setLastFlashcard(data);
      setMessage('Flashcard created from vocabulary.');
    } catch (error) {
      console.error('Failed to create flashcard from vocabulary:', error);
      setMessage(error.response?.data?.message || 'Could not create a flashcard from this vocabulary item.');
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
      const { data } = await createQuizFromVocabulary(selectedItem._id);
      setLastQuiz(data);
      setMessage('Linquiz created from vocabulary.');
    } catch (error) {
      console.error('Failed to create quiz from vocabulary:', error);
      setMessage(error.response?.data?.message || 'Could not create a Linquiz from this vocabulary item.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Vocabulary"
        title="Source-backed vocabulary"
        description="Browse trusted entries, inspect meaning and reading, and turn them into study items."
      />

      {!isTutorialDismissed ? (
        <div className="card elevated-panel tutorial-banner">
          <div className="tutorial-banner-header">
            <div className="section-stack-tight">
              <h3>How Lingua works</h3>
              <p className="muted-text">A simple flow for finding vocabulary and turning it into study material.</p>
            </div>
            <button type="button" className="secondary-button tutorial-dismiss" onClick={dismissTutorial}>
              Dismiss
            </button>
          </div>
          <div className="tutorial-steps">
            <div className="tutorial-step"><strong>1</strong><span>Browse or search sentences and vocabulary</span></div>
            <div className="tutorial-step"><strong>2</strong><span>Select an item to inspect meanings, translations, and tags</span></div>
            <div className="tutorial-step"><strong>3</strong><span>Turn it into a Flashcard or Linquiz to start studying</span></div>
            <div className="tutorial-step"><strong>4</strong><span>Use presets like Casual, Polite, and Keigo to focus your learning</span></div>
          </div>
        </div>
      ) : null}

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className={`learning-page-grid ${selectedItem ? 'has-selection' : ''}`}>
        <div className="content-column learning-sidebar-column">
          <form className="card form-card form-shell elevated-panel" onSubmit={handleSearch}>
            <div className="section-stack-tight">
              <h3>Find vocabulary to learn from</h3>
              <p className="muted-text">Start with a preset, then search by term, reading, or meaning when you want something specific.</p>
            </div>

            <label>
              Learning preset
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

            {selectedPreset ? (
              <div className="inline-toggle-row">
                <button
                  type="button"
                  className="secondary-button inline-toggle-button"
                  onClick={() => setShowPresetSummary((current) => !current)}
                >
                  {showPresetSummary ? 'Hide preset details' : 'Show preset details'}
                </button>
              </div>
            ) : null}

            {selectedPreset && showPresetSummary ? (
              <div className="subsurface-panel preset-summary">
                <strong>{selectedPreset.name}</strong>
                <p className="muted-text">{selectedPreset.description}</p>
              </div>
            ) : null}

            <label>
              Search term
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by term, reading, or meaning" />
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
              {isSearching ? 'Searching...' : 'Find vocabulary'}
            </button>
          </form>
        </div>

        <div className="content-column learning-results-column">
          <div className="card elevated-panel results-panel">
            <div className="section-header">
              <div>
                <h3>Recommended for your preset</h3>
                <p className="muted-text">
                  {selectedPreset ? selectedPreset.description : 'Recommendations based on your current learning focus.'}
                </p>
              </div>
            </div>

            <div className="content-list">
              {isLoadingRecommended ? (
                <div className="empty-state compact-empty-state">
                  <h4>Loading recommendations</h4>
                  <p className="muted-text">Fetching vocabulary matched to your preset and profile.</p>
                </div>
              ) : recommended.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No vocabulary recommendations</h4>
                  <p className="muted-text">Source-backed vocabulary will appear here after entries are added for your language.</p>
                </div>
              ) : (
                recommended.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`content-list-item vocabulary-list-item ${selectedVocabularyId === item._id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedVocabularyId(item._id)}
                  >
                    <div className="content-list-item-copy">
                      <strong>{item.term}</strong>
                      <span className="list-secondary-line">{item.reading || 'No reading provided'}</span>
                      <span className="muted-text">{item.meanings?.[0] || 'No meaning available'}</span>
                      <span className="list-tag-line">
                        {item.recommendationDebug?.registerTags?.length ? item.recommendationDebug.registerTags.join(', ') : 'unspecified'}
                      </span>
                    </div>
                    <span className="content-list-item-state">{item.difficulty || 'Source-backed'}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card elevated-panel results-panel results-panel-secondary">
            <div className="section-header">
              <div>
                <h3>Matching vocabulary</h3>
                <p className="muted-text">Use search when you want to inspect a specific term more closely.</p>
              </div>
            </div>

            <div className="content-list">
              {searchResults.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No matching vocabulary yet</h4>
                  <p className="muted-text">Search for a term, reading, or meaning to populate this list.</p>
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`content-list-item vocabulary-list-item ${selectedVocabularyId === item._id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedVocabularyId(item._id)}
                  >
                    <div className="content-list-item-copy">
                      <strong>{item.term}</strong>
                      <span className="list-secondary-line">{item.reading || 'No reading provided'}</span>
                      <span className="muted-text">{item.meanings?.slice(0, 1).join('; ') || 'No meaning available'}</span>
                    </div>
                    <span className="content-list-item-state content-list-item-state-muted">{item.sourceProvider}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="content-column learning-detail-column">
          {selectedItem ? (
            <div className="card content-viewer-card elevated-panel vocabulary-detail-card">
              <div className="section-header">
                <div className="vocabulary-hero-copy">
                  <p className="detail-kicker">Vocabulary entry</p>
                  <h3 className="detail-primary-text">{selectedItem.term}</h3>
                  <p className="detail-secondary-text">{selectedItem.reading || 'No reading provided'}</p>
                </div>
              </div>

              <div className="study-action-panel learning-action-panel">
                <div className="study-action-copy">
                  <h4>Turn this into a study item</h4>
                  <p className="muted-text">Create a flashcard for direct review or a Linquiz for quick recall.</p>
                </div>
                <div className="study-action-grid">
                  <button type="button" className="study-action-card" onClick={handleCreateFlashcard} disabled={isCreatingFlashcard}>
                    <span className="study-action-card-title">{isCreatingFlashcard ? 'Creating...' : 'Create Flashcard'}</span>
                    <span className="study-action-card-copy">Review meaning and reading</span>
                  </button>
                  <button type="button" className="secondary-button study-action-card" onClick={handleCreateQuiz} disabled={isCreatingQuiz}>
                    <span className="study-action-card-title">{isCreatingQuiz ? 'Creating...' : 'Create Linquiz'}</span>
                    <span className="study-action-card-copy">Test recall from context</span>
                  </button>
                </div>
              </div>

              <div className="section-stack-tight">
                <h4>Meanings</h4>
                <ul className="stacked-detail-list">
                  {(selectedItem.meanings || []).map((meaning) => (
                    <li key={meaning}>{meaning}</li>
                  ))}
                </ul>
              </div>

              {selectedItem.partOfSpeech?.length ? (
                <div className="section-stack-tight">
                  <h4>Part of speech</h4>
                  <p className="muted-text">{selectedItem.partOfSpeech.join(', ')}</p>
                </div>
              ) : null}

              {selectedItem.skillTags?.length || selectedItem.topicTags?.length || selectedItem.registerTags?.length ? (
                <details className="subsurface-panel compact-disclosure">
                  <summary>Tags and learning details</summary>
                  <div className="detail-chip-groups compact-disclosure-content">
                    {selectedItem.registerTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Register</h4>
                        <div className="choice-chip-row">
                          {selectedItem.registerTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedItem.skillTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Skill tags</h4>
                        <div className="choice-chip-row">
                          {selectedItem.skillTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedItem.topicTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Topic tags</h4>
                        <div className="choice-chip-row">
                          {selectedItem.topicTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}

              <details className="subsurface-panel compact-disclosure">
                <summary>Source and provenance</summary>
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
                    <h4>Latest Linquiz</h4>
                    <p>{lastQuiz.prompt}</p>
                    <p className="muted-text">Answer: {lastQuiz.correctAnswer}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select vocabulary</h4>
              <p className="muted-text">Choose a recommended or matching entry to inspect it and create a study item.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default VocabularyPage;
