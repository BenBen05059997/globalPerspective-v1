import { useState, useEffect } from 'react';
import { fetchMarketsGlobal } from '../services/restProxy';

const CACHE_KEY = 'gp_markets_global_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — data updates hourly, poll frequently

export function useMarketsGlobal() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [asOf, setAsOf]       = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load(background = false) {
      if (!background) setLoading(true);
      try {
        // Check localStorage cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cd, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            if (!cancelled) { setData(cd); setAsOf(cd?.fx?.asOf || null); setLoading(false); }
            return;
          }
        }

        const res = await fetchMarketsGlobal();
        if (cancelled) return;
        if (res?.success && res?.data) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() }));
          setData(res.data);
          setAsOf(res.data?.fx?.asOf || null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Background refresh every 5 minutes
    const interval = setInterval(() => load(true), CACHE_TTL);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { data, loading, error, asOf };
}
