import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../hooks/usePreferences';
import './SubscribeCard.css';

// Subscribe entry point for the Weekly Signals Brief email. Surfaces the same opt-in
// that lives in Account → Notifications (newsRecommend set_prefs → GlobalPerspectiveUserPrefs),
// so it needs no new backend. Signed-in users opt in one click; anonymous users sign in
// first (Google), after which we set the opt-in immediately so the intent isn't lost.
export default function SubscribeCard({ variant = 'home' }) {
  const { signInWithGoogle } = useAuth();
  const { prefs, loading, saving, error, save, endpointMissing, signedIn } = usePreferences();
  const [busy, setBusy] = useState(false);

  // Don't render a dead button if the prefs endpoint isn't configured.
  if (endpointMissing) return null;

  const subscribed = signedIn && prefs.digestOptIn;

  async function handleSignInAndSubscribe() {
    setBusy(true);
    try {
      await signInWithGoogle();
      await save({ digestOptIn: true }); // carry the subscribe intent through sign-in
    } catch { /* AuthContext / usePreferences surface the error */ } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={`subcard subcard--${variant}`} aria-label="Subscribe to the Weekly Brief by email">
      <div className="subcard-body">
        <div className="subcard-kicker">Newsletter · Free</div>
        <div className="subcard-h">
          {subscribed ? 'You’re subscribed' : 'The Weekly Signals Brief, in your inbox'}
        </div>
        <p className="subcard-sub">
          {subscribed
            ? 'The Weekly Signals Brief lands in your inbox each Sunday. Manage anytime in your account.'
            : 'Every Sunday: the week’s signals ranked by risk, each with the “so what.” One email, no noise.'}
        </p>
        {error && <p className="subcard-err">{error}</p>}
      </div>
      <div className="subcard-action">
        {subscribed ? (
          <Link className="subcard-btn subcard-btn--ghost" to="/account?tab=notifications">Manage</Link>
        ) : signedIn ? (
          <button className="subcard-btn" disabled={saving || loading} onClick={() => save({ digestOptIn: true })}>
            {saving ? 'Subscribing…' : 'Subscribe'}
          </button>
        ) : (
          <button className="subcard-btn" disabled={busy} onClick={handleSignInAndSubscribe}>
            {busy ? 'Opening…' : 'Subscribe'}
          </button>
        )}
      </div>
    </aside>
  );
}
