#!/usr/bin/env node
// Drift check: scripts/functions.json vs live AWS (ap-northeast-1, read-only list calls).
// Fails (exit 1) when
//   - a deployed Lambda named news*/News* is missing from functions.json,
//   - a functions.json entry has no deployed Lambda (unless it is marked `"planned": true`: written, not yet created),
//   - an EventBridge rule or Scheduler schedule targets a news*/News* Lambda that is not in functions.json.
// Needs AWS credentials, so it is NOT in the pre-commit hook. Run it by hand.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLambdas, liveSchedules } from '../scripts/aws-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fns = JSON.parse(readFileSync(join(ROOT, 'scripts/functions.json'), 'utf8')).functions;
const known = new Set(Object.keys(fns));
const planned = new Set(Object.keys(fns).filter((n) => fns[n].planned === true));
const isNews = (n) => /^news/i.test(n);

let deployed;
let refs;
try {
  deployed = (await listLambdas()).map(([n]) => n);
  refs = (await liveSchedules(known)).refs;
} catch (e) {
  console.error(`check_aws_inventory: AWS call failed (${String(e.message).split('\n')[0]}). Credentials or network?`);
  process.exit(2);
}

const problems = [];
for (const n of deployed.filter((n) => isNews(n) && !known.has(n)).sort()) problems.push(`deployed Lambda not in functions.json: ${n}`);
for (const n of [...known].filter((n) => !deployed.includes(n) && !planned.has(n)).sort()) problems.push(`functions.json entry with no deployed Lambda: ${n}`);
for (const r of refs.filter((r) => isNews(r.lambda) && !known.has(r.lambda))) problems.push(`${r.via} "${r.name}" targets ${r.lambda}, which is not in functions.json`);

for (const n of [...planned].filter((n) => deployed.includes(n))) problems.push(`${n} is deployed but still marked planned in functions.json: remove "planned"`);

if (problems.length) {
  console.error(`check_aws_inventory: ${problems.length} drift problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`check_aws_inventory: OK (${known.size} functions.json entries all deployed; no unlisted news* Lambda; ${refs.filter((r) => known.has(r.lambda)).length} rule/schedule targets all listed)`);
