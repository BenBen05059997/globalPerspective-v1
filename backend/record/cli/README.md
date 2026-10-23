# record/cli

Operator tools for the record. They run from a laptop; they are not deployed as Lambdas. Timeline: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

## recover-day.mjs

Rebuilds a missed day's raw articles from public records, with no model (decision 0040 rule 2, [0040](../../../project-docs/decisions/0040-raw-before-model.md)). It writes the same inbox lines the selector writes (`record/inbox/articles/DAY.jsonl`, `rawId = sha1(canonical url)`), plus `recoveredAt` and `recoveredFrom`.

Sources, in dedupe priority order:
1. Wayback (`recoveredFrom:"wayback-rss"`): the Internet Archive CDX list of the day's snapshots of each of our feed URLs, each snapshot parsed with the selector's own parser (`backend/shared/src/rss.js`). Real `publishedAt`; only items published on the day are kept. Holes are expected.
2. GDELT DOC 2.0 article list (`recoveredFrom:"gdelt-doc"`, `feed:"gdelt-doc"`): one query per feed domain per day (`domainis:<domain> sourcelang:english`, plus `bbc.co.uk` for BBC), `mode=artlist`, up to 250 records, a window that hits 250 is halved (down to 15 minutes). `publishedAt` is GDELT's `seendate` (when GDELT saw it, so `precision:"day"`), `snippet:null`. English only unless `--all-languages` (our feeds are English).

The domain list is read from the selector's `RSS_FEEDS`, so a new feed is picked up automatically. Lines are deduped by `rawId` across both sources and against the day's existing inbox file (`--merge`); the existing lines are never rewritten.

```
node backend/record/cli/recover-day.mjs --day 2026-09-20 [--to 2026-09-29] --out ./recovery-out      # dry run, local files only
node backend/record/cli/recover-day.mjs --day 2026-09-20 --out ./o --merge --bucket <world bucket>   # also reads the existing inbox for dedupe
node backend/record/cli/recover-day.mjs --day 2026-09-20 --bucket <world bucket> --write [--shadow]  # read-merge-write to S3
```

Other flags: `--no-gdelt`, `--no-wayback`, `--no-split`, `--domains a.com,b.com`, `--gdelt-delay-ms` (default 6500). Output per day: `DAY.jsonl` and `recovery-manifest-DAY.json` (`day`, `fetchedAt`, `counts` per source and outlet, `sources` per domain and feed, `failures`). The console prints counts per source and per outlet.

Rate limits: GDELT answers 429 (and keeps answering it for a while) when requests come faster than one per 5 seconds ("limit requests to one every 5 seconds"), so the script waits 6.5 s between GDELT calls (about 3 minutes per day, more when a window is split) and backs off on 429 (15 s, 30 s, ... up to 6 retries) and 5xx. Wayback is spaced 1 s.

Write path (`--write`): uses `backend/shared/src/s3json.js` `appendLines` (conditional put, retry on 412; ids already stored are skipped), bucket from `--bucket` or `WORLD_BUCKET`, shadow prefix `record/shadow/inbox/articles/`. It needs `@aws-sdk/client-s3`, which the repo does not install: `npm i --no-save @aws-sdk/client-s3` in a scratch directory and set `RECOVER_SDK_DIR` to it. The writer's IAM is the operator's; the coordinator runs `--write`, a lane never does.

### Deadline

GDELT DOC reaches back three months only. 2026-09-14 is out of reach after 2026-12-14, 2026-09-29 after 2026-12-29. Run the September gap first. Wayback has no window.

### How the coordinator runs it

1. Dry run a gap day, read the manifest counts, check `failures`.
2. `--write --shadow` once, then without `--shadow`.
3. Invoke `newsStoryRecord` with `{"recovery":true,"date":"DAY"}`. It turns the inbox into `article` facts and writes the Run with `notes:"recovery"`.

Recovered days never draw forecasts: `newsStoryRecord` refuses `forecast_drawn` on a recovered day, and runs without `recovery:true` are not meant for gap days. Recovered days are unscored and labelled "recovered from public records" (0040 recovery rules).

## recover.test.mjs

Offline tests (URL building, GDELT JSON and CDX fixtures in `fixtures/`, line shape, dedupe, window split, fake-fetch walk): `node --test backend/record/cli/recover.test.mjs`. The shared parser has its own test in `backend/shared/test/rss.test.js`.

Last verified: 2026-10-23.
