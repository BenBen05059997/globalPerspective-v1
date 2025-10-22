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
            <div className="flex gap-4">
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
          <div className="text-center">
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Global Perspectives - AI-powered news aggregation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;