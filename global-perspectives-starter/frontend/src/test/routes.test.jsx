import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ErrorProvider } from '../contexts/ErrorContext';

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
import Home from '../components/Home';
import AboutContact from '../components/AboutContact';
import Contact from '../components/Contact';
import PrivacyTerms from '../components/PrivacyTerms';
import Disclosures from '../components/Disclosures';
import Pricing from '../components/Pricing';
import SignIn from '../components/SignIn';
import CLIPage from '../components/CLIPage';
import WeeklyPage from '../components/WeeklyPage';
import CountryListPage from '../components/CountryListPage';
import ThreadPage from '../components/ThreadPage';
import CountryPage from '../components/CountryPage';

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

  it('Pricing renders', () => {
    expect(() => renderPage(Pricing)).not.toThrow();
  });

  it('SignIn renders', () => {
    expect(() => renderPage(SignIn)).not.toThrow();
  });

  it('CLI page renders', () => {
    expect(() => renderPage(CLIPage)).not.toThrow();
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
