import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { t } from '../utils/i18n';

function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navBarRef = useRef(null);
  const { lang, setLang } = useLang();

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
    { to: '/', labelKey: 'navHome' },
    { to: '/map', labelKey: 'navMap' },
    { to: '/about', labelKey: 'navAbout' },
    { to: '/contact', labelKey: 'navContact' },
    { to: '/privacy', labelKey: 'navPrivacy' },
    { to: '/disclosures', labelKey: 'navDisclosures' },
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
              {navLinks.map(({ to, labelKey }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link ${location.pathname === to ? 'active' : ''}`}
                >
                  {t(labelKey, lang)}
                </Link>
              ))}
            </div>
            <div className="lang-toggle">
              {['en', 'ja', 'zh'].map(l => (
                <button
                  key={l}
                  className={`lang-btn ${lang === l ? 'active' : ''}`}
                  onClick={() => setLang(l)}
                >
                  {l === 'en' ? 'EN' : l === 'ja' ? '日本語' : '中文'}
                </button>
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
              Global Perspectives™ &mdash; {t('footerTagline', lang)}
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.9rem' }}>
              <Link to="/about" className="nav-link">{t('navAbout', lang)}</Link>
              <Link to="/privacy" className="nav-link">{t('footerPrivacy', lang)}</Link>
              <Link to="/disclosures" className="nav-link">{t('navDisclosures', lang)}</Link>
              <a
                href="mailto:globalperspectives.app@gmail.com"
                className="nav-link"
              >
                {t('navContact', lang)}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
