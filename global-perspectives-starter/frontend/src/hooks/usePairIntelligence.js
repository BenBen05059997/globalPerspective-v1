import { useState, useEffect, useCallback } from 'react';
import { fetchPairAnalysis } from '../services/restProxy';

const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(slug) {
  return `gp_pair_intel_v1_${slug}`;
}

export function usePairIntelligence(pairSlug) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!pairSlug);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!pairSlug) return;

    try {
      const raw = localStorage.getItem(cacheKey(pairSlug));
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          setData(cached.data);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchPairAnalysis(pairSlug);
      const item = result?.data || null;
      setData(item);
      if (item) {
        try {
          localStorage.setItem(cacheKey(pairSlug), JSON.stringify({ data: item, timestamp: Date.now() }));
        } catch { /* ignore */ }
      }
    } catch (e) {
      setError(e.message || 'Failed to load pair analysis');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pairSlug]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error };
}
