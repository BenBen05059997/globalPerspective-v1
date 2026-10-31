# newsDriftCorrector

Living-analysis corrector. Per covered country (and per thread in the latest topics): (1) a deterministic
gate on daily `HISTORY#` / `THREAD_HISTORY#` snapshots asks whether the conclusion moved recently (risk
level / |delta score| >= 8 / trajectory, within `DRIFT_LOOKBACK_DAYS`); most days are a no-op with no LLM.
(2) If it moved, DeepSeek picks the single numbered real archive event that explains it, or declares no
single driver. (3) It writes a note and never overwrites the analysis. `src/directionCheck.js` rejects
explanations whose direction contradicts the score delta (one retry, then a numbers-only note).
Served by `newsSensitiveData` (`driftNotes`); `newsEmailSender` `drift_alert` mails fresh country notes.

## Deployment
- Deployed name `newsDriftCorrector` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerDriftCorrector` `cron(30 5 * * ? *)` (UTC, ENABLED). Manual: `{"country":"Ukraine"}`, `{"threadId":"..."}`, `{"dryRun":true}`.
- Deploy: `scripts/lambda.sh newsDriftCorrector diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: query `COUNTRY#<c>` `HISTORY#*` and `THREAD#<id>` `THREAD_HISTORY#*`; writes `DRIFT#<date>` (`ttl` `DRIFT_TTL_DAYS`, 60) and `DRIFTLOG#<date>` (no TTL, permanent member history) on the same PK.
- S3 `WORLD_BUCKET`, drift notes (decision 0042): each `DRIFT#<date>` written (not the `DRIFTLOG#` copy), country or story, is also written as a `drift` note to `<NOTES_PREFIX>notes/drift/DAY.jsonl` through shared `notes.js` (`src/recordNotes.js`; subject = the country's ISO3 from the shared `resolveIso3`, a country with no ISO3 is skipped and logged; a story's note has subject kind `story` = its threadId, no countries, and is what the story view reads as `analysis.driftNote`). Best-effort: a failure logs `[notes]` and never fails the run. `NOTES_PREFIX` defaults to `record/shadow/`; set `record/` to go live. Needs role access: Get/Put on `record/notes/drift/*` and `record/shadow/notes/drift/*`, plus `s3:ListBucket` on the world bucket so a new day file reads as missing.
- DynamoDB `TOPICS_DDB_TABLE`: `archive#<date>` + `today-archive` (day-zero filtered) for events; `latest` for thread ids.
- Countries: `DRIFT_COUNTRIES` (comma list; code default is 12 countries). `DRIFT_MAX_EVENTS` (25) events per prompt.

## Models
- `XAI_API_KEY` / `GROK_API_URL` (fallback `https://api.deepseek.com`) / `GROK_MODEL` (fallback `deepseek-flash`) through the shared client `src/_shared/llm.js`: legacy names hold DeepSeek. Thinking is disabled.

## Gotchas
- Idempotent per date: an existing `DRIFT#<date>` row is skipped (`alreadyNoted`). `dayZero` and `llm` come from `backend/shared/src` through the `src/_shared` symlink. `src/directionCheck.js` holds the direction-check prose rules (the frontend copy no longer exists).

## Tests
- `cd backend/pipeline/newsDriftCorrector/src && npm test` (`node --test ../test/*.test.js`).
