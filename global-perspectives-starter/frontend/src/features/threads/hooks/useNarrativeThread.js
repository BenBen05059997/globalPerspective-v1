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

/**
 * The builder's story-level stamps the story page shows (CONTRACT, SPEC §4): `born`, `stepCount`, `stepDays`, `firstStep`,
 * `newestStep`, and `outletCount` (the length of `sourceIds`, distinct outlets across all steps). A field the view lacks is null.
 */
export function storyStamp(view) {
  if (!view) return null;
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    id: typeof view.threadId === 'string' ? view.threadId : null, // the survivor's id: differs from the page's id for a merged story
    name: typeof view.name === 'string' ? view.name : null,
    born: view.born || null,
    stepCount: num(view.stepCount),
    stepDays: num(view.stepDays),
    firstStep: view.firstStep || null,
    newestStep: view.newestStep || null,
    outletCount: Array.isArray(view.sourceIds) ? view.sourceIds.length : null,
  };
}

// Durable, by-ID timeline: the record's story view (decision 0042, step 4), which carries today's entries (provisional until the
// nightly run, 0050). A story with no view, or views that are not fresh (viewsFresh.js), also ask the archive (server scans the
// 90-day archive) for what the view has not caught up with, so deep-links survive long after a story ages out.
// Returns { entries, title, loading, error, refetch }: `title` is the story view's own title, null when there is no view.
export function useNarrativeThread(threadId) {
  const key = threadId ? `gp_narrative_thread_v4_${threadId}` : null;
  const { data, loading, error, refetch } = useCachedQuery(key, async () => {
    const [view, { fresh }] = await Promise.all([
      views.fetchStoryView(threadId).catch((e) => { reportFetchError('story-view', e); return null; }),
      loadViewsFresh(),
    ]);
    const recorded = viewEntriesToThread(view);
    const title = view?.title || null; // the record's one title for the story (null: no view, or a story with no entries)
    const stamp = storyStamp(view);
    if (fresh && recorded.length) return { entries: dropRedatedRepeats(recorded), title, stamp }; // the view carries today's entries: no action call
    const result = await fetchNarrativeThread(threadId).catch((e) => { reportFetchError('narrative-thread', e); throw e; });
    const entries = dropRedatedRepeats(combineTimeline(view, Array.isArray(result?.data) ? result.data : []));
    return entries.length ? { entries, title, stamp } : undefined; // an empty answer is "not found" but is not kept: the story's view may appear soon
  }, { ttl: CACHE_TTL_MS, storage: 'session' });
  return {
    entries: data?.entries ?? null,
    title: data?.title ?? null,
    stamp: data?.stamp ?? null,
    loading,
    error: error ? (error.message || 'Failed to load thread') : null,
    refetch,
  };
}
