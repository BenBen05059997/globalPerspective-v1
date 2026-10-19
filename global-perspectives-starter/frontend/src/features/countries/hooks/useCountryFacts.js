import { fetchCountryFacts } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { useCachedQuery, clearMemoryCache } from '@/shared/api/useCachedQuery.js';

// Stored country facts for one country (Batch 3 / D). Memory-cached for 30 min with shared in-flight
// requests: the card mounts on /map and /weekly/country/:name and must not refetch on every selection.
// A failure is reported and leaves `facts` null (no placeholder, no guess). A new name never shows the
// previous country's facts while its own fetch is in flight.
const TTL_MS = 30 * 60 * 1000;

export function useCountryFacts(name) {
  const { data } = useCachedQuery(name ? `country_facts_${name}` : null, async () => {
    try {
      const res = await fetchCountryFacts([name]);
      return (res && res.data && res.data[name]) || null;
    } catch (err) {
      reportFetchError('country-facts', err);
      throw err;
    }
  }, { ttl: TTL_MS });
  return { facts: data ?? null };
}

export const _resetCountryFactsCache = clearMemoryCache;
