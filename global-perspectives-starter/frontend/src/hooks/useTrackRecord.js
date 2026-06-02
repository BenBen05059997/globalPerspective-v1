import { useState, useEffect } from 'react';
import { fetchPredictionTrackRecord } from '../services/restProxy.js';

const CACHE_KEY = 'gp_track_record';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * useTrackRecord — fetches the prediction calibration / track-record summary.
 * Returns: { data, loading, error }
 * data shape: { totalPredictionsLogged, totalDatedTriggers, resolvedTriggers,
 *   pendingTriggers, firedTriggers, brierScore, calibration[], recent[] }
 */
export function useTrackRecord() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setData(d); setLoading(false); return; }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchPredictionTrackRecord()
      .then((res) => {
        if (res?.success && res.data) {
          setData(res.data);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() })); } catch { /* storage full */ }
        } else {
          setData(null);
        }
      })
      .catch((err) => { setError(err.message); setData(null); })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
