import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';
import { getPostLoginRedirect } from '../utils/routing';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError('');
      await login(formData);
      const redirectTo = getPostLoginRedirect(location.state);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed.');
    }
  };

  return (
    <section className="page-section auth-page">
      <PageIntro
        eyebrow="Welcome back"
        title="Sign in"
        description="Access your flashcards, decks, study sessions, and imports from one focused workspace."
      />

      <div className="card auth-card">
        <div className="section-stack-tight">
          <h3>Login</h3>
          <p className="muted-text">Use your account to continue where you left off.</p>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            Username
            <input name="username" value={formData.username} onChange={handleChange} required />
          </label>

          <label>
            Password
            <input type="password" name="password" value={formData.password} onChange={handleChange} required />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit">Login</button>
        </form>

        <p>
          Need an account? <Link to="/register">Register here</Link>.
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
