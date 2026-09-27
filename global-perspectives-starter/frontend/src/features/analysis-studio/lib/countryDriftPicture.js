// imported by Node tooling outside src/ — keep relative imports
// "What changed" lens picture (S5c F1, monitor round 2) — built from the REAL
// `country_history` proxy data (fetchCountryHistory, shared/api/restProxy.js) for the
// selected stories' own countries: dated snapshots (riskScore + per-axis dimensions) and
// grounded drift notes. Never a placeholder — this replaces the earlier version, which only
// had access to a single opaque DRIFT citation string and had to fail empty.
import { buildRiskSeries } from './whatChangedPicture.js';
import { checkDirectionInText } from './directionCheck.js';

// buildCountryRiskSeries(snapshots) -> { points, gaps } — the risk chart, dated, WITH GAPS
// (whatChangedPicture.buildRiskSeries already never interpolates across a gap).
export function buildCountryRiskSeries(snapshots) {
  const points = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && typeof s.dateKey === 'string' && typeof s.riskScore === 'number' && Number.isFinite(s.riskScore))
    .map((s) => ({ date: s.dateKey, score: s.riskScore }));
  return buildRiskSeries(points);
}

// buildCountryChangeLog(driftNotes) -> [{ date, text, eventTitle, eventDate, flags }]
// newest first. `flags` (checkDirectionInText) is a per-clause wording/direction mismatch —
// a flag, never an auto-correction (feedback_no_misinformation_fallback) — computed straight
// from the note's own `whyChanged` prose, so it needs no separate snapshot lookup and catches
// a note that contradicts ITSELF (the real Iran 2026-08-19 case: "shifts the humanitarian
// score down as trade disruption worsens civilian conditions").
export function buildCountryChangeLog(driftNotes) {
  return (Array.isArray(driftNotes) ? driftNotes : [])
    .filter((n) => n && typeof n.whyChanged === 'string' && n.whyChanged.trim())
    .map((n) => ({
      date: n.asOf || null,
      text: n.whyChanged,
      eventTitle: n.triggerEvent?.title || null,
      eventDate: n.triggerEvent?.date || null,
      flags: checkDirectionInText(n.whyChanged),
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
