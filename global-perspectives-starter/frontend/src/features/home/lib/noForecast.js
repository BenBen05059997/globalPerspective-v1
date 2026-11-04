// "This topic has no forecast" vs "not ready yet" (decision 0038: a forecast is drawn only when the story moved and its
// thread has no fork in the last 7 days, so most topics of a run have none). contentService cannot tell the two apart (a
// missing note and a cache miss both fail the same way), so the page asks the today view itself: the topic is in the latest
// run, the entry is of that run (it was published whole, notes included) and its notes carry no prediction.
import { loadTodayView } from '@/shared/api/todayView.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';

/** Pure. True when the view proves the latest run wrote this topic's notes and none of them is a forecast. */
export function viewHasNoForecast(view, topicId) {
  if (!view || view.schemaVersion !== 1 || !Array.isArray(view.entries) || !Array.isArray(view.latest?.topicIds)) return false;
  if (!view.latest.topicIds.includes(topicId)) return false;
  const entry = view.entries.find((e) => e.topicId === topicId);
  if (!entry || entry.generationId !== view.latest.generationId) return false;
  const notes = entry.notes;
  return Boolean(notes && typeof notes === 'object' && Object.keys(notes).length > 0 && !notes.prediction);
}

/** True only while the record's views are fresh and the today view shows no forecast for the topic; any doubt is false (then the page asks as before). */
export async function topicHasNoForecast(topicId, { fresh = loadViewsFresh, load = loadTodayView } = {}) {
  const { fresh: ok } = await fresh();
  return ok ? viewHasNoForecast(await load(), topicId) : false;
}
