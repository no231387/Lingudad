import { startTransition, useEffect, useState } from 'react';
import FlashcardForm from '../components/FlashcardForm';
import PageIntro from '../components/PageIntro';
import {
  createFlashcard,
  createLearningContent,
  getDecks,
  getLearningContent,
  getLearningContentById,
  saveLearningContent,
  unsaveLearningContent
} from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

const initialContentForm = {
  title: '',
  url: '',
  sourceId: '',
  language: 'Japanese',
  contentType: 'youtube',
  difficulty: '',
  description: '',
  topicTags: '',
  skillTags: '',
  registerTags: ''
};

function ContentPage() {
  const { user } = useAuth();
  const [contentItems, setContentItems] = useState([]);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentForm, setContentForm] = useState(initialContentForm);
  const [decks, setDecks] = useState([]);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [message, setMessage] = useState('');
  const [flashcardFormKey, setFlashcardFormKey] = useState(0);

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [{ data: deckData }, { data: contentData }] = await Promise.all([
          getDecks(),
          getLearningContent({
            language: user?.language || 'Japanese'
          })
        ]);

        startTransition(() => {
          setDecks(deckData);
          setContentItems(contentData);
          setSelectedContentId((current) => current || contentData[0]?._id || '');
        });
      } catch (error) {
        console.error('Failed to load content page:', error);
      }
    };

    loadPageData();
  }, [user?.language]);

  const refreshContent = async (preferredContentId = '') => {
    const { data } = await getLearningContent({
      language: user?.language || 'Japanese'
    });

    startTransition(() => {
      setContentItems(data);
      setSelectedContentId((current) => preferredContentId || current || data[0]?._id || '');
    });
  };

  useEffect(() => {
    const loadContentDetail = async () => {
      if (!selectedContentId) {
        setSelectedContent(null);
        return;
      }

      try {
        setIsLoadingDetail(true);
        const { data } = await getLearningContentById(selectedContentId);
        startTransition(() => {
          setSelectedContent(data);
        });
      } catch (error) {
        console.error('Failed to load content detail:', error);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadContentDetail();
  }, [selectedContentId]);

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
      const { data } = await createLearningContent(contentForm);
      setContentForm({
        ...initialContentForm,
        language: contentForm.language
      });
      await refreshContent(data._id);
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

      await refreshContent();
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
        sourceId: selectedContent.sourceId
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
          <form className="card form-card form-shell elevated-panel" onSubmit={handleCreateContent}>
            <div className="section-stack-tight">
              <h3>Add content</h3>
              <p className="muted-text">Save a learning source with media metadata so it can support later transcript and linking workflows.</p>
            </div>

            <label>
              Title
              <input name="title" value={contentForm.title} onChange={handleContentChange} required />
            </label>

            <div className="filter-grid">
              <label>
                Content type
                <select name="contentType" value={contentForm.contentType} onChange={handleContentChange}>
                  <option value="youtube">YouTube</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Language
                <select name="language" value={contentForm.language} onChange={handleContentChange}>
                  <option value="Japanese">Japanese</option>
                </select>
              </label>
            </div>

            <label>
              {contentForm.contentType === 'youtube' ? 'YouTube URL or video ID' : 'Source URL'}
              <input name="url" value={contentForm.url} onChange={handleContentChange} required />
            </label>

            {contentForm.contentType !== 'youtube' ? (
              <label>
                Source ID
                <input
                  name="sourceId"
                  value={contentForm.sourceId}
                  onChange={handleContentChange}
                  placeholder="Unique identifier for this source"
                />
              </label>
            ) : null}

            <div className="filter-grid">
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

            <div className="filter-grid">
              <label>
                Topic tags
                <input
                  name="topicTags"
                  value={contentForm.topicTags}
                  onChange={handleContentChange}
                  placeholder="travel, beginner, daily-life"
                />
              </label>

              <label>
                Skill tags
                <input
                  name="skillTags"
                  value={contentForm.skillTags}
                  onChange={handleContentChange}
                  placeholder="listening, vocabulary"
                />
              </label>
            </div>

            <label>
              Register tags
              <input
                name="registerTags"
                value={contentForm.registerTags}
                onChange={handleContentChange}
                placeholder="spoken, conversational"
              />
            </label>

            <label>
              Notes
              <textarea name="description" value={contentForm.description} onChange={handleContentChange} rows="3" />
            </label>

            <button type="submit" disabled={isSavingContent}>
              {isSavingContent ? 'Saving...' : 'Save content'}
            </button>
          </form>

          <div className="card elevated-panel">
            <div className="section-header">
              <div>
                <h3>Available content</h3>
                <p className="muted-text">Select a source to watch or use for flashcards.</p>
              </div>
            </div>

            <div className="content-list">
              {contentItems.length === 0 ? (
                <div className="empty-state content-empty-state">
                  <h4>No content yet</h4>
                  <p className="muted-text">Save a YouTube source here to start building a review library you can revisit and turn into flashcards.</p>
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
                        {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{item.contentType === 'youtube' ? 'YT' : 'SRC'}</span>}
                      </div>
                      <div className="content-list-item-copy">
                        <strong>{item.title}</strong>
                        <span className="muted-text">
                          {item.language} | {item.sourceProvider} | {item.difficulty || 'No level'}
                        </span>
                        <span className="muted-text">
                          {item.contentType} | transcript {item.transcriptStatus}
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
          {isLoadingDetail ? (
            <div className="card empty-state empty-state-emphasis">
              <h4>Loading content</h4>
              <p className="muted-text">Fetching the selected source and its metadata.</p>
            </div>
          ) : selectedContent ? (
            <>
              <div className="card content-viewer-card elevated-panel">
                <div className="section-header">
                  <div>
                    <h3>{selectedContent.title}</h3>
                    <p className="muted-text">
                      {selectedContent.language} | {selectedContent.sourceProvider} | Source ID {selectedContent.sourceId}
                    </p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => handleToggleSave(selectedContent)}>
                    {selectedContent.isSaved ? 'Remove saved' : 'Save content'}
                  </button>
                </div>

                {selectedContent.contentType === 'youtube' && selectedContent.embedUrl ? (
                  <div className="video-frame-wrapper">
                    <iframe
                      src={selectedContent.embedUrl}
                      title={selectedContent.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="empty-state compact-empty-state">
                    <h4>No embedded viewer</h4>
                    <p className="muted-text">This content type is stored for future media support, but an embedded viewer is not available yet.</p>
                  </div>
                )}

                {selectedContent.description ? <p className="muted-text">{selectedContent.description}</p> : null}

                <div className="mapping-grid">
                  <div className="subsurface-panel section-stack-tight">
                    <h4>Content metadata</h4>
                    <p className="muted-text">Type: {selectedContent.contentType}</p>
                    <p className="muted-text">Difficulty: {selectedContent.difficulty || 'Not set'}</p>
                    <p className="muted-text">Transcript: {selectedContent.transcriptStatus}</p>
                    <p className="muted-text">Available: {selectedContent.transcriptAvailable ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="subsurface-panel section-stack-tight">
                    <h4>Learning links</h4>
                    <p className="muted-text">Vocabulary links: {selectedContent.linkedVocabularyIds?.length || 0}</p>
                    <p className="muted-text">Sentence links: {selectedContent.linkedSentenceIds?.length || 0}</p>
                    <p className="muted-text">Learning source: {selectedContent.learningSource ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {selectedContent.topicTags?.length || selectedContent.skillTags?.length || selectedContent.registerTags?.length ? (
                  <div className="detail-chip-groups">
                    {selectedContent.topicTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Topic tags</h4>
                        <div className="choice-chip-row">
                          {selectedContent.topicTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedContent.skillTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Skill tags</h4>
                        <div className="choice-chip-row">
                          {selectedContent.skillTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedContent.registerTags?.length ? (
                      <div className="section-stack-tight">
                        <h4>Register tags</h4>
                        <div className="choice-chip-row">
                          {selectedContent.registerTags.map((tag) => (
                            <span key={tag} className="choice-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
              <p className="muted-text">Choose a saved source to review its media and transcript-ready metadata.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentPage;
