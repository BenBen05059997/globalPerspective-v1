# newsEconomicImpact

PARKED. Per-thread economic disruption analysis: picks threads with an economic category and at least
`ECON_MIN_ENTRIES` (2) articles from 30 days of archive (cap `ECON_MAX_THREADS`, 15), asks DeepSeek for
instruments from a CLOSED allowlist (unknown tickers dropped), direction + magnitude (never %), cited
topicIds (uncited claims dropped) and a historical analog from `src/economic_analogs.json` (25 events),
snapshots real market prices, and writes the record or a `{hasImpact:false}` tombstone.
Concept: `project-docs/economy/ECONOMIC_DISRUPTION.md`.

## Deployment
- Deployed name `newsEconomicImpact` · runtime `nodejs22.x` · group `economy-parked` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerNewsEconomicImpact` `cron(30 7 * * ? *)` (UTC, DISABLED)
- Deploy: `scripts/lambda.sh newsEconomicImpact diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (`package` installs prod deps).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: `today-archive` + `archive#YYYY-MM-DD`.
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `TOPIC#<id>`/`SUMMARY`; writes `ECON#THREAD#<id>`/`ECONOMIC_IMPACT` (21-day `ttl`).
- DynamoDB `MARKETS_DDB_TABLE` (default `GlobalPerspectiveMarkets`): `pk`/`sk` `FX#`, `RATES#`, `COMMODITIES#`, `EQUITIES#`, `CRYPTO#` latest rows.

## Models
- `XAI_API_KEY` / `GROK_API_URL` (default `https://api.deepseek.com/chat/completions`) / `GROK_MODEL` (fallback `deepseek-v4-pro`): legacy names hold DeepSeek. Sends `thinking: { type: 'disabled' }`. `MAX_TOKENS` 1500, `TEMPERATURE` 0.2, `LLM_CONCURRENCY` 4.

## Gotchas
- Economy is parked: schedule DISABLED and frontend surfaces behind `ECONOMY_PARKED`. Re-enabling needs an operator decision.
- Read by `newsBreakingAlert` (`econMagnitude`) and judged by `newsEconomicQuality`. The allowlist in `src/index.js` is the main hallucination guard; keep it closed.

## Tests
- `node backend/economy-parked/newsEconomicImpact/test/validator.test.js` after `npm install` in `src/` (it loads the real `@aws-sdk` modules via a temp `src/_under_test.js`). Not run 2026-10-19: no node_modules locally.

Last verified: 2026-10-19
