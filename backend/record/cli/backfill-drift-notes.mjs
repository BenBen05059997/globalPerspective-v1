// Backfill drift notes (decision 0042): every COUNTRY#<name> / DRIFTLOG#<date> item (the permanent drift archive, no TTL; the
// DRIFT# rows are the same items with a 60-day TTL) becomes one drift note through shared notes.js (driftNote), ISO3 from the
// shared resolveIso3. A country that does not resolve is reported and skipped. The items store no model, so each note is an
// archive copy: model null and payload.from 'archive' (as the entry copies), never the Lambda's current configured model,
// which may not be what wrote an older note. A re-run appends nothing (same noteId).
//
//   node backfill-drift-notes.mjs [--live] [--dry] [--table T] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');
const { resolveIso3 } = require('../../shared/src/resolveIso3.js');

const countryOf = (item) => item.countryName || String(item.PK || '').replace(/^COUNTRY#/, '');

/** Pure: DRIFTLOG# items -> {notes, skipped (unresolved country), failed}. */
export function planDriftNotes({ items, producer }) {
  const notes = [];
  const skipped = [];
  const failed = [];
  for (const item of items) {
    if (!item || !String(item.PK || '').startsWith('COUNTRY#') || !String(item.SK || '').startsWith('DRIFTLOG#')) continue;
    const name = countryOf(item);
    const r = resolveIso3(name);
    if (!r) { skipped.push({ country: name, asOf: item.asOf }); continue; }
    try {
      notes.push(N.driftNote({ item: { ...item, from: 'archive' }, iso3: r.iso3, model: null, producer }));
    } catch (e) { failed.push({ country: name, asOf: item.asOf, error: e.message }); }
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
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, FilterExpression: 'begins_with(PK, :p) AND begins_with(SK, :s)', ExpressionAttributeValues: { ':p': 'COUNTRY#', ':s': 'DRIFTLOG#' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const producer = { lambda: 'record/cli/backfill-drift-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planDriftNotes({ items, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('drift', plan.notes);
  console.log(JSON.stringify({ prefix, items: items.length, notes: plan.notes.length, noteDays: new Set(plan.notes.map((n) => n.date)).size, skipped: plan.skipped.length, failed: plan.failed.length, ...result, days: undefined }));
  for (const u of plan.skipped.slice(0, 20)) console.log('skipped (no ISO3)', JSON.stringify(u));
  for (const f of plan.failed.slice(0, 20)) console.log('failed', JSON.stringify(f));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
