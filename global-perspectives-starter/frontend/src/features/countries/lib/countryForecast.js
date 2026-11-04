import { newestSnapshot } from '@/shared/lib/forecastFromView.js';

// countryForecast — the one forecast a country card shows deadlines from: the newest among the country's stories. The record answers it per story
// (decision 0052), so each story is asked for the topics it holds and the newest wins.
//   topicIds            the card's topics, newest story first (the hook keeps 20)
//   topicIdToThreadId   Map topicId -> threadId of the entries the card was built from (a topic with no thread is not in the record's forecasts)
//   recordForecast(threadId, topicIds) -> { answered, snapshot }   shared/api/forecastViews.js (reports stale views and unreadable files itself)
// The record only. A story it cannot answer for (stale views, unreadable file) might hold the newest forecast, so when any story cannot answer
// there is no deadline at all - an older story's never stands in for it. Returns the newest snapshot or null.
export async function countryForecast({ topicIds, topicIdToThreadId }, { recordForecast }) {
  const byThread = new Map();
  for (const topic of topicIds) {
    const thread = topicIdToThreadId.get(topic);
    if (thread) (byThread.get(thread) || byThread.set(thread, []).get(thread)).push(topic);
  }
  if (!byThread.size) return null;
  const answers = await Promise.all([...byThread].map(([thread, topics]) => recordForecast(thread, topics)));
  if (answers.some((a) => !a.answered)) return null;
  return newestSnapshot(answers.map((a) => a.snapshot));
}
