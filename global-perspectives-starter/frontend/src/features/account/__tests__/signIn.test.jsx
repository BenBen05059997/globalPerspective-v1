// Sign-in screen (A6): calm console restyle. Verifies the claims list matches the signed-out
// account desk's list (shared module, not copy-pasted) and that every existing control still
// renders and calls its handler — restyling must never touch auth behavior.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockSendSignInLink = vi.fn(() => Promise.resolve());
const mockSignInWithGoogle = vi.fn(() => Promise.resolve());
const mockSignInAsGuest = vi.fn(() => Promise.resolve());

vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({
    sendSignInLink: mockSendSignInLink,
    signInWithGoogle: mockSignInWithGoogle,
    signInAsGuest: mockSignInAsGuest,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import SignIn from '@/features/account/SignIn';
import { ACCOUNT_CLAIMS, ACCOUNT_NOTE } from '@/features/account/lib/accountClaims';
import Account from '@/features/account/Account';

vi.mock('@/shared/api/restProxy', () => ({
  fetchSavedItems: vi.fn(() => Promise.resolve({ data: [] })),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(() => Promise.resolve({})),
  fetchPrefs: vi.fn(() => Promise.resolve({ prefs: null })),
  savePrefs: vi.fn(() => Promise.resolve({})),
  followCountry: vi.fn(),
  unfollowCountry: vi.fn(),
  fetchMembership: vi.fn(() => Promise.resolve(null)),
  billingConfigured: () => false,
  creditPacks: () => [],
  fetchCountryHistory: vi.fn(() => Promise.resolve({ success: true, snapshots: [], driftNotes: [], driftNotesTotal: 0, driftNotesGated: false })),
}));
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

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={['/signin']}>
      <SignIn />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockSendSignInLink.mockClear();
  mockSignInWithGoogle.mockClear();
  mockSignInAsGuest.mockClear();
  mockNavigate.mockClear();
});

describe('SignIn — console restyle (A6)', () => {
  it('shows the calm console title and the same account claims as the signed-out desk', async () => {
    // Render the signed-out account screen (uses the real, unmocked AuthContext via a fresh
    // instance) is out of scope here — instead assert both consumers import the same constant.
    // This is the render-level check: SignIn's rendered list text equals ACCOUNT_CLAIMS/NOTE.
    renderSignIn();
    expect(screen.getByRole('heading', { name: 'Sign in to Global Perspectives' })).toBeInTheDocument();
    for (const claim of ACCOUNT_CLAIMS) {
      expect(screen.getByText(claim)).toBeInTheDocument();
    }
    expect(screen.getByText(ACCOUNT_NOTE)).toBeInTheDocument();
  });

  it('Account.jsx signed-out screen renders the exact same claims list (shared module)', async () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <Account />
      </MemoryRouter>
    );
    for (const claim of ACCOUNT_CLAIMS) {
      expect(await screen.findByText(claim)).toBeInTheDocument();
    }
    expect(screen.getByText(ACCOUNT_NOTE)).toBeInTheDocument();
  });

  it('Continue with Google button calls signInWithGoogle', async () => {
    renderSignIn();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it('Continue as guest button calls signInAsGuest', async () => {
    renderSignIn();
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
    await waitFor(() => expect(mockSignInAsGuest).toHaveBeenCalledTimes(1));
  });

  it('submitting the email form calls sendSignInLink and shows the "check your inbox" state', async () => {
    renderSignIn();
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));
    await waitFor(() => expect(mockSendSignInLink).toHaveBeenCalledWith('reader@example.com'));
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
  });

  it('shows a restyled error message when Google sign-in fails, keeping the same text', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({ message: 'Google sign-in failed' });
    renderSignIn();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in failed');
  });

  it('has a visible-focus-capable input and privacy/disclosures links', () => {
    renderSignIn();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy & terms/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /disclosures/i })).toHaveAttribute('href', '/disclosures');
  });
});
