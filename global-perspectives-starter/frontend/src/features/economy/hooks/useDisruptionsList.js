import { fetchDisruptionsList } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * useDisruptionsList — fetches the active economic disruption list with optional filters.
 *
 * Usage:
 *   const { data, loading } = useDisruptionsList({ country: 'Iran' });
 *   const { data } = useDisruptionsList({ minSeverity: 'moderate' });
 *   const { data } = useDisruptionsList();   // all
 *
 * Returns: { data: Array<impact>, loading, error }
 */
export function useDisruptionsList(filters = {}, { enabled = true } = {}) {
  const stable = {
    minSeverity: filters.minSeverity || null,
    country: filters.country || null,
    limit: filters.limit || 50,
  };
  const key = enabled ? `gp_disruptions_${JSON.stringify(stable)}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const res = await fetchDisruptionsList(stable);
    return res?.success && Array.isArray(res.data) ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? [], loading, error: error?.message ?? null };
}
