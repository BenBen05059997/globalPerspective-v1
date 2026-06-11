// quality/analysis/judge.mjs — LLM-as-judge for analysis output (Layer C).
//
// The regex validator (analysisValidator.js) catches MECHANICAL failures: phantom
// citations, fabricated figures, no-citations. It cannot judge SEMANTIC quality —
// is a claim actually supported by the material? is a scenario overreaching? is the
// "so what" calibrated? This layer asks a second model to grade exactly that, on a
// rubric, returning structured JSON. Mirrors the economic-quality judge pattern.
//
// It judges CLOSED-BOOK output (guided/freeform), where the provided context IS the
// ground truth the judge can check against. (Deep/web mode isn't judged here — the
// judge can't re-verify live web sources.)
//
// Run (needs a key — generation + judging both call the model):
//   ANALYSIS_EVAL_KEY=sk-… ANALYSIS_EVAL_PROVIDER=deepseek \
//     ANALYSIS_EVAL_MODEL=deepseek-chat node quality/analysis/judge.mjs
//
// PASS threshold: faithfulness ≥4 AND overreach ≥4 AND no dimension =1.

import {
  SYSTEM_PROMPT,
  assembleContext,
  assessRichness,
  buildUserMessage,
} from '../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { runChat, getProvider } from '../../global-perspectives-starter/frontend/src/services/llm.js';
import { LIVE_FIXTURES } from './fixtures.mjs';

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m' };

const JUDGE_SYSTEM = [
  'You are a strict editor grading an intelligence analyst\'s work. You are given the SOURCE MATERIAL the analyst was restricted to, the REQUEST they were answering, and their ANALYSIS.',
  'Grade ONLY against the source material — the analyst was told to use nothing else and to cite with [n].',
  'If the REQUEST poses a hypothetical ("what would X mean?"), exploring that hypothetical with clearly-conditional reasoning is REQUIRED, not overreach — only penalise overreach when conditional consequences are stated as established facts or invent specific figures/dates absent from the material.',
  'Score each dimension 1–5 (5 best):',
  '- faithfulness: every substantive claim is supported by the source material; nothing contradicts it.',
  '- overreach: 5 = no false precision; the analyst did NOT invent figures, dates, or confident scenarios the thin material cannot support. 1 = heavy overreach.',
  '- calibration: probabilities/uncertainty are honest; insufficient material is acknowledged rather than papered over.',
  '- citations: claims are anchored with [n]; no citation points to a source that was not provided.',
  '- insight: non-generic, specific, useful (this one is about quality, not honesty).',
  'Then give an overall verdict: "pass" or "flag", and one-sentence notes naming the single biggest issue (or "none").',
  'Respond with ONLY a JSON object: {"faithfulness":n,"overreach":n,"calibration":n,"citations":n,"insight":n,"verdict":"pass|flag","notes":"…"}. No prose, no code fence.',
].join(' ');

function parseJudge(text) {
  // Tolerant: strip code fences, grab the first {...} block.
  const cleaned = (text || '').replace(/```json?/gi, '').replace(/```/g, '');
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function scoreColor(n) {
  if (n >= 4) return C.grn;
  if (n === 3) return C.yel;
  return C.red;
}

function isPass(j) {
  return j && j.faithfulness >= 4 && j.overreach >= 4 &&
    [j.faithfulness, j.overreach, j.calibration, j.citations, j.insight].every((s) => s >= 2);
}

let passed = 0, failed = 0;

async function main() {
  const apiKey = process.env.ANALYSIS_EVAL_KEY;
  const provider = process.env.ANALYSIS_EVAL_PROVIDER || 'deepseek';
  const model = process.env.ANALYSIS_EVAL_MODEL || (getProvider(provider)?.models?.[0]);
  if (!apiKey) { console.error('Set ANALYSIS_EVAL_KEY (+ _PROVIDER/_MODEL) to run the judge.'); process.exit(1); }

  console.log(`LLM-as-judge · generate + grade (${getProvider(provider)?.label} · ${model})`);
  console.log('PASS = faithfulness≥4 AND overreach≥4 AND no dimension <2\n');

  for (const fx of LIVE_FIXTURES) {
    const { context, thin } = assembleContext(fx.enriched);
    for (const c of fx.cases) {
      const label = (c.mode === 'freeform' ? `freeform` : `lens:${c.lensId}`) + (thin ? ' [thin]' : '');
      const user = buildUserMessage({ context, mode: c.mode, lensId: c.lensId, freeform: c.freeform, thin });
      let analysis, judgment;
      try {
        ({ text: analysis } = await runChat({ provider, model, apiKey, system: SYSTEM_PROMPT, user }));
        const request = c.mode === 'freeform' ? c.freeform : `Guided lens: ${c.lensId}`;
        const judgeUser = `SOURCE MATERIAL:\n${context}\n\n---\nREQUEST:\n${request}\n\n---\nANALYSIS TO GRADE:\n${analysis}`;
        ({ text: judgment } = await runChat({ provider, model, apiKey, system: JUDGE_SYSTEM, user: judgeUser, temperature: 0 }));
      } catch (err) {
        failed++;
        console.log(`  ${C.red}✗${C.rst} ${fx.name} — ${label}: ${err.message}`);
        continue;
      }
      const j = parseJudge(judgment);
      if (!j) {
        failed++;
        console.log(`  ${C.red}✗${C.rst} ${fx.name} — ${label}: judge returned unparseable output`);
        continue;
      }
      const pass = isPass(j);
      pass ? passed++ : failed++;
      const dims = ['faithfulness', 'overreach', 'calibration', 'citations', 'insight']
        .map((k) => `${k[0].toUpperCase()}:${scoreColor(j[k])}${j[k]}${C.rst}`).join(' ');
      console.log(`  ${pass ? C.grn + '✓' : C.red + '✗'}${C.rst} ${fx.name} — ${label}`);
      console.log(`      ${dims}  verdict=${j.verdict}`);
      console.log(`      ${C.dim}${j.notes}${C.rst}`);
    }
  }

  console.log(`\n${passed} passed, ${failed ? C.red + failed + ' failed' + C.rst : '0 failed'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
