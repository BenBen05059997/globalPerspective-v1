#!/usr/bin/env node
/**
 * Class-2 (auth-guard regression) tripwire — BUG_PLAYBOOK.md.
 *
 * Three times now a leftover `if (!user) return` has shipped into a hook that
 * fetches FULLY PUBLIC content, silently blocking anonymous + incognito visitors
 * (receipts: commits 94e9b29, e3e2875, b430159). The backend for these actions
 * has had no auth gate since 2026-04-22, so the guard is always a regression.
 *
 * This is NOT a blanket "no !user guards" rule — useSavedItems MUST keep its
 * guard (saving genuinely needs auth). So we check an explicit ALLOWLIST of the
 * public-content hooks and assert none of them early-return on !user.
 *
 * Usage: node scripts/auth-guard-check.mjs   (exit non-zero if a guard crept in)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HOOKS = path.join(__dir, '../global-perspectives-starter/frontend/src/hooks');

// Public-content hooks: their backend actions are public, so a !user gate here
// blocks anonymous visitors from content that is meant for everyone.
const PUBLIC_HOOKS = [
  'useWeeklyArchive.js',
  'useThreadAnalyses.js',
  'useCountryIntelligence.js',
  'useDailyBrief.js',
  'useGeminiTopics.js',
  'useMarketsGlobal.js',
  'useMarketsCountry.js',
];

// Matches an early-return / bail guard keyed on a falsy user, e.g.
//   if (!user) return;            if (!user) return null;
//   if (!user) { ... }            if (!currentUser) return [];
const GUARD = /if\s*\(\s*!\s*(user|currentUser|authUser)\b[^)]*\)\s*(=>|\{|return\b)/;

let failed = 0;
console.log('\nAuth-guard regression check (class 2)');
console.log('='.repeat(72));

for (const file of PUBLIC_HOOKS) {
  const full = path.join(HOOKS, file);
  if (!fs.existsSync(full)) {
    console.log(`  ?  ${file} — MISSING (hook renamed/removed? update the allowlist)`);
    failed++;
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (GUARD.test(line)) hits.push({ n: i + 1, text: line.trim() });
  });
  if (hits.length) {
    failed++;
    console.log(`  X  ${file} — ${hits.length} !user guard(s) on PUBLIC content:`);
    for (const h of hits) console.log(`        L${h.n}: ${h.text}`);
  } else {
    console.log(`  ok ${file}`);
  }
}

console.log('='.repeat(72));
if (failed) {
  console.log(`\nFAIL: ${failed} public hook(s) gate on !user. Delete the guard — the`);
  console.log(`backend is public; this blocks anonymous + incognito visitors.\n`);
  process.exit(1);
}
console.log('\nPASS: no public-content hook gates on !user.\n');
process.exit(0);
