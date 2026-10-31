'use strict';

// Notes (decision 0042): the one builder and writer of record/notes/<subtype>/YYYY-MM-DD.jsonl, so every writer (a Lambda or
// the capture CLI) makes the same object. The shape is backend/record/schema/note.schema.json; buildNote checks the rules that
// keep notes consistent and throws instead of writing a bad note.
const {noteId, entryIdentity} = require('./record');
const {makeManifest} = require('./manifest');

const SCHEMA_VERSION = 1;
const SUBJECT_KIND = {entry: 'entry', story_analysis: 'story', drift: 'country', country: 'country', link: 'pair', brief: 'brief'};
// TOPIC# sort key -> the entry note part
const ENTRY_PARTS = {SUMMARY: 'summary', PREDICTION: 'prediction', TRACE_CAUSE: 'cause'};
const ISO3 = /^[A-Z]{3}$/;
const BRIEF_ID = /^(daily:\d{4}-\d{2}-\d{2}|weekly:\d{4}-W\d{2})$/;

const text = (v) => typeof v === 'string' && v.length > 0;

/** -> a note object; throws on anything the schema would reject. `at` is when the model wrote it. */
function buildNote({subtype, subjectId, part = '', threadId = null, iso3 = [], at, payload, cites = [], model, promptVersion = null, producer}) {
  const kind = SUBJECT_KIND[subtype];
  if (!kind) throw new Error(`notes: unknown subtype ${subtype}`);
  if (!text(subjectId)) throw new Error(`notes: ${subtype} needs a subject id`);
  if (subtype === 'brief' && !BRIEF_ID.test(subjectId)) throw new Error(`notes: brief subject ${subjectId} is not daily:DATE or weekly:WEEK`);
  if (subtype === 'entry' && !Object.values(ENTRY_PARTS).includes(part)) throw new Error(`notes: entry part ${part}`);
  if (subtype === 'entry' && !cites.length) throw new Error('notes: an entry note cites its entry');
  const when = Date.parse(at);
  if (!Number.isFinite(when)) throw new Error(`notes: ${subtype} needs a valid at`);
  if (!Array.isArray(iso3) || !iso3.every((c) => ISO3.test(c))) throw new Error(`notes: iso3 must be ISO3 codes (${iso3})`);
  if (!payload || typeof payload !== 'object') throw new Error('notes: payload must be an object');
  const archiveCopy = payload && payload.from === 'archive';
  if (!text(model) && !(archiveCopy && model === null)) throw new Error('notes: model is required (null only on an archive copy)');
  if (!producer || !text(producer.lambda) || !text(producer.runId)) throw new Error('notes: producer {lambda, runId} is required');
  const iso = new Date(when).toISOString();
  return {
    schemaVersion: SCHEMA_VERSION, noteId: noteId(subtype, subjectId, part, iso), subtype, subject: {kind, id: subjectId}, part,
    threadId: threadId || null, iso3: [...new Set(iso3)].sort(), at: iso, date: iso.slice(0, 10), payload, cites: [...new Set(cites)],
    model, promptVersion: promptVersion == null ? null : String(promptVersion), producer: {lambda: producer.lambda, runId: producer.runId},
  };
}

/**
 * One TOPIC# item (SUMMARY | PREDICTION | TRACE_CAUSE, as the agent stores it) + the archive topic it was written for -> an entry
 * note, or null for an item with no content or another sort key. The subject is the entry fact's eventId, computed by the same
 * shared entryIdentity the fact writer uses (url-based; `archiveDate` only matters for an entry with no usable url).
 */
function entryNote({item, topic, archiveDate, producer}) {
  const part = ENTRY_PARTS[item && item.SK];
  if (!part || !text(item.content) || !topic) return null;
  const format = item.contentFormat === 'json' ? 'json' : 'markdown';
  const content = format === 'json' ? JSON.parse(item.content) : item.content;
  const {eventId} = entryIdentity({sources: topic.sources, date: archiveDate, title: topic.title});
  return buildNote({
    subtype: 'entry', subjectId: eventId, part, threadId: item.threadId || topic.threadId || null, iso3: (topic.iso3 || []).filter((c) => ISO3.test(c)),
    at: item.generatedAt, payload: {format, content, topicId: item.topicId}, cites: [eventId], model: item.model,
    promptVersion: item.promptVersion ?? null, producer,
  });
}

// Stored-row plumbing that is not part of the note: keys, ttl, and fields the envelope already carries.
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => !keys.includes(k) && v !== undefined));

/**
 * The THREAD# / THREAD_ANALYSIS item newsThreadAnalysis stores + the thread's archive entries (topicId, date, title, sources) ->
 * a story_analysis note. Payload = the stored analysis as the site reads it. `cites` = eventIds (shared entryIdentity, as
 * entryNote) of the entries the analysis was built from (the stored entryTopicIds); iso3/threadId/model/at come from the item.
 */
function storyAnalysisNote({item, entries = [], producer}) {
  if (!item || !text(item.threadId)) return null;
  const built = new Set(item.entryTopicIds || []);
  const cites = entries.filter((e) => built.has(e.topicId))
    .map((e) => entryIdentity({sources: e.sources, date: e.date, title: e.title}).eventId);
  return buildNote({
    subtype: 'story_analysis', subjectId: item.threadId, threadId: item.threadId, iso3: (item.iso3 || []).filter((c) => ISO3.test(c)),
    at: item.generatedAt, payload: omit(item, ['PK', 'SK', 'ttl', 'threadId', 'iso3', 'generatedAt', 'model']), cites, model: item.model, producer,
  });
}

/**
 * The COUNTRY# / DRIFT# item newsDriftCorrector stores (before PK/SK/ttl) + the country's ISO3 -> a drift note about the country.
 * Payload = the stored fields (headlines, scores, trigger event, why); threadId = the trigger story's, if it has one.
 */
function driftNote({item, iso3, model, producer}) {
  return buildNote({
    subtype: 'drift', subjectId: iso3, threadId: item.triggerEvent && item.triggerEvent.threadId, iso3: [iso3], at: item.generatedAt,
    payload: omit(item, ['PK', 'SK', 'ttl', 'generatedAt']), model, producer,
  });
}

// archive ai field -> entry note part
const ARCHIVE_PARTS = {summary: 'summary', prediction: 'prediction', trace_cause: 'cause'};

/**
 * One NewsCache archive entry (its `ai` texts, as the agent archived them, cut at 1,500 characters) -> archive-copy entry
 * notes: format 'text', model null (not recorded there), `at` the archive time, payload.from 'archive'. For backfill of
 * entries older than the notes; views prefer an exact note over a copy. Subject: the eventId newsStoryRecord computes from
 * the same entry (shared entryIdentity).
 */
function archiveEntryNotes({entry, archiveDate, producer}) {
  if (!entry || !entry.ai) return [];
  const {eventId} = entryIdentity({sources: entry.sources, date: archiveDate, title: entry.title});
  const at = entry.archivedAt || `${archiveDate}T00:00:00.000Z`;
  return Object.entries(ARCHIVE_PARTS).filter(([field]) => text(entry.ai[field])).map(([field, part]) => buildNote({
    subtype: 'entry', subjectId: eventId, part, threadId: entry.threadId || null, iso3: (entry.iso3 || []).filter((c) => ISO3.test(c)),
    at, payload: {format: 'text', content: entry.ai[field], topicId: entry.topicId, from: 'archive'}, cites: [eventId], model: null, producer,
  }));
}

const notesKey = (prefix, subtype, date) => `${prefix}notes/${subtype}/${date}.jsonl`;

/** Appends notes to their day files (dedupe by noteId) and registers the days in the subtype manifest first, as facts do. */
function makeNoteWriter({s3json, prefix = 'record/'}) {
  const manifest = makeManifest(s3json);
  async function write(subtype, notes) {
    if (!SUBJECT_KIND[subtype]) throw new Error(`notes: unknown subtype ${subtype}`);
    const byDate = {};
    for (const n of notes) {
      if (n.subtype !== subtype) throw new Error(`notes: a ${n.subtype} note in a ${subtype} write`);
      (byDate[n.date] ||= []).push(n);
    }
    const days = Object.keys(byDate).sort();
    if (!days.length) return {appended: 0, skipped: 0, days};
    await manifest.addDays(`${prefix}notes/${subtype}/manifest.json`, days);
    let appended = 0;
    let skipped = 0;
    for (const d of days) {
      const r = await s3json.appendLines(notesKey(prefix, subtype, d), byDate[d], {idKey: 'noteId'});
      appended += r.appended;
      skipped += r.skipped;
    }
    return {appended, skipped, days};
  }
  return {write};
}

module.exports = {SCHEMA_VERSION, SUBJECT_KIND, ENTRY_PARTS, buildNote, entryNote, archiveEntryNotes, storyAnalysisNote, driftNote, makeNoteWriter, notesKey};
