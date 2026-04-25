import { useState, useEffect } from 'react';
import { fetchMarketsCountry } from '../services/restProxy';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour — macro data updates weekly

function cacheKey(country) {
  return `gp_markets_country_v1_${country}`;
}

export function useMarketsCountry(countryName) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!countryName) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const key = cacheKey(countryName);
        const cached = localStorage.getItem(key);
        if (cached) {
          const { data: cd, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            if (!cancelled) { setData(cd); setLoading(false); }
            return;
          }
        }

        const res = await fetchMarketsCountry(countryName);
        if (cancelled) return;
        if (res?.success && res?.data) {
          localStorage.setItem(key, JSON.stringify({ data: res.data, ts: Date.now() }));
          setData(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [countryName]);

  return { data, loading, error };
}
