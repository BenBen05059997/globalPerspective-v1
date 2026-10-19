'use strict';

// TEMPORARY (track L2-IDS, 2026-10-19): replace with `resolveCountry` from the one country table that
// track L1-LINKS is building here (iso3Names.json -> {iso3: {name, aliases[]}}); then delete this file and
// switch its callers. Until then: the ISO3 table + the alias table in placeFilter.js, nothing else.
//
// resolveIso3(text) -> { iso3, name } | null   name = the canonical short display name (decided
// 2026-10-19: "United States", "DR Congo", "UAE", "Palestine", "Bosnia and Herzegovina").
// Regions and aggregates (Europe, Middle East, Global, ...) and unknown places resolve to null.

const ISO3_NAMES = require('./iso3Names.json');
const { canonicalName, normKey } = require('./placeFilter');

// Display names the decision sets differently from the map table (removed when L1 lands).
const DISPLAY = { BIH: 'Bosnia and Herzegovina' };
// Alias targets in placeFilter.js that are long forms of a short table name.
const LONG_FORMS = { 'united arab emirates': 'ARE', 'democratic republic of the congo': 'COD' };

const BY_NAME = new Map(Object.entries(ISO3_NAMES).map(([iso3, name]) => [normKey(name), iso3]));
for (const [iso3, name] of Object.entries(DISPLAY)) BY_NAME.set(normKey(name), iso3);
for (const [name, iso3] of Object.entries(LONG_FORMS)) BY_NAME.set(normKey(name), iso3);

function resolveIso3(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const iso3 = (/^[A-Z]{3}$/.test(raw) && ISO3_NAMES[upper] ? upper : null)
    || BY_NAME.get(normKey(raw)) || BY_NAME.get(normKey(canonicalName(raw))) || null;
  return iso3 ? { iso3, name: DISPLAY[iso3] || ISO3_NAMES[iso3] } : null;
}

// Unique ISO3 codes for a list of place names, in first-seen order.
function iso3List(names) {
  const out = [];
  for (const n of names || []) {
    const r = resolveIso3(n);
    if (r && !out.includes(r.iso3)) out.push(r.iso3);
  }
  return out;
}

module.exports = { resolveIso3, iso3List };
