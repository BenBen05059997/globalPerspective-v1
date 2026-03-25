# Backend Guide — Global Perspectives

**Last verified:** 2026-03-20

Quick-start guide to the backend system. For a complete architecture overview, see `ARCHITECTURE.md`.

---

## Lambda Functions

| Function | Path | Purpose |
|----------|------|---------|
| `newsInvokeGemini` | `amplify/backend/function/newsInvokeGemini/src/index.js` | RSS + Brave → xAI Grok → clusters topics → writes `staging` |
| `NewsProjectInvokeAgentLambda` | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` | Reads `staging` → generates SUMMARY/PREDICTION/TRACE_CAUSE → assigns threadIds → swaps to `latest` |
| `newsThreadAnalysis` | `amplify/backend/function/newsThreadAnalysis/src/index.js` | Daily batch: top 10 threads → generates storyArc, trajectory, rootCauseChain, watchQuestions |
| `newsCountryIntelligence` | `amplify/backend/function/newsCountryIntelligence/src/index.js` | Daily batch: top 10 countries → generates headline, situationSummary, trajectory, riskSignals |
| `newsSensitiveData` | `amplify/backend/function/newsSensitiveData/src/index.js` | Read-only REST proxy serving 12 actions to frontend via API Gateway |
| `newsPostLinkedIn` | `amplify/backend/function/newsPostLinkedIn/src/index.js` | Posts top topics to LinkedIn, Bluesky, X/Twitter, Threads |
| `newsPostDevTo` | `amplify/backend/function/newsPostDevTo/src/index.js` | Posts AI-written daily article to Dev.to *(deploy.zip pending upload)* |
| `newsStripeWebhook` | `amplify/backend/function/newsStripeWebhook/src/index.js` | Stripe webhook → writes/updates tier in DynamoDB Users table |

---

## System Architecture

```
EventBridge (hourly) → newsInvokeGemini → staging DDB
                     → NewsProjectInvokeAgentLambda → latest DDB + archive DDB
EventBridge (6:30 UTC) → newsThreadAnalysis → THREAD# records in Summary DDB
EventBridge (7:00 UTC) → newsCountryIntelligence → COUNTRY# records in Summary DDB
EventBridge (scheduled) → newsPostLinkedIn → social platforms
Stripe → newsStripeWebhook → Users DDB

API Gateway (frontend) → newsSensitiveData → reads all DDB tables
```

---

## DynamoDB Tables

| Table | Env var | Key | What's stored |
|-------|---------|-----|---------------|
| Topics | `TOPICS_DDB_TABLE` | `id` | `staging`, `latest`, `today-archive`, `archive#YYYY-MM-DD` |
| Summary/Prediction | `SUMMARIZE_PREDICT_TABLE` | `PK` + `SK` | `TOPIC#` / SUMMARY\|PREDICTION\|TRACE_CAUSE, `THREAD#` / THREAD_ANALYSIS, `COUNTRY#` / COUNTRY_INTELLIGENCE |
| Users | `USERS_DDB_TABLE` | `uid` | Firebase UID, email, tier, Stripe IDs |
| Social Posts | `SOCIAL_POSTS_TABLE` | composite | Dedup table for posted content |

---

## Auth System

**Firebase Authentication** (passwordless magic link). Frontend sends `Authorization: Bearer <firebase-id-token>` on gated requests. The `newsSensitiveData` Lambda verifies the token via Firebase Admin SDK, reads the user's tier from `USERS_DDB_TABLE`, and enforces access.

**Tiers:**
- `free` — public topics only, no auth required
- `member` — 7-day archive + all intelligence features
- `enterprise` — 30-day archive + all intelligence features

> **Note:** The deployed `newsSensitiveData` code in this repo still uses static API keys (`x-api-key` / `MEMBER_API_KEYS` / `ENTERPRISE_API_KEYS`). The Firebase JWT auth migration is tracked in `TIERS.md` and may be deployed separately from what's committed here.

---

## `newsSensitiveData` — All 12 Actions

| Action | Auth | Description |
|--------|------|-------------|
| `topics` | None | Latest topics from DDB |
| `summary` | None | AI summary for a topic |
| `prediction` | None | AI prediction for a topic |
| `trace_cause` | None | AI trace-cause for a topic |
| `geocode` | None | Mapbox lat/lng lookup |
| `today` | None | Today's archived entries |
| `archive_range` | JWT | N days of archive (member=7, enterprise=30) |
| `narrative_thread` | JWT | All entries for a thread across days |
| `thread_analysis` | JWT | Thread-level AI analyses (storyArc, trajectory, etc.) |
| `country_intelligence` | JWT | Country-level AI intelligence |
| `user_profile` | JWT | User tier + subscription info |
| `portal_session` | JWT | Stripe Customer Portal URL |

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

## Lambda 5: `newsStripeWebhook`

**Trigger:** Stripe webhook (separate API Gateway endpoint)

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Create/upgrade user to `member`; stamp uid on subscription metadata |
| `customer.subscription.updated` | Set tier=`member` (active) or `free` (past_due/canceled) |
| `customer.subscription.deleted` | Downgrade to `free` |

**UID resolution:** `session.client_reference_id` → `session.metadata.uid`

**Key env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `USERS_DDB_TABLE`

---

## Lambda 6: `newsPostLinkedIn`

**Trigger:** EventBridge or manual

Posts top topics to LinkedIn, Bluesky, X/Twitter, Threads. Deduplicates via `SOCIAL_POSTS_TABLE` (30-day TTL).

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `SOCIAL_POSTS_TABLE`, `MAX_POSTS_PER_RUN` (5), `MAX_POSTS_PER_DAY` (100)

---

## Lambda 7: `newsPostDevTo`

Posts a daily AI-written summary article to Dev.to using OpenRouter (DeepSeek). Deduplicates via `SOCIAL_POSTS_TABLE` (90-day TTL).

> **Note:** `amplify/backend/function/newsPostDevTo/deploy.zip` is staged — needs manual upload to AWS Lambda console.

**Key env vars:** `DEVTO_API_KEY`, `OPENROUTER_API_KEY`, `TOPICS_DDB_TABLE`, `SOCIAL_POSTS_TABLE`, `SITE_URL`

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

**Auth / 401 errors on gated endpoints:**
1. Verify Firebase JWT is valid (not expired — they expire in 1 hour)
2. Check `USERS_DDB_TABLE` has a record for the user's UID with correct tier
3. Confirm `newsStripeWebhook` ran after the Stripe checkout event

**Summaries returning 503 (cache miss):**
1. Verify `NewsProjectInvokeAgentLambda` completed its run
2. Check DynamoDB for `TOPIC#{topicId}` / `SUMMARY` item
3. TTL is 1 hour — items expire between pipeline runs

---

## Security Notes

1. **No secrets in frontend** — All keys in Lambda environment variables only
2. **CORS restricted** — `newsSensitiveData` allows only trusted origins (see `ARCHITECTURE.md`)
3. **Read-only proxy** — `newsSensitiveData` never writes data
4. **Firebase JWT** — gated actions verify token via Firebase Admin SDK, resolve tier from DDB
5. **Stripe signature** — `newsStripeWebhook` verifies webhook signature before processing
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
