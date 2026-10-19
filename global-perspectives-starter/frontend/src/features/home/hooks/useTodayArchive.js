import { contentService } from '@/shared/data/contentService';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 10 * 60 * 1000;

export function useTodayArchive() {
  const { data, loading, error, refetch } = useCachedQuery('today_archive_cache_v1', async () => {
    const result = await contentService.getTodayArchive();
    // An empty day is not cached: the next mount asks again.
    return result.entries.length > 0 ? result : undefined;
  }, { ttl: CACHE_TTL_MS, storage: 'local' });
  return {
    entries: data?.entries ?? [],
    loading,
    error: error ? (error.message || 'Failed to fetch today archive') : null,
    updatedAt: data?.updatedAt ?? null,
    refetch,
  };
}
