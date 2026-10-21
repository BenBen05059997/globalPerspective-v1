# newsStoryRecord

The facts writer. Each run appends one UTC day's facts, with no model, to `record/facts/YYYY-MM-DD.jsonl` and writes that day's Run object to `record/runs/YYYY-MM-DD.json`. It writes no view: `newsBoard` still returns `recordAvailable:false` until step 2 reads the facts. Format and rules: [decision 0036](../../../project-docs/decisions/0036-facts-file-format.md); design: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md) (§1c two clocks, §6 writers). Chapters, branch status and lines are readings written weekly by the planned `newsRecordReview`.

## What a run does

1. Writes `runs/DATE.json` with `status:"started"` (a Run left at `started` with no `finishedAt` is the alarm).
2. Reads through shared `world/` only: `archive#` rows for the 30 days to DATE, the `today-archive` entries archived on DATE, `PRED#` snapshots of the day's topics, and verdicts for sampled questions. No scan, no listing.
3. Builds facts and drops those already stored (it reads the last 60 days of fact files, so a re-run is a no-op and the same article listed again on a later day is not a second fact).
4. Appends each fact to the file of its own day (the UTC date of `at`), registers the days in `facts/manifest.json`, appends a `run` fact, and overwrites the Run with `ok`, `partial` or `failed`.
5. Throws when the Run is not `ok` (daily mode), so the schedule's Errors metric moves. A missing archive day is a `failed` Run with `inputs.archiveDay:"missing"`, never `ok`.

| Fact kind | From | Notes |
|---|---|---|
| `entry` | one archive entry | `eventId = sha1('entry' + smallest canonical source url)`; `summary` is null (the row has none); `precision` is `day` |
| `story_born` | the first entry of a thread in the window, on its birth day | `windowLimited` and `missingBefore` say what the window could not see |
| `forecast_drawn` | one `PRED#` snapshot | branches with `branchId`, `p` (percent), `trigger`, `resolutionSource`, `due`, `qid` |
| `verdict` | each `Q#` verdict row (`yes`, `no`, `void`) | only for questions whose forecast is in the facts of the last 60 days; only sampled questions are asked |
| `correction`, `story_merged` | nothing yet | builders in `src/facts.js`; written when an operator or review input exists |
| `run` | the Run | appended every run, failures included |

IDs: [`record.js`](../../shared/src/record.js) (`canonicalUrl`, `entryIdentity`, `sourceIdOf`, `actorIdOf`, `factId`) and [`outlets.js`](../../shared/src/outlets.js) (`registrableDomain`, `TWO_LEVEL_SUFFIXES`). Missing inputs are recorded as missing: `iso3:[]` and `actorIds:[]` before about 2026-09-12, `summary:null`, `outlet:null` for an unknown outlet.

## Event

| Field | Meaning |
|---|---|
| `date` | the UTC day to process (default today) |
| `backfill: {from, to}` | replay those days oldest first through the same code; a day with no archive row gets a `missing` Run and no facts and does not throw |
| `shadow` | default `true`: every key moves under `record/shadow/` (`record/shadow/facts/`, `record/shadow/runs/`, `record/shadow/facts/manifest.json`); the flip is a prefix change |

A daily run at 05:45Z sees the day in progress. The planned schedule payload is `{"backfill":{"from":"<yesterday>","to":"<today>"}}`, so yesterday is completed once its archive row exists; both days are idempotent.

`strict` (default `true`): a run throws after writing its Run when any day in its range except today ends `inputs.archiveDay: missing`, so a scheduled run is never silent on a missing day. Only an explicit historical replay passes `strict:false`, which treats missing days as expected history. A backfill's `run` fact is dated the end of the replayed day, so replays do not pile run facts into today's file.

## Deployment

Deployed 2026-10-21 (this code), registered in `scripts/functions.json` as group `record`; entry point `runtime.handler`, Node.js 22, reserved concurrency 1, no schedule yet. Its role may write only `record/shadow/*` until the operator approves `record/facts/*` and `record/runs/*`. The coordinator deploys it; diff the deployed zip against the repo first.

- Environment: `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog). `SUMMARIZE_PREDICT_TABLE` is not needed: `world/` resolves it only for the thread-analysis reader, which this writer never calls (live default table names apply anyway). `RECORD_LLM_MODEL` is no longer read; no model key is needed.
- The runtime supplies AWS SDK v3; the committed `src/_shared` symlink supplies shared code.
- IAM (least privilege): DynamoDB `GetItem`, `BatchGetItem`, `Query` on the three tables, no writes, no scans. S3 `GetObject` on `record/*`; `PutObject` only on `record/facts/*`, `record/runs/*` and their `record/shadow/` equivalents (for the shadow week, `record/shadow/*` only). Narrow `ListBucket` on those prefixes so a missing object is a 404, not a 403 (the code never lists).
- Alarms (the operator's alerts review decides the topic): no `record/facts/DATE.jsonl` by a fixed UTC time; a Run left at `started`; a Run with `inputs.archiveDay` `missing`; the model Lambda's daily average Duration under 10 s (the gap-day pattern).

## Schema and local run

`schema/fact.schema.json` and `schema/run.schema.json` (draft-07), with one example per fact kind and two Run examples in `schema/examples/`. `src/manifest.js` is the manifest merge, on shared `s3json.getJsonEtag` and `putJsonIf`.

## Choices
(Accepted by the coordinator 2026-10-21.)
- A day with no archive row and no today-archive entries ends its Run `failed` with `archiveDay:"missing"` and zero facts; a daily run throws after writing the Run, a backfill does not.
- Entry `summary` is null: the archive row has no summary field and snippets are not substituted.
- A title-basis entry id uses the archive day, not the fact day, so a re-run keeps it.
- `runId` suffix is the attempt number counted from the existing Run object for the date (`-1` on a fresh store, also in a backfill).
- Verdicts are read only for sampled questions (`Q#/SAMPLED` batch read first), since only those get verdicts, and only for questions whose `forecast_drawn` fact is inside the 60-day lookback; a verdict landing on a forecast older than 60 days is missed.
- The Run object carries two extra fields, `date` and `daysWritten`; `net.au` is added to the two-level suffix list (abc.net.au is in the outlet table).

```sh
node backend/record/newsStoryRecord/dryrun.mjs --from 2026-09-06 --to 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/facts-dryrun/
```

The dry run reads live DynamoDB (`get-item`, `query`, `batch-get-item` through the aws CLI; nothing else is allowed) and writes the would-be S3 objects to local files with local ETags through the real shared helpers. See [DRYRUN.md](DRYRUN.md) for the 2026-09-06..2026-10-20 result.

## Tests

```sh
FRONTEND_NODE_MODULES=<main checkout>/global-perspectives-starter/frontend/node_modules node --test backend/record/newsStoryRecord/test/*.test.js
cd backend/shared && node --test test/record.test.js test/outlets.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Tests use scripted stores, a fake ETag-aware S3 and, for the `today-archive` cases, the real world readers over `world.fake.js`. `FRONTEND_NODE_MODULES` is needed only for the schema test (the frontend's Ajv).

Last verified: 2026-10-21 (offline tests and a local read-only dry run; not deployed)
