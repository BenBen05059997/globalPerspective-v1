#!/usr/bin/env node
// Honesty check for the "Today's lede" band — runs the REAL compose function
// (src/utils/composeTopicsLede.js) against inline cases and proves it never
// fabricates: the headline is a verbatim input title, every count is a real
// tally, and the reason traces to a real signal on the chosen topic.
//
// Run: node quality/briefing/verify_lede.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { composeTopicsLede } = await import(
  path.join(__dirname, '../../global-perspectives-starter/frontend/src/utils/composeTopicsLede.js')
);

const CASES = {
  empty: { topics: [], disruptions: [] },
  'no-disruptions': {
    topics: [
      { id: 't1', title: 'Quiet diplomacy resumes', regions: ['France'], sources: [{}, {}] },
      { id: 't2', title: 'Markets drift', regions: ['United States'], threadId: 'thread-mkt', x_trending: true, sources: [{}] },
    ],
    disruptions: [],
  },
  'severity-wins': {
    topics: [
      { id: 't1', title: 'Trending but minor', regions: ['Japan'], x_trending: true, sources: [{}, {}, {}, {}, {}] },
      { id: 't2', title: 'Oil shock escalates', regions: ['Iran', 'Israel'], threadId: 'thread-oil', sources: [{}] },
    ],
    disruptions: [{ scopeId: 'thread-oil', severity: 'severe' }],
  },
  'urgent-over-trending': {
    topics: [
      { id: 't1', title: 'Trending story', regions: ['Brazil'], x_trending: true, sources: [{}] },
      { id: 't2', title: 'Breaking crisis', regions: ['Sudan'], urgency: 'high', sources: [{}] },
    ],
    disruptions: [],
  },
};

const SEV_RANK = { severe: 3, moderate: 2, minor: 1 };

function check(name, input, out) {
  const failures = [];
  const titled = (input.topics || []).filter((t) => t && t.title);

  if (titled.length === 0) {
    if (!out.empty || out.lede !== null) failures.push('empty input must yield empty:true / lede:null');
    return failures;
  }

  if (out.empty) { failures.push('non-empty input yielded empty:true'); return failures; }

  // 1. headline is a verbatim input title
  const titles = new Set(titled.map((t) => t.title));
  if (!out.lede || !titles.has(out.lede.title)) failures.push(`lede.title "${out.lede && out.lede.title}" is not a verbatim input title`);

  // 2. counts are real tallies
  if (out.topicCount !== titled.length) failures.push(`topicCount ${out.topicCount} != ${titled.length}`);
  const countries = new Set();
  const threads = new Set();
  for (const t of titled) {
    for (const r of t.regions || []) if (r) countries.add(r.trim());
    if (t.threadId) threads.add(t.threadId);
  }
  if (out.countryCount !== countries.size) failures.push(`countryCount ${out.countryCount} != ${countries.size}`);
  if (out.threadCount !== threads.size) failures.push(`threadCount ${out.threadCount} != ${threads.size}`);

  // 3. reason traces to a real signal on the chosen topic
  const chosen = titled.find((t) => t.title === out.lede.title);
  const sevByThread = {};
  for (const d of input.disruptions || []) {
    if (!d.scopeId) continue;
    if ((SEV_RANK[d.severity] || 0) > (SEV_RANK[sevByThread[d.scopeId]] || 0)) sevByThread[d.scopeId] = d.severity;
  }
  const r = out.lede.reason;
  if (r) {
    if (/economic impact$/.test(r)) {
      const sev = r.replace(' economic impact', '');
      if (sevByThread[chosen.threadId] !== sev) failures.push(`reason "${r}" not backed by a cited disruption`);
    } else if (r === 'urgent') {
      if (chosen.urgency !== 'high') failures.push('reason "urgent" but topic.urgency !== high');
    } else if (r === 'trending') {
      if (!chosen.x_trending) failures.push('reason "trending" but topic.x_trending falsy');
    } else if (/sources?$/.test(r)) {
      const n = parseInt(r, 10);
      if ((chosen.sources || []).length !== n) failures.push(`reason "${r}" != real source count`);
    } else {
      failures.push(`unrecognized reason "${r}"`);
    }
  }

  // 4. text contains the headline
  if (!out.text.includes(out.lede.title)) failures.push('text does not include the lede title');

  return failures;
}

let failed = 0;
for (const [name, input] of Object.entries(CASES)) {
  const out = composeTopicsLede(input);
  const failures = check(name, input, out);
  const verdict = failures.length ? 'FAIL' : 'OK  ';
  if (failures.length) failed++;
  console.log(`[${verdict}] ${name}`);
  console.log(`        ↳ "${out.text}"${out.lede && out.lede.reason ? ` [${out.lede.reason}]` : ''}`);
  for (const f of failures) console.log(`        ✗ ${f}`);
}

console.log(`\n${Object.keys(CASES).length} cases, ${failed} failing.`);
process.exit(failed ? 1 : 0);
