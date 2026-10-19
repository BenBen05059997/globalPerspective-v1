# newsGdacsIngest

Keyless, LLM-free ingest of the GDACS disaster feed (UN+EU). Each run fetches the current event list, writes the full current set to the S3 corpus (read by newsImpactAudit), and writes one observation snapshot of all current Orange/Red events to the situations inbox. It holds no situation state: the tracker folds the observations. The pure helpers (`buildObservation`, `buildSituation`, `coolSituation`, `buildStorySituation`) live in `backend/shared/src/situations-core.js`, reached through the `src/_shared` symlink and shared with newsSituationTracker.

## Deployment
- Deployed name `newsGdacsIngest` · runtime `nodejs22.x` · group `situations` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerGdacsIngest` `rate(20 minutes)` (ENABLED)
- Deploy: `scripts/lambda.sh newsGdacsIngest diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip does not ship node_modules (the runtime's @aws-sdk v3 is used).

## Reads / writes
- External: `GDACS_FEED` (default `www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP`).
- S3 `WORLD_BUCKET`: overwrites `corpus/gdacs/latest.json` (`GDACS_CORPUS_PREFIX`) and `situations/inbox/gdacs-latest.json` (`SITUATIONS_INBOX_PREFIX`). Both are stable pointers, not timestamped files.
- DynamoDB: none at runtime. The GlobalPerspectiveGdacsEvents mirror was dropped in S8·T2 (2026-09-09).

## Gotchas
- `SITUATIONS_INBOX_DISABLED=true` skips the inbox write. Corpus and inbox writes are best-effort: a failure is logged and never fails the run.
- The file header still says it "mirrors ... into GlobalPerspectiveGdacsEvents". That is stale: the handler no longer writes DynamoDB, and `GDACS_TABLE` and `ddb()` are unused.
- `coolSituation` keeps the pre-cool tier (audit F3); its doc comment still says "cooling at tier 'low'".
- Not a Function URL; the code emits no CORS headers.

## Tests
- No Lambda-local tests. The situations-core tests: `cd backend/shared && node --test test/situations-core.test.mjs` (passes 2026-10-19).

Last verified: 2026-10-19
