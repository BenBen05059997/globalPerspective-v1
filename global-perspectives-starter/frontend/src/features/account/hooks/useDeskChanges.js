import { useEffect, useState } from 'react';
import { fetchCountryHistory } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';

// Fetch country_history for a batch of followed countries — capped at 3 concurrent requests
// (matches restProxy's own proxy concurrency cap; see reference_proxy_request_behavior). A
// single country's failure never blocks the others: it's reported to the error sink and
// surfaced per-row so the Desk can omit just that country's rows (CLAUDE.md: fail empty and
// report, don't fail the whole page).
const CONCURRENCY = 3;

function emptyResult(country) {
  return { country, snapshots: [], driftNotes: [], driftNotesGated: false, driftNotesTotal: 0, loading: true, error: null };
}

export function useDeskChanges(countries) {
  const list = Array.isArray(countries) ? countries : [];
  const key = list.slice().sort().join('|');
  const [results, setResults] = useState(() => list.map(emptyResult));
  const [loading, setLoading] = useState(list.length > 0);

  useEffect(() => {
    let cancelled = false;

    if (list.length === 0) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setResults(list.map(emptyResult));

    let idx = 0;
    async function worker() {
      while (idx < list.length) {
        const country = list[idx++];
        try {
          const res = await fetchCountryHistory(country);
          if (cancelled) return;
          const snapshots = Array.isArray(res?.snapshots) ? res.snapshots : [];
          const driftNotes = Array.isArray(res?.driftNotes) ? res.driftNotes : [];
          const driftNotesTotal = Number(res?.driftNotesTotal) || driftNotes.length;
          const driftNotesGated = !!res?.driftNotesGated;
          setResults((prev) => prev.map((r) => (r.country === country
            ? { ...r, snapshots, driftNotes, driftNotesTotal, driftNotesGated, loading: false }
            : r)));
        } catch (err) {
          if (cancelled) return;
          reportFetchError('desk-country-history', err);
          setResults((prev) => prev.map((r) => (r.country === country
            ? { ...r, loading: false, error: err?.message || 'Could not load' }
            : r)));
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker());
    Promise.all(workers).then(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable identity of `countries`
  }, [key]);

  return { results, loading };
}
