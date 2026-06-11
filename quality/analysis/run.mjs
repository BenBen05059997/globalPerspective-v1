// Analysis Studio eval — quality/analysis/run.mjs
//
// Two layers, like the economic-quality evals:
//   Layer A (always, no key): run the guardrail validator against frozen GOLDEN
//     fixtures and assert the EXACT warning codes. This is the regression net for
//     utils/analysisValidator.js — the same module the live Studio uses.
//   Layer B (only with a key): build the REAL prompt (same SYSTEM_PROMPT + lenses +
//     buildUserMessage the app ships), call the chosen provider, validate the output,
//     and print a per-case report. This is the live quality check.
//
// Run:
//   node quality/analysis/run.mjs                 # Layer A only
//   ANALYSIS_EVAL_KEY=sk-… ANALYSIS_EVAL_PROVIDER=deepseek \
//     ANALYSIS_EVAL_MODEL=deepseek-chat node quality/analysis/run.mjs   # A + B
//
// The key is read from the environment and passed straight to the provider — it is
// never written to disk or logged (mirrors the browser BYOK contract).

import { validateAnalysis } from '../../global-perspectives-starter/frontend/src/utils/analysisValidator.js';
import {
  SYSTEM_PROMPT,
  assembleContext,
  assessRichness,
  buildUserMessage,
} from '../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { runChat, getProvider } from '../../global-perspectives-starter/frontend/src/services/llm.js';
import { GOLDEN, LIVE_FIXTURES, RICHNESS_CASES } from './fixtures.mjs';

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m' };
const ok = (s) => `${C.grn}${s}${C.rst}`;
const bad = (s) => `${C.red}${s}${C.rst}`;
const warn = (s) => `${C.yel}${s}${C.rst}`;

let passed = 0;
let failed = 0;
const failures = [];

function eq(a, b) {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
}

// ── Layer A — validator regression against GOLDEN ────────────────────────────
function layerA() {
  console.log('\n── Layer A · validator golden fixtures ──────────────────────');
  for (const g of GOLDEN) {
    const res = validateAnalysis(g.text, { citations: g.citations, context: g.context, thinInput: g.thinInput });
    const gotCodes = res.warnings.map((w) => w.code);
    const codesOk = eq(gotCodes, g.expect.codes);
    const errorOk = res.hasError === g.expect.hasError;
    if (codesOk && errorOk) {
      passed++;
      console.log(`  ${ok('✓')} ${g.name}`);
    } else {
      failed++;
      failures.push(g.name);
      console.log(`  ${bad('✗')} ${g.name}`);
      if (!codesOk) console.log(`      codes: expected [${g.expect.codes.join(', ')}] got [${gotCodes.join(', ')}]`);
      if (!errorOk) console.log(`      hasError: expected ${g.expect.hasError} got ${res.hasError}`);
    }
  }
}

// ── Layer A2 — assessRichness (thin-input detector) regression ───────────────
function layerRichness() {
  console.log('\n── Layer A2 · assessRichness (thin-input guard) ─────────────');
  for (const r of RICHNESS_CASES) {
    const got = assessRichness(r.enriched).thin;
    if (got === r.expectThin) {
      passed++;
      console.log(`  ${ok('✓')} ${r.name} → thin=${got}`);
    } else {
      failed++;
      failures.push(r.name);
      console.log(`  ${bad('✗')} ${r.name} → thin=${got}, expected ${r.expectThin}`);
    }
  }
}

// ── Layer B — live generation + validation ───────────────────────────────────
async function layerB(provider, model, apiKey) {
  console.log(`\n── Layer B · live generation (${getProvider(provider)?.label || provider} · ${model}) ──`);
  for (const fx of LIVE_FIXTURES) {
    const { context, citations, thin } = assembleContext(fx.enriched);
    for (const c of fx.cases) {
      const label =
        (c.mode === 'freeform' ? `freeform: "${c.freeform}"` : `lens: ${c.lensId}`) +
        (thin ? ' [thin-guard]' : '');
      const user = buildUserMessage({ context, mode: c.mode, lensId: c.lensId, freeform: c.freeform, thin });
      let text;
      try {
        ({ text } = await runChat({ provider, model, apiKey, system: SYSTEM_PROMPT, user }));
      } catch (err) {
        failed++;
        failures.push(`${fx.name} / ${label}`);
        console.log(`  ${bad('✗')} ${fx.name} — ${label}\n      call failed: ${err.message}`);
        continue;
      }
      const res = validateAnalysis(text, { citations, context, thinInput: thin });
      const errs = res.warnings.filter((w) => w.severity === 'error');
      const warns = res.warnings.filter((w) => w.severity === 'warn');
      // A live case "passes" iff no hard error (phantom source). Soft warns are
      // reported but not failures — they're verify-flags, not breaches.
      if (errs.length === 0) {
        passed++;
        const tag = warns.length ? warn(`✓ (${warns.length} warn)`) : ok('✓');
        console.log(`  ${tag} ${fx.name} — ${label}  ${C.dim}(${text.length} chars)${C.rst}`);
      } else {
        failed++;
        failures.push(`${fx.name} / ${label}`);
        console.log(`  ${bad('✗')} ${fx.name} — ${label}`);
      }
      for (const w of res.warnings) {
        const col = w.severity === 'error' ? bad : w.severity === 'warn' ? warn : (s) => `${C.dim}${s}${C.rst}`;
        console.log(`      ${col(`[${w.severity}] ${w.message}`)}`);
      }
    }
  }
}

async function main() {
  layerA();
  layerRichness();

  const apiKey = process.env.ANALYSIS_EVAL_KEY;
  const provider = process.env.ANALYSIS_EVAL_PROVIDER || 'deepseek';
  const model = process.env.ANALYSIS_EVAL_MODEL || (getProvider(provider)?.models?.[0]);
  if (apiKey) {
    if (!getProvider(provider)) {
      console.log(`\n${bad('Layer B skipped:')} unknown provider "${provider}".`);
    } else {
      await layerB(provider, model, apiKey);
    }
  } else {
    console.log(`\n${C.dim}Layer B skipped — set ANALYSIS_EVAL_KEY (+ _PROVIDER/_MODEL) to run live generation.${C.rst}`);
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`${passed} passed, ${failed ? bad(`${failed} failed`) : '0 failed'}`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
