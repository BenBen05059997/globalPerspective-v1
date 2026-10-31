// useDailyEditionsIndex — the /briefings editions strip must never fire one request per day for
// 30 days (TASK_2026-09-27_pages_local.md S3: "watch the fan-out"). These tests cover: the probe
// window is capped at LOOKBACK_DAYS, a second mount for the same anchor makes zero new requests
// (sessionStorage cache), and a probe failure is reported but never rendered as a false "no
// edition" claim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import fx from '@/shared/api/__tests__/fixtures/briefs.json';

const rv = vi.hoisted(() => ({ fetchBriefsIndex: vi.fn(), fetchManifest: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchBriefsIndex: (...a) => rv.fetchBriefsIndex(...a), fetchManifest: (...a) => rv.fetchManifest(...a) }) }));
vi.mock('@/shared/api/restProxy', () => ({ fetchDailyBrief: vi.fn(), fetchLatestDailyBrief: vi.fn() }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

async function freshModule() {
  vi.resetModules();
  const restProxy = await import('@/shared/api/restProxy');
  const errorSink = await import('@/shared/api/errorSink');
  const hookModule = await import('@/features/briefings/hooks/useDailyEditionsIndex.js');
  return { ...hookModule, fetchDailyBrief: restProxy.fetchDailyBrief, fetchLatestDailyBrief: restProxy.fetchLatestDailyBrief, reportFetchError: errorSink.reportFetchError };
}

describe('useDailyEditionsIndex', () => {
  beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); rv.fetchBriefsIndex.mockResolvedValue(null); rv.fetchManifest.mockResolvedValue(null); }); // the record is not generated unless a test says so

  it('probes at most LOOKBACK_DAYS dates for one anchor', async () => {
    const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief, LOOKBACK_DAYS } = await freshModule();
    fetchLatestDailyBrief.mockRejectedValue(new Error('unavailable')); // exercise the probe fallback
    fetchDailyBrief.mockImplementation(async (dk) => ({ data: dk === '2026-09-12' ? { dateKey: dk } : null }));

    const { result } = renderHook(() => useDailyEditionsIndex('2026-09-12'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchDailyBrief).toHaveBeenCalledTimes(LOOKBACK_DAYS);
    expect(result.current.index['2026-09-12']).toBe(true);
    expect(result.current.index['2026-09-11']).toBe(false);
  });

  it('a second hook for the same anchor reuses the sessionStorage cache (zero new requests)', async () => {
    const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
    fetchLatestDailyBrief.mockRejectedValue(new Error('unavailable'));
    fetchDailyBrief.mockImplementation(async (dk) => ({ data: dk === '2026-09-12' ? { dateKey: dk } : null }));

    const a = renderHook(() => useDailyEditionsIndex('2026-09-12'));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    const callsAfterFirst = fetchDailyBrief.mock.calls.length;

    const b = renderHook(() => useDailyEditionsIndex('2026-09-12'));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(fetchDailyBrief.mock.calls.length).toBe(callsAfterFirst);
    expect(b.result.current.index['2026-09-12']).toBe(true);
  });

  it('a probe failure is reported and leaves that date unknown, not "no edition"', async () => {
    const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief, reportFetchError } = await freshModule();
    fetchLatestDailyBrief.mockRejectedValue(new Error('unavailable'));
    fetchDailyBrief.mockImplementation(async (dk) => {
      if (dk === '2026-09-11') throw new Error('network down');
      return { data: null };
    });

    const { result } = renderHook(() => useDailyEditionsIndex('2026-09-12'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(reportFetchError).toHaveBeenCalledWith('briefings-daily-editions', expect.any(Error));
    expect(result.current.index['2026-09-11']).toBeUndefined();
  });

  it('Batch 3 / B: dates inside the latest_daily_brief window are answered from editions[] with zero per-date probes', async () => {
    const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    fetchLatestDailyBrief.mockResolvedValue({ data: { dateKey: today }, dateKey: today, editions: [today] });
    const { result } = renderHook(() => useDailyEditionsIndex(today));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index[today]).toBe(true);
    expect(result.current.index[yesterday]).toBe(false);
    expect(fetchDailyBrief).not.toHaveBeenCalled();
    expect(fetchLatestDailyBrief).toHaveBeenCalledTimes(1);
  });

  it('fresh views: the record\'s briefs index answers today too, so a failed latest lookup costs no probe at all (decision 0050)', async () => {
    rv.fetchBriefsIndex.mockResolvedValue(fx.index);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T08:00:00Z'));
    rv.fetchManifest.mockResolvedValue({ builtAt: '2026-10-31T04:40:00.000Z' });
    try {
      const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
      fetchLatestDailyBrief.mockRejectedValue(new Error('unavailable'));
      fetchDailyBrief.mockResolvedValue({ data: null });
      const { result } = renderHook(() => useDailyEditionsIndex('2026-10-31'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.index['2026-10-30']).toBe(true);
      expect(result.current.index['2026-10-31']).toBe(false); // no brief yet today: the record says so
      expect(fetchDailyBrief).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('stale views: the record\'s briefs index answers every date before today, so a failed latest lookup costs one probe (today), not 14', async () => {
    rv.fetchBriefsIndex.mockResolvedValue(fx.index); // live index of 2026-10-31: briefs on 10-30, 10-29, ... 10-25, none 10-20 to 10-24
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T08:00:00Z'));
    try {
      const { useDailyEditionsIndex, fetchDailyBrief, fetchLatestDailyBrief, LOOKBACK_DAYS } = await freshModule();
      fetchLatestDailyBrief.mockRejectedValue(new Error('unavailable'));
      fetchDailyBrief.mockResolvedValue({ data: null });
      const { result } = renderHook(() => useDailyEditionsIndex('2026-10-31'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(LOOKBACK_DAYS).toBe(14);
      expect(result.current.index['2026-10-30']).toBe(true);
      expect(result.current.index['2026-10-25']).toBe(true);
      expect(result.current.index['2026-10-24']).toBe(false);
      expect(result.current.index['2026-10-31']).toBe(false); // today, probed
      expect(fetchDailyBrief.mock.calls).toEqual([['2026-10-31']]);
    } finally { vi.useRealTimers(); }
  });
});
