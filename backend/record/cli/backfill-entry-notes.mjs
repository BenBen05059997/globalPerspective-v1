// Backfill entry notes from the NewsCache archive (decision 0042): for every day the record has facts for, each archived
// entry's stored ai texts (summary, forecast, cause; cut at 1,500 characters by the agent) become archive-copy entry notes
// (format 'text', model null, payload.from 'archive') through shared notes.js. A note whose subject is not an entry fact is
// reported and not written; a re-run appends nothing (same noteId). Views prefer an exact note over a copy.
//
//   node backfill-entry-notes.mjs [--live] [--dry] [--prefix record/<name>/] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--bucket B]
//   default writes under record/shadow/ and reads the facts of record/; --live writes record/; --prefix reads the facts of that prefix and writes
//   its notes there (a rehearsal of the history copy, 0047). The days are the facts manifest's, so the pre-record days are covered once their facts exist. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

const TOPICS_TABLE = 'NewsCache';

/** Pure: archive rows {date, entries} -> {notes, unmatched, entries}. `knownEventIds` = entry facts. */
export function planArchiveNotes({ rows, knownEventIds, producer }) {
  const notes = [];
  const unmatched = [];
  let entries = 0;
  for (const { date, entries: list } of rows) {
    for (const entry of list || []) {
      entries += 1;
      for (const note of N.archiveEntryNotes({ entry, archiveDate: date, producer })) {
        if (knownEventIds.has(note.subject.id)) notes.push(note);
        else unmatched.push({ date, topicId: entry.topicId, part: note.part, eventId: note.subject.id });
      }
    }
  }
  return { notes, unmatched, entries };
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, prefix: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.prefix || (values.live ? 'record/' : 'record/shadow/');
  const readPrefix = values.prefix || 'record/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const factDays = ((await s3json.getJson(`${readPrefix}facts/manifest.json`)) || { days: [] }).days;
  const knownEventIds = new Set();
  for (const d of factDays) for (const f of (await s3json.getLines(`${readPrefix}facts/${d}.jsonl`)).lines) if (f.kind === 'entry') knownEventIds.add(f.eventId);

  const days = factDays.filter((d) => (!values.from || d >= values.from) && (!values.to || d <= values.to));
  const rows = [];
  for (const date of days) {
    const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: `archive#${date}` } }));
    if (Item && Array.isArray(Item.entries)) rows.push({ date, entries: Item.entries });
  }
  const producer = { lambda: 'record/cli/backfill-entry-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planArchiveNotes({ rows, knownEventIds, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('entry', plan.notes);
  console.log(JSON.stringify({ prefix, days: days.length, archiveRows: rows.length, entries: plan.entries, notes: plan.notes.length, unmatched: plan.unmatched.length, ...result, days_: undefined }));
  for (const u of plan.unmatched.slice(0, 20)) console.log('unmatched', JSON.stringify(u));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
