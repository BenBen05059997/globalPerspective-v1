#!/usr/bin/env node
// Sample COUNTRY_INTELLIGENCE + THREAD_ANALYSIS records from production DDB to build a
// severity-labeling gold set. Freezes narrative AND model dimensions/riskScore in one live
// read per record (these items are overwritten daily — a second read could silently swap in a
// different record's data under the same id).
//
// See project-docs/architecture/ONE_TRUTH_EXECUTION_PLAN.md Phase 3 Step 3.2 for the full spec
// this script implements, and project-docs/architecture/SEVERITY_CODEBOOK.md for the rubric the
// operator will use to label the output.
//
// Usage:
//   node quality/pick_severity_sample.js [--n 28] [--out quality/severity_gold_set.json]
//
// Reads DDB via the AWS CLI — assumes the CLI is configured. No npm deps. Read-only: this script
// never writes to DynamoDB.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TABLE = 'SummarizeAndPredict';
const REGION = 'ap-northeast-1';
const AXES = ['conflict', 'political', 'economic', 'humanitarian'];

// The DeepSeek-outage window (Step 3.2 constraint #2) — records generated in this window are
// excluded as unrepresentative of normal generator behavior.
const OUTAGE_START = Date.parse('2026-09-13T00:00:00.000Z');
const OUTAGE_END = Date.parse('2026-09-15T12:00:00.000Z');

// ─── args ─────────────────────────────────────────────────────────────────────
function arg(name, def) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${name}`);
  return i >= 0 ? a[i + 1] : def;
}

const TARGET_N = parseInt(arg('n', '28'), 10);
const outPath = arg('out', path.join('quality', 'severity_gold_set.json'));

// ─── DDB helpers (shell out to aws cli; unmarshal types) — modeled on pick_weekly_review.js ──
function awsJson(cmd) {
  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(raw);
}

function unmarshal(attr) {
  if (attr == null) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr) return attr.L.map(unmarshal);
  if ('M' in attr) {
    const out = {};
    for (const [k, v] of Object.entries(attr.M)) out[k] = unmarshal(v);
    return out;
  }
  if ('SS' in attr) return attr.SS;
  if ('NS' in attr) return attr.NS.map(Number);
  return null;
}

function unmarshalItem(item) {
  const out = {};
  for (const [k, v] of Object.entries(item)) out[k] = unmarshal(v);
  return out;
}

function scanBySk(sk) {
  const filter = 'SK = :s';
  const values = JSON.stringify({ ':s': { S: sk } });
  const items = [];
  let startKey = null;
  do {
    const startArg = startKey ? ` --exclusive-start-key '${JSON.stringify(startKey)}'` : '';
    const cmd = `aws dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "${filter}" ` +
      `--expression-attribute-values '${values}'${startArg} --output json`;
    const resp = awsJson(cmd);
    for (const it of (resp.Items || [])) items.push(unmarshalItem(it));
    startKey = resp.LastEvaluatedKey || null;
  } while (startKey);
  return items;
}

// ─── shuffle (Fisher-Yates, same as pick_weekly_review.js) ────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── severity helpers ───────────────────────────────────────────────────────────
function axisScore(dimensions, axis) {
  if (!dimensions || !(axis in dimensions)) return null;
  const v = dimensions[axis];
  if (v == null) return null;
  return typeof v.score === 'number' ? v.score : null;
}

function worstAxisScore(dimensions) {
  if (!dimensions) return null;
  let worst = null;
  for (const axis of AXES) {
    const s = axisScore(dimensions, axis);
    if (s != null && (worst == null || s > worst)) worst = s;
  }
  return worst;
}

function band(score) {
  if (score == null) return null;
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'moderate';
  return 'low';
}

function inOutageWindow(generatedAt) {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return false;
  return t >= OUTAGE_START && t < OUTAGE_END;
}

// ─── narrative extraction (frozen at read time) ────────────────────────────────
function countryNarrative(rec) {
  return {
    countryName: rec.countryName ?? null,
    headline: rec.headline ?? null,
    bluf: rec.bluf ?? null,
    keyDevelopments: rec.keyDevelopments ?? null,
    whyItMatters: rec.whyItMatters ?? null,
    riskSignals: rec.riskSignals ?? null,
  };
}

function threadNarrative(rec) {
  return {
    threadTitle: rec.threadTitle ?? null,
    storyArc: rec.storyArc ?? null,
    rootCauseChain: rec.rootCauseChain ?? null,
    watchQuestions: rec.watchQuestions ?? null,
  };
}

function toGoldEntry(rec, type) {
  const dims = rec.dimensions || null;
  const narrative = type === 'country' ? countryNarrative(rec) : threadNarrative(rec);
  const model_dimensions = {
    conflict: axisScore(dims, 'conflict'),
    political: axisScore(dims, 'political'),
    economic: axisScore(dims, 'economic'),
    humanitarian: axisScore(dims, 'humanitarian'),
    riskScore: typeof rec.riskScore === 'number' ? rec.riskScore : null,
  };
  return {
    id: rec.PK,
    type,
    sampledAt: new Date().toISOString(),
    generatedAt: rec.generatedAt ?? null,
    model: rec.model ?? null,
    narrative,
    gold: { conflict: null, political: null, economic: null, humanitarian: null },
    gold_why: {},
    // model_dimensions is placed last deliberately (SEVERITY_CODEBOOK.md §5) so the operator
    // doesn't see it while scrolling past narrative/gold fields during labeling.
    model_dimensions,
  };
}

// ─── null-rate reporting ────────────────────────────────────────────────────────
function printNullRateReport(label, records, hasDimensionsPredicate, dimsOf) {
  console.log(`\n--- ${label}: ${records.length} candidates (post outage-exclusion) ---`);
  const withDims = records.filter(hasDimensionsPredicate);
  console.log(`  with a 'dimensions' field at all: ${withDims.length}/${records.length} ` +
    `(${pct(withDims.length, records.length)})`);

  console.log(`  per-axis null rate across ALL candidates (missing 'dimensions' field counts as null on all 4 axes):`);
  for (const axis of AXES) {
    const nonNull = records.filter(r => axisScore(dimsOf(r), axis) != null).length;
    console.log(`    ${axis.padEnd(12)} non-null: ${nonNull}/${records.length} (${pct(nonNull, records.length)})  null: ${pct(records.length - nonNull, records.length)}`);
  }

  if (withDims.length > 0) {
    console.log(`  per-axis null rate WITHIN scored records only (dimensions field present, n=${withDims.length}):`);
    for (const axis of AXES) {
      const nonNull = withDims.filter(r => axisScore(dimsOf(r), axis) != null).length;
      console.log(`    ${axis.padEnd(12)} non-null: ${nonNull}/${withDims.length} (${pct(nonNull, withDims.length)})`);
    }
  }
  return withDims;
}

function pct(n, d) {
  if (d === 0) return 'n/a';
  return `${((n / d) * 100).toFixed(0)}%`;
}

// ─── main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log(`Scanning ${TABLE} for COUNTRY_INTELLIGENCE and THREAD_ANALYSIS records…`);
  const countryAll = scanBySk('COUNTRY_INTELLIGENCE');
  const threadAll = scanBySk('THREAD_ANALYSIS');
  console.log(`Found ${countryAll.length} country records, ${threadAll.length} thread records (raw, pre-filter).`);

  const excludeOutage = r => r.generatedAt && !inOutageWindow(r.generatedAt);
  const countryCand = countryAll.filter(excludeOutage);
  const threadCand = threadAll.filter(excludeOutage);
  const outageExcludedCountry = countryAll.length - countryCand.length;
  const outageExcludedThread = threadAll.length - threadCand.length;
  if (outageExcludedCountry || outageExcludedThread) {
    console.log(`Excluded ${outageExcludedCountry} country + ${outageExcludedThread} thread record(s) inside the outage window ` +
      `(${new Date(OUTAGE_START).toISOString()} .. ${new Date(OUTAGE_END).toISOString()}).`);
  } else {
    console.log('No candidates fell inside the outage window.');
  }

  // ── null-rate report BEFORE selecting anything ────────────────────────────
  const countryScored = printNullRateReport('Country candidates', countryCand, r => !!r.dimensions, r => r.dimensions);
  const threadScored = printNullRateReport('Thread candidates', threadCand, r => !!r.dimensions, r => r.dimensions);

  // ── stratification decision ────────────────────────────────────────────────
  // Only records with a 'dimensions' field are usable for the gold set — a record the generator
  // never scored has nothing to compare an operator label against (it predates the dimensions
  // rollout, it isn't a considered null). See SEVERITY_CODEBOOK.md and the plan's null-rate
  // constraint: this restriction is itself the stratification response to the finding that most
  // raw candidates (unscored, pre-rollout records) are null on every axis.
  console.log(`\nDecision: sampling pool = records with a 'dimensions' field present only ` +
    `(country ${countryScored.length}, thread ${threadScored.length}, total ${countryScored.length + threadScored.length}). ` +
    `Unscored records are excluded from the pool rather than included as "null" — an absent field ` +
    `predates the dimensions rollout and is not a considered null judgment.`);

  const countryBands = {};
  const threadBands = {};
  for (const r of countryScored) countryBands[band(worstAxisScore(r.dimensions))] = (countryBands[band(worstAxisScore(r.dimensions))] || 0) + 1;
  for (const r of threadScored) threadBands[band(worstAxisScore(r.dimensions))] = (threadBands[band(worstAxisScore(r.dimensions))] || 0) + 1;
  console.log(`Worst-axis band distribution within scored pool — country: ${JSON.stringify(countryBands)}, thread: ${JSON.stringify(threadBands)}`);

  const missingBands = ['low', 'moderate'].filter(b => (countryBands[b] || 0) + (threadBands[b] || 0) === 0);
  if (missingBands.length > 0) {
    console.log(`NOTE: scored pool contains zero records in band(s): ${missingBands.join(', ')}. ` +
      `Cannot stratify to include them — they don't exist in the current live data (coverage skews toward ` +
      `elevated/high-risk stories, as expected for a news-selection pipeline). Reported here rather than silently sampled around.`);
  }

  // Proportional split by type, capped by pool size, target TARGET_N total.
  const totalPool = countryScored.length + threadScored.length;
  const wantCountry = Math.round(TARGET_N * (countryScored.length / totalPool));
  const wantThread = TARGET_N - wantCountry;

  shuffle(countryScored);
  shuffle(threadScored);
  const pickedCountry = countryScored.slice(0, Math.min(wantCountry, countryScored.length));
  const pickedThread = threadScored.slice(0, Math.min(wantThread, threadScored.length));

  // Top up from whichever pool has leftovers if the other fell short.
  let picked = [...pickedCountry, ...pickedThread];
  if (picked.length < TARGET_N) {
    const leftoverCountry = countryScored.slice(pickedCountry.length);
    const leftoverThread = threadScored.slice(pickedThread.length);
    const leftover = shuffle([...leftoverCountry, ...leftoverThread]);
    for (const r of leftover) {
      if (picked.length >= TARGET_N) break;
      picked.push(r);
    }
  }

  console.log(`\nSelected ${picked.length} records: ${pickedCountry.length}+ country, ${pickedThread.length}+ thread (after top-up).`);

  const goldSet = picked.map(r => toGoldEntry(r, countryAll.includes(r) ? 'country' : 'thread'));

  const output = {
    _instructions: 'Fill gold.<axis> (integer 0-100 or null) and gold_why.<axis> (one sentence) for every ' +
      'record per project-docs/architecture/SEVERITY_CODEBOOK.md. Read narrative FIRST — model_dimensions is ' +
      'placed last in each object deliberately so you can label without peeking (a soft blind, not a real one: ' +
      'you authored/reviewed the generator prompts and may recognize model phrasing). Never write 0 for "no ' +
      'signal" — use null. Once every gold object is fully filled (no axis left unconsidered), run ' +
      'node quality/severity_agreement.js.',
    generatedBy: 'quality/pick_severity_sample.js',
    generatedAt: new Date().toISOString(),
    outageWindowExcluded: { start: new Date(OUTAGE_START).toISOString(), end: new Date(OUTAGE_END).toISOString() },
    records: goldSet,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${outPath} (${goldSet.length} records).`);
}

main();
