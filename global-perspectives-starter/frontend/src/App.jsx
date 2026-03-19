// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Home from './components/Home';
import WorldMap from './components/WorldMap';
import PrivacyTerms from './components/PrivacyTerms';
import AboutContact from './components/AboutContact';
import Disclosures from './components/Disclosures';
import Contact from './components/Contact';
import { ErrorProvider } from './contexts/ErrorContext';
import ErrorModal from './components/ErrorModal';
import WeeklyPage from './components/WeeklyPage';
import WeeklyMap from './components/WeeklyMap';
import ThreadPage from './components/ThreadPage';
import CountryPage from './components/CountryPage';
import CountryListPage from './components/CountryListPage';
import SignIn from './components/SignIn';
import AuthCallback from './components/AuthCallback';
import Pricing from './components/Pricing';
import Account from './components/Account';
import UpgradeSuccess from './components/UpgradeSuccess';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setAuthProvider } from './services/restProxy';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// ?preview=1 in URL enables hidden pages for testing
const PREVIEW_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';
if (PREVIEW_MODE) sessionStorage.setItem('gp_preview', '1');
const isPreview = PREVIEW_MODE || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gp_preview') === '1');

function ComingSoon() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 12px' }}>Under Construction</h2>
      <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 24px' }}>
        This feature is being built. Check back soon for weekly story intelligence, country briefings, and AI-powered narrative analysis.
      </p>
      <Link to="/" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>← Back to Home</Link>
    </div>
  );
}

function Gate({ children }) {
  return isPreview ? children : <ComingSoon />;
}

function resolveBasename() {
  const rawBase = import.meta.env.BASE_URL ?? '/';

  if (rawBase && rawBase !== '/' && rawBase !== './') {
    return rawBase.replace(/\/+$/, '');
  }

  if (!import.meta.env.DEV && typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]}`;
    }
  }

  return undefined;
}

// Wires Firebase getIdToken into restProxy so gated requests use JWT automatically
function AuthBridge() {
  const { getIdToken } = useAuth();
  useEffect(() => {
    setAuthProvider(getIdToken);
  }, [getIdToken]);
  return null;
}

export default function App() {
  const basename = resolveBasename();

  return (
    <ErrorProvider>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <AuthBridge />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<WorldMap />} />
              <Route path="/privacy" element={<PrivacyTerms />} />
              <Route path="/about" element={<AboutContact />} />
              <Route path="/disclosures" element={<Disclosures />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/weekly" element={<Gate><WeeklyPage /></Gate>} />
              <Route path="/weekly/thread/:threadId" element={<Gate><ThreadPage /></Gate>} />
              <Route path="/weekly/countries" element={<Gate><CountryListPage /></Gate>} />
              <Route path="/weekly/country/:countryName" element={<Gate><CountryPage /></Gate>} />
              <Route path="/weekly-map" element={<Gate><WeeklyMap /></Gate>} />
              <Route path="/signin" element={<Gate><SignIn /></Gate>} />
              <Route path="/auth/callback" element={<Gate><AuthCallback /></Gate>} />
              <Route path="/pricing" element={<Gate><Pricing /></Gate>} />
              <Route path="/account" element={<Gate><Account /></Gate>} />
              <Route path="/upgrade/success" element={<Gate><UpgradeSuccess /></Gate>} />
            </Routes>
          </Layout>
        </BrowserRouter>
        <ErrorModal />
      </AuthProvider>
    </ErrorProvider>
  );
}
