import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useMembership } from '@/shared/hooks/useMembership';
import { createCheckout } from '@/shared/api/restProxy';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import '@/features/account/MembershipPage.css';

const PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$15', cadence: '/month', note: 'Billed monthly. Cancel anytime.' },
  { id: 'yearly', name: 'Annual', price: '$150', cadence: '/year', note: '2 months free vs. monthly.', best: true },
];

// Only what is live today: the country change-alert emails are off (drift-email cron disabled),
// so they are not listed until they send.
const BENEFITS = [
  'The full self-correction history on every country page — how each read changed over time, not just the latest note',
  'The complete corrections ledger on the track record, not just the newest five',
  'Follow countries and see what changed in them since your last visit, on your account desk',
  'You fund independent, self-correcting intelligence — and keep the analysis free for everyone else',
];

export default function MembershipPage() {
  useEffect(() => { document.title = 'Membership | Global Perspectives'; }, []);
  const { user } = useAuth();
  const { membership, isMember, available, loading } = useMembership();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const signedIn = user && !user.isAnonymous;

  async function subscribe(plan) {
    setError(null);
    setBusy(plan);
    try {
      const { url } = await createCheckout(plan);
      if (url) window.location.href = url;
      else throw new Error('No checkout URL returned');
    } catch (err) {
      setError(err?.message || 'Could not start checkout.');
      setBusy(null);
    }
  }

  return (
    <div className="mp-page">
      <header className="mp-head">
        <div className="label">Membership</div>
        <h1>Global Perspectives Membership</h1>
        <p className="mp-sub">
          Every analysis and our public track record stay free to read. Membership adds the depth —
          the full history of how each read changed, the whole corrections ledger, and following countries.
        </p>
      </header>

      <div className="mp-body">
        <ul className="mp-benefits">
          {BENEFITS.map((b) => (
            <li key={b}><span className="mp-check">✓</span>{b}</li>
          ))}
        </ul>

        {!available ? (
          <div className="mp-notice">
            Membership isn't open yet — we're putting the finishing touches on checkout. Check back soon.
          </div>
        ) : isMember ? (
          <Card className="mp-active">
            <div className="mp-active-badge">✓ You're a member</div>
            <p>
              Your membership is active{membership?.currentPeriodEnd
                ? <> — renews {new Date(membership.currentPeriodEnd).toLocaleDateString()}</>
                : null}.
            </p>
            <Button to="/account">Manage in Account</Button>
          </Card>
        ) : (
          <>
            <div className="mp-plans">
              {PLANS.map((p) => (
                <Card key={p.id} selected={!!p.best} className="mp-plan">
                  {p.best && <span className="mp-plan-tag">Best value</span>}
                  <div className="mp-plan-name">{p.name}</div>
                  <div className="mp-plan-price">{p.price}<span>{p.cadence}</span></div>
                  <div className="mp-plan-note">{p.note}</div>
                  {signedIn ? (
                    <Button
                      variant="primary"
                      className="mp-subscribe"
                      onClick={() => subscribe(p.id)}
                      disabled={busy !== null || loading}
                    >
                      {busy === p.id ? 'Starting checkout…' : `Subscribe ${p.price}${p.cadence}`}
                    </Button>
                  ) : (
                    <Button to="/signin?returnTo=/membership" className="mp-subscribe">Sign in to subscribe</Button>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        {error && <div className="mp-error">{error}</div>}

        <p className="mp-fineprint">
          Payments are processed securely by Polar (our Merchant of Record). Informational intelligence
          only — not financial or investment advice.
        </p>
      </div>
    </div>
  );
}
