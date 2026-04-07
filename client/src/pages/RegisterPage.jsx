import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setError('');
      await register({
        username: formData.username,
        password: formData.password
      });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <section className="page-section auth-page">
      <PageIntro
        eyebrow="Create account"
        title="Start your Lingua workspace"
        description="Create an account to build decks, save flashcards, import study sets, and track review sessions."
      />

      <div className="card auth-card">
        <div className="section-stack-tight">
          <h3>Register</h3>
          <p className="muted-text">Set up your account and start building your study library.</p>
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

          <label>
            Confirm Password
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit">Create Account</button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </div>
    </section>
  );
}

export default RegisterPage;
