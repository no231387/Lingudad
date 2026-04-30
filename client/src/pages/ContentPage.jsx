import { startTransition, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DisclosurePanel from '../components/DisclosurePanel';
import PageIntro from '../components/PageIntro';
import { buildContentAcquisitionPayload, summarizeContentAcquisitionResult } from '../utils/contentAcquisition';
import { normalizeRecommendationResponse } from '../utils/recommendationResponse';
import {
  createLearningContent,
  createWorkspaceCopyFromContent,
  generateFlashcardsFromContent,
  getContentStudyPack,
  getContentTranscriptSegments,
  getDecks,
  getLearningContent,
  getLearningContentById,
  getPlayableQuizItems,
  getRecommendedLearningContent,
  sourceAndPromoteYoutubeContent,
  startContentStudySession,
  saveContentTranscriptSegments,
  saveLearningContent,
  unsaveLearningContent
} from '../services/apiService';
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

const initialContentAcquisitionForm = {
  studyQuery: '',
  language: '',
  level: '',
  preferredTopics: '',
  preferredRegister: ''
};

const CONTENT_LIBRARY_VIEWS = [
  { id: 'community', label: 'Discover', description: 'Community and global library.' },
  { id: 'saved', label: 'Saved', description: 'Content you saved for later.' },
  { id: 'my_uploads', label: 'My content', description: 'Your uploads and private sources.' }
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

const VALID_CONTENT_VIEWS = new Set(['community', 'saved', 'my_uploads']);

function ContentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contentItems, setContentItems] = useState([]);
  const [recommendedContent, setRecommendedContent] = useState([]);
  const [recommendationMeta, setRecommendationMeta] = useState(null);
  const [contentSummary, setContentSummary] = useState({
    communityCount: 0,
    myUploadsCount: 0,
    savedCount: 0,
    recommendationReadyCount: 0
  });
  const [selectedContentId, setSelectedContentId] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentForm, setContentForm] = useState(initialContentForm);
  const [contentView, setContentView] = useState(() => {
    const view = searchParams.get('view');
    return view && VALID_CONTENT_VIEWS.has(view) ? view : 'community';
  });
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
  const [isCreatingWorkspaceCopy, setIsCreatingWorkspaceCopy] = useState(false);
  const [quickQuizItems, setQuickQuizItems] = useState([]);
  const [isLoadingQuickQuiz, setIsLoadingQuickQuiz] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [hasRecommendationError, setHasRecommendationError] = useState(false);
  const [contentAcquisitionForm, setContentAcquisitionForm] = useState(() => ({
    ...initialContentAcquisitionForm,
    language: user?.language || 'Japanese',
    level: user?.level || 'beginner',
    preferredTopics: user?.preferredTopics?.join(', ') || '',
    preferredRegister: user?.preferredRegister?.join(', ') || ''
  }));
  const [isFindingContent, setIsFindingContent] = useState(false);
  const [contentAcquisitionResult, setContentAcquisitionResult] = useState(null);
  const [contentAcquisitionError, setContentAcquisitionError] = useState('');

  const contentIdParam = searchParams.get('contentId');

  const tabCountForView = (viewId) => {
    if (viewId === 'community') return contentSummary.communityCount;
    if (viewId === 'saved') return contentSummary.savedCount;
    if (viewId === 'my_uploads') return contentSummary.myUploadsCount;
    return 0;
  };
  const isUploadedType = contentForm.contentType === 'uploaded';
  const quickTags = useMemo(() => (selectedContent ? getQuickTags(selectedContent) : []), [selectedContent]);
  const studySummary = contentStudyPack?.summary || {};
  const practiceListeningCount = studySummary.listeningReadySegmentCount || 0;
  const practiceQuizCount = studySummary.quizCandidateCount || 0;
  const practiceMatchesCount = studySummary.trustedLinkedSegmentCount || 0;
  const practiceMetricsAllZero = practiceListeningCount === 0 && practiceQuizCount === 0 && practiceMatchesCount === 0;
  const canEditTranscript = Boolean(selectedContent?.isOwnedByCurrentUser);
  const canCreateWorkspaceCopy = Boolean(selectedContent?.canCreateWorkspaceCopy);
  const contentAcquisitionSummary = useMemo(
    () => (contentAcquisitionResult ? summarizeContentAcquisitionResult(contentAcquisitionResult) : null),
    [contentAcquisitionResult]
  );

  const quickQuizHref = useMemo(() => {
    if (!selectedContent?._id || !quickQuizItems.length) {
      return '';
    }

    const params = new URLSearchParams();
    params.set('sourceMode', 'from_practice');
    params.set('contentId', selectedContent._id);
    params.set('contentTitle', selectedContent.title || '');
    params.set('quizItemIds', quickQuizItems.map((q) => q.id).join(','));

    return `/quiz?${params.toString()}`;
  }, [selectedContent, quickQuizItems]);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view && VALID_CONTENT_VIEWS.has(view)) {
      setContentView(view);
    }
  }, [searchParams]);

  useEffect(() => {
    setContentAcquisitionForm((previous) => ({
      ...previous,
      language: previous.language || user?.language || 'Japanese',
      level: previous.level || user?.level || 'beginner',
      preferredTopics: previous.preferredTopics || user?.preferredTopics?.join(', ') || '',
      preferredRegister: previous.preferredRegister || user?.preferredRegister?.join(', ') || ''
    }));
  }, [user?.language, user?.level, user?.preferredRegister, user?.preferredTopics]);

  useEffect(() => {
    if (contentIdParam) {
      setSelectedContentId(contentIdParam);
    }
  }, [contentIdParam]);

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [deckResult, contentResult] = await Promise.allSettled([
          getDecks(),
          getLearningContent({
            language: user?.language || 'Japanese',
            scope: contentView,
            q: contentQuery
          })
        ]);

        const deckData = deckResult.status === 'fulfilled' ? deckResult.value.data : [];
        const contentData =
          contentResult.status === 'fulfilled'
            ? contentResult.value.data
            : { items: [], summary: { communityCount: 0, myUploadsCount: 0, savedCount: 0, recommendationReadyCount: 0 } };

        const items = contentData.items || [];
        const ids = new Set(items.map((item) => item._id));

        startTransition(() => {
          setDecks(deckData);
          setContentItems(items);
          setContentSummary(contentData.summary || {});
          setSelectedContentId((current) => {
            if (current && ids.has(current)) return current;
            return items[0]?._id || '';
          });
        });
      } catch (error) {
        console.error('Failed to load content page:', error);
      }
    };

    loadPageData();
  }, [contentQuery, contentView, user?.language]);

  const loadRecommendations = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setIsLoadingRecommendations(true);
      }
      setHasRecommendationError(false);

      const { data } = await getRecommendedLearningContent({
        language: user?.language || 'Japanese',
        limit: 4
      });
      const normalized = normalizeRecommendationResponse(data);

      setRecommendedContent(normalized.items);
      setRecommendationMeta(normalized.meta);

      if (import.meta.env.DEV) {
        console.debug('Content recommendations loaded', {
          itemCount: normalized.items.length,
          meta: normalized.meta
        });
      }
    } catch (error) {
      console.error('Failed to load recommended content:', error);
      setRecommendedContent([]);
      setRecommendationMeta(null);
      setHasRecommendationError(true);
    } finally {
      if (!silent) {
        setIsLoadingRecommendations(false);
      }
    }
  };

  useEffect(() => {
    if (contentView !== 'community') {
      setIsLoadingRecommendations(false);
      setHasRecommendationError(false);
      setRecommendationMeta(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoadingRecommendations(true);
        setHasRecommendationError(false);

        const { data } = await getRecommendedLearningContent({
          language: user?.language || 'Japanese',
          limit: 4
        });
        const normalized = normalizeRecommendationResponse(data);

        if (cancelled) {
          return;
        }

        setRecommendedContent(normalized.items);
        setRecommendationMeta(normalized.meta);
      } catch (error) {
        console.error('Failed to load recommended content:', error);

        if (cancelled) {
          return;
        }

        setRecommendedContent([]);
        setRecommendationMeta(null);
        setHasRecommendationError(true);
      } finally {
        if (!cancelled) {
          setIsLoadingRecommendations(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentView, user?.language]);

  const refreshContent = async (preferredContentId = '', scopeOverride = '') => {
    const { data } = await getLearningContent({
      language: user?.language || 'Japanese',
      scope: scopeOverride || contentView,
      q: contentQuery
    });

    const items = data.items || [];
    const ids = new Set(items.map((item) => item._id));

    startTransition(() => {
      setContentItems(items);
      setContentSummary(data.summary || {});
      setSelectedContentId((current) => {
        if (preferredContentId && ids.has(preferredContentId)) return preferredContentId;
        if (current && ids.has(current)) return current;
        return items[0]?._id || '';
      });
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
    if (!selectedContentId) {
      setQuickQuizItems([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoadingQuickQuiz(true);
        const { data } = await getPlayableQuizItems({ learningContentId: selectedContentId, limit: 12 });
        if (!cancelled) {
          setQuickQuizItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to load quick quiz items:', error);
        if (!cancelled) {
          setQuickQuizItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuickQuiz(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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

  const handleContentAcquisitionChange = (event) => {
    const { name, value } = event.target;
    setContentAcquisitionForm((previous) => ({ ...previous, [name]: value }));
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
      setMessage(error.response?.data?.message || 'Could not update your saved content.');
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
      setMessage(data.message || 'Flashcards added from this content.');
    } catch (error) {
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not generate study from content.');
    } finally {
      setIsGeneratingStudy(false);
    }
  };

  const handleCreateWorkspaceCopy = async () => {
    if (!selectedContent) {
      return;
    }

    try {
      setIsCreatingWorkspaceCopy(true);
      setMessage('');
      const { data } = await createWorkspaceCopyFromContent(selectedContent._id);
      const workspaceContent = data.content;

      if (contentView !== 'my_uploads') {
        setContentView('my_uploads');
      }

      setSelectedContentId(workspaceContent._id);
      await refreshContent(workspaceContent._id, 'my_uploads');
      setMessage(data.message || 'Saved copy ready.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save a copy of this content.');
    } finally {
      setIsCreatingWorkspaceCopy(false);
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
      const sessionMessage = error.response?.data?.session?.message;
      setMessage(sessionMessage || error.response?.data?.message || 'Could not start study from this content.');
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
      setMessage('Lines saved and matched where Lingua found solid study links.');
    } catch (error) {
      setMessage(error.response?.data?.error || error.response?.data?.message || 'Could not save transcript segments.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleFindContent = async (event) => {
    event.preventDefault();

    if (!contentAcquisitionForm.studyQuery.trim()) {
      setContentAcquisitionError('Tell Lingua what kind of content you want to study.');
      return;
    }

    try {
      setIsFindingContent(true);
      setContentAcquisitionError('');
      setContentAcquisitionResult(null);
      setMessage('');

      const payload = buildContentAcquisitionPayload({
        formState: contentAcquisitionForm,
        user
      });
      const { data } = await sourceAndPromoteYoutubeContent(payload);
      const firstReadyItem = (data.candidates || []).find((candidate) => candidate.recommendationEligible && candidate.contentId);
      const firstAddedItem = (data.candidates || []).find((candidate) => candidate.contentId);
      const preferredContentId = firstReadyItem?.contentId || firstAddedItem?.contentId || '';

      setContentAcquisitionResult(data);
      await refreshContent(preferredContentId, 'community');
      await loadRecommendations({ silent: true });
      if (preferredContentId) {
        setContentView('community');
        setSelectedContentId(preferredContentId);
      }
    } catch (error) {
      console.error('Failed to source and promote content:', error);
      setContentAcquisitionError(error.response?.data?.message || 'Couldn’t source content right now.');
    } finally {
      setIsFindingContent(false);
    }
  };

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Content"
        title="Browse, watch, practice"
        description="Pick sources, build flashcards, then study and quiz. Content is the entry point."
        className="content-page-intro"
        meta={
          <div className="content-hero-stats" role="group" aria-label="Library overview">
            <div className="content-hero-stat">
              <span className="content-hero-stat-value">{contentSummary.communityCount || 0}</span>
              <span className="content-hero-stat-label">In library</span>
            </div>
            <span className="content-hero-stat-divider" aria-hidden="true" />
            <div className="content-hero-stat">
              <span className="content-hero-stat-value">{contentSummary.savedCount || 0}</span>
              <span className="content-hero-stat-label">Saved</span>
            </div>
            <span className="content-hero-stat-divider" aria-hidden="true" />
            <div className="content-hero-stat">
              <span className="content-hero-stat-value">{contentSummary.recommendationReadyCount || 0}</span>
              <span className="content-hero-stat-label">Ready for practice</span>
            </div>
          </div>
        }
      />

      {message ? <div className="card status-panel">{message}</div> : null}

      <div className="content-page-grid content-page-grid-refined">
        <aside className="content-column content-library-column">
          <div className="card elevated-panel content-library-panel content-library-panel-refined content-library-panel-light surface-quiet">
            <div className="section-stack-tight content-library-heading">
              <p className="eyebrow-label">1 · Browse</p>
              <h3>Browse</h3>
              <p className="muted-text">Library, saved, and personal content.</p>
            </div>

            <div className="content-view-tabs" role="tablist" aria-label="Content sources">
              {CONTENT_LIBRARY_VIEWS.map((view) => {
                const count = tabCountForView(view.id);

                return (
                  <button
                    key={view.id}
                    type="button"
                    role="tab"
                    aria-selected={contentView === view.id}
                    className={`content-view-tab ${contentView === view.id ? 'is-selected' : ''}`}
                    onClick={() => setContentView(view.id)}
                  >
                    <span className="content-view-tab-label">{view.label}</span>
                    <span className="content-view-tab-count">{count || 0}</span>
                  </button>
                );
              })}
            </div>

            <label className="content-search-field">
              Search
              <input value={contentQuery} onChange={(event) => setContentQuery(event.target.value)} placeholder="Search by title, tag, or source" />
            </label>

            {contentView === 'community' ? (
              <div className="section-stack-tight">
                <div className="section-header content-library-subheader">
                  <div>
                    <h4>Recommended for you</h4>
                    <p className="muted-text">
                      {recommendationMeta?.isColdStart ? 'A few good places to start.' : 'Picked for your next practice round.'}
                    </p>
                  </div>
                </div>
                {isLoadingRecommendations ? (
                  <div className="empty-state compact-empty-state">
                    <p className="muted-text">Finding a few good picks for you.</p>
                  </div>
                ) : hasRecommendationError ? (
                  <div className="empty-state compact-empty-state">
                    <p className="muted-text">Recommendations are unavailable right now. Browse the library below.</p>
                  </div>
                ) : recommendedContent.length ? (
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
                ) : (
                  <div className="empty-state compact-empty-state">
                    <p className="muted-text">No recommendations yet. Browse the library below.</p>
                  </div>
                )}

                <DisclosurePanel
                  key={`content-find-${contentAcquisitionResult ? 'result' : 'idle'}-${contentAcquisitionError ? 'error' : 'ok'}-${isFindingContent ? 'loading' : 'ready'}`}
                  title="Find content"
                  description="Bring in content based on what you want to study."
                  defaultOpen={Boolean(contentAcquisitionResult || contentAcquisitionError)}
                  className="content-acquisition-disclosure"
                >
                  <form className="content-acquisition-form" onSubmit={handleFindContent}>
                    <label>
                      Tell Lingua what kind of content you want
                      <input
                        name="studyQuery"
                        value={contentAcquisitionForm.studyQuery}
                        onChange={handleContentAcquisitionChange}
                        placeholder="beginner Japanese listening"
                        disabled={isFindingContent}
                      />
                    </label>
                    <div className="filter-grid">
                      <label>
                        Language
                        <input name="language" value={contentAcquisitionForm.language} onChange={handleContentAcquisitionChange} disabled={isFindingContent} />
                      </label>
                      <label>
                        Level
                        <select name="level" value={contentAcquisitionForm.level} onChange={handleContentAcquisitionChange} disabled={isFindingContent}>
                          <option value="">Use my profile</option>
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </label>
                    </div>
                    <div className="filter-grid">
                      <label>
                        Topics
                        <input
                          name="preferredTopics"
                          value={contentAcquisitionForm.preferredTopics}
                          onChange={handleContentAcquisitionChange}
                          placeholder="travel, daily_conversation"
                          disabled={isFindingContent}
                        />
                      </label>
                      <label>
                        Register
                        <input
                          name="preferredRegister"
                          value={contentAcquisitionForm.preferredRegister}
                          onChange={handleContentAcquisitionChange}
                          placeholder="casual, polite"
                          disabled={isFindingContent}
                        />
                      </label>
                    </div>
                    <div className="content-acquisition-actions">
                      <button type="submit" className="secondary-button" disabled={isFindingContent || !contentAcquisitionForm.studyQuery.trim()}>
                        {isFindingContent ? 'Finding content...' : 'Find content'}
                      </button>
                      <p className="muted-text content-acquisition-hint">
                        {isFindingContent ? 'Checking transcripts and learning readiness...' : 'Examples: casual Japanese travel phrases, polite daily conversation in Japanese'}
                      </p>
                    </div>
                  </form>

                  {contentAcquisitionError ? (
                    <div className="empty-state compact-empty-state content-acquisition-feedback">
                      <h4>Couldn’t source content right now</h4>
                      <p className="muted-text">{contentAcquisitionError}</p>
                    </div>
                  ) : null}

                  {contentAcquisitionSummary ? (
                    <div className={`card content-acquisition-summary content-acquisition-summary--${contentAcquisitionSummary.tone}`}>
                      <div className="content-acquisition-summary-copy">
                        <h4>{contentAcquisitionSummary.title}</h4>
                        <p className="muted-text">{contentAcquisitionSummary.summary}</p>
                      </div>
                      <div className="mapped-column-tags content-acquisition-facts">
                        {contentAcquisitionSummary.facts.map((fact) => (
                          <span key={fact} className="mapped-column-tag">
                            {fact}
                          </span>
                        ))}
                      </div>
                      {contentAcquisitionSummary.suggestion ? <p className="muted-text">{contentAcquisitionSummary.suggestion}</p> : null}

                      <DisclosurePanel
                        title="See what was checked"
                        description="A quick view of ready items and content that still needs work."
                        className="content-acquisition-result-details"
                      >
                        <div className="content-acquisition-result-list">
                          {(contentAcquisitionResult.candidates || []).map((candidate) => (
                            <div key={`${candidate.contentId || candidate.youtubeId}-${candidate.title}`} className="content-acquisition-result-row">
                              <div>
                                <strong>{candidate.title || 'Untitled source'}</strong>
                                <p className="muted-text">
                                  {candidate.recommendationEligible
                                    ? 'Ready to practice now'
                                    : candidate.contentId
                                      ? 'Added, but not ready yet'
                                      : 'Not added'}
                                </p>
                              </div>
                              <div className="mapped-column-tags">
                                <span className="mapped-column-tag">
                                  {candidate.recommendationEligible ? 'Ready now' : candidate.contentId ? 'Needs more work' : 'No match'}
                                </span>
                                {candidate.persistenceStatus ? <span className="mapped-column-tag">{candidate.persistenceStatus === 'created' ? 'Added' : 'Rechecked'}</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </DisclosurePanel>
                    </div>
                  ) : null}
                </DisclosurePanel>
              </div>
            ) : null}

            <div className="section-stack-tight">
                <div className="section-header content-library-subheader">
                  <div>
                    <h4 className="content-library-section-title">
                      {contentView === 'community' ? 'Library' : contentView === 'saved' ? 'Saved' : 'Your content'}
                    </h4>
                    <p className="muted-text content-library-section-hint">Open one item.</p>
                  </div>
                </div>
              <div className="content-list content-list-refined">
                {contentItems.length === 0 ? (
                  <div className="empty-state content-empty-state">
                    {contentView === 'saved' ? (
                      <>
                        <h4>No saved content yet</h4>
                        <p className="muted-text">Save content to return to it later.</p>
                        <button type="button" className="secondary-button content-empty-state-cta" onClick={() => setContentView('community')}>
                          Go to Discover
                        </button>
                      </>
                    ) : (
                      <>
                        <h4>{contentView === 'community' ? 'No content yet' : 'No uploads yet'}</h4>
                        <p className="muted-text">
                          {contentView === 'community'
                            ? 'Community content will appear here as the library grows.'
                            : 'Add your own source when you want to save notes and practice from it.'}
                        </p>
                      </>
                    )}
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
            <div className="content-detail-stack content-detail-stack-focused">
              <p className="content-detail-rail-label">2 · Focus</p>
              <div className="card content-viewer-card elevated-panel content-hero-panel">
                <div className="content-hero-top">
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
                        {selectedContent.isWorkspaceCopy ? <span className="mapped-column-tag">Saved copy</span> : null}
                        {quickTags.map((tag) => (
                          <span key={tag} className="mapped-column-tag">
                            {tag.replaceAll('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="content-save-strip" aria-label="Save to your library">
                    {selectedContent.visibility !== 'private' ? (
                      <>
                        <button
                          type="button"
                          className={`secondary-button content-save-toggle ${selectedContent.isSaved ? 'content-save-toggle--saved' : ''}`}
                          onClick={() => handleToggleSave(selectedContent)}
                          aria-pressed={selectedContent.isSaved}
                        >
                          {selectedContent.isSaved ? (
                            <>
                              <span className="content-save-toggle-check" aria-hidden="true">
                                ✓
                              </span>
                              Saved
                            </>
                          ) : (
                            'Save for later'
                          )}
                        </button>
                        {canCreateWorkspaceCopy ? (
                          <button type="button" className="secondary-button" onClick={handleCreateWorkspaceCopy} disabled={isCreatingWorkspaceCopy}>
                            {isCreatingWorkspaceCopy ? 'Saving...' : 'Create editable copy'}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="mapped-column-tag">{selectedContent.isWorkspaceCopy ? 'You can edit this' : 'Only you can see this'}</span>
                    )}
                  </div>
                </div>

                {selectedContent.contentType === 'youtube' && selectedContent.embedUrl ? (
                  <div className="video-frame-wrapper content-video-focus">
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
                <p className="content-practice-context muted-text">
                  From: <span className="content-practice-context-title">{selectedContent.title}</span>
                </p>

                <div className="content-practice-head">
                  <p className="eyebrow-label">3 · Practice</p>
                  <h3>Practice this content</h3>
                  <p className="muted-text">Start a quick session from this source.</p>
                </div>

                {practiceMetricsAllZero ? (
                  <p className="muted-text content-practice-metrics-empty">No items generated yet.</p>
                ) : (
                  <div className="content-readiness-grid content-readiness-support content-practice-readiness">
                    <div className="content-readiness-stat">
                      <span className="content-readiness-value">{practiceListeningCount}</span>
                      <span className="muted-text">listening clips</span>
                    </div>
                    <div className="content-readiness-stat">
                      <span className="content-readiness-value">{practiceQuizCount}</span>
                      <span className="muted-text">questions</span>
                    </div>
                    <div className="content-readiness-stat">
                      <span className="content-readiness-value">{practiceMatchesCount}</span>
                      <span className="muted-text">matches</span>
                    </div>
                  </div>
                )}

                <div className="content-practice-cta">
                  <button
                    type="button"
                    className="primary-button content-practice-start"
                    onClick={handleStartStudyFromContent}
                    disabled={isStartingContentStudy || !contentStudyPack?.items?.length}
                  >
                    {isStartingContentStudy ? 'Starting...' : 'Start practice'}
                  </button>
                </div>

                <div className="content-practice-secondary-actions">
                  {!canEditTranscript && canCreateWorkspaceCopy ? (
                    <button type="button" className="secondary-button" onClick={handleCreateWorkspaceCopy} disabled={isCreatingWorkspaceCopy}>
                      {isCreatingWorkspaceCopy ? 'Saving...' : 'Create editable copy'}
                    </button>
                  ) : null}
                  <button type="button" className="text-action" onClick={() => loadContentStudyPack(selectedContentId)} disabled={isLoadingContentStudy}>
                    {isLoadingContentStudy ? 'Updating...' : 'Refresh practice set'}
                  </button>
                </div>

                <div className="content-practice-deck-row content-practice-setup">
                  <label className="content-practice-deck-label">
                    Deck (optional)
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
                    className="secondary-button content-practice-add-cards"
                    disabled={isGeneratingStudy || !selectedContent.studyGenerationReady}
                    onClick={handleGenerateStudyFromContent}
                  >
                    {isGeneratingStudy ? 'Adding...' : 'Add flashcards'}
                  </button>
                </div>

                <div className="content-practice-quick-check">
                  <p className="eyebrow-label">Quick check</p>
                  <p className="muted-text">Test what you just practiced.</p>
                  {isLoadingQuickQuiz ? (
                    <p className="muted-text">Loading...</p>
                  ) : quickQuizHref ? (
                    <Link to={quickQuizHref} className="secondary-button content-practice-quick-quiz-cta">
                      Start quick quiz
                    </Link>
                  ) : (
                    <p className="muted-text">No quiz items for this content yet.</p>
                  )}
                </div>

                <DisclosurePanel
                  title="Practice set"
                  description={
                    contentStudyPack?.items?.length
                      ? `${contentStudyPack.items.length} item${contentStudyPack.items.length === 1 ? '' : 's'} in your practice set.`
                      : 'Your practice set is empty.'
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
                                <span className="mapped-column-tag">{item.trustState === 'trusted' ? 'Matched' : formatStudyLabel(item.trustState)}</span>
                              </div>
                            </div>
                            <span className="muted-text">{item.prompt}</span>
                            <span className="muted-text">{item.transcriptText}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text">Save lines first. Questions appear after Lingua finds solid matches.</p>
                  )}
                </DisclosurePanel>
              </div>

              <DisclosurePanel
                title="Transcript & details"
                description="Lines, tags, and source info—open when you need them."
                defaultOpen={false}
                className="content-details-merged"
              >
                <div className="content-details-section">
                  <h4 className="content-details-heading">Transcript</h4>
                  <div className="content-summary-strip">
                    <span className="mapped-column-tag">{transcriptSummary.segmentCount || 0} lines</span>
                    <span className="mapped-column-tag">{transcriptSummary.linkedSentenceCount || 0} sentence matches</span>
                    <span className="mapped-column-tag">{transcriptSummary.linkedVocabularyCount || 0} word matches</span>
                  </div>
                  {canEditTranscript ? (
                    <>
                      <label>
                        Line source
                        <select value={transcriptSource} onChange={(event) => setTranscriptSource(event.target.value)}>
                          <option value="manual">Manual</option>
                          <option value="youtube_caption">YouTube caption</option>
                          <option value="uploaded_file">Uploaded file</option>
                          <option value="trusted_link">Trusted link</option>
                        </select>
                      </label>
                      <label>
                        Lines with timing
                        <textarea
                          value={transcriptDraft}
                          onChange={(event) => setTranscriptDraft(event.target.value)}
                          rows="6"
                          placeholder={'0:00-0:04|こんにちは、今日はいい天気です。\n0:05-0:09|駅まで歩きましょう。'}
                        />
                      </label>
                      <button type="button" className="secondary-button" onClick={handleSaveTranscript} disabled={isSavingTranscript || !transcriptDraft.trim()}>
                        {isSavingTranscript ? 'Saving lines...' : 'Save lines'}
                      </button>
                    </>
                  ) : (
                    <div className="empty-state compact-empty-state">
                      <p className="muted-text">
                        Shared sources are read-only here. Create an editable copy to add lines, link matches, and build flashcards.
                      </p>
                      {canCreateWorkspaceCopy ? (
                        <button type="button" className="secondary-button" onClick={handleCreateWorkspaceCopy} disabled={isCreatingWorkspaceCopy}>
                          {isCreatingWorkspaceCopy ? 'Saving...' : 'Create editable copy'}
                        </button>
                      ) : null}
                    </div>
                  )}
                  {isLoadingTranscript ? (
                    <p className="muted-text">Loading saved lines...</p>
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
                              {formatStudyLabel(segment.validationStatus)} • {segment.trustedLinkCount || 0} matches
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text">No lines saved yet.</p>
                  )}
                </div>

                <div className="content-details-section">
                  <h4 className="content-details-heading">About</h4>
                  <div className="mapping-grid content-details-about">
                    <div className="detail-section-card detail-section-card-plain">
                      <p className="muted-text">Type: {selectedContent.contentType}</p>
                      <p className="muted-text">Source type: {selectedContent.sourceType}</p>
                      <p className="muted-text">Visibility: {selectedContent.visibilityLabel}</p>
                      <p className="muted-text">Saved lines: {selectedContent.transcriptStatus}</p>
                    </div>
                    <div className="detail-section-card detail-section-card-plain">
                      <p className="muted-text detail-section-label">Tags</p>
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
                </div>

                <div className="content-details-section">
                  <h4 className="content-details-heading">Status & source</h4>
                  <div className="mapping-grid">
                    <div className="detail-section-card detail-section-card-plain">
                      <p className="muted-text">Found from: {selectedContent.discoverySource}</p>
                      <p className="muted-text">Ready to practice: {selectedContent.recommendationEligible ? 'Yes' : 'No'}</p>
                      <p className="muted-text">Line source: {selectedContent.transcriptSource || 'none'}</p>
                      <p className="muted-text">Word matches: {selectedContent.linkedVocabularyIds?.length || 0}</p>
                      <p className="muted-text">Sentence matches: {selectedContent.linkedSentenceIds?.length || 0}</p>
                    </div>
                    <div className="detail-section-card detail-section-card-plain">
                      <p className="muted-text">Copy type: {selectedContent.isWorkspaceCopy ? 'Saved copy' : 'Shared (original)'}</p>
                      {selectedContent.workspaceSourceContentId ? (
                        <p className="muted-text">Original shared item: {selectedContent.workspaceSourceContentId}</p>
                      ) : null}
                      <p className="muted-text">Source URL: {selectedContent.sourceUrl || 'Not provided'}</p>
                      <p className="muted-text">Added by: {selectedContent.provenance?.ingestionMethod || 'manual'}</p>
                      <p className="muted-text">Saved title: {selectedContent.provenance?.sourceSnapshotTitle || selectedContent.title}</p>
                    </div>
                  </div>
                </div>
              </DisclosurePanel>
            </div>
          ) : (
            <div className="card empty-state empty-state-emphasis content-detail-empty">
              <p className="eyebrow-label">Focus</p>
              <h4>Select something to watch</h4>
              <p className="muted-text">Pick an item from the list on the left to open the player and practice tools here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentPage;
