// quality/analysis/benchmark/run.mjs
//
// Scores the Analysis Studio on the FROZEN cases in cases/*.json. For each case:
//   1. ANALYST model generates the analysis (the exact shipped prompt/lens path).
//   2. Deterministic validator (analysisValidator.js) checks hard guardrails.
//   3. A CROSS-MODEL AUDITOR (a *different* model than the analyst) grades the output
//      on a rubric — the "is the analyst good?" review. Self-grading is biased, so the
//      auditor defaults to a different model than the analyst.
// Writes scorecard-<date>.json + appends DASHBOARD.md (committed → quality trend in git).
//
//   ANALYSIS_EVAL_KEY=sk-… node quality/analysis/benchmark/run.mjs
//   ANALYSIS_BENCH_MODEL=deepseek-v4-flash ANALYSIS_AUDIT_MODEL=deepseek-v4-pro …
//
// PASS = no hard validator error AND faithfulness≥4 AND overreach≥4 AND
//        calibration≥3.5 AND no rubric dimension <2.

import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runChat, getProvider } from '../../../global-perspectives-starter/frontend/src/services/llm.js';
import { SYSTEM_PROMPT, assembleContext, buildUserMessage } from '../../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { validateAnalysis } from '../../../global-perspectives-starter/frontend/src/utils/analysisValidator.js';
import { AUDITOR_SYSTEM, DIMS, parseJudge, isPass, probSpread, mean, r1 } from './auditor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'cases');
const KEY = process.env.ANALYSIS_EVAL_KEY;
const PROVIDER = process.env.ANALYSIS_BENCH_PROVIDER || 'deepseek';
const ANALYST = process.env.ANALYSIS_BENCH_MODEL || 'deepseek-v4-flash';
const AUDITOR = process.env.ANALYSIS_AUDIT_MODEL || 'deepseek-v4-pro';
const DATE = process.env.BENCH_DATE || new Date().toISOString().slice(0, 10);

async function main() {
  if (!KEY) { console.error('Set ANALYSIS_EVAL_KEY to run the benchmark.'); process.exit(1); }
  if (!existsSync(CASES_DIR)) { console.error('No cases/ — run capture.mjs first.'); process.exit(1); }
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) { console.error('No case files. Run capture.mjs.'); process.exit(1); }

  console.log(`Benchmark ${DATE} — analyst=${ANALYST} · auditor=${AUDITOR} (${getProvider(PROVIDER)?.label})`);
  console.log(`${files.length} cases\n`);

  const results = [];
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'));
    const { context, citations, thin } = assembleContext(c.enriched);
    const user = buildUserMessage({ context, mode: c.mode, lensId: c.lens, freeform: c.freeform, thin });
    let analysis, audit;
    try {
      ({ text: analysis } = await runChat({ provider: PROVIDER, model: ANALYST, apiKey: KEY, system: SYSTEM_PROMPT, user }));
    } catch (e) { console.log(`  ✗ ${c.name}: analyst failed — ${e.message}`); results.push({ name: c.name, error: 'analyst' }); continue; }

    const checks = validateAnalysis(analysis, { citations, context, thinInput: thin });
    const hardError = checks.hasError;
    const ps = probSpread(analysis);

    try {
      const req = c.mode === 'freeform' ? c.freeform : `Guided lens: ${c.lens}`;
      const judgeUser = `SOURCE MATERIAL:\n${context}\n\n---\nREQUEST:\n${req}\n\n---\nANALYSIS TO GRADE:\n${analysis}`;
      ({ text: audit } = await runChat({ provider: PROVIDER, model: AUDITOR, apiKey: KEY, system: AUDITOR_SYSTEM, user: judgeUser, temperature: 0 }));
    } catch (e) { console.log(`  ✗ ${c.name}: auditor failed — ${e.message}`); results.push({ name: c.name, error: 'auditor' }); continue; }

    const j = parseJudge(audit);
    if (!j) { console.log(`  ✗ ${c.name}: auditor returned unparseable output`); results.push({ name: c.name, error: 'parse' }); continue; }

    const pass = isPass(j, hardError);
    results.push({ name: c.name, lens: c.mode === 'freeform' ? 'freeform' : c.lens, pass, hardError,
      validator: checks.warnings.map((w) => w.code), probSpread: ps.spread, scores: { ...j } });
    const sc = DIMS.map((d) => `${d[0].toUpperCase()}${j[d]}`).join(' ');
    console.log(`  ${pass ? '✓' : '✗'} ${c.name} (${c.mode === 'freeform' ? 'freeform' : c.lens})  ${sc}  spread=${ps.spread ?? 'n/a'}  ${hardError ? 'HARD-FAIL' : ''}`);
    if (j.notes && j.notes !== 'none') console.log(`      ${j.notes}`);
  }

  const scored = results.filter((r) => r.scores);
  const agg = {};
  for (const d of DIMS) agg[d] = r1(mean(scored.map((r) => r.scores[d])));
  const passRate = scored.length ? Math.round(100 * scored.filter((r) => r.pass).length / scored.length) : 0;
  const hardFails = results.filter((r) => r.hardError).length;
  const spreads = scored.map((r) => r.probSpread).filter((x) => x != null);

  console.log(`\n──────── scorecard ${DATE} ────────`);
  console.log(`pass rate: ${passRate}%  |  hard-fails: ${hardFails}  |  cases scored: ${scored.length}/${results.length}`);
  console.log('means:', DIMS.map((d) => `${d}=${agg[d]}`).join('  '));
  if (spreads.length) console.log(`mean prob-spread: ${r1(mean(spreads))} pts (low = under-differentiated)`);

  // Persist scorecard + dashboard row.
  const scorecard = { date: DATE, analyst: ANALYST, auditor: AUDITOR, passRate, hardFails, means: agg,
    meanProbSpread: spreads.length ? r1(mean(spreads)) : null, cases: results };
  writeFileSync(join(HERE, `scorecard-${DATE}.json`), JSON.stringify(scorecard, null, 2));

  const dash = join(HERE, 'DASHBOARD.md');
  if (!existsSync(dash)) {
    writeFileSync(dash, '# Analysis Studio — Benchmark Dashboard\n\nOne row per run. PASS = no hard validator error AND faithfulness≥4 ∧ overreach≥4 ∧ calibration≥3.5 ∧ no dim <2.\n\n| date | analyst | auditor | pass% | hard-fails | faith | over | calib | diff | cite | insight | prob-spread |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n');
  }
  appendFileSync(dash, `| ${DATE} | ${ANALYST} | ${AUDITOR} | ${passRate}% | ${hardFails} | ${agg.faithfulness} | ${agg.overreach} | ${agg.calibration} | ${agg.differentiation} | ${agg.citations} | ${agg.insight} | ${scorecard.meanProbSpread ?? 'n/a'} |\n`);
  console.log(`\nwrote scorecard-${DATE}.json + appended DASHBOARD.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
