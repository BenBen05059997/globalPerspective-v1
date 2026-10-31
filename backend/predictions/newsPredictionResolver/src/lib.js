'use strict';

// Pure rules for the weekly prediction settle flow (Batch 4 phase B). No AWS, no network, no clock.
// Weeks are ISO weeks (Monday 00:00 UTC to Sunday 23:59 UTC). The sample is pre-registered:
// the SHA-256 of a random seed is published before the week starts, the seed is revealed at the
// draw, and the ranking below is a deterministic function of (seed, question ids) that anyone can
// recompute (predictions/verify-draw.mjs).

const crypto = require('crypto');
// The pool and draw rules (eligibility, lead window, the draw) are shared with the record's track-record view: _shared/questionPool.js.
const { SAMPLE_K, LEAD_MIN, LEAD_MAX, sha256hex, rankKey, eligibleQuestions, draw } = require('./_shared/questionPool');

const RULE = 'v1';
const GRACE_DAYS = 3; // NO is only allowed after the deadline + 3 days
const NO_REASON = 'not_reported_by_due'; // the reason recorded on every `no`
const COVERAGE_GAP = 'coverage_gap'; // a `no` blocked because our own record has holes in the window (not a judgment)
const VOID_REASONS = ['ambiguous_criterion', 'source_unavailable', 'event_moot', 'duplicate', 'criterion_met_at_issue'];

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

// ---- verdict windows ----
const canConcludeNo = (deadline, today) => day(today) >= addDays(deadline, GRACE_DAYS);
const isDue = (deadline, today) => day(deadline) <= day(today);

// ---- drafter validation ----
const norm = (s) => String(s || '').toLowerCase().replace(/[‘’“”"']/g, '').replace(/\s+/g, ' ').trim();

// A quote is valid only if it occurs in the title or summary of the entry it cites (by eventId).
function quoteInEntry(quote, entries, eventId) {
  const q = norm(quote);
  if (q.length < 12) return false;
  const e = (entries || []).find((x) => x.eventId && x.eventId === eventId);
  if (!e) return false;
  return norm(`${e.title} ${e.summary}`).includes(q);
}

/**
 * Turn a raw model answer into a draft verdict, enforcing the rules.
 * @returns {{verdict:'yes'|'no'|'void'|'not_yet'|'needs_human', voidReason?, quote?, url?, why?, note?}}
 */
function validateDraft(raw, entries, today, deadline, { complete = true, coverageGaps = [] } = {}) {
  const v = raw && typeof raw === 'object' ? raw : {};
  const verdict = String(v.verdict || '').toLowerCase();
  const why = String(v.why || '').slice(0, 300);
  if (verdict === 'yes') {
    if (!quoteInEntry(v.quote, entries, v.event_id)) return { verdict: 'needs_human', why, note: 'yes without a quote found in a cited entry' };
    return { verdict: 'yes', quote: String(v.quote).trim(), eventId: v.event_id, why };
  }
  if (verdict === 'no') {
    if (!canConcludeNo(deadline, today)) return { verdict: 'not_yet', why, note: 'NO not allowed before deadline + 3 days' };
    if (coverageGaps.length) return { verdict: 'not_yet', why, reason: COVERAGE_GAP, gapDays: coverageGaps.map((g) => g.day), note: 'NO needs a healthy Run on every day from the draw to the due day' };
    if (!complete) return { verdict: 'not_yet', why, note: 'NO needs the bundle computed from all entries since the draw' };
    return { verdict: 'no', why, reason: NO_REASON };
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
  if (b && b.verdict === 'yes') return { ...a, pass2: { eventId: b.eventId, quote: b.quote } };
  return { verdict: 'needs_human', why: a.why, note: 'second pass did not confirm yes', pass1: { eventId: a.eventId, quote: a.quote } };
}

module.exports = {
  RULE, SAMPLE_K, LEAD_MIN, LEAD_MAX, GRACE_DAYS, NO_REASON, COVERAGE_GAP, VOID_REASONS,
  sha256hex, addDays, daysBetween, weekOf, weekStart, weekEnd, addWeeks, isMonday,
  newSeed, commitOf, rankKey, eligibleQuestions, draw, canConcludeNo, isDue,
  quoteInEntry, validateDraft, combinePasses,
};
