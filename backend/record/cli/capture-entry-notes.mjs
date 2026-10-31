// Capture the agent's per-entry notes (TOPIC# SUMMARY, PREDICTION, TRACE_CAUSE) into record/notes/entry/ (decision 0042).
// The agent keeps only the current generation (older ones are pruned, and each item has a ttl), so a run copies what exists now;
// a note already stored is skipped (same noteId). Every note's subject must be an existing entry fact: an unmatched one is
// reported and not written.
//
//   node capture-entry-notes.mjs [--live] [--dry] [--bucket B]
//   default writes under record/shadow/; --live writes record/; --dry builds and checks only.
// SDK: see sdk.mjs (RECORD_SDK_DIR). Reads DynamoDB SummarizeAndPredict and NewsCache, reads and writes S3.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

const NOTE_TABLE = 'SummarizeAndPredict';
const TOPICS_TABLE = 'NewsCache';
const LOOKBACK_DAYS = 100; // as newsStoryRecord: an article seen again keeps the eventId of its first entry fact, up to 100 days back

/** Pure: TOPIC# items + the topics they were written for -> {notes, unmatched, skipped}. `knownEventIds` = entry facts. */
export function planEntryNotes({ items, topics, archiveDate, knownEventIds, producer }) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const notes = [];
  const unmatched = [];
  const skipped = [];
  for (const item of items) {
    const topic = byId.get(item.topicId);
    if (!topic) { skipped.push({ topicId: item.topicId, SK: item.SK, reason: 'topic_not_in_latest' }); continue; }
    const note = N.entryNote({ item, topic, archiveDate, producer });
    if (!note) { skipped.push({ topicId: item.topicId, SK: item.SK, reason: 'no_content' }); continue; }
    if (!knownEventIds.has(note.subject.id)) { unmatched.push({ topicId: item.topicId, part: note.part, eventId: note.subject.id }); continue; }
    notes.push(note);
  }
  return { notes, unmatched, skipped };
}

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand, GetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: NOTE_TABLE, FilterExpression: 'begins_with(PK, :p) AND SK IN (:a, :b, :c)', ExclusiveStartKey,
      ExpressionAttributeValues: { ':p': 'TOPIC#', ':a': 'SUMMARY', ':b': 'PREDICTION', ':c': 'TRACE_CAUSE' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const latest = (await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: 'latest' } }))).Item || {};
  const archiveDate = (latest.activatedAt || latest.updatedAt || new Date().toISOString()).slice(0, 10);
  // entry facts live in record/facts/ (never shadow): the subject of a note is a real fact, recorded on its first day
  const factDays = ((await s3json.getJson('record/facts/manifest.json')) || { days: [] }).days.filter((d) => d >= addDays(archiveDate, -LOOKBACK_DAYS) && d <= addDays(archiveDate, 1));
  const knownEventIds = new Set();
  for (const d of factDays) for (const f of (await s3json.getLines(`record/facts/${d}.jsonl`)).lines) if (f.kind === 'entry') knownEventIds.add(f.eventId);

  const producer = { lambda: 'record/cli/capture-entry-notes', runId: `capture-${new Date().toISOString()}` };
  const plan = planEntryNotes({ items, topics: latest.topics || [], archiveDate, knownEventIds, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('entry', plan.notes);
  console.log(JSON.stringify({ prefix, archiveDate, items: items.length, notes: plan.notes.length, unmatched: plan.unmatched.length, skipped: plan.skipped.length, ...result }));
  for (const u of plan.unmatched) console.log('unmatched', JSON.stringify(u));
  for (const s of plan.skipped) console.log('skipped', JSON.stringify(s));
  return plan.unmatched.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
