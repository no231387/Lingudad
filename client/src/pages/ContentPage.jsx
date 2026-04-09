import { startTransition, useEffect, useMemo, useState } from 'react';
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
  visibility: 'community',
  difficulty: '',
  description: '',
  topicTags: '',
  skillTags: '',
  registerTags: ''
};

const CONTENT_LIBRARY_VIEWS = [
  { id: 'community', label: 'Community', description: 'Shared public videos prepared for recommendation and discovery.' },
  { id: 'my_uploads', label: 'My uploads', description: 'Private media entries only visible to your account.' }
];

function ContentPage() {
  const { user } = useAuth();
  const [contentItems, setContentItems] = useState([]);
  const [contentSummary, setContentSummary] = useState({
    communityCount: 0,
    myUploadsCount: 0,
    savedCount: 0,
    recommendationReadyCount: 0
  });
  const [selectedContentId, setSelectedContentId] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentForm, setContentForm] = useState(initialContentForm);
  const [contentView, setContentView] = useState('community');
  const [decks, setDecks] = useState([]);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [message, setMessage] = useState('');
  const [flashcardFormKey, setFlashcardFormKey] = useState(0);

  const activeView = useMemo(
    () => CONTENT_LIBRARY_VIEWS.find((view) => view.id === contentView) || CONTENT_LIBRARY_VIEWS[0],
    [contentView]
  );
  const isUploadedType = contentForm.contentType === 'uploaded';

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [{ data: deckData }, { data: contentData }] = await Promise.all([
          getDecks(),
          getLearningContent({
            language: user?.language || 'Japanese',
            scope: contentView
          })
        ]);

        startTransition(() => {
          setDecks(deckData);
          setContentItems(contentData.items || []);
          setContentSummary(contentData.summary || {});
          setSelectedContentId((current) => current || contentData.items?.[0]?._id || '');
        });
      } catch (error) {
        console.error('Failed to load content page:', error);
      }
    };

    loadPageData();
  }, [contentView, user?.language]);

  const refreshContent = async (preferredContentId = '') => {
    const { data } = await getLearningContent({
      language: user?.language || 'Japanese',
      scope: contentView
    });

    startTransition(() => {
      setContentItems(data.items || []);
      setContentSummary(data.summary || {});
      setSelectedContentId((current) => preferredContentId || current || data.items?.[0]?._id || '');
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
        setSelectedContent(null);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadContentDetail();
  }, [selectedContentId]);

  useEffect(() => {
    if (isUploadedType && contentForm.visibility !== 'private') {
      setContentForm((previous) => ({
        ...previous,
        visibility: 'private'
      }));
    }
  }, [contentForm.visibility, isUploadedType]);

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
        language: contentForm.language,
        visibility: isUploadedType ? 'private' : 'community'
      });

      const nextView = data.visibility === 'private' ? 'my_uploads' : 'community';

      if (nextView !== contentView) {
        setContentView(nextView);
        setSelectedContentId(data._id);
      } else {
        await refreshContent(data._id);
      }

      setMessage(data.visibility === 'private' ? 'Private upload saved.' : 'Community content saved.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save content.');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleToggleSave = async (content) => {
    try {
      setMessage('');

      if (content.isSaved) {
        await unsaveLearningContent(content._id);
      } else {
        await saveLearningContent(content._id);
      }

      await refreshContent(content._id);
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
        title="Content Library"
        description="Add a source on the left, then manage and inspect saved content on the right."
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid">
        <div className="content-column content-form-column">
          <form className="card form-card form-shell elevated-panel content-form-panel" onSubmit={handleCreateContent}>
            <div className="section-stack-tight">
              <p className="eyebrow-label">Add</p>
              <h3>Content tool</h3>
              <p className="muted-text">Keep the form compact: define the source, add tags if useful, then save.</p>
            </div>

            <div className="form-section-block">
              <div className="section-stack-tight">
                <h4>Basic info</h4>
                <p className="muted-text">Title, type, language, and visibility.</p>
              </div>

              <label>
                Title
                <input name="title" value={contentForm.title} onChange={handleContentChange} required />
              </label>

              <div className="filter-grid">
                <label>
                  Content type
                  <select name="contentType" value={contentForm.contentType} onChange={handleContentChange}>
                    <option value="youtube">YouTube video</option>
                    <option value="uploaded">Uploaded media</option>
                    <option value="other">Other source</option>
                  </select>
                </label>

                <label>
                  Language
                  <select name="language" value={contentForm.language} onChange={handleContentChange}>
                    <option value="Japanese">Japanese</option>
                  </select>
                </label>
              </div>

              <div className="filter-grid">
                <label>
                  Visibility
                  <select
                    name="visibility"
                    value={isUploadedType ? 'private' : contentForm.visibility}
                    onChange={handleContentChange}
                    disabled={isUploadedType}
                  >
                    <option value="community">Community</option>
                    <option value="private">Private</option>
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
            </div>

            {isUploadedType ? (
              <div className="subsurface-panel content-guidance-card">
                <strong>Private upload track</strong>
                <p className="muted-text">Uploaded content is kept private and reserved for your later transcript, deck, and quiz workflows.</p>
              </div>
            ) : (
              <div className="subsurface-panel content-guidance-card">
                <strong>{contentForm.visibility === 'community' ? 'Community discovery track' : 'Private reference track'}</strong>
                <p className="muted-text">
                  {contentForm.visibility === 'community'
                    ? 'This item can participate in shared discovery and future community recommendations.'
                    : 'This item will remain visible only to your account and stay out of community recommendation pools.'}
                </p>
              </div>
            )}

            <div className="form-section-block">
              <div className="section-stack-tight">
                <h4>Source</h4>
                <p className="muted-text">Tell Lingua where this content comes from.</p>
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
            </div>

            <div className="form-section-block">
              <div className="section-stack-tight">
                <h4>Tags</h4>
                <p className="muted-text">Add only the tags that help with discovery and later study workflows.</p>
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
                    placeholder="listening, conversation, vocabulary"
                  />
                </label>
              </div>

              <label>
                Register tags
                <input
                  name="registerTags"
                  value={contentForm.registerTags}
                  onChange={handleContentChange}
                  placeholder="casual, polite, spoken"
                />
              </label>

              <label>
                Notes
                <textarea name="description" value={contentForm.description} onChange={handleContentChange} rows="3" />
              </label>
            </div>

            <button type="submit" disabled={isSavingContent}>
              {isSavingContent ? 'Saving...' : 'Save content'}
            </button>
          </form>
        </div>

        <div className="content-column content-library-column">
          <div className="card elevated-panel content-library-panel">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Watch</p>
              <h3>Saved content</h3>
              <p className="muted-text">Switch views, pick one source, and inspect it below.</p>
            </div>

            <div className="content-view-toggle">
              {CONTENT_LIBRARY_VIEWS.map((view) => {
                const count = view.id === 'community' ? contentSummary.communityCount : contentSummary.myUploadsCount;

                return (
                  <button
                    key={view.id}
                    type="button"
                    className={`selection-card content-view-card ${contentView === view.id ? 'is-selected' : ''}`}
                    onClick={() => setContentView(view.id)}
                  >
                    <span className="selection-card-indicator" aria-hidden="true" />
                    <span className="option-card-copy">
                      <span className="option-card-title">{view.label}</span>
                      <span className="option-card-description">{view.description}</span>
                      <span className="muted-text">{count || 0} items</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="subsurface-panel content-summary-strip">
              <span className="mapped-column-tag">{contentSummary.recommendationReadyCount || 0} community-ready</span>
              <span className="mapped-column-tag">{contentSummary.savedCount || 0} saved</span>
            </div>

            <div className="section-header">
              <div>
                <h3>{activeView.label}</h3>
                <p className="muted-text">{activeView.description}</p>
              </div>
            </div>

            <div className="content-list">
              {contentItems.length === 0 ? (
                <div className="empty-state content-empty-state">
                  <h4>{contentView === 'community' ? 'No community content yet' : 'No private uploads yet'}</h4>
                  <p className="muted-text">
                    {contentView === 'community'
                      ? 'Save a public video to start building the shared discovery library.'
                      : 'Add an uploaded or private source to prepare your own transcript-ready workspace.'}
                  </p>
                </div>
              ) : (
                contentItems.map((item) => (
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
                        {item.visibilityLabel} | transcript {item.transcriptStatus}
                      </span>
                    </div>
                    <span className="content-list-item-state">{item.visibility === 'community' ? 'Community' : 'Private'}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {isLoadingDetail ? (
            <div className="card empty-state empty-state-emphasis">
              <h4>Loading content</h4>
              <p className="muted-text">Fetching the selected source and its metadata.</p>
            </div>
          ) : selectedContent ? (
            <>
              <div className="card content-viewer-card elevated-panel content-viewer-panel">
                <div className="section-header">
                  <div className="detail-block">
                    <p className="detail-kicker">{selectedContent.visibility === 'community' ? 'Community content' : 'Private upload'}</p>
                    <h3 className="detail-primary-text">{selectedContent.title}</h3>
                    <p className="muted-text detail-support-copy">
                      {selectedContent.language} | {selectedContent.sourceProvider} | Source ID {selectedContent.sourceId}
                    </p>
                  </div>
                  {selectedContent.visibility === 'community' ? (
                    <button type="button" className="secondary-button" onClick={() => handleToggleSave(selectedContent)}>
                      {selectedContent.isSaved ? 'Remove saved' : 'Save content'}
                    </button>
                  ) : (
                    <span className="mapped-column-tag">Private only</span>
                  )}
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
                    <p className="muted-text">This media entry is stored for later private processing, but an embedded viewer is not available yet.</p>
                  </div>
                )}

                {selectedContent.description ? <p className="muted-text content-viewer-description">{selectedContent.description}</p> : null}

                <div className="mapping-grid">
                  <div className="subsurface-panel section-stack-tight detail-section-card">
                    <h4>Content metadata</h4>
                    <p className="muted-text">Type: {selectedContent.contentType}</p>
                    <p className="muted-text">Visibility: {selectedContent.visibilityLabel}</p>
                    <p className="muted-text">Difficulty: {selectedContent.difficulty || 'Not set'}</p>
                    <p className="muted-text">Transcript: {selectedContent.transcriptStatus}</p>
                  </div>
                  <div className="subsurface-panel section-stack-tight detail-section-card">
                    <h4>Pipeline readiness</h4>
                    <p className="muted-text">Discovery source: {selectedContent.discoverySource}</p>
                    <p className="muted-text">Community-ready: {selectedContent.recommendationEligible ? 'Yes' : 'No'}</p>
                    <p className="muted-text">Vocabulary links: {selectedContent.linkedVocabularyIds?.length || 0}</p>
                    <p className="muted-text">Sentence links: {selectedContent.linkedSentenceIds?.length || 0}</p>
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
                layout="compact"
                className="elevated-panel content-flashcard-panel"
              />
            </>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select content</h4>
              <p className="muted-text">Choose a community video or a private upload to inspect its media and transcript-ready metadata.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentPage;
