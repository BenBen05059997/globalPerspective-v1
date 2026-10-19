# Analysis Studio — professional structure upgrade (Key Judgments · ICD-203 vocabulary · Indicators table · visuals)

**Status: ✅ SHIPPED + DEPLOYED 2026-07-10.** P1+P2 built by Sonnet, reviewed/tested by the main agent (Fable). Review caught 4 real bugs pre-deploy: newsAnalyze server prompt had DRIFTED (missing all 06-13 upgrades — synced verbatim); gp-struct truncation at 1600 tokens (extraction now truncation-safe, budget→2400); two validator false-positives from the new structure (threshold criteria ">50%", scenario-heading ranges — both fixed + goldens). Final live run: full structure present, zero warnings, zero fabrication. ⚠️ Prod newsAnalyze deploy = PROMPT-PATCHED the deployed (pre-credits) code — repo code carries the PARKED credits feature and must NOT be zipped to prod until PROD_CREDITS_NEXT_STEPS runs. Self-contained for a hand-off agent.
Parents: `ANALYSIS_QUALITY_COMPARISON_PLAN.md` (the rubric study this extends — content gaps fixed 06-13; THIS plan fixes the **packaging/structure** gaps), `ANALYSIS_STUDIO_PLAN.md` (the feature), `ANALYSIS_STUDIO_TESTING_PLAN.md` (the verify system every change must re-pass).

---

## 1. Why — the gap (verified 2026-07-10 vs live samples + pro standards)

The engine's *content* is professional-grade (live-tested 07-09/07-10: 0 fabrication, desk-grade scenarios, real-world truth-check confirmed its inferences). What it lacks is professional **packaging** — the conventions from ICD-203 / equity research / Stratfor that make analysis *scannable and decision-usable*:

| Missing convention | Pro standard | Our current output |
|---|---|---|
| **Key Judgments box (BLUF)** | 3–4 scannable bullets BEFORE prose; each = judgment + probability + confidence | One "Bottom line" sentence, then a wall of prose |
| **Standardized probability vocabulary** | ICD-203 yardstick: words↔numbers stable across reports | Ad-hoc ("Most Likely — 55-65%", "Tail Risk") |
| **Confidence ≠ probability** | "likely (60%), moderate confidence" — confidence reflects source/material quality | Never stated; source-robustness exists (L1 banner) but is not wired into judgments |
| **Indicators & Warnings table** | Structured watch-list: indicator → confirms which scenario → kills which | Same content scattered as prose bullets (Iran 07-09 sample proved the cost: the decisive indicator was buried in 2,000 words) |
| **Effective visuals** (ICD-203 std #9) | Charts/tables where they carry the message | Prose-only markdown |

Deferred (do NOT build now): ICD-203 #7 "explain change from prior judgment" (needs prior-analysis retrieval — synergy with the drift infra, future phase); real market sparklines (needs data plumbing); email-render bars (polish).

## 2. The ICD-203 probability yardstick (use EXACTLY this vocabulary)

`almost no chance (1–5%) · very unlikely (5–20%) · unlikely (20–45%) · roughly even chance (45–55%) · likely (55–80%) · very likely (80–95%) · almost certain (95–99%)`

Confidence is a SEPARATE axis — `low / moderate / high` — reflecting how much real material backs the judgment (single-source/thin → low; multi-source corroborated → high). A judgment can be "very likely, low confidence."

## 3. Phase P1 — prompt upgrades (`utils/analysisPrompt.js` ONLY)

All edits to the pure prompt layer (no browser imports — the offline eval imports this exact file).

**P1.1 `SYSTEM_PROMPT` — Key Judgments box.** After the existing "Bottom line" instruction, add: open the analysis (right after Bottom line) with a `## Key judgments` section of 2–4 bullets; each bullet = ONE decision-relevant judgment stated with a yardstick probability term (word + % range) AND a confidence level (low/moderate/high) justified by the material's depth/corroboration. THEN the detailed sections. **Counterweight (non-negotiable):** only where the material supports judgments — if it can't support 2 calibrated judgments, write fewer or none and say so; NEVER manufacture a judgment to fill the box.

**P1.2 `SYSTEM_PROMPT` — yardstick vocabulary.** Instruct: when expressing likelihood anywhere, use the §2 vocabulary verbatim (word + numeric range together, e.g. "likely (55–80%)" or a narrower explicit range inside a band, e.g. "60–70% — likely"). Never use vague terms ("could", "may well") for headline judgments.

**P1.3 `SYSTEM_PROMPT` — confidence separate from probability.** One sentence: probability = chance the event happens; confidence = how solid the underlying material is; state both for key judgments; a thin single-source story caps confidence at low regardless of how likely the event seems.

**P1.4 Scenario lens (`LENSES[0].task`) — Indicators & Warnings table.** Append: end with a markdown table `| Indicator to watch | Confirms | Kills |` — one row per concrete, observable signal, mapping it to the scenario(s) it confirms and the scenario(s) it kills. Rows must be OBSERVABLE events (news a reader can check), not abstractions. If the material supports fewer than 2 real indicators, write "No clean indicators derivable from this material" instead of padding. This REPLACES nothing — the per-scenario confirming/killing prose stays; the table is the consolidated dashboard.

**P1.5 Anti-fabrication counterweight (the 06-13 lesson — load-bearing).** The 06-13 sharpening push induced phantom citations + invented names; the fix was explicit counterweights. Every P1 instruction must carry its own escape hatch (write fewer/none/"not derivable") and the existing SYSTEM_PROMPT counterweight lines must remain untouched. Do not weaken any existing honesty rule.

## 4. Phase P2 — structured visual block + rendering

**P2.1 The block.** Instruct the model (SYSTEM_PROMPT, applies to guided scenario + economic lenses; skip freeform/deep for now): after the analysis, append a fenced code block tagged `gp-struct` containing ONLY JSON:
```
{ "scenarios": [{ "name": "...", "pLow": 55, "pHigh": 65 }],
  "indicators": [{ "signal": "...", "confirms": "scenario name", "kills": "scenario name|" }],
  "ripples": [{ "instrument": "...", "direction": "up|down|mixed", "magnitude": "small|moderate|large" }] }
```
Every field optional; arrays may be empty/omitted. **HARD RULE stated in the prompt: the block may contain ONLY numbers/names already present in the prose above — it is a machine-readable index of the analysis, never new content.**

**P2.2 Parser — NEW `utils/analysisStruct.js` (pure, no browser imports).**
- `extractStruct(text)` → `{ struct|null, prose }`: finds the ```gp-struct fence, JSON.parses it, returns the struct AND the text with the fence stripped. Malformed JSON / missing fence → `{ struct: null, prose: text }` (never throws).
- `validateStruct(struct, prose)` → sanitized struct: drop any scenario whose `pLow`/`pHigh` aren't 0–100 numbers with pLow≤pHigh, **drop any scenario whose probability numbers do not literally appear in the prose** (string match on the digits — the anti-invention cross-check), drop indicators/ripples with empty required fields or bad enums. Empty arrays after sanitize → null that section.
- Node tests (`src/test/`), vitest style matching existing tests: good block parses; malformed → null + intact prose; probability-not-in-prose → scenario dropped; fence stripped from prose.

**P2.3 Wiring (`components/AnalysisStudio.jsx`).**
- After a run: `const { struct, prose } = extractStruct(rawText)` → validate → store both. Pass **prose** (not raw) to `validateAnalysis` AND to `<Markdown>` (the JSON block must never hit the validator — its bare numbers would false-trigger `invented_figure` — nor render as a code block).
- Render below the markdown, when present: `<ScenarioBars scenarios={…} />`, `<IndicatorMatrix indicators={…} />`, `<RippleTable ripples={…} />`. `struct === null` → render nothing extra (honest fallback; prose stands alone).

**P2.4 Atoms — NEW `components/atoms/AnalysisVisuals.jsx` (+ one css).**
- `ScenarioBars`: one horizontal range-bar per scenario — filled segment from pLow→pHigh on a 0–100 track, name left, "pLow–pHigh%" right. Pure CSS (no d3 needed at this size), use existing design tokens (`--accent`, `--ink*`, `--risk-*` where natural). Compact — this is a summary strip, not a hero chart.
- `IndicatorMatrix`: the §P1.4 table rendered as a styled 3-col table (Indicator / Confirms ✓ / Kills ✗), quiet colors.
- `RippleTable`: instrument | direction glyph (▲/▼/◆) | magnitude dots (●/●●/●●●).
- All three: render `null` on empty/missing input. No new dependencies.

**P2.5 Offline eval compatibility.** `quality/analysis/check.mjs` imports the shipped prompt/validator. Do NOT restructure its API. If trivially easy, ALSO strip the gp-struct block there before validation (import `extractStruct`); if that requires touching more than a few lines, leave check.mjs alone and note it (the block's estimative probabilities largely match the validator's existing exclusions — an occasional `invented_figure` warn in the eval is a known cosmetic until the harness is updated).

## 5. Verify + test gate (Sonnet runs; Opus re-runs independently)

1. `cd global-perspectives-starter/frontend && npm run verify` → green (lint + vitest incl. the new parser/atom tests + build).
2. Reason through the honest-fallback paths: no fence → unchanged behavior; malformed JSON → prose renders, no crash; block numbers absent from prose → that item silently dropped.
3. Live re-sample (Opus will run): `check.mjs` against live stories — confirm Key Judgments box + yardstick language + indicators table appear, fabrication check still clean. **If the structure push induces phantom cites/invented specifics (the 06-13 regression), STOP and strengthen counterweights before proceeding.**

## 6. Deploy (GATED — fresh operator "yes" required; NOT part of the build task)
`./deploy.sh` per CLAUDE.md. Browser click-check `/analyze` (run one guided scenario analysis, see bars+table render; one freeform, confirm nothing broke) before/after per [[feedback_test_ui_in_browser]].

## 7. Non-negotiables
- **Never fabricate to fill a template** — every new section has an explicit omit-when-unsupported escape hatch; existing honesty counterweights stay verbatim.
- The gp-struct block is an index of the prose, never new content; unverifiable items are dropped, not rendered ([[feedback_no_misinformation_fallback]]).
- Validator + Markdown receive the STRIPPED prose, never the raw block.
- `analysisPrompt.js` and `analysisStruct.js` stay pure (no browser imports) — the offline eval must import exactly what ships.
- No new npm dependencies. Scope: `utils/analysisPrompt.js`, `utils/analysisStruct.js` (new), `components/AnalysisStudio.jsx`, `components/atoms/AnalysisVisuals.jsx` (new) + css, tests; `check.mjs` only if trivial.
- Build/verify/commit in the worktree; do NOT push, do NOT deploy (Opus reviews, pushes after review; deploy needs fresh operator auth).
