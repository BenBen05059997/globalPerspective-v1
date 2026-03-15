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
import SignIn from './components/SignIn';
import AuthCallback from './components/AuthCallback';
import Pricing from './components/Pricing';
import Account from './components/Account';
import UpgradeSuccess from './components/UpgradeSuccess';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setAuthProvider } from './services/restProxy';
import { useEffect } from 'react';

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
              <Route path="/weekly" element={<WeeklyPage />} />
              <Route path="/weekly-map" element={<WeeklyMap />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/account" element={<Account />} />
              <Route path="/upgrade/success" element={<UpgradeSuccess />} />
            </Routes>
          </Layout>
        </BrowserRouter>
        <ErrorModal />
      </AuthProvider>
    </ErrorProvider>
  );
}
