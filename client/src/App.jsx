import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import FlashcardListPage from './pages/FlashcardListPage';
import CommunityFlashcardsPage from './pages/CommunityFlashcardsPage';
import AddFlashcardPage from './pages/AddFlashcardPage';
import DecksPage from './pages/DecksPage';
import EditFlashcardPage from './pages/EditFlashcardPage';
import OfficialBeginnerDecksPage from './pages/OfficialBeginnerDecksPage';
import StudySessionPage from './pages/StudySessionPage';
import ImportFlashcardsPage from './pages/ImportFlashcardsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { getDashboardStats, getDecks, getStudySessions } from './services/flashcardService';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('linguacards_theme') || 'light');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileStats, setProfileStats] = useState({
    cards: 0,
    decks: 0,
    studySessions: 0
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('linguacards_theme', theme);
  }, [theme]);

  useEffect(() => {
    const loadProfileStats = async () => {
      if (!isAuthenticated) {
        setProfileStats({ cards: 0, decks: 0, studySessions: 0 });
        setIsProfileOpen(false);
        return;
      }

      try {
        const [{ data: statsData }, { data: deckData }, { data: sessionData }] = await Promise.all([
          getDashboardStats(),
          getDecks(),
          getStudySessions()
        ]);

        setProfileStats({
          cards: statsData.total || 0,
          decks: deckData.length || 0,
          studySessions: sessionData.length || 0
        });
      } catch (error) {
        console.error('Failed to load profile stats:', error);
      }
    };

    loadProfileStats();
  }, [isAuthenticated]);

  const toggleTheme = () => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-top-row">
            {user ? <span className="welcome-text">Welcome, {user.username}</span> : <span />}
            <div className="header-actions">
              <button type="button" onClick={toggleTheme} className="theme-toggle secondary-button">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              {user && (
                <div className="profile-menu">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen((previous) => !previous)}
                    className="profile-trigger"
                    aria-expanded={isProfileOpen}
                    aria-label="Open profile panel"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-icon">
                      <path
                        d="M12 12.2a4.1 4.1 0 1 0-4.1-4.1 4.1 4.1 0 0 0 4.1 4.1Zm0 2c-4.2 0-7.6 2.3-7.6 5.1V21h15.2v-1.7c0-2.8-3.4-5.1-7.6-5.1Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  {isProfileOpen && (
                    <div className="profile-panel card">
                      <div className="profile-panel-header">
                        <div>
                          <h3>{user.username}</h3>
                          <p className="muted-text">Signed in account</p>
                        </div>
                      </div>
                      <div className="profile-stats">
                        <div className="profile-stat">
                          <span className="profile-stat-value">{profileStats.cards}</span>
                          <span className="muted-text">Cards</span>
                        </div>
                        <div className="profile-stat">
                          <span className="profile-stat-value">{profileStats.decks}</span>
                          <span className="muted-text">Decks</span>
                        </div>
                        <div className="profile-stat">
                          <span className="profile-stat-value">{profileStats.studySessions}</span>
                          <span className="muted-text">Study Sessions</span>
                        </div>
                      </div>
                      <button type="button" onClick={logout} className="secondary-button profile-logout-button">
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1>LinguaCards</h1>
          <p>
          Simple language flashcards for simple practice.
          </p>
          {user && (
            <div className="role-banner">
              <span className="role-text">Logged in as {user.username}</span>
            </div>
          )}
        </div>
      </header>

      <div className="nav-shell">
        <nav className="nav-bar">
          {isAuthenticated ? (
            <>
              <NavLink to="/" end>
                Home
              </NavLink>
              <NavLink to="/decks">Decks</NavLink>
              <NavLink to="/official-beginner-decks">Official Beginner Decks</NavLink>
              <NavLink to="/flashcards">Flashcards</NavLink>
              <NavLink to="/community">Community</NavLink>
              <NavLink to="/import">Import</NavLink>
              <NavLink to="/study">Study</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </div>

      <main className="page-content">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flashcards"
            element={
              <ProtectedRoute>
                <FlashcardListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community"
            element={
              <ProtectedRoute>
                <CommunityFlashcardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/decks"
            element={
              <ProtectedRoute>
                <DecksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/official-beginner-decks"
            element={
              <ProtectedRoute>
                <OfficialBeginnerDecksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddFlashcardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportFlashcardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <EditFlashcardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study"
            element={
              <ProtectedRoute>
                <StudySessionPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
