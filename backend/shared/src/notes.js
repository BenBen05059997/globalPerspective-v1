'use strict';

// Notes (decision 0042): the one builder and writer of record/notes/<subtype>/YYYY-MM-DD.jsonl, so every writer (a Lambda or
// the capture CLI) makes the same object. The shape is backend/record/schema/note.schema.json; buildNote checks the rules that
// keep notes consistent and throws instead of writing a bad note.
const {noteId, entryIdentity, pairKey} = require('./record');
const {makeManifest} = require('./manifest');

const SCHEMA_VERSION = 1;
const SUBJECT_KIND = {entry: 'entry', story_analysis: 'story', drift: 'country', country: 'country', link: 'pair', web: 'country', brief: 'brief'};
// TOPIC# sort key -> the entry note part
const ENTRY_PARTS = {SUMMARY: 'summary', PREDICTION: 'prediction', TRACE_CAUSE: 'cause'};
const ISO3 = /^[A-Z]{3}$/;
const BRIEF_ID = /^(daily:\d{4}-\d{2}-\d{2}|weekly:\d{4}-W\d{2})$/;

const text = (v) => typeof v === 'string' && v.length > 0;

/** -> a note object; throws on anything the schema would reject. `at` is when the model wrote it. */
function buildNote({subtype, subjectId, kind: subjectKind, part = '', threadId = null, iso3 = [], at, payload, cites = [], model, promptVersion = null, producer}) {
  const kind = subjectKind || SUBJECT_KIND[subtype];
  if (!SUBJECT_KIND[subtype]) throw new Error(`notes: unknown subtype ${subtype}`);
  if (subjectKind && subjectKind !== SUBJECT_KIND[subtype] && !(subtype === 'drift' && subjectKind === 'story')) throw new Error(`notes: a ${subtype} note's subject is not a ${subjectKind}`);
  if (!text(subjectId)) throw new Error(`notes: ${subtype} needs a subject id`);
  if (subtype === 'brief' && !BRIEF_ID.test(subjectId)) throw new Error(`notes: brief subject ${subjectId} is not daily:DATE or weekly:WEEK`);
  if (subtype === 'entry' && !Object.values(ENTRY_PARTS).includes(part)) throw new Error(`notes: entry part ${part}`);
  if (subtype === 'link' && !ISO3.test(part)) throw new Error(`notes: a link note's part is its country ISO3 (${part})`);
  if ((subtype === 'country' || subtype === 'web') && part !== '') throw new Error(`notes: a country or web note has no part (${part})`);
  if (subtype === 'entry' && !cites.length) throw new Error('notes: an entry note cites its entry');
  const when = Date.parse(at);
  if (!Number.isFinite(when)) throw new Error(`notes: ${subtype} needs a valid at`);
  if (!Array.isArray(iso3) || !iso3.every((c) => ISO3.test(c))) throw new Error(`notes: iso3 must be ISO3 codes (${iso3})`);
  if (!payload || typeof payload !== 'object') throw new Error('notes: payload must be an object');
  const copy = payload && (payload.from === 'archive' || payload.from === 'history' || payload.source === 'web-history');
  if (!text(model) && !(copy && model === null)) throw new Error('notes: model is required (null only on an archive, history or web-history copy)');
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

/**
 * The THREAD# / DRIFT# item newsDriftCorrector stores for a story (before PK/SK/ttl) + its threadId -> a drift note about the story
 * (same subtype and file as the country ones; subject kind 'story'). Payload = the stored fields (titles, scores, trigger event,
 * why; threadId stays, as the site read it); the stored items carry no countries, so iso3 is the item's if it has one, else [].
 * An archive copy (payload.from 'archive') has model null, as the country copies.
 */
function storyDriftNote({item, threadId, iso3, model, producer}) {
  return buildNote({
    subtype: 'drift', kind: 'story', subjectId: threadId, threadId, iso3: (item.iso3 || iso3 || []).filter((c) => ISO3.test(c)), at: item.generatedAt,
    payload: omit(item, ['PK', 'SK', 'ttl', 'generatedAt']), model, producer,
  });
}

/**
 * The COUNTRY# / COUNTRY_INTELLIGENCE item newsCountryIntelligence stores + the country's ISO3 -> a country note (part ''): the
 * day's briefing. Payload = the stored fields minus keys, ttl and the envelope's (generatedAt = at, model). The HISTORY# row of
 * the same run is a subset of this item, so it is not a second note (see countryHistoryNote for the backfill of older days).
 */
function countryNote({item, iso3, producer}) {
  if (!item || !text(item.countryName)) return null;
  return buildNote({
    subtype: 'country', subjectId: iso3, iso3: [iso3], at: item.generatedAt,
    payload: omit(item, ['PK', 'SK', 'ttl', 'generatedAt', 'model']), model: item.model, producer,
  });
}

/**
 * One COUNTRY# / HISTORY#<date> row (the day's risk point: score, level, dimensions, lead, trajectory, headline) -> a country
 * note copy for a day that has no briefing note: payload.from 'history', model null (the row did not record it). Backfill
 * only; the writer does not make these. Views prefer an exact note over a copy.
 */
function countryHistoryNote({item, iso3, producer}) {
  if (!item || !text(item.countryName)) return null;
  return buildNote({
    subtype: 'country', subjectId: iso3, iso3: [iso3], at: item.generatedAt,
    payload: {...omit(item, ['PK', 'SK', 'ttl', 'generatedAt', 'model', 'dateKey']), from: 'history'}, model: null, producer,
  });
}

/** Cited entries of a stored edge as the web records keep them: `cited` [{topicId, date, title}], or the older `citedEntries` ids. */
function citedOf(edge) {
  if (Array.isArray(edge.cited) && edge.cited.length) return edge.cited.map(({topicId, date, title}) => omit({topicId, date, title}, []));
  return (edge.citedEntries || []).map((topicId) => ({topicId}));
}

/** key of an archive entry in the cite index */
const citeKey = (date, topicId) => `${date}|${topicId}`;

/** archive entries [{topicId, date, title, sources}] -> Map(`date|topicId` -> eventId), shared entryIdentity as the entry facts use. */
function entryEventIdIndex(entries) {
  const index = new Map();
  for (const e of entries || []) {
    if (e && e.topicId && e.date) index.set(citeKey(e.date, e.topicId), entryIdentity({sources: e.sources, date: e.date, title: e.title}).eventId);
  }
  return index;
}

/**
 * One story-to-story edge of a SYSTEMS# country web (from, to = threadIds) -> a link note about the pair. Part = the web's
 * country ISO3 (the same pair can be read in two countries' webs; latest per country wins). Payload = the edge as the web index
 * keeps it plus the country name; threadId null (a pair; both ids are in the payload). `at` = the web's generatedAt, `model` its
 * model; a null `model` marks a copy rebuilt from the dated S3 web history (rows there did not record it): payload.source
 * 'web-history'. `cites` = eventIds of the cited entries found in `eventIds` (entryEventIdIndex); a cite not found is left out.
 */
function linkNote({edge, countryName, iso3, at, model, eventIds = new Map(), producer}) {
  if (!edge || !text(edge.from) || !text(edge.to) || edge.from === edge.to) return null;
  const cited = citedOf(edge);
  const cites = cited.map((c) => eventIds.get(citeKey(c.date, c.topicId))).filter(Boolean);
  return buildNote({
    subtype: 'link', subjectId: pairKey(edge.from, edge.to), part: iso3, iso3: [iso3], at,
    payload: {from: edge.from, to: edge.to, country: countryName, confidence: edge.confidence, lagDays: edge.lagDays ?? 0, mechanism: edge.mechanism, cited,
      ...(model === null ?{source: 'web-history'} : {})},
    cites, model, producer,
  });
}

/**
 * One SYSTEMS# country web (a row of newsSystemsAnalysis) -> a web note about its country (part ''): the web as a whole, which the
 * link notes cannot say. Payload = `country`, `nodes` (the threadIds in the web, whether or not they have an edge) and `backbone`
 * (the deterministic shared-actor edges, no model: from, to, sharedActors, weight). One per web and run, even a web with no edges,
 * so the newest web of a country is known and a story in it with no link is 'analysed, no links'. `at` = the web's generatedAt;
 * model as for linkNote (null only on a copy rebuilt from the dated web history: payload.source 'web-history').
 */
function webNote({row, iso3, at, model, producer}) {
  if (!row || !text(row.countryName)) return null;
  const nodes = [...new Set((row.nodes || []).map((n) => n && n.threadId).filter(text))];
  const backbone = (row.backbone || []).filter((b) => b && text(b.from) && text(b.to))
    .map((b) => ({from: b.from, to: b.to, sharedActors: (b.sharedActors || []).filter(text), weight: b.weight || (b.sharedActors || []).length}));
  return buildNote({
    subtype: 'web', subjectId: iso3, iso3: [iso3], at: at || row.generatedAt,
    payload: {country: row.countryName, nodes, backbone, ...(model === null ? {source: 'web-history'} : {})}, model, producer,
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

module.exports = {SCHEMA_VERSION, SUBJECT_KIND, ENTRY_PARTS, buildNote, entryNote, archiveEntryNotes, storyAnalysisNote, driftNote, storyDriftNote, countryNote, countryHistoryNote, linkNote, webNote, entryEventIdIndex, citedOf, makeNoteWriter, notesKey};
