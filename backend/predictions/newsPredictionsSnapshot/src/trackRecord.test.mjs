// Unit tests for the pure track-record aggregation. Run: node trackRecord.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { computeTrackRecord } = require('./trackRecord.js');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// A v1 prediction with one fired + one not_fired + one pending trigger, plus a legacy (v0) record.
const items = [
  {
    title: 'Referendum', category: 'politics', methodologyVersion: 1,
    scenarios: [{
      label: 'Most Likely', probability: 0.7,
      triggers: [
        { text: 'Vote by Jul 15', deadline: '2026-07-15', finalVerdict: 'fired', confirmedAt: '2026-07-16', proposal: { citation: 'reuters.com' } },
        { text: 'Coalition forms', deadline: '2026-07-20', finalVerdict: 'not_fired', confirmedAt: '2026-07-21' },
        { text: 'Still open', deadline: '2026-12-01' }, // pending
      ],
    }],
  },
  {
    title: 'Low-prob tail', category: 'conflict', methodologyVersion: 1,
    scenarios: [{ label: 'Tail', probability: 0.1, triggers: [{ text: 'Rare event', deadline: '2026-07-10', finalVerdict: 'not_fired', confirmedAt: '2026-07-11' }] }],
  },
  { title: 'Legacy', methodologyVersion: 0, scenarios: [{ label: 'x', probability: 0.5, triggers: [{ text: 'old', deadline: '2026-01-01', finalVerdict: 'fired' }] }] },
];

const d = computeTrackRecord(items);
ok('excludes legacy (v0)', d.totalPredictionsLogged === 2 && d.legacyPredictionsExcluded === 1);
ok('counts dated triggers across v1 only', d.totalDatedTriggers === 4);
ok('resolved = fired+not_fired with probability', d.resolvedTriggers === 3);
ok('pending counted', d.pendingTriggers === 1);
ok('fired counted', d.firedTriggers === 1);
// Brier: (0.7-1)^2 + (0.7-0)^2 + (0.1-0)^2 = 0.09 + 0.49 + 0.01 = 0.59 / 3 = 0.19667 → 0.197
ok('brier score', d.brierScore === 0.197);
ok('calibration buckets present', Array.isArray(d.calibration) && d.calibration.some((c) => c.bucket === '60-80%'));
ok('recent newest-first by confirmedAt', d.recent[0].confirmedAt === '2026-07-21');
ok('citation falls back to proposal', d.recent.find((r) => r.trigger === 'Vote by Jul 15').citation === 'reuters.com');
ok('eraCutFrom stamped', d.eraCutFrom === '2026-07-04');

// Empty input → honest zeros, brier null.
const empty = computeTrackRecord([]);
ok('empty → brier null', empty.brierScore === null && empty.resolvedTriggers === 0 && empty.totalPredictionsLogged === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
