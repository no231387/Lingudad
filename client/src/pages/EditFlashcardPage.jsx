import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FlashcardForm from '../components/FlashcardForm';
import { getDecks, getFlashcard, getOfficialBeginnerDecks, updateFlashcard } from '../services/flashcardService';

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
    <section>
      <h2>Edit Flashcard</h2>
      {error ? <p>{error}</p> : null}
      {card ? <FlashcardForm initialData={card} decks={decks} onSubmit={handleUpdate} submitLabel="Update Flashcard" /> : !error && <p>Loading...</p>}
    </section>
  );
}

export default EditFlashcardPage;
