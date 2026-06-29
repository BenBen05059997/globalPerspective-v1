import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMembership } from '../hooks/useMembership';
import { createCheckout, createCreditCheckout, creditPacks } from '../services/restProxy';
import './MembershipPage.css';

const PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$15', cadence: '/month', note: 'Billed monthly. Cancel anytime.' },
  { id: 'yearly', name: 'Annual', price: '$150', cadence: '/year', note: '2 months free vs. monthly.', best: true },
];

const BENEFITS = [
  'Full archive depth + all narrative-thread & country intelligence',
  'Economic-impact / disruption analysis',
  'Daily + weekly intelligence briefings',
  'Forecast track record',
  'A monthly allowance of custom self-serve analyses (top up with credits anytime)',
];

export default function MembershipPage() {
  const { user } = useAuth();
  const { membership, isMember, creditBalance, available, loading } = useMembership();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const signedIn = user && !user.isAnonymous;
  const packs = creditPacks();

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

  async function buyCredits(pack) {
    setError(null);
    setBusy(`credits:${pack.key}`);
    try {
      const { url } = await createCreditCheckout(pack.key);
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
          Full access to the intelligence layer — briefings, country &amp; thread analysis,
          economic disruption, and forecast track records.
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
          <div className="mp-active card-gp">
            <div className="mp-active-badge">✓ You're a member</div>
            <p>
              Your membership is active{membership?.currentPeriodEnd
                ? <> — renews {new Date(membership.currentPeriodEnd).toLocaleDateString()}</>
                : null}.
            </p>
            <Link to="/account" className="btn-gp">Manage in Account</Link>
          </div>
        ) : (
          <>
            <div className="mp-plans">
              {PLANS.map((p) => (
                <div key={p.id} className={`mp-plan card-gp${p.best ? ' best' : ''}`}>
                  {p.best && <span className="mp-plan-tag">Best value</span>}
                  <div className="mp-plan-name">{p.name}</div>
                  <div className="mp-plan-price">{p.price}<span>{p.cadence}</span></div>
                  <div className="mp-plan-note">{p.note}</div>
                  {signedIn ? (
                    <button
                      className="mp-subscribe"
                      onClick={() => subscribe(p.id)}
                      disabled={busy !== null || loading}
                    >
                      {busy === p.id ? 'Starting checkout…' : `Subscribe ${p.price}${p.cadence}`}
                    </button>
                  ) : (
                    <Link to="/signin?returnTo=/membership" className="mp-subscribe mp-subscribe-link">Sign in to subscribe</Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {available && signedIn && (
          <section className="mp-credits">
            <h2 className="mp-credits-title">Analysis credits</h2>
            <p className="mp-credits-sub">
              Each custom analysis in the <Link to="/analyze">Analysis Studio</Link> uses one credit.
              Members get a monthly allowance included; anyone can top up.
              {' '}You have <strong>{creditBalance}</strong> credit{creditBalance === 1 ? '' : 's'}.
            </p>
            {packs.length > 0 ? (
              <div className="mp-packs">
                {packs.map((p) => (
                  <div key={p.key} className="mp-pack card-gp">
                    <div className="mp-pack-credits">{p.credits} credits</div>
                    {p.price && <div className="mp-pack-price">{p.price}</div>}
                    <button
                      className="mp-subscribe"
                      onClick={() => buyCredits(p)}
                      disabled={busy !== null || loading}
                    >
                      {busy === `credits:${p.key}` ? 'Starting checkout…' : 'Buy credits'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mp-notice">Credit packs are coming soon.</div>
            )}
          </section>
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
