import { useState, useEffect } from 'react';
import { fetchPredictionSnapshot } from '@/shared/api/restProxy.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { viewForecast } from '@/features/threads/lib/viewForecast.js';

const views = makeRecordViews();

/**
 * useThreadForecast — the "Living forecast" board data for a story.
 * Reads the record's story view first (decisions 0042, 0043: forks with question, scoring and state), mapped by
 * `viewForecast` to the snapshot shape for the page's topicIds; falls back to the `prediction_snapshot` action when the
 * view yields nothing. The view keeps each forecast with the story it was drawn for, so a topic moved in from another
 * story no longer brings that story's forecast (operator, 2026-10-31). Honest-empty (snapshot: null) when neither has one.
 * Returns: { snapshot, loading }
 */
export function useThreadForecast(topicIds, threadId) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const key = Array.isArray(topicIds) ? topicIds.filter(Boolean).join(',') : '';

  useEffect(() => {
    if (!key) { setSnapshot(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    const ids = key.split(',');
    (async () => {
      let fromView = null;
      if (threadId) {
        try { fromView = viewForecast(await views.fetchStoryView(threadId), { topicIds: ids }); } catch (e) { reportFetchError('story-view-forecast', e); }
      }
      if (fromView) return fromView;
      const res = await fetchPredictionSnapshot(ids);
      return res?.success ? (res.snapshot || null) : null;
    })()
      .then((s) => { if (live) setSnapshot(s); })
      .catch(() => { if (live) setSnapshot(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key, threadId]);

  return { snapshot, loading };
}
