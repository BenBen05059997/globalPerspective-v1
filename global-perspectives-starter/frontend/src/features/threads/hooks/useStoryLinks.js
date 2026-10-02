import { useEffect, useMemo, useState } from 'react';
import { fetchSystemsAnalysis } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { deriveFedInto, deriveFedFrom } from '@/features/threads/lib/storyLinks.js';
import { deriveFromIndex } from '@/features/threads/lib/webIndexLinks.js';
import { linkNote } from '@/features/threads/lib/linkStates.js';
import { useWebIndex } from '@/features/threads/hooks/useWebIndex.js';

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
 * useStoryLinks(threadId, regions) — the FED INTO slide's data: this story's links from the story-web
 * index (ONE cached `web_index` read shared with every other surface), plus its state and the honest
 * empty-state wording. Fails empty: nothing is invented when the index is missing.
 * Returns { fedInto, fedFrom, shared, hiddenOlder, provenance, loading, state, note, index, meta }.
 */
export function useStoryLinks(threadId, regions) {
  const { index, loading: indexLoading, failed } = useWebIndex(Boolean(threadId));
  const legacy = useLegacyLinks(threadId, regions, failed);
  const derived = useMemo(() => (threadId && !failed && !indexLoading ? deriveFromIndex(index, threadId) : null), [index, threadId, failed, indexLoading]);

  if (failed) return { fedInto: legacy.fedInto, fedFrom: legacy.fedFrom, shared: [], hiddenOlder: 0, provenance: null, loading: legacy.loading, state: null, note: null, index: null, meta: null };
  if (!derived) return { fedInto: [], fedFrom: [], shared: [], hiddenOlder: 0, provenance: null, loading: Boolean(threadId), state: null, note: null, index: null, meta: null };
  return {
    fedInto: derived.fedInto, fedFrom: derived.fedFrom, shared: derived.shared, hiddenOlder: derived.hiddenOlder, provenance: derived.provenance, loading: false, state: derived.state, index, meta: derived.meta,
    note: linkNote({ index, state: derived.state, meta: derived.meta }),
  };
}
