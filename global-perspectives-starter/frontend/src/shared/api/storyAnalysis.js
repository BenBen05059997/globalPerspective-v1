// One story's analysis, the record first (decision 0042): the story view's `analysis`; a story whose view is missing,
// merged away or carries no analysis yet falls back to the `thread_analysis` action. A view fetch failure is
// reported and falls back too. Lists of many stories (weekly page, map, board) stay on the action.
import { fetchThreadAnalyses } from '@/shared/api/restProxy.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { analysisFromView } from '@/shared/lib/viewAnalysis.js';

const defaultViews = makeRecordViews();

/** The story's analysis item (as the action returns it), or null when neither source has one. */
export async function fetchStoryAnalysis(threadId, { views = defaultViews, fetchAction = fetchThreadAnalyses } = {}) {
  const view = await views.fetchStoryView(threadId).catch((e) => { reportFetchError('story-view-analysis', e); return null; });
  const fromView = analysisFromView(view);
  if (fromView) return fromView;
  const result = await fetchAction([threadId]);
  return result?.data?.[threadId] ?? null;
}
