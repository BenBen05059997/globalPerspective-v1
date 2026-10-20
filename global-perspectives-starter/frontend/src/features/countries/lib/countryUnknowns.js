// countryUnknowns — "What we don't know" (INFERENCE): limits of this page, computed ONLY from the data the page
// holds. A line appears only when it is true for what was read; nothing is assumed when a source did not load.
//   archiveDates  the archive days we hold (YYYY-MM-DD), any order
//   entries       this country's archive entries ({ sources: [{ source, url }] })
//   intel         the stored country analysis, or null
//   webIndex      the story-web index (useWebIndex), or null while unread / unbuilt
//   country       the display name
const DAY = 86400000;
const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);
const plural = (n, one, many) => (n === 1 ? one : many);

/** Days with no archive inside the 30-day window that ends on the newest archive day. */
export function missingArchiveDays(archiveDates, windowDays = 30) {
  const have = new Set((archiveDates || []).filter((d) => Number.isFinite(dayMs(d))));
  if (!have.size) return null;
  const end = Math.max(...[...have].map(dayMs));
  let missing = 0;
  for (let i = 0; i < windowDays; i += 1) {
    if (!have.has(new Date(end - i * DAY).toISOString().slice(0, 10))) missing += 1;
  }
  return { missing, windowDays };
}

function outletOf(s) {
  if (s?.source) return String(s.source).trim().toLowerCase();
  try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/** Entries backed by one outlet, among those that list any source. */
export function singleOutletCount(entries) {
  let total = 0;
  let single = 0;
  for (const e of entries || []) {
    const outlets = new Set((e.sources || []).map(outletOf).filter(Boolean));
    if (!outlets.size) continue;
    total += 1;
    if (outlets.size === 1) single += 1;
  }
  return { single, total };
}

/** The countries with a story web in the index (`websUsed`, every fresh per-country web), falling back to the
 *  run's `targets`; null when the index says neither. `targets` alone is only the last run's list. */
export function webCountries(webIndex) {
  const used = webIndex?.websUsed;
  const list = Array.isArray(used) && used.length ? used.map((w) => w?.country) : webIndex?.targets?.countries;
  if (!Array.isArray(list)) return null;
  const names = list.map((c) => (typeof c === 'string' ? c : c?.countryName || c?.name)).filter(Boolean);
  return names.length ? names : null;
}

/** @returns {string[]} one plain sentence per limit; "Not graded" is always present. */
export function whatWeDontKnow({ archiveDates, entries, intel, webIndex, country }) {
  const lines = [];
  const gap = missingArchiveDays(archiveDates);
  if (gap && gap.missing > 0) {
    lines.push(`Our archive has no stories for ${gap.missing} of the last ${gap.windowDays} days, so events on those days are absent here.`);
  }
  const { single, total } = singleOutletCount(entries);
  if (single > 0) {
    lines.push(`${single} of ${total} ${plural(total, 'report', 'reports')} for ${country} ${plural(single, 'rests', 'rest')} on a single outlet.`);
  }
  if (intel && !(intel.groundingSources?.length > 0)) {
    lines.push('The country analysis is built only from our archive: no outside search sources are attached to it.');
  }
  lines.push('Not graded: we hold no outlet reliability data.');
  const covered = webCountries(webIndex);
  if (covered && !covered.some((c) => c.toLowerCase() === String(country).toLowerCase())) {
    lines.push(`No judged links; the story web covers ${covered.length} ${plural(covered.length, 'country', 'countries')}: ${covered.join(', ')}.`);
  }
  return lines;
}
