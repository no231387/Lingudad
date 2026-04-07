import { useEffect, useState } from 'react';
import {
  createOfficialBeginnerDeck,
  deleteOfficialBeginnerDeck,
  getOfficialBeginnerDeckFlashcards,
  getOfficialBeginnerDecks,
  updateOfficialBeginnerDeck
} from '../services/flashcardService';

const initialFormData = {
  name: '',
  language: '',
  description: ''
};

function OfficialBeginnerDecksPage() {
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingDeckId, setEditingDeckId] = useState('');

  const loadDecks = async (preferredDeckId = '') => {
    try {
      const { data } = await getOfficialBeginnerDecks();
      setDecks(data);

      const nextSelectedDeckId = preferredDeckId || selectedDeckId || data[0]?._id || '';
      setSelectedDeckId(nextSelectedDeckId);

      if (nextSelectedDeckId) {
        const { data: flashcardData } = await getOfficialBeginnerDeckFlashcards(nextSelectedDeckId);
        setFlashcards(flashcardData);
      } else {
        setFlashcards([]);
      }
    } catch (error) {
      console.error('Failed to load official beginner decks:', error);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadDecks(selectedDeckId);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedDeckId]);

  const handleDeckOpen = async (deckId) => {
    if (selectedDeckId === deckId) {
      setSelectedDeckId('');
      setFlashcards([]);
      return;
    }

    setSelectedDeckId(deckId);
    try {
      const { data } = await getOfficialBeginnerDeckFlashcards(deckId);
      setFlashcards(data);
    } catch (error) {
      console.error('Failed to load official deck flashcards:', error);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleEdit = (deck) => {
    setEditingDeckId(deck._id);
    setFormData({
      name: deck.name || '',
      language: deck.language || '',
      description: deck.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingDeckId('');
    setFormData(initialFormData);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingDeckId) {
        await updateOfficialBeginnerDeck(editingDeckId, formData);
      } else {
        await createOfficialBeginnerDeck(formData);
      }

      handleCancelEdit();
      loadDecks(editingDeckId);
    } catch (error) {
      console.error('Failed to save official beginner deck:', error);
      alert(error.response?.data?.message || 'Could not save official beginner deck.');
    }
  };

  const handleDelete = async (deckId) => {
    if (!window.confirm('Delete this official beginner deck?')) {
      return;
    }

    try {
      await deleteOfficialBeginnerDeck(deckId);
      if (selectedDeckId === deckId) {
        setSelectedDeckId('');
        setFlashcards([]);
      }
      loadDecks();
    } catch (error) {
      console.error('Failed to delete official beginner deck:', error);
      alert(error.response?.data?.message || 'Could not delete official beginner deck.');
    }
  };

  return (
    <section>
      <div className="card">
        <h2>Official Beginner Decks</h2>
        <p>Browse and manage shared beginner decks for everyone using the app.</p>
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        <h3>{editingDeckId ? 'Edit Official Beginner Deck' : 'Create Official Beginner Deck'}</h3>

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
            <button type="submit">{editingDeckId ? 'Update Official Deck' : 'Create Official Deck'}</button>
            {editingDeckId && (
              <button type="button" onClick={handleCancelEdit} className="secondary-button">
                Cancel
              </button>
            )}
          </div>
      </form>

      <div className="list-grid">
        {decks.map((deck) => (
          <article key={deck._id} className="card">
            <h3>{deck.name}</h3>
            <p>
              <strong>Level:</strong> Beginner
            </p>
            <p>
              <strong>Language:</strong> {deck.language || 'Not set'}
            </p>
            <p>
              <strong>Description:</strong> {deck.description || 'No description yet'}
            </p>
            <div className="action-row">
              <button type="button" onClick={() => handleDeckOpen(deck._id)} className={selectedDeckId === deck._id ? 'secondary-button' : ''}>
                {selectedDeckId === deck._id ? 'Viewing Flashcards' : 'Open Deck'}
              </button>
              <>
                <button type="button" onClick={() => handleEdit(deck)}>
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(deck._id)} className="danger-button">
                  Delete
                </button>
              </>
            </div>
          </article>
        ))}
      </div>

      <div className="card">
        <h3>{selectedDeckId ? 'Deck Flashcards' : 'Select a Deck'}</h3>
        {selectedDeckId ? (
          flashcards.length === 0 ? (
            <p>No flashcards are currently attached to this official beginner deck.</p>
          ) : (
            flashcards.map((flashcard) => (
              <article key={flashcard._id} className="sub-card">
                <h4>{flashcard.wordOrPhrase}</h4>
                <p>
                  <strong>Translation:</strong> {flashcard.translation}
                </p>
                <p>
                  <strong>Language:</strong> {flashcard.language}
                </p>
                <p>
                  <strong>Tags:</strong> {flashcard.tags?.length ? flashcard.tags.map((tag) => tag.name).join(', ') : 'No tags'}
                </p>
                <p>
                  <strong>Example:</strong> {flashcard.exampleSentence || 'No example yet'}
                </p>
              </article>
            ))
          )
        ) : (
          <p>Choose an official beginner deck to read its flashcards.</p>
        )}
      </div>
    </section>
  );
}

export default OfficialBeginnerDecksPage;
