import { fetchPredictionTrackRecord } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * useTrackRecord — fetches the prediction calibration / track-record summary.
 * Returns: { data, loading, error }
 * data shape: { totalPredictionsLogged, totalDatedTriggers, resolvedTriggers,
 *   pendingTriggers, firedTriggers, brierScore, calibration[], recent[] }
 */
export function useTrackRecord() {
  const { data, loading, error } = useCachedQuery('gp_track_record', async () => {
    const res = await fetchPredictionTrackRecord();
    return res?.success && res.data ? res.data : undefined;
  }, { ttl: CACHE_TTL, storage: 'local' });
  return { data: data ?? null, loading, error: error?.message ?? null };
}
