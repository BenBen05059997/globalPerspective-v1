import { useState, useEffect, useMemo } from 'react';
import { fetchDisruptionsList } from '../services/restProxy.js';

const CACHE_KEY = (filters) => `gp_disruptions_${JSON.stringify(filters)}`;
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
export function useDisruptionsList(filters = {}) {
  const stable = useMemo(() => ({
    minSeverity: filters.minSeverity || null,
    country: filters.country || null,
    limit: filters.limit || 50,
  }), [filters.minSeverity, filters.country, filters.limit]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const key = CACHE_KEY(stable);
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setData(d); return; }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchDisruptionsList(stable)
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setData(res.data);
          try { localStorage.setItem(key, JSON.stringify({ data: res.data, ts: Date.now() })); } catch { /* storage full */ }
        } else {
          setData([]);
        }
      })
      .catch((err) => {
        setError(err.message);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [stable]);

  return { data, loading, error };
}
