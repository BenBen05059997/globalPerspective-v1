# Breaking-Alert Scoring Rubric

**The single source of truth for how a story is scored for a breaking-news alert** — the
weights, the point values, the rationale, the known flaws, and the proposed re-score.
Supersedes the scattered mentions in `BREAKING_ALERTS_PLAN.md` (formula only) and
`NOTIFICATION_GAP_ANALYSIS.md` (rationale only). Implementation: `newsBreakingAlert/src/significance.js`.

Companion: `BREAKING_ALERT_DEBATE_2026-06-24.md` (the multi-agent debate over 7 real
detections that exposed the flaws below).

---

## 1. Current rubric (v1, live)

A story = all topics sharing a `threadId`. We score the **story**, not the topic.

```
score = 1.0·popularity + 1.0·breadth + 2.0·risk + 1.5·economic + 1.5·velocity
        (max = 7.0)   →   ALERT if score ≥ 2.0   (a continuation must clear 3.6 = ×1.8)
```

| Signal | Weight | =1.0 when | Source (DDB) | Stated rationale |
|---|:---:|---|---|---|
| popularity | 1.0 | ~10 sources | `sources.length` (log-squashed) | many outlets corroborating |
| breadth | 1.0 | 4+ angles | distinct topics under the thread | story hitting many angles at once |
| **risk** | **2.0** | riskScore = 100 | `COUNTRY_INTELLIGENCE.riskScore` (max over regions) | "country-level risk **dominates**" |
| economic | 1.5 | magnitude large | `ECONOMIC_IMPACT.instruments[].magnitude` (lg 1.0 / mod 0.6 / sm 0.3) | market-moving magnitude |
| velocity | 1.5 | ~5 new angles | topicCount vs prior `THREAD_ANALYSIS.entryCount` | rate of change — accelerating now |

**Anti-fatigue:** 1 story/run; 5-day dedupe per thread; a continuation faces a ×1.8 bar.

---

## 2. Diagnosis — the scorer measures LOUDNESS, not URGENCY

From the 7-story debate (judge endorsed only **1 of 7** firings; both *sent* stories were
false positives; the one urgency-82 story was withheld).

### 2a. Country-risk dominance (the central flaw)
`risk` is the heaviest weight (2.0) **and** it reads the *country's standing* risk
(`COUNTRY_INTELLIGENCE.riskScore`), which barely moves — Israel ~82, Ethiopia ~88, Iran ~62
sit high permanently because they are conflict zones. So **any** story that merely *mentions*
a high-risk country inherits most of the bar, regardless of what happened.

| story | score | country risk | risk→pts | **% of the 2.0 bar from risk alone** |
|---|:---:|:---:|:---:|:---:|
| Abiy Nile ambitions | 2.798 | 88 | 1.76 | **88%** |
| Gaza genocide finding | 3.791 | 82 | 1.64 | **82%** |
| Airbus A380 inspect | 2.611 | 68 | 1.36 | 68% |
| Alibaba sues DoD | 2.338 | 65 | 1.30 | 65% |
| Five Eyes AI warning | 2.169 | 65 | 1.30 | 65% |
| Iran/Oman *discuss* fees | 3.009 | 62 | 1.24 | 62% |
| Germany rail outage | 2.278 | 62 | 1.24 | 62% |

For **Iran/Oman**, country-risk (1.24) + event-independent econ magnitude (0.90) = **2.14 >
2.0** — the event ("agreed to discuss fees") could have had *zero* coverage and still fired.

### 2b. Every signal is a "loudness" signal
- **risk** = a country attribute (not the event).
- **popularity / breadth / velocity** = coverage *volume* (how loud right now).
- **economic** = market magnitude (the only event-specific one).

**Nothing scores the questions that decide urgency:** did a *threshold get crossed* (a
realized event vs an announcement / filing / warning / inspection / resolved incident)? Is it
a *discontinuity*? Is it *credibly* sourced? Every false positive in the debate was a
non-event the scorer couldn't see as such. (`NOTIFICATION_GAP_ANALYSIS.md` flagged this
loudness problem in June; the new finding is the country-risk math + the event-vs-announcement
blind spot.)

### 2c. The bar is low
Threshold 2.0 is **29% of the 7.0 max**, and the single risk weight (2.0) equals it. A
generous bar is fine *if* something downstream judges precision — today nothing does.

---

## 3. Data realities (verified 2026-06-24, must constrain the fix)

- **Thread-level event risk is only 33% populated.** `THREAD_ANALYSIS.riskScore` (the
  event-specific 0–100 risk, the obvious replacement for country-standing risk) exists on
  only **60 of 181** threads (sentiment + inflectionTopicId likewise ~33%). It's a newer
  schema field. **A clean swap would blind the scorer on two-thirds of stories** → the fix
  needs a fallback, not a straight substitution.
- `ECONOMIC_IMPACT` (event magnitude) and `COUNTRY_INTELLIGENCE.riskScore` are broadly
  populated. Source domains are available per topic (enables a cheap corroboration count).

---

## 4. Proposed re-score (v2) — for debate, NOT yet implemented

**Reframe the job.** Two layers with separate mandates:
- **Deterministic scorer = RECALL.** Cheap, generous "does this deserve a look?" net. It
  must stop being a country-risk amplifier, but it does *not* make the final call.
- **LLM verify-agent = PRECISION.** The real send gate (urgency ≥ ~70, event-state, credibility).

### 4a. Deterministic changes
1. **Demote + event-ify risk.** Use `THREAD_ANALYSIS.riskScore` (event-level) when present;
   else fall back to `COUNTRY_INTELLIGENCE.riskScore` **capped at 50** so geography alone
   can't clear the bar. Cut the weight **2.0 → 1.0**.
2. **Keep** popularity (1.0), breadth (1.0), economic (1.5), velocity (1.5) — velocity stays
   emphasized as the only novelty proxy.
3. **Corroboration as a gate, not a weight:** require ≥2 *distinct source domains* before a
   story is eligible. Single-source → ineligible (kills the Five Eyes / Daily-Maverick case
   deterministically).
4. **Recalibrate the threshold** after re-weighting (max drops to ~6.0; pick the bar from a
   labeled set, not by feel).

### 4b. Two cheap deterministic pre-checks (no LLM)
5. **Immediacy floor:** suppress anything whose summary is already-resolved ("resumed",
   "restored", "ended") — a closed incident is never push-worthy (kills Germany rail).
6. **Event-state heuristic (advisory):** down-rank trigger verbs of intent — "warns",
   "agrees to discuss", "to inspect", "files suit", "calls for". Brittle on its own, so it
   *flags* for the LLM rather than hard-suppressing.

### 4c. LLM verify-agent (the precision gate)
7. Gemini judge (different family from the DeepSeek producer) returns the debate's schema:
   `event_state` (REALIZED / WARNING / INTENT / FILING / RESOLVED), 6 urgency dimensions,
   verdict, red_flags. **Send only if verdict = alert.** Run in **shadow mode** first (log
   beside every detection) until it earns trust, then let it veto.

### 4d. What v2 would have done to the 7 stories (intended)
Gaza → **alert** (event-level risk + realized threshold crossing). All six others →
**suppress** (capped geography + event-state/immediacy/corroboration gates). Target: flip
~14% precision toward the debate's 1/7 ground truth.

---

## 5. Open questions (for the debate)

1. **Smart vs dumb deterministic layer.** Should the deterministic scorer get smarter
   (more signals, event-state heuristics), or stay deliberately dumb-high-recall and push
   *all* judgment to the LLM? Brittle keyword heuristics may not earn their complexity.
2. **The 33% coverage problem.** Is "thread-risk when present, else capped country-risk" a
   principled fallback or an inconsistent two-regime score? Should we instead backfill
   `THREAD_ANALYSIS.riskScore` first, or drop event-risk until coverage improves?
3. **Are the v2 weights principled or just vibes?** With no labeled set, every number (cap
   at 50, weight 1.0, ≥2 sources) is a guess. Do we need the labeled eval *before* re-tuning?
4. **Corroboration gate risk.** Could "≥2 distinct domains" suppress a genuine scoop that
   one outlet breaks first (the highest-value alert)?
5. **Does recall-filter framing even need good weights?** If the LLM gate is the real
   decision, maybe the deterministic weights barely matter and we're over-engineering them.

---

## 6. Panel debate verdict (2026-06-24)

A 5-agent panel (measurement skeptic · intelligence analyst · architecture minimalist ·
proponent · judge) stress-tested §§2–5. Full transcript: workflow `scoring-rubric-debate`.

**Verdict: the diagnosis is sound; the proposal is the right *shape* but NOT shippable as
written.** Ruling: `sound_but_eval_first` — ship the cap + shadow-mode judge now, but do not
re-tune weights blind.

> *"The diagnosis is correct and unusually rigorous… The v2 architecture (deterministic
> recall + cross-family LLM precision gate, shadow-first) is the right shape and the
> country-risk cap is the right core fix. But it is not shippable as-is: the ≥2-domain hard
> gate structurally kills the highest-value alert (the scoop), the deterministic keyword
> heuristics duplicate the LLM's job brittlely, the two-regime risk score is uninterpretable,
> and every weight is an unlabeled guess reverse-engineered to fit one 7-story anecdote."*

**Unanimously KEEP:** the recall/precision split · **cap country-risk at 50** (the single
highest-leverage fix) · cross-family judge (Gemini vs DeepSeek) · shadow-mode-first · the
*direction* of demoting the risk weight.

**CHANGE / DROP (consensus):**
- **❌ The ≥2-domain corroboration HARD GATE → make it a SOFT signal the LLM can override.**
  All four lenses (incl. the proponent) called this the one indefensible item: a hard
  eligibility gate structurally makes us *last* on the single-source **scoop** — the
  highest-value alert. Corroboration is a confidence input, never a recall-layer gate.
- **❌ Delete the deterministic keyword heuristics #5 (immediacy floor) & #6 (intent-verb).**
  Brittle regex that misfires on the exact phrasings the LLM handles robustly, and they live
  in the layer whose only job is recall. Move ALL event-state classification to the LLM.
- **⚠️ Fix the event-state taxonomy.** It re-encodes loudness bias in reverse: WARNING/FILING
  are **not** uniformly low-urgency. A credible imminent **WARNING** (evacuation order,
  airspace closure, central-bank emergency meeting) and certain **FILINGS** (ICC arrest
  warrant, sovereign default notice, war-powers filing) are *top*-urgency on issuance. Score
  urgency × event-type as **separate** dimensions, not one rank.
- **❌ Don't ship the two-regime risk score.** Thread-risk is only 33% populated; a feature
  with two definitions across 67%/33% of stories makes the threshold uninterpretable. Use a
  consistent capped-country-risk now; backfill `THREAD_ANALYSIS.riskScore`, then switch once
  it can be the sole definition.
- **❌ Don't recalibrate the threshold blind.** Defer until a labeled set exists.

**Biggest risk (mandatory mitigation):** once the LLM is the send decision, its failure modes
become *invisible false negatives* — Gemini free-tier quota exhaustion (hit before on this
project), latency, or hallucinated suppression silently mute a real alert. False negatives on
an alert system are invisible, unlike v1's visible false positives. **Required:** a
deterministic high-confidence **bypass** (e.g. REALIZED + multi-source + large-econ fires even
if the judge is down) + measure the judge's false-suppress rate in shadow mode before granting
veto. Consistent with our existing dead-man's-switch patterns (freshness-monitor, source-audit).

**Gaps the panel found in our own analysis:** (a) the proposed taxonomy conflates event-type
with urgency; (b) "Gaza alert, 6 suppress" is overfitting — the proposal was reverse-engineered
to that outcome on its only test set; (c) under-weights the false-negative asymmetry; (d) leaves
dedupe/continuation (1/run, 5-day, ×1.8) unspecified under the two-layer model.

---

## 7. Revised plan (v2.1, post-debate — the one to implement)

**Order matters: ship the safe deterministic cure + a shadow judge now; let DATA, not the
7-story anecdote, drive every weight.**

1. **NOW — deterministic, safe:** cap `COUNTRY_INTELLIGENCE.riskScore` at **50** and demote
   the risk weight (2.0 → ~1.0). Leave all other v1 signals/weights frozen. This alone cures
   the §2a dominance pathology. *No two-regime score; no threshold recalibration yet.*
2. **NOW — LLM verify-agent in SHADOW mode:** Gemini judge (cross-family), returns
   `event_state` + 6 urgency dimensions + verdict + red_flags, **logged beside every
   detection, no veto.** Corroboration, immediacy, and event-state become **soft inputs to the
   judge**, never deterministic gates.
3. **NOW — deterministic high-confidence bypass:** REALIZED + ≥2 sources + large-econ can fire
   even if the judge is unavailable, so quota/latency/hallucination can't silently mute a
   Gaza-class alert.
4. **Fix the taxonomy** in the judge prompt: urgency × event-type as separate axes; imminent
   WARNINGs and load-bearing FILINGS can be top-urgency.
5. **Build a 50–100 story labeled gold set** (alert/suppress). Measure v1 baseline
   precision/recall + the judge's false-suppress rate in shadow mode.
6. **ONLY THEN:** re-tune weights/threshold, decide the corroboration policy, switch to
   event-level thread-risk (once backfilled), and grant the judge veto — all from the gold-set
   data, not from anecdote.
7. **Specify:** dedupe (1/run, 5-day) + continuation (×1.8) stay **deterministic**, upstream of
   the judge.

---

## 8. How professionals weight risk (external methods, researched 2026-06-24)

Surveyed five established methodologies for how serious systems score risk/significance. One
pattern is universal and it directly indicts our v1 design: **they never collapse everything
into one number with a dominant standing-risk term. They separate event-type, instance
intensity, urgency/timeliness, and certainty into orthogonal axes — and the serious ones learn
the weights from labeled data.**

| Method | How it weights risk | What we take from it |
|---|---|---|
| **CAP** (Common Alerting Protocol — OASIS/NWS, the global public-warning standard) | Three **separate, independent axes**: **urgency** (Immediate/Expected/Future/Past), **severity** (Extreme/Severe/Moderate/Minor), **certainty** (Observed/Likely/Possible/Unlikely). Kept distinct — *not* combined into one rank. | Gold-standard validation of the panel's call: urgency/severity/credibility are **separate dimensions**, not one score. Our verify-agent's multi-dimension output is correct; our single v1 composite is the anti-pattern. |
| **GDELT Goldstein scale** | Assigns each **event *type*** a latent impact score (−10…+10) by type, *independent of the specific instance* (a 10-person and a 10,000-person riot get the same Goldstein); instance intensity comes from **separate** signals (tone −100…+100, mention count). | The missing piece: a **per-event-type severity prior**, kept separate from instance loudness. We have *no* event-type weight — a genocide finding and a "fee discussion" ride the identical loudness signals. Add an event-class prior × instance magnitude. |
| **ICRG** (PRS Group country-risk index) | 22 components in 3 buckets; political (100 pts) weighted **2× financial/economic** (50 each); composite = sum/2; **weights published and user-customizable**. | Confirms two things: (a) professional risk scores are **decomposed into many components with deliberate, documented weights** — not one term carrying 88%; (b) ICRG-style country risk is a **standing country-comparison score** (willingness/ability to pay), *not* an event signal — using it as our heaviest alert weight is a category error. |
| **News values** (Galtung-Ruge lineage; Boukes et al. 2022; Reuters Tracer) | ~7 criteria (timeliness, proximity, impact, prominence, unusualness, conflict, human interest); significance = **hitting *multiple* at once**; empirically **conflict + eliteness** most predict prominence; **timeliness/unusualness are first-class**. | Significance is multi-signal with **none dominant**, and **timeliness + novelty are first-class** — exactly what our loudness-only signals lack (velocity is a weak novelty proxy). |
| **Dataminr First Alert** (real-time critical-event detection) | Severity from multiple orthogonal **"valuers"** — location, **time**, response, **categorization** (event-type), **impact** — combined; **weights derived dynamically via ML on a historical-events database**; normalized to a 1–5 rank; relevance filter cuts false positives. | The production blueprint: orthogonal valuers incl. **time (immediacy)** and **categorization (event-type)**; **weights are *learned* from labeled history, not hand-set** — direct external backing for the panel's "build the gold set, don't guess weights"; a relevance/precision filter on top (= our LLM gate). |

**What this changes in our plan (folds into §7):**
- **Strong external support** for: separating urgency/severity/certainty (CAP), the recall→precision filter (Dataminr's relevance layer), and **learning weights from a labeled set** rather than hand-tuning (Dataminr; ICRG shows even hand-set weights are *documented and deliberate*, not vibes).
- **New, well-precedented idea to add:** an **event-type severity prior** (Goldstein-style) — a small deterministic weight by event class (e.g. atrocity-finding / coup / default ≫ inspection / lawsuit-filing / fee-talk), kept **separate** from instance loudness. This is the principled version of the event-state gate, and it's how GDELT, CAP-severity and news "impact" all encode magnitude.
- **Strong external confirmation of the core bug:** standing country-risk (ICRG-style) is a *country-comparison* instrument, not an event-urgency signal — so capping/demoting it (§7 step 1) is right, and ideally it becomes a minor modifier, not a primary axis.

**Sources:** [OASIS CAP v1.2 spec](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html) ·
[NWS CAP docs](https://vlab.noaa.gov/web/nws-common-alerting-protocol/cap-documentation) ·
[GDELT Event Codebook v2.0](http://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf) ·
[ONS GDELT appendix](https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/deaths/methodologies/globaldatabaseofeventslanguageandtonegdeltappendix) ·
[ICRG methodology (PRS Group)](https://www.prsgroup.com/wp-content/uploads/2014/08/icrgmethodology.pdf) ·
[Harvey — Political/Economic/Financial Risk](https://people.duke.edu/~charvey/Country_risk/pol/pol.htm) ·
[Newsworthiness criteria](https://journalism.university/media-information-literacy/what-makes-news-key-criteria-newsworthiness/) ·
[Boukes et al. 2022, news factors & prominence](https://journals.sagepub.com/doi/10.1177/1464884919899313) ·
[Reuters Tracer](https://arxiv.org/pdf/1711.04068) ·
[Dataminr real-time alerting](https://www.dataminr.com/resources/blog/real-time-alerting-101-how-it-works-and-why-its-a-business-imperative/)

---

## 9. Fit analysis — why we use / don't use each standard, and how to adopt it

The five standards are **not the same kind of thing**, so "why aren't we using them?" has a
different answer for each (researched 2026-06-24).

| Standard | What it actually is | Why we don't use it (yet) | Conflict / how to adopt |
|---|---|---|---|
| **GDELT** | A **free, real-time event *database*** (15-min): "Actor A → action → Actor B" (CAMEO) + Goldstein event-type impact + global tone + mention counts. Free via file feeds / BigQuery. | No good reason — we built our own RSS+Brave clustering and overlooked it. **The real miss.** | **Adoptable, low conflict.** Supplies the 3 things our scorer lacks: event-type magnitude (Goldstein), country *relationship* (actor→actor, not max-risk), independent corroboration/velocity (mentions). Conflict: it's noisy machine-coding on a rigid taxonomy → use as an **enrichment feed** matched to our editorial threads, not a replacement. |
| **CAP** | An **XML *output format*** for broadcasting alerts (urgency/severity/certainty/area). Used by FEMA/IPAWS, NWS, MetService NZ, Google Public Alerts. | It's a format, **not a scoring method** — nothing to "use" for significance. | **No conflict — adopt for OUTPUT.** Emit our alerts + Signal-API records in CAP's 3-axis schema → interoperable with Google Public Alerts etc. A product/distribution win. |
| **ICRG** | A **paid standing country-risk index** (PRS Group), analyst-scored. | We **already built our own** (`COUNTRY_INTELLIGENCE.riskScore`). | **No adoption needed — fix our USAGE** (see §9a). We're misusing our copy as an event signal. |
| **News values** | A journalism **framework** (Harcup & O'Neill 2017: 15 values). | A theory, not a system. | **Adopt as the LLM judge's checklist** (§9c). |
| **Dataminr** | A **paid competitor** (multi-"valuer" severity + ML-learned weights + relevance filter). | It's a rival you pay for. | **Copy the architecture, not the product** — it *is* our recall→precision + learn-from-labels plan. |

### 9a. ICRG — deeper, and how we use it
ICRG decomposes country risk into **22 analyst-scored components**, weighted deliberately:
- **Political risk = 100 pts** (=2× the others), from **12 components**: five worth 12 pts each
  (*government stability, socioeconomic conditions, investment profile, internal conflict,
  external conflict*), six worth 6 pts (*corruption, military in politics, religious tensions,
  law & order, ethnic tensions, democratic accountability*), and *bureaucracy quality* worth 4.
- **Financial risk = 50 pts**, **Economic risk = 50 pts** (5 components each).
- Composite = (P + F + E) / 2, on 0–100 (higher = *lower* risk). Scored by editors via
  **pre-set questions** for consistency across countries and time.

**Three lessons for us:**
1. **It is explicitly a STANDING country-comparison baseline** ("willingness/ability to pay") —
   confirming our central bug: a standing index must be a *baseline/modifier*, never the
   event-urgency driver. → §7 cap/demote is right; ideally country-risk becomes one minor axis.
2. **Risk is decomposed into many transparent, deliberately-weighted sub-components** — not one
   term carrying 88%. Our `riskScore` is an opaque single 0–100. We could give it ICRG-style
   sub-structure (internal-conflict / external-conflict / govt-stability …) so it's auditable
   and so the *event* can map to the *relevant* sub-component (a coup → government-stability; a
   border clash → external-conflict) instead of inheriting the whole blob.
3. **Weights are documented + customizable** — the opposite of our "vibes" constants.

### 9b. Framework → our scoring axis (the adoption map)
Every axis our scorer needs maps to a battle-tested framework — we should *copy*, not invent:

| Axis we need | Framework to copy | How the agent/scorer uses it |
|---|---|---|
| Event-type magnitude | **CAMEO + Goldstein** (GDELT) | a per-event-class severity prior, separate from loudness |
| Country *relationship* | **GDELT actor→actor + Goldstein cooperation/conflict** | replace max-country-risk with "what A did to B, hostile or cooperative" |
| Country baseline | **ICRG** (decomposed) | one minor modifier axis, sub-component matched to the event |
| Newsworthiness / significance | **Harcup & O'Neill news values** (§9c) | the LLM judge scores the story against the 15 values |
| Credibility / corroboration | **Admiralty (NATO) code** (§9c) | grade source reliability (A–F) × info credibility (1–6) — *not* a hard ≥2-source gate |
| Urgency / severity / certainty | **CAP** (separate axes) | keep distinct; also the output schema |
| Forecast probability & confidence | **ICD 203 / Words of Estimative Probability** (§9c) | standardized bands; separate likelihood from confidence; explain the basis |
| Avoiding confirmation bias | **Structured Analytic Techniques / ACH** | judge weighs alternative explanations before ruling (ICD 203 mandates this) |

### 9c. The frameworks the verify-agent should copy (analytic tradecraft)
The LLM verify-agent becomes an **analytic-tradecraft agent** applying established standards:
- **News values — Harcup & O'Neill (2017), 15 values:** exclusivity, bad news, conflict,
  surprise, audio-visual, **shareability**, entertainment, drama, follow-up, **the power elite**,
  **relevance**, **magnitude**, celebrity, good news, news-org agenda. ("Shareability +
  immediacy increasingly determine what gets reported.") The judge scores the story against
  these → significance is **hitting several at once**, none dominant.
- **Admiralty / NATO 6×6 code (Five Eyes standard):** source **reliability A–F** (A very
  trustworthy … F known false) × information **credibility 1–6** (1 confirmed by independent
  sources … 6 cannot be judged). e.g. *B2* = usually-reliable source, probably-true info. This
  is the **scoop-safe** replacement for our ≥2-source hard gate: a single trustworthy source =
  *A2/B2*, still high — corroboration becomes a graded confidence input, not a kill switch.
- **ICD 203 / Words of Estimative Probability (US IC tradecraft):** fixed probability bands —
  *almost no chance* 1–5%, *very unlikely* 5–20%, *unlikely* 20–45%, *roughly even* 45–55%,
  *likely* 55–80%, *very likely* 80–95%, *almost certainly* 95–99%; **never blend likelihood
  with confidence**; **explain the basis** (evidence, assumptions, alternatives). Plugs straight
  into our forecast layer (already uses probability midpoints) and the calibration differentiator.

**Net:** the verify-agent isn't a bespoke prompt — it's a thin wrapper that makes the LLM apply
news-values significance + Admiralty credibility + CAP urgency/severity + ICD-203 probability,
with a Goldstein/ICRG-informed deterministic prior underneath. Standards-grounded, not vibes.

**Sources (§9):** [GDELT data access](https://www.gdeltproject.org/data.html) ·
[CAMEO event codes](https://www.gdeltproject.org/data/lookups/CAMEO.eventcodes.txt) ·
[FEMA CAP/IPAWS](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers/common-alerting-protocol) ·
[ICRG methodology](https://www.prsgroup.com/wp-content/uploads/2014/08/icrgmethodology.pdf) ·
[Admiralty code](https://en.wikipedia.org/wiki/Admiralty_code) ·
[SANS — Admiralty system in CTI](https://www.sans.org/blog/enhance-your-cyber-threat-intelligence-with-the-admiralty-system) ·
[Harcup & O'Neill 2017](https://eprints.whiterose.ac.uk/95423/) ·
[ICD 203 analytic standards](https://github.com/wesinator/ICD203-intel-analysis) ·
[Words of Estimative Probability (CIS)](https://www.cisecurity.org/ms-isac/services/words-of-estimative-probability-analytic-confidences-and-structured-analytic-techniques)
