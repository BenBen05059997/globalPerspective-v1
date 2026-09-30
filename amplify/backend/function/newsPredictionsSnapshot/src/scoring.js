'use strict';

// Scoring of the sampled questions. Pure: no AWS, no clock, no randomness beyond a fixed seed.
// Brier = mean((p - outcome)^2); the reference is a constant base-rate guess b = mean(outcome),
// Brier_ref = b(1-b); skill = 1 - Brier/Brier_ref. The 95% interval is a CLUSTER bootstrap by story
// (resample stories with replacement) with a fixed seed derived from n, so the published number
// does not jitter every 30 minutes.

const STAGE2_AT = 150;
const RESAMPLES = 2000;
const round = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

// items: [{ p (0-100), y (1|0), cluster }]
function brier(items) {
  if (!items.length) return null;
  return items.reduce((s, r) => s + (r.p / 100 - r.y) ** 2, 0) / items.length;
}

function skillOf(items) {
  const n = items.length;
  if (!n) return { brier: null, baseRate: null, brierRef: null, skill: null };
  const b = brier(items);
  const base = items.reduce((s, r) => s + r.y, 0) / n;
  const ref = base * (1 - base);
  return { brier: b, baseRate: base, brierRef: ref, skill: ref > 0 ? 1 - b / ref : null };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clusterBootstrap(items, resamples = RESAMPLES) {
  const byCluster = new Map();
  for (const r of items) { const a = byCluster.get(r.cluster) || []; a.push(r); byCluster.set(r.cluster, a); }
  const groups = [...byCluster.values()];
  const rnd = mulberry32(items.length * 2654435761);
  const skills = [];
  for (let i = 0; i < resamples; i++) {
    const draw = [];
    for (let k = 0; k < groups.length; k++) draw.push(...groups[Math.floor(rnd() * groups.length)]);
    const s = skillOf(draw).skill;
    if (s != null) skills.push(s);
  }
  if (skills.length < resamples * 0.5) return null;
  skills.sort((a, b) => a - b);
  const q = (p) => skills[Math.min(skills.length - 1, Math.floor(p * skills.length))];
  return { lo: round(q(0.025)), hi: round(q(0.975)), method: 'cluster bootstrap by story', resamples, seed: 'n*2654435761' };
}

// 10-point bins; a bin is returned only with n >= minN (default 20).
function reliability(items, minN = 20) {
  const bins = Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, hi: i * 10 + 10, n: 0, sumP: 0, yes: 0 }));
  for (const r of items) { const b = bins[Math.min(9, Math.floor(r.p / 10))]; b.n++; b.sumP += r.p / 100; b.yes += r.y; }
  return bins.filter((b) => b.n >= minN).map((b) => ({ bin: `${b.lo}-${b.hi}%`, n: b.n, meanP: round(b.sumP / b.n), rate: round(b.yes / b.n) }));
}

/**
 * @param {Array<{p:number,y:0|1,cluster:string}>} items resolved yes/no questions with a frozen p
 * @param {{voidCount:number}} extra
 * @returns null below 150 resolved (Stage 2), else the score block
 */
function computeScoring(items, { voidCount = 0 } = {}) {
  const n = items.length;
  if (n < STAGE2_AT) return null;
  const s = skillOf(items);
  return {
    n, brier: round(s.brier), baseRate: round(s.baseRate), brierRef: round(s.brierRef), skill: round(s.skill),
    ci: clusterBootstrap(items),
    voidRate: round(voidCount / (n + voidCount)),
    reliability: reliability(items),
  };
}

module.exports = { STAGE2_AT, RESAMPLES, brier, skillOf, clusterBootstrap, reliability, computeScoring };
