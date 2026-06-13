// quality/analysis/benchmark/capture.mjs
//
// Freezes real, live story-sets into reproducible benchmark cases. Live topics change
// daily, so the benchmark must run on SNAPSHOTS, not live data. This pulls the current
// topics + their cached summary/prediction/trace from the production proxy and writes
// one case file per seed under cases/.
//
//   node quality/analysis/benchmark/capture.mjs            # capture the SEED set
//   node quality/analysis/benchmark/capture.mjs 0,2,3 myname scenario guided
//
// Commit the resulting cases/*.json so benchmark runs are reproducible.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickText, clip } from '../../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROXY = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';

// Default seed set — a spread of shapes the benchmark should cover. Indices map to
// "today's" topic ordering at capture time, then frozen.
const SEEDS = [
  { name: 'top-story-solo', indices: [0], lens: 'scenario', mode: 'guided' },
  { name: 'geopolitics-multi', indices: [0, 2, 3], lens: 'scenario', mode: 'guided' },
  { name: 'compare-mixed', indices: [0, 1, 2], lens: 'compare', mode: 'guided' },
  { name: 'markets-econ', indices: [1], lens: 'economic', mode: 'guided' },
  { name: 'freeform-open', indices: [0, 2], lens: null, mode: 'freeform',
    freeform: 'What are the cross-cutting risks across these stories for global markets?' },
];

async function proxy(action, payload = {}) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  let b = await r.json().catch(() => null);
  if (b && typeof b === 'object' && 'statusCode' in b && 'body' in b) b = typeof b.body === 'string' ? JSON.parse(b.body) : b.body;
  return b;
}

async function captureSeed(topics, seed) {
  const picks = seed.indices.map((i) => topics[i]).filter(Boolean);
  if (picks.length !== seed.indices.length) {
    console.warn(`  ! ${seed.name}: only ${picks.length}/${seed.indices.length} topics available`);
  }
  const enriched = [];
  for (const t of picks) {
    const id = t.topicId || t.id;
    const [s, p, c] = await Promise.all([proxy('summary', { topicId: id }), proxy('prediction', { topicId: id }), proxy('trace_cause', { topicId: id })]);
    enriched.push({ topic: t, summary: clip(pickText(s)), prediction: clip(pickText(p)), trace: clip(pickText(c)) });
  }
  const out = { name: seed.name, lens: seed.lens, mode: seed.mode, freeform: seed.freeform || null, capturedAt: new Date().toISOString(), enriched };
  const file = join(HERE, 'cases', `${seed.name}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`  ✓ ${seed.name}: ${enriched.length} stor${enriched.length === 1 ? 'y' : 'ies'} -> cases/${seed.name}.json`);
  console.log(`      [${enriched.map((e) => e.topic.title.slice(0, 40)).join(' | ')}]`);
}

async function main() {
  const argv = process.argv.slice(2);
  const td = await proxy('topics', {});
  const topics = (td?.data || td)?.topics || [];
  if (!topics.length) { console.error('No live topics returned.'); process.exit(1); }
  console.log(`Live topics available: ${topics.length}`);

  let seeds = SEEDS;
  if (argv.length) {
    const [indices, name, lens = 'scenario', mode = 'guided'] = argv;
    seeds = [{ name: name || 'adhoc', indices: indices.split(',').map(Number), lens: mode === 'freeform' ? null : lens, mode }];
  }
  for (const seed of seeds) await captureSeed(topics, seed);
  console.log('\nCapture done. Commit cases/*.json for reproducibility.');
}

main().catch((e) => { console.error(e); process.exit(1); });
