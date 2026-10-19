// Scoring model v2 — derive the legacy scalar (riskScore/riskLevel) + lead axis
// from a multi-dimensional risk vector.
//
// Kept BYTE-IDENTICAL across generators (newsCountryIntelligence,
// newsThreadAnalysis) and mirrors the frontend adapter in
// src/utils/riskTiers.js (headlineFromDimensions): the headline is the WORST
// axis, NEVER a weighted average. See SCORING_MODEL_V2_PLAN.md.

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];

// Coerce a bare number OR a { score } object into a clamped 0-100 integer, else
// null. CRITICAL: null / undefined / '' → null (NOT 0) so an unscored axis stays
// sparse — `Number(null)` is 0, which would silently fill every empty axis.
// An explicit 0 is preserved (assessed "no risk" ≠ "no signal").
function clampScore(v) {
  const raw = v && typeof v === 'object' ? v.score : v;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

// 0-100 → canonical tier (25/50/75 bands). null → null.
function tierFromScore(s) {
  if (s == null) return null;
  if (s >= 75) return 'high';
  if (s >= 50) return 'elevated';
  if (s >= 25) return 'moderate';
  return 'low';
}

// Coerce the LLM's raw dimensions into { axis: { score, why } | null } for all
// four axes. Sparsity is honored: a missing / unscoreable axis stays null
// (never a filler number). `why` is trimmed to a short grounding string.
function normalizeDimensions(raw) {
  const out = {};
  for (const axis of AXES) {
    const v = raw && typeof raw === 'object' ? raw[axis] : null;
    const score = clampScore(v);
    if (score == null) { out[axis] = null; continue; }
    const why = v && typeof v === 'object' && v.why ? String(v.why).trim().slice(0, 300) : null;
    out[axis] = { score, why };
  }
  return out;
}

// dimensions → { riskScore, riskLevel, lead } via the WORST axis (max).
// All null when no axis is scored.
function deriveRisk(dimensions) {
  const scored = AXES
    .map((axis) => ({ axis, score: dimensions && dimensions[axis] ? dimensions[axis].score : null }))
    .filter((x) => x.score != null);
  if (!scored.length) return { riskScore: null, riskLevel: null, lead: null };
  const lead = scored.reduce((m, x) => (x.score > m.score ? x : m));
  return { riskScore: lead.score, riskLevel: tierFromScore(lead.score), lead: lead.axis };
}

module.exports = { AXES, clampScore, tierFromScore, normalizeDimensions, deriveRisk };
