import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useMembership } from '@/features/account/hooks/useMembership';
import LoadingBar from '@/app/layout/LoadingBar';
import AIToast from '@/app/layout/AIToast';
import NotificationBell from '@/features/breaking/components/NotificationBell';
import { useAutoTour, startTourForPath } from '@/app/onboarding/useOnboarding';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief';
import { pausedSince } from '@/shared/lib/freshness';
import HudStatusLine from '@/features/map/components/HudStatusLine';
import '@/app/layout/Layout.css';

// Build stamp injected by Vite `define` (git SHA + date). `typeof` guard keeps it
// safe under vitest/dev where the globals may be absent (returns 'dev').
const _ver = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const _date = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
const BUILD_LABEL = `v${_ver}${_date ? ` · ${_date}` : ''}`;

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { isMember, creditBalance, available: billingAvailable } = useMembership();

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

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Sign-in link that returns you to the page you came from. Guard against auth
  // routes (signin/callback/account) so post-login doesn't loop back here; those
  // fall through to SignIn's own /weekly default.
  const signInHref = (() => {
    const path = location.pathname;
    if (/^\/(signin|auth|account)\b/.test(path)) return '/signin';
    const origin = path + location.search;
    return `/signin?returnTo=${encodeURIComponent(origin)}`;
  })();

  useEffect(() => {
    const handleKey = (e) => {
      // (⌘K is intentionally not bound — a global command palette is a future
      // enhancement. Don't swallow the keystroke until there's something to open.)
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // N1 (approved 2026-09-26): five plain, flat menu items — no groups, no dropdowns. "Topics"
  // (`/`) stays reachable via the logo; "Countries" (`/weekly/countries`) and "Weekly Brief"
  // (`/weekly-brief`) stay reachable via interim links on the Stories/Briefings pages instead of
  // the menu. "Briefings" points at `/daily` until a real `/briefings` route exists.
  const navLinks = [
    { to: '/map', label: 'Map', title: "Today's coverage on a world map — the spatial view of the same live topics." },
    { to: '/weekly', label: 'Stories', title: 'Ongoing story arcs ranked by risk — what leads, what develops, how each has evolved.' },
    { to: '/daily', label: 'Briefings', title: 'The end-of-day intelligence brief: one synthesised read of what mattered today.' },
    { to: '/analyze', label: 'Studio', title: 'Analysis Studio — run a cited AI deep-dive across up to 4 stories (your key, or ours as a member).' },
    { to: '/track-record', label: 'Track record', title: 'Accountability hub — every forecast publicly scored, every revised conclusion logged.' },
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

          <button
            type="button"
            className={`gp-hamburger${menuOpen ? ' open' : ''}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div className={`gp-mobile-menu${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        {navLinks.map(({ to, label, exact, title }) => (
          <Link
            key={to}
            to={to}
            title={title}
            className={`gp-mobile-link${isActive(to, exact) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        {!authLoading && (
          user && !user.isAnonymous ? (
            <Link to="/account" className="gp-mobile-link">{user.email}</Link>
          ) : (
            <Link to={signInHref} className="gp-mobile-link">Sign in →</Link>
          )
        )}
      </div>

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

      <main className="gp-main">
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
    </div>
  );
}

export default Layout;
