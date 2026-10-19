import { fetchWebIndex } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// useWebIndex — the whole story-web index (`web_index`, newsSystemsAnalysis): every link, every
// story's state and the coverage, in ONE public read shared by every surface (story mode, the long
// story page, the home map's selected story). Memory-cached for 30 minutes.
// Returns { index, loading, failed }:
//   index   the index object, or null when no index has been built yet
//   failed  true when the request itself failed (an older proxy, offline): callers may fall back
const TTL_MS = 30 * 60 * 1000;

async function loadWebIndex() {
  try {
    const res = await fetchWebIndex();
    if (!res || res.success === false) throw new Error(res?.error || 'web_index failed');
    return res.data || null;
  } catch (err) {
    reportFetchError('web-index', err);
    throw err;
  }
}

export function useWebIndex(enabled = true) {
  const { data, loading, error } = useCachedQuery(enabled ? 'web_index' : null, loadWebIndex, { ttl: TTL_MS });
  return { index: data ?? null, loading, failed: Boolean(error) };
}
