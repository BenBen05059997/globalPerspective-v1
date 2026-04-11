import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserProfile, fetchPortalSession } from '../services/restProxy';
import { useSavedItems } from '../hooks/useSavedItems';
import './Account.css';

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

const TYPE_COLORS = {
  thread:  { border: '#3b82f6', badge: '#dbeafe', badgeText: '#1e40af' },
  country: { border: '#10b981', badge: '#d1fae5', badgeText: '#065f46' },
  daily:   { border: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  pair:    { border: '#f59e0b', badge: '#fef3c7', badgeText: '#92400e' },
};

const TYPE_LABELS = {
  thread: 'Thread',
  country: 'Country',
  daily: 'Daily',
  pair: 'Pair',
};

function getItemHref(item) {
  if (item.itemType === 'thread')  return `/weekly/thread/${item.itemId}`;
  if (item.itemType === 'country') return `/weekly/country/${encodeURIComponent(item.itemId)}`;
  if (item.itemType === 'daily')   return `/daily/${item.itemId}`;
  return null;
}

function getItemTitle(item) {
  return item.metadata?.title || item.metadata?.name || item.metadata?.headline || item.itemId;
}

function getItemMeta(item) {
  const parts = [];
  if (item.metadata?.category) parts.push(item.metadata.category);
  if (item.metadata?.date)     parts.push(item.metadata.date);
  return parts.join(' · ');
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5)   return `${w}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

function HeartFilledIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  );
}

function SavedCard({ item, onUnsave }) {
  const [collapsing, setCollapsing] = useState(false);
  const colors = TYPE_COLORS[item.itemType] || TYPE_COLORS.thread;
  const href = getItemHref(item);
  const title = getItemTitle(item);
  const meta = getItemMeta(item);

  function handleUnsave(e) {
    e.preventDefault();
    e.stopPropagation();
    setCollapsing(true);
    setTimeout(() => onUnsave(item.itemType, item.itemId), 250);
  }

  const cardClass = `saved-card${collapsing ? ' saved-card--collapsing' : ''}`;

  const inner = (
    <>
      <div className="saved-card-top">
        <span
          className="saved-card-type"
          style={{ background: colors.badge, color: colors.badgeText }}
        >
          {TYPE_LABELS[item.itemType] || item.itemType}
        </span>
        <span className="saved-card-time">{formatRelativeTime(item.savedAt)}</span>
      </div>
      <div className="saved-card-title">{title}</div>
      {meta && <div className="saved-card-meta">{meta}</div>}
      <button
        className="saved-card-unsave"
        onClick={handleUnsave}
        title="Remove from saved"
        aria-label="Remove from saved"
      >
        <HeartFilledIcon />
      </button>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cardClass}
        style={{ borderLeftColor: colors.border }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={cardClass} style={{ borderLeftColor: colors.border }}>
      {inner}
    </div>
  );
}

function SavedPanel({ savedItems, savedLoading, onUnsave }) {
  const [filter, setFilter] = useState('all');

  const typeCounts = savedItems.reduce((acc, item) => {
    acc[item.itemType] = (acc[item.itemType] || 0) + 1;
    return acc;
  }, {});

  const availableTypes = Object.keys(typeCounts);
  const filtered = filter === 'all'
    ? savedItems
    : savedItems.filter(item => item.itemType === filter);

  const emptyHint = filter === 'all'
    ? 'Tap the heart on any thread, country, or daily brief to save it here.'
    : `No saved ${TYPE_LABELS[filter]?.toLowerCase() || filter}s yet.`;

  return (
    <div>
      {savedItems.length > 1 && (
        <div className="saved-filters">
          <button
            className={`saved-filter-chip${filter === 'all' ? ' saved-filter-chip--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All {savedItems.length}
          </button>
          {availableTypes.map(type => (
            <button
              key={type}
              className={`saved-filter-chip${filter === type ? ' saved-filter-chip--active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {TYPE_LABELS[type] || type} {typeCounts[type]}
            </button>
          ))}
        </div>
      )}

      <div className="saved-grid">
        {savedLoading ? (
          <div style={{ gridColumn: '1/-1', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading saved items…
          </div>
        ) : filtered.length === 0 ? (
          <div className="saved-empty">
            <div className="saved-empty-icon">🤍</div>
            <div className="saved-empty-title">Nothing saved yet</div>
            <div className="saved-empty-hint">{emptyHint}</div>
          </div>
        ) : (
          filtered.map(item => (
            <SavedCard
              key={`${item.itemType}:${item.itemId}`}
              item={item}
              onUnsave={onUnsave}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ user, profile, tier, tierStyle, perks, memberSince, isActive, handleSignOut }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, setPortalLoading] = useState(false);
  const [, setError] = useState(null);

  async function handleManageBilling() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetchPortalSession();
      if (res?.url) window.location.href = res.url;
      else setError('Could not open billing portal. Please try again.');
    } catch (err) {
      setError(err?.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }
  void handleManageBilling;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
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
              <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>Are you sure?</div>
              <div style={{ color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
                To delete your account and cancel your subscription, email us at{' '}
                <a href="mailto:globalperspectives.app@gmail.com?subject=Delete%20my%20account" style={{ color: '#3b82f6' }}>
                  globalperspectives.app@gmail.com
                </a>
                {' '}and we'll process it within 24 hours.
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}
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

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { savedItems, loading: savedLoading, unsave } = useSavedItems();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const tab = searchParams.get('tab') || 'saved';

  function setTab(t) {
    setSearchParams({ tab: t }, { replace: true });
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.isAnonymous) { navigate('/signin'); return; }
    setProfileLoading(true);
    fetchUserProfile()
      .then(res => setProfile(res?.data || { tier: 'free' }))
      .catch(() => setProfile({ tier: 'free' }))
      .finally(() => setProfileLoading(false));
  }, [user, authLoading, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (authLoading || profileLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading account…</div>;
  }

  if (!user) return null;

  const tier = profile?.tier || 'free';
  const tierStyle = TIER_COLORS[tier] || TIER_COLORS.free;
  const perks = TIER_PERKS[tier] || [];
  const memberSince = formatMemberSince(user.metadata?.creationTime);
  const isActive = !profile?.subscriptionStatus || profile.subscriptionStatus === 'active';

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Account</h1>

      <div className="account-tabs">
        <button
          className={`account-tab${tab === 'profile' ? ' account-tab--active' : ''}`}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          className={`account-tab${tab === 'saved' ? ' account-tab--active' : ''}`}
          onClick={() => setTab('saved')}
        >
          Saved
          {savedItems.length > 0 && (
            <span className="account-tab-badge">{savedItems.length}</span>
          )}
        </button>
      </div>

      {tab === 'profile' && (
        <ProfilePanel
          user={user}
          profile={profile}
          tier={tier}
          tierStyle={tierStyle}
          perks={perks}
          memberSince={memberSince}
          isActive={isActive}
          handleSignOut={handleSignOut}
        />
      )}

      {tab === 'saved' && (
        <SavedPanel
          savedItems={savedItems}
          savedLoading={savedLoading}
          onUnsave={unsave}
        />
      )}
    </div>
  );
}
