import { reportFetchError } from '@/shared/api/errorSink';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// The editorial category of a story (its crisis colour) from its story view, cached 30 min per story. Null: no id, still loading,
// not generated, or a failed read (reported). The link sign needs it for the OTHER story of a link, which the link does not carry.
const views = makeRecordViews();
const TTL_MS = 30 * 60 * 1000;

export function useStoryCategory(id) {
  const q = useCachedQuery(
    id ? `gp_story_category_v1_${id}` : null,
    () => views.fetchStoryView(id).then((v) => v?.category || null).catch((err) => { reportFetchError('story-category', err); throw err; }),
    { ttl: TTL_MS },
  );
  return q.data || null;
}
