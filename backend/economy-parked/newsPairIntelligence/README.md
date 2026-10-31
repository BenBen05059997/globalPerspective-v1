# newsPairIntelligence

Writes AI analysis of bilateral relationships (country pairs). For each pair it filters the last 30 days of topic archive entries that mention both sides and dedupes them. Pairs with fewer than 2 entries are skipped. It loads related thread analyses, both countries' intelligence and their FACTS rows, plus editorial context from `src/country_facts.json` and Brave news/web search results. One LLM call writes the pair analysis. Scheduled runs process `DEFAULT_PAIRS` (10 pairs) and skip a pair whose entry count hasn't changed. A manual `{"pair":[a,b]}` or `{"pairs":[...]}` always regenerates.

## Deployment
- Deployed name `newsPairIntelligence` · runtime `nodejs24.x` · group `economy-parked` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPairIntelligenceWeekly` `cron(0 8 ? * MON *)` (UTC, DISABLED)
- Deploy: `scripts/lambda.sh newsPairIntelligence diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE` (key `id`): reads `today-archive` and `archive#YYYY-MM-DD`.
- DynamoDB `SUMMARIZE_PREDICT_TABLE` (`PK`/`SK`): reads `THREAD#<id>`/`THREAD_ANALYSIS`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE` and `FACTS#<name>`/`COUNTRY_FACTS`. Reads and writes `PAIR#<slug>`/`PAIR_ANALYSIS` (90-day TTL).
- External: `api.search.brave.com` news and web search (`BRAVE_SEARCH_API_KEY`; skipped when unset), and the LLM endpoint below.

## Models
- `GROK_MODEL` (fallback `deepseek-flash`, "matches the live env" per the code comment), key `XAI_API_KEY`, endpoint `GROK_API_URL` (fallback `api.x.ai/v1/chat/completions`). The GROK_/XAI_ names are legacy and the provider is DeepSeek: the model fallback is a DeepSeek id, and the request sends DeepSeek's `thinking: {type: 'disabled'}`. Also reads `MAX_TOKENS` (default 4000), `TEMPERATURE` and `TOP_P`.

## Gotchas
- The schedule is DISABLED, so the function is dormant: nothing calls it.
- The `DEFAULT_PAIRS` list was chosen by archive co-occurrence as of 2026-04-18. The code says to revisit it monthly.
- Missing table env vars or a missing `XAI_API_KEY` returns 500 before any pair is processed.
- Not a Function URL; the code emits no CORS headers.

## Tests
- None.
