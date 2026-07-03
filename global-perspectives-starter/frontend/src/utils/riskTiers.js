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
