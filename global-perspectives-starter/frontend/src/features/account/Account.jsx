import { useState, useEffect } from 'react';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useSavedItems } from '@/shared/hooks/useSavedItems';
import { usePreferences } from '@/shared/hooks/usePreferences';
import { useMembership } from '@/shared/hooks/useMembership';
import { loadByok, clearByok, getProvider, ProviderModal } from '@/features/analysis-studio';
import DeskPanel from '@/features/account/components/DeskPanel';
import { ACCOUNT_CLAIMS, ACCOUNT_NOTE } from '@/features/account/lib/accountClaims';
import { useWeeklyBrief } from '@/features/briefings';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/shared/hooks/useDailyBrief';
import { pausedSince } from '@/shared/lib/freshness';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import { ROUTE } from '@/shared/lib/links.js';
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
    <Card className="acct-card">
      <SectionHeader label="Analysis Studio API key" />
      <p className="acct-desc">
        Your key is stored only in this browser and is sent straight to the provider you
        pick — never to our servers. Use this to update it if it’s wrong or expired.
      </p>

      {byok ? (
        <Card level={2} className="account-key-card">
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
            <Button compact onClick={() => setModalOpen(true)}>Change key</Button>
            <Button compact className="acct-danger" onClick={handleRemove}>Remove key</Button>
          </div>
        </Card>
      ) : (
        <Card level={2} className="account-key-card">
          <p className="acct-desc acct-desc--flush">No API key set in this browser.</p>
          <div className="account-key-actions">
            <Button compact onClick={() => setModalOpen(true)}>Set up a key</Button>
          </div>
        </Card>
      )}

      <p className="acct-desc acct-desc--after">
        <Link to={ROUTE.studio}>Go to Analysis Studio →</Link>
      </p>

      {modalOpen && (
        <ProviderModal
          onClose={() => setModalOpen(false)}
          onSaved={() => setByok(loadByok())}
        />
      )}
    </Card>
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

function ProfilePanel({ user, memberSince, handleSignOut }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="acct-col">
      {/* Avatar + identity */}
      <Card className="acct-card acct-identity">
        <div className="acct-avatar" aria-hidden="true">{getInitials(user.email)}</div>
        <div className="acct-identity__text">
          <div className="acct-identity__email">{user.email}</div>
          {memberSince && <div className="acct-fine">Since {memberSince}</div>}
        </div>
      </Card>

      {/* Account actions */}
      <Card className="acct-card">
        <SectionHeader label="Account" />
        <div className="acct-stack">
          <Button onClick={handleSignOut} className="acct-btn-block">Sign out</Button>

          {!showDeleteConfirm ? (
            <button type="button" className="acct-textbtn acct-textbtn--danger" onClick={() => setShowDeleteConfirm(true)}>
              Delete account
            </button>
          ) : (
            <div className="acct-confirm">
              <div className="acct-confirm__title">Are you sure?</div>
              <div className="acct-confirm__body">
                To delete your account, email us at{' '}
                <a href="mailto:globalperspectives.app@gmail.com?subject=Delete%20my%20account">
                  globalperspectives.app@gmail.com
                </a>
                {' '}and we'll process it within 24 hours.
              </div>
              <button type="button" className="acct-textbtn" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// Membership at a glance — current plan, with a link into the /membership page.
function MembershipPanel() {
  const { membership, isMember, available, loading } = useMembership();

  if (!available) {
    return (
      <div className="acct-col">
        <Card className="acct-card">
          <SectionHeader label="Membership" />
          <div className="acct-muted">Membership isn't available yet.</div>
        </Card>
      </div>
    );
  }

  const renews = membership?.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="acct-col">
      {/* Plan */}
      <Card className="acct-card">
        <SectionHeader label="Plan" />
        {loading ? (
          <BootLoader variant="inline" className="gp-boot--tight" label="Loading plan" text="Loading plan" />
        ) : isMember ? (
          <>
            <div className="acct-plan-name">
              <span className="acct-ok">✓</span> Member
            </div>
            <div className="acct-fine">
              {membership?.status === 'active' ? 'Active' : (membership?.status || 'Active')}
              {renews ? ` · renews ${renews}` : ''}
            </div>
          </>
        ) : (
          <>
            <div className="acct-plan-name">Free</div>
            <div className="acct-fine">
              Reading stays free. Membership adds the full correction history and the Analysis Studio on our compute.
            </div>
          </>
        )}
        <Button to="/membership" className="acct-card__action">
          {isMember ? 'Manage membership' : 'See membership'}
        </Button>
      </Card>
    </div>
  );
}

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="acct-switch"
    >
      <span className="acct-switch__knob" />
    </button>
  );
}

function ToggleRow({ label, desc, checked, disabled, onChange }) {
  return (
    <div className="acct-row">
      <div className="acct-row__text">
        <div className="acct-row__label">{label}</div>
        {desc && <div className="acct-fine">{desc}</div>}
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} label={label} />
    </div>
  );
}

// Real per-channel state, computed rather than typed (CLAUDE.md: never invent dates). The
// breaking-news and country change-alert crons are DISABLED site-wide today (project state,
// verified 2026-09-27) — that's an operational fact, not a per-user preference, so both channels
// show "paused — not sending" and their toggles are disabled regardless of the stored opt-in,
// rather than implying a subscribe click would do anything. Flip these back to opt-in-driven
// once either cron is turned back on.
const BREAKING_CRON_LIVE = false;
const DRIFT_CRON_LIVE = false;

function fmtShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NotificationsPanel() {
  const { prefs, loading, saving, error, save, follow, endpointMissing } = usePreferences();
  const [notice, setNotice] = useState(null); // transient subscribe/unsubscribe confirmation

  // F1.4 (review R2): the weekly-brief note ("no edition since <date> while analysis is paused")
  // is computed from the two real sources — the latest published edition (useWeeklyBrief) and
  // whether analysis is currently paused (useDailyBrief + pausedSince, the same helper the map
  // console and site-wide status line use).
  const { brief: weeklyBrief } = useWeeklyBrief();
  const { brief: latestDailyBrief, loading: dailyLoading, error: dailyError } = useDailyBrief();
  const analysisPaused = pausedSince({
    newestAnalysisAt: latestDailyBrief?.generatedAt,
    searched: !dailyLoading && !dailyError,
    lookbackDays: MAX_LOOKBACK_DAYS,
  });
  const lastWeeklyEditionLabel = weeklyBrief?.weekOf ? fmtShortDate(weeklyBrief.weekOf + 'T00:00:00Z') : null;

  // Save a change, then show a confirmation only if it actually persisted.
  async function change(patch, msg) {
    setNotice(null);
    const ok = await save(patch);
    if (ok && msg) setNotice(msg);
  }

  return (
    <div className="acct-col">
      <Card className="acct-card">
        <SectionHeader label="Email notifications" />

        {endpointMissing ? (
          <div className="acct-muted">
            Email delivery isn’t live yet. Notification settings will appear here once it’s enabled.
          </div>
        ) : loading ? (
          <BootLoader variant="inline" className="gp-boot--tight" label="Loading preferences" text="Loading preferences" />
        ) : (
          <>
            <div className="acct-fine acct-fine--lead">
              Each channel below shows its real state — nothing here claims to be sending when it isn’t.
            </div>

            <ToggleRow
              label="Breaking news alerts — paused, not sending"
              desc="The breaking-news email is currently off site-wide. Turning this on saves your preference but won’t send anything until it’s re-enabled."
              checked={BREAKING_CRON_LIVE && prefs.breakingOptIn}
              disabled={saving || !BREAKING_CRON_LIVE}
              onChange={(v) => change({ breakingOptIn: v }, v ? 'Subscribed to breaking alerts.' : 'Unsubscribed from breaking alerts.')}
            />
            <ToggleRow
              label="Weekly brief"
              desc={
                analysisPaused && lastWeeklyEditionLabel
                  ? `A roundup of the most significant stories. No edition since ${lastWeeklyEditionLabel} while analysis is paused.`
                  : 'A roundup of the most significant stories.'
              }
              checked={prefs.digestOptIn}
              disabled={saving}
              onChange={(v) => change({ digestOptIn: v }, v ? 'Subscribed to the weekly brief.' : 'Unsubscribed from the weekly brief.')}
            />

            {prefs.digestOptIn && (
              <div className="acct-row acct-row--inline">
                <span className="acct-row__label">Frequency</span>
                <select
                  className="acct-select"
                  value={prefs.digestCadence}
                  disabled={saving}
                  onChange={(e) => save({ digestCadence: e.target.value })}
                >
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            )}

            {(prefs.breakingOptIn || prefs.digestOptIn) && (
              <button
                type="button"
                className="acct-textbtn acct-textbtn--danger acct-after"
                onClick={() => change({ breakingOptIn: false, digestOptIn: false }, 'You’ve unsubscribed from all emails.')}
                disabled={saving}
              >
                Unsubscribe from all
              </button>
            )}

            {notice && (
              <div className="acct-notice" role="status">✓ {notice}</div>
            )}

            {error && (
              <div className="acct-error">{error}</div>
            )}
          </>
        )}
      </Card>

      {/* Country change-alerts — the member "follow a country's read" list (drift alerts, P5). */}
      {!endpointMissing && !loading && (
        <Card className="acct-card">
          <SectionHeader label="Country change-alerts — paused, not sending" />
          <div className="acct-fine acct-fine--lead">
            When live, we email you when our read on a country you follow materially changes — grounded in the cited event that moved it.
            This is currently off site-wide, so your follow list is kept but nothing sends. Follow a country from its page (tap <span className="acct-nowrap">🔔 Follow</span>).
          </div>

          {(prefs.followedCountries || []).length === 0 ? (
            <div className="acct-muted">
              You’re not following any countries yet.
            </div>
          ) : (
            <>
              {(prefs.followedCountries || []).map((c) => (
                <div key={c} className="acct-row acct-row--center">
                  <EntityLink kind="country" id={c} className="acct-row__label acct-row__link">{c}</EntityLink>
                  <button
                    type="button"
                    className="acct-textbtn acct-textbtn--danger"
                    onClick={async () => { const ok = await follow(c, false); if (ok) setNotice(`Stopped following ${c}.`); }}
                    disabled={saving}
                  >
                    Unfollow
                  </button>
                </div>
              ))}
              <ToggleRow
                label="Pause all change-alerts"
                desc="These emails are already off site-wide, so this has no further effect right now — it will apply once change-alerts are back on."
                checked={!DRIFT_CRON_LIVE || !prefs.driftOptIn}
                disabled={saving || !DRIFT_CRON_LIVE}
                onChange={(paused) => change({ driftOptIn: !paused }, paused ? 'Change-alerts paused.' : 'Change-alerts resumed.')}
              />
            </>
          )}
        </Card>
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
  { id: 'studio',  label: 'Studio',            subtitle: 'your key', kicker: 'STUDIO',
    title: 'Studio', sub: 'Your AI key, stored only in this browser — analysis runs on your key.' },
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
    <div className="acct-shell acct-shell--signedout">
      <div className="acct-signedout">
        <SectionHeader as="div" label="ACCOUNT" />
        <h1 className="acct-section-title">What an account gives you here</h1>
        <ul className="acct-signedout-list">
          {ACCOUNT_CLAIMS.map((claim) => (
            <li key={claim}>{claim}</li>
          ))}
        </ul>
        <p className="acct-signedout-note">{ACCOUNT_NOTE}</p>
        <Button variant="primary" to="/signin" className="acct-signin-btn">Sign in</Button>
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
    return <BootLoader variant="inline" label="Loading account" text="Loading account" />;
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
    <div className="acct-shell">
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
                <span className="acct-rail-count">{savedItems.length}</span>
              )}
            </span>
            <span className="acct-rail-sub">{s.subtitle}</span>
          </button>
        ))}
      </nav>

      <div className="acct-content">
        <section aria-labelledby="acct-section-heading">
          <SectionHeader as="div" label={section.kicker} />
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
