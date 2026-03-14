# Global Perspectives — Architecture Overview

**Last verified:** 2026-03-14

Global Perspectives is an AI-powered global news aggregation platform. It fetches real news from RSS feeds and Brave Search, clusters articles into topics using xAI Grok, generates AI insights (summaries, predictions, root-cause analysis), and displays everything on an interactive world map and weekly narrative timeline.

- **Production URL:** https://benben05059997.github.io/globalPerspective-v1/
- **Custom domain:** https://globalperspective.net
- **Frontend hosting:** GitHub Pages (served from `docs/`)
- **Backend:** AWS Lambda + API Gateway + DynamoDB (managed via Amplify)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SCHEDULED PIPELINE (EventBridge)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │       newsInvokeGemini          │
                    │  RSS Feeds (8) + Brave Search  │
                    │  → xAI Grok clusters topics    │
                    │  → DynamoDB Topics[id=staging] │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  NewsProjectInvokeAgentLambda   │
                    │  Reads staging topics          │
                    │  → xAI Grok generates:         │
                    │    SUMMARY / PREDICTION /      │
                    │    TRACE_CAUSE per topic       │
                    │  → Assigns threadId            │
                    │  → Writes Summary DDB          │
                    │  → Swaps staging → latest      │
                    │  → Writes today-archive        │
                    └───────────────┬───────────────┘
                                    │
               ┌────────────────────▼────────────────────┐
               │              newsPostLinkedIn             │
               │  Reads latest + summaries               │
               │  → Posts to LinkedIn / Bluesky /        │
               │    X(Twitter) / Threads                 │
               │  → Deduplicates via SOCIAL_POSTS_TABLE  │
               └─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │         newsSensitiveData       │
                    │   API Gateway REST endpoint    │
                    │   Serves 8 actions to frontend │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │     React Frontend (GitHub Pages)│
                    │  restProxy.js → API Gateway    │
                    │  LocalStorage cache (1hr TTL)  │
                    │  Background poll every 10min   │
                    └────────────────────────────────┘
```

---

## Lambda Functions

### 1. `newsInvokeGemini`
**Path:** `amplify/backend/function/newsInvokeGemini/src/index.js`
**Trigger:** EventBridge (hourly) or manual

Despite the name, uses **xAI Grok** — no Gemini at all.

**What it does:**
1. Fetches articles in parallel from:
   - **RSS feeds** (8): BBC, Al Jazeera, France24, SCMP, Asia Times, The Diplomat, Dawn, Japan Times
   - **Brave Search** (11 site queries): Reuters, AP, Guardian, DW, Euronews, and others
2. Filters articles older than 48 hours; deduplicates by URL
3. Checks soft-deduplication table (24hr window) to avoid re-covering the same story
4. Sends to xAI Grok to cluster into topics
5. Validates all URLs returned by Grok against actually-fetched articles (hallucination filter)
6. Assigns `continues_topic` field by scanning 7 days of past archive
7. Writes to DynamoDB Topics table as `id=staging`

**Key env vars:**
| Variable | Default | Notes |
|----------|---------|-------|
| `XAI_API_KEY` | — | Required |
| `BRAVE_SEARCH_API_KEY` | — | Optional; falls back to RSS-only |
| `TOPICS_DDB_TABLE` | — | Required |
| `GROK_MODEL` | `grok-4-1-fast-non-reasoning` | |
| `TOPICS_CACHE_ITEM_ID` | `staging` | |
| `TOPICS_LIMIT` | `13` | |

---

### 2. `NewsProjectInvokeAgentLambda`
**Path:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`
**Trigger:** EventBridge (after newsInvokeGemini) or manual

**What it does:**
1. Reads topics from `id=staging` in Topics table
2. For each topic, calls xAI Grok (via native `fetch()`) to generate:
   - **SUMMARY** — 3-4 bullet-point key takeaways
   - **PREDICTION** — chain-reaction analysis with winners/losers
   - **TRACE_CAUSE** — historical context and root cause
3. Assigns `threadId` to each topic:
   - If topic has `continues_topic` → inherit parent's `threadId`
   - Else → Jaccard similarity (keywords + regions + category, threshold 0.4) against 7 days of archive
   - Else → generate new `thread-{slug}-{hash}`
4. Writes each to Summary/Prediction DDB table with TTL
5. Swaps Topics `staging` → `latest`
6. Writes today's topics as `today-archive` entry
7. Prunes old cache entries from previous generations

**Payload options:**
```json
{ "action": "both" }              // "summary", "prediction", "trace_cause", or "both"
{ "topicId": "specific-id" }      // Process one topic only
{ "readOnly": true }              // Read cache without generating
```

**Key env vars:**
| Variable | Default | Notes |
|----------|---------|-------|
| `XAI_API_KEY` | — | Required |
| `TOPICS_DDB_TABLE` | — | Required |
| `SUMMARIZE_PREDICT_TABLE` | — | Required |
| `GROK_MODEL` | `grok-4-1-fast-non-reasoning` | |
| `GROK_API_URL` | `https://api.x.ai/v1/chat/completions` | |
| `MAX_TOKENS` | `600` | |
| `TEMPERATURE` | `0.2` | |
| `TOP_P` | `0.9` | |
| `SUMMARY_PREDICT_TTL_SECONDS` | `3600` | |
| `PREDICTION_TTL_SECONDS` | `3600` | |
| `CACHE_CLEANUP_ENABLED` | `true` | |

---

### 3. `newsSensitiveData`
**Path:** `amplify/backend/function/newsSensitiveData/src/index.js`
**Trigger:** API Gateway HTTP POST from frontend

Read-only REST proxy. All 8 actions:

| Action | Auth | Payload | Description |
|--------|------|---------|-------------|
| `topics` | No | — | Returns `latest` topics |
| `summary` | No | `{ topicId }` | Returns cached summary |
| `prediction` | No | `{ topicId }` | Returns cached prediction |
| `trace_cause` | No | `{ topicId }` | Returns cached trace cause |
| `geocode` | No | `{ address }` | Mapbox lat/lng lookup |
| `today` | No | — | Today's archive entries |
| `archive_range` | Yes | `{ days }` | N days of archive (member=7, enterprise=30) |
| `narrative_thread` | Yes | `{ threadId }` | All entries for a thread across days |

Auth via `x-api-key` header. Keys configured in `MEMBER_API_KEYS` and `ENTERPRISE_API_KEYS` env vars (comma-separated).

**Key env vars:**
| Variable | Default | Notes |
|----------|---------|-------|
| `TOPICS_DDB_TABLE` | — | Required |
| `SUMMARIZE_PREDICT_TABLE` | — | Required |
| `MAPBOX_GEOCODING_KEY` | — | Required |
| `MEMBER_API_KEYS` | — | Comma-separated |
| `ENTERPRISE_API_KEYS` | — | Comma-separated |
| `TOPICS_CACHE_ITEM_ID` | `latest` | |
| `TOPICS_CACHE_MAX_AGE_SECONDS` | `9000` | |

**CORS origins:** `benben05059997.github.io`, `benben05059997.github.io/GlobalPerspective`, `globalperspective.net`, `www.globalperspective.net`, `localhost:5173`, `127.0.0.1:5173`

---

### 4. `newsPostLinkedIn`
**Path:** `amplify/backend/function/newsPostLinkedIn/src/index.js`
**Trigger:** EventBridge (scheduled) or manual

**What it does:**
1. Reads `latest` topics + AI summaries from DynamoDB
2. Generates platform-specific post copy per topic
3. Checks `SOCIAL_POSTS_TABLE` to skip already-posted topics
4. Posts to configured platforms (LinkedIn, Bluesky, X/Twitter, Threads)
5. Records each post with 30-day TTL

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `SOCIAL_POSTS_TABLE`, `MAX_POSTS_PER_RUN` (default: 5), `MAX_POSTS_PER_DAY` (default: 100)

---

## DynamoDB Tables

### Topics Table (`TOPICS_DDB_TABLE`)
**PK:** `id` (String)

| id | Description |
|----|-------------|
| `staging` | Topics being processed (written by newsInvokeGemini) |
| `latest` | Active topics served to frontend |
| `today-archive` | Today's snapshot |
| `YYYY-MM-DD` | Daily archive entries |

**Topic schema:**
```json
{
  "id": "staging",
  "topics": [
    {
      "id": "topic-hash",
      "topicId": "topic-hash",
      "title": "Topic Title",
      "category": "politics",
      "regions": ["United States", "China"],
      "threadId": "thread-slug-hash",
      "continues_topic": "prior-topic-id",
      "search_keywords": ["keyword1"],
      "sources": [{ "title": "...", "url": "...", "source": "reuters.com" }]
    }
  ],
  "model": "grok-4-1-fast-non-reasoning",
  "generationId": "gen-1234567890",
  "updatedAt": "2026-03-14T10:00:00.000Z",
  "status": "pending"
}
```

### Summary/Prediction Table (`SUMMARIZE_PREDICT_TABLE`)
**PK:** `TOPIC#<topicId>` / **SK:** `SUMMARY` | `PREDICTION` | `TRACE_CAUSE`

```json
{
  "PK": "TOPIC#topic-hash",
  "SK": "SUMMARY",
  "topicId": "topic-hash",
  "content": "Generated content...",
  "model": "grok-4-1-fast-non-reasoning",
  "provider": "xai",
  "generationId": "gen-1234567890",
  "ttl": 1705315500
}
```

---

## External APIs

| API | Used by | Purpose |
|-----|---------|---------|
| xAI Grok (`api.x.ai`) | newsInvokeGemini, NewsProjectInvokeAgentLambda | Topic clustering + AI content generation |
| Brave Search | newsInvokeGemini | News article search |
| Mapbox Geocoding | newsSensitiveData | Location name → lat/lng |
| Google Maps | WorldMap.jsx, WeeklyMap.jsx | Interactive map rendering |

---

## Frontend

**Stack:** React 19 + Vite, React Router v6, GitHub Pages
**Source:** `global-perspectives-starter/frontend/src/`
**Production:** `docs/` (served by GitHub Pages)

### Routes
| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Home.jsx` | Daily topics + AI analysis |
| `/map` | `WorldMap.jsx` | Interactive daily world map |
| `/weekly` | `WeeklyPage.jsx` | Weekly narrative analysis — requires API key |
| `/weekly-map` | `WeeklyMap.jsx` | Full-page weekly map with date playback — requires API key |
| `/about` | `AboutContact.jsx` | |
| `/contact` | `Contact.jsx` | |
| `/privacy` | `PrivacyTerms.jsx` | |
| `/disclosures` | `Disclosures.jsx` | |

### Key Components
| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Nav shell with hamburger menu |
| `Home.jsx` | Daily topics, region grouping, AI toolbar |
| `WorldMap.jsx` | Google Maps with topic markers, geodesic polylines, side panel, related-countries mode |
| `MapSidePanel.jsx` | Per-country topic cards with AI toolbar |
| `WeeklyPage.jsx` | Narrative threads grouped by region, trending section, filter bar |
| `WeeklyMap.jsx` | Thread-colored markers, date playback, thread sidebar |
| `ApiKeyGate.jsx` | Reusable API key prompt for premium features |
| `StoryEntryCard.jsx` | Entry card with Summarize/Predict/Trace Cause toggle |
| `TrendBadge.jsx` | Rising/Stable/Fading/New trend pill |
| `MiniMap.jsx` | Small SVG map showing story regions |

### Key Hooks
| Hook | Purpose |
|------|---------|
| `useGeminiTopics()` | Fetch daily topics with 1hr LocalStorage cache + 10min background poll |
| `useWeeklyArchive(apiKey)` | Fetch archive_range (30 days) with 30min LocalStorage cache |
| `useIsMobile(breakpoint)` | Responsive breakpoint (default 600px) |

### Service Layers
```
restProxy.js          ← active production path
  └─ proxyAction(action, payload)
  └─ fetchTopicsCache()
  └─ fetchSummaryCache(topicId)
  └─ fetchPredictionCache(topicId)
  └─ fetchTraceCauseCache(topicId)
  └─ fetchTodayArchive()
  └─ fetchArchiveRange(days, apiKey)
  └─ geocodeProxy(address)

appsyncProxy.js       ← unused, kept for reference
graphqlService.js     ← business logic abstraction over restProxy
```

### Caching Strategy
- **Topics:** LocalStorage key `gemini_topics_cache_v2`, 1hr TTL
- **Weekly archive:** LocalStorage key `gp_weekly_archive_v1`, 30min TTL
- **API key:** LocalStorage key `gp_api_key`, persistent
- **Backend:** DynamoDB with TTL-based cleanup

### Narrative Threading
Stories are linked across days via `threadId`:
1. `continues_topic` field on a topic → inherit parent's `threadId`
2. Jaccard similarity (keywords + regions + category) against 7-day archive, threshold 0.4 → match existing thread
3. Neither → generate new `thread-{slug}-{hash}`

Weekly pages group topics by `threadId` to show how a story evolves across dates and geographies.

---

## Deployment Workflow

**Every frontend change requires a build + copy to `docs/`:**

```bash
# 1. Build
cd global-perspectives-starter/frontend
npm run build

# 2. Copy to production
rm -rf ../../docs/assets
cp -r dist/assets ../../docs/assets
cp dist/index.html ../../docs/index.html

# 3. NEVER overwrite docs/config.js (contains runtime API endpoint)

# 4. Update CHANGES.md, then commit
cd ../..
git add docs/assets docs/index.html global-perspectives-starter/frontend/src/ CHANGES.md
git commit -m "Description of changes"
git push
```

**Backend (Lambda) changes:** Deploy via `amplify push`. No build step needed for Lambda source edits.

---

## Key File Locations

| Purpose | Path |
|---------|------|
| This architecture doc | `ARCHITECTURE.md` |
| Claude instructions | `CLAUDE.md` |
| Change log | `CHANGES.md` |
| Deployment checklist | `DEPLOYMENT_NOTES.md` |
| Lambda: news fetch | `amplify/backend/function/newsInvokeGemini/src/index.js` |
| Lambda: AI generation | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` |
| Lambda: REST proxy | `amplify/backend/function/newsSensitiveData/src/index.js` |
| Lambda: social posting | `amplify/backend/function/newsPostLinkedIn/src/index.js` |
| Frontend source | `global-perspectives-starter/frontend/src/` |
| Production build | `docs/` |
| Runtime config | `docs/config.js` (sets `window.SENSITIVE_PROXY_ENDPOINT`) |

---

## Common Mistakes to Avoid

1. **Pushing frontend source without building** — changes won't appear in production
2. **Overwriting `docs/config.js`** — it sets the API Gateway endpoint at runtime
3. **Referring to docs that mention Gemini or OpenAI** — the backend uses xAI Grok; older docs are outdated
4. **Reading old planning docs** — `HYBRID_NEWS_ARCHITECTURE.md`, `INTEGRATION_NOTES_Gemini_AppSync.md`, `NEWS_API_INTEGRATION_PLAN.md`, etc. are all pre-xAI and should be ignored
