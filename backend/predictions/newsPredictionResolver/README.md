# newsPredictionResolver

Daily prediction settle Lambda (drafts on Mondays, settles daily) (methodology v1). `tick` (default action, idempotent) commits seed hashes for the next two weeks, draws a seeded sample (K=22, rule `v1`) from every ended week's question-schema predictions, runs the agent draft pass on Mondays, settles every due question whose draft is waiting, and writes a heartbeat. Other actions: `draw {weekId}`, `draft {limit}` (draft then settle), `status` (read-only counts), `replay {items}` (drafter only, no writes), `correct {qid, verdict, reason, evidence?}` (operator dispute). `dryRun: true` = no LLM, no writes. Nothing waits for a human (decision 0034): a `yes`/`no`/`void` draft is written as the `Q#<qid>`/`VERDICT` row at once (`decidedBy`/`confirmedBy: 'resolver'`, `draftSk`, `evidence {url, quote}`, `voidReason` for void). An unclear draft (`not_yet`, `needs_human`) is not written; it is re-drafted after 5 days (`REDRAFT_AFTER_DAYS`) and the third unclear draft (`MAX_UNCLEAR_DRAFTS`) writes `void` with reason `unclear after 3 drafts`. A wrong verdict is corrected with `correct` (appends `VERDICT#<n>`, `confirmedBy: 'operator'`, `reason`; CLI `predictions/settle-correct.js --correct <qid> <yes|no|void> "<reason>"`); the snapshot reads the highest n. The drafter never sees a question's probability (`draft.js`).

## Deployment
- Deployed name `newsPredictionResolver` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionResolver` `cron(30 10 * * ? *)` (UTC, ENABLED), input `{"action":"tick"}`
- Deploy: `scripts/lambda.sh newsPredictionResolver diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): reads `PRED#` rows with `questionSchema`; writes `SEED#<week>`/`COMMIT|SECRET|REVEAL`, `SAMPLE#<week>`/`DRAW`, `Q#<qid>`/`SAMPLED|DRAFT#<iso>|VERDICT|VERDICT#<n>`, `SETTLE#<week>`/`TICK#<iso>`; reads the `Q#` rows. All writes are conditional put-once (immutable).
- External APIs: Brave Search news + web (`BRAVE_SEARCH_API_KEY`, serialized, ~1.1s gap, 429 retry); LLM chat completions through the shared client `src/_shared/llm.js` at `GROK_API_URL` (fallback `https://api.deepseek.com`)

## Models
- `DRAFT_MODEL` (default `deepseek-v4-pro`) with key `XAI_API_KEY` and URL `GROK_API_URL`; the GROK_*/XAI_* names hold the DeepSeek config. JSON mode, thinking disabled. Concurrency `LLM_CONCURRENCY` (3), cap `MAX_RESOLVE_PER_RUN` (40).

## Gotchas
- A missing seed secret or a commit-hash mismatch blocks that week's draw; a new seed is never invented.
- An unclear question is re-drafted only after 5 days; three unclear drafts make it void. The first correction of a settled question is `VERDICT#2` (the original `VERDICT` counts as 1).
- Settle rows carry no `methodologyVersion`, so legacy aggregators ignore them.
- ISO-week helpers are copied in `newsPredictionsSnapshot/src/weeks.js` and `newsSensitiveData/src/lib.js`; `test/weeksParity.test.js` guards drift.

## Source field contract

New `Q#/SAMPLED` rows copy `threadId` from their PRED row (null for older rows without it). `clusterKey` and sampling identity are unchanged; the sampled question still carries no probability.

## Tests
- `cd backend/predictions/newsPredictionResolver/src && npm test` (`node --test ../test/*.test.js`, offline; also loads `predictions/settle-correct.js`): 44 passed with the existing local AWS SDK on NODE_PATH (without it, one store-interface test skips) 2026-10-20.

Last verified: 2026-10-22 (deployed 2026-10-20 15:24Z per `get-function-configuration`; the table holds zero `VERDICT` rows so far; tests last run 2026-10-20)
