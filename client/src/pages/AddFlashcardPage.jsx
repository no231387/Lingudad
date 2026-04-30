import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlashcardForm from '../components/FlashcardForm';
import { createFlashcard, getDecks, getOfficialBeginnerDecks } from '../services/apiService';
import PageIntro from '../components/PageIntro';

function AddFlashcardPage() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);

  useEffect(() => {
    const loadDecks = async () => {
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

    loadDecks();
  }, []);

  const handleCreate = async (formData) => {
    try {
      await createFlashcard(formData);
      navigate('/flashcards');
    } catch (error) {
      console.error('Failed to create flashcard:', error);
      alert('Could not create flashcard. Please check your input.');
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Flashcards"
        title="Create flashcard"
        description="Add a word, translation, context, and tags so it fits neatly into your study system."
      />
      <FlashcardForm decks={decks} onSubmit={handleCreate} submitLabel="Create Flashcard" />
    </section>
  );
}

export default AddFlashcardPage;
