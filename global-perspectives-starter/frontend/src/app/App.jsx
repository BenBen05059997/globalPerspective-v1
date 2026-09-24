// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/app/App.css';
import '@/shared/ui/atoms.css';
import Layout from '@/app/layout/Layout';
// Home is kept eager (not React.lazy'd like the other 19 routes below), deliberately, per
// STAGE0_FIXES_PLAN.md item (g)'s "decide with evidence" instruction: Home is the most-linked
// URL (the Worker's renderRootPage() page directory) and the most common first paint. Measured
// both ways during this change — lazy-loading Home saved ~14 kB (gzipped) off the main chunk but
// added a waterfall (shell paint -> fetch chunk -> render) to the highest-traffic route for a
// bundle that's already dominated by SituationMap3D (943 kB, already its own lazy chunk) and
// shared libs (d3/deck.gl/firebase), not Home's own code. Not worth the extra round-trip there.
import Home from '@/features/home/Home';
import { ErrorProvider } from '@/shared/contexts/ErrorContext';
import { ErrorBoundary } from '@/app/errors/ErrorHandling';
import ErrorModal from '@/app/errors/ErrorModal';
import { AuthProvider, useAuth } from '@/shared/contexts/AuthContext';
import { setAuthProvider } from '@/shared/api/restProxy';
import { useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';

// Route-level code splitting (STAGE0_FIXES_PLAN.md item (g)): every other page is its own chunk,
// fetched on first navigation instead of bundled into the main chunk every visitor downloads.
const PrivacyTerms = lazy(() => import('@/features/static/PrivacyTerms'));
const AboutContact = lazy(() => import('@/features/static/AboutContact'));
const Disclosures = lazy(() => import('@/features/static/Disclosures'));
const Contact = lazy(() => import('@/features/static/Contact'));
const WeeklyPage = lazy(() => import('@/features/threads/WeeklyPage'));
const ThreadPage = lazy(() => import('@/features/threads/ThreadPage'));
const CountryPage = lazy(() => import('@/features/countries/CountryPage'));
const CountryListPage = lazy(() => import('@/features/countries/CountryListPage'));
const DailyPage = lazy(() => import('@/features/daily/DailyPage'));
const SignIn = lazy(() => import('@/features/account/SignIn'));
const AuthCallback = lazy(() => import('@/features/account/AuthCallback'));
const Account = lazy(() => import('@/features/account/Account'));
const WhitepaperPage = lazy(() => import('@/features/static/WhitepaperPage'));
const SituationHome = lazy(() => import('@/features/map/SituationHome'));
const EconomyPage = lazy(() => import('@/features/economy/EconomyPage'));
const AnalysisStudio = lazy(() => import('@/features/analysis-studio/AnalysisStudio'));
const MembershipPage = lazy(() => import('@/features/account/MembershipPage'));
const TrackRecordPage = lazy(() => import('@/features/track-record/TrackRecordPage'));
const WeeklyBriefPage = lazy(() => import('@/features/weekly-brief/WeeklyBriefPage'));
const WeeklyMarketsPage = lazy(() => import('@/features/economy/WeeklyMarketsPage'));
const BreakingFeedPage = lazy(() => import('@/features/breaking/BreakingFeedPage'));
const BreakingDetailPage = lazy(() => import('@/features/breaking/BreakingDetailPage'));
const SpiderDemo = lazy(() => import('@/features/spider-demo/SpiderDemo'));

// Deliberate render crash — the deterministic trigger the smoke-test ERROR
// BOUNDARY leg drives (and a quick manual /__boom check). Not linked anywhere in
// nav; harmless in prod unless explicitly navigated to.
function Boom() {
  throw new Error('BOOM: deliberate error-boundary test crash');
}

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
            <ErrorBoundary>
            <Suspense fallback={<div style={{ padding: '4rem 1rem', textAlign: 'center', minHeight: '40vh' }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<SituationHome />} />
              <Route path="/privacy" element={<PrivacyTerms />} />
              <Route path="/about" element={<AboutContact />} />
              <Route path="/disclosures" element={<Disclosures />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/daily/:dateKey" element={<DailyPage />} />
              <Route path="/economy" element={<EconomyPage />} />
              <Route path="/analyze" element={<AnalysisStudio />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/track-record" element={<TrackRecordPage />} />
              <Route path="/weekly-brief" element={<WeeklyBriefPage />} />
              <Route path="/weekly-markets" element={<WeeklyMarketsPage />} />
              <Route path="/breaking" element={<BreakingFeedPage />} />
              <Route path="/breaking/:id" element={<BreakingDetailPage />} />
              <Route path="/weekly" element={<WeeklyPage />} />
              <Route path="/weekly/thread/:threadId" element={<ThreadPage />} />
              <Route path="/weekly/countries" element={<CountryListPage />} />
              <Route path="/weekly/country/:countryName" element={<CountryPage />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/account" element={<Account />} />
              <Route path="/whitepaper" element={<WhitepaperPage />} />
              <Route path="/spider-demo" element={<SpiderDemo />} />
              <Route path="/__boom" element={<Boom />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </Layout>
        </BrowserRouter>
        <ErrorModal />
      </AuthProvider>
    </ErrorProvider>
  );
}
