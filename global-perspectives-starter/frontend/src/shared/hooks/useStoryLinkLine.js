import { useMemo } from 'react';
import { useLinksView } from '@/shared/api/linksView.js';
import { pickLinkLine } from '@/shared/lib/linkLine.js';

// useStoryLinkLine(id, aliasId) — the one link line of a story (shared/lib/linkLine.js), from the links view of the story and, for a
// merged story, of the story it is an alias of. The view is the one useStoryLinks reads (same cache key): no second request.
// The judged link carries the other story's title. Null: no link, or still loading.
export function useStoryLinkLine(id, aliasId = null) {
  const own = useLinksView(id);
  const target = useLinksView(aliasId && aliasId !== id ? aliasId : null);
  return useMemo(() => pickLinkLine([id, aliasId], [own.data, target.data]), [id, aliasId, own.data, target.data]);
}
