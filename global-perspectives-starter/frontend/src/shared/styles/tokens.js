// Single source of truth for risk + category colors across the app.
//
// Band SEMANTICS (score → tier) live in utils/riskTiers.js; this file is paint.
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

import { tierFromScore } from '@/shared/lib/riskTiers';

// ── Role tokens (JS mirror of tokens.css :root) ─────────────────────────────
// For canvas / deck.gl / inline-style code that cannot read CSS variables. Same values as the
// `--<name>` custom properties in tokens.css; __tests__/tokensParity.test.js fails if they drift.
export const TOKENS = {
  'bg': '#070d15',
  'panel': 'rgba(6, 12, 20, 0.95)',
  'panel-2': '#0b1622',
  'panel-3': '#101e2d',
  'strip': 'rgba(4, 8, 14, 0.92)',
  'hairline': 'rgba(95, 212, 255, 0.18)',
  'hairline-strong': 'rgba(95, 212, 255, 0.30)',
  'hairline-3': 'rgba(95, 212, 255, 0.45)',
  'text-head': '#eef5f9',
  'text-body': '#c9d6df',
  'text-muted': '#b9c7d1',
  'text-dim': '#7d8b96',
  'accent': '#5fd4ff',
  'accent-strong': '#8fe1ff',
  'accent-wash': 'rgba(95, 212, 255, 0.12)',
  'on-accent': '#06131c',
  'warn': '#ffb347',
  'ok': '#6fd29a',
  'error': '#ff6a4d',
  'hue-conflict': '#ee7754',
  'hue-political': '#9b8cf8',
  'hue-economic': '#38b6e0',
  'hue-humanitarian': '#d89e28',
  'tier-low': '#6fd29a',
  'tier-moderate': '#e8d56a',
  'tier-elevated': '#ffb347',
  'tier-high': '#ff6a4d',
};

// ── Risk ──────────────────────────────────────────────────────────────────

// Soft pastel badge palette ({ bg, text-color }) — used for risk pills/chips.
export const RISK_COLORS = {
  low:      { bg: '#d1fae5', color: '#065f46' },
  moderate: { bg: '#fef9c3', color: '#854d0e' },
  elevated: { bg: '#ffedd5', color: '#9a3412' },
  high:     { bg: '#fee2e2', color: '#991b1b' },
};

// Solid tier palette (single hex per level) — the --tier-* role tokens (the --risk-* aliases
// point at the same values), legible on the dark surfaces.
export const RISK_SOLID = {
  low:      TOKENS['tier-low'],
  moderate: TOKENS['tier-moderate'],
  elevated: TOKENS['tier-elevated'],
  high:     TOKENS['tier-high'],
};

// Canvas/gradient RGB-array palette. Note the 'critical' alias used by
// BriefingCard's gradient (no badge/solid equivalent).
export const RISK_RGB = {
  critical: [239, 68, 68],
  elevated: [249, 115, 22],
  moderate: [234, 179, 8],
  low:      [34, 197, 94],
};

// riskScore (0–100) → editorial CSS var. Bands come from the shared tier util
// (25/50/75, incl. "moderate"); this just maps tier → the --risk-* ramp.
const TIER_VAR = {
  high:     'var(--tier-high)',
  elevated: 'var(--tier-elevated)',
  moderate: 'var(--tier-moderate)',
  low:      'var(--tier-low)',
};
export const riskScoreToVar = (score) => {
  const tier = tierFromScore(score);
  return tier ? TIER_VAR[tier] : 'var(--text-head)';
};

// tier string → editorial CSS var (for when you already have a tier, not a score).
export const riskTierToVar = (tier) => (tier ? TIER_VAR[tier] : 'var(--text-head)');

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
