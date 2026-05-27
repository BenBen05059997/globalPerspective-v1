// Render tests for the rebuilt EconomyPage (instrument-first leaderboard).
// Mocks the four data hooks with realistic shapes and exercises the new UI + interactions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const disruptions = [
  {
    scopeId: 't-oil', headline: 'OPEC+ surprise cut tightens crude', severity: 'severe', severityScore: 80,
    confidence: 'high', horizon: 'days', hasImpact: true, generatedAt: '2026-05-26T08:00:00.000Z',
    instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'large', rationale: 'supply cut' }],
    winners: [{ name: 'Saudi Arabia', type: 'country' }], losers: [{ name: 'India', type: 'country' }],
    historicalAnalog: { event: '2019 Hormuz attacks', year: 2019, outcome: 'spike then fade' },
  },
  {
    scopeId: 't-bond', headline: 'US fiscal worries lift long yields', severity: 'moderate', severityScore: 60,
    confidence: 'medium', horizon: 'weeks', hasImpact: true, generatedAt: '2026-05-26T07:00:00.000Z',
    instruments: [{ instrumentId: 'US10Y', direction: 'up', magnitude: 'moderate', rationale: 'issuance' }],
    winners: [], losers: [{ name: 'United States', type: 'country' }],
    historicalAnalog: null,
  },
];

const topMovers = [
  { instrumentId: 'BRENT', consensus: 'up', consensusStrength: 75, citations: 3,
    directions: { up: 3, down: 0, mixed: 0 },
    examples: [{ threadId: 't-oil', headline: 'OPEC+ surprise cut tightens crude', severity: 'severe' }] },
  { instrumentId: 'US10Y', consensus: 'up', consensusStrength: 60, citations: 2,
    directions: { up: 2, down: 0, mixed: 0 }, examples: [] },
];

const markets = {
  commodities: { brent: 82.5, wti: 78.1, gold: 2350, copper: 4.2, dxy: 104.3, vix: 14.8 },
  yields: { US10Y: 4.25, US2Y: 4.9, DE10Y: 2.4, JP10Y: 0.9, UK10Y: 4.1 },
  fx: { asOf: '2026-05-26T08:00:00.000Z', base: 'USD', rates: { EUR: 0.92 } },
};

vi.mock('../hooks/useDisruptionsList', () => ({
  useDisruptionsList: () => ({ data: disruptions, loading: false, error: null }),
}));
vi.mock('../hooks/useTopMovers', () => ({
  useTopMovers: () => ({ data: topMovers, loading: false }),
}));
vi.mock('../hooks/useMarketsGlobal', () => ({
  useMarketsGlobal: () => ({ data: markets, loading: false, error: null, asOf: markets.fx.asOf }),
}));
vi.mock('../hooks/useMarketsHistory', () => ({
  useMarketsHistory: () => ({ data: [{ date: '2026-05-24', value: 80 }, { date: '2026-05-26', value: 96.4 }] }),
}));

let EconomyPage;
function renderPage() {
  return render(<MemoryRouter><EconomyPage /></MemoryRouter>);
}

function brentRow() {
  return Array.from(document.querySelectorAll('.ep-instr-row'))
    .find(el => el.textContent.includes('BRENT'));
}

describe('EconomyPage — instrument-first leaderboard', () => {
  beforeEach(async () => {
    EconomyPage = (await import('../components/EconomyPage')).default;
  });

  it('renders the leaderboard row with consensus, live level, and story count', () => {
    renderPage();
    expect(screen.getByText(/Repricing today/i)).toBeInTheDocument();
    const row = brentRow();
    expect(within(row).getByText('BRENT')).toBeInTheDocument();
    expect(row.textContent).toMatch(/75% consensus/);   // our own aggregate
    expect(row.textContent).toMatch(/82\.5/);            // live commodity level
    expect(row.textContent).toMatch(/3 stories/);        // citation count
  });

  it('renders the right-rail market context with real numeric levels', () => {
    renderPage();
    const ctx = Array.from(document.querySelectorAll('.ep-rail-hd')).find(e => /Market Context/i.test(e.textContent));
    expect(ctx).toBeTruthy();
    const body = document.body.textContent;
    expect(body).toMatch(/Brent/);
    expect(body).toMatch(/82\.5/);
    expect(body).toMatch(/US 10Y/);
    expect(body).toMatch(/4\.25%/);                       // yield formatted with %
  });

  it('expands a row to reveal driving stories, rationale, and a price sparkline', () => {
    renderPage();
    const row = brentRow();
    expect(row.querySelector('.ep-driving-row')).toBeNull();
    fireEvent.click(row.querySelector('.ep-row-l1'));
    const drivingRow = row.querySelector('.ep-driving-row');
    expect(drivingRow).toBeInTheDocument();
    expect(drivingRow.textContent).toMatch(/OPEC\+ surprise cut/);   // source/reference (headline → thread)
    expect(row.querySelector('.ep-dr-mech').textContent).toMatch(/supply cut/);  // the "why" rationale
    expect(row.querySelector('.ep-dr-analog').textContent).toMatch(/2019 Hormuz attacks/); // real analog
    expect(row.querySelector('.ep-spark-area svg')).toBeInTheDocument();  // price sparkline (>=2 points)
  });

  it('filters the by-story list when an instrument name is clicked', () => {
    renderPage();
    // both disruptions visible initially (no "Showing X of Y" bar)
    expect(document.querySelector('.ep-filter-info')).toBeNull();
    const brentBtn = Array.from(document.querySelectorAll('.ep-name')).find(b => b.textContent === 'BRENT');
    fireEvent.click(brentBtn);
    const info = document.querySelector('.ep-filter-info');
    expect(info).toBeInTheDocument();
    expect(info.textContent).toMatch(/Showing 1 of 2/);
  });

  it('renders the by-story severity groups', () => {
    renderPage();
    expect(document.querySelector('.ep-sev-severe')).toBeInTheDocument();
    expect(document.querySelector('.ep-sev-moderate')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/OPEC\+ surprise cut tightens crude/);
  });
});
