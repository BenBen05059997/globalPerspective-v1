// quality/analysis/benchmark/review.mjs — targeted human review of the benchmark.
//
// The panel handles volume; you handle judgment — but ONLY on the cases where the
// auditor panel disagreed with itself (panelSplit) or flagged a fail. Those are the
// genuinely-ambiguous outputs worth a human verdict. Writes your grades to
// scorecard-<date>.human.json next to the scorecard. AWS-CLI-free, no deps.
//
//   node quality/analysis/benchmark/review.mjs            # review latest scorecard's queue
//   node quality/analysis/benchmark/review.mjs --list     # just list the queue
//   node quality/analysis/benchmark/review.mjs --all      # review every case, not just the queue

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST_ONLY = process.argv.includes('--list');
const ALL = process.argv.includes('--all');
const DIMS = ['faithfulness', 'overreach', 'calibration', 'differentiation', 'citations', 'insight'];

function latestScorecard() {
  const files = readdirSync(HERE).filter((f) => /^scorecard-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  return files.length ? files[files.length - 1] : null;
}

function show(c) {
  console.log('\n════════════════════════════════════════════');
  console.log(`${c.name}  (${c.lens})   verdict: ${c.pass ? 'PASS' : 'flag'}${c.panelSplit ? '  ⚖ PANEL SPLIT' : ''}${c.hardError ? '  HARD-FAIL' : ''}`);
  console.log('  panel-mean: ' + DIMS.map((d) => `${d}=${c.scores?.[d]}`).join('  '));
  if (c.validator?.length) console.log('  validator: ' + c.validator.join(', '));
  if (c.notes && c.notes !== 'none') console.log('  auditor note: ' + c.notes);
  console.log('════════════════════════════════════════════');
}

async function main() {
  const sc = latestScorecard();
  if (!sc) { console.log('No scorecard found. Run run.mjs first.'); return; }
  const card = JSON.parse(readFileSync(join(HERE, sc), 'utf8'));
  const cases = (card.cases || []).filter((c) => c.scores);
  const queue = ALL ? cases : cases.filter((c) => c.panelSplit || !c.pass);

  console.log(`Scorecard: ${sc}  |  ${cases.length} scored, ${queue.length} ${ALL ? 'total' : 'in human-review queue (splits + flags)'}`);
  if (!queue.length) { console.log('Nothing needs human review. ✓ (panel was unanimous on all passing cases)'); return; }
  if (LIST_ONLY) { queue.forEach((c) => console.log(`  • ${c.name} (${c.lens}) — ${c.pass ? 'PASS' : 'flag'}${c.panelSplit ? ' [split]' : ''}`)); return; }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  const humanFile = join(HERE, sc.replace('.json', '.human.json'));
  const existing = existsSync(humanFile) ? JSON.parse(readFileSync(humanFile, 'utf8')) : { scorecard: sc, grades: [] };
  const byName = new Map(existing.grades.map((g) => [g.name, g]));

  for (const c of queue) {
    show(c);
    const ans = (await ask('\n[g]ood  [b]ad  [s]kip  [q]uit  > ')).trim().toLowerCase();
    if (ans === 'q') break;
    if (ans === 's' || ans === '') continue;
    if (ans === 'g' || ans === 'b') {
      const note = (await ask('  note (optional): ')).trim();
      byName.set(c.name, { name: c.name, humanVerdict: ans === 'g' ? 'good' : 'bad', note, reviewedAt: new Date().toISOString() });
      console.log(`  → recorded: ${ans === 'g' ? 'good' : 'bad'}`);
    } else { console.log('  (unrecognized — skipped)'); }
  }
  rl.close();

  existing.grades = [...byName.values()];
  existing.reviewedAt = new Date().toISOString();
  writeFileSync(humanFile, JSON.stringify(existing, null, 2));
  console.log(`\nWrote ${existing.grades.length} human grade(s) → ${humanFile.split('/').pop()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
