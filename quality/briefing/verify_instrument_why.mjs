#!/usr/bin/env node
// Honesty check for the per-instrument "What's priced in" synthesis
// (composeInstrumentWhy). Runs it over the real fixture's top movers and asserts
// every numeric token in the output traces to that mover's own counts — i.e. the
// synthesis cannot fabricate a number. (Analog clause is omitted here since it's
// verbatim catalog text, not a computed value; covered by the existing analog join.)
//
// Run: node quality/briefing/verify_instrument_why.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { composeInstrumentWhy, nameFor } = await import(
  path.join(__dirname, '../../global-perspectives-starter/frontend/src/utils/composeEconomyBriefing.js')
);

const realName = fs.readdirSync(path.join(__dirname, 'fixtures')).find((n) => /^real-\d{4}-\d{2}-\d{2}\.json$/.test(n));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', realName), 'utf8'));
const movers = fixture.topMovers || [];

let failed = 0;
for (const m of movers) {
  // stories=[] → no analog clause; we are only verifying the numeric core.
  const out = composeInstrumentWhy({ mover: m, magnitude: 'moderate', stories: [] });
  if (!out) { console.log(`[skip] ${m.instrumentId} (no citations)`); continue; }
  const allowed = new Set([
    m.citations, m.consensusStrength,
    m.directions?.up || 0, m.directions?.down || 0, m.directions?.mixed || 0,
  ].filter((n) => typeof n === 'number'));
  // Scrub the instrument's own name first ("S&P 500"/"US 10Y" carry digits).
  const scrubbed = out.text.toLowerCase().split(nameFor(m.instrumentId).toLowerCase()).join(' ');
  const nums = (scrubbed.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const bad = nums.filter((n) => !allowed.has(n));
  const ok = bad.length === 0;
  if (!ok) failed++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${m.instrumentId}: "${out.text}"`);
  if (!ok) console.log(`        ✗ numbers not traceable to mover: ${bad.join(', ')}`);
}

console.log(`\n${movers.length} movers, ${failed} failing.`);
process.exit(failed ? 1 : 0);
