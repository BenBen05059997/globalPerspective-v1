# newsWeeklyBrief

Generates the weekly intelligence brief as a "signals" digest. Reads 7 days of topic archives, takes the top `WEEKLY_TOP_THREADS` (default 6) threads by entry count and the top `WEEKLY_TOP_COUNTRIES` (default 6) real countries, and asks an LLM for per-signal text only (lede, fact, so-what, related) plus a watch list. Risk level, region, sources and as-of dates are joined in from stored data, never from the model. Fails empty when there are no entries or no usable signals. Event: `weekKey` (default today), `mode: 'grounded'` (default `free`).

## Deployment
- Deployed name `newsWeeklyBrief` · runtime `nodejs20.x` · group `distribution` (scripts/functions.json)
- Trigger: `TriggerWeeklyBrief` `cron(0 6 ? * SUN *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsWeeklyBrief diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `ECON#THREAD#<id>`/`ECONOMIC_IMPACT`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE`; writes `WEEKLY_BRIEF#<weekKey>`/`WEEKLY_BRIEF` (ttl 180 days)
- Sends no email itself.
- Other env names: `MAX_TOKENS` (3500), `TEMPERATURE` (0.3)

## Models
- `GROK_MODEL` (code fallback `deepseek-v4-pro`) at `GROK_API_URL` (fallback `https://api.deepseek.com/chat/completions`), key `XAI_API_KEY`. The GROK_/XAI_ names hold DeepSeek values.

## Gotchas
- Writes `status: 'published'` directly (auto-publish). To hold a bad brief back, set its status to `draft`; the serving action only serves `published`.
- The file header and package.json still describe a draft-for-approval, manual-invoke flow; the code auto-publishes and a schedule is ENABLED.
- Country records that are regions or older than 30 days are skipped (`usableCountryRecord`).
- `dayZero.js`, `placeFilter.js`, `placeNames.json`, `iso3Names.json` are byte-identical copies guarded by `scripts/check-shared-sync.mjs`.

## Tests
- `cd amplify/backend/function/newsWeeklyBrief/src && npm test` (`node --test ../test/*.test.js`) - 7 passed 2026-10-19

Last verified: 2026-10-19
