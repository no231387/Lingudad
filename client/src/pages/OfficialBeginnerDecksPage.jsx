import { useEffect, useState } from 'react';
import {
  createOfficialBeginnerDeck,
  deleteOfficialBeginnerDeck,
  getOfficialBeginnerDeckFlashcards,
  getOfficialBeginnerDecks,
  updateOfficialBeginnerDeck
} from '../services/flashcardService';
import PageIntro from '../components/PageIntro';

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
    <section className="page-section">
      <PageIntro
        eyebrow="Official decks"
        title="Official decks"
        description="Maintain curated starter decks that everyone in Lingua can browse, open, and learn from."
      />

      <form className="card form-card form-shell" onSubmit={handleSubmit}>
        <div className="section-header">
          <div>
            <h3>{editingDeckId ? 'Edit official beginner deck' : 'Create official beginner deck'}</h3>
            <p className="muted-text">Keep the shared library polished, understandable, and ready for first-time learners.</p>
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
        {decks.length === 0 && (
          <div className="empty-state card">
            <h4>No official decks yet</h4>
            <p className="muted-text">Create one curated beginner deck so the shared library has a starting point.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>{selectedDeckId ? 'Deck Flashcards' : 'Select a Deck'}</h3>
        {selectedDeckId ? (
          flashcards.length === 0 ? (
            <div className="empty-state compact-empty-state">
              <h4>No flashcards attached yet</h4>
              <p className="muted-text">This shared deck exists, but it does not have any flashcards connected to it yet.</p>
            </div>
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
          <div className="empty-state compact-empty-state">
            <h4>Choose a deck to preview</h4>
            <p className="muted-text">Select any official beginner deck above to review its flashcards here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default OfficialBeginnerDecksPage;
