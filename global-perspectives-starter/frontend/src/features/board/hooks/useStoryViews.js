import { useEffect, useState } from 'react';
import { callBoard } from '@/features/board/lib/boardApi.js';
import { reportFetchError } from '@/shared/api/errorSink';
export function useStoryViews(pins) {
  const [state, setState] = useState({ stories: {}, errors: {}, loading: false });
  const key = pins.filter((p) => p.kind === 'thread').map((p) => p.refId).sort().join(',');
  useEffect(() => {
    let live = true;
    setState({ stories: {}, errors: {}, loading: !!key });
    Promise.all(key.split(',').filter(Boolean).map(async (id) => {
      try { return [id, await callBoard('story_view', { threadId: id }, { auth: false })]; }
      catch (error) { reportFetchError('board-story-view', error); return [id, { error: true }]; }
    })).then((rows) => {
      if (live) setState({ stories: Object.fromEntries(rows.filter(([, r]) => !r.error).map(([id, r]) => [id, r.story || null])), errors: Object.fromEntries(rows.filter(([, r]) => r.error)), loading: false });
    });
    return () => { live = false; };
  }, [key]);
  return state;
}
