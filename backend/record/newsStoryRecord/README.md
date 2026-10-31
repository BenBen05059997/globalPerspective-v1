# newsStoryRecord

The facts writer. Each run appends one UTC day's facts, with no model, to `record/facts/YYYY-MM-DD.jsonl` and writes that day's Run object to `record/runs/YYYY-MM-DD.json`. After the append it rebuilds the views under `record/views/` from every facts day ([decision 0037](../../../project-docs/decisions/0037-views-from-facts.md)). Format and rules: [decision 0036](../../../project-docs/decisions/0036-facts-file-format.md); design: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md) (§1c two clocks, §6 writers). Lines, chapters, branch status and confirmed links are readings written weekly by `newsRecordReview` (step 3); this Lambda is the only view builder and reads them (below).

## What a run does

1. Writes `runs/DATE.json` with `status:"started"` (a Run left at `started` with no `finishedAt` is the alarm).
2. Reads through shared `world/` only: `archive#` rows for the 30 days to DATE, the `today-archive` entries archived on DATE, `PRED#` snapshots of the day's topics, the resolver's verdict inbox (`inbox/verdicts/`) and the merge and split inboxes (`inbox/merges/`, `inbox/splits/`) and the selector's article inbox (`inbox/articles/`) and the assignment inbox (`inbox/assignments/`), each the run day and 6 days before. No table is read for verdicts, no scan, no listing.
3. Builds facts and drops those already stored (it reads the last 100 days of fact files, so a re-run is a no-op and the same article listed again on a later day is not a second fact).
4. Appends each fact to the file of its own day (the UTC date of `at`), registers the days in `facts/manifest.json`, appends a `run` fact, and overwrites the Run with `ok`, `partial` or `failed`.
5. Throws when the Run is not `ok` (daily mode), so the schedule's Errors metric moves. A missing archive day is a `failed` Run with `inputs.archiveDay:"missing"`, never `ok`.

| Fact kind | From | Notes |
|---|---|---|
| `entry` | one archive entry | `eventId = sha1('entry' + smallest canonical source url)`; `summary` is null (the row has none); `at` is the earliest valid `sources[].publishedAt` with `precision: exact`, else `archivedAt` with `precision: day` (see Choices) |
| `story_born` | the first entry of a thread in the window, on its birth day | `windowLimited` and `missingBefore` say what the window could not see |
| `forecast_drawn` | one `PRED#` snapshot | branches with `branchId`, `p` (percent), `trigger`, `resolutionSource`, `due`, `qid` |
| `verdict` | each line of `record/inbox/verdicts/YYYY-MM-DD.jsonl` written by the resolver (`yes`, `no`, `void`) | `eventId = sha1('verdict' + qid + revision)`, `at = decidedAt`; thread and branch come from the line, else from the question's `forecast_drawn` fact (100-day lookback); revision 2 or more is a correction and a second fact. `voidReason` `issued_before_method` with `decidedBy:"operator-job"` and `qid:null` marks the legacy void (below) |
| `story_merged` | each line of `record/inbox/merges/YYYY-MM-DD.jsonl` (the review's auto-merges: `{from, into, at, reason, cites, readingId}`) | `eventId = sha1('story_merged' + from + into + at)`; `threadId = into`; `evidence = cites` as `[{eventId}]`; `readingId` kept in the payload |
| `story_split` | each line of `record/inbox/splits/YYYY-MM-DD.jsonl` (operator only: `{from, into, at, reason}`) | `eventId = sha1('story_split' + from + into + at)`; `threadId = into`; undoes the matching merge in the views |
| `assignment` | (a) every fresh `entry` fact, derived in the same run: `{entryId, threadId, by:'ingest', supersedes:null, reason:null}` to the entry's archive thread, `at` and `precision` = the entry's; (b) each line of `record/inbox/assignments/YYYY-MM-DD.jsonl` (`{entryId, threadId, by:'operator'\|'review', at, reason, supersedes?}`) | `eventId = sha1('assignment' + entryId + threadId + by + at)`; envelope `threadId` = the assigned story; `entryId` is the id of the fact being placed: an `entry`'s `eventId`, or an `article` fact's (`sha1('article' + canonical url)`); `sourceIds`, `iso3`, `actorIds` empty. The latest assignment of an entry decides its story in the views (Views) |
| `article` | each line of `record/inbox/articles/YYYY-MM-DD.jsonl` (the selector's raw articles: `{schemaVersion, rawId, url, canonicalUrl, title, outlet, feed, publishedAt, fetchedAt, snippet, lang}`, recovered ones also `recoveredAt`, `recoveredFrom`) | `eventId = sha1('article' + canonicalUrl)` (a live and a recovered copy are one fact); `at = publishedAt` (`exact`) else the start of the `fetchedAt` day (`day`); `sourceIds` from the url's registrable domain; `threadId` null, `iso3` and `actorIds` empty; payload `{url, canonicalUrl, title, outlet, feed, snippet, lang, recoveredAt, recoveredFrom}`. Not an entry: it is in no story and no index |
| `correction` | nothing yet | builder in `src/facts.js`; written when an operator input exists |
| `run` | the Run | appended every run, failures included |

IDs: [`record.js`](../../shared/src/record.js) (`canonicalUrl`, `entryIdentity`, `sourceIdOf`, `actorIdOf`, `factId`) and [`outlets.js`](../../shared/src/outlets.js) (`registrableDomain`, `TWO_LEVEL_SUFFIXES`). Missing inputs are recorded as missing: `iso3:[]` and `actorIds:[]` before about 2026-09-12, `summary:null`, `outlet:null` for an unknown outlet.

## Views

After the facts and before the Run is finalised, `src/publish.js` reads every day in `facts/manifest.json` (plus the days this invocation wrote), `src/views.js` (pure, no I/O) builds the view objects, and they are written with plain `PutObject` under `record/views/` (shadow: `record/shadow/views/`). A backfill builds once, after its last day. Write order, so a reader that sees a new manifest sees a complete set: `stories/*`, `links/*`, `counts/*`, then `index/active.json`, then `index/all.json`, then `manifest.json` last. A write failure stops the sequence (the old manifest stays; its age is the alarm), marks the Run `partial` with `failures:[{stage:'views'}]`, and leaves the facts as written.

| View | Content |
|---|---|
| `index/active.json`, `index/all.json` | `{schemaVersion, builtFrom, stories:[row]}`; row = `threadId, born, lastFactAt, iso3, actorIds, sourceCount, entryCount, forkCount, branchCount, liveBranchCount, latestVerdictAt, aliasOf, aliases, title` and, only when the story has a line reading, `line` (the text), ordered by `lastFactAt` desc then `threadId`. Active = a fact of its own in the last 60 UTC days (today and the 59 before), never an alias. `all.json` over 5 MB fails the build |
| `stories/{threadId}.json` | `analysis`: the latest `story_analysis` note (0042) in the shape `newsThreadAnalysis` stores it, or null; facts projection: `entries` (date ascending, newest 400 kept, `entriesOmitted`), `forks` with each branch's latest verdict, `merges`, `corrections`; `line` `{text, week, cites}`, `chapters` `[{title, from, to, summary, cites}]` (by `from`), and `reading:{state:"read", week}` from the readings; with none of those: `line` null, `chapters` empty, `reading:{state:"none", reason:"no reading yet"}`. A merged story is `{schemaVersion, builtFrom, threadId, aliasOf}` only |
| `links/{threadId}.json` | `judgedLinks`: the story web's model-judged links from `link` notes (0042), latest per pair, each as stored; then, for each active story: shared actor, iso3 and source IDs with other active stories, `grounds` 1 to 3, sorted by grounds (desc) then id, max 50; `confirmedLinks` `[{otherThreadId, mechanism, direction, week, cites}]` from link readings (`confirmedLinksReason` null; with none: `[]` and `"no reading yet"`) |
| `countries/{ISO3}.json` | built from notes only (decision 0042): `drift` (drift notes, newest first, at most 90, each as `newsDriftCorrector` stored it plus `generatedAt` and `model`), `driftCount`, `intelligence` (latest `country` note) and `systems` (latest `country` part `systems`), null until written; schema `schema/views/country.schema.json` |
| `counts/{date}.json` | `articles` (article facts dated that day), `byStory` (stories with a nonzero count) and `total` of `newEntries`, `branchesDue`, `verdicts`; written for the previous and current ISO week up to today and for every day whose facts changed in the invocation |
| `manifest.json` | `{schemaVersion, builtAt, runId, factsManifestDays, factsThrough, readingsThrough}` (`readingsThrough` = newest ISO week among the readings used, else null) |

Assignments (0040 rule 3): an entry belongs to the story of its current assignment, the one with the latest `at` (ties: operator, then review, then ingest, then larger `eventId`); an entry with no assignment fact stays on its archive thread. A reassigned entry leaves the old story's `entries`, row counts, `iso3`/`actorIds`/`sourceIds`, `counts/` `newEntries` and link grounds, and appears in the new story's, carrying `reassignedFrom` (the archive thread it left). Corrections follow their entry. With only ingest assignments the views are byte-identical to the views without any (golden test). An assignment may also name an `article` fact (recovered articles the operator links to a story): the article then appears in that story's `entries` as `{eventId, date, at, precision, title, summary (the snippet or null), sources:[{outlet, url}], kind:'article', recovered, recoveredFrom}` (entry rows carry no `kind`; the board's `StoryTree.jsx` reads only `eventId`, `date`, `title`, `summary` and `sources[].url/outlet`, so it shows an article row like an entry), counts in `entryCount`, `born` and `lastFactAt`, follows a merge like an entry (`fromThreadId`), and is counted in `counts/` as `articlesPlaced` (present only when nonzero), never as `newEntries`. An article with no assignment stays out of every story. An assignment naming neither an `entry` nor an `article` fact does nothing. `backend/record/cli/benchmark-assignments.mjs` builds such lines from the gap benchmark (see `backend/record/cli/README.md`).

`liveBranchCount` = branches of any `forecast_drawn` with `due >= today` and no verdict. `today` is the UTC day of the invocation. Rebuilds are idempotent: the same facts give the same bytes, except `builtAt` and `runId` in the manifest. Schemas and one example per view type: `schema/views/`. The IAM role needs `s3:PutObject` on `record/views/*` (shadow: `record/shadow/views/*`) before views can be written live; the live role (`newsStoryRecord-access`, read 2026-10-22) now includes `record/views/*`.

## Readings, merges and aliases in the build (step 3, BUILD node of the weekly loop)

```text
+- 6 BUILD      no model            [newsStoryRecord, nightly]
|  +- reads readings + inbox merges + operator aliases; fills line, chapters, confirmedLinks in the views;
|  |   applies story_merged / story_split; applies aliases to actorIds in views only (facts never rewritten)
```

- Readings: `record/readings/YYYY-Www.jsonl` for every ISO week from the first facts day to today (no listing; a missing week is empty). Per `(threadId, subtype, key)` the latest non-superseded reading wins (key: `line` none, `chapter` `from`, `link` and `merge_proposal` `otherThreadId`, `alias` `canonical`); a reading whose `readingId` another reading names in `supersedes` is dropped; ties on the week go to the later `run`, then `readingId`. Malformed lines are skipped. `merge_proposal` and `alias` readings are not story content (aliases below).
- Aliases: `record/operator/aliases.json` (operator only; missing = none) maps variant actorIds to a canonical one; accepted alias readings (a Wikidata Q-number, no conflict) add to it, the operator file always wins. The map is applied to `actorIds` in story views, index rows and the links specificity count. Facts keep the ids they were written with.
- Merges and splits: see the fact table. A `story_split` cancels every `story_merged` of the same `(from, into)` dated at or before it; a merge dated after the split stands.

## Event

| Field | Meaning |
|---|---|
| `date` | the UTC day to process (default today) |
| `backfill: {from, to}` | replay those days oldest first through the same code; a day with no archive row gets a `missing` Run and no facts and does not throw |
| `assignmentsBackfill: true` | one-time job: every `entry` fact already written gets its ingest assignment (below, Choices); not a nightly run |
| `shadow` | default `true`: every key moves under `record/shadow/` (`record/shadow/facts/`, `record/shadow/runs/`, `record/shadow/facts/manifest.json`); the flip is a prefix change |

The live schedule (rule `TriggerStoryRecord`, cron(45 23 * * ? *), i.e. 23:45Z) has input `{"shadow":false}`: one run for the current UTC day, written live. A backfill payload (`{"backfill":{"from":"<yesterday>","to":"<today>"}}`, so yesterday is completed once its archive row exists) is not what runs; both shapes are idempotent.

`strict` (default `true`): a run throws after writing its Run when any day in its range except today ends `inputs.archiveDay: missing`, so a scheduled run is never silent on a missing day. Only an explicit historical replay passes `strict:false`, which treats missing days as expected history. A backfill's `run` fact is dated the end of the replayed day, so replays do not pile run facts into today's file.

## Deployment

Deployed 2026-10-21 as the facts writer; current code deployed 2026-10-22 23:54Z with the views builder, article and assignment facts, canonical actor ids and the inboxes (CodeSha256 3otTVOfYsPJOoYJAUWwWEBU2vdHdl92pUW1Fu6gmPXI=), registered in `scripts/functions.json` as group `record`; entry point `runtime.handler`, Node.js 22, reserved concurrency 1, scheduled by EventBridge rule `TriggerStoryRecord` cron(45 23 * * ? *), input `{"shadow":false}` (live since 2026-10-22; first run 2026-10-22 23:45Z). Its role may write `record/shadow/*`, `record/facts/*`, `record/runs/*` and `record/views/*`. The coordinator deploys it; diff the deployed zip against the repo first.

- Environment: `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog). `SUMMARIZE_PREDICT_TABLE` is not needed: `world/` resolves it only for the thread-analysis reader, which this writer never calls (live default table names apply anyway). `RECORD_LLM_MODEL` is no longer read; no model key is needed.
- The runtime supplies AWS SDK v3; the committed `src/_shared` symlink supplies shared code.
- IAM (least privilege): DynamoDB `GetItem`, `BatchGetItem`, `Query` on the three tables, no writes, no scans. S3 `GetObject` on `record/*`; `PutObject` target: `record/facts/*`, `record/runs/*`, `record/views/*` and their `record/shadow/` equivalents. Live today: `record/shadow/*`, `record/facts/*`, `record/runs/*`, `record/views/*`. Narrow `ListBucket` on those prefixes so a missing object is a 404, not a 403 (the code never lists).
- Alarms (none built; parked by the operator 2026-10-22): no `record/facts/DATE.jsonl` by a fixed UTC time; a Run left at `started`; a Run with `inputs.archiveDay` `missing`; the model Lambda's daily average Duration under 10 s (the gap-day pattern).

## Schema and local run

`schema/fact.schema.json` and `schema/run.schema.json` (draft-07), with one example per fact kind and two Run examples in `schema/examples/`. `schema/views/` holds one schema per view type (`story`, `index`, `links`, `counts`, `manifest`) and its examples. `src/manifest.js` is the manifest merge, on shared `s3json.getJsonEtag` and `putJsonIf`.

## Choices
(Accepted by the coordinator 2026-10-21.)
- A day with no archive row and no today-archive entries ends its Run `failed` with `archiveDay:"missing"` and zero facts; a daily run throws after writing the Run, a backfill does not.
- Entry `summary` is null: the archive row has no summary field and snippets are not substituted.
- A title-basis entry id uses the archive day, not the fact day, so a re-run keeps it.
- `runId` suffix is the attempt number counted from the existing Run object for the date (`-1` on a fresh store, also in a backfill).
- Verdicts come from the inbox only (operator decision 2026-10-22, replaces the DynamoDB read): the facts writer makes no DynamoDB verdict query; `store.verdicts` is deleted (the shared `world.verdicts()` reader stays for others). The inbox line shape is the resolver's: `{schemaVersion:1, qid, threadId, branchId, forkId, result, voidReason, decidedAt, decidedBy, evidence:{quote,url,title,date}|null, reason, revision, sourceKey}`.
- Inbox window: each run reads the run day and the 6 days before (7 GetObjects, a missing day is empty), keyed by decision day UTC. An event `{inboxFrom:'YYYY-MM-DD'}` reads from that day to the run day instead, for the first live run or a catch-up. A line is turned into a fact each time it is read and dropped as known when its `eventId` is already in the 100-day facts; a verdict whose decision day is older than 100 days and is read again by an `inboxFrom` backfill would be appended again (the views ignore a repeated eventId). A malformed line (no qid, bad result, no thread or branch to be found) is a `verdict` failure on the Run (partial) and the rest is kept. The shadow prefix reads `record/shadow/inbox/verdicts/`.
- The Run object carries two extra fields, `date` and `daysWritten`; `net.au` is added to the two-level suffix list (abc.net.au is in the outlet table).
- Entry time (0036 amendment 2026-10-22, step 2b): a `publishedAt` is valid when it parses, is not after the entry's `archivedAt` (end of the archive day when absent) and is at most 30 days (`MAX_PUBLISHED_AGE_DAYS`) before the archive day. The spec said only "valid"; the two bounds are mine: a future time is a feed error, and a stale one would put the fact's day outside the 60-day re-run window so every run would append it again. Invalid sources are skipped, the others still count. `eventId` is unchanged. An exact `at` can fall on an earlier UTC day than the archive day, so that fact lands in the earlier day's file. Archive rows written before 2026-10-20 (and, as of 2026-10-22, every row checked: 10-19 to 10-21) carry no `publishedAt`, so they stay `day`; facts already written are not rewritten.

Article choices (lane X, operator decisions 2026-10-22):
- Raw articles are `article` facts. Entry `eventId` stays url-only and unchanged; an article and the entry that cites it share a canonical url but have different kinds, so different ids.
- `at` is `publishedAt` only when it parses and is not after `fetchedAt` (a future feed date would put the fact in a day that does not exist yet); otherwise the start of the fetch day with `precision: day`. Unlike entries there is no 30-day floor, so a recovered article keeps its real publish day. A published day can therefore differ from the fetch day, and `counts.articles` counts by the fact's date (publish day when exact), not by `fetchedAt`; the payload does not carry `fetchedAt`.
- The article inbox follows the verdict window (run day and 6 days back, or `inboxFrom`) and is read before the missing-archive check, so `inputs.rawDay` is recorded even for a missing archive day. Article facts (like verdict, merge and split facts) are appended whenever their inbox has lines, independent of the archive row: on a missing-archive day (a model outage) the Run is `failed` with an `inputs` failure, but the article facts are written, `counts.article` and `daysWritten` show them and the views rebuild. Only entry, story_born and forecast_drawn depend on the archive.
- An unreadable day file is an `article` failure with `ref` = the day and the other days are kept; a malformed line is an `article` failure with `ref` = `DAY#n` and the other lines are kept (Run `partial`, the daily run throws, as for verdicts).
- `inputs.rawDay`: `missing` (no file or no lines), `{thin: n}` under 50 lines, `present`, or `null` when the file could not be read (with a failure). Counted lines are all parseable lines, valid or not. Older Runs have no `rawDay`.
- Recovery hook only: an event `{recovery:true}` puts `recovery` in the Run's `notes` and refuses `forecast_drawn` for that day (the refused count is appended to `notes`). Recovery itself, and recovered articles being written, are a later lane.

Forecast-loop choices (lane O, 0038):
- One lookback for everything: `LOOKBACK_DAYS` is 100 (was 60), for the qid map and for the dedupe of known facts. A forecast is due 7-90 days out and judged up to 3 days after (grace), so 60 days missed verdicts on forecasts drawn 60-100 days ago. I did not keep a separate 60-day dedupe window: a verdict fact lands on its decision day, which can be 100 days after the entry/forecast facts, and the pickup re-yields every verdict row of every known qid each night, so a shorter dedupe would re-append verdicts older than 60 days every run. One window, read once, is the narrowest consistent reading. It reads 100 day files instead of 60 each night.
- `LOOKBACK_DAYS` stays 100: it is the dedupe window and the source of the thread/branch fallback for inbox lines.
- "Resolvable" is `question === true` and a non-empty `qid` (`isResolvable` in `src/facts.js`, used by the views and the legacy job). A branch that is not resolvable is legacy: its story-view branch carries `legacy: true` (field absent otherwise; the story schema allows it), and it counts in `branchCount` but not in `liveBranchCount`, and in no day's `branchesDue`. Branch `text` and old facts are untouched. A legacy branch that has a (void) verdict is shown with that verdict.
- Legacy void job: event `{legacyVoid:true, shadow:true|false}` (shadow default true; any other event is the nightly run, `legacyVoid:false` too). It reads every facts day in the manifest of the prefix, collects branches that are not resolvable, and appends one verdict per branch to the facts day of the job time: `{qid:null, result:'void', revision:1, decidedBy:'operator-job', voidReason:'issued_before_method', evidence:null}`, `sourceKey = legacy-void|<branchId>` so `eventId` is fixed per branch. A branch that already has a verdict fact, or whose void fact exists, is skipped, so a re-run (any day) appends nothing and writes no day file. After appending it registers the day and rebuilds the views. It returns `{legacyVoid, prefix, legacyBranches, written, alreadyVoid, days}`. It writes no Run object or `run` fact (a Run is one nightly day; writing `runs/DATE.json` would clobber the nightly Run); the facts' `producer.runId` is `legacy-void-DATE`, which the fact schema now allows. The fact schema also allows `payload.qid` null and a `voidReason` string. Run live once on 2026-10-30 (operator yes): 2,451 void verdicts over 220 stories in `record/facts/2026-10-30.jsonl`; a re-run writes nothing.
- The story-view verdict carries `{at, result, decidedBy, evidence, voidReason}` (`voidReason` null for yes/no), so a page can show "could not be checked · reason"; "recorded before scoring began" is `voidReason:'issued_before_method'`.

Views choices (step 2, 0037 left these open; narrowest reading):
- The two index files are `{schemaVersion, builtFrom, stories:[row]}` (0037 names no wrapper key).
- `builtFrom.factsThrough` and the manifest's `factsThrough` = the latest `date` of any fact except `run` (a run fact says the day was processed, not that the world moved). `factsManifestDays` is the manifest day count as read before this invocation's own `run` fact day is registered.
- Active window: a story whose newest fact `date` is within today and the 59 days before.
- A story's `lastFactAt`, `born` (earliest of its `story_born` and entries), `title` (first entry by date, `at`, `eventId`) and counts cover its own facts plus the entries merged into it. Only entries (and corrections of them) move from a merged story; its `forecast_drawn`, `verdict` and `story_merged` facts stay with it, so a merged story's forks are not in the survivor's view. If the survivor should carry them, that is a spec change.
- A merged story's row in `all.json` keeps `threadId, born, lastFactAt, title, aliasOf`; its counts and lists are empty/zero, since its content lives on the survivor.
- `counts` attribute a merged story's days to the survivor, for all days (a rebuild applies the alias to the past). `branchesDue` counts every resolvable branch whose `due` is the day, verdict or not (legacy branches excluded, 0038).
- A branch's `verdict` is the newest verdict fact for its `branchId` (by `at`, then revision), any result (`yes`, `no`, `void`) ends it being live.
- A repeated `eventId` across facts days keeps the earliest by `at`; facts are read in `(at, eventId)` order so file order never matters.
- Links rule (0037 amendment 2026-10-22): grounds are actors and countries only, each counted only if fewer than 5% of the active stories carry it (`SPECIFIC_SHARE`, share = carriers / active stories, so with fewer than 41 active stories no shared ID can be specific and every links file is empty); both stories' `lastFactAt` dates at most 14 days apart (`LINK_WINDOW_DAYS`), gap in `daysApart`. `sharedActorIds` and `sharedIso3` list only the specific IDs, `sharedSourceIds` lists every shared source for information. Sort: rarest shared specific ID (lowest share), then `otherThreadId`; cap 50. The golden set has 3 active stories, so its links are empty; the links tests pad the active index.
- Every story has a `links/` file: computed links for active stories; an empty one (`links: []`, `confirmedLinks: []`) for a merged or idle story, so its old file is overwritten rather than left stale (nothing deletes views; the rebuild test found 7 merged stories still carrying 2026-10-23 links, fixed 2026-10-31).
- `entriesOmitted` is always present (0 when nothing was cut). Entries carry `fromThreadId` only when merged in, and `corrected: true` only when a correction names them.

```sh
node backend/record/newsStoryRecord/dryrun.mjs --from 2026-09-06 --to 2026-10-20 --out <outDir>/
```

The dry run reads live DynamoDB (`get-item`, `query`, `batch-get-item` through the aws CLI; nothing else is allowed) and writes the would-be S3 objects to local files with local ETags through the real shared helpers.

The views dry run needs no DynamoDB: sync the facts read-only and build locally (nothing is written to S3).

```sh
aws s3 sync s3://globalperspective-world-280362093938/record/facts/ <factsDir> --region ap-northeast-1
node backend/record/newsStoryRecord/dryrun-views.mjs <factsDir> <outDir>/ 2026-10-22
```

2026-10-22 result over the 48 live fact days (2026-09-05..2026-10-22): 519 stories (all active, since the facts start 47 days back), no aliases, `all.json` 203 KB (the 5 MB cap is about 13,000 stories at this row size), largest story 33 entries and 31 forks (140 KB), 1,052 files (11 MB), build 1.2 s. Links: 499 of 519 stories hit the 50-link cap and 15,547 of 25,615 rows rest on one ground only (usually a country or a big outlet), so `links/` is mostly weak signal until readings confirm links.

## Tests

```sh
FRONTEND_NODE_MODULES=<main checkout>/global-perspectives-starter/frontend/node_modules node --test backend/record/newsStoryRecord/test/*.test.js
cd backend/shared && node --test test/record.test.js test/outlets.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Tests use scripted stores, a fake ETag-aware S3 and, for the `today-archive` cases, the real world readers over `world.fake.js`. `FRONTEND_NODE_MODULES` is needed only for the schema test (the frontend's Ajv).

Verdict facts come from the inbox `record/inbox/verdicts/` (run day plus six days before; `{inboxFrom}` backfills), written by the resolver; see decision 0038 amendment.

Last verified: 2026-10-23 (deployed code hash, schedule, role, environment, `record/facts/` and `record/views/` read from live AWS; tests and dry runs offline). Live entries stay `precision: day`: archive rows since 2026-10-20 lack `publishedAt` (the DeepSeek outage), so the exact-time path has not had input yet

## Choices: assignments (Y lane, 0040 rule 3)

- Ingest assignments are written only for a fresh entry fact (its `eventId` not in the 100-day known facts and not earlier in the same run) and only when the entry has an archive thread. The same url on a later day under another thread therefore does not pull the entry: one article is one fact, the first thread claims it. Reassigning is the operator's or the review's act.
- Inbox lines need `at` (the other inbox lines do): the latest `at` decides, and it is part of the `eventId`. `by:'ingest'` is refused in the inbox (ingest assignments are derived). A bad line is an `assignment` failure on the Run (partial) and the rest is kept. Same window as the other inboxes (run day plus 6 days, or `inboxFrom`).
- `supersedes` is stored and shown nowhere: precedence is by `at` and `by` only, so a stale `supersedes` link cannot change a view.
- An emptied story stays a story (an empty `entries` list, `entryCount` 0, null `lastFactAt` when nothing else is left), not a deleted view. Assignment facts never bump `lastFactAt`: the entry's own time does, in the story it now belongs to. `builtFrom.factsThrough` does count the day of an assignment.
- A reassignment onto a merged-away story lands on the survivor, tagged `fromThreadId` as any merged entry. Assigning to `new` is not an inbox value: the operator names the new thread id.
- `assignmentsBackfill`: reads every facts day of the prefix, derives one ingest assignment per `entry` fact (`at` = the entry's `at`, so it lands in the entry's own day file), skips ids already present, registers the days, rebuilds the views, and returns `{assignmentsBackfill, prefix, entries, written, alreadyAssigned, days}`. `producer.runId` is `assignments-backfill-DATE`; no Run object, no `run` fact. It has NOT been run; the coordinator runs it (shadow first) so existing entries have their ingest claim. Until then the views are still correct: an entry without an assignment stays on its archive thread.
- A reading of subtype `assignment` (the review's proposal) is not read here: the build skips it like any unknown subtype. A proposal changes nothing until the operator writes the inbox line.

## Where this sits in the forecast loop

The RECORD node of the stack tree in [ARCHITECTURE_FORECAST_LOOP.md](../../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md) (copied; the nightly pickup in this Lambda is how a verdict row becomes a fact until the resolver writes facts itself):

```
+- 5 RECORD      no model                            [newsPredictionResolver -> record/facts]
|  +- COMMIT : reads the article inbox record/inbox/articles/ (run day + 6 days) -> article facts; each fresh entry -> its ingest assignment;
|  |          record/inbox/assignments/ (operator, review) -> assignment facts
|  +- inputs : final answers (yes | no | void)
|  +- rule   : write a verdict fact {result, quote, url, at, decidedBy: model, evidence}; put-once; corrections append
|  |           the pre-registered weekly sample of 22 (0011) is what the public track record scores; other verdicts are shown, not scored
|  +- model  : no
|  +- output : verdict fact; views and counts rebuild from it
|  +- cost   : none
```

Step 3 choices (lane T, views read the weekly readings; the spec left these open, narrowest reading):
- Readings, the merge and split inboxes and the operator alias file all follow the run's prefix: the shadow run reads `record/shadow/readings/`, `record/shadow/inbox/merges/` and `splits/`, `record/shadow/operator/aliases.json`; the flip is the same prefix change as for facts.
- `builtFrom.readingsThrough` and the manifest's are ISO week labels (`2026-W43`), the newest week among the readings the build used (any subtype), null with none. Reading weeks before the week of the first fact day are not read.
- The reading key for a chapter is its `from`, so a re-read chapter with a changed span must name the old one in `supersedes`; otherwise both stand.
- `reading` is `{state:"read", week}` when the story has a line, chapter, branch-status or link reading, `week` = the newest of them. A merged story's own readings are not shown (its view is an alias); a confirmed link to a merged story points at the survivor, and a link to itself is dropped.
- `confirmedLinks` are shown on the story the reading names, not mirrored on the other; they exist only in `links/` files, which exist for active stories.
- `story_split` payload is `{from, into, reason}` with the time in the envelope `at`, like `story_merged`. A malformed merge or split line is a `merge` or `split` failure on the Run (partial), the rest kept.
- Alias conflicts: a reading is rejected as a whole when a variant is already mapped to a different canonical, its canonical is itself a variant, or a variant is another entry's canonical. Among readings and inside the operator file the earlier entry wins. A malformed operator file fails the views stage (Run partial), it is not silently ignored.
- IAM (read 2026-10-22, role `newsStoryRecord-role`, policy `newsStoryRecord-access`): `s3:GetObject` on `web/*` and `record/*` already covers `record/readings/*`, `record/inbox/merges/*`, `record/inbox/splits/*` and `record/operator/*` (and the shadow equivalents); `s3:ListBucket` on the bucket turns a missing object into a 404. No IAM change is needed.

Actor identity choices (lane AA, 0040 rule 4 / answer 7):
- Canonical id in the views: an alias entry (operator file or accepted reading) that carries a `wikidataId` canonicalises its `canonical` name and all variants to `wd:Q...`; without one, to its `canonical` (`name:...`). Two entries with one Q-number pool into one id. Facts keep their raw `name:` ids. An empty or missing alias file changes nothing.
- `generic:true` on an operator entry (`{canonical:'name:protesters', variants:[...], generic:true}`, `variants` optional) marks a crowd or "the government": it never takes a `wd:` id, still appears in `actorIds` of stories and index rows, and is never a ground in `links` (neither counted as specific nor listed in `sharedActorIds`). The views have no actor-based merge, so there is nothing to exclude there; story merges come only from `story_merged` facts.
- A conflicting entry or reading is skipped as before; a reading with a different Q-number than the operator's for the same name conflicts.
