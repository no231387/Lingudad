import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { getDashboardOverview, getDashboardStats } from '../services/flashcardService';

function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, mastered: 0, newCards: 0 });
  const [overview, setOverview] = useState({
    continueLearning: { sessions: [], savedContent: [] },
    dailyPractice: { dailyGoal: 0, reviewedToday: 0, remaining: 0 },
    recommendedContent: [],
    decks: []
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [{ data: statsData }, { data: overviewData }] = await Promise.all([
          getDashboardStats(),
          getDashboardOverview()
        ]);

        setStats(statsData);
        setOverview(overviewData);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, []);

  const hasSessions = overview.continueLearning.sessions.length > 0;
  const hasSavedContent = overview.continueLearning.savedContent.length > 0;
  const hasRecommendedContent = overview.recommendedContent.length > 0;
  const hasDecks = overview.decks.length > 0;

  return (
    <section className="page-section">
      <PageIntro
        eyebrow="Home"
        title="Dashboard"
        description="Continue learning, review daily progress, and open your saved resources."
        actions={
          <>
            <Link to="/study">Start study session</Link>
            <Link to="/content" className="secondary-button">
              Open content
            </Link>
          </>
        }
      />

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Continue Learning</h3>
                <p className="muted-text">Recent sessions and saved content.</p>
              </div>
            </div>

            <div className="dashboard-split-grid">
              <div className="subsurface-panel">
                <div className="section-stack-tight">
                  <h4>Recent sessions</h4>
                  <p className="muted-text">Open Study to continue review.</p>
                </div>
                {hasSessions ? (
                  <div className="dashboard-stack-list">
                    {overview.continueLearning.sessions.map((session) => (
                      <div key={session._id} className="dashboard-list-row">
                        <div>
                          <strong>{session.deck?.name || 'Mixed session'}</strong>
                          <p className="muted-text">{new Date(session.completedAt).toLocaleString()}</p>
                        </div>
                        <span className="mapped-column-tag">{session.reviewedCount} cards</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact-empty-state">
                    <h4>No study sessions</h4>
                    <p className="muted-text">Sessions appear here after you complete a review round.</p>
                  </div>
                )}
              </div>

              <div className="subsurface-panel">
                <div className="section-stack-tight">
                  <h4>Saved content</h4>
                  <p className="muted-text">Open saved media or add a new source.</p>
                </div>
                {hasSavedContent ? (
                  <div className="dashboard-stack-list">
                    {overview.continueLearning.savedContent.map((item) => (
                      <div key={item._id} className="dashboard-list-row">
                        <div>
                          <strong>{item.title}</strong>
                          <p className="muted-text">{item.sourceProvider}</p>
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
                    <p className="muted-text">Save content on the Content page to keep it here.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Recommended Content</h3>
                <p className="muted-text">Recent source-backed content for your target language.</p>
              </div>
              <Link className="button-link secondary-button" to="/content">
                View content
              </Link>
            </div>

            {hasRecommendedContent ? (
              <div className="list-grid">
                {overview.recommendedContent.map((item) => (
                  <article key={item._id} className="card content-preview-card">
                    <div className="section-stack-tight">
                      <h4>{item.title}</h4>
                      <p className="muted-text">
                        {item.language} | {item.sourceProvider} | {item.difficulty || 'No level'}
                      </p>
                    </div>
                    <Link className="button-link" to="/content">
                      Open content
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h4>No recommended content</h4>
                <p className="muted-text">Add YouTube content for your target language to populate this section.</p>
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
                Goal: {overview.dailyPractice.dailyGoal || 0} | Remaining: {overview.dailyPractice.remaining}
              </p>
            </div>

            <div className="stats-grid">
              <article className="card stat-card">
                <h3>Flashcards</h3>
                <p className="stat-number">{stats.total}</p>
                <p className="muted-text">Total cards</p>
              </article>
              <article className="card stat-card">
                <h3>New</h3>
                <p className="stat-number">{stats.newCards}</p>
                <p className="muted-text">At level 1</p>
              </article>
              <article className="card stat-card">
                <h3>Mastered</h3>
                <p className="stat-number">{stats.mastered}</p>
                <p className="muted-text">At level 5</p>
              </article>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-header">
              <div>
                <h3>Your Decks</h3>
                <p className="muted-text">Recent decks and current card counts.</p>
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
                      <p className="muted-text">{deck.language || 'Language not set'}</p>
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
