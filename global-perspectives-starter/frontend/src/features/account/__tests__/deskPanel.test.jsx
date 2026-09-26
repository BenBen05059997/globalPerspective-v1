// Desk (A4) render tests. Fixture data (IRAN_COUNTRY_HISTORY) is trimmed from a real,
// read-only country_history proxy response (see fixtures/iranCountryHistory.js) — the row
// rendered from it below is checked verbatim against that real note.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IRAN_COUNTRY_HISTORY } from '@/features/account/__tests__/fixtures/iranCountryHistory';

const mockUsePreferences = vi.fn();
const mockUseMembership = vi.fn();

vi.mock('@/features/account/hooks/usePreferences', () => ({
  usePreferences: () => mockUsePreferences(),
}));
vi.mock('@/features/account/hooks/useMembership', () => ({
  useMembership: () => mockUseMembership(),
}));

const fetchCountryHistory = vi.fn();
const reportFetchError = vi.fn();
vi.mock('@/shared/api/restProxy', () => ({
  fetchCountryHistory: (...args) => fetchCountryHistory(...args),
  // DeskPanel now also computes the site's real "analysis paused" state (F2.18) via
  // useDailyBrief — default to a fresh brief so existing assertions aren't affected; the
  // dedicated "analysis paused" test below overrides this.
  fetchDailyBrief: vi.fn(() => Promise.resolve({ data: { generatedAt: new Date().toISOString() } })),
}));
vi.mock('@/shared/api/errorSink', () => ({
  reportFetchError: (...args) => reportFetchError(...args),
}));

import DeskPanel from '@/features/account/components/DeskPanel';
import { useDeskChanges } from '@/features/account/hooks/useDeskChanges';

function renderDesk(props = {}) {
  return render(
    <MemoryRouter>
      <DeskPanel savedItems={[]} savedLoading={false} onUnsave={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  fetchCountryHistory.mockReset();
  reportFetchError.mockReset();
  mockUsePreferences.mockReset();
  mockUseMembership.mockReset();
  // DeskSinceLastVisit writes gp_desk_last_visit_v1 on unmount (leaving the Desk) — clear
  // between tests so one test's cleanup doesn't set the "last visit" the next test reads.
  window.localStorage.clear();
});

describe('Desk — member with follows and notes', () => {
  it('renders the Iran driftNote row verbatim, plus a Following chip', async () => {
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran'] }, loading: false });
    fetchCountryHistory.mockResolvedValue(IRAN_COUNTRY_HISTORY);

    renderDesk();

    // "First visit" line — no gp_desk_last_visit_v1 stored in this fresh jsdom localStorage.
    expect(await screen.findByText(/first visit on this browser/i)).toBeInTheDocument();

    // The one real driftNote: asOf 2026-08-19, axis moves computed from the Aug 18 -> Aug 19
    // snapshots (humanitarian 90->70 is the larger move, economic 80->90 the other >=10 move).
    expect(await screen.findByText(/Aug 19 · IRAN · HUMANITARIAN 90→70, ECONOMIC 80→90/)).toBeInTheDocument();
    expect(screen.getByText(/UAE imposes indefinite trade embargo on Iran over alleged missile attacks/)).toBeInTheDocument();
    expect(screen.getByText(/MODEL JUDGMENT · stored explanation/)).toBeInTheDocument();
    expect(screen.getByText(/The UAE's indefinite trade embargo on Iran directly escalates economic isolation/)).toBeInTheDocument();

    // Server-gated (this fixture's driftNotesGated: true) -> the honest gate line, no blur.
    expect(screen.getByText('Earlier changes are part of membership.')).toBeInTheDocument();

    // Following chip with the real latest snapshot's risk score.
    expect(screen.getByRole('link', { name: /Iran.*risk 95.*high/i })).toBeInTheDocument();
  });
});

describe('Desk — first visit vs returning visit', () => {
  it('shows the first-visit line when no last-visit timestamp is stored', async () => {
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran'] }, loading: false });
    fetchCountryHistory.mockResolvedValue(IRAN_COUNTRY_HISTORY);

    renderDesk();
    expect(await screen.findByText(/first visit on this browser — showing the latest changes/i)).toBeInTheDocument();
  });

  it('shows nothing new when the note predates a stored last-visit timestamp', async () => {
    window.localStorage.setItem('gp_desk_last_visit_v1', '2026-09-01T00:00:00.000Z');
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran'] }, loading: false });
    fetchCountryHistory.mockResolvedValue(IRAN_COUNTRY_HISTORY);

    renderDesk();
    expect(await screen.findByText('No changes since your last visit.')).toBeInTheDocument();
    expect(screen.queryByText(/first visit/i)).not.toBeInTheDocument();
    window.localStorage.clear();
  });
});

describe('Desk — "analysis paused" note (F2.18)', () => {
  it('says "analysis paused" only when the site-wide daily-brief check says analysis is paused', async () => {
    const restProxy = await import('@/shared/api/restProxy');
    restProxy.fetchDailyBrief.mockResolvedValue({ data: { generatedAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString() } });
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran'] }, loading: false });
    fetchCountryHistory.mockResolvedValue(IRAN_COUNTRY_HISTORY);

    renderDesk();
    // The fixture's note is well over 30 days old relative to "today" — isStaleSince fires —
    // and the daily brief mock above is stale, so the "— analysis paused." suffix should show.
    expect(await screen.findByText(/No new changes since .* — analysis paused\./)).toBeInTheDocument();
  });

  it('omits "analysis paused" when the note is stale but the site\'s own analysis is fresh', async () => {
    const restProxy = await import('@/shared/api/restProxy');
    restProxy.fetchDailyBrief.mockResolvedValue({ data: { generatedAt: new Date().toISOString() } });
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran'] }, loading: false });
    fetchCountryHistory.mockResolvedValue(IRAN_COUNTRY_HISTORY);

    renderDesk();
    expect(await screen.findByText(/No new changes since [^—]+\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/analysis paused/)).not.toBeInTheDocument();
  });
});

describe('Desk — no follows (member)', () => {
  it('shows the honest no-follows empty state, never a fake row', () => {
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: [] }, loading: false });

    renderDesk();
    expect(screen.getAllByText(/you don't follow any country yet/i).length).toBeGreaterThan(0);
    expect(fetchCountryHistory).not.toHaveBeenCalled();
  });
});

describe('Desk — non-member', () => {
  it('shows the membership upsell, not the empty-follows copy', () => {
    mockUseMembership.mockReturnValue({ isMember: false, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: [] }, loading: false });

    renderDesk();
    expect(screen.getAllByText(/following countries is part of membership/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/you don't follow any country yet/i)).not.toBeInTheDocument();
  });
});

describe('useDeskChanges — per-country fetch error', () => {
  it("omits the failed country's rows, reports the error, and keeps other countries", async () => {
    fetchCountryHistory.mockImplementation((country) => {
      if (country === 'Yemen') return Promise.reject(new Error('Proxy HTTP 500'));
      return Promise.resolve(IRAN_COUNTRY_HISTORY);
    });

    const { result } = renderHook(() => useDeskChanges(['Iran', 'Yemen']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const yemen = result.current.results.find((r) => r.country === 'Yemen');
    const iran = result.current.results.find((r) => r.country === 'Iran');
    expect(yemen.error).toMatch(/500/);
    expect(yemen.driftNotes).toEqual([]);
    expect(iran.error).toBeNull();
    expect(iran.driftNotes.length).toBeGreaterThan(0);
    expect(reportFetchError).toHaveBeenCalledWith('desk-country-history', expect.any(Error));
  });

  it('renders the quiet "couldn\'t load" line for the errored country', async () => {
    mockUseMembership.mockReturnValue({ isMember: true, available: true, loading: false });
    mockUsePreferences.mockReturnValue({ prefs: { followedCountries: ['Iran', 'Yemen'] }, loading: false });
    fetchCountryHistory.mockImplementation((country) => {
      if (country === 'Yemen') return Promise.reject(new Error('boom'));
      return Promise.resolve(IRAN_COUNTRY_HISTORY);
    });

    renderDesk();
    expect(await screen.findByText("Couldn't load changes for Yemen.")).toBeInTheDocument();
  });
});
