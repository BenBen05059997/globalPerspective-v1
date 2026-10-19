import { fetchNarrativeThread } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
// dropRedatedRepeats is pure and shared (also with the Studio share Lambda): see shared/lib/dropRedatedRepeats.js
import { dropRedatedRepeats } from '@/shared/lib/dropRedatedRepeats.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Durable, by-ID timeline reconstruction (server scans the 90-day archive).
// This is the source of truth for a thread page — independent of the 30-day
// rolling archive the rest of the site loads, so deep-links survive long after
// a story's articles age out of the recent window.
export function useNarrativeThread(threadId) {
  const key = threadId ? `gp_narrative_thread_${threadId}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const result = await fetchNarrativeThread(threadId);
    return dropRedatedRepeats(Array.isArray(result?.data) ? result.data : []);
  }, { ttl: CACHE_TTL_MS, storage: 'session' });
  return {
    entries: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load thread') : null,
  };
}
