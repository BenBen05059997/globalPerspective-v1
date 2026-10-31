# newsGdeltConflict

Keyless ingest of GDELT 2.0 material-conflict events, used as the open replacement for ACLED. Each run downloads the latest 15-minute GDELT events export (zip), keeps QuadClass 4 (material conflict) rows with at least `GDELT_MIN_MENTIONS` mentions (default 10), and aggregates them by country (mentions, event count, worst Goldstein, worst tone, top event, source URL). It stores the top `GDELT_TOP_N` countries (default 30) as a per-day S3 file, which newsImpactAudit reads. No LLM.

## Deployment
- Deployed name `newsGdeltConflict` · runtime `nodejs22.x` · group `situations` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerGdeltConflict` `cron(0 */6 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsGdeltConflict diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (`adm-zip`).

## Reads / writes
- External: `GDELT_LASTUPDATE` (default `data.gdeltproject.org/gdeltv2/lastupdate.txt`), then the `.export.CSV.zip` it lists.
- S3 `WORLD_BUCKET`: overwrites `corpus/gdelt/<YYYY-MM-DD>.json` (`GDELT_CORPUS_PREFIX`). Last run of the day wins.
- DynamoDB: none at runtime. The GlobalPerspectiveGdeltConflict mirror was dropped in S8·T2 (2026-09-09).

## Gotchas
- The header comment still says it stores to GlobalPerspectiveGdeltConflict and is "SHADOW". The code now writes only S3; `GDELT_TABLE` and the module-level DynamoDB client are unused. `GDELT_TTL_DAYS` is read but no longer applied.
- Column indexes (QuadClass 29, NumMentions 31, ActionGeo 52/53, SOURCEURL 60) are hard-coded from a 61-column export checked on 2026-06-24. Rows with fewer than 61 columns are skipped.
- A run samples a single 15-minute export file, not a full day.
- The S3 write is best-effort: a failure is logged and the run still returns `ok`.
- Not a Function URL; the code emits no CORS headers.

## Tests
- None.
