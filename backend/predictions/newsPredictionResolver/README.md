# newsPredictionResolver

Weekly prediction settle Lambda (methodology v1). `tick` (default action, idempotent) commits seed hashes for the next two weeks, draws a seeded sample (K=22, rule `v1`) from every ended week's question-schema predictions, runs the agent draft pass on Mondays, and writes a heartbeat. Other actions: `draw {weekId}`, `draft {limit}`, `status` (read-only counts), `replay {items}` (drafter only, no writes). `dryRun: true` = no LLM, no writes. Drafts are proposals only; the operator writes verdicts (`predictions/settle-review.js`). The drafter never sees a question's probability (`draft.js`).

## Deployment
- Deployed name `newsPredictionResolver` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionResolver` `cron(30 10 * * ? *)` (UTC, ENABLED), input `{"action":"tick"}`
- Deploy: `scripts/lambda.sh newsPredictionResolver diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): reads `PRED#` rows with `questionSchema`; writes `SEED#<week>`/`COMMIT|SECRET|REVEAL`, `SAMPLE#<week>`/`DRAW`, `Q#<qid>`/`SAMPLED|DRAFT#<iso>`, `SETTLE#<week>`/`TICK#<iso>`; reads `Q#<qid>`/`VERDICT`. All writes are conditional put-once (immutable).
- External APIs: Brave Search news + web (`BRAVE_SEARCH_API_KEY`, serialized, ~1.1s gap, 429 retry); LLM chat completions through the shared client `src/_shared/llm.js` at `GROK_API_URL` (fallback `https://api.deepseek.com`)

## Models
- `DRAFT_MODEL` (default `deepseek-v4-pro`) with key `XAI_API_KEY` and URL `GROK_API_URL`; the GROK_*/XAI_* names hold the DeepSeek config. JSON mode, thinking disabled. Concurrency `LLM_CONCURRENCY` (3), cap `MAX_RESOLVE_PER_RUN` (40).

## Gotchas
- A missing seed secret or a commit-hash mismatch blocks that week's draw; a new seed is never invented.
- A question is re-drafted only after 5 days without a verdict.
- Settle rows carry no `methodologyVersion`, so legacy aggregators ignore them.
- ISO-week helpers are copied in `newsPredictionsSnapshot/src/weeks.js` and `newsSensitiveData/src/lib.js`; `test/weeksParity.test.js` guards drift.

## Tests
- `cd backend/predictions/newsPredictionResolver/src && npm test` (`node --test ../test/*.test.js`, offline; also loads `predictions/settle-review.js`): 33 passed, 1 skipped (store test needs the AWS SDK installed) 2026-10-19.

Last verified: 2026-10-19
