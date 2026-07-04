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
    thanksSub: 'You’re on the list — the Weekly Signals Brief lands in your inbox every Sunday. (Check your inbox, and spam just in case, for the first one.)',
  },
  breaking: {
    field: 'breakingOptIn',
    kicker: 'Breaking alerts · Free',
    headline: 'Get breaking alerts the moment they matter',
    sub: 'An email the instant a major story crosses the significance bar — with our analysis, not just a headline. We stay silent otherwise.',
    subscribedSub: 'You’ll get an email the moment a major story breaks. Manage anytime in your account.',
    thanksSub: 'You’re on the list — we’ll email you the moment a major story breaks. (Check your inbox, and spam just in case.)',
  },
};

export default function SubscribeCard({ kind = 'digest', variant = 'home' }) {
  const { signInWithGoogle } = useAuth();
  const { prefs, loading, saving, error, save, endpointMissing, signedIn } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [justSubscribed, setJustSubscribed] = useState(false); // transient thank-you

  // Don't render a dead button if the prefs endpoint isn't configured.
  if (endpointMissing) return null;

  const c = COPY[kind] || COPY.digest;
  const subscribed = signedIn && prefs[c.field];

  async function subscribe() {
    const ok = await save({ [c.field]: true });
    if (ok) setJustSubscribed(true); // only celebrate a real persist
  }

  async function handleSignInAndSubscribe() {
    setBusy(true);
    try {
      await signInWithGoogle();
      await subscribe(); // carry the subscribe intent through sign-in
    } catch { /* AuthContext / usePreferences surface the error */ } finally {
      setBusy(false);
    }
  }

  // Thank-you takes priority (just clicked), then persistent subscribed, then the CTA.
  const state = justSubscribed ? 'thanks' : subscribed ? 'subscribed' : 'cta';

  return (
    <aside
      className={`subcard subcard--${variant} subcard--${kind}${state === 'thanks' ? ' subcard--thanks' : ''}`}
      aria-label={`Subscribe to ${kind === 'breaking' ? 'breaking alerts' : 'the Weekly Brief'} by email`}
    >
      <div className="subcard-body">
        <div className="subcard-kicker">
          {state === 'thanks' ? '✓ Subscribed' : c.kicker}
        </div>
        <div className="subcard-h">
          {state === 'thanks' ? 'Thanks for subscribing!' : state === 'subscribed' ? 'You’re subscribed' : c.headline}
        </div>
        <p className="subcard-sub">
          {state === 'thanks' ? c.thanksSub : state === 'subscribed' ? c.subscribedSub : c.sub}
        </p>
        {error && <p className="subcard-err">{error}</p>}
      </div>
      <div className="subcard-action">
        {state === 'thanks' || state === 'subscribed' ? (
          <Link className="subcard-btn subcard-btn--ghost" to="/account?tab=notifications">Manage</Link>
        ) : signedIn ? (
          <button className="subcard-btn" disabled={saving || loading} onClick={subscribe}>
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
