import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchThreadAnalyses } from '../services/restProxy';

const CACHE_KEY = 'gp_thread_analyses_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;

export function useThreadAnalyses(threadIds) {
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(() => [...threadIds].sort().join(','), [threadIds]);

  const load = useCallback(async () => {
    if (threadIds.length === 0) return;

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          const hit = {};
          let allHit = true;
          for (const id of threadIds) {
            if (id in cached.data) {
              hit[id] = cached.data[id];
            } else {
              allHit = false;
            }
          }
          if (allHit) {
            setAnalyses(hit);
            return;
          }
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    try {
      const result = await fetchThreadAnalyses(threadIds);
      const data = result?.data || {};
      setAnalyses(data);
      try {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const merged = { ...existing.data, ...data };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch {
      setAnalyses({});
    } finally {
      setLoading(false);
    }
  }, [idsKey]);

  useEffect(() => { load(); }, [load]);

  return { analyses, loading };
}
