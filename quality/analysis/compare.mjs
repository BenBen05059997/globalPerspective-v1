// quality/analysis/compare.mjs — A/B the two input styles on the SAME stories.
//
// Generates a Free-form analysis and a Guided (grounded lens) analysis from one
// story-set, prints both in full, and shows the guardrail verdict on each — so a
// human can read them side by side and judge which input style produces the better
// output. (The A/B is INPUT STYLE only; both share the same honesty contract.)
//
// Run:
//   ANALYSIS_EVAL_KEY=sk-… ANALYSIS_EVAL_PROVIDER=deepseek \
//     ANALYSIS_EVAL_MODEL=deepseek-chat node quality/analysis/compare.mjs [fixtureIndex] [lensId]
//
// Defaults: fixtureIndex 0, lensId 'scenario'.

import { validateAnalysis } from '../../global-perspectives-starter/frontend/src/utils/analysisValidator.js';
import {
  SYSTEM_PROMPT,
  assembleContext,
  buildUserMessage,
  getLens,
} from '../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { runChat, getProvider } from '../../global-perspectives-starter/frontend/src/services/llm.js';
import { LIVE_FIXTURES } from './fixtures.mjs';

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m', rst: '\x1b[0m' };

function verdictLine(res) {
  if (res.ok) return `${C.grn}✓ guardrail check passed${C.rst}`;
  const errs = res.warnings.filter((w) => w.severity === 'error').length;
  const head = errs ? `${C.red}✗ ${errs} error${C.rst}` : `${C.yel}⚠ verify${C.rst}`;
  return head;
}

function printResult(title, text, res) {
  console.log(`\n${C.bold}${C.cyn}╔══ ${title} ${'═'.repeat(Math.max(0, 56 - title.length))}${C.rst}`);
  console.log(`${C.dim}${text.length} chars · ${verdictLine(res)}${C.rst}`);
  for (const w of res.warnings) {
    const col = w.severity === 'error' ? C.red : w.severity === 'warn' ? C.yel : C.dim;
    console.log(`  ${col}[${w.severity}] ${w.message}${C.rst}`);
  }
  console.log(`${C.cyn}╟${'─'.repeat(60)}${C.rst}`);
  console.log(text.trim());
  console.log(`${C.cyn}╚${'═'.repeat(60)}${C.rst}`);
}

async function main() {
  const apiKey = process.env.ANALYSIS_EVAL_KEY;
  const provider = process.env.ANALYSIS_EVAL_PROVIDER || 'deepseek';
  const model = process.env.ANALYSIS_EVAL_MODEL || (getProvider(provider)?.models?.[0]);
  if (!apiKey) { console.error('Set ANALYSIS_EVAL_KEY (+ _PROVIDER/_MODEL) to run.'); process.exit(1); }

  const fxIdx = Number(process.argv[2] || 0);
  const lensId = process.argv[3] || 'scenario';
  const fx = LIVE_FIXTURES[fxIdx];
  if (!fx) { console.error(`No fixture at index ${fxIdx}.`); process.exit(1); }

  const { context, citations } = assembleContext(fx.enriched);
  console.log(`${C.bold}Story-set:${C.rst} ${fx.name}`);
  console.log(`${C.dim}${citations.map((c) => `[${c.n}] ${c.title}`).join('\n')}${C.rst}`);
  console.log(`${C.dim}Provider: ${getProvider(provider)?.label} · ${model}${C.rst}`);

  // Same stories, two input styles.
  const guidedUser = buildUserMessage({ context, mode: 'guided', lensId });
  const freeUser = buildUserMessage({
    context,
    mode: 'freeform',
    freeform: 'Give a sharp intelligence analysis of the selected stories.',
  });

  const [guidedRes, freeRes] = await Promise.all([
    runChat({ provider, model, apiKey, system: SYSTEM_PROMPT, user: guidedUser }),
    runChat({ provider, model, apiKey, system: SYSTEM_PROMPT, user: freeUser }),
  ]);
  const guided = guidedRes.text;
  const free = freeRes.text;

  printResult(`GROUNDED · guided lens: ${getLens(lensId).label}`, guided, validateAnalysis(guided, { citations, context }));
  printResult('FREE-FORM · open prompt', free, validateAnalysis(free, { citations, context }));
}

main().catch((e) => { console.error(e); process.exit(1); });
