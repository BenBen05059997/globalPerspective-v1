# 0047. The history before the record's first day is copied into the record

Status: proposed (built and proven on a local copy 2026-10-31; nothing is written to `record/` yet; the coordinator runs the commands below, shadow first); follows 0035, 0036, 0037, 0042, 0043, 0044, 0046
Date: 2026-10-31

## Context
The record's facts start 2026-09-05 (`record/facts/manifest.json`, 57 days). Four families exist only in DynamoDB and must be copied before the tables can go (STEP5_AUDIT.md, sections 0, 3, 6 steps 5, 7 and 9):
- NewsCache `archive#DAY`: 141 days before 2026-09-05 (2026-03-07..09-04), 6,919 entries. 41 days of that span have no row at all (04-29..05-15, 07-12..07-23, 07-25, 08-23..09-02).
- 202 of 330 `THREAD#/THREAD_ANALYSIS` rows belong to stories the record does not have.
- 5,153 PredictionLog `PRED#` rows before 09-05 (2026-06-02..09-04) and 348 unthreaded rows from 09-05..09-30 (no `questionSchema`).
- 2026-09-05 itself had no entry facts. Diagnosis: the first live replay ran `--from 2026-09-06` (and the file `facts/2026-09-05.jsonl` holds only the 2 `forecast_drawn` facts that the 09-06 run found in its 30-day PRED window), so the 09-05 archive day (50 entries) was never a run day. `runs/` starts at 2026-09-06.

## Decision
Use the record's own code, not a second implementation. `backend/record/cli/backfill-history.mjs` replays 2026-03-07..2026-09-05 oldest first through `newsStoryRecord`'s `backfill:{from,to}` with `strict:false` (the 41 empty days end a `failed` Run with `archiveDay: missing`, as the handler already does; no monitor reads Runs, and the Run object and `run` fact are the honest statement that those days have nothing). It reads DynamoDB only (two Scans held in memory: `archive#` rows, `PRED#` rows), writes through the shadow prefix of the handler mapped onto the target (`--live` = `record/`), and builds the views at the end. Everything below is the nightly code's behaviour, measured, except the four additions in "What was added".

| Source | Becomes | By |
|---|---|---|
| archive entries | `entry` fact (+ its ingest `assignment`), `story_born` per thread, `at` = `archivedAt`, `precision: day` | the replay |
| `ai` texts of each archive entry (summary, forecast, cause) | `entry` notes, archive copies (`model` null) | `backfill-entry-notes.mjs` (unchanged logic; its days are the facts manifest's, so the old days follow the facts) |
| 202 `THREAD_ANALYSIS` rows | `story_analysis` notes | `backfill-story-analysis-notes.mjs` after the views exist |
| 22 thread `DRIFT#` rows of those stories | story `drift` notes | `backfill-story-drift-notes.mjs` |
| `PRED#` rows | `forecast_drawn` facts: the replay's rule (own thread, else the topic's entry in the 30-day window), then `planForecastGaps` (nearest entry of the topic, then an entry with the same title within 3 days, marked `payload.threadFrom: "title"`) | the replay, then its gap pass |
| `PRED#` rows no rule places (no story) | the whole DynamoDB row in `record/legacy/predictions/DAY.jsonl` (+ `manifest.json`), `reason: no_story`; not a fact | the gap pass |

## What was added to the code
- `entryFact`: `payload.regions` (the archive row's places text) when present. The history has no `iso3`, no actors and no `publishedAt` on any entry (all 6,919), so `regions` is the only place text the DynamoDB row holds and would be lost with it. `iso3` stays `[]` as for 09-06..09-12 (0036: missing inputs stay missing); deriving it from `regions` is open (below).
- `forecastFact(..., threadFrom)`; `planForecastGaps` (`backfill-forecasts.mjs`): nearest entry in time instead of the latest, the title rule, `--from` for a range before the record, a runId the fact schema allows (`forecasts-backfill-DATE`).
- `--prefix` on `backfill-entry-notes.mjs`, `backfill-story-analysis-notes.mjs`, `backfill-story-drift-notes.mjs`: they read the manifest, facts and views of that prefix (they read live `record/` regardless of the write prefix before, so a shadow rehearsal could not match anything).
- `backfill-history.mjs` (replay, gap pass, legacy copy, `--views`), `check-history.mjs` (the measurements below, local files only). `newsStoryRecord/dryrun.mjs` is deleted: it had no `scan` since the PRED window read was added and `backfill-history.mjs` does its job for any range.

## Design problems and how they resolve
- **Facts files for days before the manifest's first day.** Append-only per day, `manifest.addDays` is a sorted union, `appendLines` is conditional and idempotent. A re-run adds only 183 `run` facts (one per replayed day, new attempt number) and nothing else. The nightly run only needs the 100 days behind it; views read every manifest day (239 files, 71 MB).
- **Dedupe looks 100 days back.** Not a problem in the data: no article is listed again more than 7 days after its first listing (357 of the 421 earlier repeats are the next day, 64 within 2-7 days). At the seam the replay of day D reads facts D-100..D+1 only, so a replay fact can duplicate a live fact 2 or more days later: one case (the UN map article, `eventId` 9ddde994, a fact on 09-04 and on 09-06). Views keep the earliest of equal `eventId`s, so it is one entry. Eight articles listed on 09-05 stay dated 09-06 (the live fact exists and facts are never rewritten).
- **A thread that spans 09-05: second `story_born`?** `story_born`'s eventId is `sha1('story_born' + 'birth|' + threadId)`, so a second one has the same eventId and the views keep the earliest. The live record has no `story_born` for any of the 35 threads that cross 09-05 (the 09-06 run saw their earlier entries in its window and wrote none), so the replay supplies it. 39 live stories change `born` (36 earlier, 3 from none); 0 `story_born` eventIds with two facts in the data. A test pins the duplicate case (`backfill-history.test.mjs`).
- **Merges and assignments.** The 7 live merges still apply (their stories now carry their history; `fromThreadId` as before). The replay writes one ingest `assignment` per fresh entry fact (5,169), so `assignmentsBackfill` is not needed for history. History has no operator or review assignments, readings, chapters or lines: `reading: none` for the old stories.
- **Older rows missing fields.** All 6,919 entries lack `iso3`, `actors`, `event_type` and `publishedAt` (so `precision: day`, `at` = `archivedAt`, which every row has); 100 entries in March have no `threadId` (facts with a null thread, no story, no assignment, no view). Sources have `source`, `title`, `url`, `snippet`, `age`; every entry got `idBasis: url` (none fell back to the title). Not carried: `age`, `significance`, `x_trending`, `enrichScore`, `search_keywords`, `generationId` (kept in the `sourceKey`), and the `ai` text beyond what the agent kept (1,500 characters). Valid against `fact.schema.json`: 19,266 facts checked, the only 3 failures are older live facts with a runId the schema did not allow; 183 Runs and 4,203 story views valid.
- **The same article listed again (the repeat rule, applied to history).** 8,250 archive entries over all 177 days, 6,324 entry facts, 0 entries without an explanation: 1,497 are the same article listed twice on one day, 421 an earlier listing, 8 a later one (09-05). March is the extreme (484 of 1,250 entries are same-day repeats). Consequence: 910 of the dropped listings were under another thread than the claiming fact, and 597 threads end with no entry (title null in the index, like 92 of 625 live stories before). That is the single-article-one-fact rule (0036, 0046), not a copy loss of the article, but the second thread's link to it exists only in DynamoDB.
- **Views and size caps** (all measured on the merged record, with the notes below applied). `index/all.json` 1.53 MB of 5 MB (about 14,000 stories at this row size); `index/analyses.json` 759 KB of 2 MB (330 analyses, was 120); `active` 255 KB (656 stories, 618 before: 38 stories last active 09-02..09-05 are in the 60-day window until about 11-04); `weekly`, `web`, `countries` unchanged (30-day windows). 4,203 story views (625 before), 54.6 MB (largest: the Ebola story, 800 KB, 400 entries, cap). Publishing all of it takes 1.4 s CPU and 392 MB RSS locally against the Lambda's 1,024 MB and 900 s; it writes 8,475 objects a night instead of about 1,250 (story and link views are rewritten whole each run).
- **Track record (0044).** `views/track-record.json` is equal to the live file except `asOf` (checked field by field: `issued` 5,283, `warmUp` 1,406, `sampledTotal` 66, `firstIssuedAt` 2026-09-30T12:26:00Z, `legacyPredictionsExcluded` 2,418). Reason: it counts only branches with `question === true` and a `qid`; none of the 6,613 `PRED#` rows before 2026-09-05 or among the 348 gap rows has either (`questionSchema` starts 2026-09-30; its 27 September rows were already facts). `legacy` is a constant, not computed from facts. The 31,336 legacy branches (28,885 without a verdict) show on story pages as `legacy: true`.
- **Which forecast rows become facts.** 6,613 rows: 5,100 `forecast_drawn` facts (1,112 already live + 3,610 by the replay's own rule + 378 by the gap pass: 377 by title, 1 by topic) and 1,513 whole-row copies; 0 neither. The 348 unthreaded rows of 09-05..09-30 (the audit's known gap): 96 become facts, 252 are copied (the 395 other unthreaded September rows were already facts through their topic). The 5,153 rows before 09-05: 3,892 facts, 1,261 copies.

## Measured results (local replay 2026-10-31, fresh `archive.json`/`pred.json`/`thread_analysis.json` scans)
Replay 03-07..09-05: 183 days, 142 `ok`, 41 `missing`, 1 thin (07-24, 13 entries), 0 failures. Facts written: 5,224 `entry`, 3,617 `story_born`, 3,610 `forecast_drawn`, 5,169 `assignment`, 183 `run`; gap pass: 378 `forecast_drawn` (377 title, 1 topic) on 74 days, 1,513 legacy rows on 77 days. Totals on the record afterwards: 239 fact days (2026-03-07..10-31), `entry` 6,324, `story_born` 4,124 (= archive threads 4,124; 0 threads without one), `forecast_drawn` 5,100.

| Month | Archive entries | Entry facts | Same article, same day | Listed earlier | Listed later | No explanation |
|---|---|---|---|---|---|---|
| 2026-03 | 1,250 | 759 | 484 | 7 | 0 | 0 |
| 2026-04 | 1,400 | 1,011 | 373 | 16 | 0 | 0 |
| 2026-05 | 745 | 577 | 84 | 84 | 0 | 0 |
| 2026-06 | 1,500 | 1,217 | 193 | 90 | 0 | 0 |
| 2026-07 | 851 | 667 | 127 | 57 | 0 | 0 |
| 2026-08 | 1,100 | 897 | 132 | 71 | 0 | 0 |
| 2026-09 | 540 | 450 | 67 | 15 | 8 | 0 |
| 2026-10 | 864 | 746 | 37 | 81 | 0 | 0 |

(September and October rows were already on the record; the history adds 09-05 only: 50 archive entries, 33 facts keyed to that day, 7 same-day, 2 listed 09-04, 8 listed 09-06.) Days with no entry fact: 2026-10-20 only (14 entries, all repeats, 0046).

| | Before | After |
|---|---|---|
| stories in `index/all.json` | 625 (7 aliases) | 4,203 (7 aliases); 674 without an entry (92 before) |
| live story views that change | | 50 of 625: `born` 39 (36 earlier, 3 from none), forks 11, entries only 0; 575 identical |
| `story_analysis` notes | 128 (of 330 rows) | 330 (202 more, 110 note days); 0 unmatched. The 202 carry no `entryTopicIds` (older writer), so `cites` is empty; the 128 older ones keep theirs (118 with cites) |
| story `drift` rows matched | 220 of 242 | 242 |
| entry notes planned (archive copies) | 3,713 live | 24,556 planned over 177 days, 20,804 new, 0 unmatched (126 unmatched before, mostly 09-05) |
| `PRED#` rows as facts | 1,112 of 6,613 | 5,100 (+ 1,513 whole-row copies; 6,613 of 6,613 accounted) |

Rebuild test (`rebuild-test.js`): the views the replay wrote equal a rebuild from the record's facts and notes (8,475 of 8,475, 0 differ). Against the live views: 8,475 rebuilt, 1,239 same, 80 differ (the 50 stories, and the index and links files that list them), 7,156 new files, 0 missing. `weekly.json`: 24 days, 720 entries, identical in count.

## Open problems (the coordinator or operator decides)
1. **41 archive days have no row** (04-29..05-15, 07-12..07-23, 07-25, 08-23..09-02). Their Runs are `failed`/`missing`. `recover-day.mjs` can rebuild raw articles from GDELT/Wayback (articles only, no stories, no notes).
2. **1,513 forecast rows have no story** (1,261 before 09-05, 252 in September): the whole row is kept in `record/legacy/predictions/`, not a fact. A looser title match would place more (token overlap of at least 0.7 within 2 days: 357 of the 1,513; 0.8: 269) but is a guess about which story a forecast belongs to; not done.
3. **Legacy void is not run for the history.** 28,885 branches (forecasts before the question scheme) have no verdict; `legacyVoid` would append 28,885 verdict facts, 23 MB in one day file that every views build reads. Their stories show `legacy` branches without "recorded before scoring began"; the weekly review's bundles skip a branch only when it is voided, so a story with older forks would show them. Operator decision.
4. **`iso3` is empty for all history entries**, so old stories appear in no country view and no link ground. `regions` is kept; deriving `iso3` by `resolveIso3` is a deterministic mapping but a new rule (the archive action does it at read time), and it would need a way to mark derived values.
5. **Not copied:** `THREAD_HISTORY#` (338 rows, no note type), `FACTS#`, briefs, economy and Markets families (step 5 items 3, 6, 10, 12); the pre-09-05 `PRED#` fields that a fact does not carry (rationale, model, winners/losers, capture); the thread links of the 910 repeat listings; per-source `age`, `significance`, `x_trending`, `enrichScore`; `search_keywords`.
6. **Nightly cost grows**: 8,475 view objects written per run instead of about 1,250, and the weekly review's first read after this includes about 38 more active stories (656 vs 618) and every facts day.
7. The 8 articles of 09-05 dated 09-06 and the one duplicate UN fact are harmless but permanent (append-only).
8. The CLIs here run as the operator with an SDK directory; they are not deployed.

## Commands the coordinator runs
Prerequisites: an SDK directory with `@aws-sdk/client-s3`, `client-dynamodb`, `lib-dynamodb` (`RECORD_SDK_DIR`), operator credentials (DynamoDB `Scan`, S3 `GetObject`/`PutObject` on `record/*`), the worktree branch checked out, `B=globalperspective-world-280362093938`, region ap-northeast-1. Run between the nightly run at 23:45 UTC; every step is idempotent and may be repeated. Bucket versioning is off: back up what the live run touches first.

```sh
# 0. back up (the files the live run appends to or replaces; views are rebuildable)
aws s3 sync s3://$B/record/facts/ ./record-backup/facts/ --region ap-northeast-1
aws s3 sync s3://$B/record/runs/ ./record-backup/runs/ --region ap-northeast-1
aws s3 sync s3://$B/record/notes/ ./record-backup/notes/ --region ap-northeast-1

# 1. dry run, local files only (what was done here; a few seconds)
aws s3 sync s3://$B/record/ ./record-copy/ --exclude 'shadow/*' --exclude 'shadow-history/*' --region ap-northeast-1
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-history.mjs --from 2026-03-07 --to 2026-09-05 --out ./history-out --seed ./record-copy --ddb-cache ./ddb-cache
# (the first run with --ddb-cache scans NewsCache archive#, PredictionLog PRED# and SummarizeAndPredict THREAD_ANALYSIS into ./ddb-cache; read only)
RECORD_SDK_DIR=$SDK node backend/record/cli/check-history.mjs --record ./history-out/record/shadow --fallback ./record-copy --ddb ./ddb-cache --live-views ./record-copy/views

# 2. shadow: a copy of the live record under record/shadow-history/, the same run there, then the notes, then the views
for p in facts inbox notes readings operator; do aws s3 sync s3://$B/record/$p/ s3://$B/record/shadow-history/$p/ --region ap-northeast-1; done
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-history.mjs --from 2026-03-07 --to 2026-09-05 --write --ddb-cache ./ddb-cache   # default prefix record/shadow-history/
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-entry-notes.mjs --prefix record/shadow-history/
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-story-analysis-notes.mjs --prefix record/shadow-history/
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-story-drift-notes.mjs --prefix record/shadow-history/
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-history.mjs --views --write
aws s3 sync s3://$B/record/shadow-history/ ./shadow-copy/ --region ap-northeast-1
RECORD_SDK_DIR=$SDK node backend/record/cli/check-history.mjs --record ./shadow-copy --ddb ./ddb-cache --live-views ./record-copy/views
#    expect: entries.totals.noFact 0; stories 4,203; analyses matchedNow 330; forecasts 5,100 facts + 1,513 legacy; vsLive.trackRecord.equalExceptAsOf true

# 3. live (after the shadow check matches the dry run)
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-history.mjs --from 2026-03-07 --to 2026-09-05 --live --ddb-cache ./ddb-cache
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-entry-notes.mjs --live
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-story-analysis-notes.mjs --live
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-story-drift-notes.mjs --live
RECORD_SDK_DIR=$SDK node backend/record/cli/backfill-history.mjs --views --live
aws s3 sync s3://$B/record/ ./live-after/ --exclude 'shadow/*' --exclude 'shadow-history/*' --region ap-northeast-1
RECORD_SDK_DIR=$SDK node backend/record/cli/check-history.mjs --record ./live-after --ddb ./ddb-cache --live-views ./record-copy/views
# views equal a rebuild from the facts: RECORD_DIR is ./live-after without its views/ directory
node backend/record/newsStoryRecord/scripts/rebuild-test.js ./live-after-without-views ./live-after/views $(date -u +%F)
```
`newsStoryRecord` needs no deploy for this (the CLIs run the repo code); its code change (`payload.regions`, `threadFrom`) reaches new nightly facts only when the Lambda is deployed (diff first). Roll back = restore `facts/`, `runs/`, `notes/` from the backup and run `--views --live`; the new facts files for days before 09-05 and `legacy/` are additions and may stay or be deleted by the operator (a destructive S3 delete needs its own yes).

## Consequences
- After step 3 the record holds every archive entry and every forecast row that DynamoDB holds, except the items under "Not copied" and the 41 empty days. NewsCache `archive#` days before 09-05 and PredictionLog `PRED#` rows before 09-05 are then deletable under STEP5_AUDIT steps 7 and 9 (each still needs its own operator yes and the ingest-inbox work those steps name); the 202 stories' analyses stop being a blocker for step 5.
- The 100-day lookback, the nightly code and every view schema are unchanged.
