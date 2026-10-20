'use strict';

// Risk tier from a 0-100 score: one definition, the same bands as the frontend `shared/lib/riskTiers.js`
// (low 0-24, moderate 25-49, elevated 50-74, high 75-100). The backend copy of the bands is riskDimensions.js;
// this wraps it so a non-numeric score is null (riskDimensions alone would call NaN "low").
// The frontend file and riskDimensions.js are two copies of the same bands; no sync guard compares them yet
// (a later `scripts/check-shared-sync.mjs` item).

const { tierFromScore: bands } = require('../riskDimensions');

const TIER_BANDS = [{ tier: 'high', min: 75 }, { tier: 'elevated', min: 50 }, { tier: 'moderate', min: 25 }, { tier: 'low', min: 0 }];

/** 'low' | 'moderate' | 'elevated' | 'high' | null (null / undefined / '' / non-numeric score). */
function tierFromScore(score) {
  if (score === null || score === undefined || score === '') return null;
  const n = Number(score);
  return Number.isFinite(n) ? bands(n) : null;
}

module.exports = { tierFromScore, TIER_BANDS };
