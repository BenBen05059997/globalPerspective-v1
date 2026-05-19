import { useState, useEffect } from 'react';
import { fetchTopMovers } from '../services/restProxy.js';

const CACHE_KEY = (limit) => `gp_top_movers_${limit}`;
const CACHE_TTL = 30 * 60 * 1000;

export function useTopMovers(limit = 10) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = CACHE_KEY(limit);
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setData(d); return; }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchTopMovers(limit)
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setData(res.data);
          try { localStorage.setItem(key, JSON.stringify({ data: res.data, ts: Date.now() })); } catch { /* storage full */ }
        } else {
          setData([]);
        }
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading };
}
