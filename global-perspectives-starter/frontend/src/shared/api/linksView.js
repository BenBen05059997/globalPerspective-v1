import { reportFetchError } from '@/shared/api/errorSink';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// The story's links view (/data/record/views/links/<id>.json), cached 30 min and shared by every reader of one story: the story
// page's "fed into" slide (useStoryLinks) and the one link line (useStoryLinkLine) ask the same key, so a view is read once.
// `data` is null when the view is not generated (404); a failed read is reported and left as an error (not cached).
const views = makeRecordViews();
const VIEW_TTL_MS = 30 * 60 * 1000;

// The links views of several records at once (a story's merged-in stories, whose judged links sit on their own records). Same
// 30 min cache, one key per id set. `data` is the list of views, null where not generated.
export function useLinksViews(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  return useCachedQuery(
    list.length ? `gp_links_views_v1_${list.join(',')}` : null,
    () => Promise.all(list.map((id) => views.fetchLinksView(id))).catch((err) => { reportFetchError('links-view', err); throw err; }),
    { ttl: VIEW_TTL_MS },
  );
}

export function useLinksView(id) {
  return useCachedQuery(
    id ? `gp_links_view_v1_${id}` : null,
    () => views.fetchLinksView(id).catch((err) => { reportFetchError('links-view', err); throw err; }),
    { ttl: VIEW_TTL_MS },
  );
}
