import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addFlashcardsToDeck,
  createDeck,
  deleteDeck,
  getDecks,
  getFlashcards,
  importDeckToOfficialBeginnerDeck,
  resetDeckProficiency,
  updateDeck
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';

const initialFormData = { name: '', language: '', description: '' };

function DecksPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingDeckId, setEditingDeckId] = useState('');
  const [availableFlashcards, setAvailableFlashcards] = useState([]);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState([]);
  const [flashcardSearchTerm, setFlashcardSearchTerm] = useState('');
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
  const [isSavingDeckCards, setIsSavingDeckCards] = useState(false);
  const [deckCardsMessage, setDeckCardsMessage] = useState('');
  const filteredFlashcards = useMemo(() => {
    const normalizedSearch = flashcardSearchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return availableFlashcards;
    }

    return availableFlashcards.filter((flashcard) => {
      const deckName = flashcard.deck?.name || '';

      return [flashcard.wordOrPhrase, flashcard.translation, flashcard.language, deckName]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [availableFlashcards, flashcardSearchTerm]);

  const loadDecks = async () => {
    try {
      const { data } = await getDecks();
      setDecks(data);
    } catch (error) {
      console.error('Failed to load decks:', error);
    }
  };

  const loadFlashcardsForDeckEditor = async (deck) => {
    try {
      setIsLoadingFlashcards(true);
      const { data } = await getFlashcards();
      setAvailableFlashcards(data);
      setSelectedFlashcardIds(
        data
          .filter((flashcard) => String(flashcard.deck?._id || flashcard.deck) === String(deck._id))
          .map((flashcard) => flashcard._id)
      );
    } catch (error) {
      console.error('Failed to load flashcards for deck editor:', error);
      alert(error.response?.data?.message || 'Could not load flashcards for this deck.');
    } finally {
      setIsLoadingFlashcards(false);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleEdit = (deck) => {
    setEditingDeckId(deck._id);
    setDeckCardsMessage('');
    setFlashcardSearchTerm('');
    setFormData({
      name: deck.name || '',
      language: deck.language || '',
      description: deck.description || ''
    });
    loadFlashcardsForDeckEditor(deck);
  };

  const handleCancelEdit = () => {
    setEditingDeckId('');
    setFormData(initialFormData);
    setAvailableFlashcards([]);
    setSelectedFlashcardIds([]);
    setFlashcardSearchTerm('');
    setDeckCardsMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingDeckId) {
        await updateDeck(editingDeckId, formData);
      } else {
        await createDeck(formData);
      }

      handleCancelEdit();
      loadDecks();
    } catch (error) {
      console.error('Failed to save deck:', error);
      alert(error.response?.data?.message || 'Could not save deck.');
    }
  };

  const handleFlashcardSelectionChange = (flashcardId) => {
    setSelectedFlashcardIds((previous) =>
      previous.includes(flashcardId) ? previous.filter((id) => id !== flashcardId) : [...previous, flashcardId]
    );
  };

  const handleAddCardsToDeck = async () => {
    if (!editingDeckId || selectedFlashcardIds.length === 0 || isSavingDeckCards) {
      return;
    }

    try {
      setIsSavingDeckCards(true);
      const { data } = await addFlashcardsToDeck(editingDeckId, selectedFlashcardIds);
      setDeckCardsMessage(data.message || 'Cards added to deck successfully.');
      await Promise.all([loadDecks(), loadFlashcardsForDeckEditor({ _id: editingDeckId })]);
    } catch (error) {
      console.error('Failed to add cards to deck:', error);
      alert(error.response?.data?.message || 'Could not add selected cards to this deck.');
    } finally {
      setIsSavingDeckCards(false);
    }
  };

  const handleDelete = async (deckId) => {
    if (!window.confirm('Delete this deck? Flashcards in it will be kept but detached from the deck.')) {
      return;
    }

    try {
      await deleteDeck(deckId);
      if (editingDeckId === deckId) {
        handleCancelEdit();
      }
      loadDecks();
    } catch (error) {
      console.error('Failed to delete deck:', error);
      alert(error.response?.data?.message || 'Could not delete deck.');
    }
  };

  const handleImportToOfficial = async (deckId) => {
    if (!window.confirm('Copy this deck and its flashcards into Official Beginner Decks?')) {
      return;
    }

    try {
      await importDeckToOfficialBeginnerDeck(deckId);
      alert('Deck copied into Official Beginner Decks.');
    } catch (error) {
      console.error('Failed to import deck into Official Beginner Decks:', error);
      alert(error.response?.data?.message || 'Could not import this deck into Official Beginner Decks.');
    }
  };

  const handleResetDeckProficiency = async (deckId, deckName) => {
    const confirmed = window.confirm(`Reset all card proficiency levels in "${deckName}" back to 1?`);

    if (!confirmed) {
      return;
    }

    try {
      const { data } = await resetDeckProficiency(deckId);
      alert(`${data.message} Updated: ${data.updatedCount}`);
    } catch (error) {
      console.error('Failed to reset deck proficiency:', error);
      alert(error.response?.data?.message || 'Could not reset deck proficiency.');
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Decks"
        title="Your decks"
        description="Create personal decks, curate the cards inside them, and turn any focused topic into a reusable study flow."
      />

      <form className="card form-card form-shell" onSubmit={handleSubmit}>
        <div className="section-header">
          <div>
            <h3>{editingDeckId ? 'Edit deck' : 'Create a new deck'}</h3>
            <p className="muted-text">Build a study collection with a clear language, purpose, and description.</p>
          </div>
        </div>

        <label>
          Deck Name
          <input name="name" value={formData.name} onChange={handleChange} required />
        </label>

        <label>
          Language
          <input name="language" value={formData.language} onChange={handleChange} placeholder="e.g., Spanish" />
        </label>

        <label>
          Description
          <textarea name="description" value={formData.description} onChange={handleChange} rows="3" />
        </label>

        <div className="action-row">
          <button type="submit">{editingDeckId ? 'Update Deck' : 'Create Deck'}</button>
          {editingDeckId && (
            <button type="button" onClick={handleCancelEdit} className="secondary-button">
              Cancel
            </button>
          )}
        </div>

        {editingDeckId && (
          <div className="subsurface-panel">
            <h4>Add cards to this deck</h4>
            <p className="muted-text">Search your card library, select what belongs here, and update the deck without leaving the page.</p>
            {deckCardsMessage && <p className="success-text">{deckCardsMessage}</p>}
            {isLoadingFlashcards ? (
              <p className="muted-text">Loading flashcards...</p>
            ) : availableFlashcards.length === 0 ? (
              <div className="empty-state compact-empty-state">
                <h4>No flashcards available yet</h4>
                <p className="muted-text">Create a few flashcards first, then come back to place them into this deck.</p>
              </div>
            ) : (
              <>
                <label>
                  Search Flashcards
                  <input
                    value={flashcardSearchTerm}
                    onChange={(event) => setFlashcardSearchTerm(event.target.value)}
                    placeholder="Search by word, translation, language, or current deck"
                  />
                </label>

                <div className="selection-list">
                  {filteredFlashcards.length === 0 ? (
                    <p className="muted-text">No flashcards match your search.</p>
                  ) : (
                    filteredFlashcards.map((flashcard) => (
                      <label key={flashcard._id} className="selection-row">
                        <input
                          type="checkbox"
                          checked={selectedFlashcardIds.includes(flashcard._id)}
                          onChange={() => handleFlashcardSelectionChange(flashcard._id)}
                        />
                        <span>
                          <strong>{flashcard.wordOrPhrase}</strong>
                          {' - '}
                          {flashcard.translation}
                          {flashcard.deck?.name ? ` (Current deck: ${flashcard.deck.name})` : ' (No deck yet)'}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="action-row">
              <button type="button" onClick={handleAddCardsToDeck} disabled={selectedFlashcardIds.length === 0 || isSavingDeckCards}>
                {isSavingDeckCards ? 'Adding Cards...' : `Add ${selectedFlashcardIds.length} Selected Card(s)`}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="list-grid">
        {decks.map((deck) => (
          <article key={deck._id} className="card">
            <h3>{deck.name}</h3>
            <p>
              <strong>Language:</strong> {deck.language || 'Not set'}
            </p>
            <p>
              <strong>Description:</strong> {deck.description || 'No description yet'}
            </p>
            <div className="action-row">
              <Link className="button-link" to={`/study?deck=${deck._id}`}>
                Study This Deck
              </Link>
              <button type="button" onClick={() => handleEdit(deck)}>
                Edit
              </button>
              <button type="button" onClick={() => handleResetDeckProficiency(deck._id, deck.name)} className="secondary-button">
                Reset Deck Proficiency
              </button>
              <button type="button" onClick={() => handleDelete(deck._id)} className="danger-button">
                Delete
              </button>
              {String(deck.owner?._id || deck.owner) === String(user?._id) && (
                <button type="button" onClick={() => handleImportToOfficial(deck._id)} className="secondary-button">
                  Add to Official Beginner Decks
                </button>
              )}
            </div>
          </article>
        ))}
        {decks.length === 0 && (
          <div className="empty-state card">
            <h4>No decks yet</h4>
            <p className="muted-text">Create your first deck to start grouping cards by topic, course, or study goal.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default DecksPage;
