# The timeline: one source of truth, many views

Status: design adopted (operator, 2026-10-20). This is the system's core model. Every backend group and frontend feature
README links here and says which events it **writes**, which **views** it reads, and nothing else about storage.
Details of the subsystem that writes it: `ARCHITECTURE_RECORD.md`; what runs when: `ARCHITECTURE_RECORD_PIPELINE.md`;
storage rules: `rules/DATA_STRATEGY.md`. What exists today is checked against the code in §7.

## 1. The idea
Everything the site knows about the world is an **event on one timeline**: dated, append-only, never rewritten. Every
page is a **view** of that timeline, filtered by time, story, country, actor or kind. A page never stitches its own
picture from raw tables.

```
  raw pipeline tables ──► world reader ──► timeline writer ──► record/timeline/YYYY-MM-DD.jsonl   (the truth)
  (existing Lambdas)      (shared/world)    (newsStoryRecord)          │
                                                                       ├─► story view     record/stories/<threadId>
                                                                       ├─► index view     record/index.json
                                                                       ├─► country view   record/countries/<ISO3>   (later)
                                                                       ├─► corrections    record/corrections/
                                                                       └─► consumers: today · story page · country · weekly · board · map · track record
```

## 1b. The pipeline, stage by stage (structure; live status is in `project-docs/STATUS.md`, "Pipeline status")
| # | Stage | What runs (folder) | Produces | Timeline role |
|---|---|---|---|---|
| 1 | Ingest | selector `newsInvokeGemini` 3×/day (`backend/pipeline`); map ingest `newsSituationIngest` hourly and GDACS every 20 min (`backend/situations`) | topics; map clusters; disaster alerts | raw material |
| 2 | Stories | story writer `NewsProjectInvokeAgentLambda` (`backend/pipeline`); map tracker `newsSituationTracker` (`backend/situations`) | threads, daily archive, forecasts (`PRED#`); map pins | source of `entry`, `story_born`, `forecast_drawn`; later `situation` |
| 3 | Analysis | story analysis, country briefings, drift notes, story web (`backend/pipeline`); forecast settling (`backend/predictions`) | `THREAD_ANALYSIS`, `COUNTRY#`, `DRIFT#`, `web/`, verdicts | source of `read_changed`, `country_read_changed`, `link_confirmed`, `verdict` |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance | the only reader of raw tables |
| 5 | Timeline | `newsStoryRecord` (`backend/record`) | `record/timeline/*.jsonl` + views (stories, index, corrections) | the truth |
| 6 | Views | story, country, today pages (`features/threads`, `countries`, `home`); map (`features/map`); track record; board (`backend/board`, `features/board`); weekly (`backend/weekly`, `features/weekly`) | what readers see | read views only |
| 7 | Delivery | site (`docs/` via the Worker), weekly email (`backend/distribution/newsEmailSender`), social posts (`backend/distribution`) | pages, emails, posts | consumers |
| 8 | Watch | `backend/monitoring` (model guard, freshness, error digest) + CloudWatch alarms | alerts | must alarm on stage failures (§7.4) |

## 2. The event
One JSON line per event in `record/timeline/YYYY-MM-DD.jsonl` (UTC day of `at`).
```
{ "eventId": "<sha1(kind + sourceKey)>",      // idempotent: the same source row always gives the same id
  "at": "2026-10-16T12:26:00Z", "date": "2026-10-16",
  "kind": "entry",                            // see §3
  "threadId": "thread-…",                     // the story; null only for events with no story
  "iso3": ["IRN"], "actors": ["IRGC"],        // canonical (resolveIso3; actor normalised as world/ does)
  "sources": [{ "outlet": "BBC", "url": "…", "archive": "archive#2026-10-16", "topicId": "…" }],
  "label": "fact" | "judgment", "confidence": "low|medium|high"?,   // judgments are always labelled
  "payload": { … kind-specific … },
  "producer": "newsStoryRecord@<version>",
  "sourceRow": { "store": "NewsCache", "key": "archive#2026-10-16", "index": 7 } }   // provenance back to the raw row
```
Rules: an event is never edited or deleted; a change is a new event (a correction points at the eventId it corrects);
`eventId` makes re-runs safe; every fact names its source; every judgment carries its label.

## 3. Event kinds
| kind | label | payload (essentials) | comes from today |
|---|---|---|---|
| `entry` | fact | title, summary line, outlets | `NewsCache archive#` rows (agent Lambda) |
| `story_born` | fact | first title | derived: earliest entry per threadId |
| `read_changed` | judgment | risk from→to, expected path from→to, mechanism | `THREAD_HISTORY#`, `THREAD_ANALYSIS`, `DRIFT#`/`DRIFTLOG#` |
| `chapter` | judgment | name, one sentence written at the time | derived when a drift note changes the expected path |
| `forecast_drawn` | judgment | fork id, branches {text, p, trigger, resolutionSource, due} | `PredictionLog PRED#` |
| `branch_status` | judgment | branchId, fired/hold/dead/late/resurrected, evidence | trigger check (newsStoryRecord) |
| `verdict` | fact | qid, yes/no/void, decidedBy, evidence | `PredictionLog Q#/VERDICT*` |
| `correction` | fact | eventId corrected, what was wrong, reason | dead branch that fired; operator correction |
| `link_confirmed` | judgment | other threadId, strength, mechanism, evidence | `web/` links with the confirmation rule |
| `country_read_changed` | judgment | country, risk from→to, mechanism | `COUNTRY#/HISTORY#`, country `DRIFT#` |
| `line` | judgment | the story's one-sentence line: text, writtenAt, confidence; earlier versions are earlier `line` events | written by `newsStoryRecord` (at birth, then weekly) |
| `coverage` | fact | missingDays, source stamps, asOf / generatedAt, processing cursor | written by `newsStoryRecord` each run |
| `situation` (later) | fact | opened/raised/closed, place, tier | `situations/` (map pipeline) |

## 4. Views
| View | Filter on the timeline | Stored as | Read by |
|---|---|---|---|
| Story | `threadId = X`, all kinds, in order (the tree is this view) | `record/stories/<id>/latest.json` + daily snapshot | story page, board, weekly |
| Index | latest state per story (line, risk, born, counts, last moved) | `record/index.json` | board pins, weekly selection |
| Country | `iso3 ∋ X` | `record/countries/<ISO3>` (later) | country page |
| Today | `date = today` | none: read the day file | today page (later) |
| Week | `date ∈ week`, kinds that changed something | the weekly JSON (`weekly/`) | weekly email and page |
| Board | events touching your pins and strings | computed on request (`newsBoard`) | board, the board's weekly |
| Map | today's events with a place, grouped | `world/latest.json` (map pipeline; joins later) | home map |
| Track record | `forecast_drawn`, `branch_status`, `verdict` | `predictions/track_record.json` (today) | track record page |

## 5. Who writes, who reads (one writer)
- **Writes the timeline and its stored views:** only `newsStoryRecord` (`backend/record/`), from raw tables through
  `backend/shared/src/world/`. Nothing else writes `record/`.
- **Reads raw tables:** only `backend/shared/src/world/` (ARCHITECTURE_RECORD.md §0c).
- **Everyone else reads views.** Until a view exists, a consumer may read through `world/` and says so in its README.
- Later, producers may append events directly (e.g. the agent Lambda emitting `entry`); the one-writer rule then moves
  to "one writer per event kind", recorded here before it happens.

## 6. Every folder links here
Each `backend/<group>/README.md` and `features/<name>/README.md` has a line:
`Timeline: writes <kinds or "none">; reads <views or "world/ (until <view> exists)">. See project-docs/architecture/ARCHITECTURE_TIMELINE.md.`
`quality/check_docs.mjs` fails a README that lacks the link.

## 7. What exists and what is missing (audit 2026-10-20: five read-only reviewers, code and live AWS only)

### 7.1 The timeline itself
- Nothing writes `record/timeline/*.jsonl` yet. `newsStoryRecord` (lane/record, not deployed) writes per-story files only;
  its events lack `eventId`, `kind`, `at`, `label`, `producer`, `sourceRow`. The shared reader `backend/shared/src/world/`
  exists (main a925f149); only `newsBoard` uses it so far.
- No page can read a view: the Worker's `DATA_ALLOWED` lacks `record/`, and the read proxy has no record action.

### 7.2 Raw material, per event kind
| kind | raw source | present | missing or unreliable |
|---|---|---|---|
| entry | `archive#` (agent Lambda) | threadId, archivedAt, url on every source; iso3 on 194/195 | publication time (only `archivedAt`, up to 8 h late; source `age` is relative text); outlet name on 0/514 sources (domain only); actors empty 13%; iso3 from the LLM, regex-checked only; `topicId` = `title-<rank>`, unstable across runs |
| story_born | earliest `archive#` per thread | derivable | 43 of 84 threads are singletons; a story silent > 7 days forks |
| read_changed | `THREAD_HISTORY#`, `DRIFT#`/`DRIFTLOG#` | drift: from/to, explaining event, reason | expected path is prose only; history only on days with new events; max 10 threads analysed per run; drift threads only from `latest` |
| country_read_changed | `COUNTRY#/HISTORY#`, country `DRIFT#` | score, level, dimensions | keyed by name (no iso3); effectively weekly; 12 hard-coded drift countries |
| forecast_drawn | `PRED#<topicId>/<day>` | branch text, deadline, `p` (percent, question triggers only), resolutionSource | no fork or scenario id (positional); one row per topic not per story; regions as names; `category` always null |
| verdict / correction | `Q#/VERDICT`, `VERDICT#n` | verdict, evidence url + quote, decidedBy, reason | `Q#` has `clusterKey`, not `threadId`; legacy script still edits `PRED#` verdicts in place (122 legacy triggers): two verdict forms |
| link_confirmed | `web/` links | from/to, confidence, mechanism, cited entries | links regenerated every run (no id, no first-seen); confidence is the model's own; the "confirmation rule" is not in code; mechanism text leaks prompt labels |
| situation | `situations/state` history[] | at, tier, state, note | id changes when a thread is attached; `at` is the 30-min sweep time; no label; 7/30 threaded; GDACS never |

### 7.3 Data that expires before the timeline can keep it
`today-archive` 24 h, `THREAD_HISTORY#` 60 d, `DRIFT#` 60 d, `archive#` 90 d, `THREAD_ANALYSIS` 90 d, `COUNTRY#/HISTORY#`
90 d. Only `DRIFTLOG#` is permanent. Until `newsStoryRecord` runs, history keeps falling off the end.

### 7.4 Failure handling that would corrupt the timeline
- Stale re-archive: on 2026-10-20 the agent re-saved the 10-19 topics under today (14/14 repeats; 19/176 repeated
  topicIds over 6 days). Fix on lane/pipeline (stale-run guard), not deployed.
- The map ingest drops unclassified articles silently (417 → 124 classified in the outage, still `ok:true`), and the
  tracker then closes pins for lack of data: false `situation closed` events. "No data" must differ from "ended".
- Stages swallow LLM errors and return normally (Lambda Errors stay 0). Alerts did fire by email (low balance at $0.14
  16 h ahead; content stale from 06:30Z), but no alarm watches `LLM 402`, and there are two alert topics
  (`GlobalPerspectiveAlerts` email; `GlobalPerspectivesAlerts` email + chat).
- `threads.mjs merge/split` rewrites rows in place; on the timeline a merge must be an alias plus a correction event.

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
| actor normalising | `record.js normalizeActor` vs `ACTOR_ALIASES` (entity-normalize, classifier-core) |

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

### 7.7 What to build, in order
1. Capture first (history is expiring): `newsStoryRecord` writes the timeline with stable keys (`sourceRow` = archive
   date + generationId + topicId; fork id = PRED# key + scenario index), switched to world/, shadow week.
2. Stop corrupting inputs: stale-run guard, "no data" ≠ "ended" on the map, an alarm on `LLM 402`, one alert topic.
3. Fill missing fields at the source: publication time (ingest keeps `pubDate`; selector keeps the source date), outlet
   name, canonical iso3 via `resolveIso3`, normalised actors, `threadId` on `Q#` rows, fork ids on `PRED#`.
4. Serve views: Worker allowlist + reader IAM for `record/`, a record action or `/data/record/*`; Story view replaces
   `narrative_thread`/`archive_range`; one `storyTitle`, one tier, one freshness from event `at`.
5. Retire: dead read actions, pruned S3 prefixes, legacy verdict script, in-place merge (alias events instead).
