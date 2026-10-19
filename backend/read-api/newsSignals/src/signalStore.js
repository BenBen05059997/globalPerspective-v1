'use strict';

// signalStore — pure helpers for the Signal-API S3 store (`signals/latest.json`).
// NO AWS, NO network — so it runs under `node test-adapter.mjs` without the SDK installed.
//
// The store replaces the old GlobalPerspectiveSignals DynamoDB table (S8·T1, 2026-09-09):
// BUILD writes one `signals/latest.json` document (+ a dated `signals/snapshots/` copy)
// instead of ~5.8k per-item PutItems; SERVE filters that array in-Lambda exactly as the
// old code filtered a full table Scan. See DATA_STRATEGY.md §6 and SIGNAL_API_PLAN.md.

// Envelope → the flat projection stored per signal (top-level fields so filter/sort never
// unpacks the full envelope). `first_emitted_at` is the first build that ever published the
// signal_id — carried across rebuilds from the previous latest.json (emitted_at restamps daily).
function toProjection(env, firstEmittedAt) {
  const countries = (env.entities && Array.isArray(env.entities.countries)) ? env.entities.countries : [];
  return {
    signal_id: env.signal_id,
    type: env.type,
    emitted_at: env.emitted_at,
    first_emitted_at: firstEmittedAt || env.emitted_at,
    event_time: env.event_time,
    event_day: (env.event_time || '').slice(0, 10),
    severity: env.severity,
    country_isos: countries.map((c) => c.iso).filter(Boolean),
    country_names: countries.map((c) => c.name),
    envelope: env,
  };
}

// Assemble the latest.json document from projections (newest event first).
function buildLatestDoc(projections, builtAt) {
  const signals = projections
    .slice()
    .sort((a, b) => String(b.event_time || '').localeCompare(String(a.event_time || '')));
  return { built_at: builtAt, count: signals.length, signals };
}

// Is this signal within the retention window? Replaces the old 120-day DDB TTL, which — because
// a daily rebuild restamped it — never actually expired anything; the source scans defined
// membership. An explicit event_time cutoff is the intended, honest bound. Undatable → keep
// (matches the prior lenient behaviour; better an old signal than a silently dropped one).
function withinRetention(env, nowMs, ttlDays) {
  const t = Date.parse(env.event_time || env.emitted_at || '');
  if (!Number.isFinite(t)) return true;
  return t >= nowMs - ttlDays * 86400 * 1000;
}

// A free key only sees signals older than FREE_DELAY_HOURS (`before` = the cutoff ISO string).
function passesFilters(item, { type, country, minSeverity, before }) {
  if (type && item.type !== type) return false;
  if (minSeverity != null && !(Number(item.severity) >= minSeverity)) return false;
  if (before && (item.event_time || '') > before) return false;
  if (country) {
    const c = country.toUpperCase();
    const isos = (item.country_isos || []).map((x) => String(x).toUpperCase());
    const names = (item.country_names || []).map((x) => String(x).toUpperCase());
    if (!isos.includes(c) && !names.includes(country.toUpperCase())) return false;
  }
  return true;
}

// The full SERVE list transform: since-window → filters → newest-first → limit.
function filterList(signals, { since, type, country, minSeverity, before, limit }) {
  return signals
    .filter((it) => (since ? (it.event_time || '') >= since : true))
    .filter((it) => passesFilters(it, { type, country, minSeverity, before }))
    .sort((a, b) => String(b.event_time || '').localeCompare(String(a.event_time || '')))
    .slice(0, limit);
}

module.exports = { toProjection, buildLatestDoc, withinRetention, passesFilters, filterList };
