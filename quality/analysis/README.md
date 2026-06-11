# Analysis Studio output tests

Tests for what the `/analyze` (Analysis Studio) feature actually produces. The
Studio's honesty rules — cite real sources, never invent figures, refuse on thin
data — previously lived **only as instructions in the system prompt**, with
nothing verifying the model obeyed them. These tests close that gap.

## Pieces

| File | What it is |
|------|------------|
| `../../global-perspectives-starter/frontend/src/utils/analysisValidator.js` | The shared guardrail checker. Pure/dependency-free. Used by **both** the live Studio (warning banner) and this eval. |
| `../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js` | The pure prompt layer (system prompt, lenses, context assembler, user-message builder) the Studio ships — imported here so the eval tests exactly what runs in production. |
| `fixtures.mjs` | `GOLDEN` (frozen validator cases) + `LIVE_FIXTURES` (story-sets for live generation). |
| `run.mjs` | The runner. Layer A always; Layer B with a key. |

## What the validator flags

| code | severity | meaning |
|------|----------|---------|
| `phantom_citation` | **error** | Cites `[n]` for a source that wasn't provided — a fabricated reference. |
| `no_citations` | warn | A long answer that anchors none of its claims. |
| `invented_figure` | warn | A `%` figure that appears nowhere in the source material. Soft (the model may round). |
| `unused_source` | info | A provided story was never referenced — coverage note, not a defect. |

## Running

```bash
# Layer A only — validator regression, no API key, no network:
node quality/analysis/run.mjs

# Layer A + Layer B — also generate real analyses and validate them.
# The key is read from the env and passed straight to the provider; never stored/logged.
ANALYSIS_EVAL_KEY=sk-… \
ANALYSIS_EVAL_PROVIDER=deepseek \
ANALYSIS_EVAL_MODEL=deepseek-chat \
  node quality/analysis/run.mjs
```

`ANALYSIS_EVAL_PROVIDER` accepts any id from `services/llm.js` (`deepseek`,
`openai`, `gemini`, `openrouter`, `anthropic`). `ANALYSIS_EVAL_MODEL` defaults to
that provider's first model.

- **Layer A** asserts the validator emits the exact warning codes each golden
  fixture expects. A failure here means the guardrail logic regressed.
- **Layer B** builds the real prompt, calls the model, and validates the output. A
  case **fails** only on an error-severity warning (a phantom citation). Soft
  warns (invented figure, no citations) are printed for review but don't fail —
  they're verify-flags, not breaches.

Exit code is non-zero if anything failed, so this can gate a manual pre-deploy
check (it is **not** wired into CI — this repo is intentionally CI-free).
