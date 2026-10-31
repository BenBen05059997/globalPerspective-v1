// useCountryRiskLayer: the record's countries index gives every candidate's briefing in ONE request; the
// country_intelligence action, 15 names per call, is the fallback when the index is missing or unreadable (reported).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchCountryIntelligence: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchCountriesIndex: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
const archive = vi.hoisted(() => ({ dayMap: {} }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchCountriesIndex: (...a) => rv.fetchCountriesIndex(...a) }) }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/errorSink.js', () => sink);
vi.mock('@/shared/hooks/useArchiveDayMap.js', () => ({ useArchiveDayMap: () => ({ dayMap: archive.dayMap, loading: false }) }));

import { useCountryRiskLayer } from '@/features/map/hooks/useCountryRiskLayer.js';
import { clearCountriesIndexCache } from '@/shared/api/countryBriefingsIndex.js';

const fresh = new Date(Date.now() - 3600 * 1000).toISOString();
const INDEX = { schemaVersion: 1, countries: {
  FRA: { countryName: 'France', riskScore: 55, riskLevel: 'elevated', generatedAt: fresh },
  JPN: { countryName: 'Japan', riskScore: 20, riskLevel: 'low', generatedAt: fresh },
} };
const entry = (regions) => ({ regions });

beforeEach(() => {
  clearCountriesIndexCache();
  archive.dayMap = { '2026-10-31': { entries: [entry(['France', 'Japan']), entry(['France', 'Japan']), entry(['France'])] } };
  api.fetchCountryIntelligence.mockReset(); api.fetchCountryIntelligence.mockResolvedValue({ data: { France: { riskScore: 40, riskLevel: 'moderate', generatedAt: fresh } } });
  rv.fetchCountriesIndex.mockReset(); sink.reportFetchError.mockReset();
});

// the hook keeps a module-level session cache (names -> briefing) across mounts, so the second test reads what the first left and checks the overwrite
describe('useCountryRiskLayer', () => {
  it('draws from the index with one request and no action call', async () => {
    rv.fetchCountriesIndex.mockResolvedValue(INDEX);
    const { result } = renderHook(() => useCountryRiskLayer(true));
    await waitFor(() => expect(result.current.drawn.map((d) => d.name).sort()).toEqual(['France', 'Japan']));
    expect(result.current.drawn[0].name).toBe('France'); // riskier first
    expect(api.fetchCountryIntelligence).not.toHaveBeenCalled();
    expect(rv.fetchCountriesIndex).toHaveBeenCalledTimes(1);
  });

  it('falls back to the action when the index is missing or unreadable (the failure reported)', async () => {
    archive.dayMap = { '2026-10-31': { entries: [entry(['Germany']), entry(['Germany']), entry(['France']), entry(['France'])] } };
    rv.fetchCountriesIndex.mockRejectedValue(new Error('record view 500 for index/countries.json'));
    const { result } = renderHook(() => useCountryRiskLayer(true));
    await waitFor(() => expect(result.current.drawn.find((d) => d.name === 'France')?.score).toBe(40)); // the action's briefing replaced the index's 55
    expect(api.fetchCountryIntelligence).toHaveBeenCalledTimes(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('countries-index', expect.any(Error));
  });
});
