// Single source of truth for risk + category colors across the app.
//
// Consolidates what were four divergent risk representations (pastel badge
// pairs, solid editorial hex, canvas RGB arrays, score→CSS-var) and three
// category maps, previously copy-pasted across ~10 components
// (see PRODUCT_IMPROVEMENT_PLAN.md → P2 "shared tokens").
//
// Hex values are unchanged from the originals, so visuals stay identical. The
// one intentional improvement: MapSidePanel now uses the full CATEGORY_DOT
// palette, so climate/science/business/society/energy markers get their real
// colors (matching WorldMap/WeeklyPage) instead of falling back to grey.

// ── Risk ──────────────────────────────────────────────────────────────────

// Soft pastel badge palette ({ bg, text-color }) — used for risk pills/chips.
export const RISK_COLORS = {
  low:      { bg: '#d1fae5', color: '#065f46' },
  moderate: { bg: '#fef9c3', color: '#854d0e' },
  elevated: { bg: '#ffedd5', color: '#9a3412' },
  high:     { bg: '#fee2e2', color: '#991b1b' },
};

// Solid editorial palette (single hex per level) — matches the --risk-* CSS
// vars in WorldMapV2.css (low/elevated/high), plus moderate.
export const RISK_SOLID = {
  low:      '#4fa07b',
  moderate: '#caa23a',
  elevated: '#d89540',
  high:     '#c94a33',
};

// Canvas/gradient RGB-array palette. Note the 'critical' alias used by
// BriefingCard's gradient (no badge/solid equivalent).
export const RISK_RGB = {
  critical: [239, 68, 68],
  elevated: [249, 115, 22],
  moderate: [234, 179, 8],
  low:      [34, 197, 94],
};

// riskScore (0–100) → editorial CSS var. Mirrors the WorldMapV2 --risk-* ramp.
export const riskScoreToVar = (score) => {
  if (score == null) return 'var(--ink)';
  if (score >= 75) return 'var(--risk-h)';
  if (score >= 50) return 'var(--risk-e)';
  return 'var(--risk-l)';
};

// ── Category ────────────────────────────────────────────────────────────────

// Pastel badge palette ({ bg, text-color }) for category chips.
export const CATEGORY_BADGE_COLORS = {
  conflict:   { bg: '#fee2e2', color: '#b91c1c' },
  military:   { bg: '#fee2e2', color: '#b91c1c' },
  disaster:   { bg: '#ffedd5', color: '#c2410c' },
  politics:   { bg: '#dbeafe', color: '#1d4ed8' },
  economy:    { bg: '#d1fae5', color: '#065f46' },
  technology: { bg: '#ede9fe', color: '#5b21b6' },
  health:     { bg: '#ccfbf1', color: '#0f766e' },
  climate:    { bg: '#d1fae5', color: '#047857' },
  science:    { bg: '#fae8ff', color: '#86198f' },
  business:   { bg: '#e0f2fe', color: '#0369a1' },
  society:    { bg: '#fef3c7', color: '#92400e' },
  energy:     { bg: '#fefce8', color: '#713f12' },
};

// Solid dot colors for map markers / legend swatches.
export const CATEGORY_DOT = {
  conflict:   '#ef4444',
  military:   '#ef4444',
  disaster:   '#f97316',
  politics:   '#3b82f6',
  economy:    '#22c55e',
  technology: '#8b5cf6',
  health:     '#14b8a6',
  climate:    '#10b981',
  science:    '#e879f9',
  business:   '#0ea5e9',
  society:    '#f59e0b',
  energy:     '#ca8a04',
  other:      '#6b7280',
};
