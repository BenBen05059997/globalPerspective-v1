import { useState, useEffect } from 'react';
import { fetchPredictionSnapshot } from '../services/restProxy.js';

/**
 * useThreadForecast — the Phase 4 "Living forecast" board data for a thread.
 * Given the thread's topicIds, returns the newest methodologyVersion>=1 prediction
 * snapshot among them (scenarios + dated triggers with verdicts). Honest-empty
 * (snapshot: null) when the thread has no v1 forecast.
 * Returns: { snapshot, loading }
 * snapshot: { topicId, title, generatedAt, status, scenarios[{ label, probability,
 *   triggers[{ id, text, deadline, verdict('fired'|'not_fired'|'unclear'|null),
 *   confirmedBy, citation }] }] }
 */
export function useThreadForecast(topicIds) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const key = Array.isArray(topicIds) ? topicIds.filter(Boolean).join(',') : '';

  useEffect(() => {
    if (!key) { setSnapshot(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetchPredictionSnapshot(key.split(','))
      .then((res) => { if (live) setSnapshot(res?.success ? (res.snapshot || null) : null); })
      .catch(() => { if (live) setSnapshot(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key]);

  return { snapshot, loading };
}
