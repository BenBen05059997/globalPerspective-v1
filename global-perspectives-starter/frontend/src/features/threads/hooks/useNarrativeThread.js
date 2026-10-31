import { fetchNarrativeThread } from '@/shared/api/restProxy';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
// dropRedatedRepeats is pure and shared (also with the Studio share Lambda): see shared/lib/dropRedatedRepeats.js
import { dropRedatedRepeats } from '@/shared/lib/dropRedatedRepeats.js';
import { viewEntriesToThread } from '@/features/threads/lib/viewEntries.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const views = makeRecordViews();

/**
 * The record's story view up to the day it was built for, plus the archive's entries after that day. The archive is only asked
 * for when the views are not fresh or the story has no view (decision 0050). No view yet: the archive alone. Pure, for tests.
 */
export function combineTimeline(view, archive) {
  const recorded = viewEntriesToThread(view);
  // the view's provisional entries (today's, before the nightly run) cover their day too: the archive adds only what is after it
  const through = [view?.builtFrom?.factsThrough, view?.builtFrom?.provisionalThrough].filter(Boolean).sort().at(-1);
  if (!recorded.length || !through) return archive;
  return [...recorded, ...archive.filter((e) => (e.date || '') > through)];
}

// Durable, by-ID timeline: the record's story view (decision 0042, step 4), which carries today's entries (provisional until the
// nightly run, 0050). A story with no view, or views that are not fresh (viewsFresh.js), also ask the archive (server scans the
// 90-day archive) for what the view has not caught up with, so deep-links survive long after a story ages out.
export function useNarrativeThread(threadId) {
  const key = threadId ? `gp_narrative_thread_v2_${threadId}` : null;
  const { data, loading, error } = useCachedQuery(key, async () => {
    const [view, { fresh }] = await Promise.all([
      views.fetchStoryView(threadId).catch((e) => { reportFetchError('story-view', e); return null; }),
      loadViewsFresh(),
    ]);
    const recorded = viewEntriesToThread(view);
    if (fresh && recorded.length) return dropRedatedRepeats(recorded); // the view carries today's entries: no action call
    const result = await fetchNarrativeThread(threadId);
    return dropRedatedRepeats(combineTimeline(view, Array.isArray(result?.data) ? result.data : []));
  }, { ttl: CACHE_TTL_MS, storage: 'session' });
  return {
    entries: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load thread') : null,
  };
}
