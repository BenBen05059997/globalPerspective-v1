# Scoring Standards — Rubric vs Benchmark Inventory

**Date: 2026-09-14. Status: diagnosis only — no code changes proposed.**

Severity's LIVING benchmark status is tracked in `quality/calibration/severity-*.md` reports; this document is the 2026-09-14 audit and is not re-verified per-score.

Grounded in direct `grep`/`Read` of `amplify/backend/function/*/src/` and the `quality/` tree on
this date, plus `project-docs/architecture/WORLD_MODEL_FRAGMENTS.md`,
`IMPORTANCE_SCALE_MAPPING.md`, and `project-docs/pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md`.
All citations are file:line as read today; anywhere I could not verify a claim directly, it is
flagged **UNVERIFIED** rather than guessed.

## The question this doc answers

For every score/rating the system assigns, two independent properties:

- **RUBRIC** — the written standard for how the score is decided. Either (i) a **deterministic
  formula** (reproducible, decidable by construction), or (ii) an **LLM judgment** (needs a
  written rubric + calibration to be trustworthy). Quoted verbatim below with file:line, and
  judged well-specified or thin.
- **BENCHMARK** — ground truth + a metric to check the score is actually correct/calibrated. Cited
  if it exists; **NONE** if not. A drift/self-consistency monitor (watches the score's own output
  distribution over time) is **not** a benchmark — it can catch the score suddenly changing shape,
  but cannot tell you whether the score was ever right. This distinction matters below (economic
  severity has the first kind, no example in the codebase has the second kind except predictions).

---

## 1. Canonical severity tier / 4-axis risk dimensions

**Producer:** `amplify/backend/function/newsThreadAnalysis/src/index.js:263` (thread-level),
`amplify/backend/function/newsCountryIntelligence/src/index.js:487-492` (country-level). Shared
derivation module, byte-identical in both Lambdas:
`amplify/backend/function/newsThreadAnalysis/src/riskDimensions.js` (57 lines).

**RUBRIC = LLM judgment, with a deterministic aggregation step bolted on.**

The four axes and per-axis calibration prose (country prompt, `index.js:487-492`, thread prompt
near-identical at `newsThreadAnalysis/src/index.js:263`):

> `"dimensions": Object scoring this country's CURRENT risk across four INDEPENDENT axes. For each
> axis provide {"score": integer 0-100, "why": ONE sentence citing the specific arc/event...} — or
> null when the data gives genuinely no signal... Axes: "conflict" (armed violence...), "political"
> (institutional stability...), "economic" (financial stress...), "humanitarian" (displacement...).
> Per-axis calibration: 0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe.`

That one sentence — "0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe" — is the
**entire** calibration standard for what separates a 24 from a 26, or a 74 from a 76, across four
different axes and two different domains (country vs. thread). There is no worked example, no
anchor case ("a border skirmish with N casualties = X"), no comparison table, no instruction on
how axes should relate to each other in magnitude. This is thin by any standard: it tells the LLM
the *names* of the bands, not how to place a judgment inside one.

The **deterministic** part is real and well-specified: `riskDimensions.js` clamps each axis to
0-100 (`clampScore`, L13-20), derives the display tier via fixed bands (`tierFromScore`, L22-30:
`≥75 high`, `≥50 elevated`, `≥25 moderate`, else `low`), and the headline is always the **worst**
axis, never an average (`deriveRisk`, L44-55 — "the WORST axis, NEVER a weighted average," per the
file header comment). This formula is decidable by construction and TRUE-MERGE-identical across
the two Lambdas (confirmed byte-identical, per `WORLD_MODEL_FRAGMENTS.md` §3.1). But the formula
only governs what happens to a set of numbers that were themselves produced by an unanchored LLM
judgment — it cannot make those numbers correct.

Also note: country-level `dimensions` is **not** an aggregate of its threads' scores. The country
pipeline reads thread analyses as background context (`newsCountryIntelligence/src/index.js:148-
208`, `analyses[threadId] = Item` at L157) but issues a **fresh, independent** LLM call for its own
`dimensions` (L498). Two independently-produced judgments, sharing a rubric and a derivation
formula, not a roll-up. (`WORLD_MODEL_FRAGMENTS.md` §3.1.)

**BENCHMARK = NOW EXISTS (as of 2026-09-15), rubric still thin.** A hand-labeled reference set has
been built: `quality/severity_gold_set.json` (28-record frozen v1 cohort, Claude-labeled
2026-09-15), an agreement script `quality/severity_agreement.js`, and a first baseline report
`quality/calibration/severity-2026-09-14.md` (exact 40.3% / within-one 84.7%; political axis worst
at 22.7% exact; systematic ~1-band inflation; 27 null-violations found). This does not yet mean the
rubric is fixed — the one-sentence-per-axis calibration text (above) is unchanged pending Phase 4 —
only that a ground-truth check now exists where none did before. `quality/calibration_report.js`
and `quality/calibration/latest.md` remain a separate self-consistency drift monitor for
**economic** severity (§4 below), not this benchmark. See "The biggest hole" section below for the
2026-09-14 diagnosis this closes.

**Gap:** LLM judgment on a thin four-line calibration rubric, zero ground truth to check it
against, feeding every severity-tier display surface in the product.

---

## 2. Prediction probability + resolution — THE GOLD STANDARD

**Producers:**
- Generation: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` (two-pass
  research-then-predict), `src/lib.js` (gating/capture).
- Resolution proposal: `amplify/backend/function/newsPredictionResolver/src/index.js`.
- Human confirmation: `predictions/review.js` (repo root).
- Scoring/track record: `amplify/backend/function/newsPredictionsSnapshot/src/trackRecord.js`.

**RUBRIC = LLM judgment (well-specified) + deterministic gate + deterministic scoring.**

Generation is two-pass: a research prompt (`buildResearchPrompt`, `index.js:414+`) gathers
historical precedents, actor motivations, and dated near-term events *before* prediction — this is
itself a calibration aid (base-rate anchoring). The prediction prompt
(`buildPredictionPrompt`, `index.js:454-518`) demands three scenarios (Most Likely / Optimistic /
Pessimistic) with `probability_range` that must "sum to ~100%" (L516), each carrying **falsifiable,
dated triggers**:

> `"TRIGGER RULES (a trigger we cannot score is worthless — follow exactly): deadline MUST be an
> absolute date... on/before {horizon}. The trigger must describe a FUTURE event that has NOT
> happened yet... text must be a single, concrete, checkable event (who does what) — not a vague
> mood."` (`index.js:509-515`)

Then `lib.js` mechanically **gates** the raw LLM output before it is ever written to the immutable
log (`lib.js:1-14` header): "Every defect class the 2026-07-04 resolution pilot found
(retrodictions, false premises, date artifacts, relative windows) is rejectable HERE,
mechanically... G6 (added 2026-07-07) additionally scopes out pure sporting results." This is a
deterministic filter layered on top of an LLM judgment — a genuinely hybrid, well-specified
design. `METHODOLOGY_VERSION = 1` (`lib.js:14`) is stamped on every logged snapshot
(`index.js:856`), so the gate's version is itself tracked data, not folklore.

Resolution is also hybrid, not LLM-trusted blindly: `newsPredictionResolver` grounds each due
trigger in fresh Brave search results and asks an LLM to **propose** `fired|not_fired|unclear`
with a citation (`buildVerdictPrompt`, `index.js:141-156`) — explicitly told "Based ONLY on the
search results above... if the results do not clearly establish it either way, answer 'unclear'."
This is never auto-finalized: "It never finalizes: the proposal awaits human confirmation via
`predictions/review.js`" (`index.js:6-8`). The operator runs `predictions/review.js` to accept,
override, or reject each proposed verdict before it becomes a `finalVerdict` that scoring reads.

**BENCHMARK = EXISTS and is exemplary.** `trackRecord.js` (`computeTrackRecord`, full file) is a
real Brier-score + calibration-bucket apparatus over the immutable prediction log:

- **Era cut:** `ERA_CUT_FROM = '2026-07-04'` (L13) — "only records written by the rebuilt, gated
  capture (methodologyVersion >= 1) are scored; the legacy backlog is kept immutable but excluded"
  (L11-12). Filters to `v1Items` (L18).
- **Brier score:** for every resolved (`fired`/`not_fired`) trigger with a numeric probability,
  `brierSum += (p - outcome) ** 2` (L44), reported as `brierScore: brierSum/scored` rounded to 3
  decimals (L83).
- **Calibration buckets:** five probability buckets `[0,0.2,0.4,0.6,0.8,1.0001)` (L20-21), each
  tracking `n`, `meanPredicted`, `actualFiredRate` (L45-46, L69-75) — this is a genuine reliability
  diagram: does "60-80%" actually fire ~70% of the time?
- **Ground truth = human-confirmed verdicts** (`finalVerdict === 'fired'|'not_fired'`, L30-33) —
  not the LLM's own proposal; the proposal is only a draft awaiting `predictions/review.js`
  confirmation.
- Output carries `totalPredictionsLogged`, `legacyPredictionsExcluded`, `resolvedTriggers`,
  `pendingTriggers`, `calibration[]`, and the 30 most recent resolutions with citations (L79-90) —
  fully auditable, not a black-box number.

**This is the only score in the codebase with a hand-verified-outcome ground truth, an explicit
methodology version boundary, and a standard statistical accuracy metric (Brier score +
reliability buckets).** See "The model to copy" section below for why this is the template.

---

## 3. Breaking-alert significance score

**Producer:** `amplify/backend/function/newsBreakingAlert/src/significance.js` (163 lines, pure
function, no I/O — "so it unit-tests in isolation," L1-4).

**RUBRIC = deterministic formula, decidable by construction, well-specified.**

Five weighted sub-signals (`WEIGHTS`, L21-27):

```
popularity: 1.0   // outlets corroborating
breadth:    1.0   // concurrent angles on one story
risk:       1.0   // country-level riskScore, CAPPED
economic:   1.5   // market-moving magnitude
velocity:   1.5   // rate of change this cycle (burst)
```

Each sub-signal is squashed into `[0,1]` by an explicit named function (`popularity`,
`breadth`, `risk`, `economic`, `velocity`, L47-113) — e.g. `risk(riskScore)` caps the country
risk score's contribution at `RISK_CAP = 50` (L69-72) specifically because "a *STANDING* posture,
not event evidence... could clear the bar on its own... for a routine story" (L64-68) — this is a
documented, deliberate fix for a previously-diagnosed dominance bug (confirmed in
`SCORING_MODEL_V2_PLAN.md:15`: "country-risk dominance (~14% precision)"). `score = Σ
weight·normalizedSignal` (`scoreStory`, L120-137). Threshold: `SIGNIFICANCE_THRESHOLD = 2.0`
(L30) — "Deliberately set so that on an ordinary news day NOTHING clears it." Continuation
multiplier: `CONTINUATION_THRESHOLD_MULT = 1.8` (L36) — a re-alert must clear a *higher* bar than
a new story, "the deterministic stand-in for First Story Detection" (L34-37).

This is the best-specified rubric in the system — every constant is named, commented, and
motivated in prose next to the code.

**BENCHMARK = partial, one-time, not automated.** The ~14% precision figure the operator may
recall (also cited in `MAP_HOME_SITUATION_PLAN.md:34`, `SCORING_MODEL_V2_PLAN.md:15`) comes from
`project-docs/alerts-email/BREAKING_ALERT_DEBATE_2026-06-24.md`: a **one-time 22-agent LLM debate**
over exactly **7** real fired stories — an ALERT advocate + SUPPRESS skeptic argued each, then an
independent LLM Judge scored six urgency dimensions and ruled `alert`/`hold`/`suppress`. Result:
"the judge endorsed exactly **1 of 7** firings (~14% precision)... Both stories that were actually
sent were false positives" (doc L32-35). This is:
- **not ground truth** — it's an LLM judge's opinion on 7 cases, itself unbenchmarked;
- **not repeatable/automated** — a manual one-off debate, not a script in `quality/`;
- **explicitly caveated** by its own authors: "the calibration finding... stands [but] 'we withheld
  Gaza' is partly a dedupe-timing artifact" (doc, "Honest caveat" block).

`project-docs/alerts-email/BREAKING_ALERTS_PLAN.md:86` names the real fix and confirms it was
**never built**: "To trust the detector + verify agent we need a labeled set: take N past
pipeline cycles, hand-label which stories *should* have been breaking-worthy, and measure
precision/recall... Build once there's enough dry-run history to label. Tracked here so it isn't
lost; not blocking earlier phases." No such labeled set exists in `quality/` today (confirmed by
directory listing — no breaking-alert gold-set file).

**Gap:** the formula is decidable by construction, but its threshold (`2.0`) and weights were
tuned by eyeball/dry-run, not fit against labels; the one precision estimate that exists is a
single unrepeated LLM-judged debate over 7 cases, explicitly not a benchmark by its own author's
admission.

---

## 4. Economic severity / severityScore

**Producer:** `amplify/backend/function/newsEconomicImpact/src/index.js`.

**RUBRIC = partial-deterministic (LLM judgment + deterministic consistency layer).**

The LLM emits `"severity": "minor | moderate | severe"` and `"severityScore": <0-100 integer>`
(schema at L457-458) — the prompt gives the enum names but (unlike the risk-dimensions rubric)
does **not** appear to give per-band calibration prose beyond the enum labels themselves
(confirmed: no "X-Y = minor" language found near the schema block, only the hard rules at L444-
454 about instrument allowlists/citations/no-percentages).

What **is** deterministic and well-specified is the post-hoc consistency layer:
- **Band clamp:** `SEVERITY_BAND = { severe: 70-100, moderate: 40-69, minor: 0-39 }` (L92-97);
  if the LLM's `severityScore` falls outside its own `severity` label's band, it's silently
  clamped into range and flagged (`severity_score_clamped:...`, L606-611).
- **Evidence-downgrade rule:** "Severe/moderate with thin winners or losers → downgrade severity
  one notch. Real disruptions have real losers. If the LLM can't name them, it's overstating."
  (L652-664) — `severe`/`moderate` with fewer than 2 named winners or losers gets downgraded one
  tier and re-clamped into the new band.

This is a real, if partial, internal-consistency check — it catches an LLM claiming "severe" while
naming no economic losers — but it validates **self-consistency of the LLM's own output**, not
correctness against the real world. It cannot catch a confidently wrong-but-internally-consistent
severity call (2 winners, 2 losers, wrong severity anyway).

**BENCHMARK = a drift monitor exists, NOT a correctness benchmark.**
`quality/calibration_report.js` + `quality/calibration/latest.md` — "Layer 9 drift report"
(header, L1-4) scans `ECON#THREAD#` records and tracks severity/confidence/horizon **distribution**
against a hand-set "healthy band" (e.g. "severity: % severe | 7.7% | 5–25% | drifts ≥2σ in 7d,"
`calibration/latest.md`). This flags if the *shape* of severity output suddenly shifts (e.g.
everything becomes "severe" overnight) — useful as a sanity/drift alarm — but it has **no ground
truth**: there is no hand-labeled "this event really was severe" set to compare against, so a
consistently-wrong-but-stable severity distribution would sail through undetected. Separately,
`quality/golden_evals.json` + `quality/run_golden_evals.js` explicitly disclaim being an LLM-quality
benchmark: "Tests for regression in our validation/downgrade logic, NOT for LLM output quality
(that's Layer 2 LLM-as-judge)" (`golden_evals.json` `_meta.description`) — i.e. golden evals test
that the deterministic clamp/downgrade code doesn't regress, not that the LLM's severity judgment
is correct.

**Gap:** enum-only prompt (no calibration prose found), a real self-consistency clamp, a real
distribution-drift monitor — but zero ground-truth check on whether "severe" was the right call.

---

## 5. Economic quality score (`newsEconomicQuality`) — a judge with no gold set

**Producer:** `amplify/backend/function/newsEconomicQuality/src/index.js` (header, L1-22).

**RUBRIC = LLM judgment.** 5-axis judge — `coherence`, `citation_fidelity`, `analog_match`,
`severity_calibration`, `no_bs` (`QUALITY_AXES`, L48) — scored by a **different model family**
than the producer ("DeepSeek produces, Gemini judges... so judge errors are less correlated with
producer errors," L14-15). `LOW_QUALITY_THRESHOLD = 2`; `is_low_quality` fires if **any** axis
`≤2` (L49, L89). Axis definitions/anchors beyond the five names were not found in the excerpt read
(worth flagging as UNVERIFIED whether a fuller rubric exists deeper in the file — the header only
lists axis names, not per-score anchors).

**BENCHMARK = NONE.** This is a judge-model scoring another model's output with no hand-labeled
gold set of "this economic-impact record is actually high/low quality" to validate the judge
itself against. `quality/calibration/latest.md`'s own "judge coverage" and "judge low-quality
rate" rows show `0.0%` and `—` respectively in the sampled snapshot — i.e. even the judge's own
*coverage* was near-zero in that window, let alone validated. This is the textbook
"judge-with-no-benchmark" case the operator is worried about: cross-model judging reduces
*correlated* error, but says nothing about whether either model's standard for "coherent" or
"well-calibrated" matches a human's.

**Gap:** 5-axis LLM judge, cross-model by design (a real mitigation for correlated bias), zero
ground truth to validate the judge's own axis scores.

---

## 6. Source robustness classifier + drift check (`newsSourceAudit`)

**Producer:** `amplify/backend/function/newsSourceAudit/src/index.js`.

**RUBRIC = deterministic classifier (L1, well-specified) + LLM drift check (L1.5, thin).**

Deterministic `robustness(sources)` (L39-46):

```js
if (n === 0) return 'none';
if (n === 1 || outlets.size === 1) return 'single';
if (lowOnly) return 'low';        // every source is social/blog/opinion
if (outlets.size >= 2) return 'corroborated';
return 'weak';
```

This is fully decidable by construction — a pure function of `sources[]` outlet count and type.
The LLM drift check (`DRIFT_SYS`, L64) asks a model to compare the full article text against the
cached summary: "list any claim in OUR SUMMARY not supported by the article — hedge turned into
assertion, an invented result/figure/date, or added framing... Reply with one terse line per
drift, or EXACTLY 'OK' if none." This is a real, well-scoped LLM task (binary-ish drift detection
against a grounding document, not open-ended judgment) but has no calibration language for
borderline cases (how much added framing counts as "drift"?).

**BENCHMARK = NONE found for the LLM drift classifier itself** — no gold set of known-drifted vs.
known-faithful summaries to measure the auditor's own precision/recall. The `none/single/low/
corroborated` classifier needs no benchmark — it's a deterministic count, correct by
construction; there's nothing to validate beyond "does it implement the stated rule," which it
does.

**Gap:** the deterministic half is fine as-is; the LLM drift-detection half has a scoped but
un-anchored prompt and no accuracy check on itself (does it actually catch real drift, or is it
noisy?).

---

## 7. Impact-audit rubric (`newsImpactAudit`) — a partial benchmark on the SELECTOR, not the scores

**Producer:** `amplify/backend/function/newsImpactAudit/src/index.js` (238 lines).

**RUBRIC = LLM judgment (explicit, well-specified) + a real deterministic coverage-gap check.**

This one is different in kind from the others: it doesn't score an event's importance for
display — it audits whether the **selector** (`newsInvokeGemini`, what topics get picked at all)
missed something important. The LLM rubric (`RUBRIC` const, L54-61):

> `"Judge IMPACT, not loudness/coverage. Weigh: reach (people/countries materially affected),
> severity (lives, economic scale, rights/sovereignty), irreversibility (a threshold that cannot
> be undone — deaths, war, coup, default, collapse), novelty (a genuine discontinuity vs routine,
> ongoing, opinion or explainer). HIGH-impact = high reach+severity, especially irreversible. Be
> ESPECIALLY alert to high-severity but UNDER-COVERED events — mass atrocity, genocide, mass
> displacement, coups, and disasters in under-amplified regions (e.g. Africa)."`

This is genuinely better-specified than the risk-dimensions rubric — four named dimensions
(reach/severity/irreversibility/novelty) each with a one-clause gloss, plus an explicit,
self-aware instruction to counteract a *known* bias (under-coverage of Africa/atrocities) rather
than a bare band table. It also deliberately uses "the SAME model family as the selector...
by operator choice — the prompt is primed to hunt the known blind spot... to offset the
correlated-error risk of same-model auditing" (header, L13-15) — note this is the **opposite**
mitigation choice from `newsEconomicQuality` (which deliberately uses a *different* model family);
worth flagging as an inconsistency in house practice, not resolving here.

Separately, there are two genuinely **deterministic, objective** coverage-gap checks alongside the
LLM judgment: `gdacsCoverageGap` (L97-133) flags GDACS Orange/Red disasters the selector's chosen
topics never mention, and `gdeltCoverageGap` (L136-166) flags countries with serious GDELT
material-conflict signal absent from selection. These are real ground-truth-adjacent checks — GDACS
and GDELT are independent third-party feeds, not the system's own LLM output — so "did we miss this
GDACS Orange disaster" is an objective, checkable question.

**BENCHMARK = partial, and it's on the SELECTOR not the SCORES.** The GDACS/GDELT gap checks are
themselves a real benchmark of sorts — third-party ground truth measuring recall (did we cover
what an independent feed says happened) — but they benchmark **topic selection completeness**, not
any severity/importance score's calibration. The LLM "what was missed" judgment layered on top
(comparing selector's `chosen` against `latestCapture()`) has no gold set of its own — it's an
unaudited judge auditing another LLM's selection. **This is the closest thing in the codebase to
"the P0 reference set" the operator wants for severity scoring, but it audits a different question
(selection recall) and was itself never turned into the general-purpose hand-labeled reference set
that `IMPACT_FIRST_REDESIGN_PLAN.md` calls for** (see next section).

**Gap:** best-specified LLM rubric in the codebase + two real objective coverage checks, but none
of it validates any severity/importance *score* — it validates *selection*, a related but distinct
problem.

---

## 8. Editorial `significance` / `urgency` — thin/no rubric, being reclassified

**Producer:** `amplify/backend/function/newsInvokeGemini/src/index.js`.

**RUBRIC = LLM judgment, thin, and *asymmetrically validated*.**

- `significance` (`"high"|"medium"|"low"`): prompt rule 8 (L617) — "SIGNIFICANCE = MATERIAL
  IMPACT: Prioritize events with second-order effects on how people live, work, eat, move, or
  breathe... Political theater without material consequence is LOW significance." One sentence,
  no worked examples. **No membership validation on write** — `significance:
  String(t?.significance || 'medium').toLowerCase()` (L774) accepts any string the LLM emits,
  defaulting silently to `'medium'`.
- `urgency` (`"high"|"medium"|"low"`): "high = breaking/escalating in last 24h, medium = developing
  story, low = background/slow-moving" (L646). **Is** validated against the enum before acceptance
  (L741-742) — the one asymmetry in an otherwise identically-thin pair.

Per `IMPORTANCE_SCALE_MAPPING.md` (read this date, §2), `urgency` measures *tempo* and `significance`
measures a *material-impact* judgment distinct from the canonical 4-axis tier — neither is a
disguised copy of `riskDimensions`. Per that same doc and `WORLD_MODEL_FRAGMENTS.md` §3.3-3.4:
`urgency` is slated to be **kept as a labeled 4th exception** (a tempo axis, not a severity
duplicate); `significance` is **SERIAL-eligible but not yet SERIAL** — it cannot currently derive
from the canonical tier because topics carry no numeric score, only these two enums. Its sole
confirmed consumer is the LinkedIn auto-poster's sort order (`newsPostLinkedin/src/index.js:171-
174`, `SIGNIFICANCE_ORDER`), which **is live** (schedule confirmed enabled 2026-09-12 per
`IMPORTANCE_SCALE_MAPPING.md` §3).

**BENCHMARK = NONE.** No reference set for either field. Given `significance`'s only production
consequence is post ordering (not a life-safety or a paid-decision surface), the practical harm of
an uncalibrated score is low — but it is still an unvalidated judgment feeding a live automated
action.

**Gap:** thinnest rubric text in the system (`significance`), plus a validation asymmetry
(`urgency` gets a membership check, `significance` doesn't) that is itself worth fixing separately
from any rubric/benchmark work.

---

## 9. Trace-cause `impactScores` (1-10, ungoverned)

**Producer:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:405` (schema),
`:411` (reinforcement instruction).

**RUBRIC = LLM judgment, effectively no rubric at all.** The entire specification is the schema
line itself:

> `"impactScores": { "humanImpact": <integer 1-10>, "economicReach": <integer 1-10>,
> "geopolitical": <integer 1-10> }`

plus the one-line reinforcement "impactScores: integer 1-10 each" (L411). No definition of what
distinguishes a 3 from a 7 on any of the three axes, no calibration prose, no clamp/normalization
function in code (confirmed — no `clampScore`-equivalent applied to these three fields, unlike
`riskDimensions.js`'s governed axes). The axis names are suggestively close to the canonical
conflict/political/economic/humanitarian set but are a different scale (1-10 vs 0-100) and a
different (uncalibrated) rubric — `WORLD_MODEL_FRAGMENTS.md` §3.8 calls this "the closest thing in
the codebase to a near-miss TRUE-MERGE" with the canonical dimensions, and "the most 'ungoverned'
of the exceptions."

**BENCHMARK = NONE.** Isolated to the on-demand Trace-the-Cause panel display
(`TraceCauseDisplay.jsx`, 3 bars) — no sort, no gate, no downstream consumer beyond that one UI
widget, per `IMPORTANCE_SCALE_MAPPING.md` §3.

**Gap:** the least-governed score in the system on both axes — no rubric beyond a bare integer
range, no benchmark, but also the lowest-stakes (one on-demand display panel, nothing gated on it).

---

## 10. Recommendation relevance score (`newsRecommend/src/scoring.js`)

**Producer:** `amplify/backend/function/newsRecommend/src/scoring.js`.

**RUBRIC = deterministic formula, well-specified, and explicitly NOT an importance score.**

```js
const WEIGHTS = Object.freeze({ category: 3, country: 3, recency: 2, popularity: 1 });
const HALF_LIFE_DAYS = 2;
```

`scoreItem` (L98-104): `w.category·categoryOverlap + w.country·regionOverlap + w.recency·
recencyDecay + w.popularity·popularity`. Each term is a named, commented, pure function — recency
uses an explicit half-life decay, popularity is `log10(1+sourceCount)/log10(11)` squashed so "10
sources ≈ 1.0" (L92-95). The file header is explicit about scope: "there is deliberately no
'thread' term. This rail is *discovery*" (L14-16) — a documented design choice, not an omission.

Crucially, per `WORLD_MODEL_FRAGMENTS.md` §3.10, this score answers a **different question** than
every other score in this doc: relevance is a property of the **(event, reader)** pair (the same
topic gets a different score per user, `rankRecommendations(topics, profile, …)`, L121), not a
property of the event's importance. It should never be benchmarked the same way as severity/
significance.

**BENCHMARK = NONE wired.** The correct benchmark for a relevance/recommendation score is
engagement (click-through, save-rate, dwell time on recommended items) — none of that is measured
or fed back anywhere found in `newsRecommend` or `quality/`. There is no A/B or offline-eval
harness for recommendation quality. Given the formula's own weights (`3, 3, 2, 1`) were plainly
hand-set rather than fit, this is a **could-benefit-from-benchmark** case even though the formula
itself is fully decidable.

**Gap:** correctness-by-construction formula, sensible design docs, zero engagement-based
validation of whether the hand-set weights actually produce good recommendations.

---

## Summary table

| Score | Producer (file:line) | Formula or judgment | Rubric quality | Benchmark exists? | Gap |
|---|---|---|---|---|---|
| Canonical severity tier (4-axis) | `newsThreadAnalysis/src/index.js:263`, `newsCountryIntelligence/src/index.js:487-492`, `riskDimensions.js` | LLM judgment + deterministic tier bands | **Thin** — one calibration sentence per axis, no anchors | **NONE** | Feeds every severity display; least-benchmarked, most-relied-on score |
| Prediction probability + resolution | `NewsProjectInvokeAgentLambda/src/{index,lib}.js`, `newsPredictionResolver`, `newsPredictionsSnapshot/src/trackRecord.js` | LLM judgment + deterministic gate + deterministic scoring | **Well-specified** — falsifiable dated triggers, mechanical rejection gates | **EXISTS** — Brier score, calibration buckets, era-cut, human-confirmed ground truth | None — the template to copy |
| Breaking-alert score | `newsBreakingAlert/src/significance.js` | **Deterministic formula** | **Well-specified** — every weight/cap named + commented | **Partial, one-time, not automated** — 22-agent LLM debate over 7 stories, ~14% precision, self-caveated | Formula decidable; threshold/weights never fit to labels; the planned labeled set was never built |
| Economic severity | `newsEconomicImpact/src/index.js` | LLM judgment + deterministic clamp/downgrade | **Partial** — enum-only prompt, no calibration prose found; consistency rules well-specified | **Drift monitor only, not ground truth** (`quality/calibration_report.js`) | Self-consistency ≠ correctness |
| Economic quality score | `newsEconomicQuality/src/index.js` | LLM judgment (cross-model judge) | **Named axes, anchors not found in excerpt (UNVERIFIED deeper)** | **NONE** | Textbook judge-with-no-gold-set |
| Source robustness | `newsSourceAudit/src/index.js` | Deterministic classifier + LLM drift check | Classifier: **well-specified**. Drift check: **thin** (no anchors for borderline drift) | **NONE** for the LLM half; classifier needs none (correct by construction) | LLM drift detector's own accuracy unmeasured |
| Impact-audit rubric | `newsImpactAudit/src/index.js` | LLM judgment + 2 deterministic objective gap checks | **Best-specified LLM rubric in the codebase** (4 named dimensions + bias-aware instruction) | **Partial — benchmarks selection recall via GDACS/GDELT, not any severity score** | Validates a different question (selection) than importance scoring |
| Editorial `significance`/`urgency` | `newsInvokeGemini/src/index.js:617,646` | LLM judgment | **Thin**, and asymmetrically validated (`urgency` checked, `significance` not) | **NONE** | Live consumer (LinkedIn sort) runs on an unvalidated field |
| Trace-cause `impactScores` | `NewsProjectInvokeAgentLambda/src/index.js:405,411` | LLM judgment | **Thinnest in the codebase** — bare 1-10 integer, no anchors | **NONE** | Lowest governance, but also lowest stakes (one UI panel) |
| Recommendation relevance | `newsRecommend/src/scoring.js` | **Deterministic formula** | **Well-specified**, weights hand-set | **NONE** — no engagement feedback wired | Different question (relevance, not importance); needs engagement data to validate weights |

---

## The model to copy: predictions

What makes the prediction apparatus trustworthy, in order:

1. **A versioned methodology with a hard era cut.** `METHODOLOGY_VERSION = 1` (`lib.js:14`),
   stamped on every write (`index.js:856`), and the track-record builder explicitly excludes
   everything before `ERA_CUT_FROM = '2026-07-04'` (`trackRecord.js:13,18`) — old, differently-
   produced data is never silently blended into today's accuracy number.
2. **Falsifiable outputs by construction.** The prompt does not ask for a vibe; it asks for dated,
   checkable triggers ("a trigger we cannot score is worthless," `index.js:509`), rejecting vague
   or already-happened claims mechanically before they're logged (`lib.js` gates G1-G6).
3. **A deterministic gate between the LLM and the permanent record.** `lib.js` rejects known
   defect classes (retrodictions, false premises, relative-date artifacts, sporting results)
   *before* anything is written to the immutable log — the LLM proposes, code disposes.
4. **Ground truth from an independent, human-in-the-loop confirmation step**, not the model's own
   opinion of itself: the resolver LLM only *proposes* a verdict grounded in fresh search results
   (`newsPredictionResolver/src/index.js:141-156`); a human runs `predictions/review.js` to accept
   or override every proposal before it counts as scored data.
5. **A standard, well-understood accuracy metric on that ground truth.** Brier score
   (`trackRecord.js:44,83`) plus a full calibration/reliability breakdown by probability bucket
   (L20-21, L69-75) — not just "we got N right," but "does our 60-80% bucket actually fire 60-80%
   of the time."
6. **Full auditability.** The 30 most recent resolutions are kept with their citations
   (`trackRecord.js:53-63,90`) — nothing is a black-box aggregate number with no way to inspect
   individual cases.

Every other LLM-judged score in this system could, in principle, follow the same shape: version the
rubric, force falsifiable/checkable outputs where possible, gate mechanically before persistence,
get independent ground truth (human-labeled, not self-judged), score with a named metric, keep the
underlying cases inspectable. None of them do yet.

---

## The biggest hole: the severity tier

**UPDATE 2026-09-15: this gap is now closed — the reference set, agreement script and first
baseline exist (see §1 above); the section below is kept as the original diagnosis.**

The canonical 4-axis severity score (`riskDimensions.js` + its two LLM producers) is the score the
whole "one source of truth" tier system visibly rests on — it drives the tier pills, the map
halos, and (per `IMPORTANCE_SCALE_MAPPING.md`) is the eventual target every other importance-ish
field (`significance`, someday) is meant to derive into. And it is simultaneously:

- **Governed by the thinnest calibration text in the codebase that still claims to be a rubric**
  (one thirteen-word sentence: "0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe" —
  no anchor examples, no cross-axis comparison guidance, applied identically to two structurally
  different judgments — country-wide posture vs. single-thread severity — with no acknowledgment
  in the prompt that these are different-grained questions);
- **Benchmarked by nothing.** Not a drift monitor, not a golden-eval regression test, not a judge
  with a gold set — literally zero apparatus. Contrast with economic severity, which at least has
  a distribution-drift monitor (imperfect, but something), or breaking-alert, which at least had
  one LLM-judged spot-check.
- **Load-bearing everywhere.** Unlike `impactScores` (one UI panel) or `significance` (one post-
  sort), a wrong severity tier propagates to every country/thread page's headline badge, the map's
  halo color, and any future consumer that trusts "the" tier as ground truth per the World Model's
  own stated design intent.

This is exactly the gap `IMPACT_FIRST_REDESIGN_PLAN.md` names and never closes. Its **P0 —
Reference set** step, quoted verbatim:

> "**P0 — Reference set.** Hand-label a 'what genuinely mattered' set from recent days (extends the
> scoring gold set). This is the yardstick for *every* change below. Without it we're guessing."
> (`project-docs/pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md:115-116`)

And later: "**P0 reference set** — needs no new infra; unblocks measuring *everything*. Highest-
value first step." (L140). This was written as the necessary first step for the *selector* impact
work, but the same reference set — extended to per-axis severity labels, not just "did the
selector pick the right topics" — is precisely what the severity tier needs and does not have. It
was never built (confirmed: no such labeled file exists under `quality/`, and `IngestCapture`/
audit infra referenced elsewhere was migrated to S3 per `newsImpactAudit/src/index.js:20-23`, but
that captures selector input/output, not hand-labeled severity judgments).

**What a minimum reference set + metric would look like**, extrapolating directly from the
prediction apparatus's shape (§2) and the plan's own P0 language:

- **N hand-labeled events** (the plan's own P0 language — "hand-label... from recent days")
  spanning a range of severities and all four axes, each with an operator- (or panel-) agreed
  `{conflict, political, economic, humanitarian}` score or `null`, using the *same* 0-100 scale and
  band language the LLM prompt already defines — so the comparison is apples-to-apples.
  Country-level and thread-level cases should be labeled separately, since (per §1 above and
  `WORLD_MODEL_FRAGMENTS.md` §3.1) they are not the same judgment despite sharing a rubric.
- **An agreement metric** comparing the LLM's `dimensions` output against the hand-labels per axis
  — e.g. mean absolute error on the 0-100 scale, or (matching the tier system's own display logic)
  tier-agreement rate using the *same* `tierFromScore` bands the frontend already uses
  (`riskTiers.js:22-30`) so the metric measures what users actually see, not raw-score noise that
  gets flattened away anyway.
- **A drift check over time**, exactly like `quality/calibration_report.js` already does for
  economic severity — but anchored to the reference set's known-correct values, not just the
  output distribution's own historical shape (which, as noted in §4, can be stable and wrong).
- **Versioning**, borrowing directly from the prediction apparatus's `METHODOLOGY_VERSION`/
  `ERA_CUT_FROM` pattern (§2, point 1) — so that any future rubric/prompt change (per-axis anchor
  examples, cross-axis normalization) can be measured against the *same* reference set without
  silently mixing pre- and post-change scores into one number.

None of this exists today. It is the single highest-leverage benchmarking gap in the system,
precisely because it sits under the one score everything else is being asked to converge toward.

---

## Triage: what needs a rubric vs. what needs a benchmark vs. what's already fine

**Needs a better-specified RUBRIC** (thin or unanchored prompt text):
- Canonical severity tier / 4-axis dimensions (§1) — one-sentence-per-axis calibration, no anchors
- Trace-cause `impactScores` (§9) — bare 1-10 integer, no definition at all
- Editorial `significance` (§8) — one sentence, no anchors, unvalidated enum on write
- Economic quality score axes (§5) — axis names given, per-axis anchors not found (partially
  UNVERIFIED — worth a direct re-check of the full prompt if this becomes an active workstream)

**Needs a BENCHMARK** (rubric may be fine or even excellent, but nothing checks correctness):
- Canonical severity tier (§1) — (DONE 2026-09-15 — baseline exists; rubric fix in flight, Phase 4);
  needed most urgently since the rubric fix and the benchmark fix should probably ship together
  (you can't tell if a rubric rewrite helped without a way to measure it)
- Economic quality judge (§5) — needs an actual gold set, not just cross-model diversity
- Source-audit LLM drift check (§6) — needs a labeled drift/no-drift sample set
- Breaking-alert threshold (§3) — the plan for this (`BREAKING_ALERTS_PLAN.md:86`) already exists
  and was never executed; needs the labeled-set build, not new design work
- Recommendation relevance (§10) — needs engagement data wired back, not a hand-labeled set (this
  is a different kind of benchmark — online, not offline)

**Already fine as engineering** (deterministic, decidable by construction — a benchmark would only
help tune constants, not validate correctness, since correctness is definitional):
- `riskDimensions.js`'s tier-derivation formula itself (clamp/tierFromScore/deriveRisk) — correct
  by construction; the LLM inputs feeding it are the actual risk (§1)
- Breaking-alert scoring formula's weighted-sum mechanics (§3) — the *formula* is sound; only the
  threshold/weight *values* are unvalidated
- Economic severity's band-clamp and evidence-downgrade consistency rules (§4) — sound
  self-consistency checks; just not a correctness check
- Source robustness classifier (`none/single/low/weak/corroborated`, §6) — a pure count-based rule,
  nothing to benchmark
- Recommendation scoring's formula mechanics (§10) — sound personalization math; only the hand-set
  weight *values* would benefit from engagement-based tuning
- The prediction apparatus in full (§2) — this is the reference implementation the rest of the
  triage is measured against

**Gold standard, nothing to fix:**
- Prediction probability + resolution (§2) — rubric well-specified, benchmark exists and is
  statistically sound (Brier + calibration buckets + human-confirmed ground truth + versioning)
