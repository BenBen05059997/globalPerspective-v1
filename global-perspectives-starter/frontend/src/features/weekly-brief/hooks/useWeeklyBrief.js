import { fetchWeeklyBrief } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

// A published weekly intelligence brief: the latest by default, or the one published for `week`
// (its weekOf, YYYY-MM-DD) when given. Null when none is published (honest empty state). 30-min
// localStorage cache per edition. A read API without per-week lookup answers with the latest
// edition: callers compare `brief.weekOf` with the week they asked for and say so.
export function useWeeklyBrief(week = null) {
  const key = week ? `gp_weekly_brief_v1:${week}` : 'gp_weekly_brief_v1';
  const { data, loading, error, refetch } = useCachedQuery(key, async () => {
    const res = await fetchWeeklyBrief(week);
    return res?.data || null;
  }, { ttl: CACHE_TTL_MS, storage: 'local' });
  return {
    brief: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load the weekly brief') : null,
    refetch,
  };
}
