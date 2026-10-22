# newsStoryRecord

The facts writer. Each run appends one UTC day's facts, with no model, to `record/facts/YYYY-MM-DD.jsonl` and writes that day's Run object to `record/runs/YYYY-MM-DD.json`. After the append it rebuilds the views under `record/views/` from every facts day ([decision 0037](../../../project-docs/decisions/0037-views-from-facts.md)). Format and rules: [decision 0036](../../../project-docs/decisions/0036-facts-file-format.md); design: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md) (§1c two clocks, §6 writers). Chapters, branch status and lines are readings written weekly by the planned `newsRecordReview`.

## What a run does

1. Writes `runs/DATE.json` with `status:"started"` (a Run left at `started` with no `finishedAt` is the alarm).
2. Reads through shared `world/` only: `archive#` rows for the 30 days to DATE, the `today-archive` entries archived on DATE, `PRED#` snapshots of the day's topics, and verdicts for sampled questions. No scan, no listing.
3. Builds facts and drops those already stored (it reads the last 60 days of fact files, so a re-run is a no-op and the same article listed again on a later day is not a second fact).
4. Appends each fact to the file of its own day (the UTC date of `at`), registers the days in `facts/manifest.json`, appends a `run` fact, and overwrites the Run with `ok`, `partial` or `failed`.
5. Throws when the Run is not `ok` (daily mode), so the schedule's Errors metric moves. A missing archive day is a `failed` Run with `inputs.archiveDay:"missing"`, never `ok`.

| Fact kind | From | Notes |
|---|---|---|
| `entry` | one archive entry | `eventId = sha1('entry' + smallest canonical source url)`; `summary` is null (the row has none); `at` is the earliest valid `sources[].publishedAt` with `precision: exact`, else `archivedAt` with `precision: day` (see Choices) |
| `story_born` | the first entry of a thread in the window, on its birth day | `windowLimited` and `missingBefore` say what the window could not see |
| `forecast_drawn` | one `PRED#` snapshot | branches with `branchId`, `p` (percent), `trigger`, `resolutionSource`, `due`, `qid` |
| `verdict` | each `Q#` verdict row (`yes`, `no`, `void`) | only for questions whose forecast is in the facts of the last 60 days; only sampled questions are asked |
| `correction`, `story_merged` | nothing yet | builders in `src/facts.js`; written when an operator or review input exists |
| `run` | the Run | appended every run, failures included |

IDs: [`record.js`](../../shared/src/record.js) (`canonicalUrl`, `entryIdentity`, `sourceIdOf`, `actorIdOf`, `factId`) and [`outlets.js`](../../shared/src/outlets.js) (`registrableDomain`, `TWO_LEVEL_SUFFIXES`). Missing inputs are recorded as missing: `iso3:[]` and `actorIds:[]` before about 2026-09-12, `summary:null`, `outlet:null` for an unknown outlet.

## Views

After the facts and before the Run is finalised, `src/publish.js` reads every day in `facts/manifest.json` (plus the days this invocation wrote), `src/views.js` (pure, no I/O) builds the view objects, and they are written with plain `PutObject` under `record/views/` (shadow: `record/shadow/views/`). A backfill builds once, after its last day. Write order, so a reader that sees a new manifest sees a complete set: `stories/*`, `links/*`, `counts/*`, then `index/active.json`, then `index/all.json`, then `manifest.json` last. A write failure stops the sequence (the old manifest stays; its age is the alarm), marks the Run `partial` with `failures:[{stage:'views'}]`, and leaves the facts as written.

| View | Content |
|---|---|
| `index/active.json`, `index/all.json` | `{schemaVersion, builtFrom, stories:[row]}`; row = `threadId, born, lastFactAt, iso3, actorIds, sourceCount, entryCount, forkCount, branchCount, liveBranchCount, latestVerdictAt, aliasOf, aliases, title`, ordered by `lastFactAt` desc then `threadId`. Active = a fact of its own in the last 60 UTC days (today and the 59 before), never an alias. `all.json` over 5 MB fails the build |
| `stories/{threadId}.json` | facts projection: `entries` (date ascending, newest 400 kept, `entriesOmitted`), `forks` with each branch's latest verdict, `merges`, `corrections`; `line`, `chapters`, `branchStatus` null/empty and `reading:{state:"none", reason:"no reading yet"}`. A merged story is `{schemaVersion, builtFrom, threadId, aliasOf}` only |
| `links/{threadId}.json` | for each active story: shared actor, iso3 and source IDs with other active stories, `grounds` 1 to 3, sorted by grounds (desc) then id, max 50; `confirmedLinks: []` |
| `counts/{date}.json` | `byStory` (stories with a nonzero count) and `total` of `newEntries`, `branchesDue`, `verdicts`; written for the previous and current ISO week up to today and for every day whose facts changed in the invocation |
| `manifest.json` | `{schemaVersion, builtAt, runId, factsManifestDays, factsThrough, readingsThrough:null}` |

`liveBranchCount` = branches of any `forecast_drawn` with `due >= today` and no verdict. `today` is the UTC day of the invocation. Rebuilds are idempotent: the same facts give the same bytes, except `builtAt` and `runId` in the manifest. Schemas and one example per view type: `schema/views/`. The IAM role needs `s3:PutObject` on `record/views/*` (shadow: `record/shadow/views/*`) before views can be written live; the live role (`newsStoryRecord-access`, read 2026-10-22) has `record/shadow/*`, `record/facts/*` and `record/runs/*` only, and the deployed zip is the facts writer without this views step, so `record/views/` is empty. Deploying the views code before the IAM change would mark every Run `partial` (the view write fails after the facts).

## Event

| Field | Meaning |
|---|---|
| `date` | the UTC day to process (default today) |
| `backfill: {from, to}` | replay those days oldest first through the same code; a day with no archive row gets a `missing` Run and no facts and does not throw |
| `shadow` | default `true`: every key moves under `record/shadow/` (`record/shadow/facts/`, `record/shadow/runs/`, `record/shadow/facts/manifest.json`); the flip is a prefix change |

The live schedule (rule `TriggerStoryRecord`, cron(45 23 * * ? *), i.e. 23:45Z) has input `{"shadow":false}`: one run for the current UTC day, written live. A backfill payload (`{"backfill":{"from":"<yesterday>","to":"<today>"}}`, so yesterday is completed once its archive row exists) is not what runs; both shapes are idempotent.

`strict` (default `true`): a run throws after writing its Run when any day in its range except today ends `inputs.archiveDay: missing`, so a scheduled run is never silent on a missing day. Only an explicit historical replay passes `strict:false`, which treats missing days as expected history. A backfill's `run` fact is dated the end of the replayed day, so replays do not pile run facts into today's file.

## Deployment

Deployed 2026-10-21 (the facts writer, without the views step), registered in `scripts/functions.json` as group `record`; entry point `runtime.handler`, Node.js 22, reserved concurrency 1, scheduled by EventBridge rule `TriggerStoryRecord` cron(45 23 * * ? *), input `{"shadow":false}` (live since 2026-10-22; first run 2026-10-22 23:45Z). Its role may write `record/shadow/*`, `record/facts/*` and `record/runs/*`, not `record/views/*`. The coordinator deploys it; diff the deployed zip against the repo first (the repo now carries the views builder, merged 2026-10-22, not deployed).

- Environment: `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog). `SUMMARIZE_PREDICT_TABLE` is not needed: `world/` resolves it only for the thread-analysis reader, which this writer never calls (live default table names apply anyway). `RECORD_LLM_MODEL` is no longer read; no model key is needed.
- The runtime supplies AWS SDK v3; the committed `src/_shared` symlink supplies shared code.
- IAM (least privilege): DynamoDB `GetItem`, `BatchGetItem`, `Query` on the three tables, no writes, no scans. S3 `GetObject` on `record/*`; `PutObject` target: `record/facts/*`, `record/runs/*`, `record/views/*` and their `record/shadow/` equivalents. Live today: `record/shadow/*`, `record/facts/*`, `record/runs/*` (no `record/views/*` yet). Narrow `ListBucket` on those prefixes so a missing object is a 404, not a 403 (the code never lists).
- Alarms (none built; parked by the operator 2026-10-22): no `record/facts/DATE.jsonl` by a fixed UTC time; a Run left at `started`; a Run with `inputs.archiveDay` `missing`; the model Lambda's daily average Duration under 10 s (the gap-day pattern).

## Schema and local run

`schema/fact.schema.json` and `schema/run.schema.json` (draft-07), with one example per fact kind and two Run examples in `schema/examples/`. `schema/views/` holds one schema per view type (`story`, `index`, `links`, `counts`, `manifest`) and its examples. `src/manifest.js` is the manifest merge, on shared `s3json.getJsonEtag` and `putJsonIf`.

## Choices
(Accepted by the coordinator 2026-10-21.)
- A day with no archive row and no today-archive entries ends its Run `failed` with `archiveDay:"missing"` and zero facts; a daily run throws after writing the Run, a backfill does not.
- Entry `summary` is null: the archive row has no summary field and snippets are not substituted.
- A title-basis entry id uses the archive day, not the fact day, so a re-run keeps it.
- `runId` suffix is the attempt number counted from the existing Run object for the date (`-1` on a fresh store, also in a backfill).
- Verdicts are read only for sampled questions (`Q#/SAMPLED` batch read first), since only those get verdicts, and only for questions whose `forecast_drawn` fact is inside the 60-day lookback; a verdict landing on a forecast older than 60 days is missed.
- The Run object carries two extra fields, `date` and `daysWritten`; `net.au` is added to the two-level suffix list (abc.net.au is in the outlet table).
- Entry time (0036 amendment 2026-10-22, step 2b): a `publishedAt` is valid when it parses, is not after the entry's `archivedAt` (end of the archive day when absent) and is at most 30 days (`MAX_PUBLISHED_AGE_DAYS`) before the archive day. The spec said only "valid"; the two bounds are mine: a future time is a feed error, and a stale one would put the fact's day outside the 60-day re-run window so every run would append it again. Invalid sources are skipped, the others still count. `eventId` is unchanged. An exact `at` can fall on an earlier UTC day than the archive day, so that fact lands in the earlier day's file. Archive rows written before 2026-10-20 (and, as of 2026-10-22, every row checked: 10-19 to 10-21) carry no `publishedAt`, so they stay `day`; facts already written are not rewritten.

Views choices (step 2, 0037 left these open; narrowest reading):
- The two index files are `{schemaVersion, builtFrom, stories:[row]}` (0037 names no wrapper key).
- `builtFrom.factsThrough` and the manifest's `factsThrough` = the latest `date` of any fact except `run` (a run fact says the day was processed, not that the world moved). `factsManifestDays` is the manifest day count as read before this invocation's own `run` fact day is registered.
- Active window: a story whose newest fact `date` is within today and the 59 days before.
- A story's `lastFactAt`, `born` (earliest of its `story_born` and entries), `title` (first entry by date, `at`, `eventId`) and counts cover its own facts plus the entries merged into it. Only entries (and corrections of them) move from a merged story; its `forecast_drawn`, `verdict` and `story_merged` facts stay with it, so a merged story's forks are not in the survivor's view. If the survivor should carry them, that is a spec change.
- A merged story's row in `all.json` keeps `threadId, born, lastFactAt, title, aliasOf`; its counts and lists are empty/zero, since its content lives on the survivor.
- `counts` attribute a merged story's days to the survivor, for all days (a rebuild applies the alias to the past). `branchesDue` counts every branch whose `due` is the day, verdict or not.
- A branch's `verdict` is the newest verdict fact for its `branchId` (by `at`, then revision), any result (`yes`, `no`, `void`) ends it being live.
- A repeated `eventId` across facts days keeps the earliest by `at`; facts are read in `(at, eventId)` order so file order never matters.
- Links rule (0037 amendment 2026-10-22): grounds are actors and countries only, each counted only if fewer than 5% of the active stories carry it (`SPECIFIC_SHARE`, share = carriers / active stories, so with fewer than 41 active stories no shared ID can be specific and every links file is empty); both stories' `lastFactAt` dates at most 14 days apart (`LINK_WINDOW_DAYS`), gap in `daysApart`. `sharedActorIds` and `sharedIso3` list only the specific IDs, `sharedSourceIds` lists every shared source for information. Sort: rarest shared specific ID (lowest share), then `otherThreadId`; cap 50. The golden set has 3 active stories, so its links are empty; the links tests pad the active index.
- `links/` files exist for active stories only; a story that goes idle keeps its last file until a later cleanup (nothing deletes views).
- `entriesOmitted` is always present (0 when nothing was cut). Entries carry `fromThreadId` only when merged in, and `corrected: true` only when a correction names them.

```sh
node backend/record/newsStoryRecord/dryrun.mjs --from 2026-09-06 --to 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/facts-dryrun/
```

The dry run reads live DynamoDB (`get-item`, `query`, `batch-get-item` through the aws CLI; nothing else is allowed) and writes the would-be S3 objects to local files with local ETags through the real shared helpers. See [DRYRUN.md](DRYRUN.md) for the 2026-09-06..2026-10-20 result.

The views dry run needs no DynamoDB: sync the facts read-only and build locally (nothing is written to S3).

```sh
aws s3 sync s3://globalperspective-world-280362093938/record/facts/ <factsDir> --region ap-northeast-1
node backend/record/newsStoryRecord/dryrun-views.mjs <factsDir> /Users/benlai/Downloads/gp-mailbox/artifacts/views-dryrun/ 2026-10-22
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

Last verified: 2026-10-22 (offline tests and local read-only dry runs for the views code, not deployed; schedule, role, environment and `record/facts/` read from live AWS the same day)
