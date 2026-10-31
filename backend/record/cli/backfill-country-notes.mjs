// Backfill country notes (decision 0042): every current COUNTRY# / COUNTRY_INTELLIGENCE item becomes a full `country` note (its
// own generatedAt and model), and every older COUNTRY# / HISTORY#<date> row becomes a reduced history copy (payload.from
// 'history', model null: the row did not record it) through shared notes.js. A HISTORY# row written by the same run as a
// briefing item (same generatedAt) is that briefing's subset and is not a second note. A country name with no ISO3 is
// reported and skipped; a re-run appends nothing (same noteId). Views prefer an exact note over a copy.
//
//   node backfill-country-notes.mjs [--live] [--dry] [--no-history] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');
const { resolveIso3 } = require('../../shared/src/resolveIso3.js');

const NOTE_TABLE = 'SummarizeAndPredict';

/** Pure: briefing items and HISTORY# rows (as stored) -> {notes, skipped, counts}. */
export function planCountryNotes({ items, history = [], producer }) {
  const notes = [];
  const skipped = [];
  const seen = new Set();
  const add = (build, row) => {
    let note;
    try { note = build(); } catch (e) { skipped.push({ key: `${row.PK}/${row.SK}`, reason: e.message }); return; }
    if (!note) { skipped.push({ key: `${row.PK}/${row.SK}`, reason: 'no_content' }); return; }
    if (seen.has(note.noteId)) { skipped.push({ key: `${row.PK}/${row.SK}`, reason: 'same_run_as_briefing' }); return; }
    seen.add(note.noteId);
    notes.push(note);
  };
  const iso3Of = (row) => {
    const r = resolveIso3(row.countryName);
    if (!r) skipped.push({ key: `${row.PK}/${row.SK}`, reason: 'no_iso3', country: row.countryName });
    return r && r.iso3;
  };
  for (const item of items) { const iso3 = iso3Of(item); if (iso3) add(() => N.countryNote({ item, iso3, producer }), item); }
  for (const row of history) { const iso3 = iso3Of(row); if (iso3) add(() => N.countryHistoryNote({ item: row, iso3, producer }), row); }
  return { notes, skipped, counts: { briefings: notes.filter((n) => !n.payload.from).length, history: notes.filter((n) => n.payload.from === 'history').length } };
}

async function scan(ddb, ScanCommand, filter, values) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: NOTE_TABLE, FilterExpression: filter, ExpressionAttributeValues: values, ExclusiveStartKey }));
    out.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, 'no-history': { type: 'boolean' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const items = await scan(ddb, ScanCommand, 'begins_with(PK, :p) AND SK = :s', { ':p': 'COUNTRY#', ':s': 'COUNTRY_INTELLIGENCE' });
  const history = values['no-history'] ? [] : await scan(ddb, ScanCommand, 'begins_with(PK, :p) AND begins_with(SK, :s)', { ':p': 'COUNTRY#', ':s': 'HISTORY#' });
  const producer = { lambda: 'record/cli/backfill-country-notes', runId: `backfill-${new Date().toISOString()}` };
  const plan = planCountryNotes({ items, history, producer });
  const result = values.dry ? { dry: true } : await N.makeNoteWriter({ s3json, prefix }).write('country', plan.notes);
  console.log(JSON.stringify({ prefix, briefingItems: items.length, historyRows: history.length, ...plan.counts, skipped: plan.skipped.length, ...result, days: undefined }));
  const reasons = {};
  for (const s of plan.skipped) reasons[s.reason] = (reasons[s.reason] || 0) + 1;
  console.log('skipped by reason', JSON.stringify(reasons));
  for (const s of plan.skipped.filter((x) => x.reason === 'no_iso3').slice(0, 20)) console.log('skipped', JSON.stringify(s));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
