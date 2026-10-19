# newsThreadAnalysis

Daily thread-level AI analysis. Reads 30 days of topic archives, groups entries into narrative threads (2+ entries), and re-analyses up to `MAX_THREADS` (default 10) threads, but only those with a new event the stored analysis has not seen (`src/threadPolicy.js`). Each analysis carries a multi-axis risk vector reduced to a legacy score by `src/riskDimensions.js`. Event `{ dryRun: true }` returns the selection plan with no LLM, search or writes.

## Deployment
- Deployed name `newsThreadAnalysis` · runtime `nodejs24.x` · group `pipeline` (scripts/functions.json)
- Trigger: `TriggerDailyAnalysis` `cron(40 4 * * ? *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsThreadAnalysis diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules (a `package-lock.json` is in src but is not used).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads/writes `THREAD#<id>`/`THREAD_ANALYSIS` (ttl 90 days); writes `THREAD#<id>`/`THREAD_HISTORY#<date>` (ttl 60 days)
- External: Brave Search news + web (`api.search.brave.com`) only when `BRAVE_SEARCH_API_KEY` is set; it is not in the live env (checked 2026-10-19), so no web refs are fetched
- Other env names: `MAX_TOKENS` (3500), `TEMPERATURE` (0.2), `TOP_P` (0.9), `INTER_CALL_DELAY_MS`

## Models
- `GROK_MODEL` (code fallback `deepseek-flash`) at `GROK_API_URL`, key `XAI_API_KEY`. Code URL fallback is `api.x.ai`; live `GROK_API_URL` points at `api.deepseek.com` (checked 2026-10-19).

## Gotchas
- `ttl` attributes are set, but the SummarizeAndPredict table's TTL is disabled, so rows do not expire.
- `riskDimensions.js` must stay byte-identical with newsCountryIntelligence's; `dayZero.js` with five other Lambdas. `scripts/check-shared-sync.mjs` checks both.
- Threads ageing out of the 30-day window never trigger a re-analysis.

## Tests
- `cd amplify/backend/function/newsThreadAnalysis/src && npm test` (`node --test ../test/*.test.js`) - 13 passed 2026-10-19

Last verified: 2026-10-19
