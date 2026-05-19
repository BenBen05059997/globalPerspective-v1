import { useState, useEffect } from 'react';
import { fetchEconomicImpact } from '../services/restProxy.js';

const CACHE_KEY = (id) => `gp_econ_${id}`;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useEconomicImpact(threadId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!threadId) return;

    const key = CACHE_KEY(threadId);
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setData(d); return; }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchEconomicImpact(threadId)
      .then((res) => {
        if (res?.success && res.data) {
          setData(res.data);
          try { localStorage.setItem(key, JSON.stringify({ data: res.data, ts: Date.now() })); } catch { /* storage full */ }
        } else {
          // 404 / no record → null (treat as no economic dimension)
          setData(null);
        }
      })
      .catch((err) => {
        // Network/server error — fail silently to null, do not break the page
        setError(err.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [threadId]);

  return { data, loading, error };
}
