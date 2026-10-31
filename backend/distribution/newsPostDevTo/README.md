# newsPostDevTo

Despite the name, this no longer posts to Dev.to (publish path removed 2026-05-18). It builds the daily brief: loads today's entries from the `today-archive` item, enriches them with up to 20 thread analyses and up to 15 country intelligence records (real countries, last 30 days), asks an LLM for a JSON brief (headline, summary, topStories, ...), resolves real thread ids deterministically, and stores `DAILY_BRIEF#<date>` for the `/briefings` page (`/daily` redirects there).

## Deployment
- Deployed name `newsPostDevTo` · runtime `nodejs24.x` · group `distribution` (scripts/functions.json)
- Trigger: Scheduler `InvokeDev` `cron(0 23 * * ? *)` (Asia/Tokyo, ENABLED)
- Deploy: `scripts/lambda.sh newsPostDevTo diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `id = today-archive` (only entries archived today)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE`; writes `DAILY_BRIEF#<date>`/`DAILY_BRIEF` (90-day `ttl`)
- S3 world bucket, only when env `NOTES_PREFIX` is set (unset = nothing): the brief as a `daily_brief` note under `<NOTES_PREFIX>notes/daily_brief/` (decision 0048; best-effort, never fails the run; the DynamoDB put stays). Needs `s3:GetObject`/`PutObject` on `record/notes/daily_brief/*` and its manifest. Live env has no `NOTES_PREFIX` (read 2026-10-31), so no note is written yet; the notes already in the record came from `backend/record/cli/backfill-brief-notes.mjs`.
- External APIs: DeepSeek chat completions via `src/_shared/llm.js` (`GROK_API_URL`, fallback `https://api.deepseek.com`)
- env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). `record` reads the day's entries (`today-archive`), the thread analyses (`THREAD_ANALYSIS`) and the country briefings (`COUNTRY_INTELLIGENCE`) from the record's views (`index/today.json`, `stories/<id>.json`, `countries/<ISO3>.json`) while `manifest.builtAt` is under 9 h old, and reads DynamoDB for any view that cannot answer; `compare` reads both, uses DynamoDB and logs `[record-reads]` equal or DIFFER. Needs `s3:GetObject` on `record/views/*` (role `newsPostDevTo-role-uek0owwd`). The brief row is still put to `SUMMARIZE_PREDICT_TABLE`.

## Models
- `GROK_MODEL` (fallback `deepseek-v4-pro`) with key `XAI_API_KEY`, through the shared client `src/_shared/llm.js` (thinking disabled). The GROK_*/XAI_* names hold DeepSeek values.

## Gotchas
- Brief is skipped (logged, not an error) when `SUMMARIZE_PREDICT_TABLE` or `XAI_API_KEY` is unset.
- Dead code left in `index.js`: Dev.to posting (`postToDevTo`, `DEVTO_API_KEY`), `SOCIAL_POSTS_TABLE` dedup helpers, and an OpenRouter `callAi` (`AI_MODEL`); none are called by the handler.
- `topStories[]` carry `threadId` (matched to an archive entry, never from the model; ambiguous or unmatched = `null`) and `iso3[]` (their regions through `resolveIso3`); `countryToWatch` carries `iso3[]` and the `threadId` of today's thread with most entries in that country.
- Thinking mode is disabled on purpose (2026-07-26 outage: thinking burned `max_tokens`).

## Tests
- `cd backend/distribution/newsPostDevTo/src && npm test` (`node --test ../test/*.test.js`, offline). `dayZero`, `placeFilter` and `llm` (from `backend/shared/src` via the `src/_shared` symlink) are tested in `backend/shared/test`.
