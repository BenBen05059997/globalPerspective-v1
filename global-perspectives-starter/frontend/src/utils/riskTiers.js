// Single source of truth for risk BAND semantics — score → tier and level → tier.
//
// Thresholds mirror the backend newsThreadAnalysis prompt calibration
// (25 / 50 / 75), which is how the LLM assigns riskScore in the first place.
// Colors live in tokens.js / styles/tokens.css — this module is semantics only.
//
// Canonical tiers (4):  low 0-24 · moderate 25-49 · elevated 50-74 · high 75-100.
//
// Historically three call sites each invented their own bands — tokens.js
// riskScoreToVar (75/50, no "moderate"), RiskScoreBadge (70/40), and a
// moderate→elevated string alias — so a score of 72 read "high" in one place and
// "elevated" in another, and "moderate" always rendered as orange "elevated".
// This collapses all three onto the canonical definition.

export const TIERS = ['low', 'moderate', 'elevated', 'high'];

// Sort rank — most severe first (high 0 … low 3). Matches the old local
// RISK_ORDER in CountryListPage so existing sorts are unchanged.
export const TIER_ORDER = { high: 0, elevated: 1, moderate: 2, low: 3 };

// riskScore (0-100) → canonical tier. null / non-numeric → null.
export function tierFromScore(score) {
  if (score == null) return null;
  const n = Number(score);
  if (Number.isNaN(n)) return null;
  if (n >= 75) return 'high';
  if (n >= 50) return 'elevated';
  if (n >= 25) return 'moderate';
  return 'low';
}

// Free-form riskLevel string → canonical tier. Normalizes provider synonyms and
// FIXES the long-standing moderate→elevated aliasing bug (moderate is its own
// tier now). Unknown / empty → null.
export function tierFromLevel(level) {
  const l = String(level ?? '').toLowerCase().trim();
  if (!l) return null;
  if (l === 'high' || l === 'critical' || l === 'severe') return 'high';
  if (l === 'elevated') return 'elevated';
  if (l === 'moderate' || l === 'medium') return 'moderate';
  if (l === 'low' || l === 'minimal') return 'low';
  return null;
}

// Uppercase display label for a tier. null → em dash.
export function tierLabel(tier) {
  return tier ? tier.toUpperCase() : '—';
}

// ---------------------------------------------------------------------------
// Scoring model v2 — multi-dimensional risk (SCORING_MODEL_V2_PLAN.md).
//
// A record may carry a `dimensions` vector (new) and/or the legacy scalar
// riskScore/riskLevel (always written, derived from the vector in Phase B).
// This adapter is the single seam: it yields ONE headline for both shapes, so
// consumers migrate lazily. Headline = the WORST axis + its label (never a
// weighted average); breadth flag = how many axes are elevated.
// ---------------------------------------------------------------------------

// Canonical axis vocabulary (order = display order).
export const AXES = ['conflict', 'political', 'economic', 'humanitarian'];
export const AXIS_LABELS = {
  conflict: 'Conflict',
  political: 'Political',
  economic: 'Economic',
  humanitarian: 'Humanitarian',
};

// An axis with score >= this reads "elevated" (matches the elevated band).
export const AXIS_ELEVATED = 50;
// Surface the compound breadth flag when at least this many axes are elevated.
export const BREADTH_MIN = 3;

// Pull a numeric 0-100 out of an axis value that may be a bare number or a
// { score, why } object. Anything else → null.
function axisScore(v) {
  if (v == null) return null;
  const raw = typeof v === 'object' ? v.score : v;
  if (raw == null || raw === '') return null; // {score:null}/empty is "no signal", not 0
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}
function axisWhy(v) {
  return v && typeof v === 'object' && v.why ? String(v.why) : null;
}

// The stable empty headline — same shape whether from an empty vector or a
// scalar-only record, so callers never branch on presence.
function emptyHeadline() {
  return { score: null, tier: null, leadAxis: null, leadLabel: null, breadth: 0, elevated: [], axes: [] };
}

// dimensions vector → headline. `dims` = { conflict: N|{score,why}, ... }.
// score = max axis, tier = its band, leadAxis = the argmax, breadth = # elevated.
// `axes` is the per-axis breakdown (sorted worst-first) for the scorecard UI.
export function headlineFromDimensions(dims) {
  if (!dims || typeof dims !== 'object') return emptyHeadline();
  const axes = AXES
    .map((axis) => ({ axis, label: AXIS_LABELS[axis], score: axisScore(dims[axis]), why: axisWhy(dims[axis]) }))
    .filter((a) => a.score != null)
    .map((a) => ({ ...a, tier: tierFromScore(a.score) }))
    .sort((a, b) => b.score - a.score);
  if (!axes.length) return emptyHeadline();
  const lead = axes[0];
  const elevated = axes.filter((a) => a.score >= AXIS_ELEVATED).map((a) => a.axis);
  return {
    score: lead.score,
    tier: lead.tier,
    leadAxis: lead.axis,
    leadLabel: lead.label,
    breadth: elevated.length,
    elevated,
    axes,
  };
}

// The migration entry point: one headline for any record shape. Prefers the
// `dimensions` vector; falls back to the legacy scalar (riskScore, then
// riskLevel) so pre-v2 records still render — with an empty `axes` breakdown.
export function deriveHeadline(record) {
  if (!record || typeof record !== 'object') return emptyHeadline();
  const fromVector = headlineFromDimensions(record.dimensions);
  if (fromVector.axes.length) return fromVector;
  const score = axisScore(record.riskScore);
  const tier = tierFromScore(score) ?? tierFromLevel(record.riskLevel);
  if (score == null && tier == null) return emptyHeadline();
  return { ...emptyHeadline(), score, tier };
}
