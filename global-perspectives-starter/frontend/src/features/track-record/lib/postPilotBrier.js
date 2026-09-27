// postPilotBrier — the Brier score computed ONLY from post-pilot resolved items (see
// pilotExclusion.js). The backend's `prediction_track_record.brierScore` blends every v1
// resolution ever made, pilot included, and — once new-method scoring resumes — will keep
// blending old pilot items in forever (a real backend gap, D6). Recomputing client-side from the
// `recent` array's own `probability`/`verdict` fields, restricted to items that pass splitPilot's
// postPilot filter, is more honest and needs no backend change: `recent` returns newest-first, so
// once new resolutions land they push the pilot's items out of the returned window anyway.
export function computeBrier(items) {
  const scored = (items || []).filter(
    (r) => (r.verdict === 'fired' || r.verdict === 'not_fired') && typeof r.probability === 'number',
  );
  if (!scored.length) return null;
  const sum = scored.reduce((s, r) => s + (r.probability - (r.verdict === 'fired' ? 1 : 0)) ** 2, 0);
  return Math.round((sum / scored.length) * 1000) / 1000;
}
