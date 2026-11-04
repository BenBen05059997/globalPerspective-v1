import { fetchCorrectionsFeed } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function loadFeed(limit) {
  try {
    const res = await fetchCorrectionsFeed(limit);
    if (!res?.success || !Array.isArray(res.notes)) throw new Error('corrections feed returned no notes');
    return { notes: res.notes, total: Number(res.total) || res.notes.length, gated: !!res.gated };
  } catch (err) {
    reportFetchError('corrections-feed', err);
    throw err;
  }
}

/**
 * useCorrectionsFeed — the site-wide "corrections ledger": recent grounded drift notes
 * across all countries + threads (the living-analysis loop's aggregate view).
 * Returns: { notes, total, gated, loading, error, refetch } — the server caps `notes` for non-members
 * and reports the honest full `total` + `gated`, so /track-record can show "Showing n of N".
 * A failed read is `error` (notes stays [] for old callers), never an empty ledger.
 * The server's cap follows the sign-in, so the cache is keyed by `limit` and by who is signed in
 * (uid, or anonymous): a member's full ledger is never served to the next reader.
 * note shape: { scope('country'|'thread'), name, threadId, asOf, changeLevel{from,to}?,
 *   changeScore{from,to}?, triggerEvent{title,date}?, whyChanged?, noSingleDriver }
 */
export function useCorrectionsFeed(limit = 40) {
  const { user } = useAuth();
  const key = `gp_corrections_feed:${limit}:${user?.uid || 'anon'}`;
  const { data, loading, error, refetch } = useCachedQuery(key, () => loadFeed(limit), { ttl: CACHE_TTL, storage: 'local' });
  return {
    notes: data ? data.notes : (error ? [] : null),
    total: data?.total ?? 0,
    gated: data?.gated ?? false,
    loading,
    error: error?.message ?? null,
    refetch,
  };
}
