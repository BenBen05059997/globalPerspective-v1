import { useState, useEffect } from 'react';
import { fetchNarrativeThread } from '@/shared/api/restProxy';

const CACHE_KEY = (id) => `gp_narrative_thread_${id}`;

// The archive re-writes an old story under the current date (REVIEW F4, /weekly "new events
// today"), so the same headline can come back with a later date. Keep only its earliest
// appearance so a story's span and scrubber never claim news that didn't happen.
export function dropRedatedRepeats(entries) {
  if (!Array.isArray(entries)) return entries;
  const earliest = new Map();
  for (const e of entries) {
    const key = String(e?.title || '').trim().toLowerCase();
    if (!key) continue;
    const prev = earliest.get(key);
    if (!prev || String(e.date || '') < String(prev.date || '')) earliest.set(key, e);
  }
  return entries.filter((e) => {
    const key = String(e?.title || '').trim().toLowerCase();
    return !key || earliest.get(key) === e;
  });
}
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
          setEntries(dropRedatedRepeats(cached.entries));
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
        const data = dropRedatedRepeats(Array.isArray(result?.data) ? result.data : []);
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
