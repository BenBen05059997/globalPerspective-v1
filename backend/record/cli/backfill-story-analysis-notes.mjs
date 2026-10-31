// Backfill story analysis notes (decision 0042): every current SummarizeAndPredict item PK THREAD#<threadId>, SK THREAD_ANALYSIS
// becomes one story_analysis note through shared notes.js (storyAnalysisNote). `cites` = the eventIds of the thread's archive
// entries the analysis was built from, so the NewsCache archive#DAY rows for the days the record has facts for are read and
// indexed by threadId. A note whose thread has no story in record/views/index/all.json is reported and not written; a re-run
// appends nothing (same noteId). Only the current analysis exists: THREAD_HISTORY# rows are scalar snapshots (no storyArc,
// watch questions or actors; 60-day TTL; no model), too thin for a story_analysis note, so they are not backfilled.
//
//   node backfill-story-analysis-notes.mjs [--live] [--dry] [--prefix record/<name>/] [--table T] [--bucket B]
//   default writes under record/shadow/ and reads the views and facts of record/; --live writes record/; --prefix reads the views and facts of that
//   prefix and writes its notes there (a rehearsal of the history copy, 0047). Run it after the history facts and their views exist: the 202 stories
//   from before 2026-09-05 are matched then. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

/** Pure: stored THREAD_ANALYSIS items + archive rows {date, entries} + the record's story threadIds -> {notes, unmatched, failed}. */
export function planStoryAnalysisNotes({ items, rows, storyIds, producer }) {
  const byThread = new Map();
  for (const { date, entries } of rows) {
    for (const e of entries || []) {
      if (!e.threadId) continue;
      if (!byThread.has(e.threadId)) byThread.set(e.threadId, []);
      byThread.get(e.threadId).push({ topicId: e.topicId, date, title: e.title, sources: e.sources });
    }
  }
  const notes = [];
  const unmatched = [];
  const failed = [];
  for (const item of items) {
    if (!item || item.SK !== 'THREAD_ANALYSIS') continue;
    if (!storyIds.has(item.threadId)) { unmatched.push({ threadId: item.threadId, generatedAt: item.generatedAt }); continue; }
    try {
      const note = N.storyAnalysisNote({ item, entries: byThread.get(item.threadId) || [], producer });
      if (note) notes.push(note);
    } catch (e) { failed.push({ threadId: item.threadId, error: e.message }); }
  }
  return { notes, unmatched, failed };
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, prefix: { type: 'string' }, table: { type: 'string' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const table = values.table || process.env.SUMMARIZE_PREDICT_TABLE || 'SummarizeAndPredict';
  const prefix = values.prefix || (values.live ? 'record/' : 'record/shadow/');
  const readPrefix = values.prefix || 'record/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, FilterExpression: 'begins_with(PK, :p) AND SK = :s', ExpressionAttributeValues: { ':p': 'THREAD#', ':s': 'THREAD_ANALYSIS' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const storyIds = new Set(((await s3json.getJson(`${readPrefix}views/index/all.json`)) || { stories: [] }).stories.map((s) => s.threadId));
  const days = ((await s3json.getJson(`${readPrefix}facts/manifest.json`)) || { days: [] }).days;
  const rows = [];
  for (const date of days) {
    const { Item } = await ddb.send(new GetCommand({ TableName: 'NewsCache', Key: { id: `archive#${date}` } }));
    if (Item && Array.isArray(Item.entries)) rows.push({ date, entries: Item.entries });
  }
  const producer = { lambda: 'record/cli/backfill-story-analysis-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planStoryAnalysisNotes({ items, rows, storyIds, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('story_analysis', plan.notes);
  const noteDays = [...new Set(plan.notes.map((n) => n.date))];
  console.log(JSON.stringify({ prefix, items: items.length, archiveDays: days.length, archiveRows: rows.length, notes: plan.notes.length, withCites: plan.notes.filter((n) => n.cites.length).length, noteDays: noteDays.length, unmatched: plan.unmatched.length, failed: plan.failed.length, ...result, days: undefined }));
  for (const u of plan.unmatched.slice(0, 20)) console.log('unmatched', JSON.stringify(u));
  for (const f of plan.failed.slice(0, 20)) console.log('failed', JSON.stringify(f));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
