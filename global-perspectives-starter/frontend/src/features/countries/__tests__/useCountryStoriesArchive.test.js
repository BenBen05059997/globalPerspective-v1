import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const loadArchiveDayMap = vi.fn(async () => ({}));
vi.mock('@/shared/api/archiveRange.js', () => ({ loadArchiveDayMap: (...a) => loadArchiveDayMap(...a) }));
vi.mock('@/shared/api/forecastViews.js', () => ({ recordForecast: vi.fn(async () => null) }));
vi.mock('@/features/countries/lib/countryForecast.js', () => ({ countryForecast: vi.fn(async () => null) }));

import { useCountryStories } from '@/features/countries/hooks/useCountryStories.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const dayMap = { '2026-11-03': { entries: [{ threadId: 't1', topicId: 'x1', title: 'Japan story', date: '2026-11-03', regions: ['Japan'], category: 'politics' }] } };

describe('useCountryStories archive source', () => {
  beforeEach(() => { clearMemoryCache(); loadArchiveDayMap.mockClear(); });

  it('uses the archive the page passes and loads nothing itself', () => {
    const { result } = renderHook(() => useCountryStories('Japan', { dayMap, loading: false }));
    expect(loadArchiveDayMap).not.toHaveBeenCalled();
    expect(result.current.stories.map((s) => s.threadId)).toEqual(['t1']);
  });

  it('reads the shared public archive when none is passed (the map card)', async () => {
    renderHook(() => useCountryStories('Japan'));
    await vi.waitFor(() => expect(loadArchiveDayMap).toHaveBeenCalledTimes(1));
  });
});
