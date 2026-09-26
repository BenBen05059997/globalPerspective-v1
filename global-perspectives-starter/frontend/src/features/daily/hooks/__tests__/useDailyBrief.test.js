// F1.1 (map-console review R1): useDailyBrief used to run its own independent backward scan on
// every mount — two components mounting it for the same date (Layout + SituationHome, both
// defaulting to "today") doubled the request count, and a "nothing found" result was never
// cached, so a multi-week outage repeated the full scan on every page load. These tests cover the
// three fixes: a shared in-flight request across concurrent mounts, caching the empty result, and
// starting a later scan from the last date that actually returned a brief instead of re-scanning
// from today every time.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/shared/api/restProxy', () => ({ fetchDailyBrief: vi.fn() }));

async function freshModule() {
  vi.resetModules();
  const restProxy = await import('@/shared/api/restProxy');
  const hookModule = await import('@/features/daily/hooks/useDailyBrief.js');
  return { ...hookModule, fetchDailyBrief: restProxy.fetchDailyBrief };
}

describe('useDailyBrief — shared request + cache (F1.1)', () => {
  beforeEach(() => {
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
    // Only the single "today" offset needed to be fetched — the second hook instance reused the
    // first instance's in-flight promise instead of running its own scan.
    expect(fetchDailyBrief).toHaveBeenCalledTimes(1);
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

  it('starts a later scan from the last date that returned a brief, instead of re-scanning from today', async () => {
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    // First lookup (as of 2026-09-13): the brief exists at 2026-09-12 (one day back).
    fetchDailyBrief.mockImplementation(async (dateKey) => (
      dateKey === '2026-09-12' ? { data: { generatedAt: '2026-09-12T09:00:00Z' } } : { data: null }
    ));
    const day1 = renderHook(() => useDailyBrief('2026-09-13'));
    await waitFor(() => expect(day1.result.current.loading).toBe(false));
    expect(day1.result.current.brief).toEqual({ generatedAt: '2026-09-12T09:00:00Z' });
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-09-12');

    // Two weeks later, the outage continues (still nothing newer than 2026-09-12). A naive scan
    // from "today" (offset 0..30) would touch every date in between; the remembered last-found
    // date lets it jump straight from "today" to 2026-09-12 in two requests.
    fetchDailyBrief.mockClear();
    const day15 = renderHook(() => useDailyBrief('2026-09-27'));
    await waitFor(() => expect(day15.result.current.loading).toBe(false));
    expect(day15.result.current.brief).toEqual({ generatedAt: '2026-09-12T09:00:00Z' });
    expect(fetchDailyBrief).toHaveBeenCalledTimes(2);
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-09-27'); // today, checked fresh
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-09-12'); // the remembered date, re-confirmed
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
});
