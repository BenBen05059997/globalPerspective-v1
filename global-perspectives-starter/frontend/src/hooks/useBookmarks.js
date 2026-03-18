import { useState, useCallback, useMemo } from 'react';

const KEY = 'gp_bookmarks_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(load);

  const bookmarkSet = useMemo(
    () => new Set(bookmarks.map(b => b.threadId)),
    [bookmarks]
  );

  const toggle = useCallback((thread) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.threadId === thread.threadId);
      const next = exists
        ? prev.filter(b => b.threadId !== thread.threadId)
        : [...prev, {
            threadId: thread.threadId,
            title: thread.latestTitle,
            category: thread.entries?.[0]?.category,
            savedAt: Date.now(),
          }];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (threadId) => bookmarkSet.has(threadId),
    [bookmarkSet]
  );

  return { bookmarks, toggle, isBookmarked };
}
