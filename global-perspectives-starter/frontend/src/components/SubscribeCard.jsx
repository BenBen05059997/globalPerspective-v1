import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../hooks/usePreferences';
import './SubscribeCard.css';

// Email subscribe entry point. Surfaces the same opt-ins that live in Account →
// Notifications (newsRecommend set_prefs → GlobalPerspectiveUserPrefs), so it needs no
// new backend. Signed-in users opt in one click; anonymous users sign in (Google), after
// which we set the opt-in immediately so the intent isn't lost.
//
//   kind="digest"   → Weekly Signals Brief (digestOptIn)   [Home, /weekly-brief]
//   kind="breaking" → Breaking alerts (breakingOptIn)       [/breaking]
const COPY = {
  digest: {
    field: 'digestOptIn',
    kicker: 'Newsletter · Free',
    headline: 'The Weekly Signals Brief, in your inbox',
    sub: 'Every Sunday: the week’s signals ranked by risk, each with the “so what.” One email, no noise.',
    subscribedSub: 'The Weekly Signals Brief lands in your inbox each Sunday. Manage anytime in your account.',
  },
  breaking: {
    field: 'breakingOptIn',
    kicker: 'Breaking alerts · Free',
    headline: 'Get breaking alerts the moment they matter',
    sub: 'An email the instant a major story crosses the significance bar — with our analysis, not just a headline. We stay silent otherwise.',
    subscribedSub: 'You’ll get an email the moment a major story breaks. Manage anytime in your account.',
  },
};

export default function SubscribeCard({ kind = 'digest', variant = 'home' }) {
  const { signInWithGoogle } = useAuth();
  const { prefs, loading, saving, error, save, endpointMissing, signedIn } = usePreferences();
  const [busy, setBusy] = useState(false);

  // Don't render a dead button if the prefs endpoint isn't configured.
  if (endpointMissing) return null;

  const c = COPY[kind] || COPY.digest;
  const subscribed = signedIn && prefs[c.field];

  async function handleSignInAndSubscribe() {
    setBusy(true);
    try {
      await signInWithGoogle();
      await save({ [c.field]: true }); // carry the subscribe intent through sign-in
    } catch { /* AuthContext / usePreferences surface the error */ } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={`subcard subcard--${variant} subcard--${kind}`} aria-label={`Subscribe to ${kind === 'breaking' ? 'breaking alerts' : 'the Weekly Brief'} by email`}>
      <div className="subcard-body">
        <div className="subcard-kicker">{c.kicker}</div>
        <div className="subcard-h">{subscribed ? 'You’re subscribed' : c.headline}</div>
        <p className="subcard-sub">{subscribed ? c.subscribedSub : c.sub}</p>
        {error && <p className="subcard-err">{error}</p>}
      </div>
      <div className="subcard-action">
        {subscribed ? (
          <Link className="subcard-btn subcard-btn--ghost" to="/account?tab=notifications">Manage</Link>
        ) : signedIn ? (
          <button className="subcard-btn" disabled={saving || loading} onClick={() => save({ [c.field]: true })}>
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
