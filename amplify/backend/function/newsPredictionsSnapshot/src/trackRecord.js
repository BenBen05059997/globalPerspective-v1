'use strict';

// trackRecord — pure aggregation for the forecast track-record. NO AWS, NO network.
//
// KEEP IN SYNC with the fallback in newsSensitiveData `prediction_track_record`
// (amplify/backend/function/newsSensitiveData/src/index.js). This builder precomputes the exact
// same `data` object every 30 min → `predictions/track_record.json`, so the proxy serves a cached
// object instead of Scanning ~5.5k PredictionLog items on every /track-record page load (S8·T3).
// The proxy keeps the identical computation as a fallback for when the cache is absent.

// Methodology-v1 era cut (2026-07-04): only records written by the rebuilt, gated capture
// (methodologyVersion >= 1) are scored; the legacy backlog is kept immutable but excluded.
const ERA_CUT_FROM = '2026-07-04';

// items: raw PredictionLog rows projected to { title, category, generatedAt, scenarios, methodologyVersion }.
function computeTrackRecord(items) {
  const v1Items = items.filter((it) => Number(it.methodologyVersion || 0) >= 1);
  const legacyExcluded = items.length - v1Items.length;

  const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
  const cal = buckets.slice(0, -1).map((lo, i) => ({ lo, hi: buckets[i + 1], n: 0, predicted: 0, fired: 0 }));
  const resolved = [];
  let totalTriggers = 0;
  let pendingCount = 0;
  let brierSum = 0;
  let scored = 0;
  let firedCount = 0;

  for (const it of v1Items) {
    for (const s of it.scenarios || []) {
      const p = typeof s.probability === 'number' ? s.probability : null;
      for (const t of s.triggers || []) {
        if (!t.deadline) continue;
        totalTriggers++;
        const v = t.finalVerdict;
        if (v !== 'fired' && v !== 'not_fired') {
          if (!v) pendingCount++;
          continue;
        }
        const outcome = v === 'fired' ? 1 : 0;
        if (v === 'fired') firedCount++;
        if (p != null) {
          brierSum += (p - outcome) ** 2;
          scored++;
          const b = cal.find((c) => p >= c.lo && p < c.hi);
          if (b) { b.n++; b.predicted += p; b.fired += outcome; }
        }
        const citation = t.agentVerdict?.evidence?.[0]?.url
          || t.agentVerdict?.evidence?.[0]?.title
          || t.proposal?.citation
          || null;
        resolved.push({
          title: it.title,
          category: it.category || null,
          scenario: s.label,
          probability: p,
          trigger: t.text,
          deadline: t.deadline,
          verdict: v,
          citation,
          confirmedBy: t.confirmedBy || null,
          confirmedAt: t.confirmedAt || null,
        });
      }
    }
  }

  resolved.sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || ''));
  const calibration = cal
    .filter((c) => c.n > 0)
    .map((c) => ({
      bucket: `${Math.round(c.lo * 100)}-${Math.round(c.hi * 100)}%`,
      n: c.n,
      meanPredicted: Math.round((c.predicted / c.n) * 1000) / 1000,
      actualFiredRate: Math.round((c.fired / c.n) * 1000) / 1000,
    }));

  return {
    methodologyVersion: 1,
    eraCutFrom: ERA_CUT_FROM,
    totalPredictionsLogged: v1Items.length,
    legacyPredictionsExcluded: legacyExcluded,
    totalDatedTriggers: totalTriggers,
    resolvedTriggers: scored,
    pendingTriggers: pendingCount,
    firedTriggers: firedCount,
    brierScore: scored ? Math.round((brierSum / scored) * 1000) / 1000 : null,
    calibration,
    recent: resolved.slice(0, 30),
  };
}

module.exports = { computeTrackRecord, ERA_CUT_FROM };
