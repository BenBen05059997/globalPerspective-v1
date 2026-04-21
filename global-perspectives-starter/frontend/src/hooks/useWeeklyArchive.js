import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchArchiveRange } from '../services/restProxy';
import { useAuth } from '../contexts/AuthContext';

const CACHE_KEY = 'gp_weekly_archive_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function useWeeklyArchive() {
  const { user } = useAuth();
  const [dayMap, setDayMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tier, setTier] = useState(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const fresh = cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
        if (fresh && cached?.dayMap) {
          setDayMap(cached.dayMap);
          setTier(cached.tier || null);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    window.dispatchEvent(new CustomEvent('gp-loading-start'));
    try {
      const result = await fetchArchiveRange(30);
      const data = result?.data || {};
      const dayCount = Object.keys(data).length;
      const resolvedTier = dayCount > 7 ? 'enterprise' : 'member';
      setDayMap(data);
      setTier(resolvedTier);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          dayMap: data,
          tier: resolvedTier,
          uid: user?.uid || 'anon',
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || 'Failed to fetch archive');
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent('gp-loading-end'));
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedDates = useMemo(
    () => Object.keys(dayMap).sort((a, b) => b.localeCompare(a)),
    [dayMap]
  );

  return { dayMap, sortedDates, loading, error, tier, refetch: load };
}
