import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed.');
    }
  };

  return (
    <section>
      <div className="card auth-card">
        <h2>Login</h2>
        <p>Sign in to access your flashcards.</p>

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
