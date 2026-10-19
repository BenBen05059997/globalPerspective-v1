'use strict';

// resolveIso3(text) -> { iso3, name } | null and iso3List(names) for the Lambda writers: a thin wrapper over the
// one country resolver (countries.js). A sub-national place resolves to its country (West Bank -> Palestine);
// regions, aggregates and unknown places resolve to null.

const { resolveCountry, parentCountry } = require('./countries');

function resolveIso3(text) {
  if (typeof text !== 'string') return null;
  return resolveCountry(text) || parentCountry(text) || null;
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
