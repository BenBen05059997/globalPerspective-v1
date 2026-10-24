# The record: facts daily, readings weekly, many views

Status: design adopted (operator, 2026-10-20); revised 2026-10-21 to two clocks (§1c, §8) and 2026-10-23 for raw capture, assignments and canonical actors (0040). This is the one record design
doc and the system's core model. Every backend group and frontend feature README links here and says which facts or
readings it **writes**, which **views** it reads, and nothing else about storage. Decisions that bind it: `0035` (facts are
the system of record), `0036` (facts file format), `0037` (views), `0038` (forecast loop), `0039` (weekly review), `0040` (raw before model). Order of work and live status:
`plans/PLAN_2026-10-21_foundation.md`. Storage rules: `rules/DATA_STRATEGY.md`; the stage list as data: `pipeline.json`;
what runs when: `reference/schedules.md` (generated). Open items are in §7.

## 1. The idea
Everything the site knows about the world is **dated and append-only, never rewritten**, and is one of two things: a
**fact** (something happened) or a **reading** (what we understand it to have meant). Every page is a **view** of facts
and readings, filtered by time, story, country, actor or kind. A page never stitches its own picture from raw tables.

```
  selector --> record/inbox/articles/ ----+
  raw pipeline tables --> world reader ---+--> facts writer --> record/facts/YYYY-MM-DD.jsonl        (daily, no model)
  (existing Lambdas)      (shared/world)      (newsStoryRecord)        + record/runs/YYYY-MM-DD.json (the Run)
  resolver --> record/inbox/verdicts/ ---+                      ^ inbox: merges, assignments, splits
                                                                    |
                                                                    v
                          week's facts --> review (newsRecordReview) --> record/readings/YYYY-Www.jsonl
                                                                                  record/runs/review-YYYY-Www.json
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
├─ 1 INGEST   backend/pipeline, backend/situations · model · 3x/day    prefs, membership)
│    articles → stories → archive rows (raw tables, read only through backend/shared/src/world/)
│    every fetched article → record/inbox/articles/ (selector, before the model, 0040) → `article` facts; a model outage cannot lose the news
│
├─ 2 COMMIT   backend/record/newsStoryRecord · no model · daily 23:45Z
│    record/facts/DAY.jsonl   entry · article · assignment · story_born · forecast_drawn · verdict · story_merged · story_split · correction · run
│    recovery: a missed day is rebuilt from public records (GDELT, Wayback) into the same facts, labelled, no forecasts (0040)
│    record/runs/DAY.json     ok | partial | failed  (a missing input is recorded, never filled)
│    record/inbox/<kind>/DAY.jsonl  hand-off from other writers (articles: selector · verdicts: resolver · merges: review ·
│         assignments, splits: operator, review proposals); read nightly, turned into facts
│    IDs by content: entry = sha1(canonical url) · story = threadId (entries move by assignment) · actor = name:, or wd:Q… once the who's who file names it · source = sha1(domain) · country = iso3
│    └─ FORECAST LOOP (0038, ARCHITECTURE_FORECAST_LOOP.md)
│         draw ≤3 outcomes/story/week (pipeline agent) → watch stories that moved or fell due (predictions resolver)
│         → gather (our entries after the draw only) → judge (boxed model: yes needs a verified quote) → verdict rows → verdict facts (this writer)
│
├─ 3 REVIEW   backend/record/newsRecordReview · model · weekly Monday 01:00 UTC, with hindsight
│    record/readings/WEEK.jsonl  line · chapters · branch status · confirmed links · merge, alias and assignment proposals
│    every reading cites facts; a reading with no valid citation is rejected; re-runs supersede
│    loop: ARCHITECTURE_WEEKLY_REVIEW.md (0039)
│
├─ 4 BUILD    newsStoryRecord stays the only view builder and reads readings (0039) · no model · after each run
│    record/views/  index/active · index/all · stories/{id} · links/{id} (shared facts, specific and near in time) · counts/DAY · manifest
│    follows the latest assignment per entry; maps actor aliases to canonical ids (record/operator/aliases.json); generic actors never ground a link
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
| 1 | Ingest | selector `newsInvokeGemini` 3x/day (`backend/pipeline`): fetches 25 items per feed, 8 per feed in the prompt, done-not-said rule, code dedupe, significance floor (0040); map ingest `newsSituationIngest` hourly and GDACS every 20 min (`backend/situations`) | topics; raw articles (`record/inbox/articles/`); map clusters; disaster alerts | raw tables, plus the raw article capture |
| 2 | Stories | story writer `NewsProjectInvokeAgentLambda` (`backend/pipeline`): joins topics to threads, draws at most 3 outcomes per story per week, reconciles each `PRED#` row to the entry's final thread; map tracker `newsSituationTracker` (`backend/situations`) | threads, daily archive, forecasts (`PRED#`), map pins | raw tables |
| 3 | Daily notes | story analysis, country briefings, drift notes, story web (`backend/pipeline`); the forecast watch and judge (`newsPredictionResolver`, `backend/predictions`) | `THREAD_ANALYSIS`, `COUNTRY#`, `DRIFT#`, `web/`; verdict lines in `record/inbox/verdicts/`; loop: [ARCHITECTURE_FORECAST_LOOP.md](ARCHITECTURE_FORECAST_LOOP.md) | raw tables, kept as cited input; revisit after two weekly runs |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance | the only parser of raw tables |
| 5 | Facts | `newsStoryRecord` (`backend/record`) reads the world reader and every inbox | `record/facts/YYYY-MM-DD.jsonl`: `entry`, `article`, `assignment`, `story_born`, `forecast_drawn`, `verdict`, `story_merged`, `story_split`, `correction`, `run`; the daily Run (`rawDay`, `archiveDay`, counts); then the views | the facts |
| | **Weekly, one full analysis, Monday 01:00 UTC after the ISO week ends, in this order** | | | |
| 6 | Review | `newsRecordReview` (`backend/record`) reads the week's facts per active story | `record/readings/YYYY-Www.jsonl`: chapters, branch status, lines, typed links, actor merges; `record/runs/YYYY-Www.json` | the readings |
| 7 | Views | rebuilt from facts + readings + operator aliases by `newsStoryRecord` (`backend/record`) | `record/views/stories/{id}.json`, `index/active.json` (any fact in 60 days), `index/all.json`, `links/{threadId}.json`, `counts/{date}.json` (articles, new entries, branches due, verdicts), `manifest.json` | what readers fetch |
| 8 | Weekly report | `backend/weekly` reads the week's readings | `weekly/YYYY-MM-DD.json` | a view of the readings, not a separate analysis |
| | **Always** | | | |
| 9 | Delivery | pages, board (`backend/board`, `features/board`), email (`backend/distribution`) read views through the Cloudflare Worker (`/data/record/views/`, ETag caching); `newsBoard` reads the index and links views | what readers see | the board shows the settled past from readings and the unsettled present ("too early to call, N new entries") from daily counts |
| 10 | Watch | `backend/monitoring` + CloudWatch alarms | alerts | Run objects are the signal: a missing or `started` Run, `archiveDay: missing`, zero readings or a high rejection rate is the alarm (0036 §5); no Run alarm built, parked by the operator 2026-10-22 (§7) |

On demand: re-run the review on a past week after an algorithm fix; the new readings supersede the old.

## 1c. Two clocks
| | Facts | Readings |
|---|---|---|
| What | what happened | what we understand it meant |
| Clock | daily | weekly, with hindsight |
| Model | none | one full analysis per week |
| Written by | `newsStoryRecord` | `newsRecordReview` |
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
missing archive day gets a failed Run and no facts, except a recovered day (`recovery:true`), whose missing archive is expected: `inputs.recovered:true`, status ok; the 28 missing days before 2026-09-06 are not reconstructed.

## 3. Kinds
### Facts
| kind | payload (essentials) | comes from today |
|---|---|---|
| `entry` | title, summary, category, eventType, continuesTopic, `topicId` as seen (not an ID) | `NewsCache archive#` rows (agent Lambda) |
| `article` | url, outlet, title, snippet, publishedAt, feed; recovered ones carry `recoveredAt`, `recoveredFrom` (0040). In no story | selector inbox `record/inbox/articles/`; recovery script. Converted even on a day whose archive row is missing |
| `assignment` | entryId (the id of the fact placed: an `entry`, or an `article`), threadId, by (ingest, review, operator), supersedes (0040); the views follow the latest per entry; an assigned `article` appears in the story as a `kind:'article'` entry row | derived from every `entry` (by ingest); operator and approved review proposals through `record/inbox/assignments/` |
| `story_born` | first title | derived: earliest `entry` per threadId |
| `forecast_drawn` | forkId, branches {branchId, text, p, trigger, resolutionSource, due} | `PredictionLog PRED#` |
| `verdict` | qid, result yes/no/void, decidedBy, evidence {eventId, quote, date}, revision | resolver lines in `record/inbox/verdicts/` (0038); loop: [ARCHITECTURE_FORECAST_LOOP.md](ARCHITECTURE_FORECAST_LOOP.md) |
| `correction` | `corrects` (eventId), what was wrong, reason | builder exists; no input feeds it yet |
| `story_merged` | from, into (threadIds), reason, evidence; readers resolve transitively | review auto-merges, inbox `record/inbox/merges/` |
| `story_split` | from, into, reason; cancels the matching merge in the views | operator, inbox `record/inbox/splits/` |
| `run` | runId, status, counts: the day was processed | the writer itself |

`situation` stays deferred. Missing-day coverage is Run data, not a fact.

Drift notes, story analysis, country briefings and the story web stay raw daily notes: the review may cite them as input;
they are not facts and their old `read_changed`, `country_read_changed` and `link_confirmed` kinds no longer exist.

### Readings (one kind, `reading`, seven subtypes)
| subtype | payload (essentials) | replaces |
|---|---|---|
| `chapter` | name, one sentence, written with hindsight | event kind `chapter` |
| `branch_status` | branchId, fired/hold/dead/late/resurrected, evidence | event kind `branch_status` |
| `line` | the story's one-sentence line | event kind `line` |
| `link` | typed link between two stories (§4) | event kind `link_confirmed` |
| `merge_proposal` | another story that may be the same one | new |
| `alias` | actor variants, a canonical id and a Wikidata Q-number; a proposal until the who's who file applies it | new |
| `assignment` | an entry or a recovered article that belongs to another story (or a new one); a proposal, applied only through `record/inbox/assignments/` | new |

Common fields: `readingId` = sha1(kind + threadId + period), `schemaVersion`, `cites[eventId]`, `covers{from,to,precision}`,
`supersedes[readingId]`, `run`, `model`, `promptVersion`, `label`, `confidence`, `status` accepted|rejected (+ reason).
Acceptance is mechanical: cites at least one fact, every cited ID exists, and the covered dates fall inside the cited
facts. A rejected reading is kept with its reason. Coverage information (missing days, stamps) belongs in the Run, not as
a fact.

## 4. Object model
Every object has a stable ID and a `schemaVersion`.
| Object | ID | Key fields | Links to |
|---|---|---|---|
| Story | `threadId`; a `story_merged` fact points a duplicate at the survivor (like Wikipedia redirects); an entry's story is its latest `assignment` | born, title, status | facts, readings, countries, actors |
| Fact (event) | `eventId` = sha1(kind + sourceKey); entries by canonical url (0036 §3) | kind, at, precision, payload | story, countries, actors, sources |
| Country | `iso3` | name | facts, stories |
| Actor | `name:<normalized>` (`normalizeActor` in `backend/shared/src/record.js`) in facts; the views map variants to a canonical `wd:Q…` id through the who's who file (`record/operator/aliases.json`, operator-owned; the review and `cli/reconcile-actors.mjs` only propose); entries marked generic never ground a link | name | facts |
| Source/outlet | `sourceId` = sha1(registrable domain) | outlet (from `backend/shared/src/outlets.js`); source types deferred | facts. "Fired needs two distinct outlets" depends on it |
| Branch | `branchId` (inside a `forecast_drawn` fork) | text, trigger, resolution source, due date, verdict; status (fired/hold/dead/late/resurrected) is a reading; a question/outcome shape is deferred | story, `forecast_drawn` fact, `branch_status` readings |
| Reading | `readingId` = sha1(kind + threadId + period) | subtype, cites, covers, supersedes, run, model, promptVersion, label, confidence, status | facts, earlier readings, Run |
| Typed link | readingId (subtype `link`) | type from a fixed list: causes, responds_to, same_actor, escalates, contradicts | two stories; cites facts on both sides |
| Run | `runId` (`YYYY-MM-DD-n` daily, `YYYY-Www` weekly) | period, inputs, counts, failures; review Runs add model, promptVersion, rejections | readings, Period |
| Period | `2026-W43`, `2026-10` | week or month | readings, the board weekly and the weekly report join on it |

Later: Situation (a group above stories), Place below country (coordinates), Indicators (dated numbers with a source).
Not needed now: country views.

## 5. Views and stores
Views (0037) live under `record/views/` (shadow: `record/shadow/views/`), each with `schemaVersion: 1` and
`builtFrom: {factsThrough, readingsThrough}`; reading-derived fields are `null` with a reason until a reading exists.
| View | Built from | Stored as | Read by |
|---|---|---|---|
| Story | facts (+ accepted readings) for one `threadId`; a merged story is `{aliasOf}` only | `record/views/stories/{threadId}.json` | story tree, board |
| Active index | stories with any fact in the last 60 days | `record/views/index/active.json` | board pins, weekly selection |
| All index | every story, same row shape (cap 5 MB, else the run fails) | `record/views/index/all.json` | search, story list |
| Links | cheap grounds (specific shared actors and countries, 14-day window) with other active stories; `confirmedLinks` from link readings | `record/views/links/{threadId}.json` | board arrivals |
| Daily counts | articles, new entries, branches due, verdicts per story per day (facts only) | `record/views/counts/{date}.json` | board's unsettled zone |
| Manifest | written last, so a reader that sees it sees a complete set | `record/views/manifest.json` | alarm on its age |
| Weekly report | the week's readings | `weekly/YYYY-MM-DD.json` | weekly page and email |
| Board | readings and counts for your pins and strings | computed on request (`newsBoard`) | board |
| Track record | `forecast_drawn`, `branch_status`, `verdict` | `predictions/track_record.json` (today) | track record page |

Stores (one writer per file; `quality`-checked list in `rules/DATA_STRATEGY.md` §4):
- `record/facts/YYYY-MM-DD.jsonl`, `record/facts/manifest.json` (days present): `newsStoryRecord`.
- `record/runs/YYYY-MM-DD.json` (daily Run): `newsStoryRecord`. `record/runs/review-YYYY-Www.json` (review Run): `newsRecordReview`.
- `record/readings/YYYY-Www.jsonl`: `newsRecordReview`.
- `record/inbox/<kind>/YYYY-MM-DD.jsonl`, read by `newsStoryRecord` for the run day and six days before, kept as replay input:
  `articles` (selector, raw capture; also the recovery script, 0040), `verdicts` (resolver, 0038), `merges` (review auto-merges),
  `splits` (operator), `assignments` (operator and approved review proposals; ingest assignments are derived by the facts writer, not inboxed).
- `record/operator/aliases.json`: the who's who file, operator only, applied to actor ids in the views.
- `record/views/...`: `newsStoryRecord`. `record/fixtures/golden-week/`: frozen facts for the review, by hand.
- `weekly/YYYY-MM-DD.json`: the weekly.
The scheduled run writes live (`{"shadow":false}`); a manual invoke defaults to `shadow:true` and writes the same bytes under `record/shadow/` (a prefix change, not a code change). Views are rebuilt in full from the facts manifest every time (plain PutObject; derived,
replaceable). The Worker serves only `record/views/` (0037 §4), never facts, runs, inboxes or readings.

## 6. Who writes, who reads (each writer is the only writer of its files)
- **Facts and the daily Run:** only `newsStoryRecord` (`backend/record/`), from raw tables through `backend/shared/src/world/` and from the inboxes.
  No model, no DynamoDB write. The one way another producer reaches the facts is the **inbox rule** (0038 amendment): it appends lines to
  `record/inbox/<kind>/DAY.jsonl` and `newsStoryRecord` converts them. Writers: the selector `newsInvokeGemini` → `articles` (before its model call);
  the resolver `newsPredictionResolver` → `verdicts`; the review → `merges`; the operator → `splits` and `assignments`.
- **Readings and review Runs:** only `newsRecordReview` (`backend/record/`). Writes `record/readings/*`, `record/runs/review-*` and `record/inbox/merges/*`.
  It reads facts, views index and manifest, its own earlier readings and the who's who file (0039). Merge, alias and assignment items are proposals;
  only a merge that passes the merge rule reaches the inbox.
- **The operator** writes `record/operator/aliases.json`, `record/inbox/splits/` and `record/inbox/assignments/`; nothing else writes them.
- **Views (0037):** `newsStoryRecord` builds all of them after each daily append, in the same invocation, from facts, readings, inbox merges, splits,
  assignments and the who's who file. No view is written by anything else.
- **Reads raw tables:** only `backend/shared/src/world/` (injected client, so the same code runs in a Lambda and a local
  script). Consumers import it through `_shared` and never parse a raw row themselves; until a view exists a consumer may read
  through `world/` and says so in its README.
- **Everyone else reads views.** `newsBoard` (`backend/board/`) owns only `GlobalPerspectiveSavedItems` board items and
  `GlobalPerspectiveUserPrefs` `followedThreads`/`followedActors`; the weekly (`backend/weekly/`) owns `weekly/*`; the
  resolver (`newsPredictionResolver`) writes `Q#` rows in the prediction log and the verdict inbox (0034, 0038). Two Lambdas never write the same prefix or table field; when a
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
- **Review deployed, not running** (step 3): `newsRecordReview` is created in AWS (2026-10-23) and rule `TriggerRecordReview` (Monday 01:00 UTC) is disabled; no readings yet (first live run waits for the DeepSeek top-up, the golden-week score and a canary). Until readings exist the reading fields of the views are `null` with a reason. Not built: the `newsSystemsAnalysis` link field (dropped, the review writes links).
- **Entry time precision**: live entries stay day precision while archive rows lack `publishedAt`.
- **Who's who file empty**: `record/operator/aliases.json` is operator-owned and not written yet, so actors keep `name:` ids in the views; `cli/reconcile-actors.mjs` proposes entries.
- **Forecast loop**: the draw rules are deployed; the resolver's loop code (watch, own-entry evidence, coverage guard, verdict inbox) is deployed (2026-10-23), waiting on DeepSeek funding for model drafts; the legacy void job and the one-time redirect for historical orphan forecasts wait for the operator.
- **Raw-row parsers outside `world/`** (step 4): most Lambdas still parse raw rows themselves; the same concept is defined
  several times (risk tier, story title, freshness, outlet from host, Firebase JWT check). Retire list: plan "Retire list".
- **Source gaps the facts inherit**: `topicId` is unstable across runs; a legacy script still edits verdicts in place;
  `threads.mjs merge/split` rewrites rows in place (a merge on the record is a `story_merged` fact from the merges inbox, which only the review feeds, and it has not run live yet). Fixed by
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

Live state per stage, with deployed versus merged: `project-docs/STATUS.md` and the plan. A design discussion
is not a build go-ahead: each step waits for its own go.
