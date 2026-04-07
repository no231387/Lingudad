import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { getDashboardOverview } from './services/flashcardService';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SentencesPage = lazy(() => import('./pages/SentencesPage'));
const VocabularyPage = lazy(() => import('./pages/VocabularyPage'));
const FlashcardListPage = lazy(() => import('./pages/FlashcardListPage'));
const CommunityFlashcardsPage = lazy(() => import('./pages/CommunityFlashcardsPage'));
const AddFlashcardPage = lazy(() => import('./pages/AddFlashcardPage'));
const DecksPage = lazy(() => import('./pages/DecksPage'));
const EditFlashcardPage = lazy(() => import('./pages/EditFlashcardPage'));
const OfficialBeginnerDecksPage = lazy(() => import('./pages/OfficialBeginnerDecksPage'));
const StudySessionPage = lazy(() => import('./pages/StudySessionPage'));
const ImportFlashcardsPage = lazy(() => import('./pages/ImportFlashcardsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ContentPage = lazy(() => import('./pages/ContentPage'));

const getStoredTheme = () => {
  try {
    return localStorage.getItem('linguacards_theme') || 'light';
  } catch (error) {
    console.warn('Unable to read theme from localStorage:', error);
    return 'light';
  }
};

const storeTheme = (theme) => {
  try {
    localStorage.setItem('linguacards_theme', theme);
  } catch (error) {
    console.warn('Unable to persist theme in localStorage:', error);
  }
};

function App() {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const [theme, setTheme] = useState(getStoredTheme);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [dashboardOverview, setDashboardOverview] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storeTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsNavOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const loadDashboardOverview = async () => {
      if (!isAuthenticated) {
        setDashboardOverview(null);
        setIsProfileOpen(false);
        return;
      }

      if (location.pathname === '/') {
        return;
      }

      try {
        const { data } = await getDashboardOverview();
        setDashboardOverview(data);
      } catch (error) {
        console.error('Failed to load dashboard overview:', error);
      }
    };

    loadDashboardOverview();
  }, [isAuthenticated, location.pathname]);

  const profileStats = useMemo(
    () => ({
      cards: dashboardOverview?.stats?.total || 0,
      decks: dashboardOverview?.decks?.length || 0,
      studySessions: dashboardOverview?.continueLearning?.sessions?.length || 0
    }),
    [dashboardOverview]
  );

  const toggleTheme = () => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));
  };

  const navItems = useMemo(
    () =>
      isAuthenticated
        ? [
            { to: '/', label: 'Home', shortLabel: 'Home' },
            { to: '/sentences', label: 'Sentences', shortLabel: 'Sentence' },
            { to: '/vocabulary', label: 'Vocabulary', shortLabel: 'Vocab' },
            { to: '/content', label: 'Content', shortLabel: 'Content' },
            { to: '/decks', label: 'Decks', shortLabel: 'Decks' },
            { to: '/official-beginner-decks', label: 'Official Decks', shortLabel: 'Official' },
            { to: '/flashcards', label: 'Flashcards', shortLabel: 'Cards' },
            { to: '/community', label: 'Community', shortLabel: 'Community' },
            { to: '/import', label: 'Import', shortLabel: 'Import' },
            { to: '/study', label: 'Study', shortLabel: 'Study' }
          ]
        : [
            { to: '/login', label: 'Login', shortLabel: 'Login' },
            { to: '/register', label: 'Register', shortLabel: 'Register' }
          ],
    [isAuthenticated]
  );

  const currentRouteLabel =
    navItems.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)))?.label ||
    (isAuthenticated ? 'Workspace' : 'Welcome');
  const onboardingRequired = isAuthenticated && user && !user.onboardingCompleted;
  const appContent = (
    <main className="page-content">
      <Suspense
        fallback={
          <section className="page-section">
            <div className="card empty-state">
              <h3>Loading</h3>
              <p className="muted-text">Preparing the page.</p>
            </div>
          </section>
        }
      >
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage initialOverview={dashboardOverview} onOverviewLoaded={setDashboardOverview} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sentences"
            element={
              <ProtectedRoute>
                <SentencesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocabulary"
            element={
              <ProtectedRoute>
                <VocabularyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content"
            element={
              <ProtectedRoute>
                <ContentPage />
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
      </Suspense>
    </main>
  );

  if (onboardingRequired && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (isAuthenticated && user?.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${isNavOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark-core">L</span>
            <span className="brand-mark-ring brand-mark-ring-one" />
            <span className="brand-mark-ring brand-mark-ring-two" />
          </div>
          <div className="brand-lockup">
            <p className="sidebar-kicker">Simple Practice</p>
            <h1 className="brand-wordmark">Lingua</h1>
            <p className="brand-support">Manage decks, flashcards, and study sessions.</p>
          </div>
        </div>

        <div className="sidebar-copy">
          {user && <div className="role-banner">Signed in as {user.username}</div>}
        </div>

        <nav className="nav-bar" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-link-label">{item.label}</span>
              <span className="nav-link-short">{item.shortLabel}</span>
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="sidebar-profile">
            <div className="section-stack-tight">
              <p className="eyebrow-label">Profile</p>
              <h3>{user.username}</h3>
              <p className="muted-text">Current totals</p>
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
                <span className="muted-text">Sessions</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="app-main">
        <header className="topbar card">
          <div className="topbar-leading">
            <button
              type="button"
              className="nav-toggle secondary-button"
              onClick={() => setIsNavOpen((previous) => !previous)}
              aria-expanded={isNavOpen}
              aria-label="Toggle navigation"
            >
              Menu
            </button>
            <div>
              <p className="eyebrow-label">Lingua</p>
              <h2 className="topbar-title">{currentRouteLabel}</h2>
            </div>
          </div>

          <div className="header-actions">
            <button type="button" onClick={toggleTheme} className="secondary-button">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
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
                  <span className="profile-trigger-name">{user.username.slice(0, 1).toUpperCase()}</span>
                </button>
                {isProfileOpen && (
                  <div className="profile-panel card">
                    <div className="profile-panel-header">
                      <div>
                        <p className="eyebrow-label">Account</p>
                        <h3>{user.username}</h3>
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
                        <span className="muted-text">Sessions</span>
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
        </header>

        {appContent}
      </div>
    </div>
  );
}

export default App;
