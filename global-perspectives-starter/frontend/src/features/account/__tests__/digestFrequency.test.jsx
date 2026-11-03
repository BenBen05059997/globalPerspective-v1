// Account > Alerts & email: the digest Frequency select is named by its visible "Frequency" label
// (a real <label for>), so screen readers announce it and clicking the text focuses it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '@/shared/contexts/AuthContext';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => { cb({ uid: 'u1', email: 'reader@example.com', isAnonymous: false, metadata: {} }); return vi.fn(); }),
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
  fetchPrefs: vi.fn(() => Promise.resolve({ prefs: { breakingOptIn: false, digestOptIn: true, digestCadence: 'daily', driftOptIn: false, followedCountries: [] } })),
  savePrefs: vi.fn(() => Promise.resolve({})),
  followCountry: vi.fn(),
  unfollowCountry: vi.fn(),
  fetchMembership: vi.fn(() => Promise.resolve(null)),
  billingConfigured: () => false,
  fetchCountryHistory: vi.fn(() => Promise.resolve({ success: true, snapshots: [], driftNotes: [], driftNotesTotal: 0, driftNotesGated: false })),
  fetchDailyBrief: vi.fn(() => Promise.resolve({ data: { generatedAt: new Date().toISOString() } })),
  fetchLatestDailyBrief: vi.fn(() => Promise.resolve({ data: { generatedAt: new Date().toISOString() } })),
  fetchWeeklyBrief: vi.fn(() => Promise.resolve({ data: null })),
}));

import Account from '@/features/account/Account';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.USER_PREFS_ENDPOINT = true;
});

describe('Account digest frequency', () => {
  it('the select is a combobox named "Frequency" (label for), showing the saved cadence', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/account?tab=alerts']}><Account /></MemoryRouter>
      </AuthProvider>,
    );
    const select = await screen.findByRole('combobox', { name: 'Frequency' });
    expect(select).toHaveValue('daily');
    expect(screen.getByText('Frequency').tagName).toBe('LABEL');
  });
});
