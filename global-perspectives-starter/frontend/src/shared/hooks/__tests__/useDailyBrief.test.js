// F1.1 (map-console review R1): useDailyBrief used to run its own independent backward scan on
// every mount — two components mounting it for the same date (Layout + SituationHome, both
// defaulting to "today") doubled the request count, and a "nothing found" result was never
// cached, so a multi-week outage repeated the full scan on every page load. These tests cover the
// fixes: a shared in-flight request across concurrent mounts and caching the empty result.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchBriefsIndex: async () => null }) })); // the record is not generated: these tests are about the action path
vi.mock('@/shared/api/restProxy', () => ({ fetchDailyBrief: vi.fn(), fetchLatestDailyBrief: vi.fn() }));

async function freshModule() {
  vi.resetModules();
  const restProxy = await import('@/shared/api/restProxy');
  const hookModule = await import('@/shared/hooks/useDailyBrief.js');
  return { ...hookModule, fetchDailyBrief: restProxy.fetchDailyBrief, fetchLatestDailyBrief: restProxy.fetchLatestDailyBrief };
}

describe('useDailyBrief — shared request + cache (F1.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('two concurrent hook instances for the same date share one in-flight scan (no fan-out)', async () => {
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    fetchDailyBrief.mockImplementation(async (dateKey) => (
      dateKey === '2026-09-26' ? { data: { generatedAt: '2026-09-26T05:00:00Z' } } : { data: null }
    ));

    const a = renderHook(() => useDailyBrief('2026-09-26'));
    const b = renderHook(() => useDailyBrief('2026-09-26'));

    await waitFor(() => expect(a.result.current.loading).toBe(false));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(a.result.current.brief).toEqual({ generatedAt: '2026-09-26T05:00:00Z' });
    expect(b.result.current.brief).toEqual({ generatedAt: '2026-09-26T05:00:00Z' });
    // No index: one probe of the day and the 7 before it, run once — the second hook instance reused
    // the first instance's in-flight promise instead of running its own.
    expect(fetchDailyBrief).toHaveBeenCalledTimes(8);
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-09-26');
  });

  it('caches a "nothing found" result so a second mount within the TTL makes no new requests', async () => {
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    fetchDailyBrief.mockResolvedValue({ data: null });

    const first = renderHook(() => useDailyBrief('2026-09-26'));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.brief).toBeNull();
    const callsAfterFirst = fetchDailyBrief.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // A second, later mount for the same date must hit the cache, not fire the scan again.
    const second = renderHook(() => useDailyBrief('2026-09-26'));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.brief).toBeNull();
    expect(fetchDailyBrief).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('an explicit dateKey still resolves that date directly (unchanged single-date behaviour)', async () => {
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    fetchDailyBrief.mockImplementation(async (dateKey) => (
      dateKey === '2026-08-01' ? { data: { generatedAt: '2026-08-01T09:00:00Z' } } : { data: null }
    ));
    const { result } = renderHook(() => useDailyBrief('2026-08-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual({ generatedAt: '2026-08-01T09:00:00Z' });
    expect(result.current.servedDateKey).toBe('2026-08-01');
  });

  // Batch 3 / B: no explicit date = "latest" = ONE server call (was up to 21 per cold page).
  it('latest mode: several mounts with no date make exactly one latest_daily_brief call and no daily_brief calls', async () => {
    const { useDailyBrief, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
    fetchLatestDailyBrief.mockResolvedValue({ data: { generatedAt: '2026-09-30T02:26:00Z', dateKey: '2026-09-30' }, dateKey: '2026-09-30', editions: ['2026-09-30', '2026-09-12'] });
    const a = renderHook(() => useDailyBrief());
    const b = renderHook(() => useDailyBrief());
    const c = renderHook(() => useDailyBrief());
    for (const h of [a, b, c]) await waitFor(() => expect(h.result.current.loading).toBe(false));
    expect(a.result.current.brief.dateKey).toBe('2026-09-30');
    expect(c.result.current.servedDateKey).toBe('2026-09-30');
    expect(fetchLatestDailyBrief).toHaveBeenCalledTimes(1);
    expect(fetchDailyBrief).not.toHaveBeenCalled();
  });

  it('latest mode: a "nothing published" answer is cached (no new request within the TTL)', async () => {
    const { useDailyBrief, fetchLatestDailyBrief } = await freshModule();
    fetchLatestDailyBrief.mockResolvedValue({ data: null, dateKey: null, editions: [] });
    const first = renderHook(() => useDailyBrief());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.brief).toBeNull();
    expect(first.result.current.servedDateKey).toBeNull();
    const second = renderHook(() => useDailyBrief());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetchLatestDailyBrief).toHaveBeenCalledTimes(1);
  });

  it('latest mode: a request failure is reported as an error with no brief (no fake fallback)', async () => {
    const { useDailyBrief, fetchLatestDailyBrief } = await freshModule();
    fetchLatestDailyBrief.mockRejectedValue(new Error('proxy down'));
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toBeNull();
    expect(result.current.error).toMatch(/proxy down/);
  });
});
