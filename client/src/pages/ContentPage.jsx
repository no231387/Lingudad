import { useEffect, useMemo, useState } from 'react';
import FlashcardForm from '../components/FlashcardForm';
import PageIntro from '../components/PageIntro';
import {
  createFlashcard,
  createLearningContent,
  getDecks,
  getLearningContent,
  saveLearningContent,
  unsaveLearningContent
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

const initialContentForm = {
  title: '',
  url: '',
  language: 'Japanese',
  difficulty: '',
  description: ''
};

function ContentPage() {
  const { user } = useAuth();
  const [contentItems, setContentItems] = useState([]);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [contentForm, setContentForm] = useState(initialContentForm);
  const [decks, setDecks] = useState([]);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);
  const [message, setMessage] = useState('');
  const [flashcardFormKey, setFlashcardFormKey] = useState(0);

  const loadContent = async () => {
    const { data } = await getLearningContent({
      language: user?.language || 'Japanese'
    });
    setContentItems(data);
    setSelectedContentId((current) => current || data[0]?._id || '');
  };

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [{ data: deckData }] = await Promise.all([getDecks(), loadContent()]);
        setDecks(deckData);
      } catch (error) {
        console.error('Failed to load content page:', error);
      }
    };

    loadPageData();
  }, [user?.language]);

  const selectedContent = useMemo(
    () => contentItems.find((item) => item._id === selectedContentId) || null,
    [contentItems, selectedContentId]
  );

  const handleContentChange = (event) => {
    const { name, value } = event.target;
    setContentForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleCreateContent = async (event) => {
    event.preventDefault();

    try {
      setIsSavingContent(true);
      setMessage('');
      await createLearningContent(contentForm);
      setContentForm(initialContentForm);
      await loadContent();
      setMessage('Content saved.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save content.');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleToggleSave = async (content) => {
    try {
      setMessage('');
      const isSaved = content.savedBy?.some((savedUser) => String(savedUser) === String(user?._id));

      if (isSaved) {
        await unsaveLearningContent(content._id);
      } else {
        await saveLearningContent(content._id);
      }

      await loadContent();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not update saved content.');
    }
  };

  const handleCreateFlashcardFromContent = async (formData) => {
    if (!selectedContent) {
      return;
    }

    try {
      setIsSavingFlashcard(true);
      setMessage('');
      await createFlashcard({
        ...formData,
        sourceType: 'media',
        sourceProvider: selectedContent.sourceProvider,
        sourceId: selectedContent.externalId
      });
      setFlashcardFormKey((current) => current + 1);
      setMessage('Flashcard created from content.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not create flashcard.');
    } finally {
      setIsSavingFlashcard(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Content"
        title="Content library"
        description="Store source-backed media, watch it, and create flashcards with source attribution."
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid">
        <div className="content-column">
          <form className="card form-card form-shell" onSubmit={handleCreateContent}>
            <div className="section-stack-tight">
              <h3>Add YouTube content</h3>
              <p className="muted-text">Save a video for review and later flashcard creation.</p>
            </div>

            <label>
              Title
              <input name="title" value={contentForm.title} onChange={handleContentChange} required />
            </label>

            <label>
              YouTube URL or video ID
              <input name="url" value={contentForm.url} onChange={handleContentChange} required />
            </label>

            <div className="filter-grid">
              <label>
                Language
                <select name="language" value={contentForm.language} onChange={handleContentChange}>
                  <option value="Japanese">Japanese</option>
                </select>
              </label>

              <label>
                Difficulty
                <select name="difficulty" value={contentForm.difficulty} onChange={handleContentChange}>
                  <option value="">Not set</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>

            <label>
              Notes
              <textarea name="description" value={contentForm.description} onChange={handleContentChange} rows="3" />
            </label>

            <button type="submit" disabled={isSavingContent}>
              {isSavingContent ? 'Saving...' : 'Save content'}
            </button>
          </form>

          <div className="card">
            <div className="section-header">
              <div>
                <h3>Available content</h3>
                <p className="muted-text">Select a source to watch or use for flashcards.</p>
              </div>
            </div>

            <div className="content-list">
              {contentItems.length === 0 ? (
                <div className="empty-state">
                  <h4>No content yet</h4>
                  <p className="muted-text">Save your first YouTube item to start building the content library.</p>
                </div>
              ) : (
                contentItems.map((item) => {
                  const isSaved = item.savedBy?.some((savedUser) => String(savedUser) === String(user?._id));

                  return (
                    <button
                      key={item._id}
                      type="button"
                      className={`content-list-item ${selectedContentId === item._id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedContentId(item._id)}
                    >
                      <div className="content-list-item-thumb" aria-hidden="true">
                        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>YT</span>}
                      </div>
                      <div className="content-list-item-copy">
                        <strong>{item.title}</strong>
                        <span className="muted-text">
                          {item.language} | {item.sourceProvider} | {item.difficulty || 'No level'}
                        </span>
                      </div>
                      <span className="content-list-item-state">{isSaved ? 'Saved' : 'Select'}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="content-column">
          {selectedContent ? (
            <>
              <div className="card content-viewer-card">
                <div className="section-header">
                  <div>
                    <h3>{selectedContent.title}</h3>
                    <p className="muted-text">
                      {selectedContent.language} | {selectedContent.sourceProvider} | Source ID {selectedContent.externalId}
                    </p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => handleToggleSave(selectedContent)}>
                    {selectedContent.savedBy?.some((savedUser) => String(savedUser) === String(user?._id)) ? 'Remove saved' : 'Save content'}
                  </button>
                </div>

                <div className="video-frame-wrapper">
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedContent.externalId}`}
                    title={selectedContent.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {selectedContent.description ? <p className="muted-text">{selectedContent.description}</p> : null}
              </div>

              <FlashcardForm
                key={`${selectedContent._id}-${flashcardFormKey}`}
                initialData={{ language: selectedContent.language }}
                decks={decks}
                onSubmit={handleCreateFlashcardFromContent}
                submitLabel={isSavingFlashcard ? 'Creating...' : 'Create Flashcard'}
              />
            </>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select content</h4>
              <p className="muted-text">Choose a content item to watch and create flashcards from it.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentPage;
