// Account shell (A3 · K1): left-rail sections, ?tab= URL compatibility, aria-current, and the
// signed-out console screen. Follows the mocking pattern from app/__tests__/layout.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/contexts/AuthContext';

let authUser = null;

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => { cb(authUser); return vi.fn(); }),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailLink: vi.fn(),
  isSignInWithEmailLink: vi.fn(() => false),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));

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

import Account from '@/features/account/Account';

function renderAccount(path = '/account') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Account />
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  authUser = { uid: 'u1', email: 'reader@example.com', isAnonymous: false, metadata: {} };
});

describe('Account — signed out', () => {
  it('shows a calm console screen with no membership-only claims, and a sign-in button', async () => {
    authUser = null;
    renderAccount('/account');
    expect(await screen.findByText(/what an account gives you/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /account sections/i })).not.toBeInTheDocument();
    const signIn = screen.getByRole('link', { name: /sign in/i });
    expect(signIn).toHaveAttribute('href', '/signin');

    // Only true-today claims — no membership/paid-only wording.
    const body = document.body.textContent.toLowerCase();
    expect(body).not.toMatch(/member[- ]?only/);
    // Following is a member feature (FollowButton gates on isMember): never listed as a free-account benefit.
    expect(body).not.toMatch(/Following countries, so/);
    expect(body).not.toMatch(/\$\d/); // no invented prices
  });
});

describe('Account — signed in shell', () => {
  it('renders five rail sections with the desk active by default (no ?tab=)', async () => {
    renderAccount('/account');
    const rail = await screen.findByRole('navigation', { name: /account sections/i });
    const buttons = within(rail).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Desk'),
        expect.stringContaining('Alerts & email'),
        expect.stringContaining('Studio'),
        expect.stringContaining('Plan'),
        expect.stringContaining('Profile & sign-in'),
      ])
    );
    expect(buttons).toHaveLength(5);
    const deskBtn = buttons.find((b) => b.textContent.startsWith('Desk'));
    expect(deskBtn).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Your desk' })).toBeInTheDocument();
  });

  it.each([
    ['saved', 'Your desk'],
    ['notifications', 'What you will be told'],
    ['analysis', 'Studio'],
    ['membership', 'Plan'],
    ['profile', 'Profile'],
    ['desk', 'Your desk'],
    ['alerts', 'What you will be told'],
    ['studio', 'Studio'],
    ['plan', 'Plan'],
    ['bogus-value', 'Your desk'],
  ])('old/new ?tab=%s resolves to the right section (%s)', async (tabValue, expectedHeading) => {
    renderAccount(`/account?tab=${tabValue}`);
    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();
  });

  it('no ?tab= at all also resolves to desk', async () => {
    renderAccount('/account');
    expect(await screen.findByRole('heading', { name: 'Your desk' })).toBeInTheDocument();
  });
});
