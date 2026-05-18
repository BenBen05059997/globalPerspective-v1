# Backend Guide — Global Perspectives

**Last verified:** 2026-05-18

Quick-start guide to the backend system. For a complete architecture overview, see `ARCHITECTURE.md`.

---

## Lambda Functions

| Function | Path | Purpose |
|----------|------|---------|
| `newsInvokeGemini-dev` | `amplify/backend/function/newsInvokeGemini/src/index.js` | RSS (26 feeds) + Brave (parallel, `BRAVE_CONCURRENCY=3`) → **DeepSeek V4** clusters topics → writes `staging`. Every 4h. ~63s/run. |
| `NewsProjectInvokeAgentLambda-dev` | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` | Reads `staging` → **DeepSeek V4** generates SUMMARY/PREDICTION/TRACE_CAUSE (parallel, `LLM_CONCURRENCY=4`) → assigns threadIds → swaps to `latest`. Every 4h at :05. ~130s/run. 512MB / 600s. |
| `newsThreadAnalysis` | `amplify/backend/function/newsThreadAnalysis/src/index.js` | Daily 06:30 UTC: top 10 threads → **Gemini 2.5 Flash** (free, 13s pacing) generates storyArc, trajectory, rootCauseChain, watchQuestions, riskScore, sentiment, keyActors |
| `newsCountryIntelligence` | `amplify/backend/function/newsCountryIntelligence/src/index.js` | Daily 07:00 UTC: top 20 countries (parallel, `LLM_CONCURRENCY=4`) → **DeepSeek V4** generates headline, bluf, trajectory, riskSignals, keyActors. ~60s/run. |
| `newsSystemsAnalysis` | `amplify/backend/function/newsSystemsAnalysis/src/index.js` | Daily 07:15 UTC: causal graph (nodes + edges) for top countries → **DeepSeek V4**. Currently restricted to Argentina + Iran (`SYSTEMS_TEST_COUNTRIES`) |
| `newsPostDevTo` | `amplify/backend/function/newsPostDevTo/src/index.js` | Daily 23:00 UTC: generates Daily Intelligence Brief via **DeepSeek V4** → stores `DAILY_BRIEF#YYYY-MM-DD`. AI overview via OpenRouter `deepseek-v4-flash:free` (`AI_MODEL` env var). Also posts to Dev.to (⚠️ DEVTO_API_KEY still 401 — Dev.to publish broken; in-app `/daily` works). 256MB / 120s. |
| `newsPairIntelligence` | `amplify/backend/function/newsPairIntelligence/src/index.js` | Manual invoke only: bilateral country-pair relationship analysis → writes PAIR# to Summary DDB |
| `newsCountryFactsUpdater` | `amplify/backend/function/newsCountryFactsUpdater/src/index.js` | Daily 05:00 UTC: Wikidata SPARQL → writes FACTS# to Summary DDB (90-day TTL). No LLM. |
| `newsSensitiveData` | `amplify/backend/function/newsSensitiveData/src/index.js` | Read-only REST proxy serving 18 actions to frontend via API Gateway |
| `newsSavedItems` | `amplify/backend/function/newsSavedItems/src/index.js` | Save/bookmark Lambda (separate Function URL, Firebase JWT required) |
| `newsPostLinkedin` | `amplify/backend/function/newsPostLinkedin/src/index.js` | Every 3h: posts to LinkedIn, Bluesky, Farcaster, Mastodon, Telegram. No LLM. Nostr removed 2026-05-16. |
| `linkedInAutoPost` | `amplify/backend/function/linkedInAutoPost/src/index.js` | 07:30 + 19:30 UTC: scores threads/country intel, posts best to LinkedIn. ⚠️ LinkedIn token expired. |
| `newsStripeWebhook` | `amplify/backend/function/newsStripeWebhook/src/index.js` | **Paddle** webhook → writes/updates tier in DynamoDB Users table (name is legacy) |

---

## System Architecture

```
EventBridge (every 4h, :00)  → newsInvokeGemini-dev → staging DDB [DeepSeek V4]
EventBridge (every 4h, :05)  → NewsProjectInvokeAgentLambda-dev → latest DDB + archive [DeepSeek V4]
EventBridge (05:00 UTC daily)→ newsCountryFactsUpdater → FACTS# in Summary DDB [no LLM]
EventBridge (06:30 UTC daily)→ newsThreadAnalysis → THREAD# in Summary DDB [Gemini 2.5 Flash free]
EventBridge (07:00 UTC daily)→ newsCountryIntelligence → COUNTRY# in Summary DDB [DeepSeek V4]
EventBridge (07:15 UTC daily)→ newsSystemsAnalysis → SYSTEMS# in Summary DDB [DeepSeek V4]
EventBridge (every 3h, :20)  → newsPostLinkedin → LinkedIn/Bluesky/Farcaster/Mastodon/Telegram [no LLM]
EventBridge (07:30+19:30 UTC)→ linkedInAutoPost → LinkedIn scored post [no LLM]
EventBridge (23:00 UTC daily)→ newsPostDevTo → Daily Brief + Dev.to [DeepSeek V4]
Manual only                  → newsPairIntelligence → PAIR# in Summary DDB
Paddle webhook               → newsStripeWebhook → Users DDB

API Gateway (frontend) → newsSensitiveData → reads all DDB tables
Function URL           → newsSavedItems → SAVED_ITEMS_TABLE (JWT required)
```

---

## DynamoDB Tables

| Table | Env var | Key | What's stored |
|-------|---------|-----|---------------|
| Topics | `TOPICS_DDB_TABLE` | `id` | `staging`, `latest`, `today-archive`, `archive#YYYY-MM-DD` |
| Summary/Prediction | `SUMMARIZE_PREDICT_TABLE` | `PK` + `SK` | `TOPIC#` / SUMMARY\|PREDICTION\|TRACE_CAUSE, `THREAD#` / THREAD_ANALYSIS, `COUNTRY#` / COUNTRY_INTELLIGENCE, `PAIR#` / PAIR_ANALYSIS, `DAILY_BRIEF#YYYY-MM-DD` / DAILY_BRIEF, `FACTS#` / COUNTRY_FACTS |
| Users | `USERS_DDB_TABLE` | `uid` | Firebase UID, email, tier, Paddle IDs |
| Social Posts | `SOCIAL_POSTS_TABLE` | composite | Dedup table for all platform posts (30-day TTL; 90-day for Dev.to) |
| Saved Items | `SAVED_ITEMS_TABLE` | `uid` + `savedKey` | User bookmarks (thread, country, daily, pair — max 500/user) — used by `newsSavedItems` Lambda |

---

## Auth System

**Firebase Authentication** (passwordless magic link + Google Sign-In). Frontend sends `Authorization: Bearer <firebase-id-token>` on auth-required requests.

**`newsSensitiveData` verifies JWT** via lightweight Node `crypto` + Google public cert endpoint (no firebase-admin dependency). JWT is only required for `user_profile` and `portal_session`.

**🚀 Early access mode (ACTIVE 2026-04-11):** All content actions are fully public — no JWT required. Tiers exist in schema but are not enforced. Sign-in is only used for the save/bookmark feature (personalization).

**When billing goes live:** `archive_range`, `thread_analysis`, `country_intelligence`, `narrative_thread`, `daily_brief` (past dates) will be re-gated. See `TIERS.md` for the intended tier structure.

---

## `newsSensitiveData` — All 16 Actions

> **Early access note:** Actions marked "JWT" below were previously gated. All content actions are now **public** (no auth needed) during early access. Only `user_profile` and `portal_session` require a Firebase JWT.

| Action | Auth | Description |
|--------|------|-------------|
| `topics` | None | Latest topics from DDB |
| `summary` | None | AI summary for a topic |
| `prediction` | None | AI prediction for a topic |
| `trace_cause` | None | AI trace-cause for a topic |
| `geocode` | None | Mapbox lat/lng lookup |
| `today` | None | Today's archived entries |
| `rss` | None | Public RSS 2.0 XML feed (GET `?action=rss`) |
| `country_preview` | None | Public SEO preview for a country page |
| `thread_preview` | None | Public SEO preview for a thread page |
| `daily_brief` | None | Daily Intelligence Brief (all dates public; GET `?action=daily_brief&dateKey=YYYY-MM-DD`) |
| `archive_range` | None* | N days of archive — returns full 90 days to everyone |
| `narrative_thread` | None* | All entries for a thread across days |
| `thread_analysis` | None* | Thread-level AI analyses (storyArc, trajectory, etc.) |
| `country_intelligence` | None* | Country-level AI intelligence |
| `pair_analysis` | None* | Bilateral relationship analysis for a country pair (slug via `payload.pair`) |
| `pair_analyses_list` | None* | All pair analyses, DDB Scan, sorted list |
| `user_profile` | JWT | User tier + subscription info |
| `portal_session` | JWT | Paddle Customer Portal URL |

*Will be re-gated when paid tiers go live.

**`newsSavedItems` Lambda — separate endpoint** (`window.SAVED_ITEMS_ENDPOINT`):

| Action | Auth | Description |
|--------|------|-------------|
| `save_item` | JWT | Save a thread, country, or daily brief |
| `unsave_item` | JWT | Remove a saved item |
| `get_saved_items` | JWT | List all saved items for the user |

**Request format:**
```json
POST <SENSITIVE_PROXY_ENDPOINT>
{ "action": "topics", "payload": {} }
```

**Auth header (gated actions):**
```
Authorization: Bearer <firebase-id-token>
```

---

## Lambda 1: `newsInvokeGemini`

**Trigger:** EventBridge hourly

**Flow:**
1. Fetch articles from 8 RSS feeds + 11 Brave Search site queries
2. Filter articles > 48h old; deduplicate by URL
3. Check `seen-today` DDB (24h soft dedup)
4. Send to xAI Grok to cluster into ~13 topics
5. Validate all returned URLs against fetched articles (hallucination filter)
6. Read past 7 days of archive → inject `continues_topic` (narrative continuity)
7. Write to DynamoDB as `id=staging`

**Key env vars:**

| Variable | Notes |
|----------|-------|
| `XAI_API_KEY` | Required |
| `BRAVE_SEARCH_API_KEY` | Optional; RSS-only fallback |
| `TOPICS_DDB_TABLE` | Required |
| `GROK_MODEL` | Default: `grok-4-1-fast-non-reasoning` |
| `TOPICS_LIMIT` | Default: `13` |

---

## Lambda 2: `NewsProjectInvokeAgentLambda`

**Trigger:** EventBridge (after newsInvokeGemini) or manual

**Payload options:**
```json
{ "action": "both" }       // "summary", "prediction", "trace_cause", or "both"
{ "topicId": "id" }        // One topic only
{ "readOnly": true }       // Read without generating
```

**Flow:**
1. Read `staging` topics
2. For each topic, call xAI Grok → SUMMARY + PREDICTION + TRACE_CAUSE
3. Assign `threadId` (continues_topic → Jaccard similarity → new)
4. Write to Summary/Prediction table (TTL 1h)
5. Swap `staging → latest`
6. Write `today-archive` + `archive#YYYY-MM-DD` entries
7. Prune stale cache entries

**Key env vars:** `XAI_API_KEY`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `GROK_MODEL`, `MAX_TOKENS` (600), `TEMPERATURE` (0.2)

---

## Lambda 3: `newsThreadAnalysis`

**Trigger:** EventBridge `cron(30 6 * * ? *)` — 6:30 UTC daily

**Flow:**
1. Read 30 days of archive entries
2. Group by `threadId`; filter to threads with 2+ entries
3. Select top 10 by entry count
4. For each thread: Brave News + Web search → xAI Grok
5. Generate: `threadTitle`, `entryShortTitles`, `storyArc`, `trajectory`, `rootCauseChain`, `watchQuestions`
6. Skip threads where `entryCount` hasn't changed since last run
7. Write to `SUMMARIZE_PREDICT_TABLE` at `THREAD#{threadId}` / `THREAD_ANALYSIS` (31-day TTL)

**Key env vars:** `XAI_API_KEY`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `GROK_MODEL`, `BRAVE_SEARCH_API_KEY`

---

## Lambda 4: `newsCountryIntelligence`

**Trigger:** EventBridge `cron(0 7 * * ? *)` — 7:00 UTC daily (after newsThreadAnalysis)

**Flow:**
1. Read 30 days of archive entries
2. Group by country (from `regions` field); filter to 2+ articles
3. Load thread analyses for cross-enrichment
4. Select top 10 countries by article count
5. For each country: Brave News search → xAI Grok
6. Generate: `headline`, `situationSummary`, `crossThreadInsight`, `trajectory`, `riskSignals`, `riskLevel`
7. Skip countries where `totalArticles` hasn't changed
8. Write to `SUMMARIZE_PREDICT_TABLE` at `COUNTRY#{countryName}` / `COUNTRY_INTELLIGENCE` (31-day TTL)

**Key env vars:** `XAI_API_KEY`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `GROK_MODEL`, `BRAVE_SEARCH_API_KEY`

---

## Lambda 5: `newsStripeWebhook` (name is legacy — now handles Paddle)

**Trigger:** Paddle webhook (separate API Gateway endpoint)

| Paddle Event | Action |
|---|---|
| `subscription.created` | Create/upgrade user to `member`; store `paddleCustomerId` + `paddleSubscriptionId` |
| `subscription.updated` | Update tier on plan change |
| `subscription.canceled` | Downgrade to `free` |

**UID resolution:** `data.custom_data.uid` (passed via Paddle checkout URL params)
**Signature verification:** HMAC-SHA256 of `${ts}:${rawBody}` using `PADDLE_WEBHOOK_SECRET`

**Key env vars:** `PADDLE_WEBHOOK_SECRET`, `USERS_DDB_TABLE`

---

## Lambda 6: `newsPostLinkedIn`

**Trigger:** EventBridge or manual

Posts top topics to LinkedIn, Bluesky, X/Twitter, Threads. Deduplicates via `SOCIAL_POSTS_TABLE` (30-day TTL).

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `SOCIAL_POSTS_TABLE`, `MAX_POSTS_PER_RUN` (5), `MAX_POSTS_PER_DAY` (100)

---

## Lambda 7: `newsPostDevTo`

Posts a daily AI-written summary article to Dev.to using **xAI Grok** (not DeepSeek/OpenRouter). Also generates the **Daily Intelligence Brief** (stored as `DAILY_BRIEF#YYYY-MM-DD` in `SUMMARIZE_PREDICT_TABLE`, TTL 90 days). Brief generation is wrapped in try/catch — never blocks Dev.to publish. Deduplicates via `SOCIAL_POSTS_TABLE` (90-day TTL).

**Key env vars:** `DEVTO_API_KEY`, `XAI_API_KEY`, `GROK_MODEL`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `SOCIAL_POSTS_TABLE`, `SITE_URL`

## Lambda 8: `newsSavedItems`

**Trigger:** AWS Lambda Function URL (direct HTTP, not via API Gateway). CORS configured at AWS Function URL level — Lambda code does NOT emit CORS headers.

Handles user save/bookmark actions. Requires Firebase JWT. Uses dedicated `GlobalPerspectiveSavedItems` DynamoDB table (PK=`uid`, SK=`savedKey` as `{itemType}#{itemId}`).

**Key env vars:** `SAVED_ITEMS_TABLE`, `FIREBASE_PROJECT_ID`, `AWS_REGION`

---

## Testing Lambdas

```bash
# Test newsInvokeGemini
aws lambda invoke \
  --function-name newsInvokeGemini \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Test NewsProjectInvokeAgentLambda
aws lambda invoke \
  --function-name NewsProjectInvokeAgentLambda \
  --payload '{"action":"both"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Test newsThreadAnalysis
aws lambda invoke \
  --function-name newsThreadAnalysis \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Test newsSensitiveData (public action)
curl -X POST https://<api-gateway-url>/proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"topics","payload":{}}'

# Test newsSensitiveData (gated action)
curl -X POST https://<api-gateway-url>/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -d '{"action":"archive_range","payload":{"days":7}}'
```

---

## Troubleshooting

**Topics not loading:**
1. Check `newsSensitiveData` CloudWatch logs
2. Verify DynamoDB has `latest` item with `updatedAt` < 2.5 hours ago
3. Verify CORS origins match your domain
4. Check API Gateway endpoint in `docs/config.js`

**Thread/country intelligence missing:**
1. Verify `newsThreadAnalysis` / `newsCountryIntelligence` ran today (check CloudWatch)
2. Confirm EventBridge rules exist: `TriggerDailyAnalysis` (6:30 UTC) + `TriggerCountryIntelligence` (7:00 UTC)
3. Check `SUMMARIZE_PREDICT_TABLE` for `THREAD#` / `COUNTRY#` items

**Auth / 401 errors on `user_profile` or `portal_session`:**
1. Verify Firebase JWT is valid (not expired — they expire in 1 hour)
2. Check `USERS_DDB_TABLE` has a record for the user's UID
3. Note: all other actions are fully public and do not require auth during early access

**Summaries returning 503 (cache miss):**
1. Verify `NewsProjectInvokeAgentLambda` completed its run
2. Check DynamoDB for `TOPIC#{topicId}` / `SUMMARY` item
3. TTL is 1 hour — items expire between pipeline runs

---

## Security Notes

1. **No secrets in frontend** — All keys in Lambda environment variables only
2. **CORS restricted** — `newsSensitiveData` allows only trusted origins (see `ARCHITECTURE.md`)
3. **Read-only proxy** — `newsSensitiveData` never writes data
4. **Firebase JWT** — `user_profile` and `portal_session` verify token via lightweight Node crypto + Google cert endpoint (no firebase-admin). All content actions are currently public.
5. **Paddle signature** — `newsStripeWebhook` verifies Paddle webhook signature (HMAC-SHA256) before processing
6. **TTL cleanup** — DynamoDB TTL automatically expires old cache items

---

## Cost Drivers

| Service | Cost driver | Mitigation |
|---------|------------|------------|
| xAI Grok | Tokens per call | `grok-4-1-fast-non-reasoning`, 600 max tokens for topic AI, 3000 for thread/country |
| Brave Search | API calls | Site-specific queries; 48h article age filter |
| DynamoDB | Read/write units | TTL-based cleanup; 31-day max retention |
| Lambda | Invocations + duration | Scheduled (not on-demand); daily batch Lambdas run once/day |
| Firebase | Auth | Free tier covers current scale |
| Stripe | Transactions | Per-subscription fee |
