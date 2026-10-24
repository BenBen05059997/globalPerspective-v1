#!/usr/bin/env node
// Scores the resolver's verdicts against the gap-benchmark answer key (Foundation plan, 2026-10-24).
//
//   node predictions/score-gap-benchmark.mjs --key <answer-key.json> --verdicts <verdicts.jsonl>
//
// --verdicts is the concatenation of record/inbox/verdicts/*.jsonl (download them first; this tool reads no S3).
// A verdict line (backend/predictions/newsPredictionResolver/src/inbox.js) carries {qid, branchId, result, revision, decidedAt}; branchId is
// '<PRED pk>/<issue day>/<trigger id>', the key's branchId. The latest revision (then decidedAt) per branchId is the model's answer; result
// yes|no stay, anything else (void, ...) counts as unclear. A key row with no joined line is unanswered.
//   strict  = key rows with strength "cited": accuracy, yes-precision, no-precision
//   soft    = key rows with strength "absence" (key says no on silence): a model unclear is not an error
//   coverage = key rows the model answered at all
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ratio = (n, d) => (d ? Math.round((1000 * n) / d) / 1000 : null);
const norm = (r) => (r === 'yes' || r === 'no' ? r : 'unclear');

export function parseJsonl(text) {
  return String(text || '').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Latest line per branchId (highest revision, then latest decidedAt). Lines without a branchId cannot join and are counted. */
export function latestByBranch(lines) {
  const out = new Map();
  let unjoinable = 0;
  for (const l of lines) {
    if (!l || !l.branchId) { unjoinable += 1; continue; }
    const had = out.get(l.branchId);
    const newer = !had || (l.revision ?? 0) > (had.revision ?? 0) || ((l.revision ?? 0) === (had.revision ?? 0) && String(l.decidedAt) > String(had.decidedAt));
    if (newer) out.set(l.branchId, l);
  }
  return { byBranch: out, unjoinable };
}

export function score(key, lines) {
  const { byBranch, unjoinable } = latestByBranch(lines);
  const rows = key.map((k) => ({ k, m: byBranch.has(k.branchId) ? norm(byBranch.get(k.branchId).result) : null }));
  const answered = rows.filter((r) => r.m);
  const cited = rows.filter((r) => r.k.strength === 'cited');
  const citedAns = cited.filter((r) => r.m);
  const hit = citedAns.filter((r) => r.m === r.k.verdict).length;
  const mYes = citedAns.filter((r) => r.m === 'yes');
  const mNo = citedAns.filter((r) => r.m === 'no');
  const absence = rows.filter((r) => r.k.strength === 'absence' && r.m);
  const keyBranches = new Set(key.map((k) => k.branchId));
  return {
    keyRows: key.length,
    verdictLines: lines.length,
    linesWithoutBranchId: unjoinable,
    linesNotInKey: [...byBranch.keys()].filter((b) => !keyBranches.has(b)).length,
    coverage: { answered: answered.length, of: key.length, ratio: ratio(answered.length, key.length), decided: answered.filter((r) => r.m !== 'unclear').length },
    strict: {
      citedRows: cited.length, answered: citedAns.length,
      accuracyAnswered: ratio(hit, citedAns.length), accuracyAll: ratio(hit, cited.length), // all: unanswered and unclear count as misses
      yesPrecision: ratio(mYes.filter((r) => r.k.verdict === 'yes').length, mYes.length), modelYes: mYes.length,
      noPrecision: ratio(mNo.filter((r) => r.k.verdict === 'no').length, mNo.length), modelNo: mNo.length,
    },
    soft: {
      absenceRows: rows.filter((r) => r.k.strength === 'absence').length, answered: absence.length,
      agree: absence.filter((r) => r.m === 'no').length, unclear: absence.filter((r) => r.m === 'unclear').length, disagree: absence.filter((r) => r.m === 'yes').length,
      agreementOfDecided: ratio(absence.filter((r) => r.m === 'no').length, absence.filter((r) => r.m !== 'unclear').length),
    },
    offKeyYes: answered.filter((r) => r.m === 'yes' && r.k.strength !== 'cited').length, // model said yes where the key has no cited answer
  };
}

function main(argv) {
  const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const keyPath = get('--key');
  const vPath = get('--verdicts');
  if (!keyPath || !vPath) { console.error('usage: score-gap-benchmark.mjs --key answer-key.json --verdicts verdicts.jsonl'); process.exit(2); }
  const res = score(JSON.parse(fs.readFileSync(keyPath, 'utf8')), parseJsonl(fs.readFileSync(vPath, 'utf8')));
  console.log(JSON.stringify(res, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv.slice(2));
