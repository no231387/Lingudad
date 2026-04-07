import { useEffect, useMemo, useState } from 'react';
import PageIntro from '../components/PageIntro';
import {
  createFlashcardFromVocabulary,
  createQuizFromVocabulary,
  getRecommendedVocabulary,
  searchVocabulary
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

function VocabularyPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [selectedVocabularyId, setSelectedVocabularyId] = useState('');
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
        const { data } = await getRecommendedVocabulary({
          language: user?.language === 'Japanese' ? 'ja' : user?.language || 'ja'
        });
        setRecommended(data.items || []);
        setSelectedVocabularyId((current) => current || data.items?.[0]?._id || '');
      } catch (error) {
        console.error('Failed to load recommended vocabulary:', error);
      } finally {
        setIsLoadingRecommended(false);
      }
    };

    loadRecommended();
  }, [user?.language, user?.level, user?.goals]);

  const selectedItem = useMemo(() => {
    const combined = [...recommended, ...searchResults];
    return combined.find((item) => item._id === selectedVocabularyId) || recommended[0] || searchResults[0] || null;
  }, [recommended, searchResults, selectedVocabularyId]);

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
      setSelectedVocabularyId((current) => current || data[0]?._id || '');
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
      setMessage('Quiz seed created from vocabulary.');
    } catch (error) {
      console.error('Failed to create quiz from vocabulary:', error);
      setMessage(error.response?.data?.message || 'Could not create a quiz from this vocabulary item.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Vocabulary"
        title="Source-backed vocabulary"
        description="Search trusted vocabulary entries and create flashcards that keep their source attribution."
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid">
        <div className="content-column">
          <form className="card form-card form-shell elevated-panel" onSubmit={handleSearch}>
            <div className="section-stack-tight">
              <h3>Search vocabulary</h3>
              <p className="muted-text">Search within your current language and filter by general difficulty when needed.</p>
            </div>

            <label>
              Search term
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by term, reading, or meaning" />
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
              {isSearching ? 'Searching...' : 'Search vocabulary'}
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
                  <p className="muted-text">Fetching vocabulary matched to your profile.</p>
                </div>
              ) : recommended.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No vocabulary recommendations</h4>
                  <p className="muted-text">Recommendations will appear after source-backed vocabulary is added for your language.</p>
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
                      <span className="muted-text">{item.reading || 'No reading provided'}</span>
                    </div>
                    <span className="content-list-item-state">{item.difficulty || 'Source-backed'}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card elevated-panel">
            <div className="section-header">
              <div>
                <h3>Search results</h3>
                <p className="muted-text">Results from the vocabulary truth layer.</p>
              </div>
            </div>

            <div className="content-list">
              {searchResults.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <h4>No search results</h4>
                  <p className="muted-text">Search when you want to inspect a specific term, reading, or meaning.</p>
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
                      <span className="muted-text">{item.meanings?.slice(0, 2).join('; ') || 'No meaning available'}</span>
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
            <div className="card content-viewer-card elevated-panel vocabulary-detail-card">
              <div className="section-header">
                <div className="vocabulary-hero-copy">
                  <h3>{selectedItem.term}</h3>
                  <p className="vocabulary-reading">{selectedItem.reading || 'No reading provided'}</p>
                </div>
              </div>

              <div className="study-action-panel">
                <div className="study-action-copy">
                  <h4>Create study items</h4>
                  <p className="muted-text">Use this entry to create a flashcard or a meaning-recall quiz seed.</p>
                </div>
                <div className="study-action-row">
                  <button type="button" onClick={handleCreateFlashcard} disabled={isCreatingFlashcard}>
                    {isCreatingFlashcard ? 'Creating...' : 'Create Flashcard'}
                  </button>
                  <button type="button" className="secondary-button" onClick={handleCreateQuiz} disabled={isCreatingQuiz}>
                    {isCreatingQuiz ? 'Creating...' : 'Create Quiz Seed'}
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
                <div className="detail-chip-groups">
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
                  {selectedItem.registerTags?.length ? (
                    <div className="section-stack-tight">
                      <h4>Register tags</h4>
                      <div className="choice-chip-row">
                        {selectedItem.registerTags.map((tag) => (
                          <span key={tag} className="choice-chip">
                            {tag}
                          </span>
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
                    <h4>Latest quiz seed</h4>
                    <p>{lastQuiz.prompt}</p>
                    <p className="muted-text">Answer: {lastQuiz.correctAnswer}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select vocabulary</h4>
              <p className="muted-text">Choose a recommended or searched entry to inspect it and create study items.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default VocabularyPage;
