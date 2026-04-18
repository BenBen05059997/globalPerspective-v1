import { useState, useEffect, useCallback } from 'react';
import { fetchPairAnalysesList } from '../services/restProxy';

const CACHE_KEY = 'gp_pair_analyses_list_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

export function usePairAnalyses() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          setAnalyses(cached.data);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchPairAnalysesList();
      const list = result?.data || [];
      setAnalyses(list);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: list, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch (e) {
      setError(e.message || 'Failed to load pair analyses');
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { analyses, loading, error };
}
