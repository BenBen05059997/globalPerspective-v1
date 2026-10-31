# newsThreadAnalysis

Daily thread-level AI analysis. Reads 30 days of topic archives, groups entries into narrative threads (2+ entries), and re-analyses up to `MAX_THREADS` (default 10) threads, but only those with a new event the stored analysis has not seen (`src/threadPolicy.js`). Each analysis carries a multi-axis risk vector reduced to a legacy score by `src/riskDimensions.js`. Event `{ dryRun: true }` returns the selection plan with no LLM call or writes.

## Deployment
- Deployed name `newsThreadAnalysis` · runtime `nodejs24.x` · group `pipeline` (scripts/functions.json)
- Trigger: `TriggerDailyAnalysis` `cron(40 4 * * ? *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsThreadAnalysis diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules (a `package-lock.json` is in src but is not used).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads/writes `THREAD#<id>`/`THREAD_ANALYSIS` (ttl 90 days); writes `THREAD#<id>`/`THREAD_HISTORY#<date>` (ttl 60 days)
- S3 `WORLD_BUCKET`, story analysis notes (decision 0042): after the `THREAD_ANALYSIS` write, the stored analysis is also written as a `story_analysis` note to `<NOTES_PREFIX>notes/story_analysis/DAY.jsonl` through shared `notes.js` (`src/recordNotes.js`; subject = the threadId, cites = eventIds of the entries it was built from). Best-effort: a failure logs `[notes]` and never fails the run. `NOTES_PREFIX` defaults to `record/shadow/`; set `record/` to go live. Needs role access: Get/Put on `record/notes/story_analysis/*` and `record/shadow/notes/story_analysis/*`, plus `s3:ListBucket` on the world bucket so a new day file reads as missing.
- Other env names: `MAX_TOKENS` (3500), `TEMPERATURE` (0.2), `TOP_P` (0.9), `INTER_CALL_DELAY_MS`

## Models
- `GROK_MODEL` (code fallback `deepseek-flash`) through the shared client `src/_shared/llm.js`: `GROK_API_URL` (fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names hold DeepSeek values.

## Gotchas
- `ttl` attributes are set, but the SummarizeAndPredict table's TTL is disabled, so rows do not expire.
- `riskDimensions`, `dayZero` and `llm` come from `backend/shared/src` through the `src/_shared` symlink (one copy, shared with newsCountryIntelligence and others); `scripts/lambda.sh` zips them as real files. Shared-module tests live in `backend/shared/test`.
- Threads ageing out of the 30-day window never trigger a re-analysis.

## Tests
- `cd backend/pipeline/newsThreadAnalysis/src && npm test` (`node --test ../test/*.test.js`)
