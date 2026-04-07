import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FlashcardForm from '../components/FlashcardForm';
import FilterBar from '../components/FilterBar';
import {
  createFlashcard,
  deleteFlashcard,
  getDecks,
  getFlashcards,
  getOfficialBeginnerDecks,
  removeDuplicateWords,
  resetFlashcardProficiency
} from '../services/flashcardService';

const initialFilters = {
  search: '',
  language: '',
  category: '',
  proficiency: ''
};

function FlashcardListPage() {
  const [flashcards, setFlashcards] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [decks, setDecks] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(true);
  const [formKey, setFormKey] = useState(0);

  const loadFlashcards = async (activeFilters = filters) => {
    try {
      const query = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value !== ''));
      const { data } = await getFlashcards(query);
      setFlashcards(data);
    } catch (error) {
      console.error('Failed to fetch flashcards:', error);
    }
  };

  useEffect(() => {
    const loadDeckOptions = async () => {
      try {
        const [{ data: standardDecks }, { data: officialDecks }] = await Promise.all([
          getDecks(),
          getOfficialBeginnerDecks()
        ]);
        setDecks([...standardDecks, ...officialDecks]);
      } catch (error) {
        console.error('Failed to load decks:', error);
      }
    };

    loadDeckOptions();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadFlashcards(filters);
    }, filters.search ? 200 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  const handleFilterChange = (event) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [event.target.name]: event.target.value
    }));
  };

  const handleReset = () => {
    setFilters(initialFilters);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this flashcard?');
    if (!confirmed) return;

    try {
      await deleteFlashcard(id);
      loadFlashcards();
    } catch (error) {
      console.error('Failed to delete flashcard:', error);
    }
  };

  const handleResetProficiency = async (id) => {
    try {
      await resetFlashcardProficiency(id);
      loadFlashcards();
    } catch (error) {
      console.error('Failed to reset flashcard proficiency:', error);
      alert(error.response?.data?.message || 'Could not reset flashcard proficiency.');
    }
  };

  const handleRemoveDuplicates = async () => {
    const confirmed = window.confirm('Remove all duplicate words? The oldest copy of each word will be kept.');
    if (!confirmed) return;

    try {
      const { data } = await removeDuplicateWords();
      alert(`${data.message} Removed: ${data.removedCount}`);
      loadFlashcards();
    } catch (error) {
      console.error('Failed to remove duplicate words:', error);
      alert(error.response?.data?.message || 'Could not remove duplicate words.');
    }
  };

  const handleCreate = async (formData) => {
    try {
      await createFlashcard(formData);
      setFormKey((current) => current + 1);
      setShowAddForm(false);
      loadFlashcards();
    } catch (error) {
      console.error('Failed to create flashcard:', error);
      alert('Could not create flashcard. Please check your input.');
    }
  };

  const renderFlashcard = (card) => (
    <article key={card._id} className="card flashcard-card">
      <div className="flashcard-card-header">
        <div>
          <h3>{card.wordOrPhrase}</h3>
          <p className="flashcard-translation">{card.translation}</p>
        </div>
        <span className="mapped-column-tag">Level {card.proficiency}</span>
      </div>

      <div className="flashcard-meta">
        <p>
          <strong>Language:</strong> {card.language}
        </p>
        <p>
          <strong>Deck:</strong> {card.deck?.name || card.category || 'General'}
        </p>
        <p>
          <strong>Review Count:</strong> {card.reviewCount ?? 0}
        </p>
      </div>

      <p>
        <strong>Tags:</strong> {card.tags?.length ? card.tags.map((tag) => tag.name).join(', ') : 'No tags'}
      </p>
      <p className="muted-text">
        <strong>Example:</strong> {card.exampleSentence || 'No example yet'}
      </p>
      <div className="action-row">
        <Link className="button-link" to={`/edit/${card._id}`}>
          Edit
        </Link>
        <button type="button" onClick={() => handleResetProficiency(card._id)} className="secondary-button">
          Reset Proficiency
        </button>
        <button type="button" onClick={() => handleDelete(card._id)} className="danger-button">
          Delete
        </button>
      </div>
    </article>
  );

  return (
    <section className="page-section">
      <div className="card hero-card flashcards-hero">
        <div className="flashcards-hero-copy">
          <h2>My Flashcards</h2>
          <p>Search, add, and manage the flashcards saved to your own account.</p>
        </div>
        <div className="flashcards-toolbar">
          <button type="button" onClick={() => setShowAddForm((current) => !current)}>
            {showAddForm ? 'Hide Add Form' : 'Add Flashcard'}
          </button>
          <button type="button" onClick={handleRemoveDuplicates} className="secondary-button">
            Remove All Duplicate Words
          </button>
        </div>
      </div>

      <div className="flashcards-workspace">
        <FilterBar filters={filters} onChange={handleFilterChange} onReset={handleReset} />
        <div className="card flashcards-add-panel">
          <div className="section-header">
            <div>
              <h3>Quick Add</h3>
              <p className="muted-text">
                Add a new card to your collection without leaving the flashcards tab.
              </p>
            </div>
            <button type="button" onClick={() => setShowAddForm((current) => !current)} className="secondary-button">
              {showAddForm ? 'Collapse' : 'Open Form'}
            </button>
          </div>

          {showAddForm ? (
            <FlashcardForm
              key={formKey}
              decks={decks}
              onSubmit={handleCreate}
              submitLabel="Create Flashcard"
              submitClassName="easy-button"
              className="flashcards-inline-form"
              layout="compact"
            />
          ) : (
            <p className="muted-text">Open the form when you want to add a card. Your filters and results stay right where they are.</p>
          )}
        </div>
      </div>

      <div className="card flashcards-results-header">
        <div className="flashcards-results-copy">
          <h3>All Flashcards</h3>
          <p className="muted-text">
            {flashcards.length} {flashcards.length === 1 ? 'flashcard' : 'flashcards'} found
          </p>
        </div>
        <button type="button" onClick={() => setShowFlashcards((current) => !current)} className="secondary-button">
          {showFlashcards ? 'Collapse' : 'Show Flashcards'}
        </button>
      </div>

      {showFlashcards && <div className="list-grid">{flashcards.map((card) => renderFlashcard(card))}</div>}

      {flashcards.length === 0 && <p>No flashcards found. Try adding a new one.</p>}
    </section>
  );
}

export default FlashcardListPage;
