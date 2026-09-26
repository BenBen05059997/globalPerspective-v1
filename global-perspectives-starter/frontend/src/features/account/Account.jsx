import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useSavedItems } from '@/features/account/hooks/useSavedItems';
import { usePreferences } from '@/features/account/hooks/usePreferences';
import { useMembership } from '@/features/account/hooks/useMembership';
import { loadByok, clearByok } from '@/features/analysis-studio/lib/byok';
import { creditPacks } from '@/shared/api/restProxy';
import { getProvider } from '@/features/analysis-studio/lib/llm';
import ProviderModal from '@/features/analysis-studio/components/ProviderModal';
import DeskPanel from '@/features/account/components/DeskPanel';
import '@/features/account/Account.css';

// Mask a key for display: keep a few head/tail chars, hide the middle.
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 10) return `${k.slice(0, 2)}••••`;
  return `${k.slice(0, 5)}••••${k.slice(-4)}`;
}

// Analysis Studio BYOK key management — view / change / remove the key the reader
// stored in this browser (it never touches our servers; see utils/byok.js).
function AnalysisKeyPanel() {
  const [byok, setByok] = useState(() => loadByok());
  const [modalOpen, setModalOpen] = useState(false);
  const provider = byok ? getProvider(byok.provider) : null;

  function handleRemove() {
    clearByok();
    setByok(null);
  }

  return (
    <div className="account-panel">
      <h2 className="account-panel-title">Analysis Studio API key</h2>
      <p className="account-panel-desc">
        Your key is stored only in this browser and is sent straight to the provider you
        pick — never to our servers. Use this to update it if it’s wrong or expired.
      </p>

      {byok ? (
        <div className="account-key-card">
          <div className="account-key-row">
            <span className="account-key-label">Provider</span>
            <span className="account-key-val">{provider?.label || byok.provider}</span>
          </div>
          <div className="account-key-row">
            <span className="account-key-label">Model</span>
            <span className="account-key-val">{byok.model}</span>
          </div>
          <div className="account-key-row">
            <span className="account-key-label">Key</span>
            <span className="account-key-val account-key-mono">{maskKey(byok.key)}</span>
          </div>
          <div className="account-key-actions">
            <button className="account-key-btn" onClick={() => setModalOpen(true)}>Change key</button>
            <button className="account-key-btn account-key-btn--danger" onClick={handleRemove}>Remove key</button>
          </div>
        </div>
      ) : (
        <div className="account-key-card">
          <p className="account-panel-desc" style={{ margin: 0 }}>No API key set in this browser.</p>
          <div className="account-key-actions">
            <button className="account-key-btn" onClick={() => setModalOpen(true)}>Set up a key</button>
          </div>
        </div>
      )}

      <p className="account-panel-desc" style={{ marginTop: 12 }}>
        <Link to="/analyze">Go to Analysis Studio →</Link>
      </p>

      {modalOpen && (
        <ProviderModal
          onClose={() => setModalOpen(false)}
          onSaved={() => setByok(loadByok())}
        />
      )}
    </div>
  );
}

function formatMemberSince(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getInitials(email) {
  if (!email) return '?';
  return email[0].toUpperCase();
}

// Console theme (DS1): shared card/label styling for the panels moved into the account
// shell (A3). These reference the `.gp-console` tokens (tokens.css) set on the shell wrapper
// below — only the look changes here, no panel's data or behavior.
const SECTION = {
  border: '1px solid var(--c-hairline, rgba(95,212,255,0.18))',
  borderRadius: 4,
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
  background: 'var(--c-panel, rgba(6,12,20,0.95))',
};

const LABEL = {
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: 'var(--c-mono, monospace)',
  color: 'var(--c-accent, #5fd4ff)',
  marginBottom: 4,
};

function ProfilePanel({ user, memberSince, handleSignOut }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text-head, #eef5f9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          {memberSince && (
            <div style={{ fontSize: '0.75rem', color: 'var(--c-text-dim, #7d8b96)', marginTop: 4 }}>
              Since {memberSince}
            </div>
          )}
        </div>
      </div>

      {/* Account actions */}
      <div style={SECTION}>
        <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Account</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleSignOut}
            style={{
              background: 'var(--c-panel-2, #0b1622)',
              border: '1.5px solid var(--c-hairline, rgba(95,212,255,0.18))',
              borderRadius: 8, padding: '0.6rem 1rem',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', color: 'var(--c-text-head, #eef5f9)',
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
                fontSize: '0.8rem', color: 'var(--c-error, #ff6a4d)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              Delete account
            </button>
          ) : (
            <div style={{
              background: 'rgba(255,106,77,0.08)', border: '1.5px solid rgba(255,106,77,0.4)',
              borderRadius: 8, padding: '0.75rem 1rem',
              fontSize: '0.85rem',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--c-error, #ff6a4d)', marginBottom: 6 }}>Are you sure?</div>
              <div style={{ color: 'var(--c-text-body, #c9d6df)', marginBottom: 10, lineHeight: 1.5 }}>
                To delete your account, email us at{' '}
                <a href="mailto:globalperspectives.app@gmail.com?subject=Delete%20my%20account" style={{ color: 'var(--c-accent, #5fd4ff)' }}>
                  globalperspectives.app@gmail.com
                </a>
                {' '}and we'll process it within 24 hours.
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.8rem', color: 'var(--c-text-dim, #7d8b96)', cursor: 'pointer' }}
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

// Membership & credits at a glance — current plan + credit balance, with links into the
// /membership page to subscribe / buy more. Reads the same hook the header pill uses.
function MembershipPanel() {
  const { membership, isMember, creditBalance, available, loading } = useMembership();

  if (!available) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={SECTION}>
          <div style={LABEL}>Membership</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--c-text-dim, #7d8b96)' }}>
            Membership &amp; credits aren't available yet.
          </div>
        </div>
      </div>
    );
  }

  const renews = membership?.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Plan */}
      <div style={SECTION}>
        <div style={LABEL}>Plan</div>
        {loading ? (
          <div style={{ color: 'var(--c-text-dim, #7d8b96)', fontSize: '0.9rem' }}>Loading…</div>
        ) : isMember ? (
          <>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--c-text-head, #eef5f9)' }}>
              <span style={{ color: 'var(--c-ok, #6fd29a)' }}>✓</span> Member
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--c-text-dim, #7d8b96)', marginTop: 4 }}>
              {membership?.status === 'active' ? 'Active' : (membership?.status || 'Active')}
              {renews ? ` · renews ${renews}` : ''}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--c-text-head, #eef5f9)' }}>Free</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--c-text-dim, #7d8b96)', marginTop: 4, lineHeight: 1.45 }}>
              Reading stays free. Membership adds the full correction history, country change-alerts, and a monthly allowance of custom analyses.
            </div>
          </>
        )}
        <Link to="/membership" className="btn-gp" style={{ display: 'inline-block', marginTop: '0.85rem' }}>
          {isMember ? 'Manage membership' : 'See membership'}
        </Link>
      </div>

      {/* Credits */}
      <div style={SECTION}>
        <div style={LABEL}>Analysis credits</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--c-text-head, #eef5f9)' }}>{loading ? '—' : creditBalance}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--c-text-dim, #7d8b96)' }}>credit{creditBalance === 1 ? '' : 's'}</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--c-text-dim, #7d8b96)', marginTop: 4, lineHeight: 1.45 }}>
          Each custom analysis in the Analysis Studio uses one credit{isMember ? ', after your included monthly allowance' : ''}.
        </div>
        {creditPacks().length > 0 && (
          <Link to="/membership" className="btn-gp" style={{ display: 'inline-block', marginTop: '0.85rem' }}>
            Buy credits
          </Link>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0, width: 44, height: 26, borderRadius: 13, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', padding: 0,
        background: checked ? 'var(--c-accent, #5fd4ff)' : 'var(--c-hairline-strong, rgba(95,212,255,0.3))', opacity: disabled ? 0.55 : 1,
        position: 'relative', transition: 'background .15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left .15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, disabled, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid var(--c-hairline, rgba(95,212,255,0.18))',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--c-text-head, #eef5f9)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.8rem', color: 'var(--c-text-dim, #7d8b96)', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} label={label} />
    </div>
  );
}

function NotificationsPanel() {
  const { prefs, loading, saving, error, save, follow, endpointMissing } = usePreferences();
  const [notice, setNotice] = useState(null); // transient subscribe/unsubscribe confirmation

  // Save a change, then show a confirmation only if it actually persisted.
  async function change(patch, msg) {
    setNotice(null);
    const ok = await save(patch);
    if (ok && msg) setNotice(msg);
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={SECTION}>
        <div style={{ ...LABEL, marginBottom: '0.75rem' }}>Email notifications</div>

        {endpointMissing ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--c-text-dim, #7d8b96)', lineHeight: 1.5 }}>
            Email delivery isn’t live yet. Notification settings will appear here once it’s enabled.
          </div>
        ) : loading ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--c-text-dim, #7d8b96)' }}>Loading preferences…</div>
        ) : (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-dim, #7d8b96)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Email delivery is live. Turn a channel on to subscribe, off to unsubscribe — changes take effect immediately.
            </div>

            <ToggleRow
              label="Breaking news alerts"
              desc="An email the moment a major story breaks, with our analysis."
              checked={prefs.breakingOptIn}
              disabled={saving}
              onChange={(v) => change({ breakingOptIn: v }, v ? 'Subscribed to breaking alerts.' : 'Unsubscribed from breaking alerts.')}
            />
            <ToggleRow
              label="Weekly digest"
              desc="A roundup of the most significant stories."
              checked={prefs.digestOptIn}
              disabled={saving}
              onChange={(v) => change({ digestOptIn: v }, v ? 'Subscribed to the weekly digest.' : 'Unsubscribed from the weekly digest.')}
            />

            {prefs.digestOptIn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 0', borderBottom: '1px solid var(--c-hairline, rgba(95,212,255,0.18))' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--c-text-head, #eef5f9)' }}>Frequency</span>
                <select
                  value={prefs.digestCadence}
                  disabled={saving}
                  onChange={(e) => save({ digestCadence: e.target.value })}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1.5px solid var(--c-hairline, rgba(95,212,255,0.18))', fontSize: '0.85rem' }}
                >
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            )}

            {(prefs.breakingOptIn || prefs.digestOptIn) && (
              <button
                onClick={() => change({ breakingOptIn: false, digestOptIn: false }, 'You’ve unsubscribed from all emails.')}
                disabled={saving}
                style={{ marginTop: '0.95rem', background: 'none', border: 'none', padding: 0, fontSize: '0.8rem', color: 'var(--c-error, #ff6a4d)', cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Unsubscribe from all
              </button>
            )}

            {notice && (
              <div style={{ marginTop: '0.85rem', fontSize: '0.82rem', color: 'var(--c-ok, #6fd29a)', lineHeight: 1.5 }}>
                ✓ {notice}
              </div>
            )}

            {error && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--c-error, #ff6a4d)' }}>{error}</div>
            )}
          </>
        )}
      </div>

      {/* Country change-alerts — the member "follow a country's read" list (drift alerts, P5). */}
      {!endpointMissing && !loading && (
        <div style={SECTION}>
          <div style={{ ...LABEL, marginBottom: '0.35rem' }}>Country change-alerts</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--c-text-dim, #7d8b96)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            We email you when our read on a country you follow materially changes — grounded in the cited event that moved it.
            Follow a country from its page (tap <span style={{ whiteSpace: 'nowrap' }}>🔔 Follow</span>).
          </div>

          {(prefs.followedCountries || []).length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--c-text-dim, #7d8b96)', lineHeight: 1.5 }}>
              You’re not following any countries yet.
            </div>
          ) : (
            <>
              {(prefs.followedCountries || []).map((c) => (
                <div key={c} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '1rem', padding: '0.7rem 0', borderBottom: '1px solid var(--c-hairline, rgba(95,212,255,0.18))',
                }}>
                  <Link to={`/weekly/country/${encodeURIComponent(c)}`} style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--c-text-head, #eef5f9)', textDecoration: 'none' }}>{c}</Link>
                  <button
                    onClick={async () => { const ok = await follow(c, false); if (ok) setNotice(`Stopped following ${c}.`); }}
                    disabled={saving}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.8rem', color: 'var(--c-error, #ff6a4d)', cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    Unfollow
                  </button>
                </div>
              ))}
              <ToggleRow
                label="Pause all change-alerts"
                desc="Keep your follow list but stop the emails. Turn off to resume."
                checked={!prefs.driftOptIn}
                disabled={saving}
                onChange={(paused) => change({ driftOptIn: !paused }, paused ? 'Change-alerts paused.' : 'Change-alerts resumed.')}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// K1 (AccountDesk.dc.html, approved 2026-09-26): five left-rail sections replacing the old
// 5-tab strip. Order and copy (label + one-line subtitle) match the design board exactly.
const SECTIONS = [
  { id: 'desk',    label: 'Desk',              subtitle: 'what changed · following · saved', kicker: 'DESK',
    title: 'Your desk', sub: 'What changed since your last visit, what you follow, and what you saved.' },
  { id: 'alerts',  label: 'Alerts & email',    subtitle: 'what you will be told',              kicker: 'ALERTS & EMAIL',
    title: 'What you will be told', sub: 'Every email with its real state — nothing claims to be on when the thing behind it is paused.' },
  { id: 'studio',  label: 'Studio',            subtitle: 'your key · shared analyses · receipts', kicker: 'STUDIO',
    title: 'Studio', sub: 'Your AI key, stored only in this browser, and what you made with it.' },
  { id: 'plan',    label: 'Plan',              subtitle: 'membership · billing',                kicker: 'PLAN',
    title: 'Plan', sub: 'What you pay and what it includes today. Billing is handled by Polar.' },
  { id: 'profile', label: 'Profile & sign-in', subtitle: 'email · sign out',                    kicker: 'PROFILE & SIGN-IN',
    title: 'Profile', sub: 'The rare things.' },
];

// URL compatibility (A3): the old 5-tab `?tab=` values keep working — they just resolve to the
// new section ids. Existing in-app links (Layout.jsx "Manage membership" → ?tab=membership,
// SubscribeCard "Manage" → ?tab=notifications) still land on the right section. Any unknown or
// absent value falls back to `desk`, never a blank page.
const TAB_TO_SECTION = {
  saved: 'desk',
  notifications: 'alerts',
  analysis: 'studio',
  membership: 'plan',
  profile: 'profile',
  // new values also accepted as-is
  desk: 'desk',
  alerts: 'alerts',
  studio: 'studio',
  plan: 'plan',
};

function resolveSection(tabParam) {
  return TAB_TO_SECTION[tabParam] || 'desk';
}

// Signed-out console screen (A6 will replace this with the full calm sign-in board; for now A3
// gives /account a non-blank, honest state instead of redirecting immediately). Lists only
// things that are true today — no membership-only claims, no invented features.
function SignedOutDesk() {
  return (
    <div className="gp-console acct-shell acct-shell--signedout">
      <div className="acct-signedout">
        <div className="acct-section-kicker">ACCOUNT</div>
        <h1 className="acct-section-title">What an account gives you here</h1>
        <ul className="acct-signedout-list">
          <li>Saved stories, countries, and daily briefs, kept in one list</li>
          <li>An Analysis Studio key, stored only in this browser</li>
          <li>Alert settings for the emails that are live today</li>
        </ul>
        <p className="acct-signedout-note">Following countries is part of membership.</p>
        <Link to="/signin" className="btn-gp accent acct-signin-btn">Sign in</Link>
      </div>
    </div>
  );
}

export default function Account() {
  useEffect(() => { document.title = 'Account | Global Perspectives'; }, []);
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { savedItems, loading: savedLoading, unsave } = useSavedItems();

  const sectionId = resolveSection(searchParams.get('tab'));

  function setSection(id) {
    setSearchParams({ tab: id }, { replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (authLoading) {
    return <div style={{ padding: '2rem', color: 'var(--c-text-dim, #7d8b96)' }}>Loading account…</div>;
  }

  // Public data (saved/follow/Studio) never gates on sign-in elsewhere in the app; the account
  // desk itself is inherently sign-in-scoped (it's "your" saved list / plan / profile), so an
  // honest signed-out screen replaces the old silent redirect to /signin.
  if (!user || user.isAnonymous) {
    return <SignedOutDesk />;
  }

  const memberSince = formatMemberSince(user.metadata?.creationTime);
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];

  return (
    <div className="gp-console acct-shell">
      <nav className="acct-rail" aria-label="Account sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`acct-rail-btn${s.id === sectionId ? ' acct-rail-btn--active' : ''}`}
            aria-current={s.id === sectionId ? 'page' : undefined}
            onClick={() => setSection(s.id)}
          >
            <span className="acct-rail-label">
              {s.label}
              {s.id === 'desk' && savedItems.length > 0 && (
                <span className="account-tab-badge">{savedItems.length}</span>
              )}
            </span>
            <span className="acct-rail-sub">{s.subtitle}</span>
          </button>
        ))}
      </nav>

      <div className="acct-content">
        <section aria-labelledby="acct-section-heading">
          <div className="acct-section-kicker">{section.kicker}</div>
          <h1 id="acct-section-heading" className="acct-section-title">{section.title}</h1>
          <p className="acct-section-sub">{section.sub}</p>

          {section.id === 'desk' && (
            <DeskPanel
              savedItems={savedItems}
              savedLoading={savedLoading}
              onUnsave={unsave}
            />
          )}

          {section.id === 'alerts' && <NotificationsPanel />}

          {section.id === 'studio' && <AnalysisKeyPanel />}

          {section.id === 'plan' && <MembershipPanel />}

          {section.id === 'profile' && (
            <ProfilePanel
              user={user}
              memberSince={memberSince}
              handleSignOut={handleSignOut}
            />
          )}
        </section>
      </div>
    </div>
  );
}
