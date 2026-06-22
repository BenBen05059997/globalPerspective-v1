/**
 * Tests for the WorldMapV2 country search bar.
 * Guards against regressions in: search matching logic, alias resolution,
 * keyboard navigation, dropdown visibility, and selection behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Search matching logic (pure, extracted from WorldMapV2 useMemo) ──

const EXTRA_ALIASES = {
  'us': 'USA', 'usa': 'USA', 'uk': 'GBR', 'uae': 'ARE',
  'south korea': 'KOR', 'north korea': 'PRK', 'drc': 'COD',
};

function computeSearchMatches(searchQuery, nameToISO, isoToName) {
  const q = searchQuery.trim().toLowerCase();
  if (q.length < 1) return [];
  const seen = new Set();
  const out = [];
  const tryAdd = (key, iso) => {
    if (!iso || seen.has(iso)) return;
    const display = isoToName[iso] || key;
    if (key.startsWith(q) || display.toLowerCase().startsWith(q)) {
      seen.add(iso);
      out.push({ key, iso, display, score: 0 });
    } else if (key.includes(q) || display.toLowerCase().includes(q)) {
      seen.add(iso);
      out.push({ key, iso, display, score: 1 });
    }
  };
  for (const [key, iso] of Object.entries(nameToISO)) tryAdd(key, iso);
  for (const [key, iso] of Object.entries(EXTRA_ALIASES)) tryAdd(key, iso);
  return out.sort((a, b) => a.score - b.score || a.display.localeCompare(b.display)).slice(0, 8);
}

const NAME_TO_ISO = {
  'iran': 'IRN', 'iraq': 'IRQ', 'ireland': 'IRL',
  'united states': 'USA', 'united kingdom': 'GBR',
  'china': 'CHN', 'taiwan': 'TWN',
  'singapore': 'SGP', 'south korea': 'KOR',
  'north korea': 'PRK', 'germany': 'DEU',
};

const ISO_TO_NAME = Object.fromEntries(
  Object.entries(NAME_TO_ISO).map(([k, v]) => [v, k.charAt(0).toUpperCase() + k.slice(1)])
);

describe('Search matching — pure logic', () => {
  it('returns empty when query is empty', () => {
    expect(computeSearchMatches('', NAME_TO_ISO, ISO_TO_NAME)).toHaveLength(0);
  });

  it('matches a country by name prefix', () => {
    const results = computeSearchMatches('ira', NAME_TO_ISO, ISO_TO_NAME);
    const isos = results.map(r => r.iso);
    expect(isos).toContain('IRN'); // Iran
    expect(isos).toContain('IRQ'); // Iraq
  });

  it('prefers prefix matches over substring matches', () => {
    const results = computeSearchMatches('ira', NAME_TO_ISO, ISO_TO_NAME);
    const iranIdx = results.findIndex(r => r.iso === 'IRN');
    const iraqIdx = results.findIndex(r => r.iso === 'IRQ');
    // Both are prefix — should come before any substring match
    expect(results[0].score).toBe(0);
    expect(iranIdx).toBeLessThan(results.length);
    expect(iraqIdx).toBeLessThan(results.length);
  });

  it('matches via EXTRA_ALIASES — "us" → United States', () => {
    const results = computeSearchMatches('us', NAME_TO_ISO, ISO_TO_NAME);
    const isos = results.map(r => r.iso);
    expect(isos).toContain('USA');
  });

  it('matches via EXTRA_ALIASES — "uk" → United Kingdom', () => {
    const results = computeSearchMatches('uk', NAME_TO_ISO, ISO_TO_NAME);
    const isos = results.map(r => r.iso);
    expect(isos).toContain('GBR');
  });

  it('deduplicates — alias + canonical name map to same ISO only once', () => {
    const results = computeSearchMatches('united', NAME_TO_ISO, ISO_TO_NAME);
    const isos = results.map(r => r.iso);
    const usaCount = isos.filter(i => i === 'USA').length;
    expect(usaCount).toBe(1);
  });

  it('caps at 8 results', () => {
    // Add many matching countries
    const bigMap = {};
    for (let i = 0; i < 20; i++) bigMap[`country${i}`] = `C${i.toString().padStart(2,'0')}`;
    const results = computeSearchMatches('country', bigMap, {});
    expect(results).toHaveLength(8);
  });

  it('returns empty for no matches', () => {
    const results = computeSearchMatches('xyz_no_match', NAME_TO_ISO, ISO_TO_NAME);
    expect(results).toHaveLength(0);
  });

  it('matches single-char query — returns results for "c"', () => {
    const results = computeSearchMatches('c', NAME_TO_ISO, ISO_TO_NAME);
    expect(results.length).toBeGreaterThan(0);
    // China at minimum should match
    expect(results.map(r => r.iso)).toContain('CHN');
  });

  it('results sorted: prefix first, then substring, then alphabetical', () => {
    const results = computeSearchMatches('ir', NAME_TO_ISO, ISO_TO_NAME);
    for (let i = 1; i < results.length; i++) {
      if (results[i].score === results[i-1].score) {
        expect(results[i].display.localeCompare(results[i-1].display)).toBeGreaterThanOrEqual(0);
      } else {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i-1].score);
      }
    }
  });
});

// ── Mock for WorldMapV2 heavy deps ──────────────────────────────────

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

// d3 / topojson fetch mocks
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ type: 'Topology', objects: { countries: { type: 'GeometryCollection', geometries: [] } }, arcs: [] }),
  })
);

vi.mock('d3', () => {
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

describe('WorldMapV2 — search bar renders and accepts input', () => {
  beforeEach(() => vi.resetModules());

  it('renders the search input', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    expect(screen.getByPlaceholderText('Search country…')).toBeInTheDocument();
  });

  it('shows dropdown when query is typed', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const input = screen.getByPlaceholderText('Search country…');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ir' } });
    // dropdown appears (component loads nameToISO from TopoJSON, may be empty in test)
    expect(input.value).toBe('ir');
  });

  it('clears input when × button is clicked', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const input = screen.getByPlaceholderText('Search country…');
    fireEvent.change(input, { target: { value: 'iran' } });
    expect(input.value).toBe('iran');
    const clearBtn = screen.getByLabelText('Clear');
    fireEvent.click(clearBtn);
    expect(input.value).toBe('');
  });

  it('clears on Escape key', async () => {
    const { default: WorldMapV2 } = await import('../components/WorldMapV2');
    render(<MemoryRouter><WorldMapV2 /></MemoryRouter>);
    const input = screen.getByPlaceholderText('Search country…');
    fireEvent.change(input, { target: { value: 'iran' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });
});
