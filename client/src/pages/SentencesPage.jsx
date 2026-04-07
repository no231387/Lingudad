import { useEffect, useMemo, useState } from 'react';
import PageIntro from '../components/PageIntro';
import {
  createFlashcardFromSentence,
  createQuizFromSentence,
  getRecommendedSentences,
  searchSentences
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

function SentencesPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [selectedSentenceId, setSelectedSentenceId] = useState('');
  const [message, setMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(true);
  const [isCreatingFlashcard, setIsCreatingFlashcard] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [lastFlashcard, setLastFlashcard] = useState(null);
  const [lastQuiz, setLastQuiz] = useState(null);

  useEffect(() => {
    const loadRecommended = async () => {
      try {
        setIsLoadingRecommended(true);
        const { data } = await getRecommendedSentences({
          language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja'
        });
        setRecommended(data.items || []);
        setSelectedSentenceId((current) => current || data.items?.[0]?._id || '');
      } catch (error) {
        console.error('Failed to load recommended sentences:', error);
      } finally {
        setIsLoadingRecommended(false);
      }
    };

    loadRecommended();
  }, [user?.language, user?.level, user?.goals]);

  const selectedItem = useMemo(() => {
    const combined = [...recommended, ...searchResults];
    return combined.find((item) => item._id === selectedSentenceId) || recommended[0] || searchResults[0] || null;
  }, [recommended, searchResults, selectedSentenceId]);

  const handleSearch = async (event) => {
    event.preventDefault();

    try {
      setIsSearching(true);
      setMessage('');
      const { data } = await searchSentences({
        q: query,
        difficulty,
        language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja'
      });
      setSearchResults(data);
      setSelectedSentenceId((current) => current || data[0]?._id || '');
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
      setMessage('Cloze quiz seed created from sentence.');
    } catch (error) {
      console.error('Failed to create quiz from sentence:', error);
      setMessage(error.response?.data?.message || 'Could not create a cloze quiz from this sentence.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Sentences"
        title="Source-backed sentences"
        description="Search sentence examples, inspect translations, and turn trusted examples into flashcards."
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid">
        <div className="content-column">
          <form className="card form-card form-shell elevated-panel" onSubmit={handleSearch}>
            <div className="section-stack-tight">
              <h3>Search sentences</h3>
              <p className="muted-text">Search within your current language and narrow by general difficulty when useful.</p>
            </div>

            <label>
              Search text
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by sentence text or translation" />
            </label>

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

            <button type="submit" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search sentences'}
            </button>
          </form>

          <div className="card elevated-panel">
            <div className="section-header">
              <div>
                <h3>Recommended for you</h3>
                <p className="muted-text">Based on your language, level, and learning goals.</p>
              </div>
            </div>

            <div className="content-list">
              {isLoadingRecommended ? (
                <div className="empty-state compact-empty-state">
                  <h4>Loading recommendations</h4>
                  <p className="muted-text">Fetching sentence examples matched to your profile.</p>
                </div>
              ) : recommended.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No sentence recommendations</h4>
                  <p className="muted-text">Recommendations will appear after source-backed sentences are added for your language.</p>
                </div>
              ) : (
                recommended.map((item) => (
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
                    <span className="content-list-item-state">{item.difficulty || 'Sentence'}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card elevated-panel">
            <div className="section-header">
              <div>
                <h3>Search results</h3>
                <p className="muted-text">Results from the sentence truth layer.</p>
              </div>
            </div>

            <div className="content-list">
              {searchResults.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No search results</h4>
                  <p className="muted-text">Search when you want to inspect a specific sentence or translation.</p>
                </div>
              ) : (
                searchResults.map((item) => (
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
                    <span className="content-list-item-state">{item.sourceProvider}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="content-column">
          {selectedItem ? (
            <div className="card content-viewer-card elevated-panel sentence-detail-card">
              <div className="section-header">
                <div className="sentence-hero-copy">
                  <h3>{selectedItem.text}</h3>
                  <p className="muted-text">{selectedItem.language}</p>
                </div>
              </div>

              <div className="study-action-panel">
                <div className="study-action-copy">
                  <h4>Create study items</h4>
                  <p className="muted-text">Create a sentence flashcard or a cloze seed using this source-backed example.</p>
                </div>
                <div className="study-action-row">
                  <button type="button" onClick={handleCreateFlashcard} disabled={isCreatingFlashcard}>
                    {isCreatingFlashcard ? 'Creating...' : 'Create Flashcard'}
                  </button>
                  <button type="button" className="secondary-button" onClick={handleCreateQuiz} disabled={isCreatingQuiz}>
                    {isCreatingQuiz ? 'Creating...' : 'Create Cloze Seed'}
                  </button>
                </div>
              </div>

              <div className="section-stack-tight">
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
                <div className="section-stack-tight">
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
                <div className="detail-chip-groups">
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
                  {selectedItem.registerTags?.length ? (
                    <div className="section-stack-tight">
                      <h4>Register tags</h4>
                      <div className="choice-chip-row">
                        {selectedItem.registerTags.map((tag) => (
                          <span key={tag} className="choice-chip">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="section-stack-tight">
                <h4>Source</h4>
                <p className="muted-text">
                  {selectedItem.sourceProvider} | {selectedItem.sourceType} | {selectedItem.sourceId}
                </p>
              </div>

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
                    <h4>Latest cloze seed</h4>
                    <p>{lastQuiz.prompt}</p>
                    <p className="muted-text">Answer: {lastQuiz.correctAnswer}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select a sentence</h4>
              <p className="muted-text">Choose a recommended or searched sentence to review it and create study items.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default SentencesPage;
