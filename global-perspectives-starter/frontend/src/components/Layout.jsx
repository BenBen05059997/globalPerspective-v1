import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMembership } from '../hooks/useMembership';
import LoadingBar from './LoadingBar';
import AIToast from './AIToast';
import NotificationBell from './NotificationBell';
import { useAutoTour, startTourForPath } from '../onboarding/useOnboarding';
import './Layout.css';

// Build stamp injected by Vite `define` (git SHA + date). `typeof` guard keeps it
// safe under vitest/dev where the globals may be absent (returns 'dev').
const _ver = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const _date = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
const BUILD_LABEL = `v${_ver}${_date ? ` · ${_date}` : ''}`;

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [topicCount, setTopicCount] = useState(null);
  const { user, loading: authLoading } = useAuth();
  const { isMember, creditBalance, available: billingAvailable } = useMembership();

  useAutoTour(location.pathname);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => {
      // (⌘K is intentionally not bound — a global command palette is a future
      // enhancement. Don't swallow the keystroke until there's something to open.)
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('gp_topics_cache');
      if (cached) {
        const { data } = JSON.parse(cached);
        setTopicCount(data?.topics?.length ?? null);
      }
    } catch { /* ignore malformed cache */ }
  }, []);

  const navLinks = [
    { to: '/', label: 'Topics', exact: true },
    { to: '/daily', label: 'Daily' },
    { to: '/weekly-brief', label: 'Weekly Brief' },
    { to: '/map', label: 'Map' },
    { to: '/weekly', label: 'Threads' },
    { to: '/weekly/countries', label: 'Countries' },
    { to: '/economy', label: 'Economy' },
    { to: '/analyze', label: 'Analyze' },
    { to: '/track-record', label: 'Track Record' },
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
          {navLinks.map(({ to, label, exact }) => (
            <Link
              key={to}
              to={to}
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

          {!authLoading && user && !user.isAnonymous && billingAvailable && (
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
              <Link to="/signin" className="gp-btn gp-btn-primary">Sign in</Link>
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
        {navLinks.map(({ to, label, exact }) => (
          <Link
            key={to}
            to={to}
            className={`gp-mobile-link${isActive(to, exact) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        {!authLoading && (
          user && !user.isAnonymous ? (
            <Link to="/account" className="gp-mobile-link">{user.email}</Link>
          ) : (
            <Link to="/signin" className="gp-mobile-link">Sign in →</Link>
          )
        )}
      </div>

      <div className="gp-strip">
        <span className="gp-strip-live">
          <span className="gp-dot-live" />
          LIVE
        </span>
        <span className="gp-strip-sep">·</span>
        {topicCount != null && (
          <>
            <span><b>{topicCount}</b> topics</span>
            <span className="gp-strip-sep">·</span>
          </>
        )}
        <span>Updated hourly</span>
        <span className="gp-strip-sep">·</span>
        <span>AI-powered global news intelligence</span>
      </div>

      <main className="gp-main">
        <div className="container">
          {children}
        </div>
      </main>

      <footer className="gp-footer">
        <span>Global Perspectives™ — AI news intelligence</span>
        <div className="gp-footer-links">
          <Link to="/economy">Economy</Link>
          <Link to="/track-record">Track Record</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/about">About</Link>
          <Link to="/whitepaper">White Paper</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/disclosures">Disclosures</Link>
          <a href="mailto:globalperspectives.app@gmail.com">Contact</a>
        </div>
        <span className="gp-footer-ver" title="Deployed build">{BUILD_LABEL}</span>
      </footer>
    </div>
  );
}

export default Layout;
