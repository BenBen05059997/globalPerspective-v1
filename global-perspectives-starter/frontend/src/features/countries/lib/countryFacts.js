// Fact rows for the country card (Batch 3 / D, C1 fact rule): leader / capital / population from the
// stored Wikidata facts, shown ONLY when the value has a source AND an as-of date AND that date is
// recent. Nothing is ever guessed or shown undated:
//   - every row carries `source` and `checkedAt` (when we last verified it) - a row without both is dropped;
//   - the weekly facts job stamps `checkedAt`; older than FACTS_MAX_AGE_DAYS means the job is not
//     running, so the row is hidden rather than shown as current (the table TTL is disabled, so a dead
//     job would otherwise show stale leaders forever);
//   - population also carries its DATA year and is hidden if that year is older than POP_MAX_AGE_YEARS.
// Precedence (operator JSON > Wikidata FACTS# > search): the card reads FACTS# only; the operator JSON
// feeds the briefing prompts, and only Iran is operator-verified (it agrees with Wikidata).
export const FACTS_MAX_AGE_DAYS = 10;
export const POP_MAX_AGE_YEARS = 8;

const DAY = 86400000;
const isFresh = (iso, now) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t <= FACTS_MAX_AGE_DAYS * DAY && t <= now + DAY;
};
const sourceLabel = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : null);

/** compactPopulation - 84,900,000 -> "84.9M"; 1,404,890,000 -> "1.40B"; 5,261,372 -> "5.3M". */
export function compactPopulation(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
}

/**
 * factRows(facts, now) -> [{ key, label, value, since?, dataYear?, source, checkedAt }]
 * `facts` is one country's entry from `country_facts`. Pure.
 */
export function factRows(facts, now = Date.now()) {
  if (!facts || typeof facts !== 'object') return [];
  const rows = [];
  const L = facts.leadership;
  if (L && L.source && isFresh(L.checkedAt, now)) {
    const hos = L.headOfState && L.headOfState.name ? L.headOfState : null;
    const hog = L.headOfGovernment && L.headOfGovernment.name ? L.headOfGovernment : null;
    const base = { source: sourceLabel(L.source), checkedAt: L.checkedAt };
    if (hos && hog && hos.name === hog.name) {
      rows.push({ key: 'leader', label: 'Head of state & government', value: hos.name, since: hos.since || null, ...base });
    } else {
      if (hos) rows.push({ key: 'hos', label: 'Head of state', value: hos.name, since: hos.since || null, ...base });
      if (hog) rows.push({ key: 'hog', label: 'Head of government', value: hog.name, since: hog.since || null, ...base });
    }
  }
  const C = facts.capital;
  if (C && C.source && Array.isArray(C.names) && C.names.length && isFresh(C.checkedAt, now)) {
    rows.push({ key: 'capital', label: C.names.length > 1 ? 'Capitals' : 'Capital', value: C.names.join(', '), source: sourceLabel(C.source), checkedAt: C.checkedAt });
  }
  const P = facts.population;
  const pv = P ? compactPopulation(P.value) : null;
  const year = P ? Number(P.year) : NaN;
  if (P && P.source && pv && Number.isFinite(year) && new Date(now).getUTCFullYear() - year <= POP_MAX_AGE_YEARS && isFresh(P.checkedAt, now)) {
    rows.push({ key: 'population', label: 'Population', value: pv, dataYear: year, source: sourceLabel(P.source), checkedAt: P.checkedAt });
  }
  return rows;
}
