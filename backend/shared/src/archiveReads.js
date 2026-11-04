'use strict';

// Reads of the world the record already holds (decision 0035 step 5d), shared by the agent and the Lambdas that read the NewsCache archive.
// One switch shape for all of them:
//
//   ARCHIVE_READS  ddb (default) | inbox (record/inbox/entries/DAY.jsonl, under ENTRIES_INBOX_PREFIX) | compare
//
// compare reads both, answers from DynamoDB and logs every difference. Anything else is ddb, so a typo never changes what a Lambda reads;
// inbox/compare with the prefix unset is ddb too. The replay rules are the shared ones (entriesInbox.replayDay / replayToday); this file only
// shapes what they give into what the DynamoDB reads gave. No clock except `now` (injectable), no AWS SDK (the S3 object reader is injected).

const { replayDay, replayToday } = require('./entriesInbox');
const { keepDayZero } = require('./dayZero');

const DEFAULT_WORLD_BUCKET = 'globalperspective-world-280362093938';
const MODES = ['ddb', 'inbox', 'compare'];
const TODAY_SOURCES = 3; // the `today-archive` item keeps 3 sources per entry (recordReads.TODAY_SOURCES); the inbox line holds up to 10

/** The switch value: 'ddb' | 'inbox' | 'compare'. Unknown, or inbox/compare without the inbox prefix, is 'ddb' (logged). */
function readMode(name, value, prefix, log = console) {
  const v = String(value || 'ddb').trim().toLowerCase();
  if (!MODES.includes(v)) { log.warn(`${name}=${value} is not ddb|inbox|compare: reading DynamoDB`); return 'ddb'; }
  if (v !== 'ddb' && !prefix) { log.warn(`${name}=${v} needs the inbox prefix the agent writes to: reading DynamoDB`); return 'ddb'; }
  return v;
}

/** mode ddb: ddb(); inbox: inbox() (no DynamoDB call); compare: both, the DynamoDB answer, every difference (diff(ddb, inbox) -> [..]) logged. */
async function readBy({ mode, tag, label, ddb, inbox, diff, log = console }) {
  if (mode === 'inbox') return inbox();
  const fromDdb = await ddb();
  if (mode !== 'compare') return fromDdb;
  try {
    const d = diff(fromDdb, await inbox());
    if (d.length) log.warn(`[${tag}] ${label}: DIFFER ${d.length} ${JSON.stringify(d.slice(0, 10))}`);
    else log.log(`[${tag}] ${label}: equal`);
  } catch (e) {
    log.warn(`[${tag}] ${label}: inbox read failed (${e.message})`);
  }
  return fromDdb;
}

/** A day's entries-inbox lines -> the `archive#DAY` item as DynamoDB holds it after the same writes ({updatedAt, entries}), or null (no row). */
function archiveOfLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const { entries, updatedAt } = replayDay(lines);
  return { updatedAt, entries };
}

// Equal as data: DynamoDB hands a map back with its keys in another order than they were put (and than the inbox line keeps them).
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const sameJson = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** The lines of <prefix>inbox/<kind>/DAY.jsonl through a shared s3json ([] when the day has no file); a read error throws. */
async function inboxDayLines(s3json, prefix, kind, day) {
  return (await s3json.getLines(`${prefix}inbox/${kind}/${day}.jsonl`)).lines;
}

/**
 * readDay(day) for the Lambdas that read the entries inbox from the world bucket (env WORLD_BUCKET, default the world store; region
 * AWS_REGION): the S3 client is required on first use, as s3NoteWriter does, so a Lambda on ddb loads without the SDK.
 */
function s3EntriesDay(prefix) {
  let json;
  return (day) => {
    if (!json) {
      const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
      const { makeS3Json } = require('./s3json');
      json = makeS3Json({ client: new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' }), GetObjectCommand, PutObjectCommand, bucket: process.env.WORLD_BUCKET || DEFAULT_WORLD_BUCKET });
    }
    return inboxDayLines(json, prefix, 'entries', day);
  };
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Differences between two archive items' entries, by topicId, on WHOLE entries (ai and sources included): [] when equal. */
function diffRows(a, b) {
  const ea = a && Array.isArray(a.entries) ? a.entries : [];
  const eb = b && Array.isArray(b.entries) ? b.entries : [];
  const ma = new Map(ea.map((e) => [e.topicId, e]));
  const mb = new Map(eb.map((e) => [e.topicId, e]));
  const out = [];
  for (const [id, e] of ma) {
    if (!mb.has(id)) out.push({ topicId: id, only: 'ddb' });
    else if (!sameJson(e, mb.get(id))) out.push({ topicId: id, fields: Object.keys({ ...e, ...mb.get(id) }).filter((k) => !sameJson(e[k], mb.get(id)[k])) });
  }
  for (const id of mb.keys()) if (!ma.has(id)) out.push({ topicId: id, only: 'inbox' });
  if (!out.length && ea.some((e, i) => e.topicId !== eb[i].topicId)) out.push({ order: 'differs' });
  return out;
}

/**
 * A drop-in getRow(key) for readArchiveEntries ({Item} for `archive#DAY` and `today-archive`; other keys always go to DynamoDB).
 *   ddbGetRow(key) -> the DynamoDB response   readDay(day) -> that day's entries-inbox lines ([] for a day with no file; errors throw)
 * inbox: no DynamoDB call; a day with no lines is {Item: null} (a missing row). `today-archive` is today's lines replayed with the 24 h rule,
 * 10 sources per entry like the other days. compare: both, DynamoDB answered, differences logged as `[archive-compare] <key>: equal | DIFFER n [..]`;
 * for `today-archive` both sides are cut to today's entries (the reader's own day-zero rule) and the inbox side to 3 sources, as the item holds.
 * Each day file is read once per reader, so create one per invocation.
 */
function archiveRowReader({ mode, prefix, ddbGetRow, readDay, log = console, now = () => Date.now() }) {
  const m = readMode('ARCHIVE_READS', mode, prefix, log);
  if (m === 'ddb') return ddbGetRow;
  const days = new Map();
  const lines = (day) => days.get(day) || days.set(day, Promise.resolve(readDay(day))).get(day);
  const isToday = (key) => key === 'today-archive';
  const inboxItem = async (key) => {
    if (isToday(key)) {
      const l = await lines(isoDay(now()));
      return Array.isArray(l) && l.length ? replayToday(l) : null;
    }
    return archiveOfLines(await lines(key.slice('archive#'.length)));
  };
  return async (key) => {
    if (!isToday(key) && !String(key).startsWith('archive#')) return ddbGetRow(key);
    return readBy({
      mode: m, log, tag: 'archive-compare', label: key,
      ddb: () => ddbGetRow(key),
      inbox: async () => ({ Item: await inboxItem(key) }),
      diff: (fromDdb, fromInbox) => {
        let a = fromDdb && fromDdb.Item;
        let b = fromInbox && fromInbox.Item;
        if (isToday(key)) {
          const cut = (item, f) => (item && Array.isArray(item.entries) ? { entries: keepDayZero(item.entries, now()).map(f) } : null);
          a = cut(a, (e) => e);
          b = cut(b, (e) => (Array.isArray(e.sources) ? { ...e, sources: e.sources.slice(0, TODAY_SOURCES) } : e));
        }
        return diffRows(a, b);
      },
    });
  };
}

module.exports = { MODES, TODAY_SOURCES, readMode, readBy, sameJson, archiveOfLines, inboxDayLines, s3EntriesDay, diffRows, archiveRowReader };
