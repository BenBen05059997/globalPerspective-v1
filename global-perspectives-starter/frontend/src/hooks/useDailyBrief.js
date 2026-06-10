import { useState, useEffect, useCallback } from 'react';
import { fetchDailyBrief } from '../services/restProxy';

const CACHE_KEY = 'gp_daily_brief_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

export function useDailyBrief(dateKey) {
  const [brief, setBrief] = useState(null);
  const [servedDateKey, setServedDateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const effectiveDateKey = dateKey || today;

  const load = useCallback(async () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.[effectiveDateKey]?.timestamp &&
            (Date.now() - cached[effectiveDateKey].timestamp) < CACHE_TTL_MS &&
            cached[effectiveDateKey].data) {
          setBrief(cached[effectiveDateKey].data);
          setServedDateKey(cached[effectiveDateKey].served || effectiveDateKey);
          setLoading(false);
          return;
        }
      }
    } catch (_) { /* ignore */ }

    setLoading(true);
    setError(null);
    try {
      let data = null;
      let served = null;
      const base = new Date(effectiveDateKey + 'T00:00:00Z');
      for (let daysBack = 0; daysBack <= 7; daysBack++) {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() - daysBack);
        const tryKey = d.toISOString().slice(0, 10);
        const result = await fetchDailyBrief(tryKey);
        if (result?.data) { data = result.data; served = tryKey; break; }
      }
      setBrief(data);
      setServedDateKey(served);
      try {
        if (!data) return;
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        existing[effectiveDateKey] = { data, served, timestamp: Date.now() };
        const keys = Object.keys(existing);
        if (keys.length > 7) {
          const oldest = keys.sort()[0];
          delete existing[oldest];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(existing));
      } catch (_) { /* ignore */ }
    } catch (err) {
      setError(err?.message || 'Failed to fetch daily brief');
    } finally {
      setLoading(false);
    }
  }, [effectiveDateKey]);

  useEffect(() => { load(); }, [load]);

  return { brief, servedDateKey, loading, error, refetch: load };
}
