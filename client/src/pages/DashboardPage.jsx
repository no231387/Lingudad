import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getDecks, getStudySessions } from '../services/flashcardService';
import { useAuth } from '../context/AuthContext';

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

  return (
    <section className="page-section">
      <div className="card hero-card dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">Welcome back{user?.username ? `, ${user.username}` : ''}</p>
          <h2>Keep your practice simple.</h2>
          <p>Study now!</p>
        </div>
        <div className="dashboard-hero-side">
          <div className="dashboard-access-pill">
            <span className="muted-text">Manage your flashcards, decks, imports, and study sessions from one place.</span>
          </div>
          <div className="quick-links dashboard-quick-links">
            <Link to="/flashcards">Open Flashcards</Link>
            <Link to="/study" className="secondary-button">
              Start Study
            </Link>
          </div>
        </div>
      </div>

      <div className="stats-grid">
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
            <p className="muted-text">A quick glance at your latest review activity.</p>
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="muted-text">No study sessions recorded yet. Start a study round and it will show up here.</p>
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
                {session.reviewedCount}
                {' '}
                cards
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default DashboardPage;
