// quality/analysis/benchmark/panel.mjs
//
// Experiment: is ONE auditor pass noisy enough to need a PANEL? For a few cases we
// generate the analysis once, then audit it N times (same v4-pro, temp>0 for variation)
// and report per-pass scores, the per-dimension RANGE across passes, and whether the
// pass/flag verdict flips. If passes agree tightly → single judge is enough (panel is
// overkill). If they swing → a panel (average/majority) earns its keep.
//
//   ANALYSIS_EVAL_KEY=sk-… node quality/analysis/benchmark/panel.mjs
//   … panel.mjs top-story-solo,geopolitics-multi 5   # cases, N passes

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runChat, getProvider } from '../../../global-perspectives-starter/frontend/src/services/llm.js';
import { SYSTEM_PROMPT, assembleContext, buildUserMessage } from '../../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { validateAnalysis } from '../../../global-perspectives-starter/frontend/src/utils/analysisValidator.js';
import { AUDITOR_SYSTEM, DIMS, parseJudge, isPass, mean, r1 } from './auditor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, 'cases');
const KEY = process.env.ANALYSIS_EVAL_KEY;
const PROVIDER = process.env.ANALYSIS_BENCH_PROVIDER || 'deepseek';
const ANALYST = process.env.ANALYSIS_BENCH_MODEL || 'deepseek-v4-flash';
const AUDITOR = process.env.ANALYSIS_AUDIT_MODEL || 'deepseek-v4-pro';
const TEMP = Number(process.env.AUDIT_TEMP || 0.5);

async function main() {
  if (!KEY) { console.error('Set ANALYSIS_EVAL_KEY.'); process.exit(1); }
  const argv = process.argv.slice(2);
  const names = argv[0] ? argv[0].split(',') : ['top-story-solo', 'geopolitics-multi', 'markets-econ'];
  const N = Number(argv[1] || 3);
  console.log(`Panel experiment — analyst=${ANALYST} · auditor=${AUDITOR}×${N} @temp${TEMP} (${getProvider(PROVIDER)?.label})\n`);

  const verdictFlips = [];
  const maxRanges = [];

  for (const name of names) {
    const file = join(CASES, `${name}.json`);
    if (!existsSync(file)) { console.log(`  ! no case ${name}`); continue; }
    const c = JSON.parse(readFileSync(file, 'utf8'));
    const { context, citations, thin } = assembleContext(c.enriched);
    const user = buildUserMessage({ context, mode: c.mode, lensId: c.lens, freeform: c.freeform, thin });
    const { text: analysis } = await runChat({ provider: PROVIDER, model: ANALYST, apiKey: KEY, system: SYSTEM_PROMPT, user });
    const hardError = validateAnalysis(analysis, { citations, context, thinInput: thin }).hasError;

    const req = c.mode === 'freeform' ? c.freeform : `Guided lens: ${c.lens}`;
    const judgeUser = `SOURCE MATERIAL:\n${context}\n\n---\nREQUEST:\n${req}\n\n---\nANALYSIS TO GRADE:\n${analysis}`;
    const passes = [];
    for (let i = 0; i < N; i++) {
      const { text: audit } = await runChat({ provider: PROVIDER, model: AUDITOR, apiKey: KEY, system: AUDITOR_SYSTEM, user: judgeUser, temperature: TEMP });
      const j = parseJudge(audit);
      if (j) passes.push(j);
    }
    if (passes.length < 2) { console.log(`  ! ${name}: not enough parseable passes`); continue; }

    console.log(`■ ${name} (${c.mode === 'freeform' ? 'freeform' : c.lens})`);
    passes.forEach((j, i) => {
      console.log(`   pass${i + 1}: ` + DIMS.map((d) => `${d[0].toUpperCase()}${j[d]}`).join(' ') + `  ${isPass(j, hardError) ? 'PASS' : 'flag'}`);
    });
    // per-dimension mean + range across passes
    const ranges = {};
    DIMS.forEach((d) => { const xs = passes.map((p) => p[d] ?? 0); ranges[d] = Math.max(...xs) - Math.min(...xs); });
    const avg = {}; DIMS.forEach((d) => { avg[d] = r1(mean(passes.map((p) => p[d] ?? 0))); });
    const verdicts = passes.map((j) => isPass(j, hardError));
    const flipped = new Set(verdicts).size > 1;
    const maxRange = Math.max(...Object.values(ranges));
    verdictFlips.push(flipped); maxRanges.push(maxRange);
    console.log(`   mean: ` + DIMS.map((d) => `${d[0].toUpperCase()}${avg[d]}`).join(' '));
    console.log(`   per-dim range (max-min across passes): ` + DIMS.map((d) => `${d[0].toUpperCase()}${ranges[d]}`).join(' '));
    console.log(`   verdict across passes: ${verdicts.map((v) => v ? 'PASS' : 'flag').join(', ')}  ${flipped ? '← FLIPPED (single pass unreliable)' : '(stable)'}\n`);
  }

  const flipRate = Math.round(100 * verdictFlips.filter(Boolean).length / (verdictFlips.length || 1));
  console.log('──────── panel verdict ────────');
  console.log(`cases where the pass/flag verdict flipped between passes: ${verdictFlips.filter(Boolean).length}/${verdictFlips.length} (${flipRate}%)`);
  console.log(`worst per-dimension swing seen: ${Math.max(0, ...maxRanges)} points`);
  console.log(flipRate === 0 && Math.max(0, ...maxRanges) <= 1
    ? '→ Single auditor pass is STABLE here. A panel is likely overkill (a is not needed).'
    : '→ Single passes DISAGREE. A panel (average/majority) would add reliability (a is worth it).');
}

main().catch((e) => { console.error(e); process.exit(1); });
