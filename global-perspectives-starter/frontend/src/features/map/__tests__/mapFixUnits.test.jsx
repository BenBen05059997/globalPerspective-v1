// Pure/hook units behind the map fix round: oldestSource, one-row-per-thread alert stack, the card header
// note, ISO2 country links, and failures of the world poll / situation detail reaching the error sink.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWorld: vi.fn(), fetchSituationDetail: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/features/map/api/worldData.js', async (orig) => ({ ...(await orig()), fetchWorld: (...a) => api.fetchWorld(...a), fetchSituationDetail: (...a) => api.fetchSituationDetail(...a) }));
vi.mock('@/shared/api/errorSink.js', () => sink);

import { oldestSource } from '@/features/map/api/worldData.js';
import { alertStackItems } from '@/features/map/lib/alertStack.js';
import { changeNote } from '@/features/map/lib/situationText.js';
import { countryForParam, countryCardName, isUnknownCountryCode } from '@/features/map/lib/deepLinks.js';
import { useWorld, useSituationDetail } from '@/features/map/hooks/useWorld.js';

describe('oldestSource', () => {
  it('counts only timestamp strings: newsDegraded: true is a flag, not 1970', () => {
    const sources = { gdacs: '2026-11-03T06:25:07.392Z', news: '2026-11-03T05:50:16.498Z', newsDegraded: true, gdacsDegraded: false };
    expect(oldestSource(sources)).toBe('2026-11-03T05:50:16.498Z');
  });
  it('is null when there is no stamp at all', () => {
    expect(oldestSource({ newsDegraded: true })).toBeNull();
    expect(oldestSource(null)).toBeNull();
  });
});

describe('alertStackItems lists one row per situation', () => {
  const NOW = Date.parse('2026-11-03T06:00:00Z');
  const s = (id, over = {}) => ({ id, tier: 'high', state: 'peak', centroid: { lat: 1, lon: 1 }, last_change_at: '2026-11-03T05:00:00Z', threadId: null, ...over });
  it('keeps two different events that share a story thread as two rows (US midterms vs Israel reaction)', () => {
    const items = alertStackItems([
      s('news#USA#t1', { threadId: 't1', tier: 'high' }),
      s('news#ISR#t1', { threadId: 't1', tier: 'moderate' }),
      s('news#x', { threadId: null }),
    ], NOW).items.map((x) => x.id);
    expect(items).toEqual(['news#USA#t1', 'news#x', 'news#ISR#t1']);
  });
  it('a Qeshm-style event is one situation (the tracker merged it), so it is one row', () => {
    expect(alertStackItems([s('news#conflict#IRN#qeshm', { threadId: 't1', threadIds: ['t1', 't2'] })], NOW).items).toHaveLength(1);
  });
  it('lists situations without a thread each time', () => {
    expect(alertStackItems([s('a'), s('b'), s('c')], NOW).items).toHaveLength(3);
  });
});

describe('changeNote', () => {
  it('drops the stale outlet count and coverage ratio of a news situation, keeping the rest', () => {
    expect(changeNote({ source: 'news', what_changed: '2 outlets · spreading to USA, IRN' })).toBe('spreading to USA, IRN');
    expect(changeNote({ source: 'news', what_changed: '5 outlets · coverage 1.67× prior · spreading to ISR' })).toBe('spreading to ISR');
    expect(changeNote({ source: 'news', what_changed: '6 outlets' })).toBeNull();
  });
  it('passes a GDACS line through', () => {
    expect(changeNote({ source: 'gdacs', what_changed: 'Back in GDACS · Red alert' })).toBe('Back in GDACS · Red alert');
    expect(changeNote({ source: 'news' })).toBeNull();
  });
});

describe('?country= codes', () => {
  it('resolves a two-letter ISO2 code (any case) to the country and opens the card by its name', () => {
    expect(countryForParam('JP')).toEqual({ iso3: 'JPN', name: 'Japan' });
    expect(countryForParam('jp').iso3).toBe('JPN');
    expect(countryCardName('JP')).toBe('Japan');
    expect(countryCardName('JPN')).toBe('Japan');
  });
  it('an unknown code is flagged; names and regions are not', () => {
    expect(isUnknownCountryCode('ZZ')).toBe(true);
    expect(isUnknownCountryCode('JP')).toBe(false);
    expect(isUnknownCountryCode('Europe')).toBe(false);
    expect(isUnknownCountryCode(null)).toBe(false);
  });
});

describe('failures reach the error sink', () => {
  beforeEach(() => { api.fetchWorld.mockReset(); api.fetchSituationDetail.mockReset(); sink.reportFetchError.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a failed later world poll is reported (the page keeps the last good world)', async () => {
    api.fetchWorld.mockResolvedValueOnce({ situations: [], sources: {} });
    const { result } = renderHook(() => useWorld());
    await waitFor(() => expect(result.current.world).not.toBeNull());
    api.fetchWorld.mockRejectedValueOnce(new Error('world 503'));
    await act(async () => { await result.current.refresh(); });
    expect(sink.reportFetchError).toHaveBeenCalledWith('map-world', expect.objectContaining({ message: 'world 503' }));
    expect(result.current.world).not.toBeNull();
  });

  it('a failed situation detail fetch is reported and read as failed, a 404 as none', async () => {
    api.fetchSituationDetail.mockRejectedValueOnce(new Error('detail 500'));
    const failed = renderHook(() => useSituationDetail('news#a'));
    expect(failed.result.current.status).toBe('loading');
    await waitFor(() => expect(failed.result.current.status).toBe('failed'));
    expect(sink.reportFetchError).toHaveBeenCalledWith('map-situation-detail', expect.any(Error));
    api.fetchSituationDetail.mockResolvedValueOnce(null);
    const none = renderHook(() => useSituationDetail('news#b'));
    await waitFor(() => expect(none.result.current.status).toBe('none'));
    api.fetchSituationDetail.mockResolvedValueOnce({ evidence: {} });
    const ready = renderHook(() => useSituationDetail('news#c'));
    await waitFor(() => expect(ready.result.current.status).toBe('ready'));
    expect(renderHook(() => useSituationDetail(null)).result.current.status).toBe('idle');
  });
});
