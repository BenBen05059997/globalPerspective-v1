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
│  │ Brave Search │ ─► │ Gemini 2.5   │ ─► │ DynamoDB (Topics Table)      │  │
│  │ API (10      │    │ Flash        │    │ id: "staging"                │  │
│  │ regional     │    │ clusters     │    │ status: "pending"            │  │
│  │ queries)     │    │ articles     │    │ generationId: "gen-xxx"      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   NewsProjectInvokeAgentLambda                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ Read         │ ─► │ OpenAI       │ ─► │ DynamoDB (Summary Table)     │  │
│  │ "staging"    │    │ gpt-4o-mini  │    │ PK: TOPIC#<id>               │  │
│  │ topics       │    │ generates:   │    │ SK: SUMMARY|PREDICTION|      │  │
│  │              │    │ - Summary    │    │     TRACE_CAUSE              │  │
│  │              │    │ - Prediction │    └──────────────────────────────┘  │
│  │              │    │ - TraceCause │                  │                   │
│  └──────────────┘    └──────────────┘                  ▼                   │
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
1. Queries Brave Search API with 10 regional queries for global coverage
2. Deduplicates articles by URL
3. Sends articles to Gemini 2.5 Flash for clustering and topic extraction
4. Writes topics to DynamoDB "staging" row with `generationId`

**Key Features:**
- Multi-query strategy for regional diversity (North America, South America, Europe, Asia, Middle East, Africa, Oceania)
- Fallback to Gemini-only mode if Brave Search fails
- Stable topic ID generation based on title

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Yes | Google Gemini API key |
| `BRAVE_SEARCH_API_KEY` | Yes | Brave Search API key |
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table name for topics |
| `TOPICS_CACHE_ITEM_ID` | No | Item ID (default: "staging") |
| `GEMINI_MODEL` | No | Model name (default: "gemini-2.5-flash") |
| `TOPICS_LIMIT` | No | Number of topics (default: 10) |

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
  "model": "gemini-2.5-flash",
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
3. Writes each result to Summary/Prediction Table with TTL
4. Swaps "staging" → "latest" in Topics Table
5. Prunes old cache entries from previous generations

**Key Features:**
- Uses OpenAI gpt-4o-mini for cost-effective generation
- Generation ID tracking for cache coherence
- Automatic cleanup of obsolete entries
- Structured prompts for consistent output format

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table for topics |
| `SUMMARIZE_PREDICT_TABLE` | Yes | DynamoDB table for summaries/predictions |
| `OPENAI_MODEL` | No | Model name (default: "gpt-4o-mini") |
| `MAX_TOKENS` | No | Max tokens per request (default: 600) |
| `TEMPERATURE` | No | Temperature (default: 0.2) |
| `SUMMARY_PREDICT_TTL_SECONDS` | No | Cache TTL (default: 3600) |
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
  "model": "gpt-4o-mini",
  "provider": "openai",
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

| Action | Payload | Description |
|--------|---------|-------------|
| `topics` | (none) | Returns cached topics from "latest" row |
| `summary` | `{ topicId: "..." }` | Returns cached summary for topic |
| `prediction` | `{ topicId: "..." }` | Returns cached prediction for topic |
| `trace_cause` | `{ topicId: "..." }` | Returns cached trace cause for topic |
| `geocode` | `{ address: "..." }` | Returns lat/lng from Mapbox |

**Key Features:**
- Read-only (no write operations)
- CORS configured for allowed origins
- Staleness detection with configurable max age
- Country-aware geocoding (detects country queries)

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `TOPICS_DDB_TABLE` | Yes | DynamoDB table for topics |
| `SUMMARIZE_PREDICT_TABLE` | Yes | DynamoDB table for summaries |
| `MAPBOX_GEOCODING_KEY` | Yes | Mapbox API key |
| `TOPICS_CACHE_ITEM_ID` | No | Item ID (default: "latest") |
| `TOPICS_CACHE_MAX_AGE_SECONDS` | No | Max age (default: 5400) |

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
- `https://globalperspective.net`
- `https://www.globalperspective.net`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

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
- **Purpose:** Fetch real news articles
- **Pricing:** Free tier available, paid plans for higher limits

### Google Gemini API
- **Endpoint:** Via `@google/generative-ai` SDK
- **Used by:** newsInvokeGemini
- **Model:** gemini-2.5-flash
- **Purpose:** Cluster articles into topics

### OpenAI API
- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Used by:** NewsProjectInvokeAgentLambda
- **Model:** gpt-4o-mini
- **Purpose:** Generate summaries, predictions, trace-cause analysis

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
GOOGLE_GEMINI_API_KEY=xxx
BRAVE_SEARCH_API_KEY=xxx
TOPICS_DDB_TABLE=xxx

# NewsProjectInvokeAgentLambda
OPENAI_API_KEY=xxx
TOPICS_DDB_TABLE=xxx
SUMMARIZE_PREDICT_TABLE=xxx

# newsSensitiveData
TOPICS_DDB_TABLE=xxx
SUMMARIZE_PREDICT_TABLE=xxx
MAPBOX_GEOCODING_KEY=xxx
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
| Brave Search | API calls | Regional query batching |
| Gemini | Tokens | gemini-2.5-flash (cheaper than Pro) |
| OpenAI | Tokens | gpt-4o-mini, low temperature, 600 max tokens |
| DynamoDB | Read/write units | TTL-based cleanup, caching |
| Lambda | Invocations + duration | Scheduled runs (not on-demand) |

Estimated monthly cost: ~$50-100 depending on traffic.
