# World Model — the semantic ontology

**Status:** binding rules (operator decisions 2026-09-12). Last verified: 2026-10-19 against the repo
source and live AWS.

This doc says what an event is, what identifies it, what type it is, how important it is, how we know,
and when it starts and ends — across the map (situation) pipeline and the editorial (topic/thread)
pipeline. It describes meaning, not implementation (`ARCHITECTURE.md`); code that disagrees with it on
meaning is the thing that is wrong.

Decisions recorded from it: placeless developments kept, demoted (decisions/0004); one importance scale,
the canonical tier, with four labelled exceptions (decisions/0005). The §3 lossy-category mapping is a
proposal the operator has not ruled on.

"VERIFY §X" cites the deleted verification report:
`git show 120de90:project-docs/archive/architecture/WORLD_MODEL_VERIFY_2026-09-11.md`. Other deleted sources:
`IMPACT_FIRST_REDESIGN_PLAN.md` (`git show 120de90:project-docs/archive/pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md`),
`EVENT_REGISTRY_PLAN.md` (`git show 120de90:project-docs/archive/redesign-ux/_active/EVENT_REGISTRY_PLAN.md`).

---

## §1 The entity: the EVENT

There is exactly one kind of thing this whole system is about: an **EVENT** — something that
happened or is happening in the world, with a place, one or more actors, and a type. An event
**persists** as long as it's live (a war, a flood, a policy fight don't end when an article does)
and is **narrated** in two different registers by two different pipelines: the map pipeline
narrates it as a **situation** (a live, monitored thing with a state), the editorial pipeline
narrates it as a **story/thread** (a written analysis with a history of coverage). Situation and
thread are not two entities — they are two lifecycle aspects (§6) of the same event, currently
produced by two pipelines that don't yet share a spine (§2, §8). Every other record in the system
(econ-impact record, prediction, drift note, quality-judge verdict) describes some *aspect* of
one event and must be traceable back to it via one of the two identity roots below — never via a
new ID space of its own.

## §2 Identity

**Per VERIFY §A, there are two real, internally-generated identity roots — not five, not one:**

1. **`storyId`** (`${axis}#${iso3}#${slug(entity)}`) — the map/situation pipeline's own key
   (`backend/situations/newsSituationIngest/src/classifier-core.js`). `situationId` for a news-sourced situation is
   `news#<ISO3>#<threadId>` when the story has a thread (one situation per country and thread;
   `newsSituationId` in `backend/shared/src/situations-core.js`), else the wrapper `news#${storyId}`; the old per-story ids stay as `aliases` — not a separate space. `situationId` for a GDACS-sourced
   situation (`gdacs#${eventKey}`) is a pass-through of GDACS's own upstream ID — external, not
   invented here.
2. **`topicId`/`threadId` family** — the editorial pipeline's own key(s) (`newsInvokeGemini`).
   Many `topicId`s accrete into one `threadId` (`continues_topic`, else a composite score ≥ 0.4 with keyword overlap ≥ 0.15). Topic ids change every run; thread ids are stable, so every per-story record carries `threadId` and a `THREAD#<threadId>` / `TOPICS` row maps back. The economic-impact record
   (`PK: ECON#THREAD#{threadId}`) and `PredictionLog` (`PK: PRED#${topic.id}`) are **already
   correctly foreign-keyed onto this root** — they are not independent spaces and are not
   fragmentation to fix. Any future record that describes an aspect of an editorial event follows
   this same pattern: foreign key onto `topicId`/`threadId`, never a new primary key.

**The actual gap** is that these two roots have no join key between them (VERIFY §A). That gap
is being closed, not by inventing a third root, but by:

- **The fingerprint** — `iso3[]` / `actors[]` / `event_type` emitted by both pipelines
  (Phase 1b, shipped 2026-09-11) — the cross-root **join evidence**, not an identity itself.
- **The matcher** — URL-exact overlap (Tier 1, ~32%, 0 false positives; live in
  `NewsProjectInvokeAgentLambda`) unioned with the R3 fingerprint rule (≥2 shared countries + ≥1
  shared genuine actor, 0 FP on backfill; off live — `ENABLE_R3_TIER` is not set) — the **bridge**, writing
  `threads/story-map.json` (storyId ↔ threadId pairs, one S3 object, one writer). This is the
  only thing allowed to assert "these two roots name the same event."
- **Phase 2** (editorial selects from the registry instead of running its own RSS fetch) is the
  **eventual single root**: once editorial topics are generated *from* registry stories, storyId
  becomes the one identity and threadId becomes a derived grouping over it, exact by construction.

**The law: no new ID spaces.** Every future feature that needs to name "this event" uses
`storyId` or `topicId`/`threadId`, joined via the matcher where cross-pipeline, or foreign-keyed
onto one of them where single-pipeline. A PR that adds a fourth generated identifier is a
violation of this document, not a judgment call.

## §3 Type system

**The taxonomy is two axes, not three:**

- **`axis`** (4 values: `conflict, political, economic, humanitarian`) — the display hue.
- **`event_type`** (11 values: `war, unrest, diplomacy, election, policy, economy, markets,
  disaster, health, tech, other`) — the classifier's category enum, and per `EVENT_REGISTRY_PLAN.md`
  §Phase 1b **already adopted as the editorial fingerprint's `event_type` field** (VERIFY §C: "in
  the process of becoming shared infrastructure, not a permanent third silo"). These two together
  are THE canonical type system. Nothing else classifies "what kind of event is this."

**Editorial's 12 display categories are demoted to a display mapping**, not a parallel taxonomy —
`politics, economy, military, conflict, disaster, technology, health, climate, science, business,
society, energy` (`newsInvokeGemini` `VALID_CATEGORIES`). Seven map cleanly (military→war/conflict,
economy→economy/economic, business→markets/economic, disaster→disaster/humanitarian,
health→health/humanitarian, politics→policy/political, conflict→war/conflict). **Five are lossy**
(VERIFY §C, confirmed + technology/energy added to the claim's science/climate/society list).
Proposed exact mapping for the five, to remove ambiguity — **flagged NEEDS-OPERATOR-REVIEW**,
since VERIFY documents these as "no clean match" rather than prescribing an answer:

| Editorial category | → `event_type` (default) | → `axis` (default) | Override rule |
|---|---|---|---|
| `science` | `other` | `economic` | none proposed — genuinely no signal to key an override on |
| `climate` | `disaster` | `humanitarian` | if the story is policy-flavored (COP summit, legislation) → `policy` / `political` |
| `society` | `unrest` | `political` | if no unrest signal (demographics, culture) → `other` / `humanitarian` |
| `technology` | `tech` | `economic` | if the story is state-vs-state (export controls, cyberwar) → `other` / `conflict` |
| `energy` | `economy` | `economic` | if energy is the conflict lever (pipeline attack, embargo) → `war` / `conflict` |

This table is the display-layer's problem to own; it must never leak backward into `event_type`
storage — a story is tagged once, by the classifier's own 11-item vocabulary, and the category
column is derived for rendering only.

## §4 Impact model — the core

**The marking law: measured > counted > judged.** Prefer a number from an authoritative feed,
over a count we can verify ourselves (outlets, countries, edits over time), over a rubric a
human/LLM judges. Never invent a fourth tier ("vibes") — that's exactly the failure
`IMPACT_FIRST_REDESIGN_PLAN.md` §0 diagnosed in the pre-redesign selector.

**Typed inputs, per domain** (`IMPACT_FIRST_REDESIGN_PLAN.md` §3.5, "impact is typed by domain"):

| Domain | Measured input | Status |
|---|---|---|
| disaster | GDACS alert level (Red/Orange/Green) | live (`newsGdacsIngest`) |
| disaster | GDACS affected population | **KNOWN GAP** — no population field anywhere in GDACS ingest (VERIFY §E); not fixable by re-parsing, the feed doesn't carry it |
| conflict/humanitarian | fatalities | **per-event GAP** — zero hits in GDELT/GDACS ingest (VERIFY §E). Country-level only: `newsCountryFactsUpdater` collects ACLED `fatalities30d`/`eventCount30d` for its first 12 countries into `FACTS#<country>` (ACLED credentials set live). Per-event fill (ReliefWeb + INFORM Severity Index) not wired |
| economy | `newsEconomicImpact` severity (own state machine) | parked (decisions/0009; schedule disabled) |
| everything else (politics/tech/science/other) | editorial rubric: reach / severity / irreversibility / novelty | **the vocabulary already exists** — `backend/monitoring/newsImpactAudit/src/index.js:56,74` uses these exact four labels as QA-judge dimension tags (job parked: `TriggerImpactAudit` DISABLED, decisions/0015) (VERIFY §E "positive finding": real precedent, currently QA-only, not yet populating a registry record) |

**Universal counts** (apply to every event regardless of domain, always countable, never judged):
outlets = corroboration, countries = spread, velocity = rate of new coverage.

**One display scale.** `low / moderate / elevated / high` — the situation tier
(`situations-core.js` `LEVEL_TIER`/`SEV_TIER`) and `riskTiers.js` (25/50/75 bands) are **the same
vocabulary**, confirmed canonical with zero frontend stragglers (VERIFY §F). Every typed input
above, and every legacy scale below, either already collapses into this tier or is justified as
staying separate. There is no second display scale to invent.

**Deprecation map** — one row per legacy scale, per VERIFY §B's verdicts:

| Scale | Status | Consumer that gates it | Migration trigger |
|---|---|---|---|
| Classifier severity (int 1-5) | **ALREADY-ABSORBED** | folds into tier server-side before any frontend read; raw int never leaves backend | none — done |
| GDACS Red/Orange/Green + `alertscore` | **ALREADY-ABSORBED** | folds into tier via `LEVEL_TIER`; raw kept only in `evidence.gdacs_level` as audit trail | none — done, audit trail is correct to keep |
| Situation tier (low/mod/elevated/high) | **CANONICAL** (this IS the display scale) | all map/situation frontend | — |
| `riskScore` 0-100 ×4 axes + `riskLevel` | **CANONICAL** (the other survivor) | 11 frontend files via `riskTiers.js` | — |
| Editorial significance (h/m/l) | **DERIVE-THEN-DEPRECATE** (unconfirmed) | server-side ranking/prompt logic only; no confirmed frontend consumer found (VERIFY §B) | on next touch of `newsInvokeGemini` selection: grep `Home.jsx`/topic-card components for a live consumer; if none, fold into tier and stop persisting a separate field |
| Editorial urgency (h/m/l) | **KEEP-AS-IS (4th exception — tempo, not importance)** | editorial freshness display only; not an importance signal | none — this is a permanent exception, same pattern as the other three KEEP-AS-IS rows above |
| Breaking-alert float score | **KEEP-AS-IS** | `newsBreakingAlert` threshold gate (`isBreaking`); `BreakingStrip` send-eligibility | none — this is a decision gate (should we alert), already a downstream *combiner* of canonical inputs (capped riskScore + velocity + outlets + econ magnitude), not a display scale competing with tier; collapsing it into 4 buckets breaks the gate's needed granularity |
| Economic-impact severity (minor/mod/severe + score 0-100) | **KEEP-AS-IS**, parked with the economy (decisions/0009) | `EconomicImpact` UI (rendered band + magnitude) | on next touch of `newsEconomicImpact` severity logic: evaluate porting `SEVERITY_BAND` thresholds onto the riskTiers bands *while preserving* the downgrade state machine (thin winners/losers, low-confidence clamps) — never a bare relabel |
| Prediction probabilities (ICD-203 bands) | **KEEP-AS-IS** (different semantic) | `/track-record`, `ThreadForecast` | none — this is likelihood, not impact; not commensurable with tier, must stay a separate axis permanently |
| Quality-judge 5-axis scores (1-5) | **KEEP-AS-IS** (different semantic) | `newsEconomicQuality` `is_low_quality` gate | none — this scores analysis quality, not event importance |
| Impact-audit `reach/severity/irreversibility/novelty` tags | **SEED OF THE CANONICAL RUBRIC** | SNS miss-alert only (job parked) | not a legacy scale to deprecate — this is the vocabulary §4's editorial rubric should formally adopt registry-wide, promoting it out of QA-only use |
| `velocity`, `escalating`, `x_trending` | **NOT SCALES** | breaking-alert composite input; situation FSM transition logic | raw signals, excluded from this table by design (VERIFY §B) — do not wrap these in a bounded scale later without a reason |

## §5 Quality/confidence marks

One shape, `evidence{}`, attached to any claim the system makes about an event: outlet list
(corroboration), source-robustness verdict, judge verdicts (quality-judge axis, §4), verification
state (Admiralty/CAP-style, where the verify-agent design lands per `IMPACT_FIRST` §5). This is
the container for "how sure are we," kept separate from "how much does it matter" (§4) and "how
likely is the forecast" (predictions, §4's KEEP-AS-IS row) — three different questions, never
merged into one number.

## §6 Time — two legitimate lifecycles

Per VERIFY §D (correcting the flat "editorial has no lifecycle" claim), there are **two real
lifecycle patterns**, each legitimate in its own scope, meeting at the event via the §2 identity
bridge:

1. **The world lifecycle (situation state machine).** Scope: the map/situation pipeline.
   `emerging → escalating/cooling → closed`, a genuine per-entity FSM with transition history
   (`appendHistory`), archived to `situations/archive/<id>.json` on close. This is what "is this
   still happening" means for a situation.
2. **The narrative lifecycle (staging → latest → archive + drift/correction log).** Scope: the
   editorial pipeline. Not a per-entity state machine — a pipeline-stage progression
   (`staging → latest → today-archive → archive#YYYY-MM-DD`) plus **thread accretion**
   (`continues_topic` links a new topic back to a prior one — append-only growth, not states)
   plus a **genuine change-log** (`newsDriftCorrector`'s `DRIFT#`/`DRIFTLOG#` records, written
   whenever a thread's conclusion changes). This is what "has our understanding of this changed"
   means for a thread.

Neither lifecycle should be forced into the other's shape. A situation closing does not mean a
thread is "done" (analysis may continue to be revised via drift notes after the acute phase
ends); a thread accreting new topics does not mean the situation is still escalating. They are
read together, at the event, via the `storyId ↔ threadId` link (§2), not merged into one FSM.

## §7 The guardrail law

**No new IDs, no new scales, no new taxonomies — extend this model or don't ship.** Any change
that would add a fifth identity root, a ninth importance scale, or a fourth type-classification
system is out of bounds by default; the bar to clear is proving the existing model cannot be
extended to cover the new need, not that a new one is more convenient to build.

**Where this doc sits:** this is the **semantic source of truth** — what an event is, what
identifies it, what it's worth, when it starts and ends. `ARCHITECTURE.md` is the **implementation
source of truth** — Lambda inventory, DDB schemas, S3 prefixes, IAM. When the two disagree:
this doc wins on **meaning** (what a field means, what identity it belongs to, whether a scale
should exist), `ARCHITECTURE.md` wins on **machinery** (how a field is stored, which Lambda writes
it, what the IAM policy says). Neither overrides `DATA_STRATEGY.md`'s S3-world/DDB-user split,
which this doc does not touch (`rules/DATA_STRATEGY.md`).

## §8 Convergence sequence

**Done:**
1. Fingerprint (`iso3`/`actors`/`event_type`) emission — Phase 1b, shipped 2026-09-11.
2. Coverage/false-positive measurement (URL tier ~32% at 0 FP; R3 fingerprint tier +3.7pts at 0 FP
   on backfill, pending real-tag re-confirmation).
3. Matcher — Tier 1 URL-exact live (`NewsProjectInvokeAgentLambda` writes `threads/story-map.json`,
   the tracker stamps `threadId`); Tier 2 R3 off (`ENABLE_R3_TIER` unset).

**Next:**
4. **Registry impact record** — attach the §4 typed-impact fields (measured-domain inputs +
   universal counts + tier) directly onto registry (`stories/`) entries, so the registry carries
   not just identity but importance.
5. **Editorial-selects-from-registry** = `EVENT_REGISTRY_PLAN.md` Phase 2 ≡ `IMPACT_FIRST` P3 —
   the single point where the two pipelines' identity roots become one by construction. **Shadow-
   gated**: `newsSelectionShadow` runs the layered selector 3×/day since 2026-10-18 and writes
   `audit/selection-shadow/` (plans/PLAN_2026-10-22_forecast_loop.md P7c); flip only
   on quality parity after the shadow week.
6. **Surfaces render canonical marks on next touch** — no big-bang UI migration; each surface
   adopts tier/evidence/fingerprint fields the next time it's touched for another reason.
7. Home swap — done 2026-10-01 (decisions/0016).

**Known gaps (do not let convergence work hide these):**
- **Population** (disaster reach): no field anywhere in the GDACS ingest; not a parsing bug, the
  feed doesn't carry it.
- **Fatalities** (conflict/humanitarian severity): no per-event field; only ACLED country-level
  30-day counts (`newsCountryFactsUpdater`, 12 countries). ReliefWeb + INFORM Severity Index
  (open, no key) not wired. Any impact-record work that ships before these are wired must render "no data"
  for these fields, never a judged substitute presented as measured.

