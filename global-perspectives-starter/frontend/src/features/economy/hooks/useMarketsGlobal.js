import { useEffect } from 'react';
import { fetchMarketsGlobal } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — data updates hourly, poll frequently

export function useMarketsGlobal() {
  const { data, loading, error, refetch } = useCachedQuery('gp_markets_global_v1', async () => {
    const res = await fetchMarketsGlobal();
    return res?.success && res?.data ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });

  // Background refresh every 5 minutes (the current data stays on screen while it loads).
  useEffect(() => {
    const interval = setInterval(refetch, CACHE_TTL);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data: data ?? null, loading, error: error?.message ?? null, asOf: data?.fx?.asOf || null };
}
