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

// Batch 3 / B: newest daily brief among the rows a BatchGetItem returned. `dateKey` is the row's own
// YYYY-MM-DD. Returns { item, editions } (editions = every dateKey found, newest first) or
// { item: null, editions: [] }.
function pickLatestBrief(items) {
  const rows = (Array.isArray(items) ? items : []).filter((it) => it && /^\d{4}-\d{2}-\d{2}$/.test(String(it.dateKey || '')));
  rows.sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
  return { item: rows[0] || null, editions: rows.map((r) => r.dateKey) };
}

// The DAILY_BRIEF# keys to look up: today back `lookbackDays` days (default 30, clamped 1..60).
function briefKeys(nowMs, lookbackDays) {
  const n = Math.min(60, Math.max(1, Math.floor(Number(lookbackDays)) || 30));
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Date(nowMs - i * 86400000).toISOString().slice(0, 10));
  return out;
}

// Batch 3 / D: the public shape of a FACTS#<country>/COUNTRY_FACTS row. Every part is returned ONLY
// with its source and its own as-of date (leadership: the row's lastUpdatedAt; capital / population:
// their own checkedAt; population also carries the data year). A part missing either is omitted, so
// the client can never show an undated or unsourced value. No ACLED data, keys, ttl.
function shapeCountryFacts(item) {
  if (!item || typeof item !== 'object') return null;
  const out = {};
  const hos = item.headOfState && item.headOfState.name ? { name: item.headOfState.name, since: item.headOfState.since || null } : null;
  const hog = item.headOfGovernment && item.headOfGovernment.name ? { name: item.headOfGovernment.name, since: item.headOfGovernment.since || null } : null;
  if (item.leadershipSource && item.lastUpdatedAt && (hos || hog)) {
    out.leadership = { headOfState: hos, headOfGovernment: hog, source: item.leadershipSource, checkedAt: item.lastUpdatedAt };
  }
  const cap = item.capital;
  if (cap && Array.isArray(cap.names) && cap.names.length && cap.source && cap.checkedAt) {
    out.capital = { names: cap.names.map(String), source: cap.source, checkedAt: cap.checkedAt };
  }
  const pop = item.population;
  if (pop && Number.isFinite(Number(pop.value)) && Number(pop.value) > 0 && Number.isFinite(Number(pop.year)) && pop.source && pop.checkedAt) {
    out.population = { value: Number(pop.value), year: Number(pop.year), source: pop.source, checkedAt: pop.checkedAt };
  }
  return Object.keys(out).length ? out : null;
}

// Batch 3 post-deploy fix: `latest` holds only the NEWEST generation, so a story from an earlier run today
// disappeared from archive_range / narrative_thread until midnight. Day 0 now also reads today's
// `archive#<today>` row (it holds every run of the day). Light entry = the shape archive_range serves.
function lightEntry(e) {
  return {
    topicId: e.topicId || e.id,
    title: e.title,
    category: Array.isArray(e.categories) ? e.categories[0] || '' : (e.category || ''),
    regions: e.regions || [],
    sources: e.sources || [],
    threadId: e.threadId || null,
  };
}
// First occurrence of a topicId wins (pass `latest` first); entries without an id are kept.
function unionByTopicId(...lists) {
  const seen = new Set(); const out = [];
  for (const list of lists) for (const e of Array.isArray(list) ? list : []) {
    if (!e) continue;
    if (e.topicId) { if (seen.has(e.topicId)) continue; seen.add(e.topicId); }
    out.push(e);
  }
  return out;
}

module.exports = { lightEntry, unionByTopicId, shapeCountryFacts, capForTier, dedupeByAsOf, latestDayLabel, dedupeTopicDate, pickLatestBrief, briefKeys };
