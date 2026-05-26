// Render tests for the rebuilt EconomyPage (instrument-first hub).
// Mocks the three data hooks with realistic shapes and exercises the new UI + interactions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const disruptions = [
  {
    scopeId: 't-oil', headline: 'OPEC+ surprise cut tightens crude', severity: 'severe', severityScore: 80,
    confidence: 'high', horizon: 'days', hasImpact: true, generatedAt: '2026-05-26T08:00:00.000Z',
    instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'large', rationale: 'supply cut' }],
    winners: [{ name: 'Saudi Arabia', type: 'country' }], losers: [{ name: 'India', type: 'country' }],
  },
  {
    scopeId: 't-bond', headline: 'US fiscal worries lift long yields', severity: 'moderate', severityScore: 60,
    confidence: 'medium', horizon: 'weeks', hasImpact: true, generatedAt: '2026-05-26T07:00:00.000Z',
    instruments: [{ instrumentId: 'US10Y', direction: 'up', magnitude: 'moderate', rationale: 'issuance' }],
    winners: [], losers: [{ name: 'United States', type: 'country' }],
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

describe('EconomyPage — instrument-first hub', () => {
  beforeEach(async () => {
    EconomyPage = (await import('../components/EconomyPage')).default;
  });

  it('renders the instrument pivot with consensus, live level, and story count', () => {
    renderPage();
    expect(screen.getByText(/Most-repriced instruments/i)).toBeInTheDocument();
    const pivot = document.querySelector('.ep-pivot');
    expect(within(pivot).getByText('BRENT')).toBeInTheDocument();
    expect(pivot.textContent).toMatch(/75% consensus/);
    expect(pivot.textContent).toMatch(/82\.5/);          // live commodity level
    expect(pivot.textContent).toMatch(/3 stories/);
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

  it('expands a pivot row to reveal example stories', () => {
    renderPage();
    const brentItem = Array.from(document.querySelectorAll('.ep-pivot-item'))
      .find(el => el.textContent.includes('BRENT'));
    const toggle = brentItem.querySelector('.ep-pivot-toggle');
    expect(brentItem.querySelector('.ep-pivot-examples')).toBeNull();
    fireEvent.click(toggle);
    const examples = brentItem.querySelector('.ep-pivot-examples');
    expect(examples).toBeInTheDocument();
    expect(examples.textContent).toMatch(/OPEC\+ surprise cut/);   // source/reference (headline → thread)
    expect(examples.textContent).toMatch(/supply cut/);            // the per-instrument rationale (the "why")
    expect(examples.querySelector('.ep-ex-why')).toBeInTheDocument();
    expect(brentItem.querySelector('.ep-spark svg')).toBeInTheDocument();  // price sparkline (≥2 points)
  });

  it('filters the by-story list when an instrument is clicked', () => {
    renderPage();
    // both disruptions visible initially (no "Showing X of Y" bar)
    expect(document.querySelector('.ep-filter-info')).toBeNull();
    const brentBtn = Array.from(document.querySelectorAll('.ep-pivot-id')).find(b => b.textContent === 'BRENT');
    fireEvent.click(brentBtn);
    const info = document.querySelector('.ep-filter-info');
    expect(info).toBeInTheDocument();
    expect(info.textContent).toMatch(/Showing 1 of 2/);
  });

  it('renders the by-story severity groups', () => {
    renderPage();
    expect(document.querySelector('.ep-group-severe')).toBeInTheDocument();
    expect(document.querySelector('.ep-group-moderate')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/OPEC\+ surprise cut tightens crude/);
  });
});
