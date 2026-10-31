import { newestSnapshot } from '@/shared/lib/forecastFromView.js';

// countryForecast — the one forecast a country card shows deadlines from: the newest among the country's stories. `prediction_snapshot` answered
// "the newest forecast among these topic ids"; the record answers it per story (decision 0052), so each story is asked for the topics it holds and the newest wins.
//   topicIds            the card's topics, newest story first (the hook keeps 20)
//   topicIdToThreadId   Map topicId -> threadId of the entries the card was built from (a topic with no thread is not in the record's forecasts)
//   recordForecast(threadId, topicIds) -> { answered, snapshot }   shared/api/forecastViews.js
//   fetchAction(topicIds) -> { success, snapshot }                 the `prediction_snapshot` action
// All stories answered by the record: its newest snapshot (or null), no action call. Any story the record could not answer (stale views, unreadable file):
// the action for the whole list, as before. Returns the snapshot or null.
export async function countryForecast({ topicIds, topicIdToThreadId }, { recordForecast, fetchAction }) {
  const byThread = new Map();
  for (const topic of topicIds) {
    const thread = topicIdToThreadId.get(topic);
    if (thread) (byThread.get(thread) || byThread.set(thread, []).get(thread)).push(topic);
  }
  if (byThread.size) {
    const answers = await Promise.all([...byThread].map(([thread, topics]) => recordForecast(thread, topics)));
    if (answers.every((a) => a.answered)) return newestSnapshot(answers.map((a) => a.snapshot));
  }
  const res = await fetchAction(topicIds);
  return res?.success ? (res.snapshot || null) : null;
}
