'use strict';

// Pure rules for the weekly prediction settle flow (Batch 4 phase B). No AWS, no network, no clock.
// Weeks are ISO weeks (Monday 00:00 UTC to Sunday 23:59 UTC). The sample is pre-registered:
// the SHA-256 of a random seed is published before the week starts, the seed is revealed at the
// draw, and the ranking below is a deterministic function of (seed, question ids) that anyone can
// recompute (predictions/verify-draw.mjs).

const crypto = require('crypto');

const RULE = 'v1';
const SAMPLE_K = 22;
const LEAD_MIN = 7;
const LEAD_MAX = 84;
const GRACE_DAYS = 3; // NO is only allowed after the deadline + 3 days
const VOID_REASONS = ['ambiguous_criterion', 'source_unavailable', 'event_moot', 'duplicate', 'criterion_met_at_issue'];

const sha256hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const day = (iso) => String(iso).slice(0, 10);
const ms = (d) => Date.parse(`${day(d)}T00:00:00Z`);
const addDays = (d, n) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

// ISO week id of a YYYY-MM-DD day, e.g. 2026-10-05 -> "2026-W41".
function weekOf(d) {
  const t = new Date(ms(d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  const w = Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

// Monday (YYYY-MM-DD) of an ISO week id.
function weekStart(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`bad week id ${weekId}`);
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const mondayW1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000;
  return new Date(mondayW1 + (Number(m[2]) - 1) * 7 * 86400000).toISOString().slice(0, 10);
}
const weekEnd = (weekId) => addDays(weekStart(weekId), 6);
const addWeeks = (weekId, n) => weekOf(addDays(weekStart(weekId), 7 * n));
const isMonday = (d) => new Date(ms(d)).getUTCDay() === 1;

const newSeed = () => crypto.randomBytes(32).toString('hex');
const commitOf = (seedHex) => sha256hex(seedHex);
const rankKey = (seedHex, qid) => sha256hex(`${seedHex}|${qid}`);

/**
 * Questions eligible for a week's sample, from PRED rows (never reads or copies `p`).
 * Eligible: question:true, issued (row SK day) inside the week, lead 7-84 days.
 */
function eligibleQuestions(rows, weekId) {
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
        if (lead < LEAD_MIN || lead > LEAD_MAX) continue;
        out.push({
          qid: t.qid,
          pk: row.PK, sk: row.SK, triggerId: t.id,
          question: t.text, deadline: t.deadline, resolutionSource: t.resolutionSource || null,
          storyTitle: row.title || null, issuedAt: row.generatedAt || issued,
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

// ---- verdict windows ----
const canConcludeNo = (deadline, today) => day(today) >= addDays(deadline, GRACE_DAYS);
const isDue = (deadline, today) => day(deadline) <= day(today);

// ---- drafter validation ----
const norm = (s) => String(s || '').toLowerCase().replace(/[‘’“”"']/g, '').replace(/\s+/g, ' ').trim();

// A quote is valid only if it occurs in the title or snippet of the result it cites.
function quoteInResult(quote, results, url) {
  const q = norm(quote);
  if (q.length < 12) return false;
  const r = (results || []).find((x) => x.url === url);
  if (!r) return false;
  return norm(`${r.title} ${r.snippet}`).includes(q);
}

/**
 * Turn a raw model answer into a draft verdict, enforcing the rules.
 * @returns {{verdict:'yes'|'no'|'void'|'not_yet'|'needs_human', voidReason?, quote?, url?, why?, note?}}
 */
function validateDraft(raw, results, today, deadline) {
  const v = raw && typeof raw === 'object' ? raw : {};
  const verdict = String(v.verdict || '').toLowerCase();
  const why = String(v.why || '').slice(0, 300);
  if (verdict === 'yes') {
    if (!quoteInResult(v.quote, results, v.url)) return { verdict: 'needs_human', why, note: 'yes without a quote found in a returned result' };
    return { verdict: 'yes', quote: String(v.quote).trim(), url: v.url, why };
  }
  if (verdict === 'no') {
    if (!canConcludeNo(deadline, today)) return { verdict: 'not_yet', why, note: 'NO not allowed before deadline + 3 days' };
    return { verdict: 'no', why };
  }
  if (verdict === 'void') {
    const reason = VOID_REASONS.includes(v.void_reason) ? v.void_reason : null;
    if (!reason) return { verdict: 'needs_human', why, note: 'void without a valid reason' };
    return { verdict: 'void', voidReason: reason, why };
  }
  if (verdict === 'not_yet') return { verdict: 'not_yet', why };
  return { verdict: 'needs_human', why, note: 'unparseable verdict' };
}

// yes needs two independent agreeing passes; anything else with a disagreement is a human call.
function combinePasses(a, b) {
  if (a.verdict !== 'yes') return a;
  if (b && b.verdict === 'yes') return { ...a, pass2: { url: b.url, quote: b.quote } };
  return { verdict: 'needs_human', why: a.why, note: 'second pass did not confirm yes', pass1: { url: a.url, quote: a.quote } };
}

module.exports = {
  RULE, SAMPLE_K, LEAD_MIN, LEAD_MAX, GRACE_DAYS, VOID_REASONS,
  sha256hex, addDays, daysBetween, weekOf, weekStart, weekEnd, addWeeks, isMonday,
  newSeed, commitOf, rankKey, eligibleQuestions, draw, canConcludeNo, isDue,
  quoteInResult, validateDraft, combinePasses,
};
