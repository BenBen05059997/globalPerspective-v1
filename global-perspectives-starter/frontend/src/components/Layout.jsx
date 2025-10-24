import { Link, useLocation } from 'react-router-dom';

function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="app">
      <nav className="nav">
        <div className="container">
          <div className="flex justify-between items-center">
            <Link to="/" className="nav-link">
              <h2>Global Perspectives</h2>
            </Link>
            <div className="flex gap-4" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link 
                to="/" 
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                Home
              </Link>
              {/* Topics nav removed; Home and Map remain */}
              <Link 
                to="/map" 
                className={`nav-link ${location.pathname === '/map' ? 'active' : ''}`}
              >
                Map
              </Link>
              <Link 
                to="/about" 
                className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}
              >
                About
              </Link>
              <Link 
                to="/privacy" 
                className={`nav-link ${location.pathname === '/privacy' ? 'active' : ''}`}
              >
                Privacy
              </Link>
              <Link 
                to="/disclosures" 
                className={`nav-link ${location.pathname === '/disclosures' ? 'active' : ''}`}
              >
                Disclosures
              </Link>
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
              Global Perspectives &mdash; AI-powered news aggregation
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
