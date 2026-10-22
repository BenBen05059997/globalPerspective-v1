# The record: facts daily, readings weekly, many views

Status: design adopted (operator, 2026-10-20); revised 2026-10-21 to two clocks (§1c, §8). This is the one record design
doc and the system's core model. Every backend group and frontend feature README links here and says which facts or
readings it **writes**, which **views** it reads, and nothing else about storage. Decisions that bind it: `0035` (facts are
the system of record), `0036` (facts file format), `0037` (views). Order of work and live status:
`plans/PLAN_2026-10-21_foundation.md`. Storage rules: `rules/DATA_STRATEGY.md`; the stage list as data: `pipeline.json`;
what runs when: `reference/schedules.md` (generated). Open items are in §7.

## 1. The idea
Everything the site knows about the world is **dated and append-only, never rewritten**, and is one of two things: a
**fact** (something happened) or a **reading** (what we understand it to have meant). Every page is a **view** of facts
and readings, filtered by time, story, country, actor or kind. A page never stitches its own picture from raw tables.

```
  raw pipeline tables --> world reader --> facts writer --> record/facts/YYYY-MM-DD.jsonl        (daily, no model)
  (existing Lambdas)      (shared/world)   (newsStoryRecord)        + record/runs/YYYY-MM-DD.json (the Run)
                                                                    |
                                                                    v
                          week's facts --> review (newsRecordReview, planned) --> record/readings/YYYY-Www.jsonl
                                                                                  record/runs/YYYY-Www.json
                                                                    |
              views rebuilt from facts + readings (0037): record/views/stories/{id}.json, index/active.json, index/all.json,
              links/{threadId}.json, counts/{date}.json, manifest.json  --> weekly report (weekly/) --> pages, board, email, map, track record
```

## 1a. The foundation at a glance
Structure only; live state per stage is `project-docs/STATUS.md` ("Pipeline status"), order of work is
`plans/PLAN_2026-10-21_foundation.md`. One story = one thread. Readers never touch a table: they read views through the Worker.

```text
FOUNDATION  (decision 0035: facts are the system of record · two clocks: facts daily, readings weekly)

WORLD  S3 record/  (one writer per file)          USERS  DynamoDB            SCREEN  Worker /data/*
│                                                  (board pins, visits,       (pages, board, weekly email)
├─ 1 INGEST   backend/pipeline, backend/situations · model · daily    prefs, membership)
│    articles → stories → archive rows (raw tables, read only through backend/shared/src/world/)
│
├─ 2 COMMIT   backend/record/newsStoryRecord · no model · daily 23:45Z
│    record/facts/DAY.jsonl   entry · story_born · forecast_drawn · verdict · story_merged · correction · run
│    record/runs/DAY.json     ok | partial | failed  (a missing input is recorded, never filled)
│    IDs by content: entry = sha1(canonical url) · story = threadId · actor = name: · source = sha1(domain) · country = iso3
│    └─ FORECAST LOOP (0038, ARCHITECTURE_FORECAST_LOOP.md)
│         draw ≤3 outcomes/story/week (pipeline agent) → watch stories that moved or fell due (predictions resolver)
│         → gather → judge (boxed model: yes needs a verified quote) → verdict rows → verdict facts (this writer)
│
├─ 3 REVIEW   backend/record/newsRecordReview (planned) · model · weekly, with hindsight
│    record/readings/WEEK.jsonl  line · chapters · branch status · confirmed links · merges · aliases
│    every reading cites facts; a reading with no valid citation is rejected; re-runs supersede
│
├─ 4 BUILD    newsStoryRecord (facts views) → later newsRecordReview (reading fields) · no model · after each run
│    record/views/  index/active · index/all · stories/{id} · links/{id} (shared facts, specific and near in time) · counts/DAY · manifest
│    full rebuild from all facts every time; manifest written last; views are derived and replaceable
│
└─ 5 SERVE    Cloudflare Worker DATA_ALLOWED record/views/* (ETag, 5 min cache) → board, story page, weekly
     backend/board/newsBoard: pin enrichment and arrivals from the index and links views; owns only user items

WATCH  (a rule, not a stage)  every run writes a Run object; alarms on a missing or `started` Run, `archiveDay: missing`,
       a stale views manifest, model Lambdas finishing too fast           backend/monitoring
RETIRE (steps 4-5 of the plan)  each old table, prefix and parser deleted once nothing reads it, one operator yes each
REBUILD TEST  delete every view and world row in a copy; the site rebuilds from record/facts + record/readings
```

Mapping to the ten detailed stages below: Ingest = 1-3, Commit = 4-5, Review = 6, Build = 7-8, Serve = 9, Watch = 10.

## 1b. The pipeline, stage by stage (structure; live status is in `project-docs/STATUS.md`, "Pipeline status")
Ten stages in three speeds. `pipeline.json` is the machine-readable copy and drives the block in every folder README.

| # | Stage | What runs (folder) | Produces | Role |
|---|---|---|---|---|
| | **Daily, no model** | | | |
| 1 | Ingest | selector `newsInvokeGemini` 3x/day (`backend/pipeline`); map ingest `newsSituationIngest` hourly and GDACS every 20 min (`backend/situations`) | topics; map clusters; disaster alerts | raw tables |
| 2 | Stories | story writer `NewsProjectInvokeAgentLambda` (`backend/pipeline`); map tracker `newsSituationTracker` (`backend/situations`); forecasts (`PRED#`) | threads, daily archive, forecasts, map pins | raw tables |
| 3 | Daily notes | story analysis, country briefings, drift notes, story web (`backend/pipeline`); forecast settling (`backend/predictions`) | `THREAD_ANALYSIS`, `COUNTRY#`, `DRIFT#`, `web/`, verdicts (none written as of 2026-10-22); forecast loop design: [ARCHITECTURE_FORECAST_LOOP.md](ARCHITECTURE_FORECAST_LOOP.md) | raw tables, kept as cited input; revisit after two weekly runs |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance | the only parser of raw tables |
| 5 | Facts | `newsStoryRecord` (`backend/record`) | `record/facts/YYYY-MM-DD.jsonl`: `entry`, `story_born`, `forecast_drawn`, `verdict` (plus `correction`, `story_merged`, `run`); the daily Run; then the facts-only views (0037; builder deployed 2026-10-22 in `newsStoryRecord`) | the facts |
| | **Weekly, one full analysis, Friday night, in this order** | | | |
| 6 | Review | `newsRecordReview` (new Lambda, `backend/record`) reads the week's facts per active story | `record/readings/YYYY-Www.jsonl`: chapters, branch status, lines, typed links, actor merges; `record/runs/YYYY-Www.json` | the readings |
| 7 | Views | rebuilt from facts + readings (`backend/record`) | `record/views/stories/{id}.json`, `index/active.json` (any fact in 60 days), `index/all.json`, `links/{threadId}.json`, `counts/{date}.json`, `manifest.json` | what readers fetch |
| 8 | Weekly report | `backend/weekly` reads the week's readings | `weekly/YYYY-MM-DD.json` | a view of the readings, not a separate analysis |
| | **Always** | | | |
| 9 | Delivery | pages, board (`backend/board`, `features/board`), email (`backend/distribution`) read views through the Cloudflare Worker with ETag caching | what readers see | the board shows the settled past from readings and the unsettled present ("too early to call, N new entries") from daily counts |
| 10 | Watch | `backend/monitoring` + CloudWatch alarms | alerts | Run objects are the signal: a missing or `started` Run, `archiveDay: missing`, zero readings or a high rejection rate is the alarm (0036 §5); no Run alarm built, parked by the operator 2026-10-22 (§7) |

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

Every dated thing carries two dates: the event date (when it happened) and the reading date (when we wrote it). A fact's
`precision` is `exact` or `day` (week and month are deferred, 0035). Nothing is edited in place: corrections and re-runs append new readings that
supersede old ones. User data (boards, pins, strings) lives in DynamoDB, points at record IDs and is never written into
the record.

## 2. The fact
One JSON line per fact in `record/facts/YYYY-MM-DD.jsonl`; the file is the UTC date of `at`, so a late fact lands in an old
file. Full field table, ID rules, Run object and backfill: decision 0036.
```
{ "schemaVersion": 1,
  "eventId": "<sha1(kind + sourceKey)>",      // entry facts: sha1('entry' + smallest canonical source url), 0036 §3
  "kind": "entry", "at": "2026-10-16T12:26:00Z", "date": "2026-10-16", "precision": "exact" | "day",
  "threadId": "thread-...",                   // the story; null only for run facts
  "iso3": ["IRN"], "actorIds": ["name:<normalized>"], "sourceIds": ["<sha1(registrable domain)>"],
  "payload": { ... kind-specific ... },
  "producer": {"lambda": "newsStoryRecord@<version>", "runId": "2026-10-16-1"},
  "sourceKey": "archive#2026-10-16|<generationId>|<topicId>",
  "sourceRow": { "store": "NewsCache", "key": "archive#2026-10-16", "index": 7 },
  "idBasis": "url" | "title", "sources": [{ "sourceId", "outlet", "url", "title" }] }   // entry only
```
Rules: a fact is never edited or deleted; a change is a new fact (`correction`, `story_merged`) or a reading that supersedes;
`eventId` makes re-runs safe (`appendLines` dedupes by it); every fact names its source. Facts carry no judgment label:
judgments are readings. Each day also has a Run (`record/runs/YYYY-MM-DD.json`: status started|ok|partial|failed,
`inputs.archiveDay` present|missing|thin, counts, failures). The Run is the one mutable object; it holds no world data. A
missing archive day gets a Run and no facts; the 28 missing days before 2026-09-06 are not reconstructed.

## 3. Kinds
### Facts
| kind | payload (essentials) | comes from today |
|---|---|---|
| `entry` | title, summary, category, eventType, continuesTopic, `topicId` as seen (not an ID) | `NewsCache archive#` rows (agent Lambda) |
| `story_born` | first title | derived: earliest `entry` per threadId |
| `forecast_drawn` | forkId, branches {branchId, text, p, trigger, resolutionSource, due} | `PredictionLog PRED#` |
| `verdict` | qid, result yes/no/void, decidedBy, evidence | `PredictionLog Q#/VERDICT*` (the table holds zero such rows as of 2026-10-22, so none exist yet); the loop that produces them: [ARCHITECTURE_FORECAST_LOOP.md](ARCHITECTURE_FORECAST_LOOP.md) |
| `correction` | `corrects` (eventId), what was wrong, reason | builder exists; no input feeds it yet |
| `story_merged` | from, into (threadIds), reason, evidence; readers resolve transitively | builder exists; no input feeds it yet |
| `run` | runId, status, counts: the day was processed | the writer itself |

`situation` stays deferred. Missing-day coverage is Run data, not a fact.

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
a fact.

## 4. Object model
Every object has a stable ID and a `schemaVersion`.
| Object | ID | Key fields | Links to |
|---|---|---|---|
| Story | `threadId`; a `story_merged` fact points a duplicate at the survivor (like Wikipedia redirects) | born, title, status | facts, readings, countries, actors |
| Fact (event) | `eventId` = sha1(kind + sourceKey); entries by canonical url (0036 §3) | kind, at, precision, payload | story, countries, actors, sources |
| Country | `iso3` | name | facts, stories |
| Actor | `name:<normalized>` (`normalizeActor` in `backend/shared/src/record.js`); an actor table with aliases is deferred; the review proposes merges as readings | name | facts |
| Source/outlet | `sourceId` = sha1(registrable domain) | outlet (from `backend/shared/src/outlets.js`); source types deferred | facts. "Fired needs two distinct outlets" depends on it |
| Branch | `branchId` (inside a `forecast_drawn` fork) | text, trigger, resolution source, due date, verdict; status (fired/hold/dead/late/resurrected) is a reading; a question/outcome shape is deferred | story, `forecast_drawn` fact, `branch_status` readings |
| Reading | `readingId` = sha1(kind + threadId + period) | subtype, cites, covers, supersedes, run, model, promptVersion, label, confidence, status | facts, earlier readings, Run |
| Typed link | readingId (subtype `link`) | type from a fixed list: causes, responds_to, same_actor, escalates, contradicts | two stories; cites facts on both sides |
| Run | `runId` (`YYYY-MM-DD-n` daily, `YYYY-Www` weekly) | period, inputs, counts, failures; review Runs add model, promptVersion, rejections | readings, Period |
| Period | `2026-W43`, `2026-10` | week or month | readings, the board weekly and the weekly report join on it |

Later: Situation (a group above stories), Place below country (coordinates), Indicators (dated numbers with a source).
Not needed now: country views.

## 5. Views and stores
Views (0037) live under `record/views/` (shadow: `record/shadow/views/`; built 2026-10-22 by the deployed builder: runId `2026-10-22-3`, 519 stories, `factsThrough` 2026-10-19), each with `schemaVersion: 1` and
`builtFrom: {factsThrough, readingsThrough}`; reading-derived fields are `null` with a reason until the review exists.
| View | Built from | Stored as | Read by |
|---|---|---|---|
| Story | facts (+ accepted readings from step 3) for one `threadId`; a merged story is `{aliasOf}` only | `record/views/stories/{threadId}.json` | story tree, board |
| Active index | stories with any fact in the last 60 days | `record/views/index/active.json` | board pins, weekly selection |
| All index | every story, same row shape (cap 5 MB, else the run fails) | `record/views/index/all.json` | search, story list |
| Links | cheap grounds (shared actors, iso3, sources) with other active stories; `confirmedLinks` empty until readings | `record/views/links/{threadId}.json` | board arrivals |
| Daily counts | new entries, branches due, verdicts per story per day (facts only) | `record/views/counts/{date}.json` | board's unsettled zone |
| Manifest | written last, so a reader that sees it sees a complete set | `record/views/manifest.json` | alarm on its age |
| Weekly report | the week's readings | `weekly/YYYY-MM-DD.json` | weekly page and email |
| Board | readings and counts for your pins and strings | computed on request (`newsBoard`) | board |
| Track record | `forecast_drawn`, `branch_status`, `verdict` | `predictions/track_record.json` (today) | track record page |

Stores: `record/facts/YYYY-MM-DD.jsonl` and `record/facts/manifest.json` (days present) · `record/runs/` · `record/readings/YYYY-Www.jsonl` ·
`record/views/...` · `record/fixtures/golden-week/` (planned: frozen facts; every prompt or rule change re-runs against it and
diffs the readings) · `weekly/YYYY-MM-DD.json`. The scheduled run writes live (`{"shadow":false}`, flipped 2026-10-22); a manual invoke
defaults to `shadow:true` and writes the same bytes under `record/shadow/` (a prefix change, not a code change). Views are rebuilt in full from the facts manifest every time (plain PutObject; derived,
replaceable). The Worker serves only `record/views/` (0037 §4), never facts, runs or readings.

## 6. Who writes, who reads (two writers, each the only writer of its file)
- **Facts and the daily Run:** only `newsStoryRecord` (`backend/record/`), from raw tables through `backend/shared/src/world/`.
  No model, no DynamoDB write.
- **Readings and review Runs:** only `newsRecordReview` (`backend/record/`, planned). Writes `record/readings/*` and the weekly
  Run. It reads facts and its own earlier readings, nothing else.
- **Views (0037):** `newsStoryRecord` builds all of them after each daily append, in the same invocation; from step 3
  `newsRecordReview` owns `stories/*` and adds readings fields. No view is written by anything else.
- **Reads raw tables:** only `backend/shared/src/world/` (injected client, so the same code runs in a Lambda and a local
  script). Consumers import it through `_shared` and never parse a raw row themselves; until a view exists a consumer may read
  through `world/` and says so in its README.
- **Everyone else reads views.** `newsBoard` (`backend/board/`) owns only `GlobalPerspectiveSavedItems` board items and
  `GlobalPerspectiveUserPrefs` `followedThreads`/`followedActors`; the weekly (`backend/weekly/`) owns `weekly/*`; the
  resolver (`newsPredictionResolver`) writes `Q#` verdicts (0034). Two Lambdas never write the same prefix or table field; when a
  reader needs something a writer lacks, the fix is in the writer.

Each `backend/<group>/README.md` and `features/<name>/README.md` carries a generated pipeline block ending in a
`Timeline:` line linking here; `quality/check_docs.mjs` fails a README that lacks it.

### Names, words, invariants
| Name | What it is | Where |
|---|---|---|
| record | the world's memory: dated, append-only facts and readings | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer of one signed-in member | `backend/board/`, user DynamoDB items, `features/board/` |
An agent working on one does not touch the other two except through published files and documented fields.

Words: **topic** = one item the selector picks in a run; **thread / story** = the editorial arc (`thread-<slug>-<hash>`),
what every page and doc means by "story"; **cluster** = the map pipeline's internal headline group (not a story);
**situation** = a map pin.

Invariants: (1) one writer per prefix and per table field. (2) Facts and readings are dated and never rewritten; `latest`
objects are pointers; corrections and re-runs append. (3) No human gate (0034, extended 2026-10-20): the operator disputes by
appending a correction; a wrong result is an algorithm bug. (4) A reading carries a label, a confidence and the facts it
cites, and a reading with no valid citation is rejected; pages render labels from the record and never infer them. (5) The
browser reads world data only through the Worker's `/data/*`; member-only computation is JWT-gated at the Lambda. (6) The weekly
is published by its run and sent unless the week's file says `held`. (7) A Lambda error leaves the previous views in place; the
next run catches up (idempotent per date and per period).

## 7. Open items
Pointers are to `plans/PLAN_2026-10-21_foundation.md`. Everything not listed here is either done (see the plan's ticked rows)
or a design, not an open defect.
- **Run alarms not built** (step 1): the facts writer is scheduled (`TriggerStoryRecord`, cron(45 23 * * ? *), live since 2026-10-22). The
  alarms (no `record/facts/DATE.jsonl` by a fixed UTC time, a `started` or `archiveDay: missing` Run, fast-fail Duration of the model
  Lambda) are parked by the operator; `backend/monitoring/alarms/spec.json` is a proposal, none of its alarms exist.
  No alarm watches `LLM 402`; there are two alert topics (`GlobalPerspectiveAlerts`, `GlobalPerspectivesAlerts`).
- **Other stages still swallow model errors** (plan Risks): only `newsInvokeGemini` and the agent now fail the run.
- **Map ingest drops unclassified articles silently** and the tracker then closes pins for lack of data, so "no data" reads
  as "ended" (2026-10-20 audit; not re-checked; not in the plan's rows).
- **Views deployed; Worker and review open** (steps 2-3). Deployed 2026-10-22 with IAM applied: the views builder (`newsStoryRecord`, with the links rule and exact entry time) and `newsBoard` reading the views. Not done: the Worker upload (live version cc57a42f cannot serve `record/views/`; the repo `worker.mjs` also carries an unreleased `/analyze` redirect that is not part of the planned upload) and the board UI release (not clicked in a browser). Live entries stay day precision because archive rows since 2026-10-20 lack `publishedAt`. Not built: `newsRecordReview`, golden-week fixture, `newsSystemsAnalysis` link field.
- **Raw-row parsers outside `world/`** (step 4): most Lambdas still parse raw rows themselves; the same concept is defined
  several times (risk tier, story title, freshness, outlet from host, Firebase JWT check). Retire list: plan "Retire list".
- **Source gaps the facts inherit**: `topicId` is unstable across runs; a legacy script still edits verdicts in place;
  `threads.mjs merge/split` rewrites rows in place (a merge on the record is a `story_merged` fact, not yet fed). Fixed by
  lane F (f03ab32b, 2026-10-20) and no longer gaps: sources carry `publishedAt` and `outlet`; `PRED#` rows carry `threadId`,
  `forkId`, `scenarioIndex`; `Q#` rows carry `threadId`. Entries before 2026-09-12 keep `iso3:[]`/`actorIds:[]` (recorded as missing).
- **Dead weight**: the plan's Retire list, plus `stories/state/` (3,436 objects, never pruned) and unused read actions in
  `newsSensitiveData` (2026-10-20 audit; not re-checked). Also from that audit: `newsClientErrors` CORS lacked
  `www.globalperspective.net`, and several headers and `scripts/functions.json` runtimes were stale.
- **Two failing agent tests** on main (plan step 1, last row).

## 8. Decided 2026-10-21 (operator)
Two clocks (§1c), ten stages (§1b), the object model (§4) and the stores (§5) are decided. Order of work: `plans/PLAN_2026-10-21_foundation.md` (steps 0-5, checklist) and decision `0035-facts-are-the-system-of-record.md`.
Facts are the system of record; the five-stage picture below is the top level, the ten stages stay as the detailed mapping.

**Top-level picture: five stages.** Ingest, Commit, Review, Build, Serve; Watch is a rule, not a stage. Ten stages onto five:
stages 1-2 (feeds, stories) are Ingest; stage 3 (daily notes) folds into Review; stages 4-5 (one reader, facts) are Ingest's
write and Build's read; stage 6 (review) is Review; stage 7 (views) is Build; stage 8 (the weekly report) is Build, since the
weekly is a view; stage 9 (delivery) is Serve; stage 10 (watch) is the Watch rule: every run writes a Run object, and a
missing or empty Run is the alarm. Commit (forecasts, resolver verdicts) runs daily because a forecast is a dated commitment.

Current state (2026-10-22): `newsStoryRecord` is the facts writer (no model key), scheduled daily
(`TriggerStoryRecord`, 23:45Z, live), and `record/facts` holds 2026-09-05..2026-10-22 (19 days hold only a Run: archive row missing);
the per-day model steps are removed. `newsStoryRecord` was redeployed 2026-10-22 with the views builder (`record/views/` is built) and `newsBoard` with its view reader; the Worker
upload (allowlist line) and the new board UI are not done; `newsRecordReview` is not built. Live checklist: the plan. A design discussion
is not a build go-ahead: each step waits for its own go.
