# Analysis Quality vs Professional Standards — study & comparison

**Status:** STARTED 2026-06-13. Standalone study (separate from the verify system —
[[ANALYSIS_STUDIO_TESTING_PLAN]] / `check.mjs` guarantee *no fabrication*; this asks the
different question: *is the analysis professional-grade?*). Quality has no ground truth,
so this is a **rubric-and-compare** study, not a scored benchmark.

## 0. What we saved

Live samples are persisted under `quality/analysis/samples/<date>.md` (first set:
`samples/2026-06-13.md` — Iran-deal scenario, Iran/EU/Venezuela compare, SpaceX-IPO
economic). Regenerate with `node quality/analysis/check.mjs --out quality/analysis/samples/<date>.html`.

## 1. How professionals actually do it (three traditions)

**A. Intelligence — ICD 203, the 9 analytic standards** ([ODNI ICD 203](https://www.intel.gov/assets/documents/intelligence-community-directives/ICD_203.pdf)):
(1) describe source quality/credibility; (2) express & explain uncertainty; (3) distinguish
information from assumptions/judgments; (4) **incorporate analysis of alternatives**;
(5) customer relevance + implications; (6) clear, logical argumentation; (7) explain change
in judgments; (8) accurate judgments; (9) effective visuals. Graded poor/fair/good/excellent.

**B. Markets — sell-/buy-side equity research** ([Wall Street Prep](https://www.wallstreetprep.com/knowledge/sample-equity-research-report/), [M&I](https://mergersandinquisitions.com/equity-research-report/)):
exec summary = **thesis in 3–5 sentences + catalysts**; thesis must "identify something the
market is **missing**" — vague "well-positioned for growth" "signals amateur analysis";
12-month target **derived from** valuation, not chosen first; risks. **The #1 documented
weakness: weak linkage** — failing to tie each factor to a *specific* impact.

**C. Geopolitics — Stratfor / structured forecasting** ([Stratfor methodology](https://worldview.stratfor.com/article/introducing-stratfor-worldview), [Geopolitical Basics](https://www.stratfor.com/sites/default/files/Geopolitical-Basics.pdf)):
foreground **structural constraints over personality/ideology**; long-term patterns over
short-term events; scenario development + forecasting; challenge assumptions, reconcile
conflicting sources.

## 2. Distilled rubric (the yardstick)

A professional analysis has: **(1) a thesis/view that names what others miss** (not
description); **(2) fact cleanly separated from judgment**; **(3) calibrated, explicit
uncertainty**; **(4) analysis of alternatives** (named scenarios); **(5) specific linkage
— factor → consequence/magnitude/mechanism**; **(6) structural drivers, not just events**;
**(7) source quality noted**; **(8) customer "so what" + what to watch**; **(9) honest limits**.

## 3. Comparison — our 2026-06-13 samples vs the rubric

**Already professional-grade (matches):**
- (4) Analysis of alternatives — named scenarios with probabilities ✓ (textbook ICD-203 / scenario forecasting).
- (2) Fact vs judgment — explicit "Limits" sections, "inferred", "timing unclear" ✓.
- (3) Uncertainty — estimative probability ranges ✓.
- (8) So-what + "what to watch" ✓. (9) Honest limits ✓. (7) Sources cited `[n]` ✓.

**Gaps (where we fall short of professional):**
- **(1) Thesis / "what the market is missing".** The guided lenses (scenario/compare/economic)
  *describe* well but rarely lead with a sharp, defensible **non-consensus call**. Only the
  *deep* lens (`DEEP_SYSTEM_PROMPT`) demands a thesis. Equity-research bar: a view, not a survey.
- **(5) Weak linkage — our biggest gap, and it's the textbook one.** The economic lens said
  "Tesla likely mixed", satellite internet "positive" — directional labels **not tied to a
  specific magnitude or mechanism**. The auditor independently flagged "core valuation
  component" as overstated. This is exactly the documented #1 equity-research weakness.
- **(6) Structural framing.** We lean on events/personalities (Trump, Maduro) more than on
  structural constraints (Hormuz geography, EU institutional ratchet, gang economics) —
  Stratfor's core discipline.
- **Calibration/differentiation.** Earlier runs showed multi-story scenarios clustering at
  ~60–70% — real analysts differentiate sharply. (`differentiation` already a deep-prompt nudge.)

## 4. Recommended improvements (test via `check.mjs` + human vibe, not a score)

1. **Add a "what others may be missing" line to the guided lenses** — required only when the
   material supports it (honesty guardrail intact); forbid vague "well-positioned"-style filler.
2. **Economic lens: enforce linkage** — every instrument/sector call must state
   *direction → rough magnitude → transmission mechanism*, or say "mechanism unclear". Kills the
   "likely mixed" with-no-why pattern.
3. **Encourage structural framing** — a "structural drivers" beat (geography, institutions,
   incentives) before event-level reaction.
4. **Extend the differentiation nudge** from the deep prompt to the scenario lens.

Each is a small `analysisPrompt.js` edit, shipped through build/deploy, then **re-sample +
human-read** (the verify system proves it still doesn't fabricate; the human judges if it's sharper).

## 4a. Fixes applied 2026-06-13 (+ the key lesson)

Applied to `analysisPrompt.js`: (1) `SYSTEM_PROMPT` now opens with a **"Bottom line"**
view (only where supported, never manufactured) + **favor structural drivers over
personalities**; (2) economic lens enforces **direction → magnitude → mechanism** (no bare
"mixed"/"positive"; "mechanism unclear" if it can't be derived); (3) scenario lens requires
**meaningfully different probabilities** (no clustering).

**Lesson — sharpening induced fabrication, and the verify check caught it.** First pass: the
push for specificity made the model invent **phantom citations** (a 1-story scenario cited
`[1][3][4][5]`), **invented investor names** (Fidelity/BlackRock) and an **invented date**
(July 4) — hard-fail + auditor flags. Fix: added a hard counterweight to `SYSTEM_PROMPT` —
"cite ONLY numbers that exist (one story → only [1])" and "sharpness must never become
fabrication: do not invent specific names/orgs/dates/figures; stay general rather than
fabricate." Re-sample (saved `samples/2026-06-13-improved.html`): all clean, citations correct
(`[1]` / `[1-3]` / `[1]`), Bottom line present, probabilities differentiated (60-70/20-30/10-15),
economic linkage present with honest "mechanism unclear". **Sharp AND honest.** This is the
verify loop working: change the prompt → check catches the regression → counterweight → re-check.

## 5. Cadence

On each notable prompt change: regenerate samples → `samples/<date>.md` → compare against §2
rubric + human read. The rubric is the yardstick; there is no pass-rate. Grow the saved-sample
archive over time as the record of how the analyst's quality evolves.
