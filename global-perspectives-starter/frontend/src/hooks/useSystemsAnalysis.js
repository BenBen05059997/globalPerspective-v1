import { useState, useEffect } from 'react';
import { fetchSystemsAnalysis } from '../services/restProxy.js';

const CACHE_KEY = (name) => `gp_systems_${name}`;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useSystemsAnalysis(countryName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!countryName) return;

    const cacheKey = CACHE_KEY(countryName);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setData(d); return; }
      }
    } catch (_e) { /* malformed cache */ }

    setLoading(true);
    fetchSystemsAnalysis(countryName)
      .then((res) => {
        if (res?.success && res.data) {
          setData(res.data);
          try { localStorage.setItem(cacheKey, JSON.stringify({ data: res.data, ts: Date.now() })); } catch (_e) { /* storage full */ }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [countryName]);

  return { data, loading, error };
}
