import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navBarRef = useRef(null);

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
    { to: '/about', label: 'About' },
    { to: '/privacy', label: 'Privacy' },
    { to: '/disclosures', label: 'Disclosures' },
  ];

  return (
    <div className="app">
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
