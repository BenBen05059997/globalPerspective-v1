# newsSituationIngest

The hourly news producer for the situation map. Fetches 25 world RSS feeds (36h max age), classifies new headlines in batches on a flash LLM (iso3, latlon, axis, category, severity, entities, English title), clusters them deterministically into stories (`src/classifier-core.js`), and keeps only stories with >=2 outlets or severity >=3 (max 80). newsSituationTracker reads the result.

## Deployment
- Deployed name `newsSituationIngest` · runtime `nodejs22.x` · group `situations` (scripts/functions.json)
- Trigger: `TriggerSituationIngest` `rate(1 hour)` ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSituationIngest diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET`: writes `corpus/YYYY/MM/DD/HH.jsonl`, `stories/state/<id>.json`, `stories/index.json`; reads/writes `stories/classify-cache.json` (articles classified earlier are reused, kept `CACHE_KEEP_HOURS`, default 48)
- External: the RSS hosts in `RSS_FEEDS`; GDELT DOC API only when `GDELT_ENABLED=true` (off by default)
- CloudWatch metrics namespace `GlobalPerspective/Situations`: `IngestArticles`, `IngestStories`, `ClassifierLLMCallsToday`, `IngestCacheHits`
- Tuning env names: `CLASSIFY_BATCH`, `MAX_BATCHES_PER_RUN`, `CLASSIFY_CONCURRENCY`, `MAX_AGE_HOURS`, `GDELT_PER_QUERY`

## Models
- `GROK_MODEL` (code fallback `deepseek-flash`) through the shared client `src/_shared/llm.js` (`backend/shared/src`): `GROK_API_URL` (fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names point at DeepSeek, not xAI. Thinking mode is disabled in the request.

## Gotchas
- Returns `{ ok: false }` without fetching anything when `XAI_API_KEY` is unset.
- GDELT is off because Lambda egress IPs get throttled or refused by GDELT (code comment, 2026-09-09).
- `classifier-core.js` entity normalization is checked against NewsProjectInvokeAgentLambda's `entity-normalize.js` by `scripts/check-shared-sync.mjs`.

## Source field contract

Corpus rows retain RSS `publishedAt` in ISO UTC (null if unavailable) and a deterministic `outlet` display name from the selector’s single metadata table (linked pending its coordinator-owned shared move). Unknown domains keep null. Shared `resolveIso3` canonicalizes new and cached countries, dropping and counting unknown codes.

If more than half of attempted new classifications are missing, the run returns `ok:false`, `status:failed`, `degraded:true` with counts and emits `[pipeline-status]`. Cache hits do not hide an outage. No feeds or no API key also produces a failure marker. `stories/index.json` retains its last good stories and `updated_at`, adding the degraded marker and `attempted_at`; partial results do not replace story state or corpus. A successful run clears the marker, including a legitimately empty significant-story set. The tracker must be updated alongside this change.

## Tests
- `node --test src/outage.test.js` (offline; fake classifier and store).
- `cd backend/situations/newsSituationIngest/src && node classifier-core.test.mjs` - 10 passed 2026-10-19

Last verified: 2026-10-19
