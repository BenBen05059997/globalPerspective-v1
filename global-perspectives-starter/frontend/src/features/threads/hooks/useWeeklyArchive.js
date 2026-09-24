import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchArchiveRange } from '@/shared/api/restProxy';
import { useAuth } from '@/shared/contexts/AuthContext';

const CACHE_KEY = 'gp_weekly_archive_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function useWeeklyArchive() {
  const { user } = useAuth();
  const [dayMap, setDayMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tier, setTier] = useState(null);
  // When this data was actually fetched (cache write or fresh fetch completion) — an honest
  // client-side "as of" stamp, not a fabricated per-record timestamp. The archive response has
  // no genuine per-day updatedAt field to thread through, so this is the fetch-completion time,
  // per STAGE0_FIXES_PLAN.md item (b).
  const [fetchedAt, setFetchedAt] = useState(null);

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
          setFetchedAt(cached.timestamp);
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
      const now = Date.now();
      setDayMap(data);
      setTier(resolvedTier);
      setFetchedAt(now);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          dayMap: data,
          tier: resolvedTier,
          uid: user?.uid || 'anon',
          timestamp: now,
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

  // Newest real content write across the archive. The "today" day can be a `source: latest`
  // snapshot whose own updatedAt is days old, so the page must never use fetch time instead.
  const dataUpdatedAt = useMemo(() => {
    let latest = null;
    for (const day of Object.values(dayMap)) {
      const t = Date.parse(day?.updatedAt);
      if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
    }
    return latest;
  }, [dayMap]);

  return { dayMap, sortedDates, loading, error, tier, fetchedAt, dataUpdatedAt, refetch: load };
}
