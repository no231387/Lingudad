import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getDecks, getStudySessions } from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, mastered: 0, newCards: 0 });
  const [deckCount, setDeckCount] = useState(0);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [{ data: statsData }, { data: deckData }, { data: sessionData }] = await Promise.all([
          getDashboardStats(),
          getDecks(),
          getStudySessions()
        ]);
        setStats(statsData);
        setDeckCount(deckData.length);
        setSessions(sessionData.slice(0, 5));
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      }
    };

    loadDashboard();
  }, []);

  const hasCards = stats.total > 0;
  const hasSessions = sessions.length > 0;

  return (
    <section className="page-section">
      <PageIntro
        eyebrow={`Home${user?.username ? ` • ${user.username}` : ''}`}
        title="Dashboard"
        description="Review status, recent sessions, and next actions."
        actions={
          <>
            <Link to="/study">Start study session</Link>
            <Link to="/flashcards" className="secondary-button">
              Manage flashcards
            </Link>
          </>
        }
        meta={
          <>
            <div className="dashboard-access-pill">
              <strong>Study</strong>
              <span className="muted-text">
                {hasCards ? 'Open a session to review your current cards.' : 'Add cards before starting a study session.'}
              </span>
            </div>
            <div className="dashboard-access-pill">
              <strong>Collection status</strong>
              <span className="muted-text">
                {hasCards
                  ? `${stats.total} cards across ${deckCount} deck${deckCount === 1 ? '' : 's'}.`
                  : 'No cards or decks yet.'}
              </span>
            </div>
          </>
        }
      />

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <div className="stats-grid stats-grid-compact">
            <article className="card stat-card">
              <h3>Flashcards</h3>
              <p className="stat-number">{stats.total}</p>
              <p className="muted-text">Cards ready to review</p>
            </article>
            <article className="card stat-card">
              <h3>Mastered</h3>
              <p className="stat-number">{stats.mastered}</p>
              <p className="muted-text">Cards at your strongest level</p>
            </article>
            <article className="card stat-card">
              <h3>New</h3>
              <p className="stat-number">{stats.newCards}</p>
              <p className="muted-text">Fresh cards still to learn</p>
            </article>
            <article className="card stat-card">
              <h3>Decks</h3>
              <p className="stat-number">{deckCount}</p>
              <p className="muted-text">Collections you can jump into</p>
            </article>
          </div>

          <div className="card dashboard-sessions-card">
            <div className="section-header">
              <div>
                <h3>Recent Study Sessions</h3>
                <p className="muted-text">Completed sessions appear here.</p>
              </div>
              <Link className="button-link secondary-button" to="/study">
                Open study
              </Link>
            </div>
            {!hasSessions ? (
              <div className="empty-state empty-state-emphasis">
                <h4>No sessions yet</h4>
                <p className="muted-text">Recent sessions will appear here after you complete a study round.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session._id} className="dashboard-session-row">
                  <div>
                    <p>
                      <strong>{new Date(session.completedAt).toLocaleString()}</strong>
                    </p>
                    <p className="muted-text">{session.deck ? session.deck.name : 'Mixed practice session'}</p>
                  </div>
                  <span className="mapped-column-tag">
                    {session.reviewedCount} cards
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="dashboard-secondary">
          <div className="card dashboard-focus-card">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Next action</p>
              <h3>{hasCards ? 'Continue review' : 'Set up your library'}</h3>
              <p className="muted-text">
                {hasCards
                  ? 'Use this area to move from deck management into study.'
                  : 'Create cards and decks to start using the study tools.'}
              </p>
            </div>

            <div className="dashboard-guidance-list">
              <div className="dashboard-guidance-item">
                <strong>{hasCards ? 'Review cards now' : 'Add your first cards'}</strong>
                <span className="muted-text">
                  {hasCards
                    ? 'Start a study session to review cards that still need repetition.'
                    : 'Create a small set of cards to begin organizing your library.'}
                </span>
              </div>
              <div className="dashboard-guidance-item">
                <strong>{deckCount > 0 ? 'Review deck structure' : 'Create a deck'}</strong>
                <span className="muted-text">
                  {deckCount > 0
                    ? 'Use decks to keep cards grouped by topic or lesson.'
                    : 'Create your first deck to start organizing cards.'}
                </span>
              </div>
            </div>

            <div className="page-intro-actions">
              <Link to={hasCards ? '/study' : '/flashcards'}>{hasCards ? 'Continue studying' : 'Open flashcards'}</Link>
              <Link to="/decks" className="secondary-button">
                Review decks
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
