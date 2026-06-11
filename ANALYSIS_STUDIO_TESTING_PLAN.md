# Analysis Studio — Output Testing Plan

**Status:** Phase 1 (validator + eval) **BUILT & VALIDATED** 2026-06-11 — pending deploy.
**Feature under test:** Analysis Studio (`/analyze`) — see `ANALYSIS_STUDIO_PLAN.md`.
**Owner:** solo dev. **No CI** (intentional — manual on-demand checks only).

---

## 1. The problem

The Analysis Studio lets a reader pick up to 4 of our stories and get a cited
deep-dive from their own BYOK model. Its entire trustworthiness rests on a set of
**honesty guardrails** — cite real sources `[n]`, never invent figures, refuse on
thin data, stay locked to the selected stories.

Until now those rules lived **only as instructions in the system prompt**, with
**nothing verifying the model actually obeyed them**. On an intelligence product,
an analysis that cites a non-existent source or invents a percentage is
misinformation (see `feedback_no_misinformation_fallback`). "The analysis isn't
done" — because the output was never tested.

This plan covers how we test that output: a runtime validator + an offline eval.

---

## 2. What shipped in Phase 1 (2026-06-11)

| Piece | File | Role |
|------|------|------|
| **Guardrail validator** | `frontend/src/utils/analysisValidator.js` | Pure checker run on every output. |
| **Pure prompt layer** | `frontend/src/utils/analysisPrompt.js` | System prompt, lenses, context assembler, user-message builder — extracted out of `analysis.js` (which imports the browser-only `restProxy`) so the **eval imports exactly what ships**, no drift. |
| **Network layer** | `frontend/src/utils/analysis.js` | Now just `buildAnalysisContext()` (fetch) + re-exports the pure pieces. |
| **Live banner** | `frontend/src/components/AnalysisStudio.{jsx,css}` | Runs the validator after generation; shows green-pass / amber-verify / red-flag banner above the analysis. |
| **Eval harness** | `quality/analysis/run.mjs` + `fixtures.mjs` | Layer A (validator regression, no key) + Layer B (live generation, with key). |
| **A/B compare tool** | `quality/analysis/compare.mjs` | Free-form vs grounded-lens on the same stories, full text + verdict. |
| **Docs** | `quality/analysis/README.md` | How to run. |

**Result:** 12/12 (8 golden + 4 live, DeepSeek). Build clean. **Not yet deployed.**

---

## 3. Validator spec

`validateAnalysis(text, { citations, context }) → { ok, hasError, warnings[] }`

| code | severity | fires when |
|------|----------|-----------|
| `phantom_citation` | **error** | Output cites `[n]` for a story that wasn't provided (fabricated source). |
| `no_citations` | warn | A long (>400 char) answer cites nothing — and isn't an honest "Limits" refusal. |
| `invented_figure` | warn | A `%` stated as a **sourced fact** appears nowhere in the material. |
| `unused_source` | info | A provided story is never referenced (coverage note, not a defect). |

**Precision rules (so the banner never cries wolf — the no-misinformation
principle cuts both ways):**
- Scenario **probabilities** (`~60%`, `(15%)`) and approximations (`about 12%`) are
  **excluded** from `invented_figure` — they're analyst judgment the lens *asked
  for*, not fabricated facts. Detected via estimative cues (`probab|likelihood|
  chance|odds|scenario|roughly|around|about|~|≈`) + parenthetical/tilde form.
- Code fences / inline code are stripped before checking.
- A hard `error` fails an eval case; `warn`/`info` are surfaced for review only.

---

## 4. A/B audit findings (Free-form vs Grounded lens)

Run live on DeepSeek over two story-sets. Both modes share the same guardrails;
the A/B is **input style only**.

1. **Both stayed honest.** Neither fabricated sources; both produced unprompted
   "Limits of this analysis" sections distinguishing estimate from text. Validator
   passed both.
2. **The lens is more decision-grade.** Guided Scenario produced named scenarios
   with probabilities, dated triggers, and **confirming/killing evidence**
   (falsifiable, ICD-203 style). Free-form, on an open "analyze this" prompt,
   drifted to a well-organized *description* — no probabilities, no falsification.
   → Confirms keeping **Guided as the default mode**.
3. **⚠ Overreach on thin inputs (key gap).** On a single *unconfirmed rumor*,
   free-form correctly refused ("not actionable, impossible to verify"); the
   **guided lens still manufactured 3 probability-weighted scenarios** — false
   precision. The template pressure overrode the "refuse when insufficient" rule.
   The validator does **not** catch this (the probabilities are estimative and
   cited) — it catches *fabrication*, not *overreach*. See Phase 2.

---

## 5. Rollout (deploy Phase 1)

Per `CLAUDE.md`:
1. `cd global-perspectives-starter/frontend && npx vite build` (prebuild eslint is
   broken — use `npx vite build`, not `npm run build`).
2. `rm -rf docs/assets && cp -r dist/assets docs/assets && cp dist/index.html
   docs/index.html`
3. `rm -f docs/assets/*.map` (source maps are private).
4. `cp docs/index.html docs/404.html` + verify `diff` empty (SPA fallback).
5. Update `CHANGES.md`; commit src + docs together.
6. The eval harness (`quality/analysis/`) is **tooling, not shipped** — committed
   but needs no build/deploy.

---

## 6. Future phases (not built yet)

- **Phase 2 — thin-input overreach guard.** Before generation, score context
  richness (does any selected story have summary/prediction/figures, or just a
  bare headline?). If thin, either (a) strengthen the system prompt's refusal
  instruction for that run, or (b) for the Scenario lens specifically, downshift to
  a "what we can/can't say" template instead of forcing N scenarios. Add a
  `thin_input` *info* signal to the validator so the banner notes low support.
- **Phase 3 — LLM-as-judge (Layer C).** A second model grades each output for
  faithfulness/calibration/overreach (mirrors the economic-quality judge,
  `project_economic_quality_judge`). Heuristics catch the obvious; a judge catches
  semantic drift the regex can't. Run in the eval, not live (cost).
- **Phase 4 — benchmark set.** Grow `fixtures.mjs` into a graded golden set
  (good/adversarial outputs per lens) so regressions and prompt edits are measured,
  not vibe-checked. Capture real flagged outputs from production as new fixtures.
- **Phase 5 — production usage logging.** Once metered (Polar credits, see
  `project_billing_deprecated` / `POLAR_BILLING_PLAN.md`), log per-run validator
  verdicts (codes only, never the user's key or full text) to measure how often
  each guardrail fires by mode/lens/provider — the real-world quality signal.

---

## 7. How to run the tests

```bash
# Validator regression only (no key, no network):
node quality/analysis/run.mjs

# + live generation & validation:
ANALYSIS_EVAL_KEY=sk-… ANALYSIS_EVAL_PROVIDER=deepseek \
  ANALYSIS_EVAL_MODEL=deepseek-chat node quality/analysis/run.mjs

# A/B one story-set, full text:
ANALYSIS_EVAL_KEY=sk-… node quality/analysis/compare.mjs 0 scenario
```
`ANALYSIS_EVAL_PROVIDER` ∈ `deepseek|openai|gemini|openrouter|anthropic`. The key
is read from the env and passed straight to the provider — never stored or logged.
