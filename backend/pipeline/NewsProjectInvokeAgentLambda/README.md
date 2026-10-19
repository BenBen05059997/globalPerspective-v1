# NewsProjectInvokeAgentLambda

Per-cycle story generator. Loads the `staging` topics, generates (or reuses) a summary, trace-cause and
grounded forecast per topic (`action` summary|prediction|trace_cause|both, default both), assigns
threadIds against 7 days of archive, builds the story-to-thread map, swaps `staging` to `latest`, writes
the archive rows, prunes old-generation cache rows, and marks `staging` processed (`agentProcessedAt`).
Forecasts get FACTS# leaders and an arc digest as grounding; Brave news (`api.search.brave.com`) is added only
when `BRAVE_SEARCH_API_KEY` is set, and it is not set live (checked 2026-10-19). Payload options: `topicId`, `readOnly`, `force` (ignore run guard), `dryRun` (plan only).

## Deployment
- Deployed name `NewsProjectInvokeAgentLambda-dev` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `InvokeNewsAgent` `cron(25 4/8 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh NewsProjectInvokeAgentLambda diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: `staging` (read, set `agentProcessedAt`), `latest` (write), `today-archive` + `archive#YYYY-MM-DD` (read/write).
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#<id>` / `SUMMARY|PREDICTION|TRACE_CAUSE` (TTL 259200 s); reads `FACTS#<country>`/`COUNTRY_FACTS`; scans and batch-deletes old-generation rows when `CACHE_CLEANUP_ENABLED` (default true).
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#<topicId>` / `<YYYY-MM-DD>`.
- S3 `WORLD_BUCKET`: reads `stories/state/*`, writes `threads/story-map.json` (matcher; R3 tier off unless `ENABLE_R3_TIER=true`).

## Models
- `XAI_API_KEY` / `GROK_API_URL` (code default `api.x.ai`; set in the live env) / `GROK_MODEL` (fallback `deepseek-flash`): legacy names, live provider is DeepSeek. `PREDICTION_MODEL` overrides the forecast model. All calls share `lib.buildChatBody` with thinking disabled.

## Gotchas
- Run guard: a `staging` already marked `agentProcessedAt` is skipped unless `force`, `topicId`, `readOnly` or `dryRun`. `http()` emits `Access-Control-Allow-Origin: *` (scheduler-invoked). `package.json` lists Bedrock SDK deps the code does not use.

## Tests
- `cd backend/pipeline/NewsProjectInvokeAgentLambda/src && npm test` (`node --test ../test/*.test.js`): 56 pass.

Last verified: 2026-10-19
