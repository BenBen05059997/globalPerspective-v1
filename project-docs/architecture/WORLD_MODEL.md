# World model: the semantic ontology

Binding rules (operator decisions, 2026-09-12; the record layer added 2026-10-21). This doc says what an event is, what identifies it, what type it is, how important it is, how we know, and when it starts and ends, across the map (situation) pipeline and the editorial (topic and thread) pipeline. It describes meaning, not machinery: `ARCHITECTURE.md` and `DATA_STRATEGY.md` say how things are stored and which Lambda writes them. Where this doc and code disagree on meaning, the code is wrong. Recorded decisions: [0004](../decisions/0004-developments-kept-demoted.md) (placeless developments kept, demoted), [0005](../decisions/0005-one-importance-scale.md) (one importance scale, four labelled exceptions).

## 1. The entity: the event
The system is about one kind of thing: an **event**, something that happened or is happening, with a place, one or more actors and a type. It persists as long as it is live (a war, a flood or a policy fight does not end when an article does) and is narrated in two registers. The map pipeline narrates it as a **situation**, a live, monitored thing with a state. The editorial pipeline narrates it as a **story** or thread, a written analysis with a history of coverage. Situation and thread are two lifecycle aspects of the same event, produced by two pipelines that do not yet share a spine (§2, §8). Every other record (a forecast, a drift note, a verdict, a reading) describes an aspect of one event and traces back to it through one of the two identity roots below, never through an ID space of its own.

In the record ([ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md)) the same split holds one level down. An `entry` fact is one dated observation. A story is the set of entries assigned to a `threadId`. A reading is what we later understood a story to mean. A note is the model's text about a story, an entry or a country (analysis, drift, briefing, link, brief).

## 2. Identity
Two internally generated identity roots exist:
1. **`storyId`** (`${axis}#${iso3}#${slug(entity)}`, built in `clusterStories`, `backend/situations/newsSituationIngest/src/classifier-core.js`), the map pipeline's cluster key. The name is legacy; it means cluster. A news situation's id is `news#<ISO3>#<threadId>` when its cluster has a thread (one situation per country and thread; `newsSituationId` in `backend/shared/src/situations-core.js`), else `news#${storyId}`; old per-cluster ids stay as `aliases`. A GDACS situation id (`gdacs#${eventKey}`) is GDACS's own upstream id.
2. **`topicId` / `threadId`**, the editorial pipeline's keys. Many `topicId`s accrete into one `threadId` (`continues_topic`, else a composite score of at least 0.4 with keyword overlap of at least 0.15). Topic ids change every run; thread ids are stable. Every per-story record carries `threadId`, and a `THREAD#<threadId>` / `TOPICS` row maps back. Forecasts (`PRED#`) and other per-story records are foreign-keyed onto this root.

The two roots meet through **the matcher** (`backend/pipeline/NewsProjectInvokeAgentLambda/src/matcher.js`). Tier 1 is URL-exact overlap between the cluster's headlines and the topic's sources, and it is the only tier live. Tier 2, a fingerprint match, is gated by `ENABLE_R3_TIER`, which is unset in production. The matcher writes `threads/story-map.json` (cluster and thread pairs, one object, one writer, `NewsProjectInvokeAgentLambda`), and the tracker stamps `threadId` onto situations from it. The matcher is the only thing allowed to assert "these two roots name the same event". The shared fingerprint (`iso3[]`, `actors[]`, `event_type`) is join evidence, not an identity. The eventual single root is "editorial selects from the registry" (§8).

Inside the record, stable ids are by content:
- entry = sha1 of the canonical url;
- source = sha1 of the registrable domain;
- country = ISO3;
- actor = `name:<normalized>`, or `wd:Q…` once the who's who file names it;
- an entry's story = its latest `assignment` fact;
- a note names its subject by one of these ids (an entry `eventId`, a `threadId`, an ISO3 code, a story pair key, `daily:<date>` or `weekly:<date>` for a brief), never by a title or a `topicId`.

**The law: no new ID spaces.** A feature that must name an event uses `storyId` or `topicId`/`threadId`, joined through the matcher across pipelines or foreign-keyed onto one root within a pipeline. A fourth generated identifier is a violation of this document.

## 3. Type system
Two axes, nothing else classifies "what kind of event":
- **`axis`** (4 values: `conflict, political, economic, humanitarian`): the display hue.
- **`event_type`** (11 values: `war, unrest, diplomacy, election, policy, economy, markets, disaster, health, tech, other`): the classifier's category enum, also the editorial fingerprint's `event_type` (and `eventType` on entries).

The editorial selector's 12 display categories (`politics, economy, military, conflict, disaster, technology, health, climate, science, business, society, energy`, `VALID_CATEGORIES` in `newsInvokeGemini`) are a display mapping, not a second taxonomy. A story is tagged once by the 11-item vocabulary and the category is derived for rendering. Seven map cleanly (military and conflict to war/conflict, economy to economy, business to markets, disaster to disaster, health to health, politics to policy). Five are lossy; the proposed mapping is not ruled on by the operator:

| Category | `event_type` / `axis` default | Override |
|---|---|---|
| `science` | other / economic | none |
| `climate` | disaster / humanitarian | policy-flavoured (summit, legislation): policy / political |
| `society` | unrest / political | no unrest signal: other / humanitarian |
| `technology` | tech / economic | state-vs-state (export controls, cyber): other / conflict |
| `energy` | economy / economic | energy as a conflict lever: war / conflict |

## 4. Impact model
**The marking law: measured over counted over judged.** Prefer a number from an authoritative feed, then a count we can verify ourselves (outlets, countries, edits over time), then a rubric a human or model judges. Never a fourth tier ("vibes").

Typed inputs by domain:
| Domain | Measured input | Status |
|---|---|---|
| disaster | GDACS alert level (Red/Orange/Green) | live (`newsGdacsIngest`) |
| disaster | affected population | known gap: the feed does not carry it |
| conflict, humanitarian | fatalities | per-event gap; country level only: `newsCountryFactsUpdater` collects ACLED `fatalities30d` / `eventCount30d` for its first 12 countries into `FACTS#<country>`. ReliefWeb and the INFORM Severity Index are not wired |
| economy | none | the economic-impact product is retired (decision 0049); economy events take the editorial rubric |
| everything else | editorial rubric: reach, severity, irreversibility, novelty | the vocabulary exists as QA tags in `newsImpactAudit` (parked, decision 0015); not yet populating a record |

Universal counts for every event, never judged: outlets (corroboration), countries (spread), velocity (rate of new coverage). A field with no measured input renders "no data", never a judged substitute presented as measured.

**One display scale:** `low / moderate / elevated / high`. The situation tier (`situations-core.js` `LEVEL_TIER` / `SEV_TIER`) and `riskTiers.js` (bands 0-24, 25-49, 50-74, 75-100; backend `tierFromScore` in `riskDimensions.js`, wrapped by `world/tier.js`) are the same vocabulary. A risk tier is never a traffic-light colour (decision 0013).

| Legacy scale | Status |
|---|---|
| Classifier severity (1-5) | absorbed into the tier server-side; the raw int never leaves the backend |
| GDACS Red/Orange/Green and `alertscore` | absorbed via `LEVEL_TIER`; the raw level is kept as an audit trail |
| Situation tier; `riskScore` 0-100 x 4 axes with `riskLevel` | canonical (the two survivors) |
| Editorial significance (high/medium/low) | derive then deprecate: on the next touch of selection, fold into the tier if no frontend consumer exists |
| Editorial urgency (high/medium/low) | keep: tempo, not importance |
| Breaking-alert float score | keep: a send-eligibility gate that combines canonical inputs |
| Prediction probabilities (ICD-203 bands) | keep: likelihood, not impact, a permanent separate axis |
| Quality-judge 1-5 scores | keep: scores analysis quality, not event importance |
| `velocity`, `escalating`, `x_trending` | raw signals, not scales |

## 5. Quality and confidence marks
"How sure are we" (an `evidence` container: outlet list, source robustness, judge verdicts, verification state), "how much does it matter" (§4) and "how likely is the forecast" (predictions) are three questions, never merged into one number. In the record, a reading carries a confidence (`high|medium|low`) and the facts it cites. On pages, `ClaimTag` marks whether a line is a fact, an inference, a model judgment or the reader's own.

## 6. Time: two lifecycles
1. **The world lifecycle** (situations): `emerging`, `escalating` or `cooling`, `peak`, `closed`, a per-entity state machine with transition history, archived to `situations/archive/<id>.json` on close. It answers "is this still happening".
2. **The narrative lifecycle** (stories): a pipeline progression (`staging`, `latest`, `today-archive`, `archive#YYYY-MM-DD`), thread accretion (`continues_topic`), and a change log (`newsDriftCorrector`'s drift notes, kept in the record under `record/notes/drift/` and, until step 5, as `DRIFT#` / `DRIFTLOG#` rows). In the record it is dated facts with weekly readings. It answers "has our understanding changed".

Neither is forced into the other's shape: a situation closing does not make a thread done, and a thread accreting new topics does not mean the situation is escalating. They are read together at the event through the `storyId` to `threadId` link. Absence of data never closes a situation (ARCHITECTURE_INGEST_DESIGN.md §4).

## 7. The guardrail law
No new IDs, no new scales, no new taxonomies: extend this model or do not ship. The bar is proving the existing model cannot cover the need, not that a new one is more convenient. This doc is the semantic source of truth (what a field means, which identity it belongs to, whether a scale should exist). `ARCHITECTURE.md` wins on machinery. Neither overrides `DATA_STRATEGY.md`'s S3-world / DynamoDB-user split.

## 8. Convergence
Done: fingerprint emission by both pipelines; the URL matcher live; the home swap (decision 0016); the record layer (facts, readings, notes, views) as the shared spine for stories, with facts from 2026-03-07.

Next:
1. Attach the typed-impact fields (measured inputs, universal counts, tier) to registry entries.
2. Editorial selects from the registry instead of running its own RSS fetch, the point where the two roots become one by construction. Shadow-gated: `newsSelectionShadow` runs the layered selector three times a day (rule `TriggerSelectionShadow`, ENABLED) and writes `audit/selection-shadow/`. The operator's selection decision is pending. See ARCHITECTURE_INGEST_DESIGN.md.
3. Surfaces render canonical marks the next time they are touched for another reason; no big-bang UI migration.

Known gaps that convergence must not hide: population (disaster reach), per-event fatalities, and the lossy category mapping in §3.
