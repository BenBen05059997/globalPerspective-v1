import { useState, useEffect } from 'react';
import { fetchCountryHistory } from '../services/restProxy.js';

const CACHE_KEY = (name) => `gp_country_history_${name}`;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useCountryHistory(countryName) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!countryName) return;

    const cacheKey = CACHE_KEY(countryName);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setSnapshots(data);
          return;
        }
      }
    } catch (_e) { /* malformed cache */ }

    setLoading(true);
    fetchCountryHistory(countryName)
      .then((res) => {
        if (res?.success && Array.isArray(res.snapshots)) {
          const sorted = [...res.snapshots].sort((a, b) => a.dateKey?.localeCompare(b.dateKey));
          setSnapshots(sorted);
          try { localStorage.setItem(cacheKey, JSON.stringify({ data: sorted, ts: Date.now() })); } catch (_e) { /* storage full */ }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [countryName]);

  return { snapshots, loading, error };
}
