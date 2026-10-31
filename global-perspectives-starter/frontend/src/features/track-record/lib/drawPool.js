import { fetchPredictionTrackRecord } from '@/shared/api/restProxy.js';

// loadDrawPool — a week's published draw ({ K, pool, picked }) from the old `prediction_track_record` payload. Since decision 0052 the record view
// carries `draw` on each of the last drawn weeks whose pool the forecast facts reproduce, and the page uses that; this is the fallback for a week the
// view has no draw for (older than the last four, or one the facts cannot reproduce), asked when "Verify this draw" is pressed.
// Resolves null when the payload has no draw for that week.
export async function loadDrawPool(weekId) {
  const res = await fetchPredictionTrackRecord();
  const week = res?.success ? (res.data?.questions?.weeks || []).find((w) => w.weekId === weekId) : null;
  return week?.draw || null;
}
