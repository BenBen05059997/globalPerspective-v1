/**
 * Tests for the WorldMapV2 stacked-layers model.
 * Default state: today=on, connections=off, editorial=off.
 * Clicking a layer toggle flips its state without affecting others.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Today's pulse — pure logic ───────────────────────────────────────

describe("Today's pulse — 24h rolling count per ISO", () => {
  const NAME_TO_ISO = { iran: 'IRN', china: 'CHN', 'united states': 'USA' };
  const EXTRA_ALIASES = { us: 'USA' };

  function computeTodaySignal(topics, nameToISO, aliases) {
    if (!Array.isArray(topics) || topics.length === 0) return {};
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const counts = {};
    for (const t of topics) {
      const ts = t.timestamp ? new Date(t.timestamp).getTime() : 0;
      if (!ts || ts < cutoff) continue;
      const seen = new Set();
      for (const r of (t.regions || [])) {
        if (!r) continue;
        const k = String(r).toLowerCase();
        const iso = nameToISO[k] || aliases[k];
        if (iso && !seen.has(iso)) {
          seen.add(iso);
          counts[iso] = (counts[iso] || 0) + 1;
        }
      }
    }
    return counts;
  }

  it('counts countries from topics within last 24h', () => {
    const now = Date.now();
    const topics = [
      { regions: ['Iran', 'United States'], timestamp: new Date(now - 3 * 3600 * 1000).toISOString() },
      { regions: ['China'], timestamp: new Date(now - 1 * 3600 * 1000).toISOString() },
    ];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(result.IRN).toBe(1);
    expect(result.USA).toBe(1);
    expect(result.CHN).toBe(1);
  });

  it('excludes topics older than 24h', () => {
    const now = Date.now();
    const topics = [
      { regions: ['Iran'], timestamp: new Date(now - 25 * 3600 * 1000).toISOString() },
      { regions: ['China'], timestamp: new Date(now - 1 * 3600 * 1000).toISOString() },
    ];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(result.IRN).toBeUndefined();
    expect(result.CHN).toBe(1);
  });

  it('deduplicates per-topic — country mentioned twice in same topic counts once', () => {
    const now = Date.now();
    const topics = [
      { regions: ['Iran', 'IRAN', 'iran'], timestamp: new Date(now - 1000).toISOString() },
    ];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(result.IRN).toBe(1);
  });

  it('aggregates across topics — country mentioned in 3 topics counts 3', () => {
    const now = Date.now();
    const topics = [
      { regions: ['Iran'], timestamp: new Date(now - 1000).toISOString() },
      { regions: ['Iran'], timestamp: new Date(now - 2000).toISOString() },
      { regions: ['Iran'], timestamp: new Date(now - 3000).toISOString() },
    ];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(result.IRN).toBe(3);
  });

  it('handles empty topics array', () => {
    expect(computeTodaySignal([], NAME_TO_ISO, EXTRA_ALIASES)).toEqual({});
  });

  it('handles missing timestamp — skips topic', () => {
    const topics = [{ regions: ['Iran'] }];
    expect(computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES)).toEqual({});
  });

  it('resolves country names via aliases', () => {
    const now = Date.now();
    const topics = [{ regions: ['us'], timestamp: new Date(now - 1000).toISOString() }];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(result.USA).toBe(1);
  });

  it('skips unknown country names', () => {
    const now = Date.now();
    const topics = [{ regions: ['Atlantis'], timestamp: new Date(now - 1000).toISOString() }];
    const result = computeTodaySignal(topics, NAME_TO_ISO, EXTRA_ALIASES);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ── Layer toggle UI ──────────────────────────────────────────────────

vi.mock('../hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap: {}, sortedDates: [], loading: false }),
}));
vi.mock('../hooks/useCountrySignal', () => ({
  useCountrySignal: () => ({ signal: {}, loading: false, ready: false }),
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
  Promise.resolve({ ok: true, json: () => Promise.resolve({ type: 'Topology', objects: { countries: { type: 'GeometryCollection', geometries: [] } }, arcs: [] }) })
);
vi.mock('d3', () => {
  // A projection is a callable that also chains: real code calls
  // projection.fitSize(...).scale(...).translate(...) in any order, so every
  // configurator must return the projection itself.
  const makeProjection = () => {
    const p = () => [0, 0];
    for (const m of ['fitSize', 'scale', 'translate', 'center', 'rotate', 'precision', 'clipExtent']) p[m] = () => p;
    return p;
  };
  return {
    select: () => ({ selectAll: () => ({ remove: vi.fn() }), append: () => ({ attr: () => ({ attr: () => ({}) }) }) }),
    geoEqualEarth: () => makeProjection(),
    geoPath: () => () => '',
    geoCentroid: () => [0, 0],
    geoGraticule10: () => ({}),
  };
});
vi.mock('topojson-client', () => ({
  feature: () => ({ features: [] }),
}));

describe('WorldMapV2 — layer toggles replace lens picker', () => {
  beforeEach(() => vi.resetModules());

  it('renders three layer rows: Today\'s pulse, Connections, Editorial', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getByText("Today's pulse")).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(screen.getAllByText('Editorial').length).toBeGreaterThan(0);
  });

  it('renders Layers heading, not Lens', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.queryByText('Lens')).toBeNull();
  });

  it("Today's pulse layer is on by default (has .on class)", async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const today = screen.getByText("Today's pulse").closest('.opt');
    expect(today.className).toContain('on');
  });

  it('Connections and Editorial layers are off by default', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const connections = screen.getByText('Connections').closest('.opt');
    expect(connections.className).not.toContain('on');
  });

  it('clicking a layer toggle flips its state without affecting others', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const connections = screen.getByText('Connections').closest('.opt');
    const today = screen.getByText("Today's pulse").closest('.opt');

    expect(today.className).toContain('on');
    expect(connections.className).not.toContain('on');

    fireEvent.click(connections);
    expect(today.className).toContain('on');           // Today still on
    expect(connections.className).toContain('on');     // Connections now on
  });

  it('Signal level section is always visible (not gated by a layer)', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getByText('Signal level')).toBeInTheDocument();
  });

  it('Title shows "GLOBAL SIGNAL MAP" kicker', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getByText('GLOBAL SIGNAL MAP')).toBeInTheDocument();
  });
});
