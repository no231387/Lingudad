import { useEffect, useState } from 'react';
import FilterBar from '../components/FilterBar';
import { getCommunityFlashcards } from '../services/flashcardService';

const initialFilters = {
  search: '',
  language: '',
  category: '',
  proficiency: ''
};

function CommunityFlashcardsPage() {
  const [flashcards, setFlashcards] = useState([]);
  const [filters, setFilters] = useState(initialFilters);

  const loadFlashcards = async (activeFilters = filters) => {
    try {
      const query = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value !== ''));
      const { data } = await getCommunityFlashcards(query);
      setFlashcards(data);
    } catch (error) {
      console.error('Failed to fetch community flashcards:', error);
    }
  };

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

  return (
    <section className="page-section">
      <div className="card hero-card flashcards-hero">
        <div className="flashcards-hero-copy">
          <h2>Community Flashcards</h2>
          <p>Explore flashcards created by other users and see who shared each one.</p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} onReset={handleReset} />

      <div className="card flashcards-results-header">
        <div className="flashcards-results-copy">
          <h3>Community Cards</h3>
          <p className="muted-text">
            {flashcards.length} {flashcards.length === 1 ? 'flashcard' : 'flashcards'} found
          </p>
        </div>
      </div>

      <div className="list-grid">
        {flashcards.map((card) => (
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
              <strong>Author:</strong> {card.owner?.username || 'Unknown'}
            </p>
            <p>
              <strong>Tags:</strong> {card.tags?.length ? card.tags.map((tag) => tag.name).join(', ') : 'No tags'}
            </p>
            <p className="muted-text">
              <strong>Example:</strong> {card.exampleSentence || 'No example yet'}
            </p>
          </article>
        ))}
      </div>

      {flashcards.length === 0 && <p>No community flashcards found yet.</p>}
    </section>
  );
}

export default CommunityFlashcardsPage;
