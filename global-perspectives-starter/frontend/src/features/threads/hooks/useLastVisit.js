import { useEffect, useState } from 'react';
import { resolveVisit, VISIT_KEY } from '@/features/threads/lib/storyGroups';

// useLastVisit — the "since your last visit" baseline for /weekly, kept in localStorage only (works
// signed out, no server data). Returns the baseline in ms, or null on a first-ever visit (the page
// then shows "Moving now"). A reload within 30 min keeps the same baseline (resolveVisit). Storage
// can be blocked or empty (private window): every access is wrapped, and the page just shows
// "Moving now" without a baseline.
function read() {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function write(v) {
  try { localStorage.setItem(VISIT_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function useLastVisit() {
  const [state] = useState(() => resolveVisit(read(), Date.now()));
  useEffect(() => {
    write(state.next);
    const touch = () => write({ prev: state.next.prev, last: Date.now() });
    const onHide = () => { if (document.visibilityState === 'hidden') touch(); };
    window.addEventListener('pagehide', touch);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', touch);
      document.removeEventListener('visibilitychange', onHide);
      touch();
    };
  }, [state]);
  return state.baseline;
}
