# Local facts dry run: 2026-09-06 to 2026-10-20

`node dryrun.mjs --from 2026-09-06 --to 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/facts-dryrun/` on 2026-10-21, `shadow:true`, `strict:false`, no model. **AWS writes: zero.** The adapter allows only `dynamodb get-item`, `query` and `batch-get-item` (anything else throws); the only S3 access is the real shared helpers writing local files with local ETags. Output: `record/shadow/facts/*.jsonl` (46 files incl. the run facts' days), `record/shadow/runs/*.json` (45), `record/shadow/facts/manifest.json`, `summary.json`.

## Totals
New facts appended: entry 929, story_born 401, forecast_drawn 994, verdict 0, correction 0, story_merged 0, run 45.
Run statuses: {'ok': 28, 'failed': 17}. **Missing days (17):** 2026-09-14, 2026-09-15, 2026-09-16, 2026-09-17, 2026-09-18, 2026-09-19, 2026-09-20, 2026-09-21, 2026-09-22, 2026-09-23, 2026-09-24, 2026-09-25, 2026-09-26, 2026-09-27, 2026-09-28, 2026-09-29, 2026-10-14. **Thin days (3):** 2026-09-13 (17 entries), 2026-10-13 (13 entries), 2026-10-20 (14 entries).
`failed` here is a missing archive row (Run `inputs.archiveDay:"missing"`, zero facts); there are no other failures. Zero verdicts: no `VERDICT` row exists live yet. Entries archived before 2026-09-12 carry `iso3:[]` and `actorIds:[]`, by rule.

## Per day (counts are facts newly appended by that day's run)
| Day | Run | archiveDay | todayArchive | entry | story_born | forecast_drawn | verdict |
|---|---|---|---|---:|---:|---:|---:|
| 2026-09-06 | ok | present | missing | 40 | 10 | 52 | 0 |
| 2026-09-07 | ok | present | missing | 40 | 21 | 50 | 0 |
| 2026-09-08 | ok | present | missing | 45 | 23 | 50 | 0 |
| 2026-09-09 | ok | present | missing | 41 | 12 | 50 | 0 |
| 2026-09-10 | ok | present | missing | 47 | 28 | 50 | 0 |
| 2026-09-11 | ok | present | missing | 45 | 17 | 50 | 0 |
| 2026-09-12 | ok | present | missing | 39 | 18 | 50 | 0 |
| 2026-09-13 | ok | thin 17 | missing | 9 | 5 | 17 | 0 |
| 2026-09-14 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-15 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-16 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-17 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-18 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-19 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-20 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-21 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-22 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-23 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-24 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-25 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-26 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-27 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-28 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-29 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-09-30 | ok | present | missing | 48 | 48 | 50 | 0 |
| 2026-10-01 | ok | present | missing | 26 | 12 | 26 | 0 |
| 2026-10-02 | ok | present | missing | 36 | 19 | 37 | 0 |
| 2026-10-03 | ok | present | missing | 36 | 14 | 44 | 0 |
| 2026-10-04 | ok | present | missing | 29 | 5 | 37 | 0 |
| 2026-10-05 | ok | present | missing | 36 | 10 | 34 | 0 |
| 2026-10-06 | ok | present | missing | 45 | 19 | 48 | 0 |
| 2026-10-07 | ok | present | missing | 36 | 15 | 41 | 0 |
| 2026-10-08 | ok | present | missing | 38 | 14 | 40 | 0 |
| 2026-10-09 | ok | present | missing | 32 | 9 | 31 | 0 |
| 2026-10-10 | ok | present | missing | 42 | 15 | 44 | 0 |
| 2026-10-11 | ok | present | missing | 25 | 12 | 29 | 0 |
| 2026-10-12 | ok | present | missing | 35 | 7 | 24 | 0 |
| 2026-10-13 | ok | thin 13 | missing | 11 | 1 | 0 | 0 |
| 2026-10-14 | failed | missing | missing | 0 | 0 | 0 | 0 |
| 2026-10-15 | ok | present | missing | 41 | 24 | 40 | 0 |
| 2026-10-16 | ok | present | missing | 24 | 13 | 31 | 0 |
| 2026-10-17 | ok | present | missing | 34 | 10 | 31 | 0 |
| 2026-10-18 | ok | present | missing | 24 | 4 | 19 | 0 |
| 2026-10-19 | ok | present | missing | 25 | 16 | 19 | 0 |
| 2026-10-20 | ok | thin 14 | missing | 0 | 0 | 0 | 0 |
