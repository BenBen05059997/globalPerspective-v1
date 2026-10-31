// Backfill story history notes (decision 0053): every SummarizeAndPredict item PK THREAD#<threadId>, SK THREAD_HISTORY#<date> (the
// day's scalar read of a story: title, trajectory, score, dimensions, lead, entry count; 338 rows, one per story and day) becomes one
// story_history note copy through shared notes.js (storyHistoryNote): payload.from 'history', model null (the row did not record it).
// newsDriftCorrector and the board read these as the story's score history. Every story_analysis note carries the same scalars, so
// the readers (shared noteReads.threadHistory) take the analysis note for a day that has one and this copy for the days before the
// analysis notes began. A re-run appends nothing (same noteId).
//
//   node backfill-story-history-notes.mjs [--live] [--dry] [--table T] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

/** Pure: THREAD_HISTORY# items -> {notes, skipped (no generatedAt or thread), failed}. */
export function planStoryHistoryNotes({ items, producer }) {
  const notes = [];
  const skipped = [];
  const failed = [];
  for (const item of items) {
    if (!item || !String(item.PK || '').startsWith('THREAD#') || !String(item.SK || '').startsWith('THREAD_HISTORY#')) continue;
    const threadId = item.threadId || String(item.PK).replace(/^THREAD#/, '');
    try {
      const note = N.storyHistoryNote({ item: { ...item, threadId, dateKey: item.dateKey || String(item.SK).replace('THREAD_HISTORY#', '') }, producer });
      if (note) notes.push(note); else skipped.push({ threadId, sk: item.SK });
    } catch (e) { failed.push({ threadId, sk: item.SK, error: e.message }); }
  }
  return { notes, skipped, failed };
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, table: { type: 'string' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const table = values.table || process.env.SUMMARIZE_PREDICT_TABLE || 'SummarizeAndPredict';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, FilterExpression: 'begins_with(PK, :p) AND begins_with(SK, :s)', ExpressionAttributeValues: { ':p': 'THREAD#', ':s': 'THREAD_HISTORY#' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const producer = { lambda: 'record/cli/backfill-story-history-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planStoryHistoryNotes({ items, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('story_history', plan.notes);
  console.log(JSON.stringify({ prefix, items: items.length, notes: plan.notes.length, stories: new Set(plan.notes.map((n) => n.subject.id)).size, noteDays: new Set(plan.notes.map((n) => n.date)).size, skipped: plan.skipped.length, failed: plan.failed.length, ...result, days: undefined }));
  for (const u of plan.skipped.slice(0, 20)) console.log('skipped', JSON.stringify(u));
  for (const f of plan.failed.slice(0, 20)) console.log('failed', JSON.stringify(f));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
