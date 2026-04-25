import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingBar from './LoadingBar';
import AIToast from './AIToast';
import './Layout.css';

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [topicCount, setTopicCount] = useState(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') e.preventDefault();
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
    { to: '/map', label: 'Map' },
    { to: '/weekly', label: 'Threads' },
    { to: '/weekly/countries', label: 'Countries' },
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
        <div className="gp-brand">
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
              className={`gp-nav-link${isActive(to, exact) ? ' active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="gp-nav-right">
          <button className="gp-search" aria-label="Search (⌘K)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5"/>
              <path d="M11 11l3 3"/>
            </svg>
            <span>Search</span>
            <span className="gp-kbd">⌘K</span>
          </button>

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
          <Link to="/about">About</Link>
          <Link to="/whitepaper">White Paper</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/disclosures">Disclosures</Link>
          <a href="mailto:globalperspectives.app@gmail.com">Contact</a>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
