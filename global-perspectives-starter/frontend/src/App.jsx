// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import './components/atoms/atoms.css';
import Layout from './components/Layout';
import Home from './components/Home';
import PrivacyTerms from './components/PrivacyTerms';
import AboutContact from './components/AboutContact';
import Disclosures from './components/Disclosures';
import Contact from './components/Contact';
import { ErrorProvider } from './contexts/ErrorContext';
import ErrorModal from './components/ErrorModal';
import WeeklyPage from './components/WeeklyPage';
import ThreadPage from './components/ThreadPage';
import CountryPage from './components/CountryPage';
import CountryListPage from './components/CountryListPage';
import DailyPage from './components/DailyPage';
import SignIn from './components/SignIn';
import AuthCallback from './components/AuthCallback';
import Account from './components/Account';
import WhitepaperPage from './components/WhitepaperPage';
import WorldMapV2 from './components/WorldMapV2';
import EconomyPage from './components/EconomyPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setAuthProvider } from './services/restProxy';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>—</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 12px' }}>Page not found</h2>
      <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 24px' }}>
        That URL doesn't lead anywhere. Head back to today's topics or browse the weekly story arcs.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link to="/" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>← Home</Link>
        <Link to="/weekly" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Weekly →</Link>
      </div>
    </div>
  );
}

function resolveBasename() {
  const rawBase = import.meta.env.BASE_URL ?? '/';

  if (rawBase && rawBase !== '/' && rawBase !== './') {
    return rawBase.replace(/\/+$/, '');
  }

  if (!import.meta.env.DEV && typeof window !== 'undefined') {
    // Only use path-based basename on GitHub Pages subdirectory hosting.
    // On a custom domain all paths are React routes, not a subdirectory basename.
    if (window.location.hostname.endsWith('github.io')) {
      const segments = window.location.pathname.split('/').filter(Boolean);
      if (segments.length > 0) return `/${segments[0]}`;
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
              <Route path="/map" element={<WorldMapV2 />} />
              <Route path="/privacy" element={<PrivacyTerms />} />
              <Route path="/about" element={<AboutContact />} />
              <Route path="/disclosures" element={<Disclosures />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/daily/:dateKey" element={<DailyPage />} />
              <Route path="/economy" element={<EconomyPage />} />
              <Route path="/weekly" element={<WeeklyPage />} />
              <Route path="/weekly/thread/:threadId" element={<ThreadPage />} />
              <Route path="/weekly/countries" element={<CountryListPage />} />
              <Route path="/weekly/country/:countryName" element={<CountryPage />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/account" element={<Account />} />
              <Route path="/whitepaper" element={<WhitepaperPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
        <ErrorModal />
      </AuthProvider>
    </ErrorProvider>
  );
}
