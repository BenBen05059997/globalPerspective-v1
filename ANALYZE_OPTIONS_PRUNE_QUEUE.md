# ANALYZE OPTIONS PRUNE — Ralph queue

Drives `ANALYZE_OPTIONS_PRUNE_PLAN.md`. Ralph-loop pattern (`agent-kit/playbooks/AUTOMATION_LOOP.md`):
pick first `[ ]` → do ONLY that item per its Recipe/Scope → `cd global-perspectives-starter/frontend && npm run verify` →
if green, commit locally (`refactor(analyze): …`), mark `[x]`, append a log line. **Never push. Never `./deploy.sh`.**

## Guardrails (hard)
- LOCAL commits only. Push + `./deploy.sh` are a separate, human, gated step.
- One item per iteration. If verify is RED, revert the item's change and STOP (don't stack fixes).
- Diff cap: if the running loop diff exceeds ~250 net lines, HALT for review.
- A `BLOCKED:` item is NOT for the loop — skip it and stop when only BLOCKED items remain.
- These are subtractions/mechanical edits with EXACT recipes. Do not free-author; apply the recipe.
- Preserve every honesty guardrail (anti-fabrication prompt text, `validateStruct`). Do not touch the validator.

## Loop-safe items

- [x] **1. Deep-link safety net FIRST (unknown lens → scenario).** Recipe: in `src/components/AnalysisStudio.jsx`, where `lensId` is resolved/used, if the current `lensId` is not found in the imported `LENSES`, fall back to `'scenario'` (don't render a broken/empty lens). Scope: AnalysisStudio.jsx only; pure guard, no behavior change for valid lenses. Why first: makes items 4/5 safe (removing a lens can't strand a saved/deep-linked selection). Verify.

- [x] **2. Remove OpenRouter provider.** Recipe: in `src/services/llm.js` delete the `openrouter` object from the `PROVIDERS` array (and any `openrouter`-only helper branch). Back-compat: a saved byok record with `provider:'openrouter'` must not crash — the existing "unknown provider → prompt to re-choose via ProviderModal" path should handle it; if there is no such guard, add one (treat unknown provider id as "no valid key" → show the chooser). Scope: llm.js (+ minimal guard). Verify.

- [x] **3. Qwen: grandfather-only visibility.** Recipe: in `src/components/ProviderModal.jsx`, filter the qwen row OUT of the selectable provider list UNLESS a saved byok record already has `provider:'qwen'` (read via the existing byok loader). Do NOT delete the qwen entry from `llm.js` (saved keys must keep working). Scope: ProviderModal.jsx render filter only. Verify.

- [x] **4. Compare lens: conditional on ≥2 stories.** Recipe: in `AnalysisStudio.jsx`, hide/disable the `compare` lens option when fewer than 2 stories are selected (it is meaningless with 1). If `compare` was selected and selection drops below 2, fall back to `'scenario'` (item 1's guard covers the render). Scope: lens-picker render + selection effect. Verify.

- [x] **5. Merge Winners & losers → Economic ripple.** Recipe (EXACT): in `src/utils/analysisPrompt.js`, (a) remove the `winners_losers` entry from `LENSES`; (b) append to the `economic` lens `task` this sentence, verbatim, preserving surrounding style + the existing anti-fabrication counterweight: `Include a short "Who's exposed" read — the specific actors/sectors that gain or lose from this repricing, each tied to the direction→magnitude→mechanism above (name only actors present in the material; never invent firms/tickers).` Keep the economic lens's `gp-struct` ripples instruction intact. Scope: analysisPrompt.js LENSES only. Verify.

- [ ] **6. Remove Root-cause chain lens (conservative CUT — reversible).** Recipe: remove the `root_cause` entry from `LENSES` in `src/utils/analysisPrompt.js`, and drop its picker button in `AnalysisStudio.jsx` if hard-coded (else it's data-driven from LENSES and needs no JSX change). Item 1's guard catches any `?lens=root_cause` deep-link → scenario. Do NOT touch `TRACE_CAUSE` context assembly (still valuable as INPUT). Scope: analysisPrompt.js (+ picker if hard-coded). Verify.
  - NOTE: the "reborn as Challenge-our-causal-chain" option (plan P1b) is a NEW FEATURE, out of scope for this prune loop — a separate future plan if wanted.

- [ ] **7. CHANGES.md entry.** Recipe: add a dated entry recording the intentional option prune (OpenRouter retired; Qwen grandfathered; lenses 5→3: winners/losers merged into economic, root-cause cut, compare gated ≥2 stories) and WHY (hardened-lens coverage + choice-as-friction). This is the recorded-not-silent removal per [[feedback_no_unauthorized_removal]]. Scope: CHANGES.md. Verify (docs-only, verify still runs clean).

## BLOCKED / human-only (NOT for the loop — needs judgment, eyes, or a key)
- BLOCKED: **Provider modal tiering** (Recommended: DeepSeek+Gemini / "More" drawer). UI layout = eye judgment → do interactively.
- BLOCKED: **Model-ID refresh** (Sonnet 5, current GPT/Gemini). Needs current, verified IDs → interactive lookup, not a loop guess.
- BLOCKED: **P4 quality re-verify** — run `quality/analysis/check.mjs` per surviving lens on the live v4-pro config (needs the DeepSeek key; also fills the 6-week-stale-sample gap). Human/interactive.
- BLOCKED: **Browser click-through** (modal, Compare gating, Qwen visibility) — needs a real browser.
- BLOCKED: **Deploy** — `./deploy.sh`, explicit per-deploy human "yes". Member-path `newsAnalyze` SYSTEM_PROMPT stays FE-synced ONLY if the economic lens task text ships to members (patched-deployed-zip method; repo file carries PARKED credits code).

## Log
<!-- one line per commit: date · item# · verify result · net diff -->
- 2026-07-26 · item 1 · verify green (0 errors, 235 tests pass) · +6/-2 AnalysisStudio.jsx
- 2026-07-26 · item 2 · verify green (0 errors, 235 tests pass) · llm.js -14 (openrouter entry removed), AnalysisStudio.jsx +5/-1 (unknown-provider byok guard)
- 2026-07-26 · item 3 · verify green (0 errors, 235 tests pass) · ProviderModal.jsx +6/-1 (qwen filtered from fresh-pick list, kept selectable if already saved)
- 2026-07-26 · item 4 · verify green (0 errors, 235 tests pass) · AnalysisStudio.jsx +22/-10 (compare button disabled <2 stories + activeLensId fallback), AnalysisStudio.css +2 disabled style
- 2026-07-26 · item 5 · verify green (0 errors, 235 tests pass) · analysisPrompt.js net -7 (winners_losers entry removed, "Who's exposed" sentence appended to economic task)
