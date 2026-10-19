# newsSystemsAnalysis

Daily cross-domain causal "web" per country. Reads 30 days of topic archives plus thread analyses, groups threads by country (real countries only, `src/placeFilter.js`), and asks an LLM for a node/edge graph for the top `SYSTEMS_TOP_N` (default 5) countries. Then rebuilds per-story web records and one index from all current webs (`src/webRecords.js`). Event `{ countries: [...] }` overrides the targets; `{ dryRun: true }` returns prompt sizes and coverage with no LLM call and no writes.

## Deployment
- Deployed name `newsSystemsAnalysis` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: `TriggerNewsSystemsAnalysis` `cron(0 5 * * ? *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSystemsAnalysis diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (package installs prod deps).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`; writes `SYSTEMS#<country>`/`SYSTEMS_ANALYSIS`, `WEB#INDEX`/`LATEST`, `THREAD#<id>`/`WEB`
- Other env names: `SYSTEMS_TEST_COUNTRIES` (comma list restricting targets), `MAX_TOKENS` (default 3000), `TEMPERATURE` (default 0.3)

## Models
- `GROK_MODEL` (code fallback `deepseek-v4-pro`) at `GROK_API_URL`, key `XAI_API_KEY`. The code's URL fallback is `api.x.ai`, but live `GROK_API_URL` points at `api.deepseek.com` (checked 2026-10-19). Thinking mode disabled.

## Gotchas
- `SYSTEMS#` rows carry a 14-day `ttl`, but the table's TTL is disabled, so old webs never expire; readers judge freshness from `generatedAt`.
- A web-index failure is logged and does not undo the country webs already written.
- Cites are kept only if the model was shown that entry (short `E12` codes mapped back to topicIds).
- `dayZero.js`, `placeFilter.js`, `placeNames.json`, `iso3Names.json` are byte-identical copies guarded by `scripts/check-shared-sync.mjs`.

## Tests
- `cd backend/pipeline/newsSystemsAnalysis/src && npm test` (`node --test ../test/*.test.js`) - 22 passed 2026-10-19

Last verified: 2026-10-19
