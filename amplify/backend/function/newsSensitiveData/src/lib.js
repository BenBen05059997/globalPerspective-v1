'use strict';

// Pure helpers for the self-correction DEPTH gate (MEMBER_GATING_PLAN.md).
// Dependency-free so it unit-tests standalone (node --test), matching the
// newsAnalyze/NewsProjectInvokeAgentLambda src/lib.js pattern.
//
// ⚠️ DEPLOY: this file must be included in the newsSensitiveData deploy zip
// (index.js requires it). The zip currently lists files explicitly — add lib.js.

// Teaser cap: members get the whole (already newest-first) array; everyone else gets the
// newest `teaser` items + the honest total, so the UI can show "+N earlier — Join to see all".
// Never fabricates or blurs — real items + a real count (feedback_no_misinformation_fallback).
function capForTier(arr, tier, teaser) {
  const list = Array.isArray(arr) ? arr : [];
  const n = Math.max(0, Number(teaser) || 0);
  if (tier === 'member') return { items: list, total: list.length, gated: false };
  return { items: list.slice(0, n), total: list.length, gated: list.length > n };
}

// Union drift notes from the permanent archive (DRIFTLOG#) + the live TTL'd notes (DRIFT#),
// dedup by `asOf` date (first occurrence wins — pass archive first, it's the superset), newest
// first. Empty archive ⇒ returns the live notes unchanged, so the on-page band is never affected.
function dedupeByAsOf(items) {
  const byAsOf = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    if (it && it.asOf && !byAsOf.has(it.asOf)) byAsOf.set(it.asOf, it);
  }
  return [...byAsOf.values()].sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
}

// Batch 3 / A: the date a `latest` topics item really belongs to. Readers used to label it with
// today's date whatever its age, which re-dated a stalled generation (13 Sep shown as 27 Sep).
// Returns YYYY-MM-DD (UTC) of updatedAt || activatedAt, or null when neither parses (caller skips day 0).
function latestDayLabel(item) {
  const raw = item && (item.updatedAt || item.activatedAt);
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

// De-duplicate narrative-thread entries that appear both in `latest` (day 0) and in the archive row
// of the same date: same topicId + same date = one entry (first occurrence wins).
function dedupeTopicDate(entries) {
  const seen = new Set();
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    const k = e && e.topicId ? `${e.topicId}|${e.date}` : null;
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

module.exports = { capForTier, dedupeByAsOf, latestDayLabel, dedupeTopicDate };
