# NewsProjectInvokeAgentLambda

Per-cycle story generator. Loads the `staging` topics, generates (or reuses) a summary, trace-cause and
grounded forecast per topic (`action` summary|prediction|trace_cause|both, default both), assigns
threadIds against 7 days of archive, builds the story-to-thread map, swaps `staging` to `latest`, writes
the archive rows, prunes old-generation cache rows, and marks `staging` processed (`agentProcessedAt`).
Forecasts get FACTS# leaders and an arc digest as grounding (no live web search). Payload options: `topicId`, `readOnly`, `force` (ignore processed/cache guard; freshness still enforced), `dryRun` (plan only).

## Deployment
- Deployed name `NewsProjectInvokeAgentLambda-dev` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `InvokeNewsAgent` `cron(25 4/8 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh NewsProjectInvokeAgentLambda diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: `staging` (read, set `agentProcessedAt`), `latest` (write), `today-archive` + `archive#YYYY-MM-DD` (read/write).
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#<id>` / `SUMMARY|PREDICTION|TRACE_CAUSE` (TTL 259200 s; each row carries `threadId`); writes the thread → topic pointer `THREAD#<threadId>` / `TOPICS` (`topicId` = current, `topicIds` string set = every topicId the thread has had, so PRED# rows are reachable by thread); reads `FACTS#<country>`/`COUNTRY_FACTS`; scans and batch-deletes old-generation rows when `CACHE_CLEANUP_ENABLED` (default true).
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#<topicId>` / `<YYYY-MM-DD>`.
- S3 `WORLD_BUCKET`: reads `stories/state/*`, writes `threads/story-map.json` (matcher; R3 tier off unless `ENABLE_R3_TIER=true`).

## Models
- `XAI_API_KEY` / `GROK_API_URL` (code default `api.x.ai`; set in the live env) / `GROK_MODEL` (fallback `deepseek-flash`): legacy names, live provider is DeepSeek. `PREDICTION_MODEL` overrides the forecast model. All calls share `lib.buildChatBody` with thinking disabled.
## Threading
- `src/threading.js` (pure): a topic joins the thread of an archive entry from today's earlier runs or the past 7 days on its `continues_topic` title or its own title (both compared normalised: case, whitespace, punctuation), else when the composite score (0.5 keywords + 0.3 regions + 0.2 category) is >= 0.4 AND keyword-only Jaccard is >= 0.15; otherwise it founds `thread-<slug>-<sha1>`. Measured in `.board/linking/joins.md`. The whole run is compared before new ids are minted (including forward explicit continuations); it does not merge two established historical threads. If continues_topic and exact title disagree, the thread's latest archived member wins, with tie retaining continues_topic and conflict evidence logged. Each assignment logs `[join] {topicId, threadId, via, score, kwScore}` (via `continues_topic|title|score|new` or `run-*`; conflict/run-anchor metadata when applicable).
- Repair: `node backend/pipeline/cli/threads.mjs list-joins --since <date>` (read-only), `merge <from> <into>`, `split <threadId> <topicId...>` print every DynamoDB/S3 change and write only with `--apply` (operator yes). Tests: `node --test backend/pipeline/cli/threads.test.mjs`.
## Gotchas
- Freshness guard (`src/run-guard.js`): no generation writes from active fallback, missing/future generation time, a prior UTC day's generation, or a generation older than the latest archive write. Reads rolling/current/prior-day archives consistently before generation and again before publication. `force` cannot bypass freshness; `readOnly` cache inspection and `dryRun` planning remain available. Zero newly generated items returns HTTP 503 with `[pipeline-status] {status:"failed", reason:"zero-generated", generationId, generated, reused, failed}` and does not swap, archive, match or prune (cache reuse may already have restamped topic rows). Stale staging returns the same marker with `reason:"stale-staging"` and `staleReason`. Monitor integration is a coordinator change.
- Run guard: a `staging` already marked `agentProcessedAt` is skipped unless `force`, `topicId`, `readOnly` or `dryRun`. `http()` emits `Access-Control-Allow-Origin: *` (scheduler-invoked). `package.json` lists Bedrock SDK deps the code does not use.

## Tests
- `cd backend/pipeline/NewsProjectInvokeAgentLambda/src && npm test` (`node --test ../test/*.test.js`): 81 pass.
Last verified: 2026-10-20 (offline; lane/pipeline, not deployed)
