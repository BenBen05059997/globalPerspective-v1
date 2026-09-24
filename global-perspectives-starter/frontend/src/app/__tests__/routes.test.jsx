import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { ErrorProvider } from '@/shared/contexts/ErrorContext';

// Mock Google Maps
vi.mock('@googlemaps/react-wrapper', () => ({
  Wrapper: ({ children }) => <div data-testid="mock-map">{children}</div>,
}));

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return vi.fn(); }),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailLink: vi.fn(),
  isSignInWithEmailLink: vi.fn(() => false),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));

// Import page components
import Home from '@/features/home/Home';
import AboutContact from '@/features/static/AboutContact';
import Contact from '@/features/static/Contact';
import PrivacyTerms from '@/features/static/PrivacyTerms';
import Disclosures from '@/features/static/Disclosures';
import SignIn from '@/features/account/SignIn';
import WeeklyPage from '@/components/WeeklyPage';
import CountryListPage from '@/features/countries/CountryListPage';
import ThreadPage from '@/components/ThreadPage';
import CountryPage from '@/features/countries/CountryPage';

function renderPage(Component, path = '/') {
  return render(
    <ErrorProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={<Component />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ErrorProvider>
  );
}

describe('Page render smoke tests', () => {
  it('Home renders', () => {
    expect(() => renderPage(Home)).not.toThrow();
  });

  it('About renders', () => {
    expect(() => renderPage(AboutContact)).not.toThrow();
  });

  it('Contact renders', () => {
    expect(() => renderPage(Contact)).not.toThrow();
  });

  it('Privacy renders', () => {
    expect(() => renderPage(PrivacyTerms)).not.toThrow();
  });

  it('Disclosures renders', () => {
    expect(() => renderPage(Disclosures)).not.toThrow();
  });

  it('SignIn renders', () => {
    expect(() => renderPage(SignIn)).not.toThrow();
  });

  it('WeeklyPage renders (auth gate)', () => {
    expect(() => renderPage(WeeklyPage)).not.toThrow();
  });

  it('CountryListPage renders (auth gate)', () => {
    expect(() => renderPage(CountryListPage)).not.toThrow();
  });

  it('ThreadPage renders (auth gate)', () => {
    expect(() => renderPage(ThreadPage, '/weekly/thread/test-thread')).not.toThrow();
  });

  it('CountryPage renders (auth gate)', () => {
    expect(() => renderPage(CountryPage, '/weekly/country/TestCountry')).not.toThrow();
  });
});
