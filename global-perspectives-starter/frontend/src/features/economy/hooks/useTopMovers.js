import { fetchTopMovers } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 30 * 60 * 1000;

export function useTopMovers(limit = 10) {
  const { data, loading } = useCachedQuery(`gp_top_movers_${limit}`, async () => {
    const res = await fetchTopMovers(limit);
    return res?.success && Array.isArray(res.data) ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? [], loading };
}
