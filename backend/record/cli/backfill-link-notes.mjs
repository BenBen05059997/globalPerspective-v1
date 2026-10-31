// Backfill link notes (decision 0042): every causal edge of the country webs becomes a `link` note about its story pair, through
// the same planner the Lambda uses (newsSystemsAnalysis recordNotes.js). Sources, read-only:
//  - the current SYSTEMS# / SYSTEMS_ANALYSIS rows (the webs WEB#INDEX/LATEST is built from; they carry the model),
//  - the dated S3 web history web/YYYY/MM/DD.json (`webs`, from 2026-10-19): a web there that is not also a current row has no
//    recorded model, so its notes are copies (model null, payload.source 'web-history').
// Cites: eventIds of the cited entries, found in the NewsCache archive rows of the cited days (a cite not found is left out).
// Each web (current and history) is also one `web` note (its nodes and shared-actor backbone), so a web with no edge is in the record.
// A re-run appends nothing (same noteId). WEB#INDEX/LATEST is read only to compare its link count with the planned notes.
//
//   node backfill-link-notes.mjs [--live] [--dry] [--no-history] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');
const { planLinkNotes, planWebNotes } = require('../../pipeline/newsSystemsAnalysis/src/recordNotes.js');

const NOTE_TABLE = 'SummarizeAndPredict';
const TOPICS_TABLE = 'NewsCache';
const LAMBDA = 'record/cli/backfill-link-notes';

const rowKey = (r) => `${r.countryName}|${r.generatedAt}`;

/**
 * Pure: current webs (with model), dated history files [{date, webs}] and archive entries -> {notes, webNotes, skipped, counts}.
 * A history web already covered by a current row (same country and generatedAt) is not planned again.
 */
export function planBackfillLinks({ current, history = [], entries = [], runId }) {
  const have = new Set(current.map(rowKey));
  const copies = new Map();
  for (const { webs } of history) for (const w of webs || []) if (w && w.generatedAt && !have.has(rowKey(w))) copies.set(rowKey(w), { ...w, model: null });
  const a = planLinkNotes({ rows: current, entries, model: null, runId, lambda: LAMBDA });
  const b = planLinkNotes({ rows: [...copies.values()], entries, model: null, runId, lambda: LAMBDA });
  const wa = planWebNotes({ rows: current, model: null, runId, lambda: LAMBDA });
  const wb = planWebNotes({ rows: [...copies.values()], model: null, runId, lambda: LAMBDA });
  const once = (list) => [...new Map(list.map((n) => [n.noteId, n])).values()];
  return { notes: once([...a.notes, ...b.notes]), webNotes: once([...wa.notes, ...wb.notes]), skipped: [...a.skipped, ...b.skipped], counts: { current: a.notes.length, history: b.notes.length, historyWebs: copies.size } };
}

/** The (date, topicId) cites of the webs, as the archive days they live in. */
export const citedDays = (rows) => [...new Set(rows.flatMap((r) => (r.edges || []).flatMap((e) => (e.cited || []).map((c) => c.date)).filter(Boolean)))].sort();

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, 'no-history': { type: 'boolean' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand, GetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const client = new s3sdk.S3Client({ region: REGION });
  const s3json = makeS3Json({ client, GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const current = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: NOTE_TABLE, FilterExpression: 'begins_with(PK, :p) AND SK = :s', ExclusiveStartKey,
      ExpressionAttributeValues: { ':p': 'SYSTEMS#', ':s': 'SYSTEMS_ANALYSIS' } }));
    current.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  const index = (await ddb.send(new GetCommand({ TableName: NOTE_TABLE, Key: { PK: 'WEB#INDEX', SK: 'LATEST' } }))).Item || {};

  const history = [];
  if (!values['no-history']) {
    const keys = [];
    let ContinuationToken;
    do {
      const r = await client.send(new s3sdk.ListObjectsV2Command({ Bucket: bucket, Prefix: 'web/', ContinuationToken }));
      keys.push(...(r.Contents || []).map((o) => o.Key).filter((k) => /^web\/\d{4}\/\d{2}\/\d{2}\.json$/.test(k)));
      ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (ContinuationToken);
    for (const key of keys.sort()) { const day = await s3json.getJson(key); if (day) history.push({ date: key.slice(4, 14).replace(/\//g, '-'), webs: day.webs || [] }); }
  }

  const entries = [];
  for (const date of citedDays([...current, ...history.flatMap((h) => h.webs)])) {
    const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: `archive#${date}` } }));
    for (const e of (Item && Item.entries) || []) entries.push({ topicId: e.topicId, date, title: e.title, sources: e.sources });
  }

  const plan = planBackfillLinks({ current, history, entries, runId: `backfill-${new Date().toISOString()}` });
  const writer = N.makeNoteWriter({ s3json, prefix });
  const webResult = values.dry ? { dry: true } : await writer.write('web', plan.webNotes);
  const result = values.dry ? { dry: true } : await writer.write('link', plan.notes);
  const withCites = plan.notes.filter((n) => n.cites.length).length;
  console.log(JSON.stringify({ prefix, currentWebs: current.length, historyDays: history.length, indexLinks: (index.links || []).length, archiveEntries: entries.length, ...plan.counts,
    notes: plan.notes.length, webNotes: plan.webNotes.length, webAppended: webResult.appended, withCites, skipped: plan.skipped.length, ...result, days: undefined }));
  for (const s of plan.skipped.slice(0, 20)) console.log('skipped', JSON.stringify(s));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
