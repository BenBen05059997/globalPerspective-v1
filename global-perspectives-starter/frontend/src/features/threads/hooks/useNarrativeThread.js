import { fetchNarrativeThread } from '@/shared/api/restProxy';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
// dropRedatedRepeats is pure and shared (also with the Studio share Lambda): see shared/lib/dropRedatedRepeats.js
import { dropRedatedRepeats } from '@/shared/lib/dropRedatedRepeats.js';
import { viewEntriesToThread } from '@/features/threads/lib/viewEntries.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const views = makeRecordViews();

/**
 * The record's story view up to the day it was built for, plus the archive's entries after that day (the views are
 * rebuilt nightly, the archive by each agent run). No view yet: the archive alone. Pure, for tests.
 */
export function combineTimeline(view, archive) {
  const recorded = viewEntriesToThread(view);
  const through = view?.builtFrom?.factsThrough;
  if (!recorded.length || !through) return archive;
  return [...recorded, ...archive.filter((e) => (e.date || '') > through)];
}

// Durable, by-ID timeline: the record's story view (decision 0042, step 4) with the archive (server scans the 90-day
// archive) for what the view has not caught up with yet, so deep-links survive long after a story ages out.
export function useNarrativeThread(threadId) {
  const key = threadId ? `gp_narrative_thread_v2_${threadId}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const [view, result] = await Promise.all([
      views.fetchStoryView(threadId).catch((e) => { reportFetchError('story-view', e); return null; }),
      fetchNarrativeThread(threadId),
    ]);
    return dropRedatedRepeats(combineTimeline(view, Array.isArray(result?.data) ? result.data : []));
  }, { ttl: CACHE_TTL_MS, storage: 'session' });
  return {
    entries: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load thread') : null,
  };
}
