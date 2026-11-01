import { fetchTrackRecordView } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { trackRecordFromView, isTrackRecordView } from '@/features/track-record/lib/trackRecordFromView.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// The record view is the only source (decisions 0044, 0052). Missing, unreadable or of another shape: no data, so the page shows its honest empty state, and the sink hears of it once.
async function loadTrackRecord() {
  try {
    const view = await fetchTrackRecordView();
    if (isTrackRecordView(view)) return trackRecordFromView(view);
    reportFetchError('track-record-view', new Error(view ? 'track-record view has an unexpected shape' : 'track-record view not generated'));
  } catch (err) { reportFetchError('track-record-view', err); }
  return undefined;
}

/**
 * useTrackRecord — the track-record data: the weekly question scheme (`questions`) and the frozen pilot-era fields.
 * Returns: { data, loading, error }
 * data shape: { eraCutFrom, totalDatedTriggers, resolvedTriggers, legacyPredictionsExcluded, recent[], questions }
 */
export function useTrackRecord() {
  const { data, loading, error } = useCachedQuery('gp_track_record', loadTrackRecord, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
