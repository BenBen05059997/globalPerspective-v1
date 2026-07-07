# Scoring Model v2 — dimensions, not one risk number

**Status:** PROPOSED (2026-07-07, brainstorm + code-grounded audit). Not built. Independent of the member-gating work.
**Owner decisions needed** before build — see §10.

---

## 1. The problem

Everything today reduces a country or thread to a **single `riskScore` 0-100** (+ a `riskLevel` word for countries). One number conflates things that aren't the same: a tense-but-stable economy and an active war zone can both read **70**, and the number never says *which*. Two shipped bugs trace directly to this:

- **Breaking-alert scorer: country-risk dominance (~14% precision)** — one blended risk number, weight `2.0`, drowned out every other signal (`newsBreakingAlert/significance.js:23,62-64`).
- **Prediction probabilities came out boilerplate 65%** — a single LLM number with nothing forcing it to *mean* something (separate model, but same failure mode).

**Goal:** decompose risk into a small set of grounded **dimensions**, keep one glanceable headline that *explains itself*, and never collapse the dimensions back into a weighted average (that just rebuilds the crude number).

## 2. The design (the one decision that matters)

**Dimensions as the primary object; the headline is the WORST axis + its label — never a weighted total.**

Dimension set (each `0-100` or `null`), chosen to map onto the impact-first domains already in the pipeline (GDACS/ACLED/econ):

| Axis | What it scores |
|---|---|
| `conflict` | violence / military / armed-actor intensity |
| `political` | institutional stability, legitimacy, unrest, governance |
| `economic` | financial stress, sanctions, disruption (country-level, distinct from the instrument-level `newsEconomicImpact`) |
| `humanitarian` | displacement, disaster, civilian harm |

`trajectory` stays a **separate directional field** (escalating / stable / de-escalating) — it already exists; it is NOT a 5th 0-100 axis.

**Headline (derived, deterministic, transparent):**
```
riskScore  = max(dimensions)          // the worst axis, NOT an average
riskLevel  = tierFromScore(riskScore) // existing 25/50/75 bands, unchanged
lead       = argmax(dimensions)       // which axis drives the headline
```
So `{conflict:88, political:55, economic:40, humanitarian:20}` → headline **"HIGH — Conflict 88"**. `max` preserves the worst-axis signal (a war zone stays HIGH even with a calm economy), avoids averaging-washout, and needs **no arbitrary weights**. `lead` makes the headline self-explaining.

> Explicit non-goal (the trap we already talked through): **no `0.3·conflict + 0.2·econ + …` total.** Weights are arbitrary and an average hides the very decomposition that makes this useful.

## 3. Why this migrates incrementally (the back-compat trick)

The generators write the **derived scalar (`riskScore`/`riskLevel`) alongside the new `dimensions` vector**. Because the scalar is still present on every record:

- **Every existing consumer keeps working on day one, untouched** — they read `riskScore`/`riskLevel` exactly as now.
- New/upgraded consumers read `dimensions` + `lead` for the richer view.
- Old (pre-migration) records have only the scalar → the adapter treats them as `{score, lead: null}` and degrades gracefully (headline with no per-axis breakdown).

This turns a scary core migration into an **additive, phase-able, pausable** one. If the vector proves boilerplate (§9), the derived scalar keeps the whole product running and we stop at Phase B.

## 4. DDB schema (SummarizeAndPredict) — additive

Add a `dimensions` object (+ `lead`) next to the existing scalar on each record that carries risk today. **Keep** `riskScore`/`riskLevel` (now derived).

| Record | PK / SK | Today | Add |
|---|---|---|---|
| Country core | `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE` | `riskScore`,`riskLevel` | `dimensions{…}`, `lead` |
| Country snapshot | `COUNTRY#<name>` / `HISTORY#<date>` | embeds `riskScore`,`riskLevel` | embed `dimensions`,`lead` |
| Thread core | `THREAD#<id>` / `THREAD_ANALYSIS` | `riskScore` | `dimensions{…}`, `lead` |
| Thread snapshot | `THREAD#<id>` / `THREAD_HISTORY#<date>` | embeds `riskScore` | embed `dimensions`,`lead` |
| Drift note | `…/DRIFT#<date>` + `…/DRIFTLOG#<date>` | `changeScore{from,to,delta}`,`changeLevel` | `changeDimensions{axis:{from,to,delta}}` (Phase D) |
| Weekly brief | `WEEKLY_BRIEF#<week>` | per-signal `riskScore`,`riskLevel` | per-signal `dimensions`,`lead` (Phase C/D) |

**Do NOT backfill history.** Retro-scoring dimensions on old rows is fabrication ([[feedback_editorial_fact_layer]] / no-misinformation). New history accrues richer; old rows render from their scalar. `DRIFTLOG#` has **no TTL** (permanent) — new archive rows carry the vector, old ones don't; the adapter handles both.

## 5. The frontend seam (already mostly clean)

Everything visual funnels through **`utils/riskTiers.js`** (`tierFromScore`/`tierFromLevel`/`tierLabel`/`TIER_ORDER`) + **`tokens.js`** (`riskScoreToVar`/`riskTierToVar`/`RISK_COLORS`/`RISK_SOLID`). Add ONE function and ~13 of 17 consumers keep working:

```
headlineFromDimensions(dims) → { score, tier, leadAxis, leadLabel }
// score = max; tier = tierFromScore(score); leadAxis = argmax; degrades on scalar-only input
```

**3 escape hatches bypass the util** (index a raw `riskLevel` string) and must be routed through it (they keep working because we still write `riskLevel`, but they should go through the adapter to be vector-ready):
- `DailyPage.jsx` (`RISK_COLORS[riskLevel]`), `CountryOverviewMap.jsx` (`RISK_MAP_COLORS[riskLevel]`), `BriefingCard.jsx` (`RISK_RGB[riskLevel]`, note `critical` alias) — plus `WeeklyBriefPage.jsx`'s brittle `riskLevel==='high'` equality.

## 6. Generation sites (only TWO Lambdas)

1. **`newsCountryIntelligence/src/index.js`** — prompt `486-488`, parse/clamp `527-529`, core write `543-544`, `HISTORY#` write `573-574`.
2. **`newsThreadAnalysis/src/index.js`** — prompt `262`, core write `313`, `THREAD_HISTORY#` write `337` (threads have `riskScore` only, no `riskLevel` today).

Both change to: ask for the 4 axes (with per-axis calibration + **grounding**, see §9), clamp each, compute `max`/`tier`/`lead`, write vector + derived scalar. Same 4 axes for both (a war thread → conflict-high; a trade dispute → economic-high) for a uniform model.

## 7. Scalar consumers (the break sites) + which get the vector upgrade

| Consumer | File · site | Day-1 (derived scalar) | Vector upgrade (later phase) |
|---|---|---|---|
| Drift trigger `\|Δscore\|≥8` | `newsDriftCorrector/lib.js:20,24-31,67-75` | works on `max` | **per-axis** move detection + record *which* axis moved (Phase D) — far better alerts |
| Breaking scorer | `newsBreakingAlert/significance.js:23,62-64` + `index.js:99-108` | works on `max` | feed the **category-relevant axis** (conflict alert → conflict score), fixing the dominance bug (Phase D) |
| `world_overview` enrich | `newsSensitiveData/index.js:776-777` | works | attach `dimensions` to situations → SpiderWorld bubbles by lead axis (Phase C) |
| `country_preview` (SEO) | `newsSensitiveData/index.js:1197` | works | optional |
| Weekly brief | `newsWeeklyBrief/index.js:68-74,104,209-214` | works | sort by `lead`; **collapse the duplicate `riskLevelFromScore` band copy** into the shared derivation (Phase D) |

**Frontend VEC targets** (want the vector to be better): `/weekly` LEAD/DEVELOPING hierarchy (`WeeklyPage.jsx:808-849`), `SpiderWorld` bubble color + drift badge, `CountryWhatChanged` + `countryDrift.js` (per-axis deltas), all sparklines, `RiskDeltaPill`.

## 8. Phased migration (additive, pausable)

- **Phase A — seam foundation (no visible change).** Define the axis vocabulary (one shared constant). Add `headlineFromDimensions()` to `riskTiers.js`. Route the 3 escape hatches + `WeeklyBriefPage` equality through the adapter. Everything still renders identically from the scalar. Ships invisibly; de-risks the seam.
- **Phase B — generators emit the vector + derived scalar.** Rewrite the 2 prompts (§6) with per-axis calibration + grounding. Write `dimensions`+`lead`+derived scalar. **Nothing downstream changes** — new records are just richer. This is the go/no-go gate: inspect real output for boilerplate (§9) before Phase C.
- **Phase C — upgrade the display VEC consumers.** CountryPage/ThreadPage headline shows the lead axis + breakdown; SpiderWorld bubbles by lead; CountryWhatChanged per-axis; `/weekly` LEAD qualifies on a specific worst axis.
- **Phase D — upgrade the scalar-consuming triggers.** Drift per-axis detection + which-axis-moved in the note; breaking scorer uses the category axis; weekly-brief single derivation.
- **Phase E — per-axis calibration (later, gated on verdicts).** Track-record each axis separately — the real accountability payoff, but needs resolved outcomes; defer like prediction calibration [[project_prediction_methodology_v1]].

## 9. The real risk: 4 boilerplate numbers instead of 1

More LLM numbers ≠ more signal. The failure mode is the model emitting `{conflict:70, political:60, economic:65, humanitarian:55}` — smooth, plausible, meaningless. Mitigations (bake into Phase B, gate Phase C on them):
- **Per-axis grounding required.** Each non-null axis must cite the arc(s)/event(s) that justify it — mirror the prediction capture-gate discipline ([[project_prediction_methodology_v1]]). Consider a per-axis short `evidence` string.
- **Force sparsity.** Most countries are NOT elevated on all four; allow/encourage `null` (honest "no signal on this axis") rather than a filler mid-number.
- **Inspect before propagating.** Phase B ships without changing any display — so we can read the raw vectors on real countries and kill it if they're boilerplate, with zero user-visible risk.
- **Keep `max` (not average)** so one well-grounded axis carries the headline even if the others are noisy.

## 10. Open decisions (operator)

1. **Axis set** — the 4 above (conflict/political/economic/humanitarian), or add `external/geopolitical` (proxy involvement)? More axes = more boilerplate risk. Recommend starting at 4.
2. **Scope confirm** — country + thread (this plan), leaving systems/economic/markets/predictions untouched (they don't carry riskScore). Agreed?
3. **Headline rule** — `max + lead` (recommended) vs. showing the full vector with no single headline. `max` keeps the map/list glanceable.
4. **Thread axes** — same 4 as countries (recommended, uniform) or a thread-specific subset?

## 11. Not touched (confirmed independent)

`/track-record` + Brier/calibration (scores `probability`, never risk), `newsSystemsAnalysis`, `newsEconomicImpact` (instrument `magnitude`, not risk), `newsWeeklyMarkets`, `newsInvokeGemini`, `NewsProjectInvokeAgentLambda`. `SeverityBadge` only *borrows* the `--risk-*` colors for economic severity — not a risk-score consumer.
