// pilotExclusion — the 122 resolved triggers on record today were ALL confirmed in one 24 Jul
// scoring run against the flawed "score at scenario probability" method (TRACK_RECORD_AND_
// STUDIO_RULING.md: "The 122 become an archived pilot under a flawed method... No aggregate
// score shown"). This module draws the line, from the real `confirmedAt` timestamp, between
// pilot items and anything resolved after the pilot under the (still unbuilt) hybrid method —
// never a hand-picked ID list.
//
// PILOT_CUTOFF is exclusive-below: anything confirmed strictly before it is the pilot. The pilot
// run's own timestamp is 2026-07-24T22:22:14.709Z (verified live); the cutoff sits one day after
// it so a single shared confirmedAt across the whole run reads unambiguously as "before".
export const PILOT_CUTOFF = '2026-07-25T00:00:00.000Z';

export function isPilotItem(item) {
  const at = item?.confirmedAt;
  return typeof at === 'string' && at.length > 0 && at < PILOT_CUTOFF;
}

// Splits a `recent` (resolved-triggers) array into { pilot, postPilot }. `postPilot` is what the
// headline accuracy figures are computed from — the pilot is archived, never blended in.
export function splitPilot(recentItems) {
  const pilot = [];
  const postPilot = [];
  for (const item of recentItems || []) {
    (isPilotItem(item) ? pilot : postPilot).push(item);
  }
  return { pilot, postPilot };
}
