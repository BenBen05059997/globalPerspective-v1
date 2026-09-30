#!/usr/bin/env node
/**
 * predictions/verify-draw.mjs — anyone can check a published weekly draw (Batch 4 phase B).
 *
 * Checks, for one week:
 *   1. sha256(revealed seed) equals the commitment that was published BEFORE the week started;
 *   2. the commitment was recorded before the week's first day;
 *   3. re-running the published ranking rule over the published pool of eligible questions gives
 *      exactly the published picks, in the same order (one per story, lowest hash first, K max).
 *
 * Input, either:
 *   --file draw.json      { "commit": {weekId, weekStart, commitHash, committedAt},
 *                           "reveal": {seedHex, revealedAt}, "draw": {K, pool:[{q,c}], picked:[{qid,h,clusterKey}]} }
 *   --week 2026-W41       reads the three rows from DynamoDB with the AWS CLI (operator credentials)
 * (Once the public aggregate carries the draw, --week will read it from there.)
 *
 * The ranking rule is the Lambda's own module (amplify/backend/function/newsPredictionResolver/src/lib.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const lib = require(path.join(here, '..', 'amplify/backend/function/newsPredictionResolver/src/lib.js'));

function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) { const o = {}; for (const k of Object.keys(av.M)) o[k] = unmarshal(av.M[k]); return o; }
  return av;
}
function getRow(pk, sk) {
  const key = JSON.stringify({ PK: { S: pk }, SK: { S: sk } });
  const out = JSON.parse(execFileSync('aws', ['dynamodb', 'get-item', '--table-name', 'GlobalPerspectivePredictionLog', '--region', 'ap-northeast-1', '--key', key, '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  return out.Item ? unmarshal({ M: out.Item }) : null;
}

export function verify({ commit, reveal, draw }) {
  const problems = [];
  if (!commit) problems.push('no commitment published');
  if (!reveal) problems.push('seed not revealed yet');
  if (!draw) problems.push('no draw published');
  if (problems.length) return { ok: false, problems };
  if (lib.commitOf(reveal.seedHex) !== commit.commitHash) problems.push('sha256(seed) does not equal the published commitment');
  if (String(commit.committedAt).slice(0, 10) >= commit.weekStart) problems.push(`commitment (${commit.committedAt}) was not published before the week started (${commit.weekStart})`);
  const again = lib.draw(reveal.seedHex, draw.pool.map((x) => ({ qid: x.q, clusterKey: x.c })), draw.K);
  if (JSON.stringify(again.picked) !== JSON.stringify(draw.picked)) problems.push('the published picks differ from the recomputed picks');
  return { ok: problems.length === 0, problems, picked: again.picked.length, eligible: again.eligible, clusters: again.clusters };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  let input;
  if (arg('--file')) input = JSON.parse(fs.readFileSync(arg('--file'), 'utf8'));
  else if (arg('--week')) {
    const wk = arg('--week');
    input = { commit: getRow(`SEED#${wk}`, 'COMMIT'), reveal: getRow(`SEED#${wk}`, 'REVEAL'), draw: getRow(`SAMPLE#${wk}`, 'DRAW') };
  } else { console.error('usage: verify-draw.mjs --file draw.json | --week 2026-W41'); process.exit(2); }
  const r = verify(input);
  if (r.ok) console.log(`OK: commitment matches the seed, and the ${r.picked} picks (from ${r.eligible} eligible questions in ${r.clusters} stories) are exactly what the published rule gives.`);
  else { console.log('NOT VERIFIED:'); r.problems.forEach((p) => console.log(' - ' + p)); process.exit(1); }
}
