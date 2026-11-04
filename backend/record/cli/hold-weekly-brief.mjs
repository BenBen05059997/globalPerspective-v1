// Hold a weekly brief back from the web path, or publish it again (decision 0048). Setting `status: draft` on the DynamoDB row
// WEEKLY_BRIEF#<weekOf> holds back only the weekly_brief action and the email; the record's views are built from append-only
// weekly_brief notes, so they keep serving it until a LATER note says otherwise. This appends that later note: the newest note of
// the week with the same content, `status` 'draft' (hold) or 'published' (--publish), `at` after the newest note so
// newsStoryRecord's latest-`at` rule picks it up. With the next views rebuild (after every ingest and brief, and nightly) a held
// week leaves index/briefs.json and its briefs/weekly/<weekOf>.json becomes a tombstone ({held: true, brief: null}).
// Needs the newsStoryRecord that writes the tombstone deployed: before that the old file stays in S3 (the index drops it either way).
//
//   node hold-weekly-brief.mjs --week YYYY-MM-DD [--publish] [--row] [--write] [--prefix record/] [--bucket B]
// Dry run by default: prints the note (and the row update with --row) and writes nothing. --write appends the note; --row also
// sets the DynamoDB row's status so the action and the email agree (conditional on the row existing). SDK: see sdk.mjs.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const N = require('../../shared/src/notes.js');
const { makeS3Json } = require('../../shared/src/s3json.js');

const NOTE_TABLE = 'SummarizeAndPredict';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The newest note of the week by the view builder's rule (`at`, then noteId), or null. */
export function newestWeekNote(noteLines, weekOf) {
  let newest = null;
  for (const n of noteLines) {
    if (n.subtype !== 'weekly_brief' || n.subject.id !== `weekly:${weekOf}`) continue;
    if (!newest || n.at > newest.at || (n.at === newest.at && n.noteId > newest.noteId)) newest = n;
  }
  return newest;
}

/**
 * -> {noop: true, reason} when the newest note already has `status`, else {note}: that note's content with the new status and an `at`
 * strictly after it (now, or 1 ms past the newest note when the clock is behind it), so it is the one the views choose.
 */
export function planHold({ noteLines, weekOf, status, now = new Date(), producer }) {
  if (!DAY.test(weekOf || '')) throw new Error('--week must be a weekOf, YYYY-MM-DD');
  if (!['draft', 'published'].includes(status)) throw new Error(`status ${status}`);
  const newest = newestWeekNote(noteLines, weekOf);
  if (!newest) throw new Error(`no weekly_brief note for ${weekOf} in the record`);
  if (newest.payload.status === status) return { noop: true, reason: `the newest note (${newest.at}) is already ${status}`, newest };
  const at = new Date(Math.max(now.getTime(), Date.parse(newest.at) + 1)).toISOString();
  const note = N.buildNote({
    subtype: 'weekly_brief', subjectId: newest.subject.id, threadId: newest.threadId, iso3: newest.iso3, at,
    payload: { ...newest.payload, status }, cites: newest.cites, model: newest.model, promptVersion: newest.promptVersion, producer,
  });
  return { note, newest };
}

/** All weekly_brief notes dated on or after the week's own day (a brief is written on its weekOf; the manifest lists the days). */
export async function readWeekNotes(s3json, prefix, weekOf) {
  const manifest = await s3json.getJson(`${prefix}notes/weekly_brief/manifest.json`);
  const days = ((manifest && manifest.days) || []).filter((d) => d >= weekOf);
  const parts = await Promise.all(days.map((d) => s3json.getLines(`${prefix}notes/weekly_brief/${d}.jsonl`)));
  return parts.flatMap((p) => p.lines);
}

/** The core, with the S3 and DynamoDB sides injected. -> the report object it prints. */
export async function run({ weekOf, status, write, row, prefix, s3json, setRowStatus, now, producer }) {
  const plan = planHold({ noteLines: await readWeekNotes(s3json, prefix, weekOf), weekOf, status, now, producer });
  const report = { mode: write ? 'write' : 'dry-run', weekOf, status, prefix };
  if (plan.noop) {
    report.note = null; report.noteWritten = false; report.reason = plan.reason;
  } else {
    report.note = plan.note;
    report.replaces = { noteId: plan.newest.noteId, at: plan.newest.at, status: plan.newest.payload.status };
    report.noteWritten = false;
    if (write) { report.noteWrite = await N.makeNoteWriter({ s3json, prefix }).write('weekly_brief', [plan.note]); report.noteWritten = true; }
  }
  if (row) {
    report.row = { key: `WEEKLY_BRIEF#${weekOf}`, setStatus: status, written: false };
    if (write) { await setRowStatus(weekOf, status); report.row.written = true; }
  }
  return report;
}

async function main() {
  const { values } = parseArgs({ options: { week: { type: 'string' }, publish: { type: 'boolean' }, row: { type: 'boolean' }, write: { type: 'boolean' }, prefix: { type: 'string' }, bucket: { type: 'string' } } });
  if (!values.week) throw new Error('usage: hold-weekly-brief.mjs --week YYYY-MM-DD [--publish] [--row] [--write] [--prefix record/] [--bucket B]');
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });
  const setRowStatus = async (weekOf, status) => {
    const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, UpdateCommand } = requireSdk('@aws-sdk/lib-dynamodb');
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
    await ddb.send(new UpdateCommand({ TableName: NOTE_TABLE, Key: { PK: `WEEKLY_BRIEF#${weekOf}`, SK: 'WEEKLY_BRIEF' }, UpdateExpression: 'SET #s = :s', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': status }, ConditionExpression: 'attribute_exists(PK)' }));
  };
  const report = await run({
    weekOf: values.week, status: values.publish ? 'published' : 'draft', write: !!values.write, row: !!values.row, prefix: values.prefix || 'record/',
    s3json, setRowStatus, producer: { lambda: 'record/cli/hold-weekly-brief', runId: `hold-${new Date().toISOString()}` },
  });
  console.log(JSON.stringify(report, null, 2));
  if (!values.write) console.log('dry run: nothing written; add --write to write');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
