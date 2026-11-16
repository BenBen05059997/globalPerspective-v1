'use strict';

// Risk tier from a 0-100 score: one definition, the same bands as the frontend `shared/lib/riskTiers.js`
// (low 0-24, moderate 25-49, elevated 50-74, high 75-100). The backend copy of the bands is riskDimensions.js;
// this wraps it so a non-numeric score is null (riskDimensions alone would call NaN "low").
// The frontend file and riskDimensions.js are two copies of the same bands; test/world.derive.test.js compares them
// at every integer score (scripts/check-shared-sync.mjs does not).

const { tierFromScore: bands } = require('../riskDimensions');

/** 'low' | 'moderate' | 'elevated' | 'high' | null (null / undefined / '' / non-numeric score). */
function tierFromScore(score) {
  if (score === null || score === undefined || score === '') return null;
  const n = Number(score);
  return Number.isFinite(n) ? bands(n) : null;
}

module.exports = { tierFromScore };
