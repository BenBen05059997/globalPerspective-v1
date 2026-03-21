import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserProfile } from '../services/restProxy';
import './Pricing.css';

const FREE_FEATURES = [
  'Daily ~13 topics, refreshed hourly',
  'AI Summary, Prediction & Trace Cause',
  'Interactive world map with connections',
  '24-hour archive',
  'Narrative thread IDs on topics',
];

const MEMBER_FEATURES = [
  'Everything in Free',
  '7-day archive',
  'Weekly narrative view',
  'Story evolution tracking (Rising / Fading)',
  'Thread intelligence — story arc & trajectory',
  'Trending stories section',
  'Weekly map with date playback',
];

const ENTERPRISE_FEATURES = [
  'Everything in Member',
  'Extended archive depth',
  'Priority support',
  'Custom requirements — we build to your needs',
];

// Paddle checkout URL configured in docs/config.js as window.PADDLE_CHECKOUT_URL
// Custom data (uid) is passed via checkout[custom][uid] for webhook user mapping.
function buildCheckoutUrl(user) {
  const base = window.PADDLE_CHECKOUT_URL;
  if (!base) return null;
  const parts = [];
  if (user?.email) parts.push(`customer[email]=${encodeURIComponent(user.email)}`);
  if (user?.uid) parts.push(`checkout[custom][uid]=${encodeURIComponent(user.uid)}`);
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

export default function Pricing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentTier, setCurrentTier] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!user) { setCurrentTier(null); return; }
    setProfileLoading(true);
    fetchUserProfile()
      .then(res => setCurrentTier(res?.data?.tier || 'free'))
      .catch(() => setCurrentTier('free'))
      .finally(() => setProfileLoading(false));
  }, [user]);

  const loading = authLoading || profileLoading;
  const checkoutUrl = user ? buildCheckoutUrl(user) : null;

  function handleMemberClick() {
    if (!user) { navigate('/signin'); return; }
    if (!checkoutUrl) {
      alert('Payments are not yet configured. Please contact us.');
      return;
    }
    window.location.href = checkoutUrl;
  }

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Choose your plan</h1>
        <p>Start free. Upgrade when you need deeper intelligence.</p>
      </div>

      <div className="pricing-launch-notice">
        <strong>Launch offer:</strong> All Member features are currently free for early users who sign up.
        When paid plans go live, we'll notify you in advance so you can decide whether to subscribe.
        We need to cover AI and infrastructure costs to keep the platform running — your support makes this possible.
      </div>

      <div className="pricing-cards">

        {/* FREE */}
        <div className="pricing-card">
          <div className="pricing-card-name">Free</div>
          <div className="pricing-price">
            <span className="pricing-amount">$0</span>
            <span className="pricing-period">forever</span>
          </div>
          <p className="pricing-description">The full daily experience. No account required.</p>
          <hr className="pricing-divider" />
          <ul className="pricing-features">
            {FREE_FEATURES.map(f => <li key={f}>{f}</li>)}
          </ul>
          {!loading && currentTier === 'free' ? (
            <span className="pricing-cta current">Current plan</span>
          ) : (
            <Link to="/" className="pricing-cta free">Start free →</Link>
          )}
        </div>

        {/* MEMBER */}
        <div className="pricing-card featured">
          <div className="pricing-badge">Most popular</div>
          <div className="pricing-card-name">Member</div>
          <div className="pricing-price">
            <span className="pricing-amount">$15</span>
            <span className="pricing-period">/month</span>
          </div>
          <div className="pricing-free-hint">Currently free for all signed-in users</div>
          <p className="pricing-description">Track how stories evolve over time. For globally-minded professionals.</p>
          <hr className="pricing-divider" />
          <ul className="pricing-features">
            {MEMBER_FEATURES.map(f => <li key={f}>{f}</li>)}
          </ul>
          <Link to="/signin" className="pricing-cta member" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Sign in for free access →
          </Link>
        </div>

        {/* ENTERPRISE */}
        <div className="pricing-card enterprise">
          <div className="pricing-card-name">Enterprise</div>
          <div className="pricing-price">
            <span className="pricing-amount" style={{ fontSize: '1.5rem' }}>Custom</span>
          </div>
          <p className="pricing-description">Tailored intelligence for your organization. Tell us what you need and we'll build it.</p>
          <hr className="pricing-divider" />
          <ul className="pricing-features">
            {ENTERPRISE_FEATURES.map(f => <li key={f}>{f}</li>)}
          </ul>
          {!loading && currentTier === 'enterprise' ? (
            <Link to="/account" className="pricing-cta current">Manage plan →</Link>
          ) : (
            <a href="mailto:globalperspectives.app@gmail.com?subject=Enterprise inquiry" className="pricing-cta enterprise-btn">
              Contact us →
            </a>
          )}
        </div>

      </div>

      {user && (
        <p className="pricing-current-note">
          Signed in as {user.email} · <Link to="/account">Manage account</Link>
        </p>
      )}
      {!user && (
        <p className="pricing-current-note">
          Already a member? <Link to="/signin">Sign in →</Link>
        </p>
      )}
    </div>
  );
}
