# newsDriftCorrector

Living-analysis corrector. Per covered country (and per thread in the latest topics): (1) a deterministic
gate on daily `HISTORY#` / `THREAD_HISTORY#` snapshots asks whether the conclusion moved recently (risk
level / |delta score| >= 8 / trajectory, within `DRIFT_LOOKBACK_DAYS`); most days are a no-op with no LLM.
(2) If it moved, DeepSeek picks the single numbered real archive event that explains it, or declares no
single driver. (3) It writes a note and never overwrites the analysis. `src/directionCheck.js` rejects
explanations whose direction contradicts the score delta (one retry, then a numbers-only note).
Served by `newsSensitiveData` (`driftNotes`); `newsEmailSender` `drift_alert` mails fresh country notes.

## Deployment
- Deployed name `newsDriftCorrector` · runtime `nodejs20.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerDriftCorrector` `cron(30 5 * * ? *)` (UTC, ENABLED). Manual: `{"country":"Ukraine"}`, `{"threadId":"..."}`, `{"dryRun":true}`.
- Deploy: `scripts/lambda.sh newsDriftCorrector diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: query `COUNTRY#<c>` `HISTORY#*` and `THREAD#<id>` `THREAD_HISTORY#*`; writes `DRIFT#<date>` (`ttl` `DRIFT_TTL_DAYS`, 60) and `DRIFTLOG#<date>` (no TTL, permanent member history) on the same PK.
- DynamoDB `TOPICS_DDB_TABLE`: `archive#<date>` + `today-archive` (day-zero filtered) for events; `latest` for thread ids.
- Countries: `DRIFT_COUNTRIES` (comma list; code default is 12 countries). `DRIFT_MAX_EVENTS` (25) events per prompt.

## Models
- `XAI_API_KEY` / `GROK_API_URL` (default `https://api.deepseek.com/chat/completions`) / `GROK_MODEL` (fallback `deepseek-flash`): legacy names hold DeepSeek. Sends `thinking: { type: 'disabled' }`.

## Gotchas
- Idempotent per date: an existing `DRIFT#<date>` row is skipped (`alreadyNoted`). `src/dayZero.js` and the direction regexes are synced copies (`scripts/check-shared-sync.mjs`).

## Tests
- `cd backend/pipeline/newsDriftCorrector/src && npm test` (`node --test ../test/*.test.js`): 31 pass.

Last verified: 2026-10-19
