import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { getDashboardOverview } from '../services/flashcardService';

const createDefaultOverview = () => ({
  stats: { total: 0, mastered: 0, newCards: 0 },
  continueLearning: { sessions: [], savedContent: [] },
  dailyPractice: { dailyGoal: 0, reviewedToday: 0, remaining: 0 },
  recommendedContent: [],
  recommendedPresets: [],
  decks: []
});

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

  const hasSessions = overview.continueLearning.sessions.length > 0;
  const hasSavedContent = overview.continueLearning.savedContent.length > 0;
  const hasRecommendedContent = overview.recommendedContent.length > 0;
  const hasRecommendedPresets = overview.recommendedPresets.length > 0;
  const hasDecks = overview.decks.length > 0;

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Home"
        title="Dashboard"
        description="Pick up where you left off, see today's progress, and jump into the next useful thing."
        actions={
          <>
            <Link to="/study">Start studying</Link>
            <Link to="/quiz" className="secondary-button">
              Open quizzes
            </Link>
            <Link to="/content" className="secondary-button">
              Open content
            </Link>
          </>
        }
      />

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="card dashboard-section dashboard-focus-card">
            <div className="section-header">
              <div>
                <p className="eyebrow-label">Continue</p>
                <h3>Continue learning</h3>
                <p className="muted-text">Your recent study and saved picks stay together so the next step is easy.</p>
              </div>
            </div>

            <div className="dashboard-split-grid">
              <div className="subsurface-panel">
                <div className="section-stack-tight">
                  <h4>Recent sessions</h4>
                  <p className="muted-text">Jump back into review from here.</p>
                </div>
                {hasSessions ? (
                  <div className="dashboard-stack-list">
                    {overview.continueLearning.sessions.map((session) => (
                      <div key={session._id} className="dashboard-list-row">
                        <div>
                          <strong>{session.deck?.name || 'Mixed session'}</strong>
                          <p className="muted-text detail-support-copy">{new Date(session.completedAt).toLocaleString()}</p>
                        </div>
                        <span className="mapped-column-tag">{session.reviewedCount} cards</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact-empty-state">
                    <h4>No study sessions</h4>
                    <p className="muted-text">Your recent sessions will show up here after you finish a round.</p>
                  </div>
                )}
              </div>

              <div className="subsurface-panel">
                <div className="section-stack-tight">
                  <h4>Saved content</h4>
                  <p className="muted-text">Keep favorite videos and sources close by.</p>
                </div>
                {hasSavedContent ? (
                  <div className="dashboard-stack-list">
                    {overview.continueLearning.savedContent.map((item) => (
                      <div key={item._id} className="dashboard-list-row">
                        <div>
                          <strong>{item.title}</strong>
                          <p className="muted-text detail-support-copy">{item.sourceProvider}</p>
                        </div>
                        <Link className="button-link secondary-button" to="/content">
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact-empty-state">
                    <h4>No saved content</h4>
                    <p className="muted-text">Save something from the Content page and it will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Recommended content</h3>
                <p className="muted-text">Picked to fit your goals, level, and the kind of language you want to practice.</p>
              </div>
              <Link className="button-link secondary-button" to="/content">
                View content
              </Link>
            </div>

            {hasRecommendedContent ? (
              <div className="list-grid dashboard-content-grid">
                {overview.recommendedContent.map((item) => (
                  <article key={item._id} className="card content-preview-card content-preview-card-compact">
                    <div className="content-preview-media" aria-hidden="true">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{item.contentType === 'youtube' ? 'YT' : 'SRC'}</span>}
                    </div>
                    <div className="section-stack-tight">
                      <h4>{item.title}</h4>
                      <p className="muted-text">{item.difficulty || 'Open level'} • {item.visibilityBadge || item.visibilityLabel}</p>
                    </div>
                    <Link className="button-link" to="/content">
                      Open
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h4>No recommended content</h4>
                <p className="muted-text">As you save and study more, Lingua will start surfacing better picks here.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="dashboard-secondary">
          <section className="card dashboard-section">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Daily Practice</p>
              <h3>{overview.dailyPractice.reviewedToday} reviewed today</h3>
              <p className="muted-text">
                Goal: {overview.dailyPractice.dailyGoal || 0} | Left today: {overview.dailyPractice.remaining}
              </p>
            </div>

            <div className="stats-grid">
              <article className="card stat-card">
                <h3>Flashcards</h3>
                <p className="stat-number">{overview.stats.total}</p>
                <p className="muted-text">Total cards</p>
              </article>
              <article className="card stat-card">
                <h3>New</h3>
                <p className="stat-number">{overview.stats.newCards}</p>
                <p className="muted-text">At level 1</p>
              </article>
              <article className="card stat-card">
                <h3>Mastered</h3>
                <p className="stat-number">{overview.stats.mastered}</p>
                <p className="muted-text">At level 5</p>
              </article>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Suggested presets</h3>
                <p className="muted-text">Study styles that fit the way you want to learn right now.</p>
              </div>
              <Link className="button-link secondary-button" to="/study">
                Use in study
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
              <div className="empty-state">
                <h4>No preset suggestions yet</h4>
                <p className="muted-text">Finish your profile so Lingua can suggest better study styles.</p>
              </div>
            )}
          </section>

          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Your Decks</h3>
                <p className="muted-text">Your recent decks and how many cards each one has.</p>
              </div>
              <Link className="button-link secondary-button" to="/decks">
                Open decks
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
