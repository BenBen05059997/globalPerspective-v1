import { useState, useEffect, useCallback } from 'react';
import { fetchWeeklyMarkets } from '../services/restProxy';

const CACHE_KEY = 'gp_weekly_markets_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

// Latest published weekly markets report. Null when none is published yet (honest
// empty state). 30-min localStorage cache.
export function useWeeklyMarkets() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          setReport(cached.data || null);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchWeeklyMarkets();
      const data = res?.data || null;
      setReport(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() })); } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || 'Failed to load the weekly markets report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { report, loading, error, refetch: load };
}
