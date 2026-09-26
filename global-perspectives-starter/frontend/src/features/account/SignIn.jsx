import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { ACCOUNT_CLAIMS, ACCOUNT_NOTE } from '@/features/account/lib/accountClaims';
import '@/features/account/SignIn.css';

export default function SignIn() {
  const { sendSignInLink, signInWithGoogle, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState(null);

  // Where to land after auth. Defaults to /weekly; a ?returnTo= (e.g. from the
  // membership "sign in to subscribe" link) overrides it. Persist it so the
  // magic-link round-trip (which may complete in a new tab) can honor it too.
  const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/weekly';

  useEffect(() => {
    document.title = 'Sign In — Global Perspectives';
    const rt = new URLSearchParams(window.location.search).get('returnTo');
    if (rt) localStorage.setItem('gp_return_to', rt);
  }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      sessionStorage.setItem('gp_just_signed_in', '1');
      navigate(returnTo, { replace: true });
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
      navigate(returnTo, { replace: true });
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
      <div className="gp-console acct-signin-shell">
        <div className="acct-signin-panel">
          <div className="acct-signin-kicker">Check your inbox</div>
          <h1 className="acct-signin-title">Check your inbox</h1>
          <p style={{ fontSize: '13.5px', lineHeight: 1.6, margin: '4px 0 0' }}>
            We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to sign in — no password needed.
          </p>
          <p className="acct-signin-spam-note">
            Can't find it? Check your <strong>spam or junk folder</strong> — the email comes from noreply@globalperspective.net
          </p>
          <p style={{ fontSize: '12.5px', color: 'var(--c-text-dim, #7d8b96)', marginTop: '10px' }}>
            Wrong email?{' '}
            <button className="acct-signin-retry" onClick={() => { setSent(false); setEmail(''); }}>Try again</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gp-console acct-signin-shell">
      <div className="acct-signin-panel">
        <img src="/logo_no_grey_bg.png" alt="Global Perspectives" className="acct-signin-logo" />
        <div className="acct-signin-kicker">Account</div>
        <h1 className="acct-signin-title">Sign in to Global Perspectives</h1>

        <ul className="acct-signin-claims">
          {ACCOUNT_CLAIMS.map((claim) => (
            <li key={claim}>{claim}</li>
          ))}
        </ul>
        <p className="acct-signin-note">{ACCOUNT_NOTE}</p>

        <button
          className="acct-signin-google-btn"
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

        <div className="acct-signin-divider">
          <span>or</span>
        </div>

        <form className="acct-signin-form" onSubmit={handleSubmit}>
          <input
            className="acct-signin-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          <button className="acct-signin-submit" type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
        {error && <div className="acct-signin-error" role="alert">{error}</div>}

        <div className="acct-signin-divider">
          <span>or</span>
        </div>

        <button
          className="acct-signin-guest"
          onClick={handleGuest}
          disabled={guestLoading}
        >
          {guestLoading ? 'Continuing…' : 'Continue as guest'}
        </button>

        <p className="acct-signin-legal">
          Reading is always free — no card required. An account just saves your items and preferences.
          <br />
          By signing in, you agree to our <Link to="/privacy">Privacy &amp; Terms</Link> and <Link to="/disclosures">Disclosures</Link>.
        </p>
      </div>
    </div>
  );
}
