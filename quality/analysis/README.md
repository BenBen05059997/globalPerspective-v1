# Analysis output tests

Offline checks of the analysis libraries that stay after the Analysis Studio was retired (decision 0033): the guardrail
validator, the prompt layer and the gp-struct checker in `global-perspectives-starter/frontend/src/features/analysis-studio/lib/`.
The honesty rules (cite real sources, never invent figures, refuse on thin data) are instructions in the system prompt;
these scripts verify the model's output obeys them. Nothing here runs in the site; five of those library files are
byte-identical copies in `backend/read-api/newsSharedAnalysis/src/` (`node scripts/check-shared-sync.mjs`).

## Pieces

| File | What it is |
|------|------------|
| `../../global-perspectives-starter/frontend/src/features/analysis-studio/lib/analysisValidator.js` | The guardrail checker. Pure and dependency-free; imported by these scripts and kept in sync with the share Lambda's copy. |
| `../../global-perspectives-starter/frontend/src/features/analysis-studio/lib/analysisPrompt.js` | The pure prompt layer (system prompt, lenses, context assembler, user-message builder), imported here so the eval tests the same prompt text. |
| `fixtures.mjs` | `GOLDEN` (frozen validator cases), `RICHNESS_CASES` (thin-input detector), `STRUCT_CASES` (gp-struct checker) and `LIVE_FIXTURES` (story-sets for live generation). |
| `run.mjs` | The runner. Layer A (validator), A2 (`assessRichness`) and the struct cases always; Layer B (live) with a key. |
| `compare.mjs` | A/B free-form vs grounded-lens on one story-set, full text + verdict. |
| `judge.mjs` | **Layer C** — LLM-as-judge: grades live output on faithfulness/overreach/calibration/citations/insight. Needs a key. |
| `check.mjs` | The fabrication check: a few live analyses, the validator, and a one-line faithfulness flag per case (optionally emailed). Needs a key. |
| `samples/` | Two saved example outputs (HTML) referenced by `check.mjs`. |
| `source_check.mjs` | Source-truth check: outlet corroboration (no key with `--l1-only`) and summary-vs-snippet drift (needs a key). |

## What the validator flags

| code | severity | meaning |
|------|----------|---------|
| `phantom_citation` | **error** | Cites `[n]` for a source that wasn't provided — a fabricated reference. |
| `no_citations` | warn | A long answer that anchors none of its claims. |
| `invented_figure` | warn | A `%` figure that appears nowhere in the source material. Soft (the model may round). |
| `unused_source` | info | A provided story was never referenced — coverage note, not a defect. |
| `thin_input` | info | The source material was thin; scenario specifics are lightly supported (set when the thin-input guard, `assessRichness`, is active). |

## Running

```bash
# Layer A only — validator regression, no API key, no network:
node quality/analysis/run.mjs

# Layer A + Layer B — also generate real analyses and validate them.
# The key is read from the env and passed straight to the provider; never stored/logged.
ANALYSIS_EVAL_KEY=sk-… \
ANALYSIS_EVAL_PROVIDER=deepseek \
ANALYSIS_EVAL_MODEL=deepseek-v4-pro \
  node quality/analysis/run.mjs

# A/B free-form vs grounded lens on one story-set (full text):
ANALYSIS_EVAL_KEY=sk-… node quality/analysis/compare.mjs 0 scenario

# Layer C — LLM-as-judge (semantic quality grading):
ANALYSIS_EVAL_KEY=sk-… node quality/analysis/judge.mjs
```

The **judge is a quality report, not a hard gate** — its scores are model-judged
and vary run to run. A non-zero exit means a case scored below the PASS bar
(faithfulness ≥4, overreach ≥4, no dimension <2); read the notes, don't just trust
the exit code.

`ANALYSIS_EVAL_PROVIDER` accepts any provider id from
`global-perspectives-starter/frontend/src/shared/lib/llmProviders.js` (`deepseek`,
`perplexity`, `openai`, `gemini`, `qwen`, `anthropic`); the default is `deepseek`.
`ANALYSIS_EVAL_MODEL` defaults to the first model that file lists for the provider.

- **Layer A** asserts the validator emits the exact warning codes each golden
  fixture expects. A failure here means the guardrail logic regressed.
- **Layer B** builds the real prompt, calls the model, and validates the output. A
  case **fails** only on an error-severity warning (a phantom citation). Soft
  warns (invented figure, no citations) are printed for review but don't fail —
  they're verify-flags, not breaches.

Exit code is non-zero if anything failed, so this can gate a manual pre-deploy
check (it is **not** wired into CI — this repo is intentionally CI-free).
