// A story's forecast from the record while the views are fresh (decision 0052), in the shape `prediction_snapshot` returns. The pages that read a forecast
// without the story page (the briefing's next question, the country card's deadlines) ask here first and the action only when the record cannot answer.
//   answered: true  - the views are fresh (0050) and the forecasts view was read: a story with no file has drawn no question, and `snapshot` is null.
//   answered: false - the views are stale, the manifest or the file cannot be read (reported): the caller asks the action as it did before.
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { viewForecast, forecastOfThread } from '@/shared/lib/forecastFromView.js';

const views = makeRecordViews();

/**
 * recordForecast(threadId, topicIds?) -> { answered, snapshot }
 * topicIds: the topics the caller holds for the story (the forecast is the newest among them, as the action's); omitted = every topic the story drew a forecast for.
 * `fresh` and `getViews` are for tests.
 */
export async function recordForecast(threadId, topicIds = null, { fresh = loadViewsFresh, getViews = views } = {}) {
  if (!threadId) return { answered: false, snapshot: null };
  const { fresh: ok } = await fresh();
  if (!ok) return { answered: false, snapshot: null };
  try {
    const view = await getViews.fetchForecastsView(threadId);
    if (!view) return { answered: true, snapshot: null };
    return { answered: true, snapshot: topicIds ? viewForecast(view, { topicIds }) : forecastOfThread(view) };
  } catch (err) {
    reportFetchError('forecasts-view', err);
    return { answered: false, snapshot: null };
  }
}
