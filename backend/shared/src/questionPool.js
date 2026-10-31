'use strict';

// The weekly sample's pool and draw rule (decisions 0011, 0038, 0043, 0052), in one place for the resolver (which draws) and the record's track-record view (which
// republishes the pool of a draw from the forecast facts). Pure; the only dependency is node's crypto.
//
// A question is eligible for a week when it was issued (the PRED# row's SK day, the forecast's draw day) inside that ISO week, is a question (`question: true`, a qid and a
// deadline), and the lead from issue day to deadline is LEAD_MIN..LEAD_MAX days. The pool is the eligible questions once each (first row wins); the draw keeps the lowest hash
// per story (`clusterKey`), sorts by hash and takes the first K. A forecast fact stands in for its PRED# row (rowOfFact), so the same rule reads either.

const crypto = require('crypto');

const SAMPLE_K = 22;
const LEAD_MIN = 7;
const LEAD_MAX = 90;
const LEGACY_LEAD_MAX = 84; // the window before decision 0045 (2026-10-31); the draws of W41 and W42 used it

const sha256hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const day = (iso) => String(iso).slice(0, 10);
const ms = (d) => Date.parse(`${day(d)}T00:00:00Z`);
const addDays = (d, n) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

// Monday (YYYY-MM-DD) of an ISO week id.
function weekStart(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`bad week id ${weekId}`);
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const mondayW1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000;
  return new Date(mondayW1 + (Number(m[2]) - 1) * 7 * 86400000).toISOString().slice(0, 10);
}
const weekEnd = (weekId) => addDays(weekStart(weekId), 6);

const rankKey = (seedHex, qid) => sha256hex(`${seedHex}|${qid}`);

/**
 * Questions eligible for a week's sample, from PRED rows (never reads or copies `p`).
 * Eligible: question:true, issued (row SK day) inside the week, lead 7-90 days (`leadMax` for a draw made under an older window).
 */
function eligibleQuestions(rows, weekId, { leadMax = LEAD_MAX } = {}) {
  const a = weekStart(weekId);
  const b = weekEnd(weekId);
  const out = [];
  for (const row of rows || []) {
    const issued = day(row.SK || row.generatedAt || '');
    if (!(issued >= a && issued <= b)) continue;
    for (const s of row.scenarios || []) {
      for (const t of s.triggers || []) {
        if (!t || t.question !== true || !t.qid || !t.deadline) continue;
        const lead = daysBetween(issued, t.deadline);
        if (lead < LEAD_MIN || lead > leadMax) continue;
        out.push({
          qid: t.qid,
          pk: row.PK, sk: row.SK, triggerId: t.id,
          question: t.text, deadline: t.deadline, resolutionSource: t.resolutionSource || null,
          storyTitle: row.title || null, issuedAt: row.generatedAt || issued,
          threadId: row.threadId || null,
          clusterKey: row.threadId || row.topicId || row.PK,
        });
      }
    }
  }
  // the same question can appear once only
  const seen = new Set();
  return out.filter((q) => (seen.has(q.qid) ? false : (seen.add(q.qid), true)));
}

/**
 * The draw. pool: [{qid, clusterKey}]. Per story keep only the lowest hash, sort by hash,
 * take the first K (fewer if fewer stories; never padded).
 */
function draw(seedHex, pool, K = SAMPLE_K) {
  const best = new Map();
  for (const q of pool) {
    const h = rankKey(seedHex, q.qid);
    const cur = best.get(q.clusterKey);
    if (!cur || h < cur.h || (h === cur.h && q.qid < cur.qid)) best.set(q.clusterKey, { qid: q.qid, h, clusterKey: q.clusterKey });
  }
  const reps = [...best.values()].sort((x, y) => (x.h < y.h ? -1 : x.h > y.h ? 1 : x.qid < y.qid ? -1 : 1));
  return { picked: reps.slice(0, K), eligible: pool.length, clusters: best.size };
}

/**
 * The pool a stored draw was made from, rebuilt from the forecast rows: `draw` = a `question_draw` payload {eligible, seedHex, K, picked: [{qid, hash, clusterKey}]}.
 * The pool is kept only when it reproduces the draw (its size is `eligible` and the rule applied to it with the revealed seed gives the same picks, hashes included),
 * trying the current lead window and then the one before 0045. A pick's cluster key must match too unless `exactClusters` is false (a story's thread can change after
 * the draw, as one of W41's did: the qids and hashes still reproduce). Returns {pool: [{qid, clusterKey, ...}], leadMax} or null (the draw cannot be reproduced from these rows).
 */
function poolOfDraw(rows, weekId, drawn, { exactClusters = true } = {}) {
  if (!drawn || typeof drawn.seedHex !== 'string' || !Array.isArray(drawn.picked)) return null;
  for (const leadMax of [LEAD_MAX, LEGACY_LEAD_MAX]) {
    const eligible = eligibleQuestions(rows, weekId, { leadMax });
    if (eligible.length !== drawn.eligible) continue;
    const again = draw(drawn.seedHex, eligible.map((q) => ({ qid: q.qid, clusterKey: q.clusterKey })), drawn.K || SAMPLE_K);
    const same = again.picked.length === drawn.picked.length && again.picked.every((p, i) => p.qid === drawn.picked[i].qid && p.h === drawn.picked[i].hash && (!exactClusters || p.clusterKey === drawn.picked[i].clusterKey));
    if (same) return { pool: eligible, leadMax };
  }
  return null;
}

/**
 * A `forecast_drawn` fact -> the PRED# row fields the rules above read (one scenario holding every question trigger), or null when the forecast has no question.
 * The story's title is not on the fact: the PRED# key is `<title>-<n>`, so it is the topic id without the suffix (664 of 664 rows, 2026-10-31).
 */
function rowOfFact(f) {
  const forkId = f && f.payload && f.payload.forkId;
  if (!f || f.kind !== 'forecast_drawn' || typeof forkId !== 'string' || !forkId.includes('/')) return null;
  const cut = forkId.lastIndexOf('/');
  const triggers = (f.payload.branches || []).filter((b) => b.question === true && b.qid).map((b) => ({
    id: b.branchId.slice(forkId.length + 1), text: b.trigger, deadline: b.due, question: true, qid: b.qid, resolutionSource: b.resolutionSource || null,
  }));
  if (!triggers.length) return null;
  const topicId = f.payload.topicId;
  return {
    PK: forkId.slice(0, cut), SK: forkId.slice(cut + 1), topicId, title: String(topicId).replace(/-\d+$/, ''),
    generatedAt: f.precision === 'exact' ? f.at : undefined, threadId: f.threadId || undefined, questionSchema: 1, scenarios: [{ triggers }],
  };
}

/** Facts (any days, any kinds) -> row-shaped objects of the forecasts that carry questions, in fact order. */
const rowsOfFacts = (facts) => (facts || []).map(rowOfFact).filter(Boolean);

module.exports = { SAMPLE_K, LEAD_MIN, LEAD_MAX, LEGACY_LEAD_MAX, sha256hex, rankKey, addDays, daysBetween, weekStart, weekEnd, eligibleQuestions, draw, poolOfDraw, rowOfFact, rowsOfFacts };
