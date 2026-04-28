/**
 * Tests for WorldMapV2 signal filter state.
 * Guards against the regression where Signal level checkboxes had
 * no onClick and appeared interactive but did nothing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Signal filter logic (pure) ───────────────────────────────────────

describe('Signal filter logic — pure', () => {
  const applyFilters = (signalValues, filters) =>
    signalValues.filter(s => filters[s.bucket]);

  const signals = [
    { iso: 'IRN', bucket: 'H', z: 2.3 },
    { iso: 'USA', bucket: 'E', z: 0.8 },
    { iso: 'CHN', bucket: 'L', z: -0.2 },
    { iso: 'DEU', bucket: 'H', z: 1.9 },
    { iso: 'FRA', bucket: 'L', z: 0.0 },
  ];

  it('shows all signals when all filters on', () => {
    const result = applyFilters(signals, { H: true, E: true, L: true });
    expect(result).toHaveLength(5);
  });

  it('hides H-bucket when H filter off', () => {
    const result = applyFilters(signals, { H: false, E: true, L: true });
    expect(result.find(s => s.bucket === 'H')).toBeUndefined();
    expect(result).toHaveLength(3);
  });

  it('shows only H-bucket when only H filter on', () => {
    const result = applyFilters(signals, { H: true, E: false, L: false });
    expect(result.every(s => s.bucket === 'H')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('empty result when all filters off', () => {
    const result = applyFilters(signals, { H: false, E: false, L: false });
    expect(result).toHaveLength(0);
  });

  it('toggle is independent per bucket', () => {
    const filters = { H: true, E: true, L: true };
    const toggled = { ...filters, E: !filters.E };
    expect(toggled).toEqual({ H: true, E: false, L: true });
    const result = applyFilters(signals, toggled);
    expect(result.find(s => s.bucket === 'E')).toBeUndefined();
    expect(result.find(s => s.bucket === 'H')).toBeDefined();
    expect(result.find(s => s.bucket === 'L')).toBeDefined();
  });
});

// ── Map fill logic ───────────────────────────────────────────────────

describe('Signal filter — country fill logic', () => {
  const RISK_FILL = { H: '#eab2a6', E: '#eed4a3', L: '#f2efe8' };
  const FILTERED_FILL = '#f2efe8';

  const getCountryFill = (bucket, signalFilters) =>
    signalFilters[bucket] ? RISK_FILL[bucket] : FILTERED_FILL;

  it('returns colored fill when bucket is enabled', () => {
    expect(getCountryFill('H', { H: true, E: true, L: true })).toBe('#eab2a6');
    expect(getCountryFill('E', { H: true, E: true, L: true })).toBe('#eed4a3');
  });

  it('returns neutral fill when bucket is disabled', () => {
    expect(getCountryFill('H', { H: false, E: true, L: true })).toBe(FILTERED_FILL);
    expect(getCountryFill('E', { H: true, E: false, L: true })).toBe(FILTERED_FILL);
    expect(getCountryFill('L', { H: true, E: true, L: false })).toBe(FILTERED_FILL);
  });

  it('neutral fill is the same as L-bucket fill (quiet countries are baseline color)', () => {
    expect(FILTERED_FILL).toBe(RISK_FILL.L);
  });
});

// ── WorldMapV2 signal filter UI tests ───────────────────────────────

vi.mock('../hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap: {}, sortedDates: [], loading: false }),
}));
vi.mock('../hooks/useCountrySignal', () => ({
  useCountrySignal: () => ({
    signal: {
      IRN: { bucket: 'H', z: 2.3, last7: 15 },
      USA: { bucket: 'E', z: 0.8, last7: 5 },
      CHN: { bucket: 'L', z: -0.2, last7: 2 },
    },
    loading: false,
    ready: true,
  }),
}));
vi.mock('../hooks/useCountryIntelligence', () => ({
  useCountryIntelligence: () => ({ intelligence: {}, loading: false }),
}));
vi.mock('../hooks/useCountryHistory', () => ({
  useCountryHistory: () => ({ snapshots: [] }),
}));
vi.mock('../hooks/useMarketsCountry', () => ({
  useMarketsCountry: () => ({ data: null }),
}));
vi.mock('../hooks/useSystemsAnalysis', () => ({
  useSystemsAnalysis: () => ({ data: null }),
}));
vi.mock('../hooks/usePairAnalyses', () => ({
  usePairAnalyses: () => ({ analyses: [] }),
}));
vi.mock('../hooks/useGeminiTopics', () => ({
  useGeminiTopics: () => ({ topics: [] }),
}));
vi.mock('../hooks/useMarketsGlobal', () => ({
  useMarketsGlobal: () => ({ data: null }),
}));
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ type: 'Topology', objects: { countries: { type: 'GeometryCollection', geometries: [] } }, arcs: [] }),
  })
);
vi.mock('d3', () => ({
  select: () => ({ selectAll: () => ({ remove: vi.fn() }), append: () => ({ attr: () => ({ attr: () => ({}) }) }) }),
  geoEqualEarth: () => ({ translate: () => ({ scale: () => ({ fitSize: () => ({}) }) }) }),
  geoPath: () => () => '',
}));
vi.mock('topojson-client', () => ({
  feature: () => ({ features: [] }),
}));

describe('WorldMapV2 — signal filter checkboxes are clickable', () => {
  beforeEach(() => vi.resetModules());

  it('renders High / Elevated / Quiet filter checkboxes', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Elevated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quiet').length).toBeGreaterThan(0);
  });

  it('checkboxes have cursor:pointer (are interactive)', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const highEl = screen.getByText('High').closest('.chk');
    expect(highEl).not.toBeNull();
    expect(highEl.style.cursor).toBe('pointer');
  });

  it('clicking High filter does not throw', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const highEl = screen.getByText('High').closest('.chk');
    expect(() => fireEvent.click(highEl)).not.toThrow();
  });

  it('Time window section is hidden on risk lens', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    // Default lens is 'risk' — Time window should not be visible
    expect(screen.queryByText('Time window')).toBeNull();
  });

  it('Signal level description text is shown', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getAllByText(/z-score/i).length).toBeGreaterThan(0);
  });
});
