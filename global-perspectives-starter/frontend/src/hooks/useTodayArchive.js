import { useEffect, useState, useCallback } from 'react';
import { graphqlService } from '../utils/graphqlService';

const CACHE_KEY = 'today_archive_cache_v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

export function useTodayArchive() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadArchive = useCallback(async () => {
    setError(null);

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const isFresh = cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
        if (isFresh && Array.isArray(cached?.entries) && cached.entries.length > 0) {
          setEntries(cached.entries);
          setUpdatedAt(cached.updatedAt || null);
          return;
        }
      }
    } catch {
      // ignore
    }

    setLoading(true);
    try {
      const data = await graphqlService.getTodayArchive();
      setEntries(data.entries);
      setUpdatedAt(data.updatedAt);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          entries: data.entries,
          timestamp: Date.now(),
          updatedAt: data.updatedAt,
        }));
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch today archive');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  return { entries, loading, error, updatedAt, refetch: loadArchive };
}
