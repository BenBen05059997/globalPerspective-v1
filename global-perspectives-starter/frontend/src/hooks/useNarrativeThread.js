import { useState, useEffect } from 'react';
import { fetchNarrativeThread } from '../services/restProxy';

const CACHE_KEY = (id) => `gp_narrative_thread_${id}`;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Durable, by-ID timeline reconstruction (server scans the 90-day archive).
// This is the source of truth for a thread page — independent of the 30-day
// rolling archive the rest of the site loads, so deep-links survive long after
// a story's articles age out of the recent window.
export function useNarrativeThread(threadId) {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!threadId) { setLoading(false); return; }
    let cancelled = false;

    try {
      const raw = sessionStorage.getItem(CACHE_KEY(threadId));
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS && Array.isArray(cached.entries)) {
          setEntries(cached.entries);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    fetchNarrativeThread(threadId)
      .then(result => {
        if (cancelled) return;
        const data = Array.isArray(result?.data) ? result.data : [];
        setEntries(data);
        try {
          sessionStorage.setItem(CACHE_KEY(threadId), JSON.stringify({ entries: data, timestamp: Date.now() }));
        } catch { /* ignore */ }
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load thread'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [threadId]);

  return { entries, loading, error };
}
