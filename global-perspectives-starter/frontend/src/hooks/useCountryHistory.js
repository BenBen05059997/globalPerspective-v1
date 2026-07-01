import { useState, useEffect } from 'react';
import { fetchCountryHistory } from '../services/restProxy.js';

const CACHE_KEY = (name) => `gp_country_history_${name}`;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useCountryHistory(countryName) {
  const [snapshots, setSnapshots] = useState([]);
  const [driftNotes, setDriftNotes] = useState([]); // living-analysis 1b grounded "what changed" notes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!countryName) return;

    const cacheKey = CACHE_KEY(countryName);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, notes, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setSnapshots(Array.isArray(data) ? data : []);
          setDriftNotes(Array.isArray(notes) ? notes : []);
          return;
        }
      }
    } catch { /* malformed cache */ }

    setLoading(true);
    fetchCountryHistory(countryName)
      .then((res) => {
        if (res?.success && Array.isArray(res.snapshots)) {
          const sorted = [...res.snapshots].sort((a, b) => a.dateKey?.localeCompare(b.dateKey));
          const notes = Array.isArray(res.driftNotes) ? res.driftNotes : [];
          setSnapshots(sorted);
          setDriftNotes(notes);
          try { localStorage.setItem(cacheKey, JSON.stringify({ data: sorted, notes, ts: Date.now() })); } catch { /* storage full */ }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [countryName]);

  return { snapshots, driftNotes, loading, error };
}
