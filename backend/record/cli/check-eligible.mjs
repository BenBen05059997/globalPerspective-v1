// Check that the resolver finds the same questions in the record as in the PredictionLog (decision 0052, QUESTIONS_SOURCE). Read only: one Scan of the PRED# rows with
// questionSchema, GetItem on `SAMPLE#<week>/DRAW` (never on a seed row), and GET on record/facts/ and record/runs/. Nothing is written.
//
//   node check-eligible.mjs [--days 120] [--facts-dir DIR]
//   --facts-dir reads record/facts/DAY.jsonl and record/runs/DAY.json from a local copy of the bucket (DIR/record/...) instead of S3. SDK: see sdk.mjs (RECORD_SDK_DIR).
//
// It compares, with the resolver's own code (src/questions.js, shared questionPool.js):
//   1. WATCH: every question branch of the log against every one of the facts (watch.questionsFromPreds on both).
//   2. For every week with a commit: the eligible set from the PRED# rows against the one from the forecast facts (lib.eligibleQuestions on both).
//   3. For every drawn week: the facts' eligible set against the stored `SAMPLE#<week>/DRAW` pool and `eligible` (what the draw really used), and the draw recomputed
//      from the pool with the revealed seed of the question_draw fact against its picks.
//   4. The facts Run of each day of the weeks (the guard of the record source).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const pool = require('../../shared/src/questionPool.js');
const lib = require('../../predictions/newsPredictionResolver/src/lib.js');
const watch = require('../../predictions/newsPredictionResolver/src/watch.js');
const Q = require('../../predictions/newsPredictionResolver/src/questions.js');

const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Pure: every number and difference of the check from the log's rows, the facts, the Runs, the stored draw rows. */
export function check({ rows, facts, runs, draws, today }) {
  const out = { watch: null, weeks: [], drawn: [] };
  // today's forecasts reach the facts at the 23:45 run: the record lags the log by up to a day, and that lag is not a difference of rule
  const questionRows = rows.filter((r) => r.questionSchema && r.SK < today);
  const factRows = pool.rowsOfFacts(facts).filter((r) => r.SK < today);
  out.watch = Q.compareQuestions(watch.questionsFromPreds(questionRows), watch.questionsFromPreds(factRows));
  const commits = facts.filter((f) => f.kind === 'question_commit').map((f) => f.payload.weekId).sort();
  const drawFacts = new Map(facts.filter((f) => f.kind === 'question_draw').map((f) => [f.payload.weekId, f]));
  for (const wk of commits) {
    const start = pool.weekStart(wk);
    const end = pool.weekEnd(wk);
    const a = lib.eligibleQuestions(questionRows.filter((r) => r.SK >= start && r.SK <= end), wk);
    const b = lib.eligibleQuestions(factRows.filter((r) => r.SK >= start && r.SK <= end), wk);
    const days = [];
    for (let d = start; d <= end; d = pool.addDays(d, 1)) days.push(d);
    const notComplete = days.filter((d) => !runs.has(d) || !['ok', 'partial'].includes(runs.get(d)));
    out.weeks.push({ weekId: wk, ...Q.compareQuestions(a, b), runGuard: notComplete.length ? { incomplete: notComplete } : 'ok', drawn: drawFacts.has(wk) });
    const draw = draws.get(wk);
    if (draw) {
      const stored = (draw.pool || []).map((p) => ({ q: p.q, c: p.c })).sort((x, y) => (x.q < y.q ? -1 : 1));
      const fact = drawFacts.get(wk);
      const rebuilt = fact ? pool.poolOfDraw(factRows.filter((r) => r.SK >= start && r.SK <= end), wk, fact.payload) : null;
      const loose = rebuilt || (fact ? pool.poolOfDraw(factRows.filter((r) => r.SK >= start && r.SK <= end), wk, fact.payload, { exactClusters: false }) : null);
      const derived = rebuilt ? rebuilt.pool.map((q) => ({ q: q.qid, c: q.clusterKey })).sort((x, y) => (x.q < y.q ? -1 : 1)) : [];
      out.drawn.push({
        weekId: wk, storedEligible: draw.eligible, storedPool: stored.length, derivedPool: derived.length, leadMaxThatReproducesTheDraw: rebuilt ? rebuilt.leadMax : null,
        poolEqual: Boolean(rebuilt) && sameJson(stored, derived), picksReproduced: Boolean(rebuilt),
        // when only a pick's cluster key differs, the story's thread changed after the draw: the qids and hashes of the picks still reproduce
        ...(!rebuilt ? { picksReproducedIgnoringClusterKeys: Boolean(loose) } : {}),
      });
    }
  }
  out.identical = !out.watch.differing && out.weeks.every((w) => !w.differing) && out.drawn.every((d) => d.poolEqual || d.picksReproducedIgnoringClusterKeys);
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { days: { type: 'string' }, 'facts-dir': { type: 'string' } } });
  const today = new Date().toISOString().slice(0, 10);
  const days = world.eachDay(world.addDays(today, 1 - Number(values.days || 120)), today);
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand, GetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  // the log: every PRED# row with questionSchema (the resolver's allQuestionPreds)
  const rows = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: TABLE, FilterExpression: 'begins_with(PK, :p) AND attribute_exists(questionSchema)', ExpressionAttributeValues: { ':p': 'PRED#' }, ExclusiveStartKey }));
    rows.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // the record
  let readLines;
  let readRun;
  if (values['facts-dir']) {
    const dir = values['facts-dir'];
    readLines = async (d) => { const f = path.join(dir, 'record/facts', `${d}.jsonl`); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
    readRun = async (d) => { const f = path.join(dir, 'record/runs', `${d}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
  } else {
    const s3sdk = requireSdk('@aws-sdk/client-s3');
    const { makeS3Json } = require('../../shared/src/s3json.js');
    const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket: BUCKET });
    readLines = async (d) => (await s3json.getLines(`record/facts/${d}.jsonl`)).lines;
    readRun = (d) => s3json.getJson(`record/runs/${d}.json`);
  }
  const facts = [];
  const runs = new Map();
  for (const d of days) {
    facts.push(...(await readLines(d)));
    const run = await readRun(d);
    if (run) runs.set(d, run.status);
  }
  // the draws the resolver stored (DRAW rows only; no seed row is read)
  const draws = new Map();
  for (const wk of facts.filter((f) => f.kind === 'question_draw').map((f) => f.payload.weekId)) {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `SAMPLE#${wk}`, SK: 'DRAW' } }));
    if (r.Item) draws.set(wk, r.Item);
  }
  const result = check({ rows, facts, runs, draws, today });
  console.log(JSON.stringify({ today, predRowsWithQuestions: rows.length, forecastFacts: facts.filter((f) => f.kind === 'forecast_drawn').length, ...result }, null, 2));
  return result.identical ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
