// useCountryIntelligence for several countries (the list page): the record's countries index answers in one request;
// the country_intelligence action, 15 names per call, answers when the index is missing or unreadable (reported).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchCountryIntelligence: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchCountriesIndex: vi.fn(), fetchCountryView: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/recordViews', () => ({ makeRecordViews: () => ({ fetchCountriesIndex: (...a) => rv.fetchCountriesIndex(...a), fetchCountryView: (...a) => rv.fetchCountryView(...a) }) }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchCountriesIndex: (...a) => rv.fetchCountriesIndex(...a), fetchCountryView: (...a) => rv.fetchCountryView(...a) }) }));
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/errorSink', () => sink);
vi.mock('@/shared/api/errorSink.js', () => sink);

import { useCountryIntelligence } from '@/features/countries/hooks/useCountryIntelligence.js';
import { clearCountriesIndexCache } from '@/shared/api/countryBriefingsIndex.js';

const INDEX = { schemaVersion: 1, countries: { FRA: { countryName: 'France', riskScore: 55, generatedAt: '2026-10-31T04:00:00Z' }, JPN: { countryName: 'Japan', riskScore: 20, generatedAt: '2026-10-31T04:00:00Z' } } };
const names = ['France', 'Japan', 'Atlantis'];

beforeEach(() => {
  localStorage.clear(); clearCountriesIndexCache();
  api.fetchCountryIntelligence.mockReset(); api.fetchCountryIntelligence.mockResolvedValue({ data: { France: { riskScore: 1, headline: 'from action' } } });
  rv.fetchCountriesIndex.mockReset(); rv.fetchCountryView.mockReset(); sink.reportFetchError.mockReset();
});

describe('useCountryIntelligence (several countries)', () => {
  it('reads the countries index once and asks no action', async () => {
    rv.fetchCountriesIndex.mockResolvedValue(INDEX);
    const { result } = renderHook(() => useCountryIntelligence(names));
    await waitFor(() => expect(Object.keys(result.current.intelligence).sort()).toEqual(['France', 'Japan']));
    expect(result.current.intelligence.France.riskScore).toBe(55);
    expect(api.fetchCountryIntelligence).not.toHaveBeenCalled();
  });

  it('a missing index falls back to the action, unreported', async () => {
    rv.fetchCountriesIndex.mockResolvedValue(null);
    const { result } = renderHook(() => useCountryIntelligence(names));
    await waitFor(() => expect(result.current.intelligence.France?.headline).toBe('from action'));
    expect(api.fetchCountryIntelligence).toHaveBeenCalledWith(names);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('a failed index read is reported and falls back to the action', async () => {
    rv.fetchCountriesIndex.mockRejectedValue(new Error('record view 503 for index/countries.json'));
    const { result } = renderHook(() => useCountryIntelligence(names));
    await waitFor(() => expect(result.current.intelligence.France?.headline).toBe('from action'));
    expect(sink.reportFetchError).toHaveBeenCalledWith('countries-index', expect.any(Error));
  });
});
