# Scoring Model v2 — dimensions, not one risk number

**Status:** PROPOSED (2026-07-07, brainstorm + code-grounded audit). **Phase 0 spike PASSED 2026-07-07** — dimensional prompt run against 8 real countries; axes differentiate, sparsity holds, grounding is specific (see §9). Not built. Independent of the member-gating work.
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

**Breadth flag** (added after the Phase 0 spike showed hot countries lighting up multiple axes): when **≥3 of 4 axes are elevated (≥50)**, surface a compound marker (`⚠ 3/4 axes elevated`) beside the headline. `max` alone hides breadth — a country stressed on all four is more fragile than one high on a single axis, and the scorecard/flag makes that visible without averaging.

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

- **Phase 0 — prompt spike (DONE, 2026-07-07).** ✅ Ran the dimensional prompt on 8 real countries in isolation (no schema, no deploy) to check the core premise *before* building plumbing. Result: axes differentiate, sparsity holds, grounding is specific — see §9. Gate passed → proceed to Phase A. (Spike script: `scratchpad/dim-spike.mjs`.)
- **Phase A — seam foundation (no visible change). ✅ BUILT (branch `scoring-model-v2`, commit `23c372c`), not deployed.** Added `AXES`/`AXIS_LABELS` vocabulary + `headlineFromDimensions()` + `deriveHeadline()` (one call for vector OR legacy scalar) to `riskTiers.js`, with 10 tests. Everything still renders from the scalar. **Refinement:** escape-hatch routing (3 sites + `WeeklyBriefPage`) **deferred to Phase C** — they keep working via the derived `riskLevel` until the vector is actually displayed, so routing them early is pure risk with no benefit.
- **Phase B — generators emit the vector + derived scalar. ✅ BUILT (commit `c7a18f4`), NOT DEPLOYED.** Both generators now ask for the `dimensions` vector (per-axis calibration + grounding + sparsity) and derive `riskScore`/`riskLevel` from the worst axis via a shared `riskDimensions.js` helper (byte-identical in both functions). Both core + snapshot writes carry `dimensions`+`lead`+derived scalar; transitional fallback to a legacy `riskScore` if a response omits dimensions. **← DEPLOY GATE + go/no-go: deploy, let it run, inspect real vectors at scale for boilerplate (§9) before Phase C.**
- **Phase C — upgrade the display VEC consumers.** CountryPage/ThreadPage headline shows the lead axis + breakdown; SpiderWorld bubbles by lead; CountryWhatChanged per-axis; `/weekly` LEAD qualifies on a specific worst axis.
- **Phase D — upgrade the scalar-consuming triggers. ✅ D1+D2 DEPLOYED (main `52687a4`).** D1 `newsDriftCorrector`: fires on any axis |Δ|≥8, writes `changeDimensions`, names the moved axis in the grounding prompt. D2 `newsBreakingAlert`: significance scorer feels risk on the **category-relevant axis** (`regionRiskScore`/`axisForCategory`) not the blended max — **fixes the country-risk dominance bug** (an economic story no longer inherits a war-torn region's conflict score). Both fall back to the blended scalar for pre-v2 records. **D3 (weekly-brief single derivation) DEFERRED** — cross-runtime, low value. **D1 read-side follow-on DEPLOYED (main `bed8291`):** CountryPage "What changed" band is axis-aware — `computeCountryDrift` now detects per-axis moves (`|Δ|≥8`) from the snapshots' `dimensions` vector (pure serve pass-through, no backend change) and names the driving dimension as a pill (`Economic: 30 → 72 (+42)`); surfaces the same masking a scalar-only band would miss. Dormant until a country accrues two dimension-bearing daily snapshots.
- **Phase D-email — the drift *email* renderer (the one surviving scalar-only surface). SPEC'D 2026-07-08, NOT BUILT.** When Phase D upgraded the drift note (`changeDimensions`) + the CountryPage band (per-axis pills), the member drift-alert **email** (`newsEmailSender/src/renderDriftEmail.js`, built in member-gating P5 2026-07-06) was missed — it still renders the blended scalar (`risk 78 → 82`). Verified live 2026-07-08: today's DR Congo `DRIFT#` note carries `changeDimensions{political:55→70, economic:40→55}` and the core carries the full current vector, but the email's `changeLabel()` reads only `changeScore`. See §12 below for the full build spec.

- **Phase E — per-axis calibration (later, gated on verdicts).** Track-record each axis separately — the real accountability payoff, but needs resolved outcomes; defer like prediction calibration [[project_prediction_methodology_v1]].

## 9. The boilerplate risk — TESTED, held (Phase 0 spike, 2026-07-07)

The feared failure mode: the model emitting `{conflict:70, political:60, economic:65, humanitarian:55}` — smooth, plausible, meaningless. We had prior evidence to worry (the boilerplate 65% prediction probabilities). So we ran it before building anything: the `newsCountryIntelligence` DeepSeek model, a ~20-line dimensional prompt, 8 real countries (Ukraine, Russia, Iran, Japan, Israel, United States, China, DR Congo). **It held on the first try:**

- **Axes differentiate** (not flat): `conflict 50–90`, `political 25–70`, `economic 40–80`, `humanitarian null×3 else 50–75`. Boilerplate would cluster at 55–65; it doesn't.
- **Sparsity worked** — Russia / Japan / China got `humanitarian: null` (honest "no signal") instead of a filler number. This is the key result: the model will decline an axis.
- **Grounding is specific**, quoting the actual analysis, e.g. Japan econ 75 → *"yen hits a 40-year low against the dollar, breaking ¥162, driving bankruptcies to their highest since 2022"*; DRC humanitarian 75 → *"Ebola outbreak surpasses 400 deaths, reaches urban center Kisangani."*
- **Canonical win — the headline flip:** Japan's blended single score `elevated/62` became **`HIGH — economic 75`** (conflict only 50). The single number *hid* that Japan's risk is a currency story, not a military one. That flip is the entire value proposition, demonstrated on real data.

**Watch-items the spike surfaced (carry into Phase B):**
1. **Breadth inflation** — "hot" countries lit up 3–4 axes (Ukraine/Iran/Israel/DRC all 4/4). Mostly correct (genuine multi-dimensional crises) and the breadth flag (§2) surfaces it honestly, but keep the sparsity instruction strong so "hot" ≠ automatic four.
2. **`max` shifts tiers up** — Japan `elevated → HIGH` on one axis crossing 75; expect *more* HIGH countries than the blended score gave. Make that calibration choice consciously (it's the worst-axis design working as intended).
3. **GIGO** — the scorer faithfully grounds on the source analysis, *including* any shaky facts already in that news layer (the spike surfaced a speculative "Khamenei killed" claim living in the source record). That's a pre-existing data-quality issue, not a scoring one; the vector inherits it exactly as the current single score does.

**Standing requirements (bake into Phase B):** per-axis grounding string required; sparsity (`null`) encouraged; Phase B still ships display-invisibly so real vectors can be re-inspected at scale before Phase C; keep `max` (not average).

## 10. Open decisions (operator)

1. **Axis set** — the 4 above (conflict/political/economic/humanitarian), or add `external/geopolitical` (proxy involvement)? More axes = more boilerplate risk. Recommend starting at 4.
2. **Scope confirm** — country + thread (this plan), leaving systems/economic/markets/predictions untouched (they don't carry riskScore). Agreed?
3. **Headline rule** — `max + lead` (recommended) vs. showing the full vector with no single headline. `max` keeps the map/list glanceable.
4. **Thread axes** — same 4 as countries (recommended, uniform) or a thread-specific subset?

## 11. Not touched (confirmed independent)

`/track-record` + Brier/calibration (scores `probability`, never risk), `newsSystemsAnalysis`, `newsEconomicImpact` (instrument `magnitude`, not risk), `newsWeeklyMarkets`, `newsInvokeGemini`, `NewsProjectInvokeAgentLambda`. `SeverityBadge` only *borrows* the `--risk-*` colors for economic severity — not a risk-score consumer.

---

## 12. Phase D-email — drift-alert email renderer build spec (SPEC'D 2026-07-08, NOT BUILT)

**Problem.** The member drift-alert email shows the blended scalar (`risk 78 → 82`) while the CountryPage shows the v2 per-axis view. The email is the last scalar-only surface. `renderDriftEmail.js` → `changeLabel()` reads `changeLevel` then falls back to `changeScore`, and never touches `changeDimensions` or the current vector.

**All facts below verified against live code + DDB on 2026-07-08.**

### Two levels (ship both; they layer)

**Level A — per-axis change (matches the plan's decided design + the CountryPage).**
Render the axes that MOVED instead of the blended scalar. **Data already on the note** (`changeDimensions{axis:{from,to,delta}}`) — no corrector change, no new data. This is the minimum to bring the email in line with `CountryWhatChanged.jsx` (lines 61–69, per-axis pills `Economic: 30 → 72 (+42)`).

**Level B — current 4-axis standing + what moved (the richer "where it stands now" view).**
Also show the country's full current profile (e.g. `HIGH · Humanitarian 82` lead + `Conflict 65 / Political 70 / Economic 55 / Humanitarian 82` + `⚠ 3/4 elevated` breadth flag). Needs the current vector persisted onto the note (it is NOT today).

### Build — three changes

**Change 1 (Level B data) — `newsDriftCorrector/src/index.js`, ~4 lines, trivial.**
The current vector is **already loaded** — `readHistory` (line ~48) maps the HISTORY# snapshot and `cur`/`prior` already carry `dimensions` (used by `changeDimensionsFrom` at line 109). The HISTORY# snapshot **also carries `lead`** (verified: DRC HISTORY#2026-07-08 has `lead:"humanitarian"` + `dimensions`), but the mapper drops it.
1. In the `readHistory` mapper (~line 48) add `lead: it.lead` to the returned object.
2. In `writeNote`'s `base` object (~line 103–110) add:
   ```js
   currentDimensions: cur.dimensions,        // full 4-axis {axis:{score,why}} — already in scope
   currentRiskScore:  Number(cur.riskScore), // already in scope
   currentRiskLevel:  cur.riskLevel,         // already in scope
   currentLead:       cur.lead,              // from step 1
   ```
   The thread path (`writeThreadNote`, ~line 185) can get the same treatment for symmetry, but the email is country-only, so country is the requirement.
   **Consequence:** only notes written AFTER this deploy carry `currentDimensions`. Do NOT backfill (§7 rule). The renderer degrades (below).

**Change 2 (render) — `newsEmailSender/src/renderDriftEmail.js`.**
Replace the single `changeLabel()` line with a **degradation ladder**, richest available first:
1. `note.currentDimensions` present → **Level B block**: a compact email-safe scorecard — headline line `{RISKLEVEL} · {LeadLabel} {score}` (read `currentRiskLevel`/`currentLead`/`currentRiskScore` straight off the note — **do NOT import the frontend `riskTiers.js`; the note already carries the derived headline fields**), then a 4-axis row (`Conflict 65 · Political 70 · Economic 55 · Humanitarian 82`, lead axis bolded), then a `⚠ N/4 elevated` flag computed inline (`count axes with score≥50`; only show when N≥3). Then the existing "what changed" rows below it.
2. else `note.changeDimensions` present → **Level A**: per-axis change pills `Political 55→70 (+15) · Economic 40→55 (+15)` (mirror `CountryWhatChanged` lines 61–69).
3. else `changeLevel`/`changeScore` → today's scalar behavior (unchanged).
Keep the `why`/`triggerEvent`/`noSingleDriver` lines exactly as-is. Design call: **compact** — axis+score+lead marker, NOT the four per-axis `why` paragraphs (those are what the CountryPage is for; the email is glance + click-through). Both `text` and `html` variants. Escape everything (`esc()`), email-client-safe inline styles + table layout (match the existing file's idiom).

**Change 3 (tests) — `newsEmailSender/src/test-sender.js`.**
`renderDriftEmail` is currently UNtested there. Add cases (the harness is a custom require-intercept runner — add to its existing pattern, keep `node test-sender.js` green, bump the count in the summary):
- Level B: a note with `currentDimensions`+`currentLead`+`currentRiskScore` → html contains the lead label, all four axis scores, the breadth flag when ≥3 elevated; text variant too.
- Level A: a note with `changeDimensions` but NO `currentDimensions` → renders per-axis pills, NOT "risk X → Y".
- Fallback: a note with only `changeScore` → unchanged scalar behavior.
- No-crash on a note missing all three (returns `read revised`).
Optionally extend `newsDriftCorrector/test/lib.test.js` if any pure helper is factored out (only if the axis/breadth formatting is pulled into a testable function — not required if it stays inline in the renderer).

### Deploy (GATED — build + verify only; do NOT deploy without a fresh explicit operator "yes")
1. `newsDriftCorrector` — zip `src/{index.js,lib.js,package.json}` (no node_modules; runtime `@aws-sdk`), `aws lambda update-function-code`. New notes carry the vector from the next 07:20 UTC cron.
2. `newsEmailSender` — zip `src/*` (must include `renderDriftEmail.js` + `test-sender.js` not needed at runtime; include the four render/send modules), `update-function-code`.
3. No frontend build. No new IAM (both functions already read/write `SummarizeAndPredict`).
4. Verify live: after the next corrector cron, re-check a fresh `DRIFT#` note has `currentDimensions`; run the Layer-1 drift-email invoke (`DRIFT_EMAIL_ACTIVATION_PLAN.md` L1) and confirm the payload/preview shows the axis view.

### Verify (pre-commit gate, no deploy)
- `cd amplify/backend/function/newsEmailSender/src && node test-sender.js` → all pass incl. new drift cases.
- `cd amplify/backend/function/newsDriftCorrector && node --test` → lib suite still green.
- `cd global-perspectives-starter/frontend && npm run verify` → unaffected but confirms no cross-break.
- Manual: `node -e` render a Level-B fixture note through `renderDriftEmail`, eyeball the html.

### Non-negotiables
- **Not retroactive** — old notes render at Level A/scalar; only post-deploy notes reach Level B (§7 no-backfill / [[feedback_no_misinformation_fallback]]).
- **No frontend-util import in the Lambda** — read the derived headline fields off the note; compute only the breadth flag inline.
- **Compact email** — standing + what-moved, not the full reasoning (that's the click-through).
- Honest-empty preserved: `noSingleDriver` and the "we alert only when a conclusion moves" footer stay.
