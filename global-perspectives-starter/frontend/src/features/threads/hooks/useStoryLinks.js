import { useState, useEffect } from 'react';
import { fetchSystemsAnalysis } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { deriveFedInto } from '@/features/threads/lib/storyLinks.js';

const MAX_REGIONS = 3; // cap the fan-out — each region is one systems-analysis fetch

/**
 * useStoryLinks(threadId, regions) — the FED INTO slide's data (stage 1 of the story-web plan:
 * frontend-only, reads the existing SYSTEMS#<place> graphs rather than a new endpoint). Fetches
 * the story's own regions' systems graphs (capped at MAX_REGIONS to bound the fan-out) and
 * derives this story's outgoing links. Honest-empty when nothing resolves — never a placeholder.
 */
export function useStoryLinks(threadId, regions) {
  const [fedInto, setFedInto] = useState([]);
  const [loading, setLoading] = useState(false);

  const regionKey = Array.isArray(regions) ? regions.slice(0, MAX_REGIONS).join('|') : '';

  useEffect(() => {
    if (!threadId || !regionKey) { setFedInto([]); return; }
    let cancelled = false;
    const countries = regionKey.split('|').filter(Boolean);
    setLoading(true);
    Promise.allSettled(countries.map((country) => fetchSystemsAnalysis(country).then((res) => (
      res?.success && res.data ? { country, ...res.data } : null
    ))))
      .then((results) => {
        if (cancelled) return;
        const records = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) records.push(r.value);
          else if (r.status === 'rejected') reportFetchError('story-mode-fed-into', r.reason);
        }
        setFedInto(deriveFedInto(threadId, records));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threadId, regionKey]);

  return { fedInto, loading };
}
