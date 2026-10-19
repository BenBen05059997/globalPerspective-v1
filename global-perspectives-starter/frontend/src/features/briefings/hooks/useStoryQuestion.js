import { fetchPredictionSnapshotByThread } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { hasOwnProbability } from '@/features/threads/lib/questionChips.js';

// The earliest still-open question with its own probability, or null. Fails empty and reports.
export function pickNextQuestion(snapshot, today = new Date().toISOString().slice(0, 10)) {
  const all = (snapshot?.scenarios || []).flatMap((s) => s.triggers || []);
  const open = all
    .filter((t) => hasOwnProbability(t) && t.deadline && t.deadline >= today && !['yes', 'no', 'void'].includes(t.state))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
  return open[0] || null;
}

// Memory-cached per thread for the tab: re-opening a slide does not refetch.
export function useStoryQuestion(threadId) {
  const { data } = useCachedQuery(threadId ? `story_question_${threadId}` : null, async () => {
    try {
      const res = await fetchPredictionSnapshotByThread(threadId);
      return res?.success ? pickNextQuestion(res.snapshot) : null;
    } catch (err) {
      reportFetchError('briefing-story-question', err);
      throw err;
    }
  });
  return data ?? null;
}
