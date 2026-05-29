#!/usr/bin/env node
// Closes the eval loop: runs the REAL Phase-1 compose function
// (src/utils/composeEconomyBriefing.js) against every frozen fixture and checks
// its output with assertions.js. This proves the shipped briefing logic — not a
// hand-written target — obeys the honesty contract.
//
// Run: node quality/briefing/verify_compose.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { checkBriefing } = require('./assertions.js');
const { composeBriefing } = await import(
  path.join(__dirname, '../../global-perspectives-starter/frontend/src/utils/composeEconomyBriefing.js')
);

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

let failed = 0;
for (const f of fixtures.sort()) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  const out = composeBriefing(fixture);
  // The empty fixture legitimately produces an empty-state briefing; assertions
  // still apply (it must not fabricate) — check it too.
  const { passed, failures } = checkBriefing(out.text, fixture);
  const verdict = passed ? 'OK  ' : 'FAIL';
  if (!passed) failed++;
  console.log(`[${verdict}] ${f}`);
  console.log(`        ↳ "${out.text}"`);
  if (!passed) for (const fl of failures) console.log(`        ✗ ${fl}`);
}

console.log(`\n${fixtures.length} fixtures, ${failed} failing.`);
process.exit(failed ? 1 : 0);
