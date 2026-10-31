// Backfill country facts notes (decision 0053): every current SummarizeAndPredict item PK FACTS#<country>, SK COUNTRY_FACTS
// becomes one country_facts note through shared notes.js (countryFactsNote), ISO3 from the shared resolveIso3. `at` is the item's
// lastUpdatedAt and no model wrote it (model null). A country that does not resolve is reported and skipped; a re-run appends
// nothing (same noteId). Only the current item exists (the weekly run replaces it), so one note per country.
//
//   node backfill-country-facts-notes.mjs [--live] [--dry] [--table T] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');
const { resolveIso3 } = require('../../shared/src/resolveIso3.js');

/** Pure: FACTS# items -> {notes, skipped (unresolved country or no lastUpdatedAt), failed}. */
export function planCountryFactsNotes({ items, producer }) {
  const notes = [];
  const skipped = [];
  const failed = [];
  for (const item of items) {
    if (!item || !String(item.PK || '').startsWith('FACTS#') || item.SK !== 'COUNTRY_FACTS') continue;
    const name = item.countryName || String(item.PK).replace(/^FACTS#/, '');
    const r = resolveIso3(name);
    if (!r) { skipped.push({ country: name, reason: 'no_iso3' }); continue; }
    try {
      const note = N.countryFactsNote({ item: { ...item, countryName: name }, iso3: r.iso3, producer });
      if (note) notes.push(note); else skipped.push({ country: name, reason: 'no_lastUpdatedAt' });
    } catch (e) { failed.push({ country: name, error: e.message }); }
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
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, FilterExpression: 'begins_with(PK, :p) AND SK = :s', ExpressionAttributeValues: { ':p': 'FACTS#', ':s': 'COUNTRY_FACTS' } }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const producer = { lambda: 'record/cli/backfill-country-facts-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planCountryFactsNotes({ items, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('country_facts', plan.notes);
  console.log(JSON.stringify({ prefix, items: items.length, notes: plan.notes.length, skipped: plan.skipped.length, failed: plan.failed.length, ...result, days: undefined }));
  for (const u of plan.skipped.slice(0, 20)) console.log('skipped', JSON.stringify(u));
  for (const f of plan.failed.slice(0, 20)) console.log('failed', JSON.stringify(f));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
