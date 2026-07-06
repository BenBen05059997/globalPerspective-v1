import { useState, useEffect } from 'react';
import { fetchCorrectionsFeed } from '../services/restProxy.js';

const CACHE_KEY = 'gp_corrections_feed';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * useCorrectionsFeed — the site-wide "corrections ledger": recent grounded drift notes
 * across all countries + threads (the living-analysis loop's aggregate view).
 * Returns: { notes, total, gated, loading, error } — the server caps `notes` for non-members
 * and reports the honest full `total` + `gated`, so /track-record can show "Showing n of N".
 * note shape: { scope('country'|'thread'), name, asOf, changeLevel{from,to}?,
 *   changeScore{from,to}?, triggerEvent{title,date}?, whyChanged?, noSingleDriver }
 */
export function useCorrectionsFeed(limit = 40) {
  const [notes, setNotes] = useState(null);
  const [total, setTotal] = useState(0);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { notes: n, total: t, gated: g, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setNotes(n); setTotal(Number(t) || (Array.isArray(n) ? n.length : 0)); setGated(!!g);
          setLoading(false); return;
        }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchCorrectionsFeed(limit)
      .then((res) => {
        const n = res?.success && Array.isArray(res.notes) ? res.notes : [];
        const t = Number(res?.total) || n.length;
        const g = !!res?.gated;
        setNotes(n); setTotal(t); setGated(g);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ notes: n, total: t, gated: g, ts: Date.now() })); } catch { /* storage full */ }
      })
      .catch((err) => { setError(err.message); setNotes([]); })
      .finally(() => setLoading(false));
  }, [limit]);

  return { notes, total, gated, loading, error };
}
