import { useEffect, useState } from 'react';
import { fetchStoryView, fetchLinksView } from '@/features/board/lib/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';

// Story and links views of the pinned threads, fetched straight from /data/record/views (public, no sign-in).
// A 404 is null ("not generated yet"); only other failures land in `errors` and the error sink.
export function useStoryViews(pins) {
  const [state, setState] = useState({ stories: {}, links: {}, errors: {}, loading: false });
  const key = pins.filter((p) => p.kind === 'thread').map((p) => p.refId).sort().join(',');
  useEffect(() => {
    let live = true;
    setState({ stories: {}, links: {}, errors: {}, loading: !!key });
    Promise.all(key.split(',').filter(Boolean).map(async (id) => {
      try { return [id, await fetchStoryView(id), await fetchLinksView(id)]; }
      catch (error) { reportFetchError('board-story-view', error); return [id, null, null, true]; }
    })).then((rows) => {
      if (!live) return;
      const ok = rows.filter((r) => !r[3]);
      setState({
        stories: Object.fromEntries(ok.map(([id, story]) => [id, story])),
        links: Object.fromEntries(ok.map(([id, , links]) => [id, links])),
        errors: Object.fromEntries(rows.filter((r) => r[3]).map(([id]) => [id, true])),
        loading: false,
      });
    });
    return () => { live = false; };
  }, [key]);
  return state;
}
