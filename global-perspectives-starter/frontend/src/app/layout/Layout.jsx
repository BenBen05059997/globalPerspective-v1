import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useMembership } from '@/features/account/hooks/useMembership';
import LoadingBar from '@/app/layout/LoadingBar';
import AIToast from '@/app/layout/AIToast';
import NotificationBell from '@/features/breaking/components/NotificationBell';
import { useAutoTour, startTourForPath } from '@/app/onboarding/useOnboarding';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief';
import { pausedSince } from '@/shared/lib/freshness';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import HudStatusLine from '@/features/map/components/HudStatusLine';
import '@/app/layout/Layout.css';

// P1 phone tab bar (A2): simple inline-SVG line icons, no icon library. 20x20 viewBox, stroke
// only (matches the existing `.gp-help` icon's style), so they read at 20px in the bar.
function IconMap() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M2 5.5l5-2 6 2 5-2v11l-5 2-6-2-5 2z" />
      <path d="M7 3.5v11M13 5.5v11" />
    </svg>
  );
}
function IconStories() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 5.5h14M3 10h14M3 14.5h9" />
    </svg>
  );
}
function IconBriefs() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M5.5 2.5h6l3 3v11.5h-9z" />
      <path d="M11.5 2.5v3h3" />
      <path d="M7.5 10.5h5M7.5 13h5" strokeLinecap="round" />
    </svg>
  );
}
function IconStudio() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5.3" />
      <path d="M16 16l-3.3-3.3" />
    </svg>
  );
}
function IconRecord() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M6.6 10.2l2.3 2.3 4.6-5" />
    </svg>
  );
}

// Build stamp injected by Vite `define` (git SHA + date). `typeof` guard keeps it
// safe under vitest/dev where the globals may be absent (returns 'dev').
const _ver = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const _date = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
const BUILD_LABEL = `v${_ver}${_date ? ` · ${_date}` : ''}`;

function Layout({ children }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isMember, creditBalance, available: billingAvailable } = useMembership();
  // P1 phone tab bar (A2): shared 900px breakpoint — same one /map's own MAP·LIST·ALERTS tabs use.
  const isPhone = useIsPhone();

  // Site-wide honesty line (N1/DS1): the same computed "paused since" text the map page shows
  // itself (hidden here for /map to avoid a duplicate claim — see the render guard below).
  // Reuses the map's own hook/helpers so this layer invents no new freshness logic.
  const { brief: latestBrief, loading: briefLoading, error: briefError } = useDailyBrief();
  const paused = useMemo(() => pausedSince({
    newestAnalysisAt: latestBrief?.generatedAt,
    searched: !briefLoading && !briefError,
    lookbackDays: MAX_LOOKBACK_DAYS,
  }), [latestBrief, briefLoading, briefError]);

  useAutoTour(location.pathname);

  // Sign-in link that returns you to the page you came from. Guard against auth
  // routes (signin/callback/account) so post-login doesn't loop back here; those
  // fall through to SignIn's own /weekly default.
  const signInHref = (() => {
    const path = location.pathname;
    if (/^\/(signin|auth|account)\b/.test(path)) return '/signin';
    const origin = path + location.search;
    return `/signin?returnTo=${encodeURIComponent(origin)}`;
  })();

  // N1 (approved 2026-09-26): five plain, flat menu items — no groups, no dropdowns. "Topics"
  // (`/`) stays reachable via the logo; "Countries" (`/weekly/countries`) and "Weekly Brief"
  // (`/weekly-brief`) stay reachable via interim links on the Stories/Briefings pages instead of
  // the menu. "Briefings" points at `/daily` until a real `/briefings` route exists.
  // `short` + `icon` feed the phone tab bar (P1/A2) — same five items, short labels, a small
  // inline-SVG icon per item (no icon library).
  // F1.6 (review R2): plain, true tooltips — no claim of "today"/"live" the data can't back up
  // while analysis is paused, no member-analysis claim (Studio's member path is broken/parked),
  // no "every forecast publicly scored" (only 122 resolved, one week, unscored track record).
  const navLinks = [
    { to: '/map', label: 'Map', short: 'Map', icon: IconMap, title: 'Where events happen, from the latest stories and live disaster alerts.' },
    { to: '/weekly', label: 'Stories', short: 'Stories', icon: IconStories, title: 'Every story we follow, as board, table, map or web.' },
    { to: '/daily', label: 'Briefings', short: 'Briefs', icon: IconBriefs, title: 'The daily and weekly briefings, with every past edition.' },
    { to: '/analyze', label: 'Studio', short: 'Studio', icon: IconStudio, title: 'Analyse our stories with your own AI key.' },
    { to: '/track-record', label: 'Track record', short: 'Record', icon: IconRecord, title: 'How our forecasts are logged and checked as they come due.' },
  ];

  const isActive = (to, exact) => {
    if (exact) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  return (
    <div className="gp-app">
      <LoadingBar />
      <AIToast />

      <nav className="gp-nav">
        <div className="gp-brand" data-tour="nav-brand">
          <Link to="/" className="gp-brand-link">
            <span className="gp-logo">G</span>
            <span className="gp-name">
              Global Perspectives<sup className="gp-tm">™</sup>
            </span>
          </Link>
        </div>

        <div className="gp-nav-links">
          {navLinks.map(({ to, label, exact, title }) => (
            <Link
              key={to}
              to={to}
              title={title}
              data-tour={`nav-${to}`}
              className={`gp-nav-link${isActive(to, exact) ? ' active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="gp-nav-right">
          <button
            type="button"
            className="gp-help"
            data-tour="nav-help"
            aria-label="How to read this page"
            title="How to read this page"
            onClick={() => startTourForPath(location.pathname)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M6.2 6.1a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" strokeLinecap="round" />
              <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <NotificationBell />

          {!authLoading && user && !user.isAnonymous && billingAvailable && (creditBalance > 0 || isMember) && (
            <Link
              to="/account?tab=membership"
              className={`gp-credits-pill${isMember ? ' is-member' : ''}`}
              title={`${creditBalance} analysis credit${creditBalance === 1 ? '' : 's'}${isMember ? ' · Member' : ''} — manage`}
            >
              {isMember && <span className="gp-credits-dot" aria-hidden>●</span>}
              <span className="gp-credits-n">{creditBalance}</span>
              <span className="gp-credits-label">credits</span>
            </Link>
          )}

          {!authLoading && (
            user && !user.isAnonymous ? (
              <Link to="/account" className="gp-btn">
                {user.email?.split('@')[0] || 'Account'}
              </Link>
            ) : (
              <Link to={signInHref} className="gp-btn gp-btn-primary">Sign in</Link>
            )
          )}
        </div>
      </nav>

      {/* The situation map carries its own live, per-source freshness line — hide the strip there
          so the page never shows two conflicting freshness claims. Everywhere else the strip
          shows the same computed "paused since" honesty line the map uses (N1/DS1): nothing when
          analysis is fresh, never a typed/guessed claim. The old topic-count + tagline content
          was dropped (an unbacked freshness claim — CLAUDE.md: no placeholder/fabricated UI). */}
      {location.pathname !== '/map' && paused && (
        <div className="gp-strip gp-console">
          <HudStatusLine paused={paused} />
        </div>
      )}

      <main className={`gp-main${isPhone ? ' gp-main-tabbar' : ''}`}>
        <div className="container">
          {children}
        </div>
      </main>

      <footer className="gp-footer">
        <span>Global Perspectives™ — AI news intelligence</span>
        <div className="gp-footer-links">
          <Link to="/about">About</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/disclosures">Disclosures</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/track-record">Track Record</Link>
        </div>
        <span className="gp-footer-ver" title="Deployed build">{BUILD_LABEL}</span>
      </footer>

      {/* P1 phone tab bar (A2): the five main-nav items as a fixed bottom bar under 900px,
          replacing the old hamburger dropdown (removed above). Console-dark on every page — the
          `.gp-console` class just scopes those CSS tokens to this one element, it doesn't touch
          the rest of the (light) page. /map's own MAP·LIST·ALERTS in-page tabs and bottom sheet
          are unaffected — they sit above this bar (SituationHome.css). */}
      {isPhone && (
        <nav className="gp-tabbar gp-console" aria-label="Primary, phone">
          {navLinks.map((item) => {
            const { to, short, icon: TabIcon } = item;
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`gp-tabbar-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <TabIcon />
                <span className="gp-tabbar-label">{short}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default Layout;
