# World Model Fragments — catalogue of scattered concepts (2026-09-14)

Dated terrain snapshot (2026-09-14) — current semantics live in `WORLD_MODEL.md`.

**Status: terrain map for consolidation — no code changes proposed.** This document does not
recommend building anything. It inventories every place the codebase produces the same-or-related
concept in more than one location, and classifies the relationship between the instances so a
later consolidation decision has evidence to work from.

Grounded in `project-docs/architecture/WORLD_MODEL.md` (ontology + D1/D2 operator decisions),
`project-docs/architecture/IMPORTANCE_SCALE_MAPPING.md` (importance-scale feasibility study), and
direct grep/read of `amplify/backend/function/*/src/` and
`global-perspectives-starter/frontend/src/` on 2026-09-14. All citations are file:line as read
this date; anything I could not verify directly is flagged "UNVERIFIED" rather than guessed.

## Legend

- **TRUE-MERGE** — same concept, independently produced in two places; can collapse to one source
  (a shared module, a single writer, or literal deduplication).
- **SERIAL** — B is (or could be) a pure function of A; keep A as the single upstream source of
  truth and compute/derive B from it. The write-up names which side is upstream.
- **DISTINCT** — different question or axis; no merge, no derivation; collapsing them would lose
  real information the system currently keeps.

---

## 1. IDENTITY

### 1.1 storyId vs topicId/threadId vs the foreign-keyed records

**Instances:**
- `storyId` = `${axis}#${iso3}#${slug(entity)}` — map/situation pipeline's own key.
  `amplify/backend/function/newsSituationIngest/src/classifier-core.js:124-146` (clusterStories
  builds it; comment at L124 "storyId is stable across runs so velocity/spread accumulate").
  `situationId` wraps it: `news#${storyId}` for news-sourced situations, `gdacs#${eventKey}` for
  GDACS-sourced ones (per WORLD_MODEL.md §2, confirmed by `LEVEL_TIER`/situation-building code in
  `newsSituationTracker/src/situations-core.js:234-263`).
- `topicId`/`threadId` — editorial pipeline's own key.
  `amplify/backend/function/newsInvokeGemini/src/index.js:723` (`createStableTopicId`), `:737-738`
  (`continues_topic` accretion), `:760-761` (`id: topicId, topicId`).
- `PRED#${topic.id}` — PredictionLog PK, foreign-keyed onto `topicId`.
  `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:848`.
- `ECON#THREAD#${threadId}` — economic-impact record PK, foreign-keyed onto `threadId`.
  `amplify/backend/function/newsEconomicImpact/src/index.js:14,46`; also read in
  `newsBreakingAlert/src/index.js:120`, `newsSignals/src/index.js:148`,
  `newsSensitiveData/src/index.js:1091,1119,1159`.
- `PAIR#${slug}` — pair-intelligence PK, its own key over a country-pair, not a per-event key.
  `amplify/backend/function/newsPairIntelligence/src/index.js:28`.
- `COUNTRY#${name}` — country-intelligence PK, keyed by country name, not by event.
  `amplify/backend/function/newsCountryIntelligence/src/index.js:28`; also
  `newsDriftCorrector/src/index.js:33`, `newsBreakingAlert/src/index.js:111`.
- `SYSTEMS#${countryName}` — systems-analysis PK, also country-keyed.
  `amplify/backend/function/newsSystemsAnalysis/src/index.js:21`.
- `threads/story-map.json` — the bridge. `amplify/backend/function/NewsProjectInvokeAgentLambda/src/matcher.js:4-53`:
  "Builds a storyId → { threadId, tier, evidence } map linking MAP stories … to EDITORIAL threads
  … via two tiers" (URL-exact + fingerprint); one S3 object, one writer
  (`newsSituationTracker/src/index.js` also references it as a consumer/co-writer per grep).

**Verdicts:**

- **storyId ↔ topicId/threadId: SERIAL (bridged, not merged) — upstream is neither, the bridge
  itself is the derived join).** These are two independently-generated identity roots for what is
  conceptually the same event, produced by two pipelines that don't share a spine (WORLD_MODEL.md
  §2 states this directly: "not five, not one," "no join key between them"). The matcher
  (`matcher.js`) computes `story-map.json` as a pure function of both pipelines' output
  (URL-overlap + iso3/actor fingerprint) — that map is a derived artifact, not a merge of the two
  IDs into one. Today this is the closest thing to SERIAL in the codebase, but it's SERIAL onto a
  *pairing*, not onto a single source of truth — until Phase 2 (editorial selects from the
  registry) ships, neither storyId nor threadId is upstream of the other; each is upstream of its
  own pipeline's downstream records. WORLD_MODEL.md §2's own stated end-state — "editorial topics
  generated *from* registry stories… storyId becomes the one identity and threadId becomes a
  derived grouping over it" — is exactly a SERIAL relationship, just not yet built. **Verdict as
  the system stands today: not yet TRUE-MERGE, not yet fully SERIAL — a bridge table standing in
  for a future SERIAL relationship.** Do not treat `story-map.json` as proof the two IDs are
  already unified; it is a join, not a foreign key.

- **PRED#{topicId}, ECON#THREAD#{threadId}: SERIAL, upstream = topicId/threadId.** These are
  already correctly foreign-keyed onto the editorial identity root, exactly as WORLD_MODEL.md §2
  asserts ("already correctly foreign-keyed… not independent spaces and are not fragmentation to
  fix"). Confirmed directly: `PRED#${topic.id}` at `NewsProjectInvokeAgentLambda/src/index.js:848`
  and `ECON#THREAD#${threadId}` at `newsEconomicImpact/src/index.js:14`. No action implied — this
  is the pattern every new aspect-record should follow, not a fragment to resolve.

- **PAIR#{slug}, COUNTRY#{name}, SYSTEMS#{name}: DISTINCT identity grains.** These are not
  per-event identities at all — they're keyed by country or country-pair, a coarser and
  orthogonal grain to "one event." A country can host many events (many threadIds/storyIds); a
  pair intelligence record spans two countries' whole relationship, not one event. Collapsing
  these into the event-identity graph would conflate "what happened" with "who this analysis is
  about" — genuinely different questions. Keep separate.

### 1.2 Fingerprint fields (iso3/actors/event_type) as join evidence, not identity

**Instances:** emitted by both pipelines — `newsInvokeGemini/src/index.js:651-653` (topic
fingerprint: `iso3`, `actors`, `event_type`) and `newsSituationIngest/classifier-core.js` (story
fingerprint, same field names, feeding `matcher.js`'s `iso3Set`/`actorSet` at
`matcher.js:41,48`).

**Verdict: DISTINCT from identity (by design) — not itself a fragment to fix.** WORLD_MODEL.md §2
is explicit that these are "the cross-root join evidence, not an identity itself." They are
correctly duplicated-by-necessity: both pipelines must independently observe the same real-world
facts (which countries, which actors) for the matcher to have anything to compare. This is not
two producers disagreeing about one fact — it's two independent observations of the same
underlying reality, which is exactly what a matching/bridging design requires. No merge target
here; flagging only because the catalogue should show it was considered.

---

## 2. TYPE / TAXONOMY

**Instances:**
- `axis` (4 values: `conflict, political, economic, humanitarian`) — situation classifier's hue.
  `newsSituationIngest/src/classifier-core.js:12` (`const AXES = new Set([...])`).
- `event_type` (11 values: `war, unrest, diplomacy, election, policy, economy, markets, disaster,
  health, tech, other`) — classifier's category enum, adopted into the editorial fingerprint.
  `newsInvokeGemini/src/index.js:653` ("event_type: string, exactly one of: war, unrest,
  diplomacy, election, policy, economy, markets, disaster, health, tech, other");
  `:756-757` (validated against `EVENT_TYPES` set before acceptance).
- `iso3[]` / `actors[]` — see §1.2 above; a facet (who/where), not a type.
- editorial `category` — 12 editorial display categories.
  `newsInvokeGemini/src/index.js:28` (`const VALID_CATEGORIES = [...]`, values per
  WORLD_MODEL.md §3: `politics, economy, military, conflict, disaster, technology, health, climate,
  science, business, society, energy`); validated at `:813` (`categoryValid =
  VALID_CATEGORIES.includes(t.category)`).
- signal API `type` — `amplify/backend/function/newsSignals/src/signalAdapter.js`, four literal
  values: `'economic_impact'` (L188), `'forecast'` (L238), `'geopolitical_risk'` (L258),
  `'breaking'` (L292).

**Verdicts:**

- **`axis` ↔ `event_type`: DISTINCT — two orthogonal axes of the same canonical taxonomy, not
  duplicates of each other.** WORLD_MODEL.md §3 states this directly: "The taxonomy is two axes,
  not three… `axis` (4 values)… `event_type` (11 values)… These two together are THE canonical
  type system." `axis` answers "what hue/display bucket," `event_type` answers "what kind of
  event specifically" — a war is always `conflict`-axis but an `event_type` of `war`; an election
  is `political`-axis, `event_type: election`. Collapsing to one would either lose the coarse
  display grouping or the fine classifier detail. Correctly kept as two fields on one record, not
  two competing type systems.

- **Editorial `category` (12 values) ↔ `event_type`/`axis`: SERIAL where the mapping is clean,
  ambiguous-but-still-SERIAL-in-intent where lossy.** WORLD_MODEL.md §3's mapping table shows 7 of
  12 categories map cleanly onto `event_type`/`axis` pairs (e.g. `military→war/conflict`,
  `economy→economy/economic`). This is a genuine SERIAL relationship in principle: `category`
  *could* be a pure display-layer function of `event_type`+`axis` (or a hint at story-generation
  time), with `event_type`/`axis` as the upstream canonical fields. The catch, confirmed by
  reading the actual field definitions: `category` is validated as its own free-standing enum at
  generation time (`VALID_CATEGORIES.includes(t.category)`, `index.js:813`) — it is NOT currently
  computed from `event_type`; both are independently emitted by the same LLM call in the same
  prompt (`event_type` at L653, `category` implied elsewhere in the same topic schema). So today
  this is **two independently-produced fields that SHOULD be SERIAL (category derived from
  event_type+axis) but currently are not** — a "SERIAL-eligible, not-yet-SERIAL" case. Upstream
  should be `event_type`+`axis` (the classifier vocabulary, narrower and betterspecified); the 5
  lossy categories (`science, climate, society, technology, energy`) are exactly the cases where a
  clean function doesn't exist yet, per WORLD_MODEL.md §3's own override table (flagged
  NEEDS-OPERATOR-REVIEW there, unchanged by this doc).

- **Signal API `type` (economic_impact/forecast/geopolitical_risk/breaking): DISTINCT from
  event_type/axis — this is a source-domain/record-shape tag, not a topic classification.** It
  labels *which upstream record type* produced this signal envelope (an econ-impact record vs a
  prediction vs a country-risk record vs a breaking-alert), which is a schema/provenance
  dimension, not a "what kind of world event is this" dimension. A `geopolitical_risk` signal and
  a `breaking` signal can both describe the very same underlying event/axis/event_type — they
  differ in which pipeline emitted the record, not in what happened. Correctly kept separate from
  `axis`/`event_type`.

- **`iso3[]`/`actors[]`: DISTINCT** — see §1.2. Facets (who/where), never a type value.

---

## 3. IMPORTANCE / SEVERITY SCALES

### 3.1 The canonical tier — thread-level vs country-level dimensions

**Instances:** `amplify/backend/function/newsThreadAnalysis/src/riskDimensions.js` (57 lines) and
`amplify/backend/function/newsCountryIntelligence/src/riskDimensions.js` (57 lines) — **confirmed
byte-identical** (`diff` returns empty, exit 0). Both export `AXES, clampScore, tierFromScore,
normalizeDimensions, deriveRisk` (module exports at L57 of each). Each Lambda calls its own LLM
prompt with the same 4-axis rubric:
- `newsCountryIntelligence/src/index.js:487-492` — "dimensions… scoring this country's CURRENT
  risk across four INDEPENDENT axes… conflict/political/economic/humanitarian… (riskScore and
  riskLevel are derived from these — do NOT output them separately.)"
- `newsThreadAnalysis/src/index.js:263` — "dimensions… scoring THIS thread's current risk across
  four INDEPENDENT axes… conflict/political/economic/humanitarian… (riskScore is derived from
  these — do NOT output it separately.)"

Each Lambda then calls the shared `deriveRisk(dimensions)` (worst-axis rule) independently:
`newsCountryIntelligence/src/index.js:534-538`, `newsThreadAnalysis/src/index.js:302-305`. Country
score is NOT an aggregate of its threads' scores — `newsCountryIntelligence/src/index.js:148-208`
shows the country pipeline *reads* thread analyses (`analyses[threadId] = Item`,L157) to build
context for its prompt, but the risk `dimensions` themselves come from a **fresh independent LLM
call** (`invokeGrok(prompt)` at L498, same pattern as thread's own L271) — the thread analyses are
input context, not a roll-up formula.

**Verdicts — two separate fragments here, don't conflate them:**

- **The `riskDimensions.js` MODULE (code: `AXES`/`clampScore`/`tierFromScore`/`normalizeDimensions`/
  `deriveRisk`): TRUE-MERGE.** Byte-identical, hand-synced, no divergence found. This is pure
  logic duplication with zero semantic content difference — exactly the shared-module case. A
  single Lambda Layer (or a shared `layers/` package, given "manual-deploy repo has no Lambda
  layers" per the `situations-core.js` header comment at L1-2, so this would be new
  infrastructure) collapses it to one source with zero behavior change.

- **The country-level RISK JUDGMENT vs the thread-level RISK JUDGMENT (the actual `dimensions`
  values written per record): DISTINCT, not SERIAL.** Despite sharing a formula and a prompt
  template, these are **independently-produced judgments at genuinely different grains** — "how
  severe is this specific thread" is not deterministically a function of "how severe is this
  country," and the code confirms the country score is not computed by aggregating thread scores
  (no roll-up formula found; it's a fresh LLM judgment that merely *reads* thread analyses as
  background context, same as it reads country_facts.json). A war country can have one severe
  thread and otherwise-calm baseline politics (country score should reflect the whole country, not
  just its worst thread) and vice versa. Forcing country-score to be a pure function of
  thread-scores (true SERIAL) would need a defined aggregation rule (max? weighted average?) that
  does not exist today and was evidently not the design choice made — the country pipeline chose
  independent judgment instead. Keep as two separate judgments sharing one governed vocabulary and
  one derivation formula (the TRUE-MERGE item above), but not the same number.

### 3.2 Situation classifier severity + GDACS level → tier (ALREADY-ABSORBED)

**Instances:**
- Classifier severity, int 1-5: `newsSituationIngest/src/classifier-core.js:25` (prompt: "severity:
  integer 1-5"), `:64` (clamp), consumed by `SEV_TIER` at
  `newsSituationTracker/src/situations-core.js:236` (`{5:'high',4:'elevated',3:'moderate',2:'low',
  1:'low'}`), applied at `:248` (`SEV_TIER[story.max_severity]`).
- GDACS level (Orange/Red/Green): folded via `LEVEL_TIER` at `situations-core.js:21`
  (`{Red:'high', Orange:'elevated', Green:'low'}`), applied at `:131`.
- Canonical tier consumer: `global-perspectives-starter/frontend/src/utils/riskTiers.js:22`
  (`tierFromScore`), `:35` (`tierFromLevel`), `:96` (`headlineFromDimensions`), `:120`
  (`deriveHeadline`).

**Verdict: SERIAL, upstream = classifier severity / GDACS level; tier is the derived display
value — already implemented this way, confirmed by reading the code, not just trusting the doc.**
`SEV_TIER`/`LEVEL_TIER` are literal lookup tables mapping the raw measured/judged value to the
tier vocabulary at write time; the raw int/level is not discarded (kept in `evidence.gdacs_level`
per WORLD_MODEL.md §4) but the frontend never sees anything but the tier. This matches
WORLD_MODEL.md §4's "ALREADY-ABSORBED" status for both rows — verified directly rather than
copied.

### 3.3 Editorial `significance` (backend-only, LinkedIn-sort consumer)

**Instances:** produced `newsInvokeGemini/src/index.js:617` (prompt rule 8, "SIGNIFICANCE =
MATERIAL IMPACT"), `:645` (schema: `"high"/"medium"/"low"`), `:774` (write, **no membership
validation** — any LLM string passes through lowercased, unlike `urgency` which IS validated at
`:741`). Sole confirmed consumer: `newsPostLinkedin/src/index.js:171-174`,
`SIGNIFICANCE_ORDER = {high:0,medium:1,low:2}` sorting the LinkedIn auto-post queue.

**Verdict: SERIAL-ELIGIBLE BUT NOT YET SERIAL — blocked on a missing upstream field, per
IMPORTANCE_SCALE_MAPPING.md §1/§4, confirmed by re-checking the topic schema myself.** The topic
object as written (`newsInvokeGemini/src/index.js:760-776`) carries no numeric score or
`dimensions` vector — only the two enums plus category/regions — so there is nothing for
`tierFromScore`/`headlineFromDimensions` to consume at the topic grain (`riskTiers.js:22-30,
96-128` both require a numeric score or a dimensions vector as input; a bare `high/medium/low`
string satisfies neither). `significance` therefore cannot be derived from the canonical tier
today without new backend work attaching a score to topics. It is a candidate SERIAL derivation
(WORLD_MODEL.md D2 wants it to eventually derive from the tier) but as implemented right now it is
an independent, weakly-validated field with one load-bearing consumer (the LinkedIn poster is
confirmed live — `IMPORTANCE_SCALE_MAPPING.md` §3 verified the `InvokeLinkedIn` schedule enabled
2026-09-12). Treat as: **not mergeable today; SERIAL only after the registry/topic-score
prerequisite (WORLD_MODEL.md §8 step 4) ships.**

### 3.4 Editorial `urgency` (tempo, not severity)

**Instances:** `newsInvokeGemini/src/index.js:646` (prompt: "high = breaking/escalating in last
24h, medium = developing story, low = background/slow-moving"), `:741-742` (validated against
`['high','medium','low']`, unlike `significance`), consumed at 5 frontend sites per
IMPORTANCE_SCALE_MAPPING.md §3 (`composeTopicsLede.js:65-83`, `Home.jsx:446`,
`WorldMapV2.jsx:564-583`, `CountryPage.jsx:326-400,865`, `ThreadPage.jsx:478-479`) — read directly
to confirm those citations exist as described; not re-verified line-by-line beyond spot-checking
the producer.

**Verdict: DISTINCT.** `urgency` answers "how fast is this moving right now" (a time-derivative /
tempo question); the canonical tier answers "how severe is this on a standing scale." These are
genuinely different axes — a story can be low-severity but extremely fast-moving (a sudden but
minor diplomatic flare-up), or high-severity but slow-moving (a grinding, long-standing conflict
at a steady state). WORLD_MODEL.md's own D2 text initially expected this to merge into the tier;
IMPORTANCE_SCALE_MAPPING.md's code-grounded study corrected that (§1: "not the same question…
these are different axes… merging them loses information") and this catalogue confirms that
correction by re-reading the same producer/consumer code — no new contradiction found. Keep
separate, labeled as tempo.

### 3.5 Breaking-alert `score` (decision gate, consumes the tier as one input)

**Instances:** `amplify/backend/function/newsBreakingAlert/src/significance.js:1-95+` — weighted
sum: `WEIGHTS = {popularity:1.0, breadth:1.0, risk:1.0, economic:1.5, velocity:1.5}` (L21-27),
threshold `SIGNIFICANCE_THRESHOLD = 2.0` (L30), continuation multiplier `1.8` (L36). The `risk`
input is explicitly the capped country `riskScore`: `RISK_CAP = 50` (L69), comment at L64-68 ("A
*STANDING* posture, not event evidence… Cap the contribution at 0.5 so risk only TILTS the
decision"). Also folds in `econMagnitude` (economic severity, §3.6) and `sourceCount`/`topicCount`
(universal counts, not a scale). Category→risk-axis join at L74-80 (`CATEGORY_AXIS`) — picks WHICH
of the 4 risk dimensions a story's category should feel, per the scoring-v2 fix mentioned in the
comment ("Fixes the country-risk dominance bug").

**Verdict: SERIAL on multiple inputs — but the score ITSELF is not a display scale and must stay a
gate, not a merge target.** It literally consumes the canonical risk score as one weighted,
capped input (confirmed: `risk(riskScore)` at L69-70 reads `Min(riskScore,50)/100`), so in the
strict sense "is B a function of A" the breaking score is SERIAL-downstream of the country-risk
tier (among other upstreams: source count, topic count, economic magnitude, velocity — none of
which are themselves the tier). But this is a *combiner*, not a *duplicate representation* of any
one upstream — there is no single A of which this score is a pure derivation; it's a genuine
composite decision function over several distinct upstream signals. Matches WORLD_MODEL.md §4's
"KEEP-AS-IS" verdict, confirmed correct by reading the actual weight/cap logic: collapsing this
into the 4-bucket tier would destroy the graduated threshold behavior (`SIGNIFICANCE_THRESHOLD`,
`CONTINUATION_THRESHOLD_MULT`) that the alert gate depends on. Classify as: **DISTINCT as a
displayed concept (it's never shown as a rating), SERIAL only in the narrow sense that one of its
several inputs derives from the canonical tier.**

### 3.6 Economic-impact `severity`/`severityScore`

**Instances:** `amplify/backend/function/newsEconomicImpact/src/index.js:457` (band assignment),
banding/clamp logic ~L93-97, evidence-downgrade state machine ~L652-664 (per
IMPORTANCE_SCALE_MAPPING.md citation, re-confirmed present in file). Feeds into the breaking-alert
score as `econMagnitude` (§3.5) and is read by `newsSignals/signalAdapter.js:188-200`
(`type: 'economic_impact'`, `severity: rec.severityScore`).

**Verdict: DISTINCT.** This measures market-movement magnitude (a specific, governed,
evidence-downgraded state machine over instrument price/volume data), not general event
importance. WORLD_MODEL.md §4 keeps this explicitly separate ("KEEP-AS-IS… its own measure — it
may *report into* the tier for display but is not collapsed away"). Confirmed by inspection: the
downgrade state machine (thin winners/losers, low-confidence clamps per the doc) is
domain-specific logic with no equivalent in the 4-axis `riskDimensions.js` rubric — collapsing it
would discard the market-specific evidence trail. Keep separate; may continue to feed the tier or
the breaking score as an *input*, never be absorbed as identical.

### 3.7 Prediction probability / confidence

**Instances:** `NewsProjectInvokeAgentLambda/src/index.js:483,493,500,516` (`probability_range`,
three-scenario schema summing to ~100%); confidence via `signalVsNoise.confidence` (`:408`,
High/Medium/Low) in the causal-explanation schema (a separate field from prediction probability,
also worth noting doesn't itself feed forecasts).

**Verdict: DISTINCT.** Likelihood is not commensurable with importance — a near-certain
(90%-probability) trivial outcome and a highly uncertain (30%-probability) catastrophic one are
not on the same axis. WORLD_MODEL.md §4 and §5 both name this explicitly as a permanent separate
axis ("this is likelihood, not impact… must stay a separate axis permanently"). No contradicting
evidence found; confirmed correct.

### 3.8 Trace-cause `impactScores` (3-axis, 1-10)

**Instances:** `NewsProjectInvokeAgentLambda/src/index.js:405` (schema:
`{humanImpact, economicReach, geopolitical}`, "integer 1-10 each"), no clamp/normalization
function found near the definition (only the prompt-level "integer 1-10 each" instruction at
L419-420) — confirmed no shared `clampScore`-style helper is applied to these three fields, unlike
`riskDimensions.js`'s governed 0-100 axes.

**Verdict: DISTINCT — an ungoverned, differently-scaled sibling of the canonical dimensions, not a
duplicate of them.** The axis *names* are suggestively close to the canonical
conflict/political/economic/humanitarian set (`humanImpact`≈humanitarian, `economicReach`≈economic,
`geopolitical`≈political+conflict blended) but the scale (1-10 vs 0-100), the calibration language
(none vs riskDimensions.js's explicit "0-24=low…75-100=severe" per-axis calibration prose,
`newsCountryIntelligence/src/index.js:492`), and the consumer (only the on-demand Trace-the-Cause
panel, `TraceCauseDisplay.jsx` per IMPORTANCE_SCALE_MAPPING.md §2, not re-verified line-by-line
here but the isolation claim is consistent with grep — no other consumer found) are all
independent. This is the closest thing in the codebase to a *near-miss* TRUE-MERGE — a future
SERIAL relationship (rescale `impactScores` from the canonical `dimensions`) is plausible, but
today it is an independently-invented, differently-shaped rubric feeding one isolated feature.
Mark KEEP-AS-EXCEPTION per WORLD_MODEL.md §4, DISTINCT for this catalogue's purposes, with a note
that it is the most "ungoverned" of the exceptions and the best candidate if the operator later
wants to reduce scale count further.

### 3.9 Signal API `severity`/`severity_band` — the existing normalization prototype

**Instances:** `amplify/backend/function/newsSignals/src/signalAdapter.js:16-18` (header comment:
"Internally severity/confidence are expressed five different ways (probability, severityScore,
riskScore, confidence enum, sentiment). The envelope collapses them to…"), `:38`
(`function severityBand(score)`), applied per-type: economic (`:200`, `rec.severityScore`),
forecast (`:246`, explicitly `severity: null` — "a forecast isn't a severity; confidence carries
the weight" — the adapter itself enforces the DISTINCT verdict from §3.7 in code), geopolitical
(`:269`, `rec.riskScore`), breaking (`:300`, `scoreToSeverity(rec.score)` with a documented
squash: "breaking significance score (~0-5) → 0-100 severity band, squashed at 5≈100" at `:313`).

**Verdict: SERIAL — this IS the existing derivation layer, upstream = each source record's own
native scale; `severityBand`/`severity` are the downstream normalization.** The adapter is a live,
already-shipped instance of exactly the kind of SERIAL relationship the rest of this catalogue
recommends elsewhere: it does not re-judge severity, it maps four already-produced upstream values
(economic severityScore, geopolitical riskScore, breaking's composite score, and a
deliberately-null forecast field) into one 0-100 band for external signal-API consumers, with the
forecast case correctly refusing to fabricate a severity where none exists. This is the pattern to
generalize, not a fragment to fix — call this out explicitly as the prototype/precedent for any
future importance-scale consolidation, per its own header comment's framing.

### 3.10 Two things that are NOT importance — confirmed DISTINCT, not swept in

- **Economic quality (`newsEconomicQuality`):** 5-axis LLM judge —
  `amplify/backend/function/newsEconomicQuality/src/index.js:9-11` (header: "Parse 5-axis scores
  (coherence / citation_fidelity / analog_match / …)"), `LOW_QUALITY_THRESHOLD = 2` at L53,
  `is_low_quality` computed at L89 (`QUALITY_AXES.some(a => scores[a] <= LOW_QUALITY_THRESHOLD)`).
  This scores **how good the analysis is** (did the LLM cite correctly, is the historical analog
  real), not how important the underlying event is. A perfectly-written analysis of a minor story
  and a poorly-written analysis of a major war are orthogonal on this axis. **DISTINCT, confirmed.**

- **Recommendation relevance (`newsRecommend/src/scoring.js`):** `scoreItem` at L98,
  `buildInterestProfile`/`categoryOverlap`/`regionOverlap`/`recencyDecay`/`popularity` helpers
  (L28-117) — a personalization score over **one user's** interest profile vs a topic, not a
  global importance judgment; the same topic gets different scores for different users
  (`rankRecommendations(topics, profile, …)` at L121-129 takes a per-user `profile`). **DISTINCT,
  confirmed** — importance is a property of the event; relevance is a property of the
  (event, reader) pair.

---

## 4. DUPLICATED SHARED LOGIC

| Pair | Diff result | Verdict | Notes |
|---|---|---|---|
| `newsThreadAnalysis/src/riskDimensions.js` ↔ `newsCountryIntelligence/src/riskDimensions.js` | **Byte-identical** (`diff` empty, both 57 lines) | **TRUE-MERGE** | Pure logic (`AXES`, `clampScore`, `tierFromScore`, `normalizeDimensions`, `deriveRisk`), zero divergence. Clean shared-module candidate. |
| `newsSituationTracker/src/situations-core.js` ↔ `newsGdacsIngest/src/situations-core.js` | Only diff = a 2-line header comment present in the tracker copy, absent in the ingest copy ("⚠️ SHARED MODULE — keep byte-identical… Canonical: DATA_STRATEGY.md"); tracker=313 lines, ingest=311 lines, gap fully explained by the missing comment | **TRUE-MERGE** | Already self-documented as intended-identical by its own header; the file itself asserts the sync obligation. Confirms the discipline is being followed by hand. |
| `newsCountryIntelligence/src/country_facts.json` ↔ `newsPairIntelligence/src/country_facts.json` | Only diff = the `description` and `sync` metadata strings (each file's comment names the *other* file as its sync partner); underlying fact **data** not independently diffed field-by-field but the wrapper/metadata pattern indicates intentional mirroring | **TRUE-MERGE** | Same self-documenting sync pattern as situations-core.js. Confirmed at the wrapper level; did not byte-diff every fact entry — flagging as UNVERIFIED at the full-content level, though the pattern strongly implies identical intent. |
| `NewsProjectInvokeAgentLambda/src/entity-normalize.js` ↔ `newsSituationIngest/src/classifier-core.js`'s `normalizeEntity` | Not byte-identical (different files, one is a small dedicated module, the other embeds the same function inside a larger file) but the `entity-normalize.js` header **explicitly declares itself a manual port**: "port the change here too — the R3 fingerprint match depends on BOTH sides normalizing identically" (`entity-normalize.js:4-6`); both implement `function normalizeEntity(s)` with the same comment block ("Conservative entity-key normalization (audit F1 — storyId fragmentation)…") copied verbatim (`entity-normalize.js:9,18` vs `classifier-core.js:80,89`) | **TRUE-MERGE** | The two files are not identical in scope (classifier-core.js has 5 other exports) but the specific duplicated function is a documented, deliberate copy with an explicit correctness dependency (the R3 matcher needs both sides to normalize identically). Strong shared-module candidate — could extract just `normalizeEntity` into a tiny shared file without touching either host file's other logic. |
| `newsEmailSender/src/sendEmail.js` ↔ `newsBreakingAlert/src/sendEmail.js` | **Diverged** — `newsEmailSender`'s copy is a later, extended version: adds a `headers` param (for List-Unsubscribe/List-Unsubscribe-Post, RFC 8058) not present in `newsBreakingAlert`'s copy; `newsEmailSender`'s header comment explicitly says "Copied from `newsBreakingAlert/src/sendEmail.js` and EXTENDED with a `headers` param" | **TRUE-MERGE candidate that has already partially drifted** | This is the one pair where duplication has caused real skew: `newsBreakingAlert`'s emails cannot carry List-Unsubscribe headers that `newsEmailSender`'s can. Both still wrap the same single Resend provider call (`callers pass plain {from,to,subject,text,html(,headers)}`) — the underlying concept (provider-agnostic send) is identical, so this is still TRUE-MERGE in kind, but flag it as the one instance where NOT merging has already cost a real feature gap, not just hypothetical drift risk. |

---

## 5. LIFECYCLE / STATE

**Instances:**
- **Situation FSM** (`newsSituationTracker`/`newsGdacsIngest` `situations-core.js`): per-entity
  state machine with transitions `opened/raised/lowered/spread/unchanged/cooled` (comment at L9-13:
  "buildSituation / coolSituation — the FOLD: (prior situation state, observation) → next state");
  states themselves are `emerging/escalating/cooling/peak/closed` (inferred from `state: 'emerging'`
  L170, `'escalating'` L181/191, `'cooling'` L185/209/226, `prev.state || 'peak'` L194); archived on
  close per WORLD_MODEL.md §6 (`situations/archive/<id>.json`, not independently re-verified this
  pass but consistent with the FSM's `appendHistory` pattern seen at L169,180,189).
- **Editorial staging → latest → archive** (`NewsProjectInvokeAgentLambda/src/index.js`):
  `STAGING_ITEM_ID='staging'` (L24), `ACTIVE_ITEM_ID='latest'` (L25), `ARCHIVE_ITEM_ID=
  'today-archive'` (L42), `swapStagingToActive` at L871-892. Not a per-entity FSM — a pipeline
  stage progression over the whole batch, plus `continues_topic` accretion (append-only growth,
  not a state transition).
- **PredictionLog open → resolved**: `status: 'open'` written at
  `NewsProjectInvokeAgentLambda/src/index.js:861`, `status: 'active'` at `:881` (a second status
  value not previously catalogued in WORLD_MODEL.md's §6 — worth flagging as a possible 3rd/4th
  state not fully documented there), resolution scan at
  `newsPredictionResolver/src/index.js:58` (`ExpressionAttributeValues: {':open': 'open'}`,
  querying for open predictions to resolve).
- **Econ 21-day TTL**: `newsEconomicImpact/src/index.js:14` ("PK: ECON#THREAD#{threadId} SK:
  ECONOMIC_IMPACT (21-day TTL)") — a pure expiry, not a multi-state machine.

**Verdict: DISTINCT, all four — different lifecycle *shapes* answering different questions, none
serial on another, confirmed by reading the actual state-transition code rather than trusting the
WORLD_MODEL.md description alone.**

- The situation FSM (opened→raised/spread→cooled→closed) tracks **"is this still happening in the
  world"** — a real state machine with directional transitions and a fold function, scoped to the
  map/situation pipeline only.
- Editorial staging→latest→archive tracks **"where is this batch of topics in the publishing
  pipeline"** — a one-way pipeline-stage progression over the whole generation cycle, not a
  per-event state machine; `continues_topic` accretion is append-only growth, structurally
  different from a state transition (a topic never "returns" to a prior stage the way a situation
  can cool then re-escalate).
- PredictionLog open→resolved tracks **"has this specific forecast been checked against reality
  yet"** — binary-ish (open vs resolved, plus an `'active'` status whose relationship to `'open'`
  I could not fully resolve from the two grep hits alone — flagged UNVERIFIED, worth a follow-up
  read of the full prediction-write path before treating `open`/`active` as synonyms or as two
  real states).
- Econ TTL tracks **"how long is this record retained"** — not a semantic lifecycle at all, a
  storage/retention mechanism.

None of the four is a deterministic function of another: a situation closing doesn't resolve a
prediction, a staging→latest swap doesn't change a situation's state, and TTL expiry is orthogonal
to all three (WORLD_MODEL.md §6 makes the same point for situation-vs-narrative specifically:
"Neither lifecycle should be forced into the other's shape… read together, at the event, via the
storyId↔threadId link, not merged into one FSM" — confirmed consistent with the code read here).
Keep all four separate; the only fix-worth-flagging item is the `'open'`/`'active'` prediction
status pair, which deserves a dedicated read before this catalogue can say whether it's a real
2-state lifecycle, a naming inconsistency (bug), or two different record types being conflated —
**UNVERIFIED, not classified.**

---

## SUMMARY TABLE

| Fragment | Instances (short) | Verdict | Upstream (if SERIAL) |
|---|---|---|---|
| storyId ↔ topicId/threadId | classifier-core.js:124-146; newsInvokeGemini/index.js:723 | **Bridge today, SERIAL-in-intent** | Neither yet; `story-map.json` join; Phase 2 will make storyId upstream |
| PRED#{topicId}, ECON#THREAD#{threadId} | NewsProjectInvokeAgentLambda:848; newsEconomicImpact/index.js:14,46 | **SERIAL (already correct)** | topicId / threadId |
| PAIR#{slug}, COUNTRY#{name}, SYSTEMS#{name} | newsPairIntelligence:28; newsCountryIntelligence:28; newsSystemsAnalysis:21 | **DISTINCT** | — |
| iso3[]/actors[] fingerprint | newsInvokeGemini:651-653; classifier-core.js | **DISTINCT** (join evidence by design) | — |
| axis ↔ event_type | classifier-core.js:12; newsInvokeGemini:653 | **DISTINCT** (orthogonal facets of one taxonomy) | — |
| editorial category ↔ event_type/axis | newsInvokeGemini:28,813 vs :653 | **SERIAL-eligible, not yet built** | event_type + axis (for the 7 clean mappings) |
| signal API `type` | signalAdapter.js:188,238,258,292 | **DISTINCT** (provenance tag, not classification) | — |
| riskDimensions.js (module, country vs thread) | byte-identical, 57 lines each | **TRUE-MERGE** | — |
| riskDimensions.js (judgment, country vs thread) | index.js:487-538 (country) vs :263-305 (thread) | **DISTINCT** (independent LLM judgments, no roll-up formula found) | — |
| classifier severity + GDACS level → tier | classifier-core.js:25,64; situations-core.js:21,236 | **SERIAL (already implemented)** | classifier severity / GDACS level |
| editorial `significance` | newsInvokeGemini:617,645,774; newsPostLinkedin:171-174 | **SERIAL-eligible, blocked on missing topic score** | canonical tier (once topics carry a score) |
| editorial `urgency` | newsInvokeGemini:646,741-742; 5 frontend sites | **DISTINCT** (tempo, not severity) | — |
| breaking-alert score | significance.js:21-95 | **DISTINCT as displayed; SERIAL only on its `risk` input** | country riskScore (one of 5 weighted inputs) |
| economic severity/severityScore | newsEconomicImpact/index.js:457,93-97,652-664 | **DISTINCT** | — |
| prediction probability/confidence | NewsProjectInvokeAgentLambda:483,493,500,516,408 | **DISTINCT** | — |
| trace-cause impactScores | NewsProjectInvokeAgentLambda:405,419-420 | **DISTINCT** (near-miss; ungoverned sibling) | — |
| signal API severity/severity_band | signalAdapter.js:16-18,38,200,246,269,300,313 | **SERIAL (already the prototype derivation layer)** | each source record's native scale (severityScore/riskScore/score); forecast correctly null |
| economic quality (5-axis) | newsEconomicQuality/index.js:9-11,53,89 | **DISTINCT** | — |
| recommendation relevance | newsRecommend/scoring.js:98,121-129 | **DISTINCT** (per-user, not global) | — |
| riskDimensions.js file | newsThreadAnalysis vs newsCountryIntelligence | **TRUE-MERGE** | — |
| situations-core.js file | newsSituationTracker vs newsGdacsIngest | **TRUE-MERGE** | — |
| country_facts.json file | newsCountryIntelligence vs newsPairIntelligence | **TRUE-MERGE** (metadata-level; data not fully diffed) | — |
| normalizeEntity function | entity-normalize.js vs classifier-core.js | **TRUE-MERGE** | — |
| sendEmail.js file | newsEmailSender vs newsBreakingAlert | **TRUE-MERGE, already drifted** (headers param) | — |
| situation FSM | situations-core.js:9-13,170-226 | **DISTINCT** | — |
| editorial staging/latest/archive | NewsProjectInvokeAgentLambda:24,25,42,871-892 | **DISTINCT** | — |
| prediction open→resolved(→active?) | NewsProjectInvokeAgentLambda:861,881; newsPredictionResolver:58 | **DISTINCT from other lifecycles; internal open/active split UNVERIFIED** | — |
| econ 21-day TTL | newsEconomicImpact/index.js:14 | **DISTINCT** (retention, not lifecycle) | — |

---

## What this implies for consolidation

**Quick wins — TRUE-MERGE via a real shared module (low risk, no semantic change):**
`riskDimensions.js` (byte-identical already), `situations-core.js` (byte-identical already,
self-documented sync obligation), `country_facts.json` (metadata confirms intent, worth a full
data diff before merging), `normalizeEntity` (small, explicitly-documented port). These four cost
nothing to consolidate semantically — the hard part is purely infrastructural (this repo has no
Lambda layers per the `situations-core.js` header comment, so "merge" means introducing a
shared-package/layer mechanism, not a data-model change). `sendEmail.js` is the same category but
should be resolved first at the feature level (does `newsBreakingAlert` need List-Unsubscribe
headers too?) before mechanically merging, since a naive merge either removes a feature from
`newsEmailSender` or silently adds one to `newsBreakingAlert`.

**Real architectural moves — SERIAL derivations that need one writer, not a quick copy-paste
fix:**
1. **storyId ↔ threadId** is the big one: today it's a bridge (`story-map.json`), not a true
   SERIAL relationship. WORLD_MODEL.md §8's Phase 2 (editorial selects from the registry) is the
   actual fix, and it's explicitly gated on other prerequisites (a hand-labeled reference set,
   shadow-week validation) — this catalogue confirms nothing has shipped yet, don't act on this as
   if it's closer than it is.
2. **Editorial `category` → `event_type`/`axis`** could become a real derived display mapping for
   the 7 clean cases today, with the 5 lossy cases needing the operator ruling WORLD_MODEL.md §3
   already flags as NEEDS-OPERATOR-REVIEW. This is buildable independently of the storyId/threadId
   work.
3. **Editorial `significance` → canonical tier** is blocked on the same prerequisite as (1) in
   spirit (attaching a score to the topic pipeline) — don't schedule it as a quick fix; it's part
   of the registry-impact-record work (WORLD_MODEL.md §8 step 4).
4. **The signal API's `severityBand` normalization (`signalAdapter.js`) is the existing
   worked example of what a SERIAL derivation layer looks like** — cite it as the reference pattern
   rather than re-inventing one, if/when the topic-level tier work above gets built.

**Leave alone — DISTINCT, would lose information if merged:** `urgency` (tempo vs severity),
breaking-alert score as a displayed concept (decision gate, not a rating), economic severity
(market magnitude), prediction probability (likelihood), trace-cause `impactScores` (isolated,
differently-scaled, low-stakes to leave as-is), economic quality (analysis quality, not event
importance), recommendation relevance (per-user, not global), all four lifecycle patterns, and the
country-vs-thread risk *judgments* (share a formula, not a value). The one loose end worth a
follow-up read before closing this catalogue out: whether PredictionLog's `'open'` and `'active'`
statuses are the same state under two names or a real second stage — UNVERIFIED here.
