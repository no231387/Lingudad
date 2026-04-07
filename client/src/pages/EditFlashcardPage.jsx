import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FlashcardForm from '../components/FlashcardForm';
import { getDecks, getFlashcard, getOfficialBeginnerDecks, updateFlashcard } from '../services/flashcardService';
import PageIntro from '../components/PageIntro';

function EditFlashcardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCard = async () => {
      try {
        const [{ data: flashcardData }, { data: deckData }, { data: officialDeckData }] = await Promise.all([
          getFlashcard(id),
          getDecks(),
          getOfficialBeginnerDecks()
        ]);
        setCard(flashcardData);
        setDecks([...deckData, ...officialDeckData]);
        setError('');
      } catch (error) {
        console.error('Failed to load flashcard:', error);
        setError(error.response?.data?.message || 'Could not load this flashcard.');
      }
    };

    loadCard();
  }, [id]);

  const handleUpdate = async (formData) => {
    try {
      await updateFlashcard(id, formData);
      navigate('/flashcards');
    } catch (error) {
      console.error('Failed to update flashcard:', error);
      alert(error.response?.data?.message || 'Could not update flashcard.');
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Flashcards"
        title="Edit flashcard"
        description="Update wording, deck placement, proficiency, and supporting context without changing the underlying card behavior."
      />
      {error ? <div className="card error-panel">{error}</div> : null}
      {card ? (
        <FlashcardForm initialData={card} decks={decks} onSubmit={handleUpdate} submitLabel="Update Flashcard" />
      ) : (
        !error && (
          <div className="card empty-state compact-empty-state">
            <h4>Loading flashcard</h4>
            <p className="muted-text">Fetching the current flashcard details now.</p>
          </div>
        )
      )}
    </section>
  );
}

export default EditFlashcardPage;
