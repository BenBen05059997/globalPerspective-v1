# Global Perspectives — Architecture Overview

**Last verified:** 2026-04-22

Global Perspectives is an AI-powered global news aggregation platform. It fetches real news from RSS feeds and Brave Search, clusters articles into topics using xAI Grok, generates AI insights (summaries, predictions, root-cause analysis), and displays everything on an interactive world map and weekly narrative timeline.

- **Production URL:** https://globalperspective.net (custom domain)
- **GitHub Pages URL:** https://benben05059997.github.io/globalPerspective-v1/
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
                    │  RSS Feeds (22) + Brave Search │
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
                    ┌───────────────▼───────────────┐
                    │         newsThreadAnalysis      │
                    │  Daily batch (6:30 UTC)        │
                    │  Top 10 threads (2+ entries)   │
                    │  → xAI Grok generates:         │
                    │    threadTitle, storyArc,      │
                    │    trajectory, rootCauseChain, │
                    │    watchQuestions              │
                    │  → Writes THREAD# to SummaryDB │
                    └───────────────┬───────────────┘
                    ┌───────────────▼───────────────┐
                    │      newsCountryIntelligence    │
                    │  Daily batch (~7:00 UTC)       │
                    │  Top 10 countries by articles  │
                    │  Uses thread analyses + Brave  │
                    │  → xAI Grok generates:         │
                    │    headline, situationSummary, │
                    │    trajectory, riskSignals,    │
                    │    riskLevel                   │
                    │  → Writes COUNTRY# to SummaryDB│
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
                    │   16 actions — all content     │
                    │   public during early access   │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │     React Frontend (GitHub Pages)│
                    │  restProxy.js → API Gateway    │
                    │  Firebase Auth (magic link)    │
                    │  LocalStorage cache (1hr TTL)  │
                    │  Background poll every 10min   │
                    └────────────────────────────────┘
```

---

## Auth System

**Firebase Authentication** — two methods: passwordless email link (magic link) and Google Sign-In.

**Magic link flow:**
1. User enters email on `/signin`
2. Firebase sends a magic link email
3. User clicks link → lands on `/auth/callback`
4. `AuthCallback` calls `completeSignIn()` → Firebase signs user in, sets welcome flag in sessionStorage

**Google Sign-In flow:**
1. User clicks Google button on `/signin`
2. `signInWithGoogle()` in `AuthContext.jsx` calls `signInWithPopup` + `GoogleAuthProvider`
3. Firebase signs user in immediately

**In the frontend:**
- `AuthContext.jsx` manages Firebase auth state (`onAuthStateChanged`), exposes `signInWithGoogle()`
- `AuthBridge` in `App.jsx` calls `setAuthProvider(getIdToken)` on mount, wiring the token getter into `restProxy`
- `proxyActionWithAuth()` in `restProxy.js` sends `Authorization: Bearer <token>` header on gated requests

**First sign-in:** `newsSensitiveData` auto-creates a user record in `USERS_TABLE` (`uid`, `email`, `trialStartedAt`) on first JWT-gated request.

**Firebase config** is read from `window.FIREBASE_CONFIG` (set in `docs/config.js` at runtime — never bundled into the build). Falls back to `VITE_FIREBASE_*` env vars for local dev.

**Tier enforcement** is handled in `newsSensitiveData` (Lambda) — see Tier System below.

---

## Tier System

| Tier | Access |
|------|--------|
| `free` | Public topics only (no auth required) |
| `member` | 7-day archive + thread/country intelligence |
| `enterprise` | 90-day archive + all features |

**Storage:** DynamoDB `USERS_TABLE`, keyed by Firebase UID (`uid`).

**Lifecycle:** Managed by `newsStripeWebhook` Lambda (name is legacy — now handles **Paddle**):
- `subscription.created` → creates/upgrades user to `member`, stores `paddleCustomerId` + `paddleSubscriptionId`
- `subscription.updated` → updates tier based on plan change
- `subscription.canceled` → downgrades to `free`

Signature verification: HMAC-SHA256 of `${ts}:${rawBody}` using `PADDLE_WEBHOOK_SECRET`. UID passed via `data.custom_data.uid` in checkout URL params.

**🚀 Early access mode (ACTIVE as of 2026-04-11):** ALL auth gates removed from `newsSensitiveData`. Every action is fully public — no Firebase JWT required. `resolveUserTier` is only called for `user_profile` and `portal_session`. Archive, thread analysis, country intelligence, narrative thread, and daily brief are all open. This will be re-gated when Paddle billing goes live.

**Enforcement (backend):**
Auth gates disabled in early access. When re-enabling: `newsSensitiveData` verifies Firebase JWT via lightweight Node `crypto` + Google cert endpoint (no firebase-admin). Reads USERS_TABLE for tier, enforces day limits (`member`=7, `enterprise`=90).

**Paddle Customer Portal:** accessible from `/account` via the `portal_session` action. Calls Paddle auth-token API using `PADDLE_API_KEY`, returns redirect URL.

---

## Lambda Functions

### 1. `newsInvokeGemini`
**Path:** `amplify/backend/function/newsInvokeGemini/src/index.js`
**Trigger:** EventBridge (hourly) or manual

Despite the name, uses **xAI Grok** — no Gemini.

**What it does:**
1. Fetches articles from:
   - **RSS feeds** (8): BBC, Al Jazeera, France24, SCMP, Asia Times, The Diplomat, Dawn, Japan Times
   - **Brave Search** (11 site queries): Reuters, AP, Guardian, DW, Euronews, and others
2. Filters articles older than 48 hours; deduplicates by URL
3. Checks soft-deduplication table (24hr window) to avoid re-covering the same story
4. Sends to xAI Grok to cluster into topics
5. Validates all URLs returned by Grok against actually-fetched articles (hallucination filter)
6. Assigns `continues_topic` field by scanning 7 days of past archive
7. Writes to DynamoDB Topics table as `id=staging`

**Key env vars:**
| Variable | Notes |
|----------|-------|
| `XAI_API_KEY` | Required |
| `BRAVE_SEARCH_API_KEY` | Optional; falls back to RSS-only |
| `TOPICS_DDB_TABLE` | Required |
| `GROK_MODEL` | Default: `grok-4-1-fast-non-reasoning` |
| `TOPICS_CACHE_ITEM_ID` | Default: `staging` |
| `TOPICS_LIMIT` | Default: `13` |

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
7. Prunes old cache entries

**Payload options:**
```json
{ "action": "both" }              // "summary", "prediction", "trace_cause", or "both"
{ "topicId": "specific-id" }      // Process one topic only
{ "readOnly": true }              // Read cache without generating
```

**Key env vars:**
| Variable | Notes |
|----------|-------|
| `XAI_API_KEY` | Required |
| `TOPICS_DDB_TABLE` | Required |
| `SUMMARIZE_PREDICT_TABLE` | Required |
| `GROK_MODEL` | Default: `grok-4-1-fast-non-reasoning` |
| `GROK_API_URL` | Default: `https://api.x.ai/v1/chat/completions` |
| `MAX_TOKENS` | Default: `600` |
| `TEMPERATURE` | Default: `0.2` |
| `TOP_P` | Default: `0.9` |

---

### 3. `newsThreadAnalysis`
**Path:** `amplify/backend/function/newsThreadAnalysis/src/index.js`
**Trigger:** EventBridge — `cron(30 6 * * ? *)` (6:30 UTC daily)

**What it does:**
1. Reads 30 days of archive entries from Topics table
2. Groups entries by `threadId`; selects top 10 threads with 2+ entries
3. For each thread, searches Brave News + Web for external grounding
4. Calls xAI Grok to generate:
   - `threadTitle` — sharp 6-10 word journalistic title
   - `entryShortTitles` — micro-headline per entry (`{topicId, shortTitle}`)
   - `storyArc` — 2-3 paragraphs on how the story evolved
   - `trajectory` — 2 paragraphs on where it's heading (named scenarios + timeframes)
   - `rootCauseChain` — 3-layer root cause (immediate trigger → medium-term condition → structural factor)
   - `watchQuestions` — 3 specific, actionable watch questions
5. Skips threads where `entryCount` hasn't changed since last run
6. Writes to `SUMMARIZE_PREDICT_TABLE` at `THREAD#{threadId}` / `THREAD_ANALYSIS` (31-day TTL)

**Key env vars:** `XAI_API_KEY`, `GROK_MODEL`, `GROK_API_URL`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`

---

### 4. `newsCountryIntelligence`
**Path:** `amplify/backend/function/newsCountryIntelligence/src/index.js`
**Trigger:** EventBridge — `cron(0 7 * * ? *)` (7:00 UTC daily, runs after newsThreadAnalysis)

**What it does:**
1. Reads 30 days of archive entries; groups by country (`regions` field)
2. Loads existing thread analyses for cross-thread enrichment
3. Selects top 10 countries with 2+ articles
4. For each country, searches Brave News for fresh context
5. Calls xAI Grok to generate:
   - `headline` — 8-12 word sharp situation headline
   - `situationSummary` — 2-3 paragraph intelligence briefing
   - `crossThreadInsight` — connections between story arcs
   - `trajectory` — 2 paragraphs with named scenarios + triggers
   - `riskSignals` — 3-4 specific, concrete watch events
   - `riskLevel` — `low` | `moderate` | `elevated` | `high`
6. Skips countries where `totalArticles` count hasn't changed
7. Writes to `SUMMARIZE_PREDICT_TABLE` at `COUNTRY#{countryName}` / `COUNTRY_INTELLIGENCE` (31-day TTL)

**Key env vars:** `XAI_API_KEY`, `GROK_MODEL`, `GROK_API_URL`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`

---

### 5. `newsSensitiveData`
**Path:** `amplify/backend/function/newsSensitiveData/src/index.js`
**Trigger:** API Gateway HTTP POST from frontend

Read-only REST proxy. All supported actions:

| Action | Auth | Payload | Description |
|--------|------|---------|-------------|
| `topics` | None | — | Returns `latest` topics |
| `summary` | None | `{ topicId }` | Returns cached SUMMARY |
| `prediction` | None | `{ topicId }` | Returns cached PREDICTION |
| `trace_cause` | None | `{ topicId }` | Returns cached TRACE_CAUSE |
| `geocode` | None | `{ address }` | Mapbox lat/lng lookup |
| `today` | None | — | Today's archive entries |
| `country_preview` | None | `{ countryName }` | Public SEO preview: headline, bluf, keyDevelopments, riskLevel, trajectory |
| `thread_preview` | None | `{ threadId }` | Public SEO preview: threadTitle, entryShortTitles |
| `archive_range` | None (early access) | `{ days }` | N days of archive (member=7, enterprise=90) |
| `narrative_thread` | None (early access) | `{ threadId }` | All entries for a thread across days |
| `thread_analysis` | None (early access) | `{ threadIds }` | Thread-level AI analyses |
| `country_intelligence` | None (early access) | `{ countryNames }` | Country-level AI intelligence |
| `daily_brief` | None (early access) | `{ dateKey }` | Daily Intelligence Brief for a specific date |
| `pair_analysis` | None (early access) | `{ pair: "slug" }` | Bilateral relationship analysis for a country pair |
| `pair_analyses_list` | None (early access) | — | All pair analyses (DDB Scan, sorted list) |
| `user_profile` | Firebase JWT | — | User tier + subscription info from USERS_TABLE |
| `portal_session` | Firebase JWT | — | Paddle Customer Portal session URL |

**Early access:** All content actions are currently public (no auth required). When billing goes live, gated actions will require `Authorization: Bearer <firebase-id-token>`.

**CORS origins:** `benben05059997.github.io`, `globalperspective.net`, `www.globalperspective.net`, `localhost:5173`, `127.0.0.1:5173`

**Key env vars:**
| Variable | Notes |
|----------|-------|
| `TOPICS_DDB_TABLE` | Required |
| `SUMMARIZE_PREDICT_TABLE` | Required |
| `USERS_DDB_TABLE` | Required (for tier lookup) |
| `MAPBOX_GEOCODING_KEY` | Required |
| `FIREBASE_PROJECT_ID` | Required (JWT verification) |
| `PADDLE_API_KEY` | Required (portal sessions) |
| `TOPICS_CACHE_MAX_AGE_SECONDS` | Default: `9000` |

---

### 6. `newsPostLinkedIn`
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

### 7. `newsPostDevTo`
**Path:** `amplify/backend/function/newsPostDevTo/src/index.js`
**Trigger:** EventBridge (scheduled) or manual

Posts a daily AI-written summary article to [Dev.to](https://dev.to).

**What it does:**
1. Reads `latest` topics from Topics Table
2. Calls OpenRouter AI (`deepseek/deepseek-r1:free`) to generate a long-form Dev.to article
3. Checks `SOCIAL_POSTS_TABLE` to skip if already posted today
4. Posts to Dev.to via API; records post with 90-day TTL

**Key env vars:** `DEVTO_API_KEY`, `OPENROUTER_API_KEY`, `TOPICS_DDB_TABLE`, `SOCIAL_POSTS_TABLE`, `SITE_URL`

> **Note:** A deploy.zip is staged at `amplify/backend/function/newsPostDevTo/deploy.zip` — needs manual upload to AWS.

---

### 8. `newsPairIntelligence`
**Path:** `amplify/backend/function/newsPairIntelligence/src/index.js`
**Trigger:** EventBridge (scheduled) or manual with `{"pair":["Country A","Country B"],"forceRegenerate":true}`
**Deployed:** 2026-04-18

Bilateral relationship analysis between country pairs.

**What it does:**
1. Default run: analyzes 10 predefined pairs; manual run: single pair specified in payload
2. Reads 30-day archive; deduplicates events by Jaccard title similarity
3. Loads `country_facts.json` editorial layer + existing country intelligence + thread analyses
4. Calls xAI Grok to generate: `pairTitle`, `currentState`, `timeline`, `trajectory` (3 scenarios), `rootDriver` (3 layers), `predictions`, `watchItems`
5. Writes to `SUMMARIZE_PREDICT_TABLE` at `PAIR#{slug}` / `PAIR_ANALYSIS`

**Frontend:** `/weekly/pairs` (PairListPage) + `/weekly/pair/:slug` (PairPage)
**API actions:** `pair_analysis` (single pair by slug) + `pair_analyses_list` (all pairs, DDB Scan)

**Key env vars:** `XAI_API_KEY`, `GROK_MODEL`, `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`

---

### 9. `linkedInAutoPost`
**Path:** `amplify/backend/function/linkedInAutoPost/src/index.js`
**Trigger:** EventBridge (scheduled)

Intelligent scheduled LinkedIn poster — distinct from `newsPostLinkedIn` (manual/multi-platform).

**What it does:**
1. Scans `SUMMARIZE_PREDICT_TABLE` for thread analyses (`THREAD_ANALYSIS`) and country intelligence (`COUNTRY_INTELLIGENCE`)
2. Scores items by trend (rising/stable/fading) and risk level (critical/elevated/moderate/low)
3. Deduplicates against `SOCIAL_POSTS_TABLE`
4. Posts highest-scoring eligible item to LinkedIn; records with TTL

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `SUMMARIZE_PREDICT_TABLE`, `SOCIAL_POSTS_TABLE`

---

### 10. `newsCountryFactsUpdater`
**Path:** `amplify/backend/function/newsCountryFactsUpdater/src/index.js`
**Trigger:** EventBridge (daily scheduled)
**Deployed:** 2026-04-18 (Phase 2 complete)

Keeps country facts in DynamoDB current without manual editing.

**What it does:**
1. Fetches head-of-state/government data from **Wikidata** via SPARQL query
2. Fetches active conflicts from **ACLED API** (approval pending)
3. Detects leadership changes vs. previously stored facts
4. Stores results in `SUMMARIZE_PREDICT_TABLE` at `FACTS#{countryName}` / `COUNTRY_FACTS` (90-day TTL)
5. Supports partial updates for specific countries via payload

**DDB key:** `FACTS#{countryName}` / `COUNTRY_FACTS`
**Key env vars:** `SUMMARIZE_PREDICT_TABLE`, `ACLED_API_KEY` (optional)

---

### 11. `newsStripeWebhook` (name is legacy — handles Paddle)
**Path:** `amplify/backend/function/newsStripeWebhook/src/index.js`
**Trigger:** Paddle webhook (separate API Gateway endpoint)

Handles Paddle billing events to keep USERS_TABLE in sync.

| Paddle Event | Action |
|---|---|
| `subscription.created` | Create/upgrade user to `member`; store `paddleCustomerId` + `paddleSubscriptionId` |
| `subscription.updated` | Update tier based on plan change |
| `subscription.canceled` | Downgrade user to `free` |

**Signature verification:** HMAC-SHA256 of `${ts}:${rawBody}` using `PADDLE_WEBHOOK_SECRET`. Uses Node built-in `crypto` — no external dependencies.

**UID resolution:** `data.custom_data.uid` — passed via checkout URL params (`checkout[custom][uid]={uid}`).

**Key env vars:** `PADDLE_WEBHOOK_SECRET`, `USERS_DDB_TABLE`

---

## DynamoDB Tables

### Topics Table (`TOPICS_DDB_TABLE`)
**PK:** `id` (String)

| id | Description |
|----|-------------|
| `staging` | Topics being processed (written by newsInvokeGemini) |
| `latest` | Active topics served to frontend |
| `today-archive` | Today's snapshot (entries array) |
| `archive#YYYY-MM-DD` | Daily archive entries |

**Topic schema (inside `latest.topics[]`):**
```json
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
```

**Archive entry schema (inside `today-archive.entries[]` / `archive#YYYY-MM-DD.entries[]`):**
```json
{
  "topicId": "topic-hash",
  "title": "Topic Title",
  "category": "politics",
  "regions": ["United States"],
  "threadId": "thread-slug-hash",
  "sources": [...],
  "ai": { "summary": "...", "prediction": "...", "trace_cause": "..." },
  "archivedAt": "2026-03-20T10:00:00.000Z"
}
```

---

### Summary/Prediction Table (`SUMMARIZE_PREDICT_TABLE`)
**PK:** composite string / **SK:** record type

| PK | SK | Written by | Contents |
|----|-----|-----------|---------|
| `TOPIC#{topicId}` | `SUMMARY` | NewsProjectInvokeAgentLambda | Bullet-point key takeaways |
| `TOPIC#{topicId}` | `PREDICTION` | NewsProjectInvokeAgentLambda | Chain-reaction analysis |
| `TOPIC#{topicId}` | `TRACE_CAUSE` | NewsProjectInvokeAgentLambda | Root cause / historical context |
| `THREAD#{threadId}` | `THREAD_ANALYSIS` | newsThreadAnalysis | threadTitle, storyArc, trajectory, rootCauseChain, watchQuestions |
| `COUNTRY#{countryName}` | `COUNTRY_INTELLIGENCE` | newsCountryIntelligence | headline, situationSummary, crossThreadInsight, trajectory, riskSignals, riskLevel |
| `PAIR#{pairSlug}` | `PAIR_ANALYSIS` | newsPairIntelligence | pairTitle, currentState, timeline, trajectory, rootDriver, predictions, watchItems |
| `DAILY_BRIEF#{dateKey}` | `DAILY_BRIEF` | newsPostDevTo | Full daily intelligence brief text (90-day TTL) |
| `FACTS#{countryName}` | `COUNTRY_FACTS` | newsCountryFactsUpdater | Head of state/govt (Wikidata), active conflicts (ACLED), leadership change detection (90-day TTL) |

---

### Users Table (`USERS_DDB_TABLE`)
**PK:** `uid` (Firebase UID, String)

```json
{
  "uid": "firebase-uid",
  "email": "user@example.com",
  "tier": "member",
  "paddleCustomerId": "ctm_xxx",
  "paddleSubscriptionId": "sub_xxx",
  "subscriptionStatus": "active",
  "createdAt": "2026-03-20T10:00:00.000Z",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

---

### Social Posts Table (`SOCIAL_POSTS_TABLE`)
**PK:** `topicId` + `platform`. Deduplication table for LinkedIn/Bluesky/X/Threads/Dev.to posts. TTL: 30 days (90 days for Dev.to).

---

## Cloudflare Workers

Domain is registered and DNS-managed in Cloudflare. Orange cloud (proxy) is enabled — all traffic flows through Cloudflare before reaching GitHub Pages.

### Worker: `globalperspective-rss`

**Routes:** `globalperspective.net/*` and `globalperspective.net/rss*`

**Full source:** `WORKER_FULL_CODE.md`

The Worker handles three cases:

| Path | Visitor type | What happens |
|------|-------------|--------------|
| `/rss` | Anyone | Proxied to `newsSensitiveData ?action=rss`, returns RSS 2.0 XML, 30 min edge cache |
| `/weekly/country/:name` | Bot (25+ patterns) | POSTs `country_preview` to Lambda, returns pre-rendered HTML with OG tags |
| `/weekly/thread/:id` | Bot (25+ patterns) | POSTs `thread_preview` to Lambda, returns pre-rendered HTML with OG tags |
| Everything else | Anyone | Passed through to GitHub Pages unchanged |

**Bot patterns detected:** Twitterbot, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Googlebot, Bingbot, and 14 others.

**Why this matters:**
- Social shares of country/thread pages show rich previews (real headline, description, image) instead of blank cards
- AI crawlers (ChatGPT, Perplexity, Claude, Google) can read and cite page content — previously invisible due to React SPA empty shell
- Human visitors always get the full React app unchanged

**Key implementation detail:** Both `country_preview` and `thread_preview` require POST with JSON body (`{ action, payload }`). The Lambda's `payload` field is only populated from POST body, not GET query params.

---

## CloudWatch EventBridge Rules

| Rule name | Schedule | Target |
|-----------|----------|--------|
| `DataCollectorSchedule` | rate(1 hour) | newsInvokeGemini |
| `TriggerDailyAnalysis` | cron(30 6 * * ? *) | newsThreadAnalysis (6:30 UTC) |
| `TriggerCountryIntelligence` | cron(0 7 * * ? *) | newsCountryIntelligence (7:00 UTC) — active |
| `DailyReportSchedule` | cron(0 12 * * ? *) | NewsProjectInvokeAgentLambda (12:00 UTC) |

---

## External APIs

| API | Used by | Purpose |
|-----|---------|---------|
| xAI Grok (`api.x.ai`) | newsInvokeGemini, NewsProjectInvokeAgentLambda, newsThreadAnalysis, newsCountryIntelligence, newsPairIntelligence, newsPostDevTo | Topic clustering + AI content generation |
| Brave Search (news + web) | newsInvokeGemini, newsThreadAnalysis, newsCountryIntelligence, newsPairIntelligence | News article search + grounding |
| Wikidata (SPARQL) | newsCountryFactsUpdater | Head of state/government data |
| ACLED API | newsCountryFactsUpdater | Active conflict data (approval pending) |
| Mapbox Geocoding | newsSensitiveData | Location name → lat/lng |
| Google Maps | WorldMap.jsx, WorldMapV2.jsx, WeeklyMap.jsx, CountryPage.jsx | Interactive map rendering |
| Paddle | newsStripeWebhook, newsSensitiveData | Billing + Customer Portal (MoR — handles VAT/JCT globally) — dormant in early access |
| Firebase Auth | AuthContext.jsx + newsSensitiveData + newsSavedItems | Passwordless sign-in + JWT verification |

---

## Frontend

**Stack:** React 19 + Vite, React Router v6, GitHub Pages
**Source:** `global-perspectives-starter/frontend/src/`
**Production:** `docs/` (served by GitHub Pages)

### Routes

Construction gate removed — all routes render real components in production. Auth routes show a preview/locked state for non-signed-in users with real public data visible for SEO.

| Path | Component | Access |
|------|-----------|--------|
| `/` | `Home.jsx` | Public |
| `/map` | `WorldMap.jsx` | Public |
| `/about` | `AboutContact.jsx` | Public |
| `/contact` | `Contact.jsx` | Public |
| `/privacy` | `PrivacyTerms.jsx` | Public |
| `/disclosures` | `Disclosures.jsx` | Public |
| `/whitepaper` | `WhitepaperPage.jsx` | Public |
| `/cli` | `CLIPage.jsx` | Public |
| `/signin` | `SignIn.jsx` | Public |
| `/auth/callback` | `AuthCallback.jsx` | Public |
| `/daily` | `DailyPage.jsx` | Public |
| `/daily/:dateKey` | `DailyPage.jsx` | Public |
| `/weekly` | `WeeklyPage.jsx` | Public |
| `/weekly/thread/:threadId` | `ThreadPage.jsx` | Public |
| `/weekly/countries` | `CountryListPage.jsx` | Public |
| `/weekly/country/:countryName` | `CountryPage.jsx` | Public |
| `/weekly-map` | `WeeklyMap.jsx` | Auth |
| `/intelligence-map` | `IntelligenceMap.jsx` | Public |
| `/map-v2` | `WorldMapV2.jsx` | Public (dev/preview) |
| `/test/briefing-card` | `BriefingCardTest.jsx` | Dev/preview only |
| `/account` | `Account.jsx` | Auth |
| `/upgrade/success` | `UpgradeSuccess.jsx` | Auth |

**Note:** `/pricing` route removed from routing and nav (Pricing.jsx kept in codebase). `/weekly/pairs` + `/weekly/pair/:slug` hidden 2026-04-23 (PairPage/PairListPage kept, backend active).

### Key Components

58 total components. Key ones:

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Nav shell with hamburger menu + maintenance overlay (active 2026-04-23) |
| `Home.jsx` | Daily topics, region grouping, AI toolbar |
| `WorldMap.jsx` | Google Maps with topic markers, geodesic polylines, side panel |
| `WorldMapV2.jsx` | Enhanced map with pair intelligence arc overlays (`/map-v2`) |
| `MapSidePanel.jsx` | Per-country topic cards with AI toolbar |
| `WeeklyPage.jsx` | Narrative threads grouped by region, trending section, filter bar |
| `WeeklyMap.jsx` | Thread-colored markers, date playback, thread sidebar |
| `ThreadPage.jsx` | Single thread deep-dive with AI intelligence |
| `CountryListPage.jsx` | Grid index of all countries with intelligence |
| `CountryPage.jsx` | Map-first country page: Google Map hero, AI tabs, story arcs, coverage |
| `DailyPage.jsx` | Daily Intelligence Brief display (`/daily`, `/daily/:dateKey`) |
| `PairListPage.jsx` | All country-pair analyses (hidden from nav/routes, component kept) |
| `PairPage.jsx` | Single pair deep-dive (hidden from nav/routes, component kept) |
| `StoryEntryCard.jsx` | Entry card with Summarize/Predict/Trace Cause toggle |
| `ThreadIntelligence.jsx` | Thread-level AI analysis display (storyArc, trajectory, etc.) |
| `BriefingCard.jsx` | Formatted intelligence briefing card |
| `BackgroundTimeline.jsx` | Historical timeline display for country/thread context |
| `SaveButton.jsx` | Heart bookmark button — saves threads/countries/dailies to account |
| `SignIn.jsx` | Firebase magic link + Google Sign-In form |
| `Account.jsx` | User account tabs: saved items + profile |
| `IntelligenceLoader.jsx` | Animated loading states (typewriter + explode variants) |
| `Pricing.jsx` | Subscription tiers (removed from routing, kept in codebase) |
| `TrialBanner.jsx` | Trial countdown banner (dormant until billing re-enabled) |

### Key Hooks

17 total hooks:

| Hook | Purpose |
|------|---------|
| `useGeminiTopics()` | Fetch daily topics; 1hr LocalStorage cache + 10min background poll |
| `useWeeklyArchive()` | Fetch `archive_range` (30 days, fully public in early access); 30min cache |
| `useThreadAnalyses(threadIds)` | Fetch thread-level AI analyses; 30min cache; no auth required |
| `useCountryIntelligence(countryNames)` | Fetch country-level AI intelligence; 30min cache; no auth required |
| `usePairAnalyses()` | Fetch all pair analyses list; 30min cache |
| `usePairIntelligence(pairSlug)` | Fetch single pair analysis; 30min cache |
| `useDailyBrief(dateKey)` | Fetch Daily Intelligence Brief for a date |
| `useSavedItems(itemType)` | Manage user bookmarks via newsSavedItems Lambda (JWT required) |
| `useUserProfile()` | Fetch `user_profile`; returns `{ tier, trialDaysLeft, isTrial }` |
| `useSummary(topicId)` | Fetch AI summary for a topic |
| `usePrediction(topicId)` | Fetch AI prediction for a topic |
| `useTraceCause(topicId)` | Fetch trace_cause deep context for a topic |
| `useTodayArchive()` | Fetch today's archive entries |
| `useArticles(topicId)` | Fetch article sources for a topic |
| `useCountrySignal(countryName)` | Country-level signal/metrics hook |
| `useBookmarks()` | Bookmark state management |
| `useIsMobile(breakpoint)` | Responsive breakpoint (default 600px) |

### Service Layer

```
restProxy.js
  proxyAction(action, payload)            ← no auth (public actions)
    └─ fetchTopicsCache()
    └─ fetchSummaryCache(topicId)
    └─ fetchPredictionCache(topicId)
    └─ fetchTraceCauseCache(topicId)
    └─ fetchTodayArchive()
    └─ fetchArchiveRange(days)            ← public in early access
    └─ fetchNarrativeThread(threadId)     ← public in early access
    └─ fetchThreadAnalyses(threadIds)     ← public in early access
    └─ fetchCountryIntelligence(names)    ← public in early access
    └─ fetchDailyBrief(dateKey)           ← public in early access
    └─ fetchPairAnalysis(slug)
    └─ fetchPairAnalysesList()
    └─ geocodeProxy(address)
    └─ fetchCountryPreview(countryName)   ← SEO public preview
    └─ fetchThreadPreview(threadId)       ← SEO public preview

  proxyActionWithAuth(action, payload)    ← Authorization: Bearer <firebase-id-token>
    └─ fetchUserProfile()
    └─ fetchPortalSession()

  savedItemsProxy (window.SAVED_ITEMS_ENDPOINT — separate Function URL)
    └─ saveItem(itemType, itemId, metadata)
    └─ unsaveItem(itemType, itemId)
    └─ fetchSavedItems(itemType)
```

### Caching Strategy

| Data | LocalStorage key | TTL |
|------|-----------------|-----|
| Daily topics | `gemini_topics_cache_v2` | 1 hour |
| Weekly archive | `gp_weekly_archive_v1` (keyed by user.uid) | 30 min |
| Thread analyses | keyed by user.uid + threadIds | 30 min |
| Country intelligence | keyed by user.uid + countryNames | 30 min |

### Narrative Threading

Stories are linked across days via `threadId`:
1. `continues_topic` field → inherit parent's `threadId`
2. Jaccard similarity (keywords + regions + category) against 7-day archive, threshold 0.4 → match existing thread
3. Neither → generate new `thread-{slug}-{hash}`

Weekly pages group topics by `threadId` to show how a story evolves across dates and geographies. `newsThreadAnalysis` runs daily to generate narrative-level AI analysis for top threads.

---

## Blog

Static HTML pages served from `docs/blog/` on GitHub Pages — no CMS, no build step.

**URL:** `globalperspective.net/blog/`

**Structure:**
```
docs/
  blog/
    index.html                              ← blog index (list of all posts)
    thread-and-country-intelligence/
      index.html                            ← post: Thread + Country Intelligence launch
```

**To add a new post:**
1. Create `docs/blog/<slug>/index.html` — copy the existing post as a template
2. Add an entry to `docs/blog/index.html` (the `<ul class="post-list">` section)
3. Commit and push — no build needed (static HTML, not part of the React app)

**Notes:**
- Blog uses its own standalone HTML/CSS — separate from the React app
- Logo image: `/logo_no_grey_bg.png` (served from `docs/` root)
- Internal app links use full URLs (`https://globalperspective.net/...`), not React Router `<Link>`
- Blog link is in the app footer (Layout.jsx) as a plain `<a href="/blog/">`
- Currently published via Claude — no self-serve CMS

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

# 3. NEVER overwrite docs/config.js (contains FIREBASE_CONFIG, SENSITIVE_PROXY_ENDPOINT, GOOGLE_MAPS_API_KEY)

# 4. Update CHANGES.md, then commit
cd ../..
git add docs/assets docs/index.html global-perspectives-starter/frontend/src/ CHANGES.md
git commit -m "Description of changes"
git push
```

**Backend (Lambda) changes:** Upload updated `index.js` as a deploy.zip via AWS Console, or `amplify push`. No build step needed for Lambda source edits.

---

## Key File Locations

| Purpose | Path |
|---------|------|
| This architecture doc | `ARCHITECTURE.md` |
| Claude instructions | `CLAUDE.md` |
| Change log | `CHANGES.md` |
| Lambda: news fetch + clustering | `amplify/backend/function/newsInvokeGemini/src/index.js` |
| Lambda: AI generation per topic | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` |
| Lambda: thread-level analysis | `amplify/backend/function/newsThreadAnalysis/src/index.js` |
| Lambda: country-level intelligence | `amplify/backend/function/newsCountryIntelligence/src/index.js` |
| Lambda: REST proxy | `amplify/backend/function/newsSensitiveData/src/index.js` |
| Lambda: social posting | `amplify/backend/function/newsPostLinkedIn/src/index.js` |
| Lambda: Dev.to posting | `amplify/backend/function/newsPostDevTo/src/index.js` |
| Lambda: Paddle webhooks | `amplify/backend/function/newsStripeWebhook/src/index.js` |
| Frontend source | `global-perspectives-starter/frontend/src/` |
| Production build | `docs/` |
| Runtime config | `docs/config.js` (sets `window.FIREBASE_CONFIG`, `window.SENSITIVE_PROXY_ENDPOINT`, Google Maps key) |
| Auth context | `global-perspectives-starter/frontend/src/contexts/AuthContext.jsx` |
| REST proxy service | `global-perspectives-starter/frontend/src/services/restProxy.js` |

---

## Common Mistakes to Avoid

1. **Pushing frontend source without building** — changes won't appear in production
2. **Overwriting `docs/config.js`** — it sets the Firebase config and API Gateway endpoint at runtime
3. **Referring to docs that mention Gemini or OpenAI** — the backend uses xAI Grok; older docs are outdated
4. **Reading old planning docs** — `HYBRID_NEWS_ARCHITECTURE.md`, `INTEGRATION_NOTES_Gemini_AppSync.md`, `NEWS_API_INTEGRATION_PLAN.md` are all pre-xAI and should be ignored
5. **Using `x-api-key` for auth** — gated endpoints now use `Authorization: Bearer <firebase-id-token>`, not static API keys
6. **Assuming archive keys are `YYYY-MM-DD`** — the actual DynamoDB key format is `archive#YYYY-MM-DD`
