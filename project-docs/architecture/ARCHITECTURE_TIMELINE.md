# The record: facts daily, readings weekly, many views

Status: design adopted (operator, 2026-10-20); revised 2026-10-21 to two clocks (§1c, §8). This is the system's core model.
Every backend group and frontend feature README links here and says which facts or readings it **writes**, which **views**
it reads, and nothing else about storage. Details of the subsystem that writes it: `ARCHITECTURE_RECORD.md`; what runs when:
`ARCHITECTURE_RECORD_PIPELINE.md`; storage rules: `rules/DATA_STRATEGY.md`; the stage list as data: `pipeline.json`.
What exists today is checked against the code in §7.

## 1. The idea
Everything the site knows about the world is **dated and append-only, never rewritten**, and is one of two things: a
**fact** (something happened) or a **reading** (what we understand it to have meant). Every page is a **view** of facts
and readings, filtered by time, story, country, actor or kind. A page never stitches its own picture from raw tables.

```
  raw pipeline tables --> world reader --> facts writer --> record/facts/YYYY-MM-DD.jsonl        (daily, no model)
  (existing Lambdas)      (shared/world)   (newsStoryRecord)        |
                                                                    v
                          week's facts --> review (newsRecordReview, planned) --> record/readings/YYYY-Www.jsonl
                                                                                  record/runs/YYYY-Www.json
                                                                    |
              views rebuilt from facts + readings: record/views/stories/{id}.json, index/active.json, index/all.json,
              links/{threadId}.json  --> weekly report (weekly/) --> pages, board, email, map, track record
```

## 1b. The pipeline, stage by stage (structure; live status is in `project-docs/STATUS.md`, "Pipeline status")
Ten stages in three speeds. `pipeline.json` is the machine-readable copy and drives the block in every folder README.

| # | Stage | What runs (folder) | Produces | Role |
|---|---|---|---|---|
| | **Daily, no model** | | | |
| 1 | Ingest | selector `newsInvokeGemini` 3x/day (`backend/pipeline`); map ingest `newsSituationIngest` hourly and GDACS every 20 min (`backend/situations`) | topics; map clusters; disaster alerts | raw tables |
| 2 | Stories | story writer `NewsProjectInvokeAgentLambda` (`backend/pipeline`); map tracker `newsSituationTracker` (`backend/situations`); forecasts (`PRED#`) | threads, daily archive, forecasts, map pins | raw tables |
| 3 | Daily notes | story analysis, country briefings, drift notes, story web (`backend/pipeline`); forecast settling (`backend/predictions`) | `THREAD_ANALYSIS`, `COUNTRY#`, `DRIFT#`, `web/`, verdicts | raw tables, kept as cited input; revisit after two weekly runs |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance | the only parser of raw tables |
| 5 | Facts | `newsStoryRecord` (`backend/record`) | `record/facts/YYYY-MM-DD.jsonl`: entries, births, forecasts, verdicts, sources, actors; facts-only views: active index, links, daily counts | the facts |
| | **Weekly, one full analysis, Friday night, in this order** | | | |
| 6 | Review | `newsRecordReview` (new Lambda, `backend/record`) reads the week's facts per active story | `record/readings/YYYY-Www.jsonl`: chapters, branch status, lines, typed links, actor merges; `record/runs/YYYY-Www.json` | the readings |
| 7 | Views | rebuilt from facts + readings (`backend/record`) | `record/views/stories/{id}.json`, `index/active.json` (stories touched in 60 days), `index/all.json`, `links/{threadId}.json` | what readers fetch |
| 8 | Weekly report | `backend/weekly` reads the week's readings | `weekly/YYYY-MM-DD.json` | a view of the readings, not a separate analysis |
| | **Always** | | | |
| 9 | Delivery | pages, board (`backend/board`, `features/board`), email (`backend/distribution`) read views through the Cloudflare Worker with ETag caching | what readers see | the board shows the settled past from readings and the unsettled present ("too early to call, N new entries") from daily counts |
| 10 | Watch | `backend/monitoring` + CloudWatch alarms | alerts | Run objects are the signal: zero readings or a high rejection rate raises an alarm (§7.4) |

On demand: re-run the review on a past week after an algorithm fix; the new readings supersede the old.

## 1c. Two clocks
| | Facts | Readings |
|---|---|---|
| What | what happened | what we understand it meant |
| Clock | daily | weekly, with hindsight |
| Model | none | one full analysis per week |
| Written by | `newsStoryRecord` | `newsRecordReview` (planned) |
| Stored in | `record/facts/YYYY-MM-DD.jsonl` | `record/readings/YYYY-Www.jsonl`, `record/runs/YYYY-Www.json` |
| Changes | append only | append only; a reading cites facts and may supersede an earlier reading |

Every dated thing carries two dates: the event date (when it happened) and the reading date (when we wrote it). Dates carry
a precision: exact, day, week or month. Nothing is edited in place: corrections and re-runs append new readings that
supersede old ones. User data (boards, pins, strings) lives in DynamoDB, points at record IDs and is never written into
the record.

## 2. The fact
One JSON line per fact in `record/facts/YYYY-MM-DD.jsonl` (UTC day of `at`).
```
{ "eventId": "<sha1(kind + sourceKey)>",      // idempotent: the same source row always gives the same id
  "schemaVersion": 1,
  "at": "2026-10-16T12:26:00Z", "date": "2026-10-16", "precision": "exact|day|week|month",
  "kind": "entry",                            // see §3
  "type": "action" | "statement",             // only actions count for selection
  "threadId": "thread-...",                   // the story; null only for facts with no story
  "iso3": ["IRN"], "actors": ["<actorId>" | "unresolved:<name>"],
  "sources": [{ "sourceId": "...", "outlet": "BBC", "url": "...", "archive": "archive#2026-10-16", "topicId": "..." }],
  "payload": { ... kind-specific ... },
  "producer": "newsStoryRecord@<version>",
  "sourceRow": { "store": "NewsCache", "key": "archive#2026-10-16", "index": 7 } }   // provenance back to the raw row
```
Rules: a fact is never edited or deleted; a change is a new fact or a reading that supersedes; `eventId` makes re-runs safe;
every fact names its source. Facts carry no judgment label: judgments are readings.

## 3. Kinds
### Facts
| kind | payload (essentials) | comes from today |
|---|---|---|
| `entry` | title, summary line, outlets | `NewsCache archive#` rows (agent Lambda) |
| `story_born` | first title | derived: earliest entry per threadId |
| `forecast_drawn` | fork id, branches {text, p, trigger, resolutionSource, due} | `PredictionLog PRED#` |
| `verdict` | qid, yes/no/void, decidedBy, evidence | `PredictionLog Q#/VERDICT*` |
| `correction` | eventId corrected, what was wrong, reason | operator correction; legacy verdict edits |
| `situation` (later) | opened/raised/closed, place, tier | `situations/` (map pipeline) |

Drift notes, story analysis, country briefings and the story web stay raw daily notes: the review may cite them as input;
they are not facts and their old `read_changed`, `country_read_changed` and `link_confirmed` kinds no longer exist.

### Readings (one kind, `reading`, five subtypes)
| subtype | payload (essentials) | replaces |
|---|---|---|
| `chapter` | name, one sentence, written with hindsight | event kind `chapter` |
| `branch_status` | branchId, fired/hold/dead/late/resurrected, evidence | event kind `branch_status` |
| `line` | the story's one-sentence line | event kind `line` |
| `link` | typed link between two stories (§4) | event kind `link_confirmed` |
| `actor_merge` | two actor IDs proposed as one | new |

Common fields: `readingId` = sha1(kind + threadId + period), `schemaVersion`, `cites[eventId]`, `covers{from,to,precision}`,
`supersedes[readingId]`, `run`, `model`, `promptVersion`, `label`, `confidence`, `status` accepted|rejected (+ reason).
Acceptance is mechanical: cites at least one fact, every cited ID exists, and the covered dates fall inside the cited
facts. A rejected reading is kept with its reason. Coverage information (missing days, stamps) belongs in the Run, not as
a timeline fact.

## 4. Object model
Every object has a stable ID and a `schemaVersion`.
| Object | ID | Key fields | Links to |
|---|---|---|---|
| Story | `threadId`; merge/alias record so a duplicate points at the surviving story (like Wikipedia redirects) | born, title, status | facts, readings, countries, actors |
| Fact (event) | `eventId` = sha1(kind + sourceKey) | kind, type (action/statement), at, precision, payload | story, countries, actors, sources |
| Country | `iso3` | name | facts, stories |
| Actor | stable ID from a small actor table in `backend/shared` (name to ID, aliases), resolved at fact-write time; unknowns stored as `unresolved:<name>`; the review proposes merges as readings | name, type, aliases | facts. Start with countries and heads of government |
| Source/outlet | stable `sourceId` | outlet, type (wire/national/state media) | facts. "Fired needs two distinct outlets" depends on it |
| Branch | `branchId` | question, outcomes, resolution source, due date, result (Metaculus-style); status = which outcome happened | story, `forecast_drawn` fact, `branch_status` readings |
| Reading | `readingId` = sha1(kind + threadId + period) | subtype, cites, covers, supersedes, run, model, promptVersion, label, confidence, status | facts, earlier readings, Run |
| Typed link | readingId (subtype `link`) | type from a fixed list: causes, responds_to, same_actor, escalates, contradicts | two stories; cites facts on both sides |
| Run | `runId` | period, inputs, model, promptVersion, counts, rejections, failures | readings, Period |
| Period | `2026-W43`, `2026-10` | week or month | readings, the board weekly and the weekly report join on it |

Later: Situation (a group above stories), Place below country (coordinates), Indicators (dated numbers with a source).
Not needed now: country views.

## 5. Views and stores
| View | Built from | Stored as | Read by |
|---|---|---|---|
| Story | facts + accepted readings for one `threadId` (the tree is this view) | `record/views/stories/{id}.json` | story page, board, weekly |
| Active index | stories touched in the last 60 days: latest line, counts, last moved | `record/views/index/active.json` | board pins, weekly selection |
| All index | every story | `record/views/index/all.json` | search, story list |
| Links | typed links for one story | `record/views/links/{threadId}.json` | story page, board |
| Daily counts | facts per story per day (facts-only, no model) | in the indexes | board's unsettled zone |
| Weekly report | the week's readings | `weekly/YYYY-MM-DD.json` | weekly page and email |
| Board | readings and counts for your pins and strings | computed on request (`newsBoard`) | board |
| Track record | `forecast_drawn`, `branch_status`, `verdict` | `predictions/track_record.json` (today) | track record page |

Stores: `record/facts/YYYY-MM-DD.jsonl` · `record/readings/YYYY-Www.jsonl` · `record/runs/YYYY-Www.json` · `record/views/...` ·
`record/fixtures/golden-week/` (frozen facts; every prompt or rule change re-runs against it and diffs the readings) ·
`weekly/YYYY-MM-DD.json`. A shadow week writes under `record/shadow/`.

## 6. Who writes, who reads (two writers, each the only writer of its file)
- **Facts and the facts-only views:** only `newsStoryRecord` (`backend/record/`), from raw tables through
  `backend/shared/src/world/`. Writes `record/facts/*`.
- **Readings and Runs:** only `newsRecordReview` (`backend/record/`, planned). Writes `record/readings/*` and `record/runs/*`.
  It reads facts and its own earlier readings, nothing else.
- **Views:** rebuilt from facts + readings (stage 7). Two owners, one per clock: newsStoryRecord rebuilds the facts-only views (index/active, index/all, links, daily counts) after each daily append; newsRecordReview rebuilds the story views after each weekly run. No view is written by anything else.
- **Reads raw tables:** only `backend/shared/src/world/` (ARCHITECTURE_RECORD.md §0c).
- **Everyone else reads views.** Until a view exists, a consumer may read through `world/` and says so in its README.

Each `backend/<group>/README.md` and `features/<name>/README.md` carries a generated pipeline block ending in a
`Timeline:` line linking here; `quality/check_docs.mjs` fails a README that lacks it.

## 7. What exists and what is missing (audit 2026-10-20: five read-only reviewers, code and live AWS only; items the 2026-10-21 design resolves are marked)

### 7.1 The record itself
- Updated 2026-10-21: `newsStoryRecord` is deployed (reserved concurrency 1, no schedule, no model key). A shadow no-LLM
  run for 2026-10-20 succeeded (267 stories) and wrote only under `record/shadow/`. Its code still has per-day chapter,
  trigger and line model steps; the design removes them in favour of the weekly review (code not yet changed). It does
  not yet write `record/facts/*`. `eventId`, `kind`, `at`, `producer`, `sourceRow` are the target fact fields (§2).
- Resolved by design: `chapter`, `line`, `branch_status` and `coverage` as per-day events (now readings and the Run).
- Still missing: the Worker's `DATA_ALLOWED` lacks `record/`, and the read proxy has no record action.

### 7.2 Raw material, per fact kind (and the inputs the weekly review cites)
| kind | raw source | present | missing or unreliable |
|---|---|---|---|
| entry | `archive#` (agent Lambda) | threadId, archivedAt, url on every source; iso3 on 194/195 | publication time (only `archivedAt`, up to 8 h late; source `age` is relative text); outlet name on 0/514 sources (domain only); actors empty 13%; iso3 from the LLM, regex-checked only; `topicId` = `title-<rank>`, unstable across runs |
| story_born | earliest `archive#` per thread | derivable | 43 of 84 threads are singletons; a story silent > 7 days forks |
| (daily note, was `read_changed`) | `THREAD_HISTORY#`, `DRIFT#`/`DRIFTLOG#` | drift: from/to, explaining event, reason | expected path is prose only; history only on days with new events; max 10 threads analysed per run; drift threads only from `latest` |
| (daily note, was `country_read_changed`) | `COUNTRY#/HISTORY#`, country `DRIFT#` | score, level, dimensions | keyed by name (no iso3); effectively weekly; 12 hard-coded drift countries |
| forecast_drawn | `PRED#<topicId>/<day>` | branch text, deadline, `p` (percent, question triggers only), resolutionSource | no fork or scenario id (positional); one row per topic not per story; regions as names; `category` always null |
| verdict / correction | `Q#/VERDICT`, `VERDICT#n` | verdict, evidence url + quote, decidedBy, reason | `Q#` has `clusterKey`, not `threadId`; legacy script still edits `PRED#` verdicts in place (122 legacy triggers): two verdict forms |
| (input to `link` readings) | `web/` links | from/to, confidence, mechanism, cited entries | links regenerated every run (no id, no first-seen); confidence is the model's own; the "confirmation rule" is not in code (the design replaces it: a typed `link` reading must cite facts on both sides); mechanism text leaks prompt labels |
| situation | `situations/state` history[] | at, tier, state, note | id changes when a thread is attached; `at` is the 30-min sweep time; no label; 7/30 threaded; GDACS never |

### 7.3 Data that can disappear before the record keeps it
Checked live 2026-10-21: TTL is **disabled** on NewsCache and SummarizeAndPredict, so `archive#`, `DRIFT#`, `THREAD_*` and
`COUNTRY#` rows do not expire today; the per-row `ttl` attributes (24 h, 60 d, 90 d) would only bite if TTL were switched
on. S3 lifecycle does expire `stories/` after 45 days. The archive gaps (Sept 14-29 and Oct 14 have no `archive#` row;
rows exist from at least Sept 6) are **writing gaps**, not expiry: those days were never archived and cannot be backfilled.
Oct 20 holds 14 entries against a normal 35-50, the DeepSeek outage. The facts writer should still start soon, but the
reason is the 45-day `stories/` lifecycle and future gaps, not table TTLs.

### 7.4 Failure handling that would corrupt the timeline
- Stale re-archive: on 2026-10-20 the agent re-saved the 10-19 topics under today (14/14 repeats; 19/176 repeated
  topicIds over 6 days). Fix on lane/pipeline (stale-run guard), not deployed.
- The map ingest drops unclassified articles silently (417 → 124 classified in the outage, still `ok:true`), and the
  tracker then closes pins for lack of data: false `situation closed` events. "No data" must differ from "ended".
- Stages swallow LLM errors and return normally (Lambda Errors stay 0). Alerts did fire by email (low balance at $0.14
  16 h ahead; content stale from 06:30Z), but no alarm watches `LLM 402`, and there are two alert topics
  (`GlobalPerspectiveAlerts` email; `GlobalPerspectivesAlerts` email + chat).
- `threads.mjs merge/split` rewrites rows in place; on the record a merge is an alias (the duplicate points at the surviving story) plus a correction. Resolved by design, not yet built.

### 7.5 The same concept defined many times
| concept | copies |
|---|---|
| raw-row parsing | world/ (main), lane/record, lane/weekly; the board now uses world/ |
| risk tier | backend `riskDimensions.js`, `newsSignals` `signalAdapter.js`, `world/tier.js`, frontend `riskTiers.js`, `countryTier.js`, brief-word tiers |
| story title | 8 inline copies in the frontend (ThreadPage, CountryPage, StoriesTimeline, StoriesBoard, StoryLine, WeeklyMap, CopyBriefing, usePinInfo) |
| freshness | 5 frontend helpers (`pausedSince` 36 h, `freshnessState`, `analysisFreshness`, `situationFreshness`, `oldestSource`) |
| story history | `narrative_thread`, `archive_range`, `useWeeklyArchive` |
| outlet from host | `world/derive.js`, `outlet_metadata.js`, `signalAdapter.js`, `classifier-core.js` |
| Firebase JWT check | 7 Lambdas; 3 skip the audience check if `FIREBASE_PROJECT_ID` were unset |
| actor normalising | `record.js normalizeActor` vs `ACTOR_ALIASES` (entity-normalize, classifier-core); resolved by design: one actor table in `backend/shared`, IDs resolved at fact-write time |

### 7.6 Dead weight and wrong docs
- Unused read actions: `event_dossier`, `dossier_analysis`, `pair_analysis`, `pair_analyses_list`, `world_overview`
  (full scan), `research_briefing`, `geocode`; `newsRecommend`'s `recommend` ranker; `newsSignals` builder disabled;
  parked economy actions; `corrections_feed` full-scans on every call.
- S3 growth: `stories/state/` 3,436 objects never pruned; `situations/history/` 2,039 objects, never expire; the Worker
  serves all of `world/` including history, shadow and a member copy identical to the public one.
- `newsClientErrors` CORS lacks `www.globalperspective.net`: browser errors from www are lost.
- Wrong docs or comments: `newsWeeklyBrief` header (claims human review), snapshot header (in-place verdicts),
  `newsFreshnessMonitor` threshold (code 5 h, live 9 h), `refreshPolicy.js` (Monday vs daily), `scripts/functions.json`
  runtimes (6 listed 20.x, live 22.x), `check-shared-sync.mjs` header, GDACS/GDELT headers (DynamoDB shadow), rule
  `newsSourceAuditDaily` (runs Mon/Wed/Fri).

### 7.7 What to build
Superseded by §8 (decided 2026-10-21). The items not in §8 still stand: stop corrupting inputs (stale-run guard, "no data"
is not "ended" on the map, an alarm on `LLM 402`, one alert topic); fill missing fields at the source (publication time,
outlet name, canonical iso3, `threadId` on `Q#` rows, fork ids on `PRED#`); retire dead read actions, unpruned S3
prefixes, the legacy verdict script and in-place merge.

## 8. Decided 2026-10-21 (operator)
Two clocks (§1c), ten stages (§1b), the object model (§4) and the stores (§5) are decided. Order of work:
Order of work: `plans/PLAN_2026-10-21_foundation.md` (steps 0-5, checklist) and decision `0035-facts-are-the-system-of-record.md`.
Facts are the system of record; the five-stage picture below is the top level, the ten stages stay as the detailed mapping.

**Top-level picture: five stages.** Ingest, Commit, Review, Build, Serve; Watch is a rule, not a stage. Ten stages onto five:
stages 1-2 (feeds, stories) are Ingest; stage 3 (daily notes) folds into Review; stages 4-5 (one reader, facts) are Ingest's
write and Build's read; stage 6 (review) is Review; stage 7 (views) is Build; stage 8 (the weekly report) is Build, since the
weekly is a view; stage 9 (delivery) is Serve; stage 10 (watch) is the Watch rule: every run writes a Run object, and a
missing or empty Run is the alarm. Commit (forecasts, resolver verdicts) runs daily because a forecast is a dated commitment.

Current state: `newsStoryRecord` deployed and shadow-only; its per-day model steps are to be removed; board slice 2 merged
and `newsBoard` deployed, board UI not yet released. A design discussion is not a build go-ahead: each step above waits for
its own go.
