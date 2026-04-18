import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';

const GOAL_OPTIONS = [
  { value: 'listening', label: 'Listening', description: 'Audio and spoken input' },
  { value: 'reading', label: 'Reading', description: 'Text and recognition' },
  { value: 'vocabulary', label: 'Vocabulary', description: 'Core words and recall' },
  { value: 'kanji', label: 'Kanji', description: 'Characters and readings' },
  { value: 'speaking', label: 'Speaking', description: 'Output and production' }
];

const TOPIC_OPTIONS = [
  { value: 'daily_conversation', label: 'Daily conversation', description: 'Everyday phrases and common situations' },
  { value: 'food', label: 'Food', description: 'Ordering, menus, and ingredients' },
  { value: 'travel', label: 'Travel', description: 'Transit, directions, and trips' },
  { value: 'workplace', label: 'Workplace', description: 'Professional routines and office language' },
  { value: 'hobbies', label: 'Hobbies', description: 'Personal interests and free time' },
  { value: 'listening_practice', label: 'Listening practice', description: 'Audio-heavy material and comprehension' }
];

const REGISTER_OPTIONS = [
  { value: 'casual', label: 'Casual', description: 'Relaxed everyday speech' },
  { value: 'polite', label: 'Polite', description: 'Courteous language for common interactions' },
  { value: 'mixed', label: 'Mixed', description: 'A blend of natural casual and polite speech' }
];

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', description: 'Basic words and patterns' },
  { value: 'intermediate', label: 'Intermediate', description: 'Common material and review' },
  { value: 'advanced', label: 'Advanced', description: 'Higher-level content' }
];

const DAILY_GOAL_PRESETS = [10, 20, 30];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    language: user?.language || 'Japanese',
    level: user?.level || 'beginner',
    goals: user?.goals?.length ? user.goals : ['vocabulary'],
    preferredTopics: user?.preferredTopics?.length ? user.preferredTopics : ['daily_conversation'],
    preferredRegister: user?.preferredRegister?.length ? user.preferredRegister : ['mixed'],
    dailyGoal: user?.dailyGoal ?? 10
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const toggleListValue = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: previous[field].includes(value)
        ? previous[field].filter((item) => item !== value)
        : [...previous[field], value]
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.goals.length === 0) {
      setError('Select at least one learning goal.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      await updateProfile({
        ...formData,
        dailyGoal: formData.dailyGoal === '' ? null : Number(formData.dailyGoal)
      });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-section auth-page">
      <PageIntro
        eyebrow="Onboarding"
        title="Learning profile"
        description="Set up the basics so Lingua can guide your practice."
      />

      <form className="card form-card form-shell" onSubmit={handleSubmit}>
        <label>
          Target language
          <select name="language" value={formData.language} onChange={handleChange} required>
            <option value="Japanese">Japanese</option>
          </select>
        </label>

        <div className="form-section">
          <div className="section-stack-tight">
            <h3>Proficiency level</h3>
            <p className="muted-text">Choose the level that feels closest to where you are right now.</p>
          </div>
          <div className="option-grid">
            {LEVEL_OPTIONS.map((level) => (
              <button
                key={level.value}
                type="button"
                className={`option-card ${formData.level === level.value ? 'is-selected' : ''}`}
                onClick={() => setFormData((previous) => ({ ...previous, level: level.value }))}
              >
                <span className="option-card-title">{level.label}</span>
                <span className="option-card-description">{level.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-stack-tight">
            <h3>Learning goals</h3>
            <p className="muted-text">Pick the areas you want Lingua to focus on first.</p>
          </div>
          <div className="option-grid">
            {GOAL_OPTIONS.map((goal) => (
              <label key={goal.value} className={`selection-card ${formData.goals.includes(goal.value) ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.goals.includes(goal.value)}
                  onChange={() => toggleListValue('goals', goal.value)}
                />
                <span className="selection-card-indicator" aria-hidden="true" />
                <span className="option-card-copy">
                  <span className="option-card-title">{goal.label}</span>
                  <span className="option-card-description">{goal.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-stack-tight">
            <h3>Topics you want more often</h3>
            <p className="muted-text">Pick a few themes so Lingua can lean toward material you actually want to practice.</p>
          </div>
          <div className="option-grid">
            {TOPIC_OPTIONS.map((topic) => (
              <label
                key={topic.value}
                className={`selection-card ${formData.preferredTopics.includes(topic.value) ? 'is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={formData.preferredTopics.includes(topic.value)}
                  onChange={() => toggleListValue('preferredTopics', topic.value)}
                />
                <span className="selection-card-indicator" aria-hidden="true" />
                <span className="option-card-copy">
                  <span className="option-card-title">{topic.label}</span>
                  <span className="option-card-description">{topic.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-stack-tight">
            <h3>Conversation style</h3>
            <p className="muted-text">Tell Lingua whether you want more casual, more polite, or a balanced mix.</p>
          </div>
          <div className="option-grid">
            {REGISTER_OPTIONS.map((registerOption) => (
              <label
                key={registerOption.value}
                className={`selection-card ${formData.preferredRegister.includes(registerOption.value) ? 'is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={formData.preferredRegister.includes(registerOption.value)}
                  onChange={() => toggleListValue('preferredRegister', registerOption.value)}
                />
                <span className="selection-card-indicator" aria-hidden="true" />
                <span className="option-card-copy">
                  <span className="option-card-title">{registerOption.label}</span>
                  <span className="option-card-description">{registerOption.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-stack-tight">
            <h3>Daily practice goal</h3>
            <p className="muted-text">Set a simple daily target for how much you want to review.</p>
          </div>
          <div className="choice-chip-row">
            {DAILY_GOAL_PRESETS.map((goal) => (
              <button
                key={goal}
                type="button"
                className={`choice-chip ${Number(formData.dailyGoal) === goal ? 'is-selected' : ''}`}
                onClick={() => setFormData((previous) => ({ ...previous, dailyGoal: goal }))}
              >
                {goal} / day
              </button>
            ))}
          </div>
          <label>
            Custom daily goal
            <input
              type="number"
              min="0"
              name="dailyGoal"
              value={formData.dailyGoal ?? ''}
              onChange={handleChange}
              placeholder="Optional"
            />
          </label>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="action-row">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save and continue'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default OnboardingPage;
