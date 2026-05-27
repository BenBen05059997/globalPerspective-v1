// Frontend-bundled copy of the curated historical-analog catalog.
// economicAnalogs.json mirrors amplify/backend/function/newsEconomicImpact/src/economic_analogs.json
// (canonical) — keep them in sync when the catalog changes.
//
// The driving-stories sub-table joins each story's LLM-named historicalAnalog against this
// catalog to surface the analog's REAL realized move for the row's instrument
// (e.g. realizedMoves.BRENT). These are historical realized moves, NOT forecasts.

import catalog from './economicAnalogs.json';

export const ANALOG_EVENTS = Array.isArray(catalog?.events) ? catalog.events : [];

// Normalize an event name/string for fuzzy matching (lowercase, collapse whitespace,
// strip surrounding punctuation). Keeps the join resilient to minor LLM phrasing drift.
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'") // smart quotes → straight
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// name (normalized) → [events]   and   id (normalized) → event
const byName = new Map();
const byId = new Map();
for (const ev of ANALOG_EVENTS) {
  const nk = norm(ev.name);
  if (nk) {
    if (!byName.has(nk)) byName.set(nk, []);
    byName.get(nk).push(ev);
  }
  const ik = norm(ev.id);
  if (ik) byId.set(ik, ev);
}

// Resolve the catalog event for an LLM-supplied analog { event, year }.
// Match on normalized name; if multiple events share a name, prefer the one whose
// year matches. Falls back to an id match. Returns the event object or null.
export function findAnalogEvent(eventName, year) {
  const nk = norm(eventName);
  if (!nk) return null;

  let candidates = byName.get(nk);
  if (!candidates || candidates.length === 0) {
    const byIdMatch = byId.get(nk);
    return byIdMatch || null;
  }
  if (candidates.length === 1) return candidates[0];

  if (year != null) {
    const ys = String(year);
    const yearMatch = candidates.find(ev => String(ev.year || '').includes(ys));
    if (yearMatch) return yearMatch;
  }
  return candidates[0];
}

// The analog's realized move for a given instrument id (e.g. 'BRENT'), verbatim from the
// catalog's realizedMoves, or null if the event/instrument isn't in the catalog.
// NEVER synthesizes a value.
export function realizedMoveFor(eventName, year, instrumentId) {
  if (!instrumentId) return null;
  const ev = findAnalogEvent(eventName, year);
  if (!ev || !ev.realizedMoves) return null;
  const move = ev.realizedMoves[String(instrumentId).toUpperCase()];
  return move != null && String(move).trim() ? String(move) : null;
}
