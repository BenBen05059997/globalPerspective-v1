# newsRecover

Rebuilds one missed, closed UTC day's raw articles from public records, with no model (decision 0040 rule 2, [0040](../../../project-docs/decisions/0040-raw-before-model.md)). It is the recovery step of the ops monitor's self-healing ([ARCHITECTURE_OPS.md](../../../project-docs/architecture/ARCHITECTURE_OPS.md) "Phase 4 as built"): `newsHealth` invokes it when a day's agent archive is still empty after the agent re-run. It can also be invoked by hand.

**Status: deployed 2026-11-06 about 00:00 JST** (role `newsRecover-role`, inline policy `newsRecover` = `iam/policy.json`). No schedule, no Function URL (the code emits no CORS headers).

## What it does
Input `{"day":"YYYY-MM-DD"}` (optional `"dryRun":true`: fetch and report only; `"noWayback":true`). It refuses a day that is not closed in UTC, is older than 14 days, or is not a date.
1. GDELT GKG 2.1 raw files of the day (96 quarter-hour static downloads, no rate limit), rows of our feed domains with a `PAGE_TITLE`, `publishedAt` = when GDELT saw the article (`precision:"day"`).
2. Wayback snapshots of our own feed URLs, parsed with the selector's parser (real `publishedAt`; holes expected; time-boxed: feeds not started when the budget is gone are listed in `failures`).
3. Dedupe by `rawId` (Wayback wins), append to `record/inbox/articles/DAY.jsonl` with `appendLines` (idempotent: a rawId already there is skipped), every line with `recoveredAt` and `recoveredFrom`.
4. Write the outcome to `monitoring/heal/recover/DAY.json`: `status` (`ok`: all 96 GKG files read; `partial`: some missing or failed; `failed`: GDELT read nothing and Wayback found nothing; `refused`; `error`), `gkg`, `wayback`, `counts` (`found`, `appended`, `alreadyThere`, `existingBefore`, `inboxLines`, `bySource`), `failures` (first 20), `failureCount`. That file is how the caller learns the outcome of an asynchronous invoke.

It does not build facts: the caller then invokes `newsStoryRecord {"recovery":true,"date":DAY}` (articles become `article` facts, the Run has `notes:"recovery"`; no forecasts are drawn on a recovered day). Nothing is generated: with GDELT unreachable and no Wayback snapshot, nothing is written and the status is `failed`.

## Code
`src/index.js` (handler, `recoverDay`, `refuse`); `src/recover.js` (feed list, URL builders, GKG/zip/CDX parsers, line shapes, dedupe, the polite fetcher and the per-source recoveries; also used by the operator CLI `backend/record/cli/recover-day.mjs`, which re-exports it). `src/selector-source.js` is a symlink to the ingest Lambda's `index.js` (the feed list has one copy; `scripts/lambda.sh` follows symlinks, so the zip carries the text and `readFeeds` parses it). `src/_shared` links to `backend/shared/src` as everywhere.

## Deployment (done 2026-11-06 with the operator's yes; the commands are kept for a rebuild)
- `nodejs22.x`, handler `index.handler`, timeout 900 s, **3008 MB** (four GKG files of 2-5 MB zipped are unzipped in memory at a time; 1024 MB ran out of memory on a real day), env `WORLD_BUCKET` (default `globalperspective-world-280362093938`), no secrets, no node_modules in the zip.
- Role: `iam/trust.json`, `iam/policy.json` (Get and Put on `record/inbox/articles/*`, Put on `monitoring/heal/recover/*`, ListBucket so a missing day reads as empty, own logs).
```
aws iam create-role --role-name newsRecover-role --assume-role-policy-document file://backend/record/newsRecover/iam/trust.json
aws iam put-role-policy --role-name newsRecover-role --policy-name newsRecover --policy-document file://backend/record/newsRecover/iam/policy.json
scripts/lambda.sh newsRecover package
aws lambda create-function --function-name newsRecover --runtime nodejs22.x --handler index.handler --timeout 900 --memory-size 3008 --role arn:aws:iam::280362093938:role/newsRecover-role --zip-file fileb://.deploy-backups/newsRecover/build.zip --environment 'Variables={WORLD_BUCKET=globalperspective-world-280362093938}' --region ap-northeast-1
```
First check, writes nothing: `aws lambda invoke --function-name newsRecover --payload '{"day":"YYYY-MM-DD","dryRun":true,"noWayback":true}' --cli-binary-format raw-in-base64-out --region ap-northeast-1 /dev/stdout` (use a closed day). Done on 2026-10-22: status `ok`, 96 of 96 GKG files read, 1,213 lines found, about 14 s. The same call at 1024 MB ran out of memory, hence 3008.

## Tests
`cd src && npm test` (`node --test ../test/*.test.js`, offline: fake fetcher and S3). Covers a closed day rebuilt from GKG rows (only our domains, every line marked), a second run adding nothing, GDELT down (status failed, nothing written), a missing quarter (partial), dryRun, the Wayback time budget, and the refusals. The library's own tests are `node --test backend/record/cli/recover.test.mjs`.
