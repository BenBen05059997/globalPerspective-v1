'use strict';

const crypto = require('crypto');

// M2 (Batch 4, phase A): every qualifying trigger becomes a standalone binary QUESTION with its
// OWN probability `p` and a NAMED resolution source, frozen at issue (the log write is
// attribute_not_exists, so a question is never edited; a correction is a new question).
// Pure: no network, no clock, no LLM. Gates G7-G12 sit AFTER the existing G1-G6 (lib.validateTrigger).
// See project-docs/architecture/_active/TASK_2026-09-30_batch4_scoring_web_share.md phase A.

const MIN_LEAD_DAYS = 7;
const P_MIN = 2;
const P_MAX = 98;
const GENERIC_SOURCES = new Set(['news', 'media', 'reports', 'report', 'sources', 'source', 'online', 'the internet', 'internet', 'various', 'press', 'the news', 'news reports', 'media reports', 'news media']);
const FORMALITY = /\bwill hold its (?:regular|scheduled)\b|\bis scheduled to\b|\bas planned\b/i;
const STOP = new Set(['the', 'and', 'for', 'that', 'with', 'from', 'will', 'has', 'have', 'its', 'are', 'was', 'were', 'this', 'than', 'into', 'over', 'new', 'not', 'any', 'more', 'their', 'after', 'before', 'by', 'to', 'of', 'in', 'on', 'at', 'a', 'an', 'is', 'be', 'or']);

// Stable id of a question: sha256(pk|sk|triggerId), first 20 hex chars.
function qidFor(pk, sk, triggerId) {
  return crypto.createHash('sha256').update(`${pk}|${sk}|${triggerId}`).digest('hex').slice(0, 20);
}

function tokens(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

function jaccard(a, b) {
  const A = a instanceof Set ? a : tokens(a);
  const B = b instanceof Set ? b : tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// "64", 64, "64%", 64.4 -> 64; anything else -> null. Range is enforced by the caller.
function parseP(raw) {
  if (raw == null || typeof raw === 'boolean') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace('%', '').trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000);
}

/**
 * @param {{text:string, deadline:string, p?:any, resolutionSource?:string}} t  a trigger that already passed G1-G6
 * @param {{generatedAtDay:string, snippets?:string[], priorTexts?:string[]}} ctx
 * @returns {{action:'keep'|'demote'|'drop', gate?:string, reason?:string, p?:number, source?:string}}
 */
function questionGate(t, ctx) {
  const p = parseP(t.p);
  if (p == null || p < P_MIN || p > P_MAX) return { action: 'demote', gate: 'G7', reason: 'no_p' };
  const source = String(t.resolutionSource == null ? '' : t.resolutionSource).replace(/\s+/g, ' ').trim();
  if (source.length < 8 || GENERIC_SOURCES.has(source.toLowerCase())) return { action: 'demote', gate: 'G8', reason: 'generic_source' };
  const lead = daysBetween(String(ctx.generatedAtDay).slice(0, 10), t.deadline);
  if (lead < MIN_LEAD_DAYS) return { action: 'drop', gate: 'G9', reason: `lead time ${lead}d is under ${MIN_LEAD_DAYS} days` };
  const tt = tokens(t.text);
  for (const s of ctx.snippets || []) {
    if (jaccard(tt, s) >= 0.6) return { action: 'drop', gate: 'G10', reason: 'restates already-reported news (criterion met at issue)' };
  }
  if (p >= 95 && FORMALITY.test(t.text)) return { action: 'demote', gate: 'G11', reason: 'formality' };
  for (const prior of ctx.priorTexts || []) {
    if (jaccard(tt, prior) >= 0.7) return { action: 'demote', gate: 'G12', reason: 'near_duplicate' };
  }
  return { action: 'keep', p, source };
}

// Cluster key for "max one per story" sampling.
function clusterKeyFor(row) {
  return (row && (row.threadId || row.topicId)) || null;
}

module.exports = { qidFor, tokens, jaccard, parseP, questionGate, clusterKeyFor, MIN_LEAD_DAYS, P_MIN, P_MAX };
