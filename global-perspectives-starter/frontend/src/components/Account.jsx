import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserProfile, fetchPortalSession } from '../services/restProxy';
import './WeeklyPage.css';
import './Pricing.css';

const TIER_LABELS = {
  free: 'Free',
  member: 'Member',
  enterprise: 'Enterprise',
};

const TIER_COLORS = {
  free: { background: '#f3f4f6', color: '#374151' },
  member: { background: '#dbeafe', color: '#1e40af' },
  enterprise: { background: '#f3e8ff', color: '#6b21a8' },
};

const TIER_PERKS = {
  member: [
    { icon: '📰', text: 'Weekly Analysis — 7-day narrative archive' },
    { icon: '🗺️', text: 'Weekly Map — story evolution with date playback' },
    { icon: '🧵', text: 'Thread Intelligence — Story Arc, Trajectory, Root Causes' },
    { icon: '📈', text: 'Trending This Week — rising & new stories' },
  ],
  enterprise: [
    { icon: '📰', text: 'Weekly Analysis — 30-day narrative archive' },
    { icon: '🗺️', text: 'Weekly Map — story evolution with date playback' },
    { icon: '🧵', text: 'Thread Intelligence — Story Arc, Trajectory, Root Causes' },
    { icon: '📈', text: 'Trending This Week — rising & new stories' },
    { icon: '🔍', text: 'Narrative Thread lookup — trace any thread back 30 days' },
  ],
  free: [],
};

function formatMemberSince(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getInitials(email) {
  if (!email) return '?';
  return email[0].toUpperCase();
}

const SECTION = {
  border: '1.5px solid var(--border-color, #e5e7eb)',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
};

const LABEL = {
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: 4,
};

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // portalLoading + error + handleManageBilling — re-enable when Paddle is ready
  const [, /* portalLoading */ setPortalLoading] = useState(false);
  const [, /* error */ setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.isAnonymous) { navigate('/signin'); return; }
    setProfileLoading(true);
    fetchUserProfile()
      .then(res => setProfile(res?.data || { tier: 'free' }))
      .catch(() => setProfile({ tier: 'free' }))
      .finally(() => setProfileLoading(false));
  }, [user, authLoading, navigate]);

  async function handleManageBilling() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetchPortalSession();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setError('Could not open billing portal. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (authLoading || profileLoading) {
    return <div className="weekly-loading">Loading account…</div>;
  }

  if (!user) return null;

  const tier = profile?.tier || 'free';
  const tierStyle = TIER_COLORS[tier] || TIER_COLORS.free;
  const perks = TIER_PERKS[tier] || [];
  const memberSince = formatMemberSince(user.metadata?.creationTime);
  const isActive = !profile?.subscriptionStatus || profile.subscriptionStatus === 'active';

  return (
    <div style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Account</h1>

      {/* Avatar + identity */}
      <div style={{ ...SECTION, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#dbeafe', color: '#1e40af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontWeight: 700, flexShrink: 0,
        }}>
          {getInitials(user.email)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 999,
              fontSize: '0.75rem', fontWeight: 700, ...tierStyle,
            }}>
              {TIER_LABELS[tier] || tier}
            </span>
            {(tier === 'member' || tier === 'enterprise') && (
              <span style={{ fontSize: '0.75rem', color: isActive ? '#16a34a' : '#ef4444', fontWeight: 500 }}>
                ● {isActive ? 'Active' : profile.subscriptionStatus}
              </span>
            )}
            {memberSince && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Since {memberSince}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plan perks */}
      {perks.length > 0 && (
        <div style={SECTION}>
          <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Your plan includes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {perks.map((perk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                <span style={{ flexShrink: 0 }}>{perk.icon}</span>
                <span>{perk.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick access */}
      {(tier === 'member' || tier === 'enterprise') && (
        <div style={SECTION}>
          <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Quick access</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/weekly" style={{ fontSize: '0.875rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
              Weekly Analysis →
            </Link>
            <Link to="/weekly-map" style={{ fontSize: '0.875rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
              Weekly Map →
            </Link>
          </div>
        </div>
      )}

      {/* Plan status */}
      <div style={SECTION}>
        <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Plan</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          All features are currently free for early users. We'll notify you by email before paid plans go live.
        </div>
      </div>

      {/* Account actions */}
      <div style={SECTION}>
        <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Account</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleSignOut}
            style={{
              background: 'var(--bg-secondary, #f3f4f6)',
              border: '1.5px solid var(--border-color, #e5e7eb)',
              borderRadius: 8, padding: '0.6rem 1rem',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', color: 'var(--text-primary)',
              textAlign: 'left', width: '100%',
            }}
          >
            Sign out
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '0.8rem', color: '#ef4444',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              Delete account
            </button>
          ) : (
            <div style={{
              background: '#fff5f5', border: '1.5px solid #fecaca',
              borderRadius: 8, padding: '0.75rem 1rem',
              fontSize: '0.85rem',
            }}>
              <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>
                Are you sure?
              </div>
              <div style={{ color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
                To delete your account and cancel your subscription, email us at{' '}
                <a href="mailto:globalperspectives.app@gmail.com?subject=Delete%20my%20account" style={{ color: '#3b82f6' }}>
                  globalperspectives.app@gmail.com
                </a>
                {' '}and we'll process it within 24 hours.
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
