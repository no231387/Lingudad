import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('App render failed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'Segoe UI, sans-serif', color: '#1f2937' }}>
          <h1 style={{ marginBottom: '0.75rem' }}>Frontend startup error</h1>
          <p style={{ marginBottom: '0.75rem' }}>
            The app hit an error while rendering. This message is shown so the failure is visible instead of a blank
            screen.
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '12px',
              padding: '1rem'
            }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const renderBootstrapError = (error) => {
  const message = String(error?.stack || error?.message || error);
  const rootElement = document.getElementById('root') || document.body;

  rootElement.innerHTML = `
    <div style="padding:2rem;font-family:'Segoe UI',sans-serif;color:#1f2937;">
      <h1 style="margin-bottom:0.75rem;">Frontend bootstrap error</h1>
      <p style="margin-bottom:0.75rem;">The app failed before React could finish mounting.</p>
      <pre style="white-space:pre-wrap;background:#f3f4f6;border:1px solid #d1d5db;border-radius:12px;padding:1rem;">${message}</pre>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  console.error('Unhandled window error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const mountApp = () => {
  try {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
      throw new Error('Missing #root element in index.html.');
    }

    ReactDOM.createRoot(rootElement).render(
      <AppErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </AppErrorBoundary>
    );
  } catch (error) {
    console.error('Frontend bootstrap failed:', error);
    renderBootstrapError(error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true });
} else {
  mountApp();
}
