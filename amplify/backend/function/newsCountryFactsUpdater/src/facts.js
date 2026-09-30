'use strict';

// Pure helpers for newsCountryFactsUpdater (no AWS, no network): Wikidata result parsing for the
// capital / population facts (Batch 3 / D2). Unit-tested in ../test/facts.test.js.
// Rules (never invent, never show undated): a population is kept ONLY with its own point-in-time
// (P585) year; a capital is kept only if its statement has no end time (P582); a value that cannot
// be parsed is dropped, not guessed.

const qidOf = (uri) => String(uri || '').split('/').pop();

// SPARQL JSON bindings -> Map<qid, { names:[..] }> (current capitals only, de-duplicated, stable order)
function parseCapitals(bindings) {
  const byQ = new Map();
  for (const b of Array.isArray(bindings) ? bindings : []) {
    const q = qidOf(b.c && b.c.value);
    const name = b.capLabel && b.capLabel.value;
    if (!q || !name || /^Q\d+$/.test(name)) continue; // an unlabeled entity comes back as its QID: not a name
    if (b.end && b.end.value) continue;               // a former capital
    const cur = byQ.get(q) || { names: [] };
    if (!cur.names.includes(name)) cur.names.push(name);
    byQ.set(q, cur);
  }
  return byQ;
}

// SPARQL JSON bindings -> Map<qid, { value, year, time }> latest DATED population per country.
// Statements without a point in time are ignored (undated = not shown). Non-positive / non-finite dropped.
function parsePopulations(bindings) {
  const byQ = new Map();
  for (const b of Array.isArray(bindings) ? bindings : []) {
    const q = qidOf(b.c && b.c.value);
    const value = Number(b.pop && b.pop.value);
    const time = b.time && b.time.value;
    const t = Date.parse(time);
    if (!q || !Number.isFinite(value) || value <= 0 || !Number.isFinite(t)) continue;
    const cur = byQ.get(q);
    if (!cur || t > cur.t) byQ.set(q, { value: Math.round(value), year: new Date(t).getUTCFullYear(), time: new Date(t).toISOString().slice(0, 10), t });
  }
  for (const v of byQ.values()) delete v.t;
  return byQ;
}

// The record fragments to store. `existing` is the previous FACTS# item: a failed sub-query keeps
// the previous value (with its own old checkedAt) instead of erasing it or inventing one.
function buildCapPop({ qid, capitals, populations, existing, nowIso }) {
  const out = {};
  const cap = capitals && capitals.get(qid);
  if (cap && cap.names.length) out.capital = { names: cap.names, source: 'wikidata', checkedAt: nowIso };
  else if (existing && existing.capital) out.capital = existing.capital;
  const pop = populations && populations.get(qid);
  if (pop) out.population = { value: pop.value, year: pop.year, time: pop.time, source: 'wikidata', checkedAt: nowIso };
  else if (existing && existing.population) out.population = existing.population;
  return out;
}

// SPARQL for a batch of QIDs (one query each for capitals and populations, not one per country).
const values = (qids) => qids.map((q) => `wd:${q}`).join(' ');
const CAPITALS_QUERY = (qids) => `
SELECT ?c ?capLabel ?end WHERE {
  VALUES ?c { ${values(qids)} }
  ?c p:P36 ?st. ?st ps:P36 ?cap.
  OPTIONAL { ?st pq:P582 ?end. }
  ?cap rdfs:label ?capLabel. FILTER(LANG(?capLabel) = "en")
}`;
const POPULATIONS_QUERY = (qids) => `
SELECT ?c ?pop ?time WHERE {
  VALUES ?c { ${values(qids)} }
  ?c p:P1082 ?st. ?st ps:P1082 ?pop.
  ?st pq:P585 ?time.
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
}`;
// qid lookup by ISO 3166-1 alpha-3 (P298) for the countries whose QID is not hard-coded.
const QID_BY_ISO3_QUERY = (iso3s) => `
SELECT ?c ?iso WHERE {
  VALUES ?iso { ${iso3s.map((i) => `"${i}"`).join(' ')} }
  ?c wdt:P298 ?iso.
}`;
function parseQidByIso3(bindings) {
  const m = new Map();
  for (const b of Array.isArray(bindings) ? bindings : []) {
    const iso = b.iso && b.iso.value; const q = qidOf(b.c && b.c.value);
    if (iso && /^Q\d+$/.test(q) && !m.has(iso)) m.set(iso, q);
  }
  return m;
}

module.exports = { parseCapitals, parsePopulations, buildCapPop, CAPITALS_QUERY, POPULATIONS_QUERY, QID_BY_ISO3_QUERY, parseQidByIso3, qidOf };
