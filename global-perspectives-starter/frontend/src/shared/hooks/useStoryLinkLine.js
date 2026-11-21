import { useMemo } from 'react';
import { useLinksView, useLinksViews } from '@/shared/api/linksView.js';
import { pickLinkLine } from '@/shared/lib/linkLine.js';

// useStoryLinkLine(id, aliasIds) — the one link line of a story (shared/lib/linkLine.js), from the links view of the story and of
// every record that stands for it: the survivor a merged story is an alias of, and the stories merged into it. The own view is the
// one useStoryLinks reads (same cache key). The judged link carries the other story's title. Null: no link, or still loading.
export function useStoryLinkLine(id, aliasIds = []) {
  const own = useLinksView(id);
  const others = [...new Set((aliasIds || []).filter((a) => a && a !== id))];
  const rest = useLinksViews(others);
  return useMemo(
    () => pickLinkLine([id, ...others], [own.data, ...(rest.data || [])]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, others.join(','), own.data, rest.data],
  );
}
