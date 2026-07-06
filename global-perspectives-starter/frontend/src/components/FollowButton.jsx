import { Link } from 'react-router-dom';
import { useMembership } from '../hooks/useMembership';
import { usePreferences } from '../hooks/usePreferences';

// Member-only "follow this country's read" control → drift-alert emails (MEMBER_GATING_PLAN.md P5).
// Members get a live toggle; non-members (incl. anon) see a subtle locked CTA to /membership —
// the upsell hint sits right where the correction history lives. Renders nothing when the prefs
// or billing endpoints aren't configured (honest — never a dead control; feedback_no_misinformation_fallback).

function Bell({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const BASE = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  font: '600 12px/1 -apple-system,Helvetica,Arial,sans-serif',
  padding: '7px 11px', borderRadius: '999px', textDecoration: 'none',
  border: '1px solid var(--border-color, #d9d6d0)',
  background: 'none', color: 'var(--ink, #1a1a1a)',
};

export function FollowButton({ country }) {
  const { isMember, available, loading: memLoading } = useMembership();
  const { isFollowing, follow, saving, endpointMissing } = usePreferences();

  // No prefs backend or billing not configured → no control at all (honest, no dead button).
  if (!country || endpointMissing || !available) return null;
  if (memLoading) return null; // avoid a locked→unlocked flicker while tier resolves

  // Non-member (incl. anonymous): the upsell hint.
  if (!isMember) {
    return (
      <Link to="/membership" style={{ ...BASE, opacity: 0.85 }}
        title={`Get emailed when our read on ${country} changes — a member feature`}>
        <Bell /> Follow <span style={{ opacity: 0.6 }}>· Members</span>
      </Link>
    );
  }

  const following = isFollowing(country);
  return (
    <button
      type="button"
      onClick={() => follow(country, !following)}
      disabled={saving}
      aria-pressed={following}
      title={following
        ? `You're alerted when our read on ${country} changes. Click to stop.`
        : `Get emailed when our read on ${country} changes.`}
      style={{
        ...BASE,
        cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.6 : 1,
        border: `1px solid ${following ? 'var(--accent, #3b82f6)' : 'var(--border-color, #d9d6d0)'}`,
        color: following ? 'var(--accent, #3b82f6)' : 'var(--ink, #1a1a1a)',
      }}
    >
      <Bell filled={following} /> {following ? 'Following' : 'Follow'}
    </button>
  );
}
