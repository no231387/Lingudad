import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DisclosurePanel from '../components/DisclosurePanel';
import PageIntro from '../components/PageIntro';
import {
  createLearningContent,
  generateFlashcardsFromContent,
  getContentStudyPack,
  getContentTranscriptSegments,
  getDecks,
  getLearningContent,
  getLearningContentById,
  getRecommendedLearningContent,
  startContentStudySession,
  saveContentTranscriptSegments,
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
  durationSeconds: '',
  description: '',
  topicTags: '',
  skillTags: '',
  registerTags: ''
};

const CONTENT_LIBRARY_VIEWS = [
  { id: 'community', label: 'Discover', description: 'Starter and community content.' },
  { id: 'my_uploads', label: 'My uploads', description: 'Private media and transcript workspaces.' }
];

const formatSeconds = (value) => {
  const totalSeconds = Number(value || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const formatStudyLabel = (value) =>
  String(value || '')
    .split('_')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
    .join(' ');

const getQuickTags = (item) => [...(item.topicTags || []), ...(item.skillTags || [])].filter(Boolean).slice(0, 3);

function ContentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contentItems, setContentItems] = useState([]);
  const [recommendedContent, setRecommendedContent] = useState([]);
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
  const [contentQuery, setContentQuery] = useState('');
  const [decks, setDecks] = useState([]);
  const [message, setMessage] = useState('');
  const [targetDeckId, setTargetDeckId] = useState('');
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [transcriptSource, setTranscriptSource] = useState('manual');
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [transcriptSummary, setTranscriptSummary] = useState({
    segmentCount: 0,
    candidateCount: 0,
    linkedSentenceCount: 0,
    linkedVocabularyCount: 0
  });
  const [contentStudyPack, setContentStudyPack] = useState(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isGeneratingStudy, setIsGeneratingStudy] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isLoadingContentStudy, setIsLoadingContentStudy] = useState(false);
  const [isStartingContentStudy, setIsStartingContentStudy] = useState(false);

  const activeView = useMemo(() => CONTENT_LIBRARY_VIEWS.find((view) => view.id === contentView) || CONTENT_LIBRARY_VIEWS[0], [contentView]);
  const isUploadedType = contentForm.contentType === 'uploaded';
  const quickTags = useMemo(() => (selectedContent ? getQuickTags(selectedContent) : []), [selectedContent]);
  const studySummary = contentStudyPack?.summary || {};

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [{ data: deckData }, { data: contentData }, { data: recommendedData }] = await Promise.all([
          getDecks(),
          getLearningContent({
            language: user?.language || 'Japanese',
            scope: contentView,
            q: contentQuery
          }),
          getRecommendedLearningContent({
            language: user?.language || 'Japanese',
            limit: 4
          })
        ]);

        startTransition(() => {
          setDecks(deckData);
          setContentItems(contentData.items || []);
          setRecommendedContent(recommendedData.items || []);
          setContentSummary(contentData.summary || {});
          setSelectedContentId((current) => current || contentData.items?.[0]?._id || '');
        });
      } catch (error) {
        console.error('Failed to load content page:', error);
      }
    };

    loadPageData();
  }, [contentQuery, contentView, user?.language]);

  const refreshContent = async (preferredContentId = '') => {
    const { data } = await getLearningContent({
      language: user?.language || 'Japanese',
      scope: contentView,
      q: contentQuery
    });

    startTransition(() => {
      setContentItems(data.items || []);
      setContentSummary(data.summary || {});
      setSelectedContentId((current) => preferredContentId || current || data.items?.[0]?._id || '');
    });
  };

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedContentId) {
        setSelectedContent(null);
        return;
      }

      try {
        setIsLoadingDetail(true);
        const { data } = await getLearningContentById(selectedContentId);
        setSelectedContent(data);
      } catch (error) {
        console.error('Failed to load content detail:', error);
        setSelectedContent(null);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadDetail();
  }, [selectedContentId]);

  useEffect(() => {
    const loadSegments = async () => {
      if (!selectedContentId) {
        setTranscriptSegments([]);
        setTranscriptSummary({
          segmentCount: 0,
          candidateCount: 0,
          linkedSentenceCount: 0,
          linkedVocabularyCount: 0
        });
        return;
      }

      try {
        setIsLoadingTranscript(true);
        const { data } = await getContentTranscriptSegments(selectedContentId);
        setTranscriptSegments(data.items || []);
        setTranscriptSummary(data.summary || {});
      } catch (error) {
        console.error('Failed to load transcript segments:', error);
        setTranscriptSegments([]);
      } finally {
        setIsLoadingTranscript(false);
      }
    };

    loadSegments();
  }, [selectedContentId]);

  const loadContentStudyPack = async (contentId) => {
    if (!contentId) {
      setContentStudyPack(null);
      return;
    }

    try {
      setIsLoadingContentStudy(true);
      const { data } = await getContentStudyPack(contentId);
      setContentStudyPack(data);
    } catch (error) {
      console.error('Failed to load content study pack:', error);
      setContentStudyPack(null);
    } finally {
      setIsLoadingContentStudy(false);
    }
  };

  useEffect(() => {
    loadContentStudyPack(selectedContentId);
  }, [selectedContentId]);

  useEffect(() => {
    if (isUploadedType && contentForm.visibility !== 'private') {
      setContentForm((previous) => ({ ...previous, visibility: 'private' }));
    }
  }, [contentForm.visibility, isUploadedType]);

  const handleContentChange = (event) => {
    const { name, value } = event.target;
    setContentForm((previous) => ({ ...previous, [name]: value }));
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

      setMessage(data.visibility === 'private' ? 'Private upload saved.' : 'Content saved.');
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

  const handleGenerateStudyFromContent = async () => {
    if (!selectedContent) {
      return;
    }

    try {
      setIsGeneratingStudy(true);
      setMessage('');
      const { data } = await generateFlashcardsFromContent(selectedContent._id, {
        deckId: targetDeckId || undefined
      });
      setMessage(data.message || 'Study items generated from content.');
    } catch (error) {
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not generate study from content.');
    } finally {
      setIsGeneratingStudy(false);
    }
  };

  const handleStartStudyFromContent = async () => {
    if (!selectedContent) {
      return;
    }

    try {
      setIsStartingContentStudy(true);
      setMessage('');
      const { data } = await startContentStudySession(selectedContent._id);
      navigate('/study', {
        state: {
          contentSession: data
        }
      });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not start study from this content.');
    } finally {
      setIsStartingContentStudy(false);
    }
  };

  const handleSaveTranscript = async () => {
    if (!selectedContent) {
      return;
    }

    try {
      setIsSavingTranscript(true);
      setMessage('');
      const { data } = await saveContentTranscriptSegments(selectedContent._id, {
        transcriptText: transcriptDraft,
        transcriptSource,
        replaceExisting: true
      });
      setTranscriptSegments(data.items || []);
      setTranscriptSummary(data.summary || {});
      setTranscriptDraft('');
      const { data: refreshedContent } = await getLearningContentById(selectedContent._id);
      setSelectedContent(refreshedContent);
      await loadContentStudyPack(selectedContent._id);
      setMessage('Transcript segments saved and linked where trusted matches were found.');
    } catch (error) {
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not save transcript segments.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Content"
        title="Watch, save, and study"
        description="Keep the player and next study move front and center."
        className="content-page-intro"
        meta={
          <div className="content-page-meta">
            <span className="mapped-column-tag">{contentSummary.communityCount || 0} in library</span>
            <span className="mapped-column-tag">{contentSummary.savedCount || 0} saved</span>
            <span className="mapped-column-tag">{contentSummary.recommendationReadyCount || 0} recommendation-ready</span>
          </div>
        }
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid content-page-grid-refined">
        <aside className="content-column content-library-column">
          <div className="card elevated-panel content-library-panel content-library-panel-refined">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Browse</p>
              <h3>{activeView.label}</h3>
              <p className="muted-text">{activeView.description}</p>
            </div>

            <div className="content-view-toggle content-pill-toggle">
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
                      <span className="muted-text">{count || 0} items</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="content-search-field">
              Search
              <input value={contentQuery} onChange={(event) => setContentQuery(event.target.value)} placeholder="Search by title, tag, or source" />
            </label>

            {recommendedContent.length ? (
              <div className="section-stack-tight">
                <div className="section-header content-library-subheader">
                  <div>
                    <h4>Recommended</h4>
                    <p className="muted-text">A short next-watch list.</p>
                  </div>
                </div>
                <div className="content-recommendation-list">
                  {recommendedContent.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      className={`content-list-item content-list-item-compact content-list-item-recommended ${selectedContentId === item._id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedContentId(item._id)}
                    >
                      <div className="content-list-item-thumb" aria-hidden="true">
                        {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{item.contentType === 'youtube' ? 'YT' : 'SRC'}</span>}
                      </div>
                      <div className="content-list-item-copy">
                        <strong>{item.title}</strong>
                        <span className="muted-text">{item.difficulty || 'Open level'} • {item.visibilityBadge || 'Community'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="section-stack-tight">
                <div className="section-header content-library-subheader">
                  <div>
                    <h4>{contentView === 'community' ? 'Library' : 'Your uploads'}</h4>
                    <p className="muted-text">Select one item to open.</p>
                  </div>
                </div>
              <div className="content-list content-list-refined">
                {contentItems.length === 0 ? (
                  <div className="empty-state content-empty-state">
                    <h4>{contentView === 'community' ? 'No content yet' : 'No uploads yet'}</h4>
                    <p className="muted-text">
                      {contentView === 'community'
                        ? 'Starter and community videos will appear here as the library grows.'
                        : 'Add a private source when you want your own transcript workspace.'}
                    </p>
                  </div>
                ) : (
                  contentItems.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      className={`content-list-item content-list-item-compact ${selectedContentId === item._id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedContentId(item._id)}
                    >
                      <div className="content-list-item-thumb" aria-hidden="true">
                        {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{item.contentType === 'youtube' ? 'YT' : 'SRC'}</span>}
                      </div>
                      <div className="content-list-item-copy">
                        <strong>{item.title}</strong>
                        <span className="muted-text">{item.difficulty || 'Open level'} • {item.visibilityBadge || 'Community'}</span>
                        <div className="mapped-column-tags">
                          {getQuickTags(item).map((tag) => (
                            <span key={`${item._id}-${tag}`} className="mapped-column-tag">
                              {tag.replaceAll('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <DisclosurePanel title="Add content" description="Optional. Keep this tucked away unless you are adding a source." className="content-add-disclosure">
              <form className="form-card form-shell content-form-panel" onSubmit={handleCreateContent}>
                <div className="form-section-block">
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
                    {contentForm.contentType === 'youtube' ? 'YouTube URL or video ID' : 'Source URL'}
                    <input name="url" value={contentForm.url} onChange={handleContentChange} required />
                  </label>
                </div>
                <DisclosurePanel title="Optional details" description="Tags, notes, and visibility settings." className="content-add-inner-disclosure">
                  <div className="form-section-block">
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
                        Duration (seconds)
                        <input
                          name="durationSeconds"
                          type="number"
                          min="0"
                          value={contentForm.durationSeconds}
                          onChange={handleContentChange}
                          placeholder="Optional runtime"
                        />
                      </label>
                    </div>
                    <div className="filter-grid">
                      <label>
                        Topic tags
                        <input name="topicTags" value={contentForm.topicTags} onChange={handleContentChange} placeholder="travel, greetings" />
                      </label>
                      <label>
                        Skill tags
                        <input name="skillTags" value={contentForm.skillTags} onChange={handleContentChange} placeholder="listening, vocabulary" />
                      </label>
                    </div>
                    <label>
                      Register tags
                      <input name="registerTags" value={contentForm.registerTags} onChange={handleContentChange} placeholder="casual, polite" />
                    </label>
                    <label>
                      Notes
                      <textarea name="description" value={contentForm.description} onChange={handleContentChange} rows="3" />
                    </label>
                  </div>
                </DisclosurePanel>
                <button type="submit" disabled={isSavingContent}>
                  {isSavingContent ? 'Saving...' : 'Save content'}
                </button>
              </form>
            </DisclosurePanel>
          </div>
        </aside>

        <div className="content-column content-detail-column">
          {isLoadingDetail ? (
            <div className="card empty-state empty-state-emphasis">
              <h4>Loading content</h4>
              <p className="muted-text">Fetching the selected source.</p>
            </div>
          ) : selectedContent ? (
            <div className="content-detail-stack">
              <div className="card content-viewer-card elevated-panel content-hero-panel">
                <div className="content-detail-header">
                  <div className="detail-block">
                    <p className="detail-kicker">
                      {selectedContent.visibility === 'private' ? 'Private upload' : selectedContent.isSystemContent ? 'Starter content' : 'Community content'}
                    </p>
                    <h3 className="detail-primary-text">{selectedContent.title}</h3>
                    <p className="muted-text detail-support-copy">
                      {selectedContent.sourceProvider} • {selectedContent.difficulty || 'Open level'} •{' '}
                      {selectedContent.durationSeconds ? formatSeconds(selectedContent.durationSeconds) : 'Length not set'}
                    </p>
                    <div className="mapped-column-tags">
                      <span className="mapped-column-tag">{selectedContent.visibilityLabel}</span>
                      {quickTags.map((tag) => (
                        <span key={tag} className="mapped-column-tag">
                          {tag.replaceAll('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="content-detail-actions">
                    {selectedContent.visibility !== 'private' ? (
                      <button type="button" className="secondary-button" onClick={() => handleToggleSave(selectedContent)}>
                        {selectedContent.isSaved ? 'Saved' : 'Save content'}
                      </button>
                    ) : (
                      <span className="mapped-column-tag">Private only</span>
                    )}
                  </div>
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
                    <p className="muted-text">This source is stored for later study, but an embedded player is not available.</p>
                  </div>
                )}
              </div>

              <div className="card elevated-panel content-study-focus-panel">
                <div className="section-stack-tight">
                  <p className="eyebrow-label">Study</p>
                  <h3>Study this content</h3>
                  <p className="muted-text">Refresh the study pack, then generate trusted flashcards when links are ready.</p>
                </div>

                <div className="content-readiness-grid">
                  <div className="subsurface-panel content-readiness-card">
                    <span className="content-readiness-value">{studySummary.listeningReadySegmentCount || 0}</span>
                    <span className="muted-text">listening-ready</span>
                  </div>
                  <div className="subsurface-panel content-readiness-card">
                    <span className="content-readiness-value">{studySummary.quizCandidateCount || 0}</span>
                    <span className="muted-text">quiz seeds</span>
                  </div>
                  <div className="subsurface-panel content-readiness-card">
                    <span className="content-readiness-value">{studySummary.trustedLinkedSegmentCount || 0}</span>
                    <span className="muted-text">trusted links</span>
                  </div>
                </div>

                <div className="content-primary-actions">
                  <button
                    type="button"
                    onClick={handleStartStudyFromContent}
                    disabled={isStartingContentStudy || !contentStudyPack?.items?.length}
                  >
                    {isStartingContentStudy ? 'Starting study...' : 'Start Study from this Content'}
                  </button>
                  <button type="button" onClick={() => loadContentStudyPack(selectedContentId)} disabled={isLoadingContentStudy}>
                    {isLoadingContentStudy ? 'Refreshing study...' : 'Refresh transcript-backed study'}
                  </button>
                  <div className="content-generate-inline">
                    <label>
                      Deck
                      <select value={targetDeckId} onChange={(event) => setTargetDeckId(event.target.value)}>
                        <option value="">No deck selected</option>
                        {decks.map((deck) => (
                          <option key={deck._id} value={deck._id}>
                            {deck.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isGeneratingStudy || !selectedContent.studyGenerationReady}
                      onClick={handleGenerateStudyFromContent}
                    >
                      {isGeneratingStudy ? 'Generating...' : 'Generate trusted flashcards'}
                    </button>
                  </div>
                </div>
                <DisclosurePanel
                  title="Study details"
                  description={
                    contentStudyPack?.items?.length
                      ? `${contentStudyPack.items.length} transcript-backed item${contentStudyPack.items.length === 1 ? '' : 's'} ready to preview.`
                      : 'No study items yet.'
                  }
                  defaultOpen={Boolean(contentStudyPack?.items?.length)}
                >
                  {contentStudyPack?.items?.length ? (
                    <div className="content-study-list">
                      {contentStudyPack.items.slice(0, 6).map((item) => (
                        <div key={item.id} className="content-transcript-item content-study-item">
                          <div className="content-transcript-time">
                            {formatSeconds(item.provenance?.startTimeSeconds)}-{formatSeconds(item.provenance?.endTimeSeconds)}
                          </div>
                          <div className="content-transcript-copy">
                            <div className="content-study-header">
                              <strong>{item.title}</strong>
                              <div className="content-summary-strip">
                                <span className="mapped-column-tag">{formatStudyLabel(item.generationType)}</span>
                                <span className="mapped-column-tag">{formatStudyLabel(item.trustState)}</span>
                              </div>
                            </div>
                            <span className="muted-text">{item.prompt}</span>
                            <span className="muted-text">{item.transcriptText}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text">Save transcript segments first. Quiz seeds only appear when trusted links exist.</p>
                  )}
                </DisclosurePanel>
              </div>

              <DisclosurePanel title="Transcript" description="Manual transcript workflow and current segments.">
                <div className="content-summary-strip">
                  <span className="mapped-column-tag">{transcriptSummary.segmentCount || 0} segments</span>
                  <span className="mapped-column-tag">{transcriptSummary.linkedSentenceCount || 0} sentence links</span>
                  <span className="mapped-column-tag">{transcriptSummary.linkedVocabularyCount || 0} vocab links</span>
                </div>
                <label>
                  Transcript source
                  <select value={transcriptSource} onChange={(event) => setTranscriptSource(event.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="youtube_caption">YouTube caption</option>
                    <option value="uploaded_file">Uploaded file</option>
                    <option value="trusted_link">Trusted link</option>
                  </select>
                </label>
                <label>
                  Transcript lines
                  <textarea
                    value={transcriptDraft}
                    onChange={(event) => setTranscriptDraft(event.target.value)}
                    rows="6"
                    placeholder={'0:00-0:04|こんにちは、今日はいい天気です。\n0:05-0:09|駅まで歩きましょう。'}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveTranscript}
                  disabled={isSavingTranscript || !transcriptDraft.trim() || !selectedContent.isOwnedByCurrentUser}
                >
                  {isSavingTranscript ? 'Saving transcript...' : 'Save transcript segments'}
                </button>
                {isLoadingTranscript ? (
                  <p className="muted-text">Loading transcript segments...</p>
                ) : transcriptSegments.length > 0 ? (
                  <div className="content-transcript-list">
                    {transcriptSegments.slice(0, 8).map((segment) => (
                      <div key={segment._id} className="content-transcript-item">
                        <div className="content-transcript-time">
                          {formatSeconds(segment.startTimeSeconds)}-{formatSeconds(segment.endTimeSeconds)}
                        </div>
                        <div className="content-transcript-copy">
                          <strong>{segment.rawText}</strong>
                          <span className="muted-text">
                            {formatStudyLabel(segment.validationStatus)} • {segment.trustedLinkCount || 0} trusted links
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-text">No transcript segments saved yet.</p>
                )}
              </DisclosurePanel>

              <DisclosurePanel title="Content info" description="Tags, source details, and learning metadata.">
                <div className="mapping-grid">
                  <div className="detail-section-card">
                    <h4>Overview</h4>
                    <p className="muted-text">Type: {selectedContent.contentType}</p>
                    <p className="muted-text">Source type: {selectedContent.sourceType}</p>
                    <p className="muted-text">Visibility: {selectedContent.visibilityLabel}</p>
                    <p className="muted-text">Transcript: {selectedContent.transcriptStatus}</p>
                  </div>
                  <div className="detail-section-card">
                    <h4>Tags</h4>
                    <div className="choice-chip-row">
                      {[...(selectedContent.topicTags || []), ...(selectedContent.registerTags || []), ...(selectedContent.skillTags || [])]
                        .slice(0, 10)
                        .map((tag) => (
                          <span key={tag} className="choice-chip">
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </DisclosurePanel>

              <DisclosurePanel title="Advanced" description="Pipeline status and quieter provenance details.">
                <div className="mapping-grid">
                  <div className="detail-section-card">
                    <h4>Pipeline</h4>
                    <p className="muted-text">Discovery source: {selectedContent.discoverySource}</p>
                    <p className="muted-text">Recommendation-ready: {selectedContent.recommendationEligible ? 'Yes' : 'No'}</p>
                    <p className="muted-text">Transcript source: {selectedContent.transcriptSource || 'none'}</p>
                    <p className="muted-text">Vocabulary links: {selectedContent.linkedVocabularyIds?.length || 0}</p>
                    <p className="muted-text">Sentence links: {selectedContent.linkedSentenceIds?.length || 0}</p>
                  </div>
                  <div className="detail-section-card">
                    <h4>Provenance</h4>
                    <p className="muted-text">Source URL: {selectedContent.sourceUrl || 'Not provided'}</p>
                    <p className="muted-text">Ingestion: {selectedContent.provenance?.ingestionMethod || 'manual'}</p>
                    <p className="muted-text">Snapshot title: {selectedContent.provenance?.sourceSnapshotTitle || selectedContent.title}</p>
                  </div>
                </div>
              </DisclosurePanel>
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis">
              <h4>Select content</h4>
              <p className="muted-text">Choose a source from the library to open its watch-and-study view.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentPage;
