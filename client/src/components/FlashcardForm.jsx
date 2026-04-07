import { useState } from 'react';

const defaultState = {
  wordOrPhrase: '',
  translation: '',
  language: '',
  deckId: '',
  category: '',
  tagNames: '',
  exampleSentence: '',
  proficiency: 1
};

const getInitialState = (initialData) => {
  if (!initialData) {
    return defaultState;
  }

  return {
    wordOrPhrase: initialData.wordOrPhrase || '',
    translation: initialData.translation || '',
    language: initialData.language || '',
    deckId: initialData.deck?._id || initialData.deckId || '',
    category: initialData.category || '',
    tagNames: Array.isArray(initialData.tags) ? initialData.tags.map((tag) => tag.name).join(', ') : initialData.tagNames || '',
    exampleSentence: initialData.exampleSentence || '',
    proficiency: initialData.proficiency || 1
  };
};

function FlashcardForm({
  initialData,
  decks = [],
  onSubmit,
  submitLabel = 'Save Flashcard',
  className = '',
  submitClassName = '',
  layout = 'stacked'
}) {
  const [formData, setFormData] = useState(getInitialState(initialData));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === 'proficiency' ? Number(value) : value
    }));
  };

  const handleDeckChange = (event) => {
    const selectedDeckId = event.target.value;
    const selectedDeck = decks.find((deck) => deck._id === selectedDeckId);

    setFormData((previous) => ({
      ...previous,
      deckId: selectedDeckId,
      category: selectedDeck?.name || previous.category
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className={`card form-card ${layout === 'compact' ? 'compact-form-card' : ''} ${className}`.trim()} onSubmit={handleSubmit}>
      <label>
        Word or Phrase
        <input name="wordOrPhrase" value={formData.wordOrPhrase} onChange={handleChange} required />
      </label>

      <label>
        Translation
        <input name="translation" value={formData.translation} onChange={handleChange} required />
      </label>

      <label>
        Language
        <input name="language" value={formData.language} onChange={handleChange} required />
      </label>

      <label>
        Deck
        <select name="deckId" value={formData.deckId} onChange={handleDeckChange}>
          <option value="">No deck selected</option>
          {decks.map((deck) => (
            <option key={deck._id} value={deck._id}>
              {deck.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Category / Topic
        <input
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="Used when no deck is selected or during import fallback"
        />
      </label>

      <label>
        Tags
        <input name="tagNames" value={formData.tagNames} onChange={handleChange} placeholder="e.g., verbs, travel, beginner" />
      </label>

      <label>
        Example Sentence
        <textarea name="exampleSentence" value={formData.exampleSentence} onChange={handleChange} rows="3" />
      </label>

      <label>
        Proficiency Level (1-5)
        <select name="proficiency" value={formData.proficiency} onChange={handleChange}>
          <option value={1}>1 - New</option>
          <option value={2}>2 - Learning</option>
          <option value={3}>3 - Familiar</option>
          <option value={4}>4 - Strong</option>
          <option value={5}>5 - Mastered</option>
        </select>
      </label>

      <button type="submit" className={submitClassName}>
        {submitLabel}
      </button>
    </form>
  );
}

export default FlashcardForm;
