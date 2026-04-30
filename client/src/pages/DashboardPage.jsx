import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { getDashboardOverview } from '../services/apiService';
import { normalizeRecommendationItems } from '../utils/recommendationResponse';

const createDefaultOverview = () => ({
  stats: { total: 0, mastered: 0, newCards: 0 },
  continueLearning: { sessions: [], savedContent: [] },
  dailyPractice: { dailyGoal: 0, reviewedToday: 0, remaining: 0 },
  recommendedContent: [],
  recommendedPresets: [],
  decks: []
});

const RECENT_SESSIONS_HOME_LIMIT = 4;

function DashboardPage({ initialOverview = null, onOverviewLoaded }) {
  const [overview, setOverview] = useState(initialOverview || createDefaultOverview());

  useEffect(() => {
    if (initialOverview) {
      setOverview(initialOverview);
      return;
    }

    const loadDashboard = async () => {
      try {
        const { data: overviewData } = await getDashboardOverview();
        setOverview(overviewData);
        onOverviewLoaded?.(overviewData);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, [initialOverview, onOverviewLoaded]);

  const sessions = overview.continueLearning.sessions || [];
  const recentSessions = sessions.slice(0, RECENT_SESSIONS_HOME_LIMIT);
  const recommendedContent = normalizeRecommendationItems(overview.recommendedContent);
  const hasSessions = sessions.length > 0;
  const hasRecommendedContent = recommendedContent.length > 0;
  const hasRecommendedPresets = overview.recommendedPresets.length > 0;
  const hasDecks = overview.decks.length > 0;
  const totalFlashcards = overview.stats?.total ?? 0;
  const hasFlashcards = totalFlashcards > 0;
  const isNewUserFlow = !hasFlashcards && !hasDecks;

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Home"
        title={isNewUserFlow ? 'Start learning' : 'Continue learning'}
        description={
          isNewUserFlow
            ? 'Start from content, then generate flashcards to study and quiz.'
            : 'Resume study, review cards, or browse recommendations below.'
        }
        actions={
          <div className="page-intro-actions-stack dashboard-intro-actions">
            {isNewUserFlow ? (
              <>
                <Link to="/content" className="primary-button dashboard-intro-primary">
                  Learn from content
                </Link>
                <Link to="/flashcards" className="secondary-button">
                  Build your flashcards
                </Link>
              </>
            ) : (
              <>
                <Link to="/study" className="primary-button dashboard-intro-primary">
                  Resume study
                </Link>
                <Link to="/flashcards" className="secondary-button">
                  Review flashcards
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="card dashboard-section dashboard-recommended-band dashboard-home-recommended">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Recommended</p>
                <h3>Content for you</h3>
                <p className="muted-text">Matched to your level and goals.</p>
              </div>
              <Link className="secondary-button" to="/content?view=community">
                See all
              </Link>
            </div>

            {hasRecommendedContent ? (
              <div className="list-grid dashboard-content-grid">
                {recommendedContent.map((item) => (
                  <article key={item._id} className="card content-preview-card content-preview-card-compact content-preview-soft">
                    <div className="content-preview-media" aria-hidden="true">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{item.contentType === 'youtube' ? 'YT' : 'SRC'}</span>}
                    </div>
                    <div className="section-stack-tight">
                      <h4>{item.title}</h4>
                      <p className="muted-text">
                        {item.difficulty || 'Open level'} • {item.visibilityBadge || item.visibilityLabel}
                      </p>
                    </div>
                    <Link className="secondary-button" to={`/content?view=community&contentId=${item._id}`}>
                      Open
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state dashboard-guided-empty">
                <h4>No picks yet</h4>
                <p className="muted-text">As you study more, recommendations improve.</p>
              </div>
            )}
          </section>

          <section className="card dashboard-section dashboard-recent-slab">
            <div className="section-header dashboard-recent-header">
              <div>
                <p className="eyebrow-label">Recent</p>
                <p className="muted-text dashboard-recent-sub">Last study rounds.</p>
              </div>
            </div>

            {hasSessions ? (
              <div className="dashboard-stack-list dashboard-recent-list">
                {recentSessions.map((session) => (
                  <div key={session._id} className="dashboard-list-row dashboard-recent-row">
                    <div>
                      <strong>{session.deck?.name || 'Mixed session'}</strong>
                      <p className="muted-text detail-support-copy">{new Date(session.completedAt).toLocaleString()}</p>
                    </div>
                    <span className="mapped-column-tag">{session.reviewedCount} cards</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty-state dashboard-recent-empty">
                <p className="muted-text">No sessions yet.</p>
                <Link className="secondary-button" to="/study">
                  Go to Study
                </Link>
              </div>
            )}
          </section>
        </div>

        <aside className="dashboard-secondary dashboard-aside-rail dashboard-aside-flat">
          <section className="dashboard-section dashboard-aside-card dashboard-aside-slab surface-quiet">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Today</p>
              <h3>{overview.dailyPractice.reviewedToday} reviewed today</h3>
              <p className="muted-text">
                Goal: {overview.dailyPractice.dailyGoal || 0} | Left today: {overview.dailyPractice.remaining}
              </p>
            </div>

            <div className="stats-grid stats-grid-compact-aside">
              <article className="stat-card stat-card-flat">
                <h3>Flashcards</h3>
                <p className="stat-number">{overview.stats.total}</p>
                <p className="muted-text">Total cards</p>
              </article>
              <article className="stat-card stat-card-flat">
                <h3>New</h3>
                <p className="stat-number">{overview.stats.newCards}</p>
                <p className="muted-text">At level 1</p>
              </article>
              <article className="stat-card stat-card-flat">
                <h3>Mastered</h3>
                <p className="stat-number">{overview.stats.mastered}</p>
                <p className="muted-text">At level 5</p>
              </article>
            </div>
          </section>

          <section className="dashboard-section dashboard-aside-card dashboard-aside-slab surface-quiet">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Study style</p>
                <h3>Suggested presets</h3>
                <p className="muted-text">Based on your profile.</p>
              </div>
              <Link className="secondary-button" to="/study">
                Study
              </Link>
            </div>

            {hasRecommendedPresets ? (
              <div className="dashboard-stack-list">
                {overview.recommendedPresets.map((preset) => (
                  <div key={preset.id} className="dashboard-list-row">
                    <div>
                      <strong>{preset.name}</strong>
                      <p className="muted-text detail-support-copy">{preset.description}</p>
                    </div>
                    <span className="mapped-column-tag">
                      {preset.recommendationDebug?.scoreBreakdown?.recommendationBand?.replaceAll('_', ' ') || 'fit'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty-state">
                <h4>No suggestions yet</h4>
                <p className="muted-text">Complete onboarding for tailored presets.</p>
              </div>
            )}
          </section>

          <section className="dashboard-section dashboard-aside-card dashboard-aside-slab surface-quiet">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Organize</p>
                <h3>Your decks</h3>
                <p className="muted-text">Card counts by deck.</p>
              </div>
              <Link className="secondary-button" to="/decks">
                Decks
              </Link>
            </div>

            {hasDecks ? (
              <div className="dashboard-stack-list">
                {overview.decks.map((deck) => (
                  <div key={deck._id} className="dashboard-list-row">
                    <div>
                      <strong>{deck.name}</strong>
                      <p className="muted-text detail-support-copy">{deck.language || 'Language not set'}</p>
                    </div>
                    <span className="mapped-column-tag">{deck.flashcardCount} cards</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h4>No decks yet</h4>
                <p className="muted-text">Create your first deck to organize cards by topic or lesson.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
