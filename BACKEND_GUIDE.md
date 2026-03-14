# Backend Architecture Guide

This guide provides a comprehensive overview of the Global Perspectives backend system. Start here if you're new to the project.

## Quick Start: Files to Read

### Essential Reading (in order)

1. **This file** (`BACKEND_GUIDE.md`) - Architecture overview
2. **`FRONTEND_ARCHITECTURE.md`** (`global-perspectives-starter/frontend/`) - How frontend consumes the backend
3. **Lambda source code** (see paths below) - Actual implementation

### Lambda Function Source Code

| Function | Path | Purpose |
|----------|------|---------|
| `newsInvokeGemini` | `amplify/backend/function/newsInvokeGemini/src/index.js` | Fetches news, generates topics |
| `NewsProjectInvokeAgentLambda` | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` | Generates AI summaries/predictions |
| `newsSensitiveData` | `amplify/backend/function/newsSensitiveData/src/index.js` | REST proxy for frontend |
| `newsPostLinkedIn` | `amplify/backend/function/newsPostLinkedIn/src/index.js` | Posts top topics to social media |

### Supporting Documentation

| File | Description |
|------|-------------|
| `DEPLOYMENT_NOTES.md` | GitHub Pages deployment checklist |
| `HYBRID_NEWS_ARCHITECTURE.md` | Original architecture design document |
| `LAMBDA_APPSYNC_PROXY_OVERVIEW.md` | AppSync integration (partially outdated) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SCHEDULED PIPELINE                                │
│                         (EventBridge - Hourly)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         newsInvokeGemini Lambda                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ Brave Search │ ─► │ xAI Grok     │ ─► │ DynamoDB (Topics Table)      │  │
│  │ API + RSS    │    │ (grok-4-1-   │    │ id: "staging"                │  │
│  │ Feeds (8     │    │ fast-non-    │    │ status: "pending"            │  │
│  │ feeds + 11   │    │ reasoning)   │    │ generationId: "gen-xxx"      │  │
│  │ Brave sites) │    │ clusters     │    │                              │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   NewsProjectInvokeAgentLambda                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ Read         │ ─► │ xAI Grok     │ ─► │ DynamoDB (Summary Table)     │  │
│  │ "staging"    │    │ (grok-4-1-   │    │ PK: TOPIC#<id>               │  │
│  │ topics       │    │ fast-non-    │    │ SK: SUMMARY|PREDICTION|      │  │
│  │              │    │ reasoning)   │    │     TRACE_CAUSE              │  │
│  │              │    │ generates:   │    └──────────────────────────────┘  │
│  │              │    │ - Summary    │                  │                   │
│  │              │    │ - Prediction │                  ▼                   │
│  │              │    │ - TraceCause │                                      │
│  └──────────────┘    └──────────────┘                                      │
│                                         ┌──────────────────────────────┐   │
│                                         │ Swap staging → "latest"      │   │
│                                         │ Prune old cache entries      │   │
│                                         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        newsSensitiveData Lambda                              │
│                      (API Gateway REST Endpoint)                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Actions:                                                              │  │
│  │ • topics      → Read "latest" from Topics Table                      │  │
│  │ • summary     → Read SUMMARY from Summary Table                      │  │
│  │ • prediction  → Read PREDICTION from Summary Table                   │  │
│  │ • trace_cause → Read TRACE_CAUSE from Summary Table                  │  │
│  │ • geocode     → Mapbox Geocoding API                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                    (GitHub Pages - Static React App)                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ restProxy.js → API Gateway → newsSensitiveData Lambda                │  │
│  │ LocalStorage cache (1 hour TTL)                                      │  │
│  │ Background polling every 10 minutes                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Lambda Functions

### 1. newsInvokeGemini

**Purpose:** Fetches real news articles and generates clustered topics.

**Trigger:** EventBridge scheduled rule (hourly) or manual invocation.

**Data Flow:**
1. Fetches articles in parallel from two sources:
   - **RSS Feeds** (primary): 8 international feeds (BBC, Al Jazeera, France24, SCMP, Asia Times, The Diplomat, Dawn, Japan Times)
   - **Brave Search** (secondary): 11 site-specific searches for sources without RSS (Reuters, AP, Guardian, DW, Euronews, etc.)
2. Deduplicates articles by URL and filters articles older than 48 hours
3. Sends articles to xAI Grok for clustering and topic extraction
4. Writes topics to DynamoDB "staging" row with `generationId`

**Key Features:**
- Dual-source ingestion (RSS + Brave Search) for regional diversity
- Narrative threading: reads 7 days of archive to detect `continues_topic` links across days
- Soft deduplication: tracks recently covered topics (24-hour window) to avoid repetition
- Hallucination filtering: validates all URLs returned by Grok against actually-fetched articles
- Category validation: only accepts `politics, economy, military, conflict, disaster, technology, health`
- Stable topic ID generation based on title

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key |
| `BRAVE_SEARCH_API_KEY` | No | Brave Search API key (falls back to RSS-only) |
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table name for topics |
| `TOPICS_CACHE_ITEM_ID` | No | Item ID (default: "staging") |
| `GROK_MODEL` | No | Model name (default: "grok-4-1-fast-non-reasoning") |
| `TOPICS_LIMIT` | No | Number of topics (default: 13) |

**Output Schema (DynamoDB):**
```json
{
  "id": "staging",
  "topics": [
    {
      "id": "topic-title-hash",
      "topicId": "topic-title-hash",
      "title": "Topic Title",
      "category": "politics",
      "search_keywords": ["keyword1", "keyword2"],
      "regions": ["United States", "China"],
      "sources": [
        {
          "title": "Article Title",
          "url": "https://...",
          "source": "reuters.com",
          "age": "2 hours ago",
          "snippet": "Article description..."
        }
      ]
    }
  ],
  "model": "grok-4-1-fast-non-reasoning",
  "generationId": "gen-1234567890",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "status": "pending"
}
```

---

### 2. NewsProjectInvokeAgentLambda

**Purpose:** Generates AI-powered summaries, predictions, and trace-cause analysis for each topic.

**Trigger:** EventBridge scheduled rule (after newsInvokeGemini) or manual invocation.

**Data Flow:**
1. Reads topics from "staging" row in Topics Table
2. For each topic, generates:
   - **Summary:** 3-4 bullet points highlighting key information
   - **Prediction:** Chain reaction analysis with winners/losers
   - **Trace Cause:** Historical context, perspective balancing, impact verdict
3. Assigns `threadId` to each topic via `continues_topic` inheritance or Jaccard similarity against 7 days of archive
4. Writes each result to Summary/Prediction Table with TTL
5. Swaps "staging" → "latest" in Topics Table
6. Prunes old cache entries from previous generations

**Key Features:**
- Uses xAI Grok (`grok-4-1-fast-non-reasoning`) via native `fetch()` to `api.x.ai`
- Narrative threading: assigns `threadId` by matching `continues_topic` or Jaccard keyword/region/category similarity (threshold 0.4)
- Generation ID tracking for cache coherence
- Automatic cleanup of obsolete entries
- Structured prompts for consistent output format

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key |
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table for topics |
| `SUMMARIZE_PREDICT_TABLE` | Yes | DynamoDB table for summaries/predictions |
| `GROK_MODEL` | No | Model name (default: "grok-4-1-fast-non-reasoning") |
| `GROK_API_URL` | No | API endpoint (default: "https://api.x.ai/v1/chat/completions") |
| `MAX_TOKENS` | No | Max tokens per request (default: 600) |
| `TEMPERATURE` | No | Temperature (default: 0.2) |
| `TOP_P` | No | Top-p sampling (default: 0.9) |
| `SUMMARY_PREDICT_TTL_SECONDS` | No | Summary cache TTL (default: 3600) |
| `PREDICTION_TTL_SECONDS` | No | Prediction cache TTL (default: 3600) |
| `SUMMARY_PREDICT_PK_PREFIX` | No | DynamoDB PK prefix (default: "TOPIC#") |
| `CACHE_CLEANUP_ENABLED` | No | Enable pruning (default: true) |

**Payload Options:**
```json
{
  "action": "both",           // "summary", "prediction", "trace_cause", or "both"
  "topicId": "optional-id",   // Process specific topic only
  "readOnly": false           // If true, only read cache without generating
}
```

**Output Schema (DynamoDB):**
```json
{
  "PK": "TOPIC#topic-id-hash",
  "SK": "SUMMARY",            // or "PREDICTION" or "TRACE_CAUSE"
  "topicId": "topic-id-hash",
  "title": "Topic Title",
  "action": "summary",
  "content": "Generated content...",
  "model": "grok-4-1-fast-non-reasoning",
  "provider": "xai",
  "generatedAt": "2024-01-15T10:05:00.000Z",
  "generationId": "gen-1234567890",
  "ttl": 1705315500,
  "latencyMs": 1234
}
```

---

### 3. newsSensitiveData

**Purpose:** Read-only REST proxy for frontend. Serves cached data and provides geocoding.

**Trigger:** API Gateway HTTP requests from frontend.

**Supported Actions:**

| Action | Payload | Auth Required | Description |
|--------|---------|---------------|-------------|
| `topics` | (none) | No | Returns cached topics from "latest" row |
| `summary` | `{ topicId: "..." }` | No | Returns cached summary for topic |
| `prediction` | `{ topicId: "..." }` | No | Returns cached prediction for topic |
| `trace_cause` | `{ topicId: "..." }` | No | Returns cached trace cause for topic |
| `geocode` | `{ address: "..." }` | No | Returns lat/lng from Mapbox |
| `today` | (none) | No | Returns today's archive entries |
| `archive_range` | `{ days: 30 }` | Yes (API key) | Returns N days of archive entries |
| `narrative_thread` | `{ threadId: "..." }` | Yes (API key) | Returns all entries for a thread across days |

**Key Features:**
- Read-only (no write operations)
- CORS configured for allowed origins
- Staleness detection with configurable max age
- Country-aware geocoding (detects country queries)
- Two-tier API key system: `member` (7 days) and `enterprise` (30 days) access

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table for topics |
| `SUMMARIZE_PREDICT_TABLE` | Yes | DynamoDB table for summaries |
| `MAPBOX_GEOCODING_KEY` | Yes | Mapbox API key |
| `MEMBER_API_KEYS` | No | Comma-separated member-tier API keys |
| `ENTERPRISE_API_KEYS` | No | Comma-separated enterprise-tier API keys |
| `TOPICS_CACHE_ITEM_ID` | No | Item ID (default: "latest") |
| `TOPICS_CACHE_MAX_AGE_SECONDS` | No | Max age for topics (default: 9000) |
| `SUMMARY_PREDICT_MAX_AGE_SECONDS` | No | Max age for summaries (default: 5400) |
| `SUMMARY_PREDICT_PK_PREFIX` | No | DynamoDB PK prefix (default: "TOPIC#") |
| `SUMMARY_SORT_KEY` | No | Summary sort key (default: "SUMMARY") |
| `PREDICTION_SORT_KEY` | No | Prediction sort key (default: "PREDICTION") |

**Request Format:**
```json
POST /proxy
{
  "action": "topics",
  "payload": {}
}
```

**Response Format:**
```json
{
  "success": true,
  "cached": true,
  "data": { ... }
}
```

**CORS Allowed Origins:**
- `https://benben05059997.github.io`
- `https://benben05059997.github.io/GlobalPerspective`
- `https://globalperspective.net`
- `https://www.globalperspective.net`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

---

### 4. newsPostLinkedIn

**Purpose:** Posts the day's top topics to social media platforms (LinkedIn, Bluesky, X/Twitter, Threads).

**Trigger:** EventBridge scheduled rule or manual invocation.

**Data Flow:**
1. Reads "latest" topics from Topics Table
2. Fetches AI summaries from Summary Table for each topic
3. Generates platform-specific post copy per topic
4. Posts to configured social media platforms (skips if already posted today)
5. Records each post in a Social Posts Table with 30-day TTL

**Key Features:**
- Multi-platform: LinkedIn, Bluesky, X/Twitter, Threads
- Deduplication: checks Social Posts Table before posting to avoid duplicates
- Configurable rate limits (`MAX_POSTS_PER_RUN`, `MAX_POSTS_PER_DAY`)
- Significance ordering: high > medium > low priority topics posted first

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table for topics |
| `SUMMARIZE_PREDICT_TABLE` | Yes | DynamoDB table for summaries |
| `SOCIAL_POSTS_TABLE` | Yes | DynamoDB table tracking posted items |
| `LINKEDIN_ACCESS_TOKEN` | No | LinkedIn OAuth token |
| `LINKEDIN_PERSON_ID` | No | LinkedIn person URN |
| `BLUESKY_IDENTIFIER` | No | Bluesky handle |
| `BLUESKY_APP_PASSWORD` | No | Bluesky app password |
| `X_API_KEY` / `X_API_SECRET` | No | X/Twitter API credentials |
| `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | No | X/Twitter user tokens |
| `THREADS_ACCESS_TOKEN` | No | Threads access token |
| `THREADS_USER_ID` | No | Threads user ID |
| `SITE_URL` | No | Site URL in posts (default: "https://globalperspective.net/") |
| `MAX_POSTS_PER_RUN` | No | Max posts per Lambda run (default: 5) |
| `MAX_POSTS_PER_DAY` | No | Max posts per day (default: 100) |

---

## DynamoDB Tables

### Topics Table (TOPICS_DDB_TABLE)

**Primary Key:** `id` (String)

| Item ID | Description |
|---------|-------------|
| `staging` | Topics being processed (written by newsInvokeGemini) |
| `latest` | Active topics served to frontend (swapped by NewsProjectInvokeAgentLambda) |

**Schema:**
```
id: String (partition key)
topics: List<Topic>
model: String
limit: Number
generationId: String
updatedAt: String (ISO 8601)
status: String ("pending" | "active")
activatedAt: String (ISO 8601, only on "latest")
```

### Summary/Prediction Table (SUMMARIZE_PREDICT_TABLE)

**Primary Key:** `PK` (String), `SK` (String)

**Key Format:**
- PK: `TOPIC#<topicId>`
- SK: `SUMMARY` | `PREDICTION` | `TRACE_CAUSE`

**Schema:**
```
PK: String (partition key)
SK: String (sort key)
topicId: String
title: String
action: String
content: String
model: String
provider: String
generatedAt: String (ISO 8601)
generationId: String
ttl: Number (Unix timestamp)
latencyMs: Number
```

---

## External APIs

### Brave Search API
- **Endpoint:** `https://api.search.brave.com/res/v1/news/search`
- **Used by:** newsInvokeGemini
- **Purpose:** Fetch real news articles (supplementary to RSS feeds)
- **Pricing:** Free tier available, paid plans for higher limits

### xAI Grok API
- **Endpoint:** `https://api.x.ai/v1` (OpenAI-compatible)
- **Used by:** newsInvokeGemini (via OpenAI SDK with custom baseURL), NewsProjectInvokeAgentLambda (via native fetch)
- **Model:** `grok-4-1-fast-non-reasoning`
- **Purpose:** Cluster articles into topics; generate summaries, predictions, trace-cause analysis

### Mapbox Geocoding API
- **Endpoint:** `https://api.mapbox.com/geocoding/v5/mapbox.places/`
- **Used by:** newsSensitiveData
- **Purpose:** Convert location names to coordinates for map markers

---

## Deployment

### Lambda Deployment (via Amplify)

```bash
# Push all backend changes
amplify push

# Push specific function
amplify push --yes
```

### Environment Variables Setup

Set these in AWS Lambda console or via Amplify:

```bash
# newsInvokeGemini
XAI_API_KEY=xxx
BRAVE_SEARCH_API_KEY=xxx
TOPICS_DDB_TABLE=xxx

# NewsProjectInvokeAgentLambda
XAI_API_KEY=xxx
TOPICS_DDB_TABLE=xxx
SUMMARIZE_PREDICT_TABLE=xxx

# newsSensitiveData
TOPICS_DDB_TABLE=xxx
SUMMARIZE_PREDICT_TABLE=xxx
MAPBOX_GEOCODING_KEY=xxx
MEMBER_API_KEYS=key1,key2
ENTERPRISE_API_KEYS=key3,key4
```

### EventBridge Schedule

The pipeline runs hourly:
1. `newsInvokeGemini` runs first (fetches news, writes staging)
2. `NewsProjectInvokeAgentLambda` runs after (generates AI content, swaps to active)

Configure in AWS EventBridge or Amplify schedule settings.

---

## Testing

### Test newsInvokeGemini
```bash
aws lambda invoke \
  --function-name newsInvokeGemini \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

### Test NewsProjectInvokeAgentLambda
```bash
aws lambda invoke \
  --function-name NewsProjectInvokeAgentLambda \
  --payload '{"action":"both"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

### Test newsSensitiveData
```bash
# Get topics
curl -X POST https://<api-gateway-url>/proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"topics","payload":{}}'

# Get summary
curl -X POST https://<api-gateway-url>/proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"summary","payload":{"topicId":"your-topic-id"}}'

# Geocode
curl -X POST https://<api-gateway-url>/proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"geocode","payload":{"address":"Tokyo, Japan"}}'
```

---

## Troubleshooting

### Topics not loading
1. Check `newsSensitiveData` CloudWatch logs
2. Verify DynamoDB has "latest" item
3. Check CORS origins match your domain
4. Verify API Gateway endpoint in `docs/config.js`

### Summaries/predictions failing
1. Check if topic exists in DynamoDB with matching ID
2. Verify `NewsProjectInvokeAgentLambda` ran successfully
3. Check generationId matches between topics and summaries
4. Look for cache miss errors (503 status)

### Stale data
1. Check EventBridge schedule is enabled
2. Verify `newsInvokeGemini` is writing to staging
3. Verify `NewsProjectInvokeAgentLambda` is swapping staging→latest
4. Check `updatedAt` timestamp in DynamoDB

### Geocoding failures
1. Verify `MAPBOX_GEOCODING_KEY` is set
2. Check Mapbox API quota/billing
3. Try different address format

---

## Security Notes

1. **No secrets in frontend** - All API keys in Lambda environment variables
2. **CORS restricted** - Only allowed origins can call the proxy
3. **Read-only proxy** - `newsSensitiveData` cannot modify data
4. **TTL cleanup** - Old cache entries automatically expire
5. **Generation ID tracking** - Prevents serving mismatched data

---

## Cost Optimization

| Service | Cost Driver | Optimization |
|---------|-------------|--------------|
| Brave Search | API calls | Site-specific queries, 48-hour article age filter |
| xAI Grok | Tokens | `grok-4-1-fast-non-reasoning`, low temperature, 600 max tokens |
| DynamoDB | Read/write units | TTL-based cleanup, caching |
| Lambda | Invocations + duration | Scheduled runs (not on-demand) |

Estimated monthly cost: ~$50-100 depending on traffic.
