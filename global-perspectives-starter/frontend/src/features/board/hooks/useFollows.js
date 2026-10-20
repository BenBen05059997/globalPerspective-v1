import { useCallback, useEffect, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { callBoard } from '@/features/board/lib/boardApi.js';

// Followed threads and actors (get_follows), with follow / unfollow for both. Fails empty.
export function useFollows(enabled) {
  const [follows, setFollows] = useState({ followedThreads: [], followedActors: [] });

  useEffect(() => {
    if (!enabled) { setFollows({ followedThreads: [], followedActors: [] }); return undefined; }
    let live = true;
    callBoard('get_follows')
      .then((f) => { if (live && f) setFollows({ followedThreads: f.followedThreads || [], followedActors: f.followedActors || [] }); })
      .catch((err) => reportFetchError('board-follows', err));
    return () => { live = false; };
  }, [enabled]);

  const run = useCallback(async (action, body) => {
    try {
      const f = await callBoard(action, body);
      setFollows({ followedThreads: f.followedThreads || [], followedActors: f.followedActors || [] });
      return true;
    } catch (err) {
      reportFetchError('board-follow', err);
      return false;
    }
  }, []);

  return {
    threads: follows.followedThreads,
    actors: follows.followedActors,
    followThread: (threadId) => run('follow_thread', { threadId }),
    unfollowThread: (threadId) => run('unfollow_thread', { threadId }),
    followActor: (name) => run('follow_actor', { name }),
    unfollowActor: (name) => run('unfollow_actor', { name }),
  };
}
