'use strict';

// Pure, deterministic breaking-news significance scoring — no AWS, no I/O, so it
// unit-tests in isolation. Mirrors the style of newsRecommend/scoring.js.
//
// The unit of alerting is a STORY (a threadId), not a single topic. The caller
// aggregates the thread's topics + enrichment into a flat `signals` object:
//   signals = {
//     sourceCount,   // total sources across the thread's topics this cycle
//     topicCount,    // distinct topics under the thread this cycle (breadth)
//     riskScore,     // 0-100, max COUNTRY_INTELLIGENCE.riskScore over the regions
//     econMagnitude, // 'large' | 'moderate' | 'small' | null  (max over instruments)
//   }
//
// score = Σ weight·normalizedSignal. A story is "breaking" when score ≥ threshold.
// The threshold + weights are tuned via the dry-run log (see BREAKING_ALERTS_PLAN.md);
// `reasons[]` exists so the dry-run shows *why* each candidate qualified.

// Tunable weights — named constants, not magic numbers in the formula.
const WEIGHTS = Object.freeze({
  popularity: 1.0, // many outlets corroborating the same story
  breadth: 1.0, // story breaking across several simultaneous angles
  risk: 2.0, // country-level risk (war / crisis / collapse) dominates
  economic: 1.5, // market-moving magnitude
  velocity: 1.5, // rate of change — a story accelerating *now* (burst), not just loud
});

// A story alerts when its weighted score clears this. Deliberately set so that on an
// ordinary news day NOTHING clears it — silence is the correct output. Tune via dry-run.
const SIGNIFICANCE_THRESHOLD = 2.0;

// A *continuation* (an update to a story we've already covered) must clear a HIGHER bar
// than a brand-new event — it only re-alerts on genuine escalation (a strong velocity /
// magnitude delta), never on a story merely staying loud. This is the deterministic
// stand-in for First Story Detection: suppress unless the delta clears a raised bar.
const CONTINUATION_THRESHOLD_MULT = 1.8;

const MAGNITUDE_WEIGHT = Object.freeze({ large: 1.0, moderate: 0.6, small: 0.3 });

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// Source count squashed so a few extra outlets don't dominate. 10 sources ≈ 1.0.
function popularity(sourceCount) {
  const n = Number(sourceCount) || 0;
  return n <= 0 ? 0 : clamp01(Math.log10(1 + n) / Math.log10(11));
}

// Breadth: 1 topic = 0 (a single angle isn't "breaking breadth"); 4+ concurrent
// angles on one story ≈ 1.0.
function breadth(topicCount) {
  const k = Number(topicCount) || 0;
  return clamp01((k - 1) / 3);
}

function risk(riskScore) {
  return clamp01((Number(riskScore) || 0) / 100);
}

// scoring-model-v2: which risk DIMENSION a story's category feels. Fixes the
// country-risk *dominance* bug — an economic story in a war-torn country used to
// inherit that country's conflict-driven blended risk (weight 2.0) and over-alert.
// Now it feels the ECONOMIC axis instead. Unknown category → null → blended fallback.
const CATEGORY_AXIS = Object.freeze({
  conflict: 'conflict', security: 'conflict',
  politics: 'political', diplomacy: 'political',
  economy: 'economic',
  society: 'humanitarian', disaster: 'humanitarian', humanitarian: 'humanitarian',
});
function axisForCategory(category) {
  return CATEGORY_AXIS[String(category || '').toLowerCase()] || null;
}
// The 0-100 risk one region contributes to a story: the category-relevant dimension
// axis when present, else the legacy blended scalar (pre-v2 records / unmapped category).
function regionRiskScore(record, category) {
  const axis = axisForCategory(category);
  if (axis && record && record.dimensions) {
    const v = record.dimensions[axis];
    const n = Number(v && typeof v === 'object' ? v.score : v);
    if (Number.isFinite(n)) return n;
  }
  const blended = Number(record && record.riskScore);
  return Number.isFinite(blended) ? blended : 0;
}

function economic(magnitude) {
  return MAGNITUDE_WEIGHT[magnitude] || 0;
}

// Velocity in [0,1] — new angles/sources added THIS cycle vs the thread's prior size,
// squashed so ~5 new ≈ 1.0. This is the burst signal: a story going 2→8 in one cycle
// scores far above one sitting flat at 8.
function velocity(newThisCycle) {
  const n = Number(newThisCycle) || 0;
  return n <= 0 ? 0 : clamp01(Math.log10(1 + n) / Math.log10(6));
}

// Score one aggregated story. Returns the score, the normalized sub-signals, their
// weighted contributions, and human-readable reasons for the dry-run log.
function scoreStory(signals = {}, w = WEIGHTS) {
  const s = {
    popularity: popularity(signals.sourceCount),
    breadth: breadth(signals.topicCount),
    risk: risk(signals.riskScore),
    economic: economic(signals.econMagnitude),
    velocity: velocity(signals.velocity),
  };
  const contributions = {
    popularity: w.popularity * s.popularity,
    breadth: w.breadth * s.breadth,
    risk: w.risk * s.risk,
    economic: w.economic * s.economic,
    velocity: w.velocity * s.velocity,
  };
  const score = round3(
    contributions.popularity + contributions.breadth + contributions.risk + contributions.economic + contributions.velocity
  );

  const reasons = [];
  if (s.risk >= 0.5) reasons.push(`country risk ${signals.riskScore}/100`);
  if (s.economic >= 0.6) reasons.push(`${signals.econMagnitude} market impact`);
  if ((Number(signals.sourceCount) || 0) >= 6) reasons.push(`${signals.sourceCount} sources`);
  if ((Number(signals.topicCount) || 0) >= 3) reasons.push(`${signals.topicCount} concurrent angles`);
  if ((Number(signals.velocity) || 0) >= 3) reasons.push(`accelerating (+${signals.velocity} this cycle)`);

  return { score, signals: s, contributions, reasons };
}

// The bar a story must clear. A continuation faces a raised bar so it only re-alerts on
// real escalation (carried by the velocity/magnitude delta), never on staying loud.
function effectiveThreshold(base = SIGNIFICANCE_THRESHOLD, isContinuation = false) {
  const b = Number(base) || SIGNIFICANCE_THRESHOLD;
  return isContinuation ? b * CONTINUATION_THRESHOLD_MULT : b;
}

function isBreaking(result, threshold = SIGNIFICANCE_THRESHOLD) {
  return !!result && result.score >= threshold;
}

module.exports = {
  WEIGHTS,
  SIGNIFICANCE_THRESHOLD,
  CONTINUATION_THRESHOLD_MULT,
  MAGNITUDE_WEIGHT,
  scoreStory,
  isBreaking,
  effectiveThreshold,
  axisForCategory,
  regionRiskScore,
  // exported for tests
  _internals: { popularity, breadth, risk, economic, velocity, clamp01 },
};
