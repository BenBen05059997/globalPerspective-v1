import { fetchEconomicImpact } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// 404 / no record → null (treat as no economic dimension); a network/server error also leaves
// data null (with `error` set) so the page never breaks.
export function useEconomicImpact(threadId, { enabled = true } = {}) {
  const key = threadId && enabled ? `gp_econ_${threadId}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const res = await fetchEconomicImpact(threadId);
    return res?.success && res.data ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
