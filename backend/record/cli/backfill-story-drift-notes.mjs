// Backfill story drift notes (decision 0042): every THREAD#<threadId> / DRIFT#<date> item (newsDriftCorrector's story-level
// "what changed" row, 60-day TTL) becomes one drift note about the story through shared notes.js (storyDriftNote). The items
// store no model, so each note is an archive copy: model null and payload.from 'archive' (as the country drift copies), never
// the Lambda's current configured model. A story that is not in record/views/index/all.json is reported and not written; a
// re-run appends nothing (same noteId). Country drift is backfill-drift-notes.mjs (same notes/drift/ files).
//
//   node backfill-story-drift-notes.mjs [--live] [--dry] [--prefix record/<name>/] [--table T] [--bucket B]
//   default writes under record/shadow/ and reads the views of record/; --live writes record/; --prefix reads the views of that prefix and writes
//   its notes there (a rehearsal of the history copy, 0047). SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

const threadOf = (item) => item.threadId || String(item.PK || '').replace(/^THREAD#/, '');

/** Pure: THREAD# DRIFT# items + the record's story threadIds -> {notes, unmatched (story not in the record), failed}. */
export function planStoryDriftNotes({ items, storyIds, producer }) {
  const notes = [];
  const unmatched = [];
  const failed = [];
  for (const item of items) {
    if (!item || !String(item.PK || '').startsWith('THREAD#') || !String(item.SK || '').startsWith('DRIFT#')) continue;
    const threadId = threadOf(item);
    if (!storyIds.has(threadId)) { unmatched.push({ threadId, asOf: item.asOf }); continue; }
    try {
      notes.push(N.storyDriftNote({ item: { ...item, threadId, from: 'archive' }, threadId, model: null, producer }));
    } catch (e) { failed.push({ threadId, asOf: item.asOf, error: e.message }); }
  }
  return { notes, unmatched, failed };
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, prefix: { type: 'string' }, table: { type: 'string' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const table = values.table || process.env.SUMMARIZE_PREDICT_TABLE || 'SummarizeAndPredict';
  const prefix = values.prefix || (values.live ? 'record/' : 'record/shadow/');
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, FilterExpression: 'begins_with(PK, :p) AND begins_with(SK, :s)', ExpressionAttributeValues: { ':p': 'THREAD#', ':s': 'DRIFT#' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const storyIds = new Set(((await s3json.getJson(`${values.prefix || 'record/'}views/index/all.json`)) || { stories: [] }).stories.map((s) => s.threadId));
  const producer = { lambda: 'record/cli/backfill-story-drift-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planStoryDriftNotes({ items, storyIds, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('drift', plan.notes);
  console.log(JSON.stringify({ prefix, items: items.length, notes: plan.notes.length, stories: new Set(plan.notes.map((n) => n.subject.id)).size, noteDays: new Set(plan.notes.map((n) => n.date)).size, unmatched: plan.unmatched.length, failed: plan.failed.length, ...result, days: undefined }));
  for (const u of plan.unmatched.slice(0, 20)) console.log('unmatched', JSON.stringify(u));
  for (const f of plan.failed.slice(0, 20)) console.log('failed', JSON.stringify(f));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
