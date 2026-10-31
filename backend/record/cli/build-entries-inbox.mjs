// Build the entries inbox (decision 0051) from the NewsCache archive rows of the last N days, into LOCAL files, and prove that the facts built from the inbox
// are byte-identical to the facts built from the archive. Nothing is written to AWS: DynamoDB is read (GetItem on `archive#DAY` and `today-archive`,
// the same reads the nightly run makes), the inbox is written under --out in the bucket's layout (<out>/record/inbox/entries/DAY.jsonl), and the proof reads
// it back through the same code newsStoryRecord uses (ENTRIES_SOURCE=inbox).
//
//   node build-entries-inbox.mjs [--days 30] [--to YYYY-MM-DD] [--out DIR]
//   default: the 30 days up to today (UTC), out = ./entries-inbox-out. SDK: see sdk.mjs (RECORD_SDK_DIR).
//
// Each archive row becomes one batch per run (consecutive entries with the same generationId, batch = the newest archivedAt of the run), in the row's
// order, so replaying the lines gives the row exactly. The same files, uploaded to s3://<bucket>/record/inbox/entries/, are the backfill that lets
// newsStoryRecord read the 30-day window from the inbox before the agent has written 30 days of its own.
//
// The proof compares, for every day of the window: the normalised entries with their provenance (sourceKey, sourceRow, position), the `entry` fact entryFact
// builds from each (whole JSON), the story births, the thread of each topic, and the provisional facts a refresh builds for the last day. The only
// tolerated difference is named: entries the `today-archive` item adds to the last day (day-zero rule), which the inbox does not read.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const inbox = require('../../shared/src/entriesInbox.js');
const { entryFact, provisionalEntryFact } = require('../newsStoryRecord/src/facts.js');
const { makeStore } = require('../newsStoryRecord/src/store.js');
const { readInboxDays, rangeOfDays, compareEntries } = require('../newsStoryRecord/src/inboxEntries.js');

const TOPICS_TABLE = 'NewsCache';
const PREFIX = 'record/';

/** Pure: archive rows [{date, entries}] -> Map(date -> inbox lines), one batch per run (consecutive entries of one generation). */
export function inboxFromRows(rows) {
  const out = new Map();
  for (const { date, entries } of rows) {
    const lines = [];
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const batch = group.map((e) => e.archivedAt).filter(Boolean).sort().at(-1) || `${date}T00:00:00.000Z`;
      lines.push(...inbox.inboxLines(group, { batch: new Date(batch).toISOString() }));
      group = [];
    };
    for (const e of entries) {
      if (group.length && group[0].generationId !== e.generationId) flush();
      group.push(e);
    }
    flush();
    if (lines.length) out.set(date, lines);
  }
  return out;
}

/** The files of an inbox on disk, as the s3json reader readInboxDays wants it: getLines(key) over <dir>/<key>. */
export function localLines(dir) {
  return {
    async getLines(key) {
      const file = path.join(dir, key);
      if (!existsSync(file)) return { lines: [], etag: null };
      return { lines: readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)), etag: null };
    },
  };
}

export function writeInbox(dir, days) {
  for (const [date, lines] of days) {
    const file = path.join(dir, PREFIX, 'inbox/entries', `${date}.jsonl`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
  }
}

/**
 * Pure proof: the archive's range (world.archiveRange) against the inbox's, both as newsStoryRecord reads them. Returns the numbers and every difference.
 * `lastDay` is the day whose day-zero extras (today-archive entries the day row lacks) are expected on the archive side only.
 */
export function prove({ archive, fromInbox, lastDay, runId = 'proof' }) {
  const diff = compareEntries(archive, fromInbox);
  const factOf = (e) => JSON.stringify(entryFact(e, runId));
  const inboxByDay = new Map(fromInbox.days.map((d) => [d.date, d.entries]));
  let facts = 0;
  let bytes = 0;
  const mismatched = [];
  const extras = [];
  for (const day of archive.days) {
    const other = new Map((inboxByDay.get(day.date) || []).map((e) => [e.topicId, e]));
    for (const e of day.entries) {
      const o = other.get(e.topicId);
      if (!o) {
        if (day.date === lastDay && e.sourceRow.key.id === 'today-archive') extras.push(e.topicId);
        else mismatched.push({ date: day.date, topicId: e.topicId, why: 'missing in inbox' });
        continue;
      }
      const a = factOf(e);
      const b = factOf(o);
      facts += 1;
      bytes += Buffer.byteLength(a);
      if (a !== b) mismatched.push({ date: day.date, topicId: e.topicId, why: 'fact differs' });
    }
    // entries only the inbox has are always a difference
    const mine = new Set(day.entries.map((e) => e.topicId));
    for (const e of inboxByDay.get(day.date) || []) if (!mine.has(e.topicId)) mismatched.push({ date: day.date, topicId: e.topicId, why: 'only in inbox' });
  }
  const births = JSON.stringify(world.birthByThread(archive)) === JSON.stringify(world.birthByThread(fromInbox));
  const threads = (r) => JSON.stringify([...new Map(r.days.flatMap((d) => d.entries).filter((e) => e.topicId && e.threadId).map((e) => [e.topicId, e.threadId]))]);
  const threadOfTopic = threads(archive) === threads(fromInbox);
  const expected = new Set(extras);
  const unexplained = diff.differences.map((d) => ({ ...d, onlyArchive: d.onlyArchive.filter((t) => !expected.has(t)) })).filter((d) => d.onlyArchive.length || d.onlyInbox.length || d.changed.length || d.orderDiffers);
  return {
    days: archive.days.length, inboxDays: fromInbox.days.length, entries: archive.days.reduce((n, d) => n + d.entries.length, 0), factsCompared: facts, factBytesCompared: bytes,
    identical: !mismatched.length && !unexplained.length && births && threadOfTopic, births, threadOfTopic, todayArchiveExtras: extras.length, mismatched, unexplained,
  };
}

async function main() {
  const { values } = parseArgs({ options: { days: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' } } });
  const to = values.to || new Date().toISOString().slice(0, 10);
  const n = Number(values.days || 30);
  const from = world.addDays(to, 1 - n);
  const out = path.resolve(values.out || 'entries-inbox-out');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const client = world.makeClient({ async getItem(table, key) { return (await ddb.send(new GetCommand({ TableName: table, Key: key }))).Item || null; } }, {});
  const nowMs = Date.parse(`${to}T12:00:00Z`);

  // the archive path: exactly what the nightly run reads
  const archive = await world.archiveRange(client, from, to, { env: {}, nowMs });
  // the raw rows, to build the inbox from
  const rows = [];
  for (const d of world.eachDay(from, to)) {
    const item = await client.getItem(TOPICS_TABLE, { id: `archive#${d}` });
    if (item && Array.isArray(item.entries)) rows.push({ date: d, entries: item.entries });
  }
  const days = inboxFromRows(rows);
  writeInbox(out, days);

  // the inbox path: read the files back through newsStoryRecord's own reader
  const shim = localLines(out);
  const fromInbox = rangeOfDays(await readInboxDays(shim, PREFIX, from, to), from, to);
  const proof = prove({ archive, fromInbox, lastDay: to });

  // the provisional refresh (0050): today's entries, archive mode against inbox mode
  const archiveStore = makeStore(client, { env: {} });
  const inboxStore = makeStore(client, { env: { ENTRIES_SOURCE: 'inbox' }, s3json: shim });
  const a = (await archiveStore.loadDay(to, { prefix: PREFIX })).filter((e) => e.sourceRow.key.id !== 'today-archive');
  const b = await inboxStore.loadDay(to, { prefix: PREFIX });
  const refreshSame = JSON.stringify(a.map((e) => provisionalEntryFact(e, 'proof'))) === JSON.stringify(b.map((e) => provisionalEntryFact(e, 'proof')));

  console.log(JSON.stringify({ window: { from, to }, inboxPath: path.join(out, PREFIX, 'inbox/entries'), inboxFiles: days.size, inboxLines: [...days.values()].reduce((s, l) => s + l.length, 0), ...proof, refresh: { today: to, entries: b.length, provisionalFactsIdentical: refreshSame } }, null, 2));
  return proof.identical && refreshSame ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
