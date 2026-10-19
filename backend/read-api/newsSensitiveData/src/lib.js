'use strict';

// Pure helpers for the self-correction DEPTH gate (MEMBER_GATING_PLAN.md).
// Dependency-free so it unit-tests standalone (node --test), matching the
// newsAnalyze/NewsProjectInvokeAgentLambda src/lib.js pattern.
//
// ⚠️ DEPLOY: this file must be included in the newsSensitiveData deploy zip
// (index.js requires it). The zip currently lists files explicitly — add lib.js.

const { resolveIso3, iso3List } = require('./_shared/resolveIso3'); // TODO(L1-LINKS): resolveCountry

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
    iso3: iso3List(e.regions),
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


// ── Batch 4 / C: per-question state for prediction_snapshot ─────────────────────────────────
const _ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
const _days = (a, b) => Math.round((_ms(b) - _ms(a)) / 86400000);

// ISO week id of a YYYY-MM-DD day (same rule as the settle Lambda; parity-tested there).
function isoWeekOfDay(d) {
  const t = new Date(_ms(d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

// Where a question stands in the weekly sample: sampled | not_eligible | warm_up | awaiting_draw | not_sampled.
function questionSampleState({ issueDay, deadline, sampled, commitExists, drawExists }) {
  if (sampled) return 'sampled';
  const lead = _days(issueDay, deadline);
  if (lead < 7 || lead > 84) return 'not_eligible';
  if (!commitExists) return 'warm_up';
  if (!drawExists) return 'awaiting_draw';
  return 'not_sampled';
}

// yes | no | void once confirmed; otherwise awaiting / past_deadline_unchecked. Only for sampled questions.
function questionOutcomeState({ sampled, verdictRows, deadline, today }) {
  if (!sampled) return null;
  const v = (verdictRows || []).slice().sort((a, b) => verdictNo(b.SK) - verdictNo(a.SK))[0];
  if (v) return v.verdict === 'yes' ? 'yes' : v.verdict === 'no' ? 'no' : 'void';
  return String(deadline).slice(0, 10) < String(today).slice(0, 10) ? 'past_deadline_unchecked' : 'awaiting';
}
function verdictNo(sk) { const m = /^VERDICT#(\d+)$/.exec(String(sk)); return sk === 'VERDICT' ? 1 : m ? Number(m[1]) : 0; }
function latestVerdictRow(rows) { return (rows || []).slice().sort((a, b) => verdictNo(b.SK) - verdictNo(a.SK))[0] || null; }

// ── Linking (L2-IDS): related ids derived server-side, never from the model ─────────────────
// Country record keys to try for a requested name: the canonical short name first (what the writers key by
// now), then the requested spelling (records not yet merged under the canonical name).
function countryKeys(name) {
  const raw = String(name || '').trim();
  const canonical = resolveIso3(raw)?.name;
  return canonical && canonical !== raw ? [canonical, raw] : [raw];
}

// Daily brief: top stories and the country to watch carry iso3[] (rows written before the writer added it
// get it here from their names). Everything else passes through.
function briefWithIso3(brief) {
  if (!brief || typeof brief !== 'object') return brief;
  const out = { ...brief };
  if (Array.isArray(brief.topStories)) {
    out.topStories = brief.topStories.map((s) => (s && typeof s === 'object' ? { ...s, iso3: Array.isArray(s.iso3) ? s.iso3 : iso3List(s.regions) } : s));
  }
  const ctw = brief.countryToWatch;
  if (ctw && typeof ctw === 'object') out.countryToWatch = { ...ctw, iso3: Array.isArray(ctw.iso3) ? ctw.iso3 : iso3List([ctw.countryName]) };
  return out;
}

// Weekly brief: signals carry iso3[] (older rows: from the "A · B" region text).
function weeklyWithIso3(brief) {
  if (!brief || !Array.isArray(brief.signals)) return brief;
  return { ...brief, signals: brief.signals.map((s) => (s && typeof s === 'object'
    ? { ...s, iso3: Array.isArray(s.iso3) ? s.iso3 : iso3List(String(s.region || '').split('·').map((x) => x.trim())) } : s)) };
}

// Story web: each link / shared-actor link carries the iso3 of its web's country; each thread the iso3 of its places.
function webWithIso3(index) {
  if (!index || typeof index !== 'object') return index;
  const withCountry = (l) => (l && typeof l === 'object' ? { ...l, iso3: iso3List([l.country]) } : l);
  const out = { ...index };
  if (Array.isArray(index.links)) out.links = index.links.map(withCountry);
  if (Array.isArray(index.shared)) out.shared = index.shared.map(withCountry);
  if (index.threads && typeof index.threads === 'object') {
    out.threads = Object.fromEntries(Object.entries(index.threads).map(([id, t]) => [id,
      t && typeof t === 'object' ? { ...t, iso3: iso3List((t.places || []).map((p) => p && p.name)) } : t]));
  }
  return out;
}

// A question trigger's happened / didn't: the stored finalVerdict (July pilot) or, since no job writes that
// any more, its Q# verdict row (yes -> fired, no -> not_fired; void and unsettled -> null).
function triggerVerdict(finalVerdict, state) {
  return finalVerdict || (state === 'yes' ? 'fired' : state === 'no' ? 'not_fired' : null);
}

module.exports = { countryKeys, briefWithIso3, weeklyWithIso3, webWithIso3, triggerVerdict, isoWeekOfDay, questionSampleState, questionOutcomeState, latestVerdictRow, lightEntry, unionByTopicId, shapeCountryFacts, capForTier, dedupeByAsOf, latestDayLabel, dedupeTopicDate, pickLatestBrief, briefKeys };
