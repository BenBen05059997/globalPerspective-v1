# newsPostDevTo

Despite the name, this no longer posts to Dev.to (publish path removed 2026-05-18). It builds the daily brief: loads today's entries from the `today-archive` item, enriches them with up to 20 thread analyses and up to 15 country intelligence records (real countries, last 30 days), asks an LLM for a JSON brief (headline, summary, topStories, ...), resolves real thread ids deterministically, and stores `DAILY_BRIEF#<date>` for the `/daily` page.

## Deployment
- Deployed name `newsPostDevTo` · runtime `nodejs24.x` · group `distribution` (scripts/functions.json)
- Trigger: Scheduler `InvokeDev` `cron(0 23 * * ? *)` (Asia/Tokyo, ENABLED)
- Deploy: `scripts/lambda.sh newsPostDevTo diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `id = today-archive` (only entries archived today)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE`; writes `DAILY_BRIEF#<date>`/`DAILY_BRIEF` (90-day `ttl`)
- External APIs: `GROK_API_URL` (default `api.x.ai`) chat completions

## Models
- `GROK_MODEL` (fallback `deepseek-v4-pro`) with key `XAI_API_KEY` and URL `GROK_API_URL`. The request sends DeepSeek's `thinking: disabled`, so these GROK_*/XAI_* names hold a DeepSeek config; check live env for the host.

## Gotchas
- Brief is skipped (logged, not an error) when `SUMMARIZE_PREDICT_TABLE` or `XAI_API_KEY` is unset.
- Dead code left in `index.js`: Dev.to posting (`postToDevTo`, `DEVTO_API_KEY`), `SOCIAL_POSTS_TABLE` dedup helpers, and an OpenRouter `callAi` (`AI_MODEL`); none are called by the handler.
- `topStories[].threadId` comes from the archive entry, never from the model; unmatched rising thread gets `null`.
- Thinking mode is disabled on purpose (2026-07-26 outage: thinking burned `max_tokens`).

## Tests
- `cd amplify/backend/function/newsPostDevTo/src && npm test` (`node --test ../test/*.test.js`, offline): 15/15 passed 2026-10-19.

Last verified: 2026-10-19
