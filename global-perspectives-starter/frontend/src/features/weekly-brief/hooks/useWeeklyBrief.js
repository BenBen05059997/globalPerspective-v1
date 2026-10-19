import { fetchWeeklyBrief } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

// Latest published weekly intelligence brief. Null when none is published yet (honest
// empty state). 30-min localStorage cache.
export function useWeeklyBrief() {
  const { data, loading, error, refetch } = useCachedQuery('gp_weekly_brief_v1', async () => {
    const res = await fetchWeeklyBrief();
    return res?.data || null;
  }, { ttl: CACHE_TTL_MS, storage: 'local' });
  return {
    brief: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load the weekly brief') : null,
    refetch,
  };
}
