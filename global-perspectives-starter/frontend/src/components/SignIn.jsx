import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './WeeklyPage.css';

export default function SignIn() {
  const { sendSignInLink } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send sign-in link');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="weekly-gate">
        <div className="weekly-gate-icon">📬</div>
        <h2>Check your inbox</h2>
        <p>We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to sign in — no password needed.</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Wrong email? <button className="weekly-clear-btn" onClick={() => { setSent(false); setEmail(''); }}>Try again</button>
        </p>
      </div>
    );
  }

  return (
    <div className="weekly-gate">
      <div className="weekly-gate-icon">🌐</div>
      <h2>Sign in to Global Perspectives</h2>
      <p>Enter your email and we'll send you a magic link. No password needed.</p>
      <form className="weekly-gate-form" onSubmit={handleSubmit}>
        <input
          className="weekly-gate-input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
          autoFocus
          required
        />
        <button className="weekly-gate-submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>
      {error && <div className="weekly-gate-error">{error}</div>}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
        Don't have an account? <Link to="/pricing">See plans →</Link>
      </p>
    </div>
  );
}
