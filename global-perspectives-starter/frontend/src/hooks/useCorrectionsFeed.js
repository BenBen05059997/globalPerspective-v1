import { useState, useEffect } from 'react';
import { fetchCorrectionsFeed } from '../services/restProxy.js';

const CACHE_KEY = 'gp_corrections_feed';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * useCorrectionsFeed — the site-wide "corrections ledger": recent grounded drift notes
 * across all countries + threads (the living-analysis loop's aggregate view).
 * Returns: { notes, loading, error }
 * note shape: { scope('country'|'thread'), name, asOf, changeLevel{from,to}?,
 *   changeScore{from,to}?, triggerEvent{title,date}?, whyChanged?, noSingleDriver }
 */
export function useCorrectionsFeed(limit = 40) {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { notes: n, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setNotes(n); setLoading(false); return; }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchCorrectionsFeed(limit)
      .then((res) => {
        const n = res?.success && Array.isArray(res.notes) ? res.notes : [];
        setNotes(n);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ notes: n, ts: Date.now() })); } catch { /* storage full */ }
      })
      .catch((err) => { setError(err.message); setNotes([]); })
      .finally(() => setLoading(false));
  }, [limit]);

  return { notes, loading, error };
}
