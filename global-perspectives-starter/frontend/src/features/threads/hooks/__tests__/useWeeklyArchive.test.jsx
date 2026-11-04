// useWeeklyArchive: public data, no sign-in state (S5); a failed load is reported and surfaced, not cached (S16/B5).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const api = vi.hoisted(() => ({ loadArchive: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/archiveRange', () => api);
vi.mock('@/shared/api/errorSink.js', () => sink);

import { useWeeklyArchive } from '@/features/threads/hooks/useWeeklyArchive.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const DAYS = { '2026-11-04': { entries: [{ title: 'a' }], updatedAt: '2026-11-04T05:00:00Z' }, '2026-11-03': { entries: [], updatedAt: null } };

beforeEach(() => {
  clearMemoryCache(); localStorage.clear();
  api.loadArchive.mockReset(); sink.reportFetchError.mockReset();
});

describe('useWeeklyArchive', () => {
  it('loads with no AuthProvider around it, newest day first, and caches the answer', async () => {
    api.loadArchive.mockResolvedValue({ dayMap: DAYS, titles: { a: 'Record title' } });
    const { result } = renderHook(() => useWeeklyArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sortedDates).toEqual(['2026-11-04', '2026-11-03']);
    expect(result.current.dataUpdatedAt).toBe(Date.parse('2026-11-04T05:00:00Z'));
    expect(result.current.error).toBeNull();
    expect(result.current.titles).toEqual({ a: 'Record title' });
    const second = renderHook(() => useWeeklyArchive());
    expect(second.result.current.loading).toBe(false); // from the cache: no second request
    expect(api.loadArchive).toHaveBeenCalledTimes(1);
  });

  it('a failed load is reported once, surfaces the error with an empty archive, and is not cached; refetch retries', async () => {
    api.loadArchive.mockRejectedValueOnce(new Error('Proxy HTTP 500: {"x":1}'));
    const { result } = renderHook(() => useWeeklyArchive());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.sortedDates).toEqual([]);
    expect(sink.reportFetchError).toHaveBeenCalledWith('weekly-archive', expect.any(Error));
    expect(localStorage.getItem('gp_weekly_archive_v4')).toBeNull();

    api.loadArchive.mockResolvedValue({ dayMap: DAYS, titles: { a: 'Record title' } });
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.sortedDates).toHaveLength(2));
    expect(result.current.error).toBeNull();
  });
});
