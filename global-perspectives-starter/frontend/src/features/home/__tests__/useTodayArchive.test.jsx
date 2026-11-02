// useTodayArchive: archive entries from contentService, an empty day is not cached, a failure surfaces as
// an error string with no entries (the sidebar then renders nothing).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import archiveFixture from '@fixtures/archive.json';

const getTodayArchive = vi.fn();
vi.mock('@/shared/data/contentService', () => ({
  contentService: { getTodayArchive: (...a) => getTodayArchive(...a) },
}));

import { useTodayArchive } from '@/features/home/hooks/useTodayArchive';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const CACHE_KEY = 'today_archive_cache_v1';
const day = archiveFixture.data['2026-04-26'];

beforeEach(() => {
  getTodayArchive.mockReset();
  clearMemoryCache();
  localStorage.clear();
});

describe('useTodayArchive', () => {
  it("returns the day's entries and caches them in localStorage", async () => {
    getTodayArchive.mockResolvedValue({ entries: day.entries, updatedAt: day.updatedAt });
    const { result } = renderHook(() => useTodayArchive());
    expect(result.current.entries).toEqual([]);
    await waitFor(() => expect(result.current.entries).toHaveLength(day.entries.length));
    expect(result.current.updatedAt).toBe(day.updatedAt);
    expect(result.current.error).toBeNull();
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).data.entries).toHaveLength(day.entries.length);
  });

  it('an empty day gives no entries and is not cached, so the next mount asks again', async () => {
    getTodayArchive.mockResolvedValue({ entries: [], updatedAt: null });
    const { result } = renderHook(() => useTodayArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('a failure leaves no entries and reports the error message', async () => {
    getTodayArchive.mockRejectedValue(new Error('Today archive unavailable'));
    const { result } = renderHook(() => useTodayArchive());
    await waitFor(() => expect(result.current.error).toBe('Today archive unavailable'));
    expect(result.current.entries).toEqual([]);
  });

  it('a fresh cached copy is used without a request', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: { entries: day.entries, updatedAt: 'x' } }));
    const { result } = renderHook(() => useTodayArchive());
    expect(result.current.entries).toHaveLength(day.entries.length);
    expect(getTodayArchive).not.toHaveBeenCalled();
  });
});
