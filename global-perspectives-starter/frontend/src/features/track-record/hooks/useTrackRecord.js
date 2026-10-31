import { fetchPredictionTrackRecord } from '@/shared/api/restProxy.js';
import { fetchTrackRecordView } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { trackRecordFromView, isTrackRecordView } from '@/features/track-record/lib/trackRecordFromView.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// The record view first (decision 0044); the `prediction_track_record` action when the view is not generated or cannot be read.
async function loadTrackRecord() {
  try {
    const view = await fetchTrackRecordView();
    if (isTrackRecordView(view)) return trackRecordFromView(view);
  } catch (err) { reportFetchError('track-record-view', err); }
  const res = await fetchPredictionTrackRecord();
  return res?.success && res.data ? res.data : undefined;
}

/**
 * useTrackRecord — the track-record data: the weekly question scheme (`questions`) and the frozen pilot-era fields.
 * Returns: { data, loading, error }
 * data shape: { eraCutFrom, totalDatedTriggers, resolvedTriggers, legacyPredictionsExcluded, recent[], questions }
 * (the action's payload also carries totalPredictionsLogged, pendingTriggers, firedTriggers, brierScore, calibration[]; no page reads them).
 */
export function useTrackRecord() {
  const { data, loading, error } = useCachedQuery('gp_track_record', loadTrackRecord, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
