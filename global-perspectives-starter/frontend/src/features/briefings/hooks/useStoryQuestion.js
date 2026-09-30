import { useEffect, useState } from 'react';
import { fetchPredictionSnapshotByThread } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { hasOwnProbability } from '@/features/threads/lib/questionChips.js';

const cache = new Map(); // threadId -> question | null (module cache: re-opening a slide does not refetch)

// The earliest still-open question with its own probability, or null. Fails empty and reports.
export function pickNextQuestion(snapshot, today = new Date().toISOString().slice(0, 10)) {
  const all = (snapshot?.scenarios || []).flatMap((s) => s.triggers || []);
  const open = all
    .filter((t) => hasOwnProbability(t) && t.deadline && t.deadline >= today && !['yes', 'no', 'void'].includes(t.state))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
  return open[0] || null;
}

export function useStoryQuestion(threadId) {
  const [question, setQuestion] = useState(() => (threadId && cache.has(threadId) ? cache.get(threadId) : null));
  useEffect(() => {
    if (!threadId) { setQuestion(null); return undefined; }
    if (cache.has(threadId)) { setQuestion(cache.get(threadId)); return undefined; }
    let live = true;
    fetchPredictionSnapshotByThread(threadId)
      .then((res) => {
        const q = res?.success ? pickNextQuestion(res.snapshot) : null;
        cache.set(threadId, q);
        if (live) setQuestion(q);
      })
      .catch((err) => { reportFetchError('briefing-story-question', err); if (live) setQuestion(null); });
    return () => { live = false; };
  }, [threadId]);
  return question;
}
