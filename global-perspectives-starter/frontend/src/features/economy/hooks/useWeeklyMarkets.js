import { fetchWeeklyMarkets } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

// Latest published weekly markets report. Null when none is published yet (honest
// empty state). 30-min localStorage cache.
export function useWeeklyMarkets() {
  const { data, loading, error, refetch } = useCachedQuery('gp_weekly_markets_v1', async () => {
    const res = await fetchWeeklyMarkets();
    return res?.data || null;
  }, { ttl: CACHE_TTL_MS, storage: 'local' });
  return {
    report: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load the weekly markets report') : null,
    refetch,
  };
}
