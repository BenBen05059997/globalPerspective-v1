// Layout smoke tests (A1 · site shell): the N1 five-item menu renders with the right hrefs, the
// site-wide "paused since" status line renders only when the newest daily brief is stale (and
// never on /map, which has its own), and the footer has no white paper link.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { ErrorProvider } from '@/shared/contexts/ErrorContext';

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

// fetchDailyBrief backs useDailyBrief, which both /map and this Layout test reuse for the
// "paused since" computation — mocked per test to control freshness.
const fetchDailyBrief = vi.fn();
vi.mock('@/shared/api/restProxy', () => ({
  fetchDailyBrief: (...args) => fetchDailyBrief(...args),
  billingConfigured: () => false,
  fetchMembership: vi.fn(),
}));

import Layout from '@/app/layout/Layout';

function renderLayout(path = '/weekly') {
  return render(
    <ErrorProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Layout>
            <div>page content</div>
          </Layout>
        </MemoryRouter>
      </AuthProvider>
    </ErrorProvider>
  );
}

beforeEach(() => {
  fetchDailyBrief.mockReset();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('Layout — N1 menu', () => {
  it('renders exactly the five menu items with the right hrefs', async () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    renderLayout('/weekly');
    const nav = document.querySelector('.gp-nav-links');
    expect(nav).toBeTruthy();
    const links = nav.querySelectorAll('a');
    expect(links.length).toBe(5);
    const byLabel = Array.from(links).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(byLabel).toEqual([
      ['Map', '/map'],
      ['Stories', '/weekly'],
      ['Briefings', '/daily'],
      ['Studio', '/analyze'],
      ['Track record', '/track-record'],
    ]);
  });

  it('footer has no white paper link', () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    renderLayout('/weekly');
    const footer = document.querySelector('.gp-footer');
    expect(footer.innerHTML).not.toMatch(/whitepaper|white paper/i);
  });
});

describe('Layout — site-wide status line', () => {
  it('shows the paused wording when the newest brief is stale', async () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h old
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: old } });
    renderLayout('/weekly');
    const text = await screen.findByText(/NEW STORIES AND ANALYSIS PAUSED SINCE/i);
    expect(text).toBeTruthy();
  });

  it('shows nothing when the newest brief is fresh', async () => {
    const fresh = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h old
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: fresh } });
    renderLayout('/weekly');
    // give the hook's effect a tick to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-strip')).toBeNull();
  });

  it('never duplicates the status line on /map', async () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: old } });
    renderLayout('/map');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-strip')).toBeNull();
  });
});
