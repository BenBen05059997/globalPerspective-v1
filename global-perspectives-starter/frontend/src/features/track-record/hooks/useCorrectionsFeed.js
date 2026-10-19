import { fetchCorrectionsFeed } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

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
  const { data, loading, error } = useCachedQuery(CACHE_KEY, async () => {
    const res = await fetchCorrectionsFeed(limit);
    const notes = res?.success && Array.isArray(res.notes) ? res.notes : [];
    return { notes, total: Number(res?.total) || notes.length, gated: !!res?.gated };
  }, { ttl: CACHE_TTL, storage: 'local' });
  return {
    notes: data ? data.notes : (error ? [] : null),
    total: data?.total ?? 0,
    gated: data?.gated ?? false,
    loading,
    error: error?.message ?? null,
  };
}
