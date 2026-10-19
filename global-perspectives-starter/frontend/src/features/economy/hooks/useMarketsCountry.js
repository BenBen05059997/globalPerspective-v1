import { fetchMarketsCountry } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour — macro data updates weekly

export function useMarketsCountry(countryName) {
  const key = countryName ? `gp_markets_country_v1_${countryName}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const res = await fetchMarketsCountry(countryName);
    return res?.success && res?.data ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
