// The analyst's weekly: the one section model (which sections, in what order, what each holds).
// The block between the markers is kept identical to
// global-perspectives-starter/frontend/src/features/weekly/lib/sections.js by scripts/check-shared-sync.mjs.
// Pure data and one pure function: no network, no clock, no dependencies.

// --- weekly sections core (identical in the frontend copy) ---
const LABELS = Object.freeze({ fact: 'FACT', judgment: 'JUDGMENT' });
const CONFIDENCE = Object.freeze(['low', 'medium', 'high']);

// required: always shown; when it has nothing the reader sees emptyText. Optional sections with nothing are skipped.
// single: the file holds one object, not a list. max: item cap in the file (null = none).
// emailWordCap: words allowed per section in the rendered email only; the file is never trimmed.
const SECTIONS = Object.freeze([
  { key: 'lead', title: 'This week', required: true, single: true, max: null, emailWordCap: 110, emptyText: 'No lead this week.' },
  { key: 'moved', title: 'Where our view moved', required: true, single: false, max: 6, emailWordCap: 140, emptyText: 'Our view did not move this week.' },
  { key: 'trace', title: 'The trace', required: false, single: false, max: 5, emailWordCap: 200, emptyText: 'No story was traced this week.' },
  { key: 'dates', title: "Next week's dates", required: false, single: false, max: null, emailWordCap: 80, emptyText: 'No trigger or forecast falls due next week.' },
  { key: 'new', title: 'New this week', required: false, single: false, max: 3, emailWordCap: 180, emptyText: 'No new story met the bar this week.' },
  { key: 'coverage', title: 'What we did not see', required: true, single: true, max: null, emailWordCap: 70, emptyText: 'No coverage figures were recorded this week.' },
].map((s) => Object.freeze(s)));

/** The weekly's sections in print order as [{ section, items }]. A required section with nothing is kept with items [];
 *  an optional empty one is skipped. */
function orderedSections(weekly) {
  const out = [];
  for (const section of SECTIONS) {
    const raw = weekly ? weekly[section.key] : undefined;
    const items = section.single ? (raw ? [raw] : []) : (Array.isArray(raw) ? raw : []);
    if (!items.length && !section.required) continue;
    out.push({ section, items });
  }
  return out;
}
// --- end weekly sections core ---

module.exports = { LABELS, CONFIDENCE, SECTIONS, orderedSections };
