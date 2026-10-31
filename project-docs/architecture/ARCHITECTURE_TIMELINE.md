# The record: facts daily, readings weekly, notes and many views

The one record design doc and the system's core model. Every backend group and frontend feature README links here and says which facts, readings or notes it writes and which views it reads. Decisions that bind it: [0035](../decisions/0035-facts-are-the-system-of-record.md) (facts are the system of record), [0036](../decisions/0036-facts-file-format.md) (facts file format), [0037](../decisions/0037-views-from-facts.md) (views), [0038](../decisions/0038-forecast-loop.md) (forecast loop), [0039](../decisions/0039-weekly-review.md) (weekly review), [0040](../decisions/0040-raw-before-model.md) (raw before model), [0042](../decisions/0042-notes-move-to-the-record.md) (model notes), [0047](../decisions/0047-history-before-record.md) (history before the record), [0048](../decisions/0048-briefs-in-the-record.md) (briefs). Code and live AWS are the truth for what is deployed and enabled; the stage list as data is `pipeline.json`; storage rules are `DATA_STRATEGY.md`; the facts writer's field-level detail is `backend/record/newsStoryRecord/README.md`; dated state ("where we left off") is `START_HERE.md`.

## 1. The idea
Everything the site knows about the world is dated and append-only, and is one of three things: a **fact** (something happened, written by code with no model), a **reading** (what we understand it to have meant, written weekly with hindsight) or a **note** (model text about something the record already names, written when the model runs, decision 0042). Every page is a **view** of these. A page never stitches its own picture from raw tables.

```
  selector --> record/inbox/articles/ ----+
  raw pipeline tables --> world reader ---+--> facts writer --> record/facts/YYYY-MM-DD.jsonl   (daily, no model)
  (existing Lambdas)      (shared/world)      (newsStoryRecord)     record/runs/YYYY-MM-DD.json  (the Run)
  resolver --> record/inbox/verdicts|draws/ +                  ^ inbox: merges, assignments, splits
                                                                |
  week's facts --> review (newsRecordReview) --> record/readings/YYYY-Www.jsonl, record/runs/review-YYYY-Www.json
                                                                |
  model Lambdas --> record/notes/<subtype>/YYYY-MM-DD.jsonl  (each writer its own subtype)
                                                                |
  views rebuilt from facts + readings + notes (newsStoryRecord): record/views/ --> Worker /data/record/views/ --> pages
```

## 1a. The foundation at a glance
```text
WORLD  S3 record/ (one writer per file)              USERS  DynamoDB            SCREEN  Worker /data/*

1 INGEST   backend/pipeline, backend/situations · model · 3x/day
     articles -> stories -> archive rows (raw tables, read only through backend/shared/src/world/)
     every fetched article -> record/inbox/articles/ before the model call (0040): a model outage cannot lose the news
     the model Lambdas write their notes to record/notes/ (0042)
2 COMMIT   backend/record/newsStoryRecord · no model · daily 23:45 UTC
     record/facts/DAY.jsonl   entry · article · assignment · story_born · forecast_drawn · question_commit · question_draw · verdict · story_merged · story_split · correction · run
     record/runs/DAY.json     started -> ok | partial | failed (a missing input is recorded, never filled)
     record/inbox/<kind>/DAY.jsonl  hand-off from other writers, read nightly and turned into facts
     recovery: a missed day is rebuilt from public records (GDELT GKG raw files, Wayback) into labelled facts, no forecasts (0040)
     forecast loop (0038, ARCHITECTURE_FORECAST_LOOP.md): draw, watch, gather, judge, record
3 REVIEW   backend/record/newsRecordReview · model · weekly, Monday 01:00 UTC (ARCHITECTURE_WEEKLY_REVIEW.md)
     record/readings/WEEK.jsonl  line · chapters · confirmed links · merge, alias and assignment proposals
4 BUILD    newsStoryRecord, the only view builder · no model · after each daily append
     record/views/  stories/{id} · links/{id} · counts/DAY · countries/{ISO3} · briefs/daily|weekly · index/* · track-record · manifest (written last)
5 SERVE    Cloudflare Worker, allow-list record/views/* (ETag, 5 min cache) -> the pages

WATCH  every run writes a Run object (backend/monitoring); the operator does not want pipeline alarms (§7)
```
Ten detailed stages map onto five: Ingest = 1-3, Commit = 4-5, Review = 6, Build = 7-8, Serve = 9, Watch = 10. Rebuild test: delete every view in a copy and the views rebuild from `record/facts/` + `record/readings/` + `record/notes/` (`backend/record/newsStoryRecord/scripts/rebuild-test.js`; the result and date are in `START_HERE.md`). Removing the world rows from DynamoDB is the later, destructive step 5 of the plan (`STEP5_AUDIT.md`).

## 1b. The pipeline, stage by stage
`pipeline.json` is the machine-readable copy and drives the block in every folder README.

| # | Stage | What runs | Produces |
|---|---|---|---|
| | **Daily, no model** | | |
| 1 | Ingest | selector `newsInvokeGemini` 3x/day (26 feeds, up to 25 items each fetched, 8 per feed in the prompt, done-not-said rule, code dedupe, significance floor); map ingest `newsSituationIngest` hourly, `newsGdacsIngest` every 20 min | topics; raw articles in `record/inbox/articles/`; map clusters; disaster alerts |
| 2 | Stories | `NewsProjectInvokeAgentLambda` joins topics to threads, draws at most 3 outcomes per story per week, reconciles each `PRED#` row to the entry's final thread; `newsSituationTracker` | threads, daily archive, forecasts (`PRED#`), map pins |
| 3 | Daily notes | the agent (entry summary, forecast and cause texts), `newsThreadAnalysis` (story analysis), `newsDriftCorrector` (drift), `newsCountryIntelligence` (country briefings), `newsSystemsAnalysis` (story web), `newsPostDevTo` and `newsWeeklyBrief` (briefs); the forecast watch and judge `newsPredictionResolver` | notes in `record/notes/<subtype>/` (the DynamoDB rows are still written beside them until step 5); verdict and draw lines in `record/inbox/verdicts/` and `record/inbox/draws/` |
| 4 | One reader | `backend/shared/src/world/` | normalised rows with provenance; the only parser of raw tables |
| 5 | Facts | `newsStoryRecord` reads the world reader and every inbox | `record/facts/YYYY-MM-DD.jsonl`, the daily Run, then the views |
| | **Weekly, Monday 01:00 UTC after the ISO week ends** | | |
| 6 | Review | `newsRecordReview` reads the week's facts per active story | `record/readings/YYYY-Www.jsonl`, `record/runs/review-YYYY-Www.json` |
| 7 | Views | rebuilt from facts, readings, notes and the who's who file by `newsStoryRecord` | `record/views/` |
| 8 | Weekly report | `backend/weekly` (content model only; the pull, check and publish scripts are on unmerged branches) | `weekly/YYYY-MM-DD.json`, a view of the readings (not built) |
| | **Always** | | |
| 9 | Delivery | pages read views through the Worker (§6 lists which); the rest still read DynamoDB through the `newsSensitiveData` proxy or S3 `world/` JSON; email and posts (`backend/distribution`) | what readers see |
| 10 | Watch | `backend/monitoring` | monitor Lambdas; Run objects are the record's own signal |

On demand: re-run the review on a past week after an algorithm fix; the new readings supersede the old.

## 1c. Two clocks
Facts are daily and need no model: the record keeps growing from raw rows and inboxes whatever the model providers do. Readings are weekly and need hindsight: a week of facts is read once the ISO week has ended. Notes follow the clock of the Lambda that writes them (daily, hourly or weekly) and are never needed to build the facts. A view is rebuilt in full after every daily append, so a page shows the newest facts the night they land, the newest readings the night after the review, and a note the night after it is written.

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

Each day also has a Run (`record/runs/YYYY-MM-DD.json`: status `started|ok|partial|failed`, `inputs.archiveDay` `present|missing|thin`, counts, failures). The Run is the one mutable object and holds no world data. A day with no archive row gets a failed Run and no facts, except a recovered day (`recovery:true`), whose missing archive is expected (`inputs.recovered:true`, status ok).

**Extent.** The facts start 2026-03-07, the first day of the archive. The days before the live replay began (2026-09-06) were copied in from the archive by replaying them through the nightly code (decision 0047; `backend/record/cli/backfill-history.mjs`, checked by `check-history.mjs`), so they carry the same facts, with these differences: no `iso3`, no actors and no `publishedAt` on any of those entries (`precision: day`; the archive row's places text is kept as `payload.regions`; deriving `iso3` from it is an open operator decision), and days where the archive had no row at all stay empty with a `failed` Run (`archiveDay: missing`). Forecasts that no rule can place on a story are not facts: the whole DynamoDB row is kept under `record/legacy/predictions/` (below). `record/facts/manifest.json` lists the days; read it for the first and last day.

## 3. Kinds
### Facts
| kind | payload (essentials) | comes from |
|---|---|---|
| `entry` | title, summary, category, eventType, continuesTopic, `topicId` as seen (not an ID), source snippet, tier and actor names on newer entries, `regions` on history entries | `NewsCache archive#` rows (agent Lambda) |
| `article` | url, outlet, title, snippet, publishedAt, feed; recovered ones carry `recoveredAt`, `recoveredFrom`. In no story until assigned | selector inbox `record/inbox/articles/`; recovery script |
| `assignment` | entryId (an `entry` or `article` fact), threadId, by (ingest, review, operator), supersedes; the views follow the latest per entry | derived from every `entry` (by ingest); operator and approved review proposals through `record/inbox/assignments/` |
| `story_born` | first title | derived: earliest `entry` per threadId |
| `forecast_drawn` | forkId, branches {branchId, text, p, trigger, resolutionSource, due, qid}; a history forecast placed by title carries `threadFrom: "title"` | `PredictionLog PRED#` (the facts run scans the 30-day window) |
| `verdict` | qid, result yes/no/void, voidReason, decidedBy, evidence {eventId, quote, date}, revision | resolver lines in `record/inbox/verdicts/`; the legacy void job writes `issued_before_method` voids |
| `correction` | `corrects` (eventId), what was wrong, reason | builder exists; no input feeds it yet |
| `question_commit`, `question_draw` | the week's seed hash; the revealed seed and sampled qids (threadId null, 0043) | resolver lines in `record/inbox/draws/` |
| `story_merged` | from, into (threadIds), reason, evidence; readers resolve transitively | review auto-merges via `record/inbox/merges/` |
| `story_split` | from, into, reason; cancels the matching merge in the views | operator, `record/inbox/splits/` |
| `run` | runId, status, counts | the writer itself |

`situation` stays deferred.

### Notes (decision 0042; schema `backend/record/schema/note.schema.json`, builders in shared `notes.js` and `briefNotes.js`)
A note is model text or a model judgment about a subject the record names, never a fact; the views label it as model text with its time and model. One line per note in `record/notes/<subtype>/YYYY-MM-DD.jsonl` (UTC day of `at`), a manifest per subtype, one writer per subtype, append-only; a newer note of the same subject and part replaces the older in the views.
| subtype | subject | writer | in the views |
|---|---|---|---|
| `entry` | an entry fact; parts summary, prediction, cause | the agent; archive copies by backfill (`from: archive`, model null) | story view entries |
| `story_analysis` | a story | `newsThreadAnalysis` | story view `analysis`, `index/analyses.json` |
| `drift` | a country or a story | `newsDriftCorrector` | story view `driftNote`; country view (newest only) |
| `country` | a country; parts briefing and systems | `newsCountryIntelligence` | `countries/{ISO3}`, `index/countries.json` |
| `link` | a story pair | `newsSystemsAnalysis` | `links/{id}` `judgedLinks`, `index/web.json` |
| `web` | a country's story web | `newsSystemsAnalysis` | `links/{id}` `web`, `index/web.json` |
| `daily_brief` | a day | `newsPostDevTo` | `briefs/daily/{date}`, `index/briefs.json` |
| `weekly_brief` | a week | `newsWeeklyBrief` | `briefs/weekly/{weekOf}`, `index/briefs.json` |
Each writer sends its notes to `<NOTES_PREFIX>notes/...`; the code default is `record/shadow/`, and the live Lambda environment decides (read it with `aws lambda get-function-configuration`: the first five writers above hold `record/`; the two brief writers hold no value and so write no notes yet, their existing briefs came from `backend/record/cli/backfill-brief-notes.mjs`). Backfill CLIs for each subtype are in `backend/record/cli/`. The DynamoDB rows are still written beside the notes until step 5. Drift depth beyond the newest note is a member perk and stays on the gated `country_history` action; views are public.

### Readings (one kind, `reading`, six subtypes)
| subtype | payload (essentials) |
|---|---|
| `line` | the story's one-sentence line |
| `chapter` | title, summary; `from`/`to` are the dates of its cited facts, set by code |
| `link` | typed link between two stories: otherThreadId, mechanism, direction drives\|driven_by\|shared_cause |
| `merge_proposal` | another story that may be the same one |
| `alias` | actor variants, a canonical id, a Wikidata Q-number; a proposal until the who's who file applies it |
| `assignment` | an entry or recovered article that belongs to another story; a proposal, applied only through `record/inbox/assignments/` |

Common fields: `readingId` = sha1(week + threadId + subtype + key), `cites[eventId]`, `covers{from,to}`, `supersedes`, `run`, `model`, `promptVersion`, `confidence`. Acceptance is mechanical: at least one citation and every cited ID exists in the story's bundle; a rejected item is kept in the review Run with its reason. There is no branch-status reading (0039 amendment, 2026-10-31): a branch's status is its verdict fact, else open or past due by its due date, derived where shown. The review reads facts and its own earlier readings, not notes.

## 4. Object model
Every object has a stable ID and a `schemaVersion`.
| Object | ID | Notes |
|---|---|---|
| Story | `threadId`; a `story_merged` fact points a duplicate at the survivor; an entry's story is its latest `assignment` | topic ids change every run, thread ids are stable |
| Fact | `eventId` = sha1(kind + sourceKey); entries by canonical url | |
| Note | `noteId` = sha1('note\|' + subtype + subject + part + at) | subject is an `eventId`, `threadId`, ISO3, `pairKey` or `daily:DATE` / `weekly:DATE`; never a title or `topicId` |
| Country | `iso3` | |
| Actor | `name:<normalized>` in facts; views map variants to `wd:Q…` through the who's who file `record/operator/aliases.json` (operator-owned; the review and `backend/record/cli/reconcile-actors.mjs` only propose); generic actors never ground a link | |
| Source | `sourceId` = sha1(registrable domain) | outlet name from `backend/shared/src/outlets.js` |
| Branch | `branchId` inside a `forecast_drawn` fork | text, trigger, resolution source, due date; verdict is a fact |
| Reading | `readingId` | see §3 |
| Run | `YYYY-MM-DD` daily, `review-YYYY-Www` weekly | inputs, counts, failures; review Runs add model, promptVersion, rejections, `notReached` |
| Period | `2026-W43`, `2026-10` | readings, the weekly report and the board join on it |

Later: Situation (a group above stories), place below country, indicators.

## 5. Views and stores
Views live under `record/views/` (shadow: `record/shadow/views/`), each with `schemaVersion: 1` and `builtFrom: {factsThrough, readingsThrough}`; reading-derived fields are null or empty with a reason until a reading exists. Field-level shapes and size caps: `backend/record/newsStoryRecord/schema/views/` and its README.
| View | Built from | Stored as |
|---|---|---|
| Story | facts, readings and notes for one `threadId`: entries (newest 400) with their notes, forks with each branch's latest verdict, question scoring and state, merges, corrections, line, chapters, `analysis`, `driftNote`; a merged story is `{aliasOf}` only | `stories/{threadId}.json` |
| Active index | stories with any fact of their own in the last 60 UTC days | `index/active.json` |
| All index | every story, same row shape (over 5 MB the build fails) | `index/all.json` |
| Links | one per story: `judgedLinks` and `web` from notes, cheap grounds with other active stories (specific shared actors, countries, sources; 14-day window), `confirmedLinks` from link readings | `links/{threadId}.json` |
| Daily counts | articles, new entries, branches due, verdicts per story per day, from facts only | `counts/{date}.json` |
| Country | notes only: newest drift note, briefing, systems | `countries/{ISO3}.json` |
| Briefs | the newest `daily_brief` / `weekly_brief` note of each day or week; drafts never | `briefs/daily/{date}.json`, `briefs/weekly/{weekOf}.json` |
| List indexes | the page lists cut from notes and facts, each a 2 MB cap: analyses, web, countries, weekly (30-day archive by day), briefs | `index/analyses.json`, `index/web.json`, `index/countries.json`, `index/weekly.json`, `index/briefs.json` |
| Track record | `forecast_drawn`, `question_*`, `verdict` facts (decision 0044) | `track-record.json` |
| Manifest | written last, so a reader that sees it sees a complete set | `manifest.json` |
| Weekly report (planned) | the week's readings | `weekly/YYYY-MM-DD.json` |
| Board | your pins and strings over the views | computed on request by `newsBoard` |

Stores (one writer per file; the full prefix table is `DATA_STRATEGY.md`):
- `record/facts/`, `record/runs/YYYY-MM-DD.json`, `record/views/`: `newsStoryRecord`.
- `record/readings/`, `record/runs/review-*`, `record/inbox/merges/`: `newsRecordReview`.
- `record/notes/<subtype>/`: the writer of that subtype (§3).
- `record/inbox/articles/`: the selector (and the recovery script); `verdicts/` and `draws/`: the resolver; `splits/` and `assignments/`: the operator (and approved review proposals). `newsStoryRecord` reads each inbox for the run day and six days before.
- `record/operator/aliases.json`: the operator.
- `record/legacy/predictions/DAY.jsonl` (+ manifest): whole DynamoDB `PRED#` rows from before the record that no rule places on a story, copied once by the history job (0047) with the reason; not facts, not read by the views, kept so the table can be deleted.
- `record/shadow/` and `record/shadow-history/`: rehearsal copies written by manual shadow invokes and the history job; never served.
- The golden-week fixture for the review lives in the repo, `backend/record/newsRecordReview/fixtures/golden-week/`.
The scheduled run writes live (`{"shadow":false}`); a manual invoke defaults to `shadow:true` and writes the same bytes under `record/shadow/`. Views are rebuilt in full from the facts manifest every time. The Worker serves only `record/views/` (0037 §4), never facts, runs, inboxes, notes, readings or legacy.

## 6. Who writes, who reads
- **Facts and the daily Run:** only `newsStoryRecord`, from raw tables through `backend/shared/src/world/` and from the inboxes. No model, no DynamoDB write. Another producer reaches the facts only through the inbox rule: it appends lines to `record/inbox/<kind>/DAY.jsonl` and `newsStoryRecord` converts them.
- **Readings and review Runs:** only `newsRecordReview`. It reads facts, the views index and manifest, its own earlier readings and the who's who file; it writes no view and no fact.
- **Notes:** each subtype only by its writer (§3), through shared `notes.js`.
- **The operator** writes `record/operator/aliases.json`, `record/inbox/splits/` and `record/inbox/assignments/`.
- **Views:** only `newsStoryRecord`.
- **Raw tables:** read only by `backend/shared/src/world/`; consumers import it through `_shared`. Until a view exists for a page, the page reads through `world/` or the proxy and its README says so.
- **Pages read views.** From the code (each feature README has the exact reads and the fallback to the old action): the board (`newsBoard` server side, the browser for stories, links and counts); the story page (timeline, analysis, forecast, "fed into"); the Stories page and its map and web (`index/weekly.json`, `analyses.json`, `web.json`); the country pages and list (`countries/{ISO3}`, `index/countries.json`); `/track-record` (`track-record.json`); the briefings hooks (`briefs/` views, with the action for what the views do not yet hold). Still on DynamoDB or S3 `world/`: the today page, the map's situations, the account desk, country history depth, the corrections feed, the Cloudflare Worker's pre-render and the email sender (`DAILY_BRIEF#`, `WEEKLY_BRIEF#`). The weekly (`backend/weekly/`) will own `weekly/*`; the resolver writes `Q#` rows in the prediction log and the verdict and draw inboxes. When a reader needs something a writer lacks, the fix is in the writer. Which release is live: `START_HERE.md`.

Each `backend/<group>/README.md` and `features/<name>/README.md` carries a generated pipeline block (from `pipeline.json`); `quality/check_docs.mjs` fails a README whose block is missing or stale.

Words: **topic** = one item the selector picks in a run; **thread / story** = the editorial arc (`thread-<slug>-<hash>`), what every page and doc means by "story"; **cluster** = the map pipeline's internal headline group (not a story); **situation** = a map pin. Three layers never reach into each other except through published files: the **record** (`backend/record/`, S3 `record/`), the **weekly** (`backend/weekly/`, S3 `weekly/`, `features/weekly/`), the **board** (`backend/board/`, user DynamoDB items, `features/board/`).

Invariants: (1) one writer per prefix and per table field. (2) Facts, readings and notes are dated and never rewritten; `latest` objects are pointers. (3) No human gate on verdicts (0034): the operator disputes by appending a correction; a wrong result is an algorithm bug. (4) A reading carries a confidence and the facts it cites; pages render labels from the record and never infer them. (5) The browser reads world data only through the Worker's `/data/*`. (6) The weekly is published by its run and sent unless the week's file says `held`. (7) A Lambda error leaves the previous views in place; the next run catches up (idempotent per date and per period).

## 7. Open design items
Dated state (what is deployed, which rule is enabled, which release is live) comes from AWS and `START_HERE.md`.
- **Step 4, pages onto views:** what is left is listed in `START_HERE.md` (entries and forecasts inboxes, a "today" view for home, `/today` and the board, readers for country history depth, corrections, country facts and the Worker). Each page keeps its action as a fallback until its view is live.
- **Step 5, retire the world tables** (`STEP5_AUDIT.md`): SummarizeAndPredict, NewsCache, GlobalPerspectiveMarkets and the PredictionLog `PRED#` rows go once no reader is left, each deletion on its own operator yes. User tables, EMAILLOG, BreakingAlerts, ClientErrors and the PredictionLog commitment state stay. The economy product is retired (decision 0049): its Lambdas and rules are deleted, and only its data awaits deletion. Before the rows go, the full rebuild test: delete the world rows in a copy and prove the site rebuilds from the record.
- **Briefs writers:** `newsPostDevTo` and `newsWeeklyBrief` write briefs to the record once their `NOTES_PREFIX` is set (needs their S3 IAM statements); the email sender and the Worker read the DynamoDB rows until each reads the record or is retired (0048).
- **Alarms:** the operator does not want pipeline alarms; Run objects are the record's own signal and the freshness monitor watches the public topics.
- **Weekly report** still has to be built on the readings (ARCHITECTURE_WEEKLY_REVIEW.md §9).
- **History `iso3`:** entries before 2026-09-12 carry `iso3:[]`/`actorIds:[]`; deriving countries from `regions` is open (operator).
- **Who's who file:** actors keep `name:` ids until `record/operator/aliases.json` names them; `reconcile-actors.mjs` proposes entries.
- **Record data:** over-joined threads and duplicate stories the review cannot merge without neighbours; the review flags off-story entries as assignment proposals for the operator to apply.
- **Backfills:** the gap-benchmark answer key was lost on 2026-10-25 and must be rebuilt or dropped.
- **Feeds** for Latin America and Southeast Asia wait on operator-supplied URLs.
- **Map ingest drops unclassified articles silently**, and the tracker then closes pins for lack of data, so "no data" reads as "ended" (ARCHITECTURE_INGEST_DESIGN.md §4).
- **Raw-row parsers outside `world/`:** some Lambdas still parse raw rows themselves, so a concept (risk tier, story title, freshness, outlet from host, Firebase JWT check) can be defined more than once; they move to `world/` as touched.
- **Retire list** (each deletion needs its own operator yes, after the rebuild test): `DRIFTLOG#`, `situations/history`, `WEB#INDEX` / `LATEST`, `tags/backfill`, `world/shadow`, `signals/snapshots`, the Scans in `newsSensitiveData`.
- **Open questions:** one ingest or two; consolidate the five user tables.
- **Source gaps the facts inherit:** `topicId` is unstable across runs; a legacy script still edits verdicts in place; `backend/pipeline/cli/threads.mjs merge/split` rewrites rows in place (on the record a merge is a `story_merged` fact).

## 8. Decided (operator, 2026-10-21)
Two clocks, ten stages, the object model and the stores. Facts are the system of record; the five-stage picture is the top level and the ten stages are the detailed mapping. Notes (0042) are the third object, added 2026-10-31. A design discussion is not a build go-ahead: each step waits for its own go.
