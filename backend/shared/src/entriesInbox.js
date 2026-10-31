'use strict';

// The entries inbox (decision 0051): record/inbox/entries/YYYY-MM-DD.jsonl. The agent (NewsProjectInvokeAgentLambda) appends one line per entry it
// archives, in the order and with the content it wrote to the `archive#DATE` row of NewsCache, so the record no longer needs that row.
// This file is the one place that knows the line format and the replacement rule; the agent writes with it and newsStoryRecord reads with it.
// Pure, no deps, no clock.
//
// A line is the archived entry as the daily row stores it (ai text cut by trimAi, up to 10 sources) plus fields of its own:
//   inboxId  `${batch}|${n}`, the append key (a retried write adds nothing)
//   batch    the ISO time of the agent's archive write, shared by every line of one run (the row's `updatedAt`)
//   n        the line's position in that run
//   latest   what the `latest` item holds of this topic that an archive entry does not: {urgency, urgencyReason, significance, x_trending,
//            primaryCountry, mentionedCountries}
//   run      what the `latest` item says about the run: {of (topics in the staging item), model, updatedAt, generatedDate, generatedYear, limit}
//
// The replacement rule is the agent's own merge, kept in mergeArchiveDay: within one archive day the entries of a run replace an earlier entry
// of the same topicId (which moves to the end of the list, with the thread id that run assigned), the list is capped at the last 50. Replaying a
// day's lines batch by batch in file order therefore gives exactly the entries `archive#DATE` ends the day as, in the same order.

const MAX_ARCHIVE_ENTRIES = 50;
const MAX_AI_CHARS = 1500;
const TODAY_WINDOW_MS = 24 * 60 * 60 * 1000; // the `today-archive` item keeps the entries archived in the last 24 h
const OWN_FIELDS = ['inboxId', 'batch', 'n', 'latest', 'run'];
const LATEST_FIELDS = ['urgency', 'urgencyReason', 'significance', 'x_trending', 'primaryCountry', 'mentionedCountries'];

/** The agent's trim of stored ai text: strings longer than MAX_AI_CHARS are cut and end in '...'. Idempotent. */
function trimAi(entry) {
  if (!entry.ai) return entry;
  const trimmed = {};
  for (const [k, v] of Object.entries(entry.ai)) trimmed[k] = typeof v === 'string' && v.length > MAX_AI_CHARS ? `${v.slice(0, MAX_AI_CHARS)}...` : v;
  return { ...entry, ai: trimmed };
}

/**
 * The agent's merge of one run into an archive list: the earlier entries whose topic this run did not write (and that `keep` accepts),
 * then this run's, trimmed, the last `cap` of them.
 */
function mergeArchiveDay(existing, fresh, { cap = MAX_ARCHIVE_ENTRIES, keep = () => true } = {}) {
  const ids = new Set(fresh.map((e) => e.topicId));
  return [...existing.filter((e) => !ids.has(e.topicId) && keep(e)), ...fresh].map(trimAi).slice(-cap);
}

/**
 * The inbox lines of one run. `entries` = the run's daily-row entries (buildArchiveEntry output, 10 sources), `batch` = the write time,
 * `selection` = {topics: {topicId -> the raw topic of the staging item}, run: {...}} for the `latest` fields (absent: lines without them).
 */
function inboxLines(entries, { batch, selection = null } = {}) {
  if (typeof batch !== 'string' || !Number.isFinite(Date.parse(batch))) throw new Error('entriesInbox: a batch time is required');
  const topics = (selection && selection.topics) || {};
  const run = selection && selection.run ? selection.run : null;
  return entries.map(trimAi).map((e, n) => {
    const t = topics[e.topicId] || null;
    const latest = t ? Object.fromEntries(LATEST_FIELDS.filter((k) => t[k] !== undefined).map((k) => [k, t[k]])) : null;
    return { ...e, inboxId: `${batch}|${n}`, batch, n, ...(latest && Object.keys(latest).length ? { latest } : {}), ...(run ? { run } : {}) };
  });
}

/** A line without the inbox's own fields: the entry as the archive row stores it. */
function entryOfLine(line) {
  const out = {};
  for (const [k, v] of Object.entries(line || {})) if (!OWN_FIELDS.includes(k)) out[k] = v;
  return out;
}

/** The lines grouped by batch in file order (a batch is one agent run): [{batch, lines}]. A line without a batch is its own batch. */
function batchesOf(lines) {
  const out = [];
  const at = new Map();
  for (const [i, l] of (lines || []).entries()) {
    if (!l || typeof l !== 'object') continue;
    const key = typeof l.batch === 'string' ? l.batch : `line-${i}`;
    if (!at.has(key)) { at.set(key, out.length); out.push({ batch: key, lines: [] }); }
    out[at.get(key)].lines.push(l);
  }
  return out;
}

/** The entries `archive#DATE` ends the day as, from that day's lines: {entries} in the row's order, and `updatedAt` (the last batch). */
function replayDay(lines, { cap = MAX_ARCHIVE_ENTRIES } = {}) {
  let list = [];
  let updatedAt = null;
  for (const b of batchesOf(lines)) {
    list = mergeArchiveDay(list, b.lines.map(entryOfLine), { cap });
    updatedAt = b.batch;
  }
  return { entries: list, updatedAt };
}

/**
 * The entries the `today-archive` item holds after the last batch of the given lines (several days, oldest day first, file order inside a day):
 * the same merge as the daily row, but an earlier entry is also dropped when it was archived 24 h or more before the batch that follows it, and
 * a topic of yesterday replaced today is gone. Sources are not capped here (the item keeps 3; sources.slice(0, 3) of these is the same list).
 */
function replayToday(lines, { cap = MAX_ARCHIVE_ENTRIES } = {}) {
  let list = [];
  let updatedAt = null;
  for (const b of batchesOf(lines)) {
    const cutoff = Date.parse(b.batch) - TODAY_WINDOW_MS;
    list = mergeArchiveDay(list, b.lines.map(entryOfLine), { cap, keep: (e) => Date.parse(e.archivedAt) > cutoff });
    updatedAt = b.batch;
  }
  return { entries: list, updatedAt };
}

/**
 * The latest run in the lines, as {batch, run, topicIds, lines}, or null: the last batch, when it carries the run's selection fields and all
 * its lines are there (`run.of` = the topics of the staging item). A newer run without them, or a single-topic manual run, is not presented
 * as the selection, and an older run is never presented in its place.
 */
function latestSelection(lines) {
  const batches = batchesOf(lines);
  const b = batches[batches.length - 1];
  if (!b) return null;
  const withRun = b.lines.find((l) => l.run && Number.isFinite(l.run.of));
  if (!withRun || withRun.run.of !== b.lines.length) return null;
  return { batch: b.batch, run: withRun.run, topicIds: b.lines.map((l) => l.topicId), lines: b.lines };
}

module.exports = { MAX_ARCHIVE_ENTRIES, MAX_AI_CHARS, TODAY_WINDOW_MS, LATEST_FIELDS, trimAi, mergeArchiveDay, inboxLines, entryOfLine, batchesOf, replayDay, replayToday, latestSelection };
