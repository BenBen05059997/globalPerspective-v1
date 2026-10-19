# newsInvokeGemini

The topic selector at the head of the content pipeline. Despite the name, it does not call Gemini. It fetches 26 hard-coded RSS feeds (BBC, Al Jazeera, Guardian, AllAfrica, CNA and others) and sends them to one LLM call that picks up to `TOPICS_LIMIT` topics (default 15, max 20). The prompt includes 24h soft dedup and narrative continuity (today plus 7 days). It drops source URLs that were not among the fetched articles, enriches sources (`src/source_enrichment.js`, `src/outlet_metadata.js`), and writes the topics cache item with `status: 'pending'`. It also writes a saw-vs-chose capture to S3 for newsImpactAudit.

## Deployment
- Deployed name `newsInvokeGemini-dev` (repo dir `newsInvokeGemini`) · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `InvokeGoogleGemini` `cron(15 4/8 * * ? *)` (UTC, ENABLED). No Function URL (checked 2026-10-19).
- Deploy: `scripts/lambda.sh newsInvokeGemini diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships no node_modules: `src/package.json` has no production deps (the runtime provides `@aws-sdk` v3).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE` (key `id`): reads `seen-today` and `archive#YYYY-MM-DD` (today and the previous 7 days); writes the cache item `id = TOPICS_CACHE_ITEM_ID` (default `staging`) and `seen-today`.
- S3 `WORLD_BUCKET`: writes `audit/ingest-capture/latest.json` plus `audit/ingest-capture/YYYY-MM-DD/HHMM.json` (`INGEST_CAPTURE_PREFIX`). Fenced: a failure never breaks ingestion.
- External: the RSS feed hosts listed in `src/index.js`, and the LLM endpoint below.
- Env: `SOURCE_ENRICH_ENABLED`, `SOURCE_ENRICH_THRESHOLD`, `SOURCE_ENRICH_MAX`, `SOURCE_ENRICH_CROSS_TOPIC`, `TOPICS_LIMIT`.

## Models
- `GROK_MODEL` (fallback `deepseek-v4-pro`, "matches the live env" per the code comment) through the shared client `src/_shared/llm.js` (`backend/shared/src`, plain fetch, no SDK): `GROK_API_URL` (base or full `/chat/completions` URL, fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names are legacy and hold DeepSeek values; thinking is disabled.

## Gotchas
- The names "Gemini" and "Grok" in the code and logs are historical.
- It emits `Access-Control-Allow-Origin: *` on its HTTP-shaped responses. If a Function URL is ever added, its CORS config must stay empty.
- `INGEST_CAPTURE_TABLE` and `CAPTURE_TTL_DAYS` are still read but unused; capture moved to S3 in S8·T2b.
- `max_tokens` is 12000; truncated JSON output goes through `salvageTruncatedTopics`.

## Tests
- `cd backend/pipeline/newsInvokeGemini/src && node test_enrichment.js` (offline). Passed 23/23 on 2026-10-19.

Last verified: 2026-10-19
