# The record: facts daily, readings weekly, many views

The one record design doc and the system's core model. Every backend group and frontend feature README links here and says which facts or readings it writes and which views it reads. Decisions that bind it: [0035](../decisions/0035-facts-are-the-system-of-record.md) (facts are the system of record), [0036](../decisions/0036-facts-file-format.md) (facts file format), [0037](../decisions/0037-views-from-facts.md) (views), [0038](../decisions/0038-forecast-loop.md) (forecast loop), [0039](../decisions/0039-weekly-review.md) (weekly review), [0040](../decisions/0040-raw-before-model.md) (raw before model). Code and live AWS are the truth for what is deployed and enabled; the stage list as data is `pipeline.json`; storage rules are `DATA_STRATEGY.md`.

## 1. The idea
Everything the site knows about the world is dated and append-only, and is one of two things: a **fact** (something happened) or a **reading** (what we understand it to have meant, written later with hindsight). Every page is a **view** of facts and readings. A page never stitches its own picture from raw tables.

```
  selector --> record/inbox/articles/ ----+
  raw pipeline tables --> world reader ---+--> facts writer --> record/facts/YYYY-MM-DD.jsonl   (daily, no model)
  (existing Lambdas)      (shared/world)      (newsStoryRecord)     record/runs/YYYY-MM-DD.json  (the Run)
  resolver --> record/inbox/verdicts/ ----+                    ^ inbox: merges, assignments, splits
                                                                |
  week's facts --> review (newsRecordReview) --> record/readings/YYYY-Www.jsonl, record/runs/review-YYYY-Www.json
                                                                |
  views rebuilt from facts + readings (newsStoryRecord): record/views/ --> Worker /data/record/views/ --> board
```

Two clocks: facts are appended daily with no model; readings are written weekly, one model call per active story. Every dated thing carries two dates, the event date and the reading date. A fact's `precision` is `exact` or `day`. Nothing is edited in place: a correction or a re-run appends something that supersedes. User data (boards, pins, preferences) lives in DynamoDB, points at record IDs and is never written into the record.

## 1a. The foundation at a glance
```text
WORLD  S3 record/ (one writer per file)              USERS  DynamoDB            SCREEN  Worker /data/*

1 INGEST   backend/pipeline, backend/situations · model · 3x/day
     articles -> stories -> archive rows (raw tables, read only through backend/shared/src/world/)
     every fetched article -> record/inbox/articles/ before the model call (0040): a model outage cannot lose the news
2 COMMIT   backend/record/newsStoryRecord · no model · daily 23:45 UTC
     record/facts/DAY.jsonl   entry · article · assignment · story_born · forecast_drawn · verdict · story_merged · story_split · correction · run
     record/runs/DAY.json     started -> ok | partial | failed (a missing input is recorded, never filled)
     record/inbox/<kind>/DAY.jsonl  hand-off from other writers, read nightly and turned into facts
     recovery: a missed day is rebuilt from public records (GDELT GKG raw files, Wayback) into labelled facts, no forecasts (0040)
     forecast loop (0038, ARCHITECTURE_FORECAST_LOOP.md): draw, watch, gather, judge, record
3 REVIEW   backend/record/newsRecordReview · model · weekly, Monday 01:00 UTC (ARCHITECTURE_WEEKLY_REVIEW.md)
     record/readings/WEEK.jsonl  line · chapters · confirmed links · merge, alias and assignment proposals
4 BUILD    newsStoryRecord, the only view builder · no model · after each daily append
     record/views/  index/active · index/all · stories/{id} · links/{id} · counts/DAY · manifest (written last)
5 SERVE    Cloudflare Worker, allow-list record/views/* (ETag, 5 min cache) -> the board

WATCH  every run writes a Run object (backend/monitoring); the operator does not want pipeline alarms (§7)
```
Ten detailed stages map onto five: Ingest = 1-3, Commit = 4-5, Review = 6, Build = 7-8, Serve = 9, Watch = 10. Rebuild test: delete every view in a copy and the views rebuild from `record/facts/` + `record/readings/` (`backend/record/newsStoryRecord/scripts/rebuild-test.js` rebuilt 1,252 of 1,252 live views on 2026-10-30). Removing world rows from DynamoDB is the later, destructive step 5 of the plan.

## 1b. The pipeline, stage by stage
`pipeline.json` is the machine-readable copy and drives the block in every folder README.

| # | Stage | What runs | Produces |
|---|---|---|---|
| | **Daily, no model** | | |
| 1 | Ingest | selector `newsInvokeGemini` 3x/day (26 feeds, up to 25 items each fetched, 8 per feed in the prompt, done-not-said rule, code dedupe, significance floor); map ingest `newsSituationIngest` hourly, `newsGdacsIngest` every 20 min | topics; raw articles in `record/inbox/articles/`; map clusters; disaster alerts |
| 2 | Stories | `NewsProjectInvokeAgentLambda` joins topics to threads, draws at most 3 outcomes per story per week, reconciles each `PRED#` row to the entry's final thread; `newsSituationTracker` | threads, daily archive, forecasts (`PRED#`), map pins |
| 3 | Daily notes | story analysis, country briefings, drift notes, the story web (`backend/pipeline`); the forecast watch and judge `newsPredictionResolver` | `THREAD_ANALYSIS`, `COUNTRY#`, `DRIFT#`, `web/`, verdict lines in `record/inbox/verdicts/`; kept as cited input |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance; the only parser of raw tables |
| 5 | Facts | `newsStoryRecord` reads the world reader and every inbox | `record/facts/YYYY-MM-DD.jsonl`, the daily Run, then the views |
| | **Weekly, Monday 01:00 UTC after the ISO week ends** | | |
| 6 | Review | `newsRecordReview` reads the week's facts per active story | `record/readings/YYYY-Www.jsonl`, `record/runs/review-YYYY-Www.json` |
| 7 | Views | rebuilt from facts, readings and the who's who file by `newsStoryRecord` | `record/views/` |
| 8 | Weekly report | `backend/weekly` (content model only; the pull, check and publish scripts are on unmerged branches) | `weekly/YYYY-MM-DD.json`, a view of the readings |
| | **Always** | | |
| 9 | Delivery | the board (`backend/board`, `features/board`) reads views through the Worker; every other page still reads DynamoDB through the `newsSensitiveData` proxy or S3 `world/` JSON; email and posts (`backend/distribution`) | what readers see |
| 10 | Watch | `backend/monitoring` | monitor Lambdas and CloudWatch alarms; Run objects are the record's own signal |

On demand: re-run the review on a past week after an algorithm fix; the new readings supersede the old.

## 2. The fact
One JSON line per fact in `record/facts/YYYY-MM-DD.jsonl`; the file is the UTC date of `at`, so a late fact lands in an old file. Full field table, ID rules, Run object and backfill: decision 0036.
```
{ "schemaVersion": 1,
  "eventId": "<sha1(kind + sourceKey)>",      // entry facts: sha1('entry' + smallest canonical source url)
  "kind": "entry", "at": "2026-10-16T12:26:00Z", "date": "2026-10-16", "precision": "exact" | "day",
  "threadId": "thread-...",                   // the story; null for run and article facts
  "iso3": ["IRN"], "actorIds": ["name:<normalized>"], "sourceIds": ["<sha1(registrable domain)>"],
  "payload": { ... kind-specific ... },
  "producer": {"lambda": "newsStoryRecord@<version>", "runId": "2026-10-16-1"},
  "sourceKey": "archive#2026-10-16|<generationId>|<topicId>",
  "sourceRow": { "store": "NewsCache", "key": "archive#2026-10-16", "index": 7 } }
```
Rules: a fact is never edited or deleted; a change is a new fact (`correction`, `story_merged`) or a reading that supersedes. `eventId` makes re-runs safe (`appendLines` dedupes by it). Every fact names its source. Facts carry no judgment label.

Each day also has a Run (`record/runs/YYYY-MM-DD.json`: status `started|ok|partial|failed`, `inputs.archiveDay` `present|missing|thin`, counts, failures). The Run is the one mutable object and holds no world data. A missing archive day gets a failed Run and no facts, except a recovered day (`recovery:true`), whose missing archive is expected (`inputs.recovered:true`, status ok). The 28 archive days before 2026-09-06 are not reconstructed.

## 3. Kinds
### Facts
| kind | payload (essentials) | comes from |
|---|---|---|
| `entry` | title, summary, category, eventType, continuesTopic, `topicId` as seen (not an ID) | `NewsCache archive#` rows (agent Lambda) |
| `article` | url, outlet, title, snippet, publishedAt, feed; recovered ones carry `recoveredAt`, `recoveredFrom`. In no story until assigned | selector inbox `record/inbox/articles/`; recovery script |
| `assignment` | entryId (an `entry` or `article` fact), threadId, by (ingest, review, operator), supersedes; the views follow the latest per entry | derived from every `entry` (by ingest); operator and approved review proposals through `record/inbox/assignments/` |
| `story_born` | first title | derived: earliest `entry` per threadId |
| `forecast_drawn` | forkId, branches {branchId, text, p, trigger, resolutionSource, due, qid} | `PredictionLog PRED#` |
| `verdict` | qid, result yes/no/void, voidReason, decidedBy, evidence {eventId, quote, date}, revision | resolver lines in `record/inbox/verdicts/`; the legacy void job writes `issued_before_method` voids |
| `correction` | `corrects` (eventId), what was wrong, reason | builder exists; no input feeds it yet |
| `story_merged` | from, into (threadIds), reason, evidence; readers resolve transitively | review auto-merges via `record/inbox/merges/` |
| `story_split` | from, into, reason; cancels the matching merge in the views | operator, `record/inbox/splits/` |
| `run` | runId, status, counts | the writer itself |

`situation` stays deferred. Drift notes, story analysis, country briefings and the story web are raw daily notes the review may cite as input; they are not facts.

### Readings (one kind, `reading`, six subtypes)
| subtype | payload (essentials) |
|---|---|
| `line` | the story's one-sentence line |
| `chapter` | title, summary; `from`/`to` are the dates of its cited facts, set by code |
| `link` | typed link between two stories: otherThreadId, mechanism, direction drives\|driven_by\|shared_cause |
| `merge_proposal` | another story that may be the same one |
| `alias` | actor variants, a canonical id, a Wikidata Q-number; a proposal until the who's who file applies it |
| `assignment` | an entry or recovered article that belongs to another story; a proposal, applied only through `record/inbox/assignments/` |

Common fields: `readingId` = sha1(week + threadId + subtype + key), `cites[eventId]`, `covers{from,to}`, `supersedes`, `run`, `model`, `promptVersion`, `confidence`. Acceptance is mechanical: at least one citation and every cited ID exists in the story's bundle; a rejected item is kept in the review Run with its reason. There is no branch-status reading (0039 amendment, 2026-10-31): a branch's status is its verdict fact, else open or past due by its due date, derived where shown.

## 4. Object model
Every object has a stable ID and a `schemaVersion`.
| Object | ID | Notes |
|---|---|---|
| Story | `threadId`; a `story_merged` fact points a duplicate at the survivor; an entry's story is its latest `assignment` | topic ids change every run, thread ids are stable |
| Fact | `eventId` = sha1(kind + sourceKey); entries by canonical url | |
| Country | `iso3` | |
| Actor | `name:<normalized>` in facts; views map variants to `wd:Q…` through the who's who file `record/operator/aliases.json` (operator-owned; the review and `backend/record/cli/reconcile-actors.mjs` only propose); generic actors never ground a link | |
| Source | `sourceId` = sha1(registrable domain) | outlet name from `backend/shared/src/outlets.js` |
| Branch | `branchId` inside a `forecast_drawn` fork | text, trigger, resolution source, due date; verdict is a fact |
| Reading | `readingId` | see §3 |
| Run | `YYYY-MM-DD` daily, `review-YYYY-Www` weekly | inputs, counts, failures; review Runs add model, promptVersion, rejections, `notReached` |
| Period | `2026-W43`, `2026-10` | readings, the weekly report and the board join on it |

Later: Situation (a group above stories), place below country, indicators. Not needed now: country views.

## 5. Views and stores
Views live under `record/views/` (shadow: `record/shadow/views/`), each with `schemaVersion: 1` and `builtFrom: {factsThrough, readingsThrough}`; reading-derived fields are null or empty with a reason until a reading exists. Field-level shapes: `backend/record/newsStoryRecord/schema/views/` and its README.
| View | Built from | Stored as |
|---|---|---|
| Story | facts and readings for one `threadId`: entries (newest 400), forks with each branch's latest verdict, merges, corrections, line, chapters; a merged story is `{aliasOf}` only | `stories/{threadId}.json` |
| Active index | stories with any fact of their own in the last 60 UTC days | `index/active.json` |
| All index | every story, same row shape (over 5 MB the build fails) | `index/all.json` |
| Links | one per story (empty when merged or idle): cheap grounds with other active stories (specific shared actors, countries, sources; 14-day window) and `confirmedLinks` from link readings | `links/{threadId}.json` |
| Daily counts | articles, new entries, branches due, verdicts per story per day, from facts only | `counts/{date}.json` |
| Manifest | written last, so a reader that sees it sees a complete set | `manifest.json` |
| Weekly report (planned) | the week's readings | `weekly/YYYY-MM-DD.json` |
| Board | your pins and strings over the views | computed on request by `newsBoard` |
| Track record | `forecast_drawn`, `verdict` | `predictions/track_record.json` (today: the scored sample, from the prediction log) |

Stores (one writer per file; the full prefix table is `DATA_STRATEGY.md` §4):
- `record/facts/`, `record/runs/YYYY-MM-DD.json`, `record/views/`: `newsStoryRecord`.
- `record/readings/`, `record/runs/review-*`, `record/inbox/merges/`: `newsRecordReview`.
- `record/inbox/articles/`: the selector (and the recovery script); `verdicts/`: the resolver; `splits/` and `assignments/`: the operator (and approved review proposals). `newsStoryRecord` reads each inbox for the run day and six days before.
- `record/operator/aliases.json`: the operator.
- `record/fixtures/golden-week/` (frozen facts for the review, in the repo under `backend/record/newsRecordReview/fixtures/`).
The scheduled run writes live (`{"shadow":false}`); a manual invoke defaults to `shadow:true` and writes the same bytes under `record/shadow/`. Views are rebuilt in full from the facts manifest every time. The Worker serves only `record/views/` (0037 §4), never facts, runs, inboxes or readings.

## 6. Who writes, who reads
- **Facts and the daily Run:** only `newsStoryRecord`, from raw tables through `backend/shared/src/world/` and from the inboxes. No model, no DynamoDB write. Another producer reaches the facts only through the inbox rule: it appends lines to `record/inbox/<kind>/DAY.jsonl` and `newsStoryRecord` converts them.
- **Readings and review Runs:** only `newsRecordReview`. It reads facts, the views index and manifest, its own earlier readings and the who's who file; it writes no view and no fact.
- **The operator** writes `record/operator/aliases.json`, `record/inbox/splits/` and `record/inbox/assignments/`.
- **Views:** only `newsStoryRecord`.
- **Raw tables:** read only by `backend/shared/src/world/`; consumers import it through `_shared`. Until a view exists for a page, the page reads through `world/` or the proxy and its README says so.
- **Everyone else reads views.** Today only the board does (`newsBoard` and `features/board`); the weekly (`backend/weekly/`) will own `weekly/*`; the resolver writes `Q#` rows in the prediction log and the verdict inbox. When a reader needs something a writer lacks, the fix is in the writer.

Each `backend/<group>/README.md` and `features/<name>/README.md` carries a generated pipeline block (from `pipeline.json`); `quality/check_docs.mjs` fails a README whose block is missing or stale.

Words: **topic** = one item the selector picks in a run; **thread / story** = the editorial arc (`thread-<slug>-<hash>`), what every page and doc means by "story"; **cluster** = the map pipeline's internal headline group (not a story); **situation** = a map pin. Three layers never reach into each other except through published files: the **record** (`backend/record/`, S3 `record/`), the **weekly** (`backend/weekly/`, S3 `weekly/`, `features/weekly/`), the **board** (`backend/board/`, user DynamoDB items, `features/board/`).

Invariants: (1) one writer per prefix and per table field. (2) Facts and readings are dated and never rewritten; `latest` objects are pointers. (3) No human gate on verdicts (0034): the operator disputes by appending a correction; a wrong result is an algorithm bug. (4) A reading carries a confidence and the facts it cites; pages render labels from the record and never infer them. (5) The browser reads world data only through the Worker's `/data/*`. (6) The weekly is published by its run and sent unless the week's file says `held`. (7) A Lambda error leaves the previous views in place; the next run catches up (idempotent per date and per period).

## 7. Open design items
Dated state (what is deployed, which rule is enabled) comes from AWS and `START_HERE.md`.
- **Daily model notes** (`TOPIC#` entry notes, `THREAD_ANALYSIS`, `DRIFT#`, `COUNTRY#`, `WEB#INDEX`, briefs) are moving into the record, decision 0042.
- **Retire duplicates and parsers (plan step 4):** pages other than the board still read DynamoDB through the proxy. Thread pages can switch to views as they are; home and weekly lists need entry summaries; the track record needs a derived view; story analysis, drift, countries and briefs need new readings first; map and economy need a decision.
- **Rebuild test, full:** after step 4, delete the world DynamoDB rows in a copy and prove the site rebuilds from the record; only then remove the rows (destructive, needs a yes).
- **Alarms:** the operator does not want pipeline alarms (402, record Run, review Run); they were created and removed on 2026-10-31. `backend/monitoring/alarms/spec.json` stays a proposal. Run objects are still the record's own signal and the freshness monitor watches the public topics.
- **Stages swallow model errors:** only `newsInvokeGemini` and the agent fail the run on a model error. The others should follow.
- **Map ingest drops unclassified articles silently**, and the tracker then closes pins for lack of data, so "no data" reads as "ended" (see ARCHITECTURE_INGEST_DESIGN.md).
- **Weekly report** still has to be built on the readings (ARCHITECTURE_WEEKLY_REVIEW.md §9).
- **Entry time precision:** live entries stay day precision while archive rows lack `publishedAt`. Entries before 2026-09-12 keep `iso3:[]`/`actorIds:[]` (recorded as missing).
- **Who's who file:** while `record/operator/aliases.json` is empty actors keep `name:` ids; `reconcile-actors.mjs` proposes entries.
- **Record data:** over-joined threads and duplicate stories the review cannot merge without neighbours; the review flags off-story entries as assignment proposals for the operator to apply.
- **Backfills:** actor/place backfill for stories before 2026-09-12 needs the review; 93 historical orphan forecasts need an operator redirect; the gap-benchmark answer key was lost on 2026-10-25 and must be rebuilt or dropped.
- **Feeds** for Latin America and Southeast Asia wait on operator-supplied URLs.
- **Raw-row parsers outside `world/`:** most Lambdas still parse raw rows themselves, so the same concept is defined several times (risk tier, story title, freshness, outlet from host, Firebase JWT check).
- **Retire list** (each deletion needs its own operator yes, after the rebuild test): `DRIFTLOG#`, `situations/history`, `WEB#INDEX` / `LATEST`, `tags/backfill`, `world/shadow`, `signals/snapshots`, the eight Scans in `newsSensitiveData`.
- **Open questions:** migrate the prediction log into `record/`; one ingest or two; consolidate the five user tables.
- **Source gaps the facts inherit:** `topicId` is unstable across runs; a legacy script still edits verdicts in place; `backend/pipeline/cli/threads.mjs merge/split` rewrites rows in place (on the record a merge is a `story_merged` fact).

## 8. Decided (operator, 2026-10-21)
Two clocks, ten stages, the object model and the stores. Facts are the system of record; the five-stage picture is the top level and the ten stages are the detailed mapping. A design discussion is not a build go-ahead: each step waits for its own go.
