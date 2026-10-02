// Layout smoke tests (A1 · site shell): the N1 five-item menu renders with the right hrefs, the
// site-wide "paused since" status line renders only when the newest daily brief is stale (and
// never on the map home (/), which has its own), and the footer has no white paper link.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/contexts/AuthContext';

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
  // Batch 3 / B: useDailyBrief() (no date) now calls fetchLatestDailyBrief; same mock controls both.
  fetchLatestDailyBrief: (...args) => fetchDailyBrief(...args),
  billingConfigured: () => false,
  fetchMembership: vi.fn(),
}));

// useIsPhone (shared/hooks, moved from features/map in A2) drives the P1 phone tab bar — mocked
// directly per the M7 convention (jsdom's window can't be resized) rather than mocking innerWidth.
const isPhoneMock = vi.fn(() => false);
vi.mock('@/shared/hooks/useIsPhone.js', () => ({
  useIsPhone: (...args) => isPhoneMock(...args),
  PHONE_BREAKPOINT: 900,
}));

import Layout from '@/app/layout/Layout';
import { __resetAnalysisFreshness, reportAnalysisAt } from '@/shared/lib/analysisFreshness';

function renderLayout(path = '/weekly') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Layout>
          <div>page content</div>
        </Layout>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  __resetAnalysisFreshness();
  fetchDailyBrief.mockReset();
  isPhoneMock.mockReset();
  isPhoneMock.mockReturnValue(false);
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
      ['Map', '/'],
      ['Stories', '/weekly'],
      ['Briefings', '/briefings'],
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

describe('Layout — P1 phone tab bar (A2)', () => {
  it('shows five links with the right hrefs and aria-current on the active route when isPhone', async () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    isPhoneMock.mockReturnValue(true);
    renderLayout('/briefings');
    const bar = document.querySelector('.gp-tabbar');
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('aria-label')).toBeTruthy();
    const links = bar.querySelectorAll('a');
    expect(links.length).toBe(5);
    const byHref = Array.from(links).map((a) => [a.getAttribute('href'), a.getAttribute('aria-current')]);
    expect(byHref).toEqual([
      ['/', null],
      ['/weekly', null],
      ['/briefings', 'page'],
      ['/analyze', null],
      ['/track-record', null],
    ]);
  });

  it('has no bar at desktop widths (useIsPhone false)', async () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    renderLayout('/weekly');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-tabbar')).toBeNull();
  });

  it('top bar has no main-item hamburger list', async () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    renderLayout('/weekly');
    expect(document.querySelector('.gp-hamburger')).toBeNull();
    expect(document.querySelector('.gp-mobile-menu')).toBeNull();
  });
});

describe('Layout — site-wide status line', () => {
  it('shows the paused wording when the newest brief is stale', async () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h old
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: old } });
    renderLayout('/weekly');
    const text = await screen.findByText(/New stories and analysis paused since/);
    expect(text).toBeTruthy();
    // GDACS state is unknown here (no world file in the test): the line must not claim disaster
    // alerts are live (F2.19).
    expect(text.textContent).not.toMatch(/disaster alerts/i);
  });

  it('a newer generation time reported by the stories feed keeps the line away (newest across sources)', async () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: old } });
    reportAnalysisAt('topics', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString());
    renderLayout('/weekly');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-strip')).toBeNull();
  });

  it('shows nothing when the newest brief is fresh', async () => {
    const fresh = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h old
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: fresh } });
    renderLayout('/weekly');
    // give the hook's effect a tick to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-strip')).toBeNull();
  });

  it('never duplicates the status line on the map home (/)', async () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
    fetchDailyBrief.mockResolvedValue({ data: { generatedAt: old } });
    renderLayout('/');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.gp-strip')).toBeNull();
  });
});

describe('Layout — R4a desktop / (map home) console shell', () => {
  it('on desktop / (map home): dark console bar with the same five items, a status slot, no footer', async () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    isPhoneMock.mockReturnValue(false);
    renderLayout('/');
    const nav = document.querySelector('.gp-nav');
    expect(nav.classList.contains('gp-console')).toBe(true);
    expect(document.querySelector('.gp-app').classList.contains('gp-app-console')).toBe(true);
    const hrefs = [...document.querySelectorAll('.gp-nav-links a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/weekly', '/briefings', '/analyze', '/track-record']);
    expect(document.querySelector('#gp-console-status')).toBeTruthy();
    expect(document.querySelector('.gp-footer')).toBeNull();
  });

  it('every other page has the same nav + footer (no console-only bar, no status slot); phone map home has no slot', () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    isPhoneMock.mockReturnValue(false);
    const { unmount } = renderLayout('/weekly');
    expect(document.querySelector('.gp-nav')).toBeTruthy();
    expect(document.querySelector('.gp-app').classList.contains('gp-app-console')).toBe(false);
    expect(document.querySelector('#gp-console-status')).toBeNull();
    expect(document.querySelector('.gp-footer')).toBeTruthy();
    unmount();
    const today = renderLayout('/today');
    expect(document.querySelector('.gp-footer')).toBeTruthy();
    // P6 (decision 14): the footer is exactly About, Membership, Privacy, Disclosures, Contact.
    const footerLinks = [...document.querySelectorAll('.gp-footer-links a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(footerLinks).toEqual([['About', '/about'], ['Membership', '/membership'], ['Privacy', '/privacy'], ['Disclosures', '/disclosures'], ['Contact', '/contact']]);
    expect(document.querySelector('.gp-nav-link.active')).toBeNull();
    today.unmount();
    isPhoneMock.mockReturnValue(true);
    renderLayout('/');
    expect(document.querySelector('.gp-app').classList.contains('gp-app-console')).toBe(false);
    expect(document.querySelector('#gp-console-status')).toBeNull();
  });

  it('the "?" help is a link to the map About drawer (/?about=1), not a tour; it keeps the map selection on /', () => {
    fetchDailyBrief.mockResolvedValue({ data: null });
    isPhoneMock.mockReturnValue(false);
    const { unmount } = renderLayout('/weekly');
    expect(document.querySelector('a.gp-help').getAttribute('href')).toBe('/?about=1');
    expect(document.querySelector('button.gp-help')).toBeNull();
    unmount();
    renderLayout('/?focus=s9');
    expect(document.querySelector('a.gp-help').getAttribute('href')).toBe('/?focus=s9&about=1');
  });

  it('the dark frame is one token set: Layout.css reads role tokens, with no light literals and no console-only nav class', () => {
    const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../layout/Layout.css'), 'utf8');
    expect(css).not.toMatch(/gp-nav-console/);
    expect(css).not.toMatch(/var\(--(paper|ink|line|card)[a-z0-9-]*\b/);
    expect(css).toMatch(/\.gp-nav\s*{[^}]*background:\s*var\(--strip\)/);
    expect(css).toMatch(/\.gp-footer\s*{[^}]*background:\s*var\(--strip\)/);
    expect(css).toMatch(/\.gp-app\s*{[^}]*background:\s*var\(--bg\)/);
  });
});
