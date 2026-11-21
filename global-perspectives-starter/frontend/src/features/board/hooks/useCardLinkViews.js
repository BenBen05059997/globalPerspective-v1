import { useEffect, useState } from 'react';
import { fetchStoryView, fetchLinksView } from '@/features/board/lib/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';

// The links views that stand for each story of a board, for the link sign's places (same rule as the story page: shared/lib/
// linkLine.js `pairPlaces`). A story whose own links view carries no web (a survivor: its judged links sit on the stories merged
// into it) also reads its story view for `merges` and those stories' links views.
// Returns { [id]: { ids: [id, ...merged ids], views: [links view, ...] } }; empty until read. A failed read is reported and the
// story has no places (an honest blank).
const mergedInto = (view, id) => [...new Set((Array.isArray(view?.merges) ? view.merges : []).filter((m) => m?.into === id && m.from).map((m) => m.from))];

export function useCardLinkViews(ids) {
  const [state, setState] = useState({});
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    let live = true;
    setState({});
    Promise.all(key.split(',').filter(Boolean).map(async (id) => {
      try {
        const own = await fetchLinksView(id);
        if (own?.web?.places?.length) return [id, { ids: [id], views: [own] }];
        const merged = mergedInto(await fetchStoryView(id), id);
        const rest = await Promise.all(merged.map((m) => fetchLinksView(m)));
        return [id, { ids: [id, ...merged], views: [own, ...rest] }];
      } catch (error) { reportFetchError('board-link-views', error); return [id, null]; }
    })).then((rows) => { if (live) setState(Object.fromEntries(rows.filter((r) => r[1]))); });
    return () => { live = false; };
  }, [key]);
  return state;
}
