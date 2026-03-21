import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingBar from './LoadingBar';
import AIToast from './AIToast';

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navBarRef = useRef(null);
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navBarRef.current && !navBarRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/map', label: 'Map' },
    { to: '/weekly', label: 'Weekly Analysis' },
    { to: '/weekly/countries', label: 'Country Intel' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/about', label: 'About' },
  ];

  return (
    <div className="app">
      <LoadingBar />
      <AIToast />
      <nav className="nav">
        <div className="container">
          <div className="nav-bar" ref={navBarRef}>
            <Link to="/" className="nav-brand">
              <h2>Global Perspectives™</h2>
            </Link>
            <button
              type="button"
              className={`nav-toggle ${menuOpen ? 'open' : ''}`}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span />
              <span />
              <span />
            </button>
            <div className={`nav-links ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link ${location.pathname === to ? 'active' : ''}`}
                >
                  {label}
                </Link>
              ))}
              {!authLoading && (
                user ? (
                  <Link to="/account" className={`nav-link nav-link-auth ${location.pathname === '/account' ? 'active' : ''}`}>
                    {user.email}
                  </Link>
                ) : (
                  <Link to="/signin" className={`nav-link nav-link-auth ${location.pathname === '/signin' ? 'active' : ''}`}>
                    Sign in
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </nav>
      
      <main className="main-content">
        <div className="container">
          {children}
        </div>
      </main>
      
      <footer className="nav" style={{ borderTop: '2px solid var(--border-color)', borderBottom: 'none' }}>
        <div className="container">
          <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Global Perspectives™ &mdash; AI-powered news aggregation
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.9rem' }}>
              <Link to="/about" className="nav-link">About</Link>
              <Link to="/whitepaper" className="nav-link">White Paper</Link>
              <Link to="/privacy" className="nav-link">Privacy &amp; Terms</Link>
              <Link to="/disclosures" className="nav-link">Disclosures</Link>
              <a
                href="mailto:globalperspectives.app@gmail.com"
                className="nav-link"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
