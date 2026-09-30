import { useEffect, useState } from 'react';
import { fetchWebIndex } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';

// useWebIndex — the whole story-web index (`web_index`, newsSystemsAnalysis): every link, every
// story's state and the coverage, in ONE public read shared by every surface (story mode, the long
// story page, the home map's selected story). Module-cached for 30 minutes.
// Returns { index, loading, failed }:
//   index   the index object, or null when no index has been built yet
//   failed  true when the request itself failed (an older proxy, offline): callers may fall back
const TTL_MS = 30 * 60 * 1000;
let cache = null; // { at, index }
let inflight = null;

export function __resetWebIndexCache() { cache = null; inflight = null; }

export function loadWebIndex() {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.index);
  if (!inflight) {
    inflight = fetchWebIndex()
      .then((res) => {
        if (!res || res.success === false) throw new Error(res?.error || 'web_index failed');
        cache = { at: Date.now(), index: res.data || null };
        return cache.index;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useWebIndex(enabled = true) {
  const [state, setState] = useState(() => (cache ? { index: cache.index, loading: false, failed: false } : { index: null, loading: enabled, failed: false }));
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    loadWebIndex()
      .then((index) => { if (live) setState({ index, loading: false, failed: false }); })
      .catch((err) => { reportFetchError('web-index', err); if (live) setState({ index: null, loading: false, failed: true }); });
    return () => { live = false; };
  }, [enabled]);
  return state;
}
