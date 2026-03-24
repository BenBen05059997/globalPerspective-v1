import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './WeeklyPage.css';

export default function SignIn() {
  const { sendSignInLink, signInWithGoogle, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = 'Sign In — Global Perspectives'; }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      sessionStorage.setItem('gp_just_signed_in', '1');
      navigate('/weekly', { replace: true });
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        // User closed popup, ignore
      } else if (err?.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists. Try signing in with the magic link below instead.');
      } else {
        setError(err?.message || 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);
    try {
      await signInAsGuest();
      navigate('/weekly', { replace: true });
    } catch (err) {
      setError(err?.message || 'Guest sign-in failed');
    } finally {
      setGuestLoading(false);
    }
  }

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
        <p style={{ fontSize: '0.85rem', color: '#b45309', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, marginTop: '0.75rem', lineHeight: 1.5 }}>
          Can't find it? Check your <strong>spam or junk folder</strong> — the email comes from noreply@globalperspective.net
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Wrong email? <button className="weekly-clear-btn" onClick={() => { setSent(false); setEmail(''); }}>Try again</button>
        </p>
      </div>
    );
  }

  return (
    <div className="weekly-gate">
      <img src="/logo_no_grey_bg.png" alt="Global Perspectives" style={{ width: 64, height: 64, marginBottom: 8 }} />
      <h2>Sign in to Global Perspectives</h2>
      <p>Access Story Arc Intelligence, Country Briefings, and AI-powered analysis.</p>

      <button
        className="google-signin-btn"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {googleLoading ? 'Signing in…' : 'Continue with Google'}
      </button>

      <div className="signin-divider">
        <span>or</span>
      </div>

      <form className="weekly-gate-form" onSubmit={handleSubmit}>
        <input
          className="weekly-gate-input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <button className="weekly-gate-submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
      {error && <div className="weekly-gate-error">{error}</div>}

      <div className="signin-divider">
        <span>or</span>
      </div>

      <button
        className="weekly-clear-btn"
        onClick={handleGuest}
        disabled={guestLoading}
        style={{ fontSize: '0.9rem', color: 'var(--text-muted)', padding: '8px 0' }}
      >
        {guestLoading ? 'Continuing…' : 'Continue as guest'}
      </button>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>
        All features are free during our launch period — no credit card required.
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        By signing in, you agree to our <Link to="/privacy" style={{ color: '#3b82f6' }}>Privacy & Terms</Link> and <Link to="/disclosures" style={{ color: '#3b82f6' }}>Disclosures</Link>.
      </p>
    </div>
  );
}
