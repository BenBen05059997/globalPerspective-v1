import { fetchPredictionTrackRecord } from '@/shared/api/restProxy.js';

// loadDrawPool — a week's published draw ({ K, pool, picked }) from the old `prediction_track_record` payload. The record view
// holds the commitment, the seed and the picks but not the eligible pool, so "Verify this draw" asks for it when pressed.
// Resolves null when the payload has no draw for that week.
export async function loadDrawPool(weekId) {
  const res = await fetchPredictionTrackRecord();
  const week = res?.success ? (res.data?.questions?.weeks || []).find((w) => w.weekId === weekId) : null;
  return week?.draw || null;
}
