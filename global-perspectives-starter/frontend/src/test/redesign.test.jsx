// Deep render tests for the v2 redesigned pages (WeeklyPage, CountryListPage)
// Mocks data hooks to return real fixtures fetched from production backend.
// Refresh fixtures with: tests/fetch-fixtures.sh

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import archiveFixture from '../../tests/fixtures/archive.json';
import threadAnalysesFixture from '../../tests/fixtures/thread_analyses.json';
import countryIntelFixture from '../../tests/fixtures/country_intelligence.json';

// ── Mock all data hooks ────────────────────────────────────────────
// Remap the fixture's (frozen April) date keys onto the most recent N days so
// the newest fixture day is "today". The WeeklyPage river now buckets stories by
// recency (This week / Earlier this month / Older) and only the fresh band shows
// full StoryCards — prod always has threads updated today, so the test must too.
const rawDayMap = archiveFixture.data;
const rawDates = Object.keys(rawDayMap).sort((a, b) => a.localeCompare(b));
const dayMap = {};
{
  const today = new Date();
  rawDates.forEach((d, i) => {
    const shifted = new Date(today);
    shifted.setDate(today.getDate() - (rawDates.length - 1 - i));
    dayMap[shifted.toISOString().slice(0, 10)] = rawDayMap[d];
  });
}
const sortedDates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));

vi.mock('../hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap, sortedDates, loading: false, error: null, tier: 'enterprise', refetch: vi.fn() }),
}));

vi.mock('../hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({ analyses: threadAnalysesFixture.data, loading: false, error: null }),
}));

vi.mock('../hooks/useCountryIntelligence', () => ({
  useCountryIntelligence: () => ({ intelligence: countryIntelFixture.data, loading: false, error: null }),
}));

// Auth context — bypass with a minimal stub
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));

// Heavy/optional components stubbed to keep tests fast & deterministic
vi.mock('../components/IntelligenceLoader', () => ({
  default: () => <div data-testid="loader" />,
}));
vi.mock('../components/CountryOverviewMap', () => ({
  default: () => <div data-testid="map" />,
}));
vi.mock('../components/WeeklyMap', () => ({
  default: () => <div data-testid="weekly-map" />,
}));

// Router wrapper
function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Redesign v2 — WeeklyPage', () => {
  let WeeklyPage;
  beforeEach(async () => {
    WeeklyPage = (await import('../components/WeeklyPage')).default;
  });

  it('renders the StatusStrip with arc/article/day stats', () => {
    renderWithRouter(<WeeklyPage />);
    const strip = document.querySelector('.ss-strip');
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toMatch(/LIVE/);
    expect(strip.textContent).toMatch(/arcs/);
    expect(strip.textContent).toMatch(/articles/);
  });

  it('renders the EditorialShell with left + right rails', () => {
    renderWithRouter(<WeeklyPage />);
    expect(document.querySelector('.es-left')).toBeInTheDocument();
    expect(document.querySelector('.es-right')).toBeInTheDocument();
    expect(document.querySelector('.es-center')).toBeInTheDocument();
  });

  it('renders left-rail filter buttons (Period, Sort, View)', () => {
    renderWithRouter(<WeeklyPage />);
    const left = document.querySelector('.es-left');
    expect(within(left).getByText(/^Period$/i)).toBeInTheDocument();
    expect(within(left).getByText(/^Sort$/i)).toBeInTheDocument();
    expect(within(left).getByText(/^View$/i)).toBeInTheDocument();
    expect(within(left).getByPlaceholderText(/search arcs/i)).toBeInTheDocument();
  });

  it('renders the search input and updates on typing', () => {
    renderWithRouter(<WeeklyPage />);
    const input = screen.getByPlaceholderText(/search arcs/i);
    fireEvent.change(input, { target: { value: 'iran' } });
    expect(input.value).toBe('iran');
  });

  it('clicks "7 days" period button and sets active', () => {
    renderWithRouter(<WeeklyPage />);
    const btn = screen.getByRole('button', { name: /^7 days$/i });
    fireEvent.click(btn);
    expect(btn).toHaveClass('active');
  });

  it('right rail shows "Rising This Week"', () => {
    renderWithRouter(<WeeklyPage />);
    const right = document.querySelector('.es-right');
    expect(within(right).getByText(/Rising This Week/i)).toBeInTheDocument();
  });

  it('story cards render at least one micro-headline from entryShortTitles', () => {
    renderWithRouter(<WeeklyPage />);
    // Real fixture: thread analyses contain entryShortTitles
    // microHeadlines should appear as <ul class="story-card-micro">
    const micros = document.querySelectorAll('.story-card-micro li');
    expect(micros.length).toBeGreaterThan(0);
  });

  it('renders at least one StoryCard with a thread title', () => {
    renderWithRouter(<WeeklyPage />);
    const cards = document.querySelectorAll('.story-card');
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe('Redesign v2 — CountryListPage', () => {
  let CountryListPage;
  beforeEach(async () => {
    CountryListPage = (await import('../components/CountryListPage')).default;
  });

  it('renders the StatusStrip with briefings/countries stats', () => {
    renderWithRouter(<CountryListPage />);
    const strip = document.querySelector('.ss-strip');
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toMatch(/briefings/i);
    expect(strip.textContent).toMatch(/countries/i);
  });

  it('renders left rail with search + sort + region', () => {
    renderWithRouter(<CountryListPage />);
    const left = document.querySelector('.es-left');
    expect(within(left).getByPlaceholderText(/filter countries/i)).toBeInTheDocument();
    expect(within(left).getByText(/^Sort$/i)).toBeInTheDocument();
  });

  it('renders right rail with Highest Risk + Most Covered leaderboards', () => {
    renderWithRouter(<CountryListPage />);
    const right = document.querySelector('.es-right');
    expect(within(right).getByText(/Highest Risk/i)).toBeInTheDocument();
    expect(within(right).getByText(/Most Covered/i)).toBeInTheDocument();
    // At least 1 row in each leaderboard
    const rows = right.querySelectorAll('.clp-lb-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('renders at least one country entry (card or condensed row) with a real name', () => {
    renderWithRouter(<CountryListPage />);
    // The briefings grid is risk-banded: high-risk = full cards, calmer tiers =
    // condensed rows. Either form is a valid country entry.
    const entries = document.querySelectorAll('.clp-card, .clp-row');
    expect(entries.length).toBeGreaterThan(0);
    const realCountries = Object.keys(countryIntelFixture.data);
    const entryText = Array.from(entries).map(c => c.textContent).join(' ');
    expect(realCountries.some(n => entryText.includes(n))).toBe(true);
  });

  it('country entry surfaces the headline from intelligence fixture', () => {
    renderWithRouter(<CountryListPage />);
    const headlines = document.querySelectorAll('.clp-card-headline, .clp-row-headline');
    expect(headlines.length).toBeGreaterThan(0);
    // At least one headline should be non-empty text
    const hasReal = Array.from(headlines).some(h => h.textContent.trim().length > 10);
    expect(hasReal).toBe(true);
  });

  it('clicks "Coverage" sort button and applies active state', () => {
    renderWithRouter(<CountryListPage />);
    const btn = screen.getByRole('button', { name: /coverage/i });
    fireEvent.click(btn);
    expect(btn).toHaveClass('active');
  });

  it('search filter narrows the visible entries', () => {
    renderWithRouter(<CountryListPage />);
    const before = document.querySelectorAll('.clp-card, .clp-row').length;
    const input = screen.getByPlaceholderText(/filter countries/i);
    fireEvent.change(input, { target: { value: 'ZZZZNOMATCH' } });
    const after = document.querySelectorAll('.clp-card, .clp-row').length;
    expect(after).toBeLessThan(before);
  });

  it('right rail leaderboard rows are clickable links', () => {
    renderWithRouter(<CountryListPage />);
    const right = document.querySelector('.es-right');
    const link = right.querySelector('a.clp-lb-row');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toMatch(/^\/weekly\/country\//);
  });
});

describe('Atom: StatusStrip', () => {
  it('renders without crashing with empty stats', async () => {
    const { default: StatusStrip } = await import('../components/atoms/StatusStrip');
    render(<StatusStrip stats={[]} />);
    expect(document.querySelector('.ss-strip')).toBeInTheDocument();
  });
});

describe('Atom: RiskScoreBadge', () => {
  it('renders numeric score', async () => {
    const { default: B } = await import('../components/atoms/RiskScoreBadge');
    render(<B score={75} />);
    expect(document.querySelector('.rsb')).toHaveTextContent('75');
    expect(document.querySelector('.rsb-high')).toBeInTheDocument();
  });
  it('renders enum level when score absent', async () => {
    const { default: B } = await import('../components/atoms/RiskScoreBadge');
    render(<B level="elevated" />);
    expect(document.querySelector('.rsb-elevated')).toBeInTheDocument();
  });
});

describe('Atom: RiskDeltaPill', () => {
  it('returns null with fewer than 2 snapshots', async () => {
    const { default: P } = await import('../components/atoms/RiskDeltaPill');
    const { container } = render(<P snapshots={[{ riskScore: 50, dateKey: '2026-04-26' }]} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders up arrow for positive delta', async () => {
    const { default: P } = await import('../components/atoms/RiskDeltaPill');
    render(<P snapshots={[
      { riskScore: 50, dateKey: '2026-04-25' },
      { riskScore: 55, dateKey: '2026-04-26' },
    ]} />);
    expect(document.querySelector('.rdp-up')).toHaveTextContent('+5');
  });
});
