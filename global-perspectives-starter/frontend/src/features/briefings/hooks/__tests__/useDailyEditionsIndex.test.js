// useDailyEditionsIndex — the /briefings editions strip must never fire one request per day for
// 30 days (TASK_2026-09-27_pages_local.md S3: "watch the fan-out"). These tests cover: the probe
// window is capped at LOOKBACK_DAYS, a second mount for the same anchor makes zero new requests
// (sessionStorage cache), and a probe failure is reported but never rendered as a false "no
// edition" claim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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
  beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); });

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
});
