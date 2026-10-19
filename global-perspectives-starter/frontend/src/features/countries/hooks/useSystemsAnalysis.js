import { fetchSystemsAnalysis } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useSystemsAnalysis(countryName) {
  const key = countryName ? `gp_systems_${countryName}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const res = await fetchSystemsAnalysis(countryName);
    return res?.success && res.data ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
