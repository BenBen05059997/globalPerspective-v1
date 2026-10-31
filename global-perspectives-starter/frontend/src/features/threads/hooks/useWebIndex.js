import { fetchWebIndex } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { webIndexFromView } from '@/features/threads/lib/webIndexFromView.js';

// useWebIndex — the whole story-web index: every link, every story's state and the coverage, in ONE public read shared
// by every surface (the Stories web view, the home map's selected story and arcs, the country page). The record's web
// view first (`index/web.json`, decision 0042); the `web_index` action (newsSystemsAnalysis) when the view is not
// generated or cannot be read (reported). Memory-cached for 30 minutes.
//   useWebIndex(enabled, { source: 'action' }) asks the action only: the view has no run `targets` (the country count
//   linkNote words one state with), so useStoryLinks reads it from there.
// Returns { index, loading, failed }:
//   index   the index object, or null when no index has been built yet
//   failed  true when the request itself failed (an older proxy, offline): callers may fall back
const TTL_MS = 30 * 60 * 1000;
const views = makeRecordViews();

async function loadFromAction() {
  try {
    const res = await fetchWebIndex();
    if (!res || res.success === false) throw new Error(res?.error || 'web_index failed');
    return res.data || null;
  } catch (err) {
    reportFetchError('web-index', err);
    throw err;
  }
}

async function loadWebIndex() {
  try {
    const index = webIndexFromView(await views.fetchWebIndexView());
    if (index) return index;
  } catch (err) {
    reportFetchError('web-index-view', err);
  }
  return loadFromAction();
}

export function useWebIndex(enabled = true, { source = 'view' } = {}) {
  const action = source === 'action';
  const { data, loading, error } = useCachedQuery(enabled ? (action ? 'web_index' : 'web_index_view') : null, action ? loadFromAction : loadWebIndex, { ttl: TTL_MS });
  return { index: data ?? null, loading, failed: Boolean(error) };
}
