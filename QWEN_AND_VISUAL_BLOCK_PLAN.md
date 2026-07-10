# Plan: DeepSeek visual-block reliability fix + Qwen provider (BYOK)

Status: **P0 DONE (verified) · P1–P3 → Sonnet · Deploy → operator/Opus**

Two independent changes to the Analysis Studio, both live-tested against the real DeepSeek/Qwen APIs during design.

---

## P0 — DeepSeek gp-struct visual-block fix  ✅ DONE (edits already made, live-verified)

**Problem:** DeepSeek v4-pro (the paid member-path model) emitted the `gp-struct`
block — the machine-readable index that makes ScenarioBars / IndicatorMatrix /
RippleTable render — in only **1 of 4** runs. So the visuals shipped 2026-07-10
were mostly invisible on the member path. (Qwen3.7-max emitted 4/4.)

**Fix (already applied to `src/utils/analysisPrompt.js`):**
1. Embedded a **fully-filled JSON template** in the SYSTEM_PROMPT gp-struct instruction
   (model copies the exact shape instead of an abstract one).
2. **Removed the easy "omit the whole block" exit** for the scenario + economic
   lenses (individual empty arrays may still be dropped; the whole-block skip only
   applies to other lenses / free-form).
3. Added a **mandatory tail reminder inside each lens task** (scenario + economic),
   at the point the model actually finishes writing.

**Honesty preserved:** `validateStruct` still strips any number/name not present in
the prose, so pushing emission cannot induce fabrication — a bad block is rejected,
never rendered. Confirmed in test: all 8 emitted blocks passed validation.

**Verification (live, `scratchpad/emit-test.mjs`):** emission of a *valid* block went
from **1/4 → 8/8** (6 scenario + 2 economic stories). No fabrication (all validated).

---

## P1 — Qwen provider: workspace-scoped base-URL override  → Sonnet

**Context:** Provider `qwen` (Alibaba, flagship `qwen3.7-max`) is already added to
`PROVIDERS` in `src/services/llm.js` with the generic `dashscope-intl` host. But
Alibaba's **international keys are workspace-scoped** (`sk-ws-…`) and require a host
with the WorkspaceId baked in, e.g.
`https://<WorkspaceId>.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1` (Tokyo)
or `…ap-southeast-1…` (Singapore). Verified live: the generic host 401s; the
workspace host returns 200 for `qwen3.7-max`. Without an override, BYOK users with
these keys hit a silent 401 — a broken-looking feature. Fix = let the user supply
their own endpoint for Qwen.

**Design — optional per-provider base-URL override (Qwen only for now):**

1. `src/services/llm.js`
   - Add `allowBaseUrlOverride: true` to the `qwen` provider entry; tighten its
     `keyHint`/note to mention workspace keys need the workspace endpoint.
   - `runChat({..., baseUrl})`: accept optional `baseUrl`; pass into `args`.
   - `runOpenAICompat(provider, { ..., baseUrl })`: use `const base = baseUrl || provider.baseUrl`
     for the `fetch(`${base}/chat/completions`)`. (Anthropic path unaffected.)
2. `src/utils/byok.js`
   - Store optional `baseUrl`: persist `{ provider, model, key, baseUrl }`; keep
     back-compat (missing `baseUrl` is fine). Loader must not reject when absent.
3. `src/components/ProviderModal.jsx`
   - When the selected provider has `allowBaseUrlOverride`, show an **optional**
     "Endpoint URL" text input, prefilled with `p.baseUrl`, with a one-line helper:
     workspace-scoped keys (sk-ws-…) need your workspace host, e.g.
     `https://<WorkspaceId>.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1`.
   - Save the trimmed value into byok (omit/undefined when unchanged or blank).
4. `src/components/AnalysisStudio.jsx`
   - Pass `baseUrl: byok.baseUrl` into the `runChat({...})` call (~line 135).

**Non-fabrication / safety:** endpoint override only changes the host; no prompt or
validator change. Blank → default host (unchanged behaviour for every other provider).

## P2 — CHANGES.md  → Sonnet
Add ONE dated entry (2026-07-10) covering both P0 (visual-block reliability fix,
1/4→8/8) and P1 (Qwen provider + workspace-URL override). Match existing format.

## P3 — Verify + commit (NO push, NO deploy)  → Sonnet
- `cd global-perspectives-starter/frontend && npm run verify` — must pass; paste output.
- Stage ONLY these files (the main checkout has unrelated uncommitted work — do NOT
  touch it): `src/utils/analysisPrompt.js`, `src/services/llm.js`, `src/utils/byok.js`,
  `src/components/ProviderModal.jsx`, `src/components/AnalysisStudio.jsx`,
  `CHANGES.md`, `QWEN_AND_VISUAL_BLOCK_PLAN.md`.
- Commit (one or two logical commits). **Do not push. Do not build docs/. Do not deploy.**

---

## Deploy — operator / Opus only (NOT Sonnet)
1. Frontend: `./deploy.sh` (build → docs/ → strip maps → resync 404.html). Explicit "yes" required.
2. `newsAnalyze` Lambda: re-sync `SYSTEM_PROMPT` via the **patched-deployed-zip** method
   (download deployed zip → patch only the prompt array → re-zip → `update-function-code`).
   NEVER zip the repo `src/index.js` (it carries the parked credits code). MAX_TOKENS
   env already 2400. Verify deployed bytes: `Key judgments` present, `gp-struct` present,
   `creditBalance` count = 0.
3. Push to origin/main after review.

## Non-negotiables (Sonnet)
- Do NOT run `./deploy.sh`, `git push`, or any `aws` command.
- Do NOT touch `docs/config.js`, `.env*`, any Lambda, or the unrelated uncommitted files.
- `analysisPrompt.js` must stay dependency-free (the offline eval imports it directly).
- If `npm run verify` fails, STOP and report — do not "fix" by weakening honesty rules.
