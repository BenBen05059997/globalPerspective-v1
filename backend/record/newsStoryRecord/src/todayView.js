'use strict';

// index/today.json (decision 0051): what the pages that still read DynamoDB for "today" need, built from the entries inbox (the agent's lines of the
// last two UTC days) and the entry notes. It replaces the actions `topics` (NewsCache `latest`), `today` (`today-archive`) and, for the entries of the
// latest run, `summary` / `prediction` / `trace_cause` (SummarizeAndPredict `TOPIC#`). Pure: no I/O, no clock. Public data only: every field here is what
// those five actions answer to an anonymous caller (none of them checks membership; drift depth and the corrections ledger, which are gated, are not here).
//
// Why it reads the inbox lines and not the entry facts: the entry fact keeps what the record needs (identity, sources, places, actors), but the pages
// also show `urgency`, `x_trending`, `primaryCountry` (only the `latest` item holds them) and the order and membership of the latest run, and the
// `today` list keeps the replacement rule of the `today-archive` item (a topic seen again replaces its earlier entry across midnight too). The lines
// carry all of it, and the entry notes (0042) carry the full model text.
const R = require('./_shared/record');
const inbox = require('./_shared/entriesInbox');

const SCHEMA_VERSION = 1;
const PARTS = {summary: 'summary', prediction: 'prediction', cause: 'trace_cause'}; // entry note part -> the action's name

const noteOf = (n) => ({format: n.format, content: n.content, at: n.at, model: n.model});

/**
 * @param {{day: string, lines: object[]}[]} days  the inbox lines of the last two UTC days, oldest day first (a day without a file may be left out)
 * @param {Map<string, object>} notesBy            entryNotesBy(): eventId -> {summary?, prediction?, cause?} (latest note per part)
 * @returns the view, or null when there are no lines at all (the agent has not written the inbox: the pages keep their actions)
 */
function todayIndex(days, notesBy, builtFrom) {
  if (!days.some((d) => d.lines.length)) return null;

  // the today-archive replay, batch by batch in time order, remembering the archive day each entry was written under (its identity needs it)
  let list = [];
  let updatedAt = null;
  for (const {day, lines} of days) {
    for (const b of inbox.batchesOf(lines)) {
      const cutoff = Date.parse(b.batch) - inbox.TODAY_WINDOW_MS;
      const fresh = b.lines.map(inbox.entryOfLine).map((e) => ({...e, eventId: R.entryIdentity({sources: e.sources, date: day, title: e.title}).eventId}));
      list = inbox.mergeArchiveDay(list, fresh, {keep: (e) => Date.parse(e.archivedAt) > cutoff});
      updatedAt = b.batch;
    }
  }
  const floor = Date.parse(updatedAt) - inbox.TODAY_WINDOW_MS; // the entries still inside the 24 h window of the newest write; the page cuts again at read time
  list = list.filter((e) => Date.parse(e.archivedAt) > floor);

  // the latest run: the newest batch of the newest day, when it is the whole selection
  const newest = [...days].reverse().find((d) => d.lines.length);
  const sel = inbox.latestSelection(newest.lines);
  const selected = new Map();
  if (sel) for (const l of sel.lines) selected.set(l.topicId, l);
  const latest = sel ? {
    batch: sel.batch, generationId: sel.run.generationId ?? null, model: sel.run.model ?? null, limit: sel.run.limit ?? null, updatedAt: sel.run.updatedAt ?? null,
    generatedDate: sel.run.generatedDate ?? null, generatedYear: sel.run.generatedYear ?? null, topicIds: sel.topicIds,
  } : null;

  const entries = list.map((e) => {
    const line = selected.get(e.topicId);
    const isLatest = Boolean(line) && e.archivedAt === line.archivedAt;
    const parts = isLatest ? notesBy.get(e.eventId) : null;
    const notes = parts ? Object.fromEntries(Object.entries(parts).filter(([p]) => PARTS[p]).map(([p, n]) => [PARTS[p], noteOf(n)])) : null;
    return {...e, ...(isLatest && line.latest ? {latest: line.latest} : {}), ...(notes && Object.keys(notes).length ? {notes} : {})};
  });
  return {schemaVersion: SCHEMA_VERSION, builtFrom, updatedAt, latest, entries};
}

module.exports = {todayIndex, SCHEMA_VERSION};
