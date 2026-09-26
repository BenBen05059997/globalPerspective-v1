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
  // F1.4 (review R2): the Alerts panel now computes the weekly-brief note from real data —
  // both a fresh brief and no analysis pause by default, so other sections' assertions are
  // unaffected.
  fetchDailyBrief: vi.fn(() => Promise.resolve({ data: { generatedAt: new Date().toISOString() } })),
  fetchWeeklyBrief: vi.fn(() => Promise.resolve({ data: null })),
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
  // useDailyBrief keeps a module-level (localStorage-backed) cache keyed by date — clear it so
  // each test's fetchDailyBrief mock is actually consulted instead of a previous test's cache hit.
  try { localStorage.clear(); } catch { /* ignore */ }
  // usePreferences short-circuits to its "email delivery isn't live yet" state unless this is set
  // (mirrors docs/config.js in prod) — needed so the Alerts panel tests below exercise the real,
  // per-channel wording rather than the endpoint-missing placeholder.
  window.USER_PREFS_ENDPOINT = true;
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

  it('Studio only promises "your key" — no shared-analyses/receipts claim (F1.5)', async () => {
    renderAccount('/account?tab=studio');
    await screen.findByRole('heading', { name: 'Studio' });
    const body = document.body.textContent.toLowerCase();
    expect(body).not.toMatch(/shared analyses/);
    expect(body).not.toMatch(/receipts/);
    expect(body).toMatch(/your key/);
  });
});

describe('Account — Alerts & email real per-channel state (F1.4)', () => {
  it('shows breaking news and country change-alerts as paused/not sending, with disabled toggles', async () => {
    renderAccount('/account?tab=alerts');
    await screen.findByRole('heading', { name: 'What you will be told' });
    expect(await screen.findByText(/Breaking news alerts — paused, not sending/i)).toBeInTheDocument();
    expect(await screen.findByText(/Country change-alerts — paused, not sending/i)).toBeInTheDocument();
    const breakingSwitch = screen.getByRole('switch', { name: /Breaking news alerts/i });
    expect(breakingSwitch).toBeDisabled();
    expect(breakingSwitch).toHaveAttribute('aria-checked', 'false');
    // No leftover contradicting "email delivery is live" header.
    const body = document.body.textContent;
    expect(body).not.toMatch(/Email delivery is live/i);
  });

  it('adds a "no edition since <date> while analysis is paused" note to the weekly brief when analysis is paused', async () => {
    const restProxy = await import('@/shared/api/restProxy');
    const oldGeneratedAt = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h — past the 36h pause threshold
    restProxy.fetchDailyBrief.mockResolvedValue({ data: { generatedAt: oldGeneratedAt } });
    restProxy.fetchWeeklyBrief.mockResolvedValue({ data: { weekOf: '2026-09-06' } });
    renderAccount('/account?tab=alerts');
    expect(await screen.findByText(/No edition since Sep 6 while analysis is paused/i)).toBeInTheDocument();
  });
});
