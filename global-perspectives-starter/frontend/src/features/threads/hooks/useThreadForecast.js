import { useState, useEffect } from 'react';
import { recordForecast } from '@/shared/api/forecastViews.js';

/**
 * useThreadForecast — the "Living forecast" board data for a story.
 * Reads the record only (decisions 0042, 0043, 0052): `recordForecast` asks the story's forecasts view while the views are fresh (the manifest's
 * freshness rule, 0050) and maps its forks to the snapshot shape for the page's topicIds. The view keeps each forecast with the story it was drawn
 * for, so a topic moved in from another story no longer brings that story's forecast (operator, 2026-10-31).
 * Honest-empty (snapshot: null) when the story drew no question, has no thread, or the record cannot answer (stale views, unreadable file: reported
 * by `recordForecast` / `loadViewsFresh`, not on every render).
 * `topicIds` null (not an empty list) asks for the story's forecast whatever its topics: a story with a forecast but no entries on record has no
 * topics of its own to name, and still has its forecast.
 * Returns: { snapshot, loading }
 */
export function useThreadForecast(topicIds, threadId) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const whole = topicIds === null;
  const key = whole ? '*' : Array.isArray(topicIds) ? topicIds.filter(Boolean).join(',') : '';

  useEffect(() => {
    if (!key || !threadId) { setSnapshot(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    recordForecast(threadId, key === '*' ? null : key.split(','))
      .then((r) => { if (live) setSnapshot(r.snapshot || null); })
      .catch(() => { if (live) setSnapshot(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key, threadId]);

  return { snapshot, loading };
}
