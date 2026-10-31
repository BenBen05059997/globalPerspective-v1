import { useEffect, useMemo, useState } from 'react';
import { fetchSystemsAnalysis } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { deriveFedInto, deriveFedFrom } from '@/features/threads/lib/storyLinks.js';
import { deriveFromIndex } from '@/features/threads/lib/webIndexLinks.js';
import { linkNote } from '@/features/threads/lib/linkStates.js';
import { useWebIndex } from '@/features/threads/hooks/useWebIndex.js';
import { indexFromView, viewHasLinks, needsTargets } from '@/features/threads/lib/linksFromView.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const views = makeRecordViews();
const VIEW_TTL_MS = 30 * 60 * 1000;

// The story's links view, or null when it is not generated (404). A failed read is reported and thrown (not cached).
function loadLinksView(threadId) {
  return views.fetchLinksView(threadId).catch((err) => { reportFetchError('links-view', err); throw err; });
}

const MAX_REGIONS = 3; // legacy fallback only: each region is one systems-analysis fetch

// Legacy path (before the index existed): the story's own regions' systems graphs, up to MAX_REGIONS
// fetches. Used ONLY when the `web_index` request itself fails (an older proxy), never as a default.
function useLegacyLinks(threadId, regions, enabled) {
  const [out, setOut] = useState({ fedInto: [], fedFrom: [], loading: false });
  const regionKey = Array.isArray(regions) ? regions.slice(0, MAX_REGIONS).join('|') : '';
  useEffect(() => {
    if (!enabled || !threadId || !regionKey) { setOut({ fedInto: [], fedFrom: [], loading: false }); return undefined; }
    let cancelled = false;
    setOut((o) => ({ ...o, loading: true }));
    Promise.allSettled(regionKey.split('|').filter(Boolean).map((country) => fetchSystemsAnalysis(country).then((res) => (
      res?.success && res.data ? { country, ...res.data } : null
    ))))
      .then((results) => {
        if (cancelled) return;
        const records = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) records.push(r.value);
          else if (r.status === 'rejected') reportFetchError('story-mode-fed-into', r.reason);
        }
        setOut({ fedInto: deriveFedInto(threadId, records), fedFrom: deriveFedFrom(threadId, records), loading: false });
      })
      .finally(() => { if (!cancelled) setOut((o) => ({ ...o, loading: false })); });
    return () => { cancelled = true; };
  }, [threadId, regionKey, enabled]);
  return out;
}

/**
 * useStoryLinks(threadId, regions) — the FED INTO slide's data: this story's links from the record's links view
 * (`judgedLinks` + `web`, decision 0042; `linksFromView` makes it index-shaped), plus its state and the honest
 * empty-state wording. A story whose view is missing, failed to load or lacks `web` falls back to the `web_index`
 * action (ONE cached read shared with every other surface), and that to the old per-region reads if it fails too.
 * The view has no run-wide `targets.count`; the action is asked for it only in the country_not_analysed state.
 * Fails empty: nothing is invented when no source has the story.
 * Returns { fedInto, fedFrom, shared, hiddenOlder, provenance, loading, state, note, index, meta }.
 */
export function useStoryLinks(threadId, regions) {
  const { data: view, loading: viewLoading } = useCachedQuery(threadId ? `gp_links_view_v1_${threadId}` : null, () => loadLinksView(threadId), { ttl: VIEW_TTL_MS });
  const viewSettled = Boolean(threadId) && !viewLoading;
  const fromView = viewSettled && viewHasLinks(view) && view.threadId === threadId;
  const { index: actionIndex, loading: actionLoading, failed } = useWebIndex(viewSettled && (!fromView || needsTargets(view)));
  const legacy = useLegacyLinks(threadId, regions, failed && !fromView);

  const index = useMemo(() => (fromView ? indexFromView(view, actionIndex?.targets) : actionIndex), [fromView, view, actionIndex]);
  const loading = !threadId ? false : !viewSettled || ((!fromView || needsTargets(view)) && actionLoading);
  const derived = useMemo(() => (threadId && !loading && !(failed && !fromView) ? deriveFromIndex(index, threadId) : null), [index, threadId, loading, failed, fromView]);

  if (failed && !fromView && !loading) return { fedInto: legacy.fedInto, fedFrom: legacy.fedFrom, shared: [], hiddenOlder: 0, provenance: null, loading: legacy.loading, state: null, note: null, index: null, meta: null };
  if (!derived) return { fedInto: [], fedFrom: [], shared: [], hiddenOlder: 0, provenance: null, loading: Boolean(threadId), state: null, note: null, index: null, meta: null };
  return {
    fedInto: derived.fedInto, fedFrom: derived.fedFrom, shared: derived.shared, hiddenOlder: derived.hiddenOlder, provenance: derived.provenance, loading: false, state: derived.state, index, meta: derived.meta,
    note: linkNote({ index, state: derived.state, meta: derived.meta }),
  };
}
