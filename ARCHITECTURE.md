# Global Perspectives — Architecture Overview

**Last verified:** 2026-05-26

> **For the code-grounded, evidence-based wiring of frontend↔backend↔DDB, see [`SYSTEM_WIRING.md`](./SYSTEM_WIRING.md). For evidence-based optimization findings (incl. measured speedups), see [`OPTIMIZATION_REPORT.md`](./OPTIMIZATION_REPORT.md).**

Global Perspectives is an AI-powered global news aggregation platform. It fetches real news from RSS feeds and Brave Search, clusters articles into topics using DeepSeek V4, generates AI insights (summaries, predictions, root-cause analysis), and displays everything on an interactive world map and weekly narrative timeline.

**AI Provider (as of 2026-05-16):** All LLM calls migrated off xAI Grok (credits exhausted 2026-05-03). See `AI_PROVIDER_MIGRATION_PLAN.md` for full migration history. Env var names (`XAI_API_KEY`, `GROK_MODEL`, `GROK_API_URL`) are **legacy** — they hold DeepSeek/Gemini values in production. Always confirm the real provider with `aws lambda get-function-configuration`, never infer from the variable name.
- `newsInvokeGemini-dev`, `NewsProjectInvokeAgentLambda-dev`, `newsCountryIntelligence`, `newsPostDevTo`, `newsSystemsAnalysis`, `newsEconomicImpact` → **DeepSeek V4 Flash** (`deepseek-chat`, $0.14/M in · $0.28/M out)
- `newsThreadAnalysis`, `newsEconomicQuality` → **Gemini 2.5 Flash** (free tier, 13s pacing between calls, thinking disabled)
- `newsPairIntelligence` → **DeepSeek V4** (deployed env vars verified `deepseek-chat` / `api.deepseek.com` — its source default still reads Grok, and the migration plan's Phase 2 box was never checked, but the live function is on DeepSeek). Manual-invoke only.
- `newsMarketsData`, `newsCountryFactsUpdater`, `newsSavedItems`, `newsPostLinkedIn`, `linkedInAutoPost` → **no LLM** (data feeds or cached AI from DDB)

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
                    │  RSS Feeds (26) + Brave Search │
                    │  → DeepSeek V4 clusters topics │
                    │  → DynamoDB Topics[id=staging] │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  NewsProjectInvokeAgentLambda   │
                    │  Reads staging topics          │
                    │  → DeepSeek V4 generates:      │
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
                    │  → Gemini 2.5 Flash generates: │
                    │    threadTitle, storyArc,      │
                    │    trajectory, rootCauseChain, │
                    │    watchQuestions              │
                    │  → Writes THREAD# to SummaryDB │
                    └───────────────┬───────────────┘
                    ┌───────────────▼───────────────┐
                    │      newsCountryIntelligence    │
                    │  Daily batch (07:00 UTC)       │
                    │  Top 20 countries by articles  │
                    │  Uses thread analyses + Brave  │
                    │  → DeepSeek V4 generates:      │
                    │    headline, situationSummary, │
                    │    trajectory, riskSignals,    │
                    │    riskLevel                   │
                    │  → Writes COUNTRY# to SummaryDB│
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │    newsSystemsAnalysis         │
                    │  Daily batch (07:15 UTC)      │
                    │  Top N countries (test: 2)    │
                    │  Maps causal links between    │
                    │  story threads + confidence   │
                    │  → DeepSeek V4 generates:     │
                    │    nodes[], edges[], lagDays  │
                    │  → Writes SYSTEMS# to SummaryDB
                    └───────────────┬───────────────┘
                                    │
               ┌────────────────────▼────────────────────┐
               │              newsPostLinkedIn             │
               │  Reads latest + summaries               │
               │  → Posts to LinkedIn / Bluesky /        │
               │    Farcaster / Mastodon / Telegram      │
               │  → Deduplicates via SOCIAL_POSTS_TABLE  │
               └─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │         newsSensitiveData       │
                    │   API Gateway REST endpoint    │
                    │   ~27 actions — all content    │
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

## Tier System ⚠️ DEPRECATED

> **DEPRECATED as of 2026-05-26 — subscriptions/billing are not in use and are not planned to return.** The site is fully public; there is no paid tier, no checkout, and no active billing integration. The machinery below is documented for historical context and because dormant code/records still exist — treat it as **deprecated, not "coming soon."** Do not wire new features to tier gating, and do not spend effort "fixing" the billing path; favour removal over repair.

| Tier (legacy) | Intended access |
|------|--------|
| `free` | Public topics only (no auth required) |
| `member` | 7-day archive + thread/country intelligence |
| `enterprise` | 90-day archive + all features |

In practice **every visitor gets full access** — tier is display-only metadata and enforces nothing.

**Storage (legacy):** DynamoDB `USERS_TABLE`, keyed by Firebase UID (`uid`). Records may still carry `tier` / `paddleCustomerId` / `paddleSubscriptionId` fields from before deprecation.

**Lifecycle (deprecated):** `newsStripeWebhook` Lambda (handles Paddle) once mapped `subscription.created/updated/canceled` → tier changes. The webhook is no longer a maintained path (see Lambda #12).

**Enforcement:** None. All auth gates were removed from `newsSensitiveData` on 2026-04-11; `resolveUserTier` survives only behind the deprecated `user_profile` / `portal_session` actions. Archive, thread/country intelligence, narrative thread, economic, and daily-brief actions are all open with no JWT.

**Paddle Customer Portal (removed):** the `/account` billing UI and its `portal_session` call were deleted from the frontend on 2026-05-26. The backend `portal_session` action still exists (inert, `PADDLE_API_KEY` unset) pending backend teardown.

---

## Lambda Functions

### 1. `newsInvokeGemini`
**Path:** `amplify/backend/function/newsInvokeGemini/src/index.js`
**Trigger:** EventBridge Scheduler — `InvokeGoogleGemini` — `cron(0 */4 * * ? *)` (every 4 hours)

Despite the name, now uses **DeepSeek V4 Flash** (`deepseek-chat`) — no Gemini, no xAI.

**What it does:**
1. Fetches articles from:
   - **RSS feeds** (26): Global outlets (BBC, Al Jazeera, France24, SCMP, etc.) + climate (Inside Climate News, Grist) + tech (Ars Technica, MIT Tech Review)
   - **Brave Search** (10 dynamic queries): News + web search for regional outlets (Reuters, AP, Straits Times, Times of India, Korea Herald, Kyiv Independent, Latin America) + climate/energy, science, business/society
2. Filters articles older than 48 hours; deduplicates by URL
3. Checks soft-deduplication table (24hr window) to avoid re-covering the same story
4. Sends to DeepSeek V4 to cluster into topics with category diversity quota
5. Validates all URLs returned by the LLM against actually-fetched articles (hallucination filter)
6. Assigns `continues_topic` field by scanning 7 days of past archive
7. Writes to DynamoDB Topics table as `id=staging`

**Key env vars:**
| Variable | Notes |
|----------|-------|
| `XAI_API_KEY` | Required. **Legacy name** — actually holds DeepSeek key in production. |
| `GROK_API_URL` | **Legacy name** — actually points at `https://api.deepseek.com` in production. |
| `GROK_MODEL` | **Legacy name** — actually `deepseek-chat` in production. Source default `grok-4-1-fast-non-reasoning` is dead fallback. |
| `BRAVE_SEARCH_API_KEY` | Optional; falls back to RSS-only. |
| `BRAVE_CONCURRENCY` | Default `3`. Worker pool for parallel Brave queries (replaced 2s-sleep sequential loop 2026-05-18). |
| `TOPICS_DDB_TABLE` | Required. |
| `TOPICS_CACHE_ITEM_ID` | Default: `staging`. |
| `TOPICS_LIMIT` | AWS env var currently set to `13`. Code `DEFAULT_LIMIT=15` only applies if env var is unset. |

---

### 2. `NewsProjectInvokeAgentLambda`
**Path:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`
**Trigger:** EventBridge Scheduler — `InvokeNewsAgent` — `cron(5 */4 * * ? *)` (every 4 hours at :05, runs after newsInvokeGemini)

**What it does:**
1. Reads topics from `id=staging` in Topics table
2. For each topic, calls DeepSeek V4 (via native `fetch()`) to generate:
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
| `XAI_API_KEY` | Required. **Legacy name** — holds DeepSeek key. |
| `GROK_API_URL` | **Legacy name** — points at `https://api.deepseek.com/chat/completions` in production. |
| `GROK_MODEL` | **Legacy name** — `deepseek-chat` in production. |
| `TOPICS_DDB_TABLE` | Required. |
| `SUMMARIZE_PREDICT_TABLE` | Required. |
| `MAX_TOKENS` | Default: `600`. |
| `TEMPERATURE` | Default: `0.2`. |
| `TOP_P` | Default: `0.9`. |
| `LLM_CONCURRENCY` | Default `4`. Worker pool for concurrent per-topic LLM calls (replaced sequential loop 2026-05-18, 3.0× speedup). |
| **Memory / Timeout** | **512MB / 600s** (bumped from 128MB/445s on 2026-05-18 to eliminate 14% timeout failure rate). |

---

### 3. `newsThreadAnalysis`
**Path:** `amplify/backend/function/newsThreadAnalysis/src/index.js`
**Trigger:** EventBridge — `cron(30 6 * * ? *)` (6:30 UTC daily)

**What it does:**
1. Reads 30 days of archive entries from Topics table
2. Groups entries by `threadId`; selects top 10 threads with 2+ entries
3. For each thread, searches Brave News + Web for external grounding
4. Calls **Gemini 2.5 Flash** (13s pacing between calls for the free-tier RPM ceiling, thinking disabled, `MAX_TOKENS=6000`) to generate:
   - `threadTitle` — sharp 6-10 word journalistic title
   - `entryShortTitles` — micro-headline per entry (`{topicId, shortTitle}`)
   - `storyArc` — 2-3 paragraphs on how the story evolved
   - `trajectory` — 2 paragraphs on where it's heading (named scenarios + timeframes)
   - `rootCauseChain` — 3-layer root cause (immediate trigger → medium-term condition → structural factor)
   - `watchQuestions` — 3 specific, actionable watch questions
5. Skips threads where `entryCount` hasn't changed since last run
6. Writes to `SUMMARIZE_PREDICT_TABLE` at `THREAD#{threadId}` / `THREAD_ANALYSIS` (90-day TTL)

**Key env vars:** `XAI_API_KEY` (legacy name — holds **Gemini** key), `GROK_MODEL` (= `gemini-2.5-flash`), `GROK_API_URL` (= Gemini OpenAI-compat endpoint), `INTER_CALL_DELAY_MS` (= `13000`), `MAX_TOKENS` (= `6000`), `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`

> ⚠️ Gemini free tier caps at ~20 requests/day. Fine for one scheduled run (7-10 calls), but manual test invokes the same day can exhaust quota.

---

### 4. `newsCountryIntelligence`
**Path:** `amplify/backend/function/newsCountryIntelligence/src/index.js`
**Trigger:** EventBridge Scheduler — `countryIntelliegence` — `cron(0 7 * * ? *)` (daily 07:00 UTC; reduced from 3×/day on 2026-05-16 to cut cost after the DeepSeek migration)

**What it does:**
1. Reads 30 days of archive entries; groups by country (`regions` field)
2. Loads existing thread analyses for cross-thread enrichment
3. Selects top 20 countries with 2+ articles
4. For each country, searches Brave News for fresh context
5. Calls **DeepSeek V4** to generate:
   - `headline` — 8-12 word sharp situation headline
   - `situationSummary` — 2-3 paragraph intelligence briefing
   - `crossThreadInsight` — connections between story arcs
   - `trajectory` — 2 paragraphs with named scenarios + triggers
   - `riskSignals` — 3-4 specific, concrete watch events
   - `riskLevel` — `low` | `moderate` | `elevated` | `high`
6. Skips countries where `totalArticles` count hasn't changed
7. Writes to `SUMMARIZE_PREDICT_TABLE` at `COUNTRY#{countryName}` / `COUNTRY_INTELLIGENCE` (90-day TTL)

**Key env vars:** `XAI_API_KEY`, `GROK_MODEL`, `GROK_API_URL` (legacy names; hold DeepSeek values in production — see Lambda #1 notes), `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`, `LLM_CONCURRENCY` (default `4`; added 2026-05-18 — 5.8× speedup).

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
| `research_briefing` | None | `{ topicId }` | Returns cached RESEARCH_BRIEFING |
| `geocode` | None | `{ address }` | Mapbox lat/lng lookup |
| `today` | None | — | Today's archive entries |
| `rss` | None (GET) | — | RSS 2.0 XML feed of latest topics |
| `country_preview` | None | `{ countryName }` | Public SEO preview: headline, bluf, keyDevelopments, riskLevel, trajectory |
| `thread_preview` | None | `{ threadId }` | Public SEO preview: threadTitle, entryShortTitles |
| `archive_range` | None (early access) | `{ days }` | N days of archive (member=7, enterprise=90) |
| `narrative_thread` | None (early access) | `{ threadId }` | All entries for a thread across days |
| `thread_analysis` | None (early access) | `{ threadIds }` | Thread-level AI analyses |
| `country_intelligence` | None (early access) | `{ countryNames }` | Country-level AI intelligence |
| `country_history` | None (early access) | `{ countryName }` | Historical archive entries for a country |
| `systems_analysis` | None (early access) | `{ countryName }` | Causal graph (nodes/edges) for a country |
| `daily_brief` | None (early access) | `{ dateKey }` | Daily Intelligence Brief for a specific date |
| `pair_analysis` | None (early access) | `{ pair: "slug" }` | Bilateral relationship analysis for a country pair |
| `pair_analyses_list` | None (early access) | — | All pair analyses (DDB Scan, sorted list) |
| `economic_impact` | None (early access) | `{ threadId }` | Per-thread economic disruption analysis |
| `economic_impact_list` | None (early access) | — | All economic-impact records (DDB Scan) |
| `economic_top_movers` | None (early access) | — | Highest-magnitude economic-impact threads |
| `markets_global` | None (early access) | — | Global FX / rates / commodities / equities / crypto snapshot |
| `markets_country` | None (early access) | `{ countryName }` | Country macro snapshot (GDP, CPI, reserves, etc.) |
| `markets_history` | None (early access) | `{ symbol, days }` | Per-instrument price history `[{date, value}]` for sparklines — resolves `symbol` across commodities / rates / equities / crypto / FX (was FX-only before 2026-05-26) |
| `user_profile` | Firebase JWT | — | ⚠️ DEPRECATED (billing) — user tier + subscription info from USERS_TABLE |
| `portal_session` | Firebase JWT | — | ⚠️ DEPRECATED (billing) — Paddle Customer Portal session URL; no-op (PADDLE_API_KEY unset) |

**Early access:** All content actions are currently public (no auth required). When billing goes live, gated actions will require `Authorization: Bearer <firebase-id-token>`.

**CORS origins:** `benben05059997.github.io`, `globalperspective.net`, `www.globalperspective.net`, `localhost:5173`, `127.0.0.1:5173`

**Key env vars:**
| Variable | Notes |
|----------|-------|
| `TOPICS_DDB_TABLE` | Required |
| `SUMMARIZE_PREDICT_TABLE` | Required |
| `MARKETS_DDB_TABLE` | Required (markets actions; default `GlobalPerspectiveMarkets`) |
| `USERS_DDB_TABLE` | Required (for tier lookup) |
| `MAPBOX_GEOCODING_KEY` | Required |
| `FIREBASE_PROJECT_ID` | Required (JWT verification) |
| `PADDLE_API_KEY` | Portal sessions only — unset in deployed `newsSensitiveData-dev` while billing is dormant |
| `TOPICS_CACHE_MAX_AGE_SECONDS` | Default: `9000` |

---

### 6. `newsPostLinkedIn`
**Path:** `amplify/backend/function/newsPostLinkedIn/src/index.js`
**Trigger:** EventBridge Scheduler — `InvokeLinkedIn` — `cron(20 */3 * * ? *)` (every 3 hours at :20)

**What it does:**
1. Reads `latest` topics + AI summaries from DynamoDB
2. Generates platform-specific post copy per topic
3. Checks `SOCIAL_POSTS_TABLE` to skip already-posted topics
4. Posts to **LinkedIn + Bluesky** (the long-tail platforms — X/Twitter, Threads, Mastodon, Telegram, Farcaster — were cut 2026-05-18; `buildPlatformList()` now wires only these two)
5. Records each post with 30-day TTL

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `SOCIAL_POSTS_TABLE`, `MAX_POSTS_PER_RUN` (default: 5), `MAX_POSTS_PER_DAY` (default: 100)

---

### 7. `newsPostDevTo`
**Path:** `amplify/backend/function/newsPostDevTo/src/index.js`
**Trigger:** EventBridge Scheduler — `InvokeDev` — `cron(0 23 * * ? *)` (daily 23:00 UTC)

Posts a daily AI-written summary article to [Dev.to](https://dev.to).

**What it does:**
1. Reads `latest` topics from Topics Table
2. Calls OpenRouter AI (`AI_MODEL`, default `deepseek/deepseek-v4-flash:free`) to generate a long-form Dev.to article
3. Checks `SOCIAL_POSTS_TABLE` to skip if already posted today
4. Posts to Dev.to via API; records post with 90-day TTL

**Key env vars:** `DEVTO_API_KEY`, `OPENROUTER_API_KEY`, `AI_MODEL` (default `deepseek/deepseek-v4-flash:free`), `TOPICS_DDB_TABLE`, `SOCIAL_POSTS_TABLE`, `SITE_URL`

> **Note:** A deploy.zip is staged at `amplify/backend/function/newsPostDevTo/deploy.zip` — needs manual upload to AWS.

---

### 8. `newsPairIntelligence`
**Path:** `amplify/backend/function/newsPairIntelligence/src/index.js`
**Trigger:** Manual only — no EventBridge schedule. Invoke with `{"pair":["Country A","Country B"],"forceRegenerate":true}` or `{}` for default 10 pairs
**Deployed:** 2026-04-18

Bilateral relationship analysis between country pairs.

**What it does:**
1. Default run: analyzes 10 predefined pairs; manual run: single pair specified in payload
2. Reads 30-day archive; deduplicates events by Jaccard title similarity
3. Loads `country_facts.json` editorial layer + existing country intelligence + thread analyses
4. Calls the LLM to generate: `pairTitle`, `currentState`, `timeline`, `trajectory` (3 scenarios), `rootDriver` (3 layers), `predictions`, `watchItems`
5. Writes to `SUMMARIZE_PREDICT_TABLE` at `PAIR#{slug}` / `PAIR_ANALYSIS`

> **Provider note:** The source default still reads Grok and the migration plan's Phase 2 checkbox was never ticked, but the **deployed** function's env vars point at DeepSeek (`GROK_MODEL=deepseek-chat`, `GROK_API_URL=https://api.deepseek.com/chat/completions`, verified 2026-05-26). Manual-invoke only — not on any EventBridge schedule.

**Frontend:** none — the PairListPage/PairPage components and their `/weekly/pairs` + `/weekly/pair/:slug` routes were deleted in the "Cut: orphans" cleanup. The backend data + API actions remain; nothing renders them.
**API actions:** `pair_analysis` (single pair by slug) + `pair_analyses_list` (all pairs, DDB Scan) — still served, currently unconsumed by the UI

**Key env vars:** `XAI_API_KEY` / `GROK_MODEL` / `GROK_API_URL` (legacy names — deployed function holds **DeepSeek** values), `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `BRAVE_SEARCH_API_KEY`

---

### 9. `newsSystemsAnalysis`
**Path:** `amplify/backend/function/newsSystemsAnalysis/src/index.js`
**Trigger:** EventBridge Rule — `TriggerNewsSystemsAnalysis` — `cron(15 7 * * ? *)` (daily 07:15 UTC)
**Deployed:** 2026-04-25. IAM logging fixed 2026-04-27 (log group now exists). Phase 1: restricted to `SYSTEMS_TEST_COUNTRIES=Argentina,Iran`

Cross-domain causal relationship analysis. Maps how events across categories connect with time lags and confidence.

**What it does:**
1. Reads 30-day archive entries; groups by country
2. Identifies threads (2+ articles per threadId) per country; loads thread analyses
3. For each country: builds nodes from threads, calls **DeepSeek V4** with anti-hallucination prompt
4. The LLM returns nodes + edges. Validation: all IDs must be real, edges cite real topicIds, confidence calibrated
5. Dropped edges: unknown IDs, self-loops, 0 citations, confidence downgraded if citation count misses threshold
6. Writes to `SUMMARIZE_PREDICT_TABLE` at `SYSTEMS#{countryName}` / `SYSTEMS_ANALYSIS` (14-day TTL)

**Output shape:**
```json
{
  "nodes": [{"threadId", "category", "peakDate", "summary"}],
  "edges": [{"from", "to", "lagDays", "mechanism", "confidence", "citedEntries"}]
}
```

**Phase 1 (current):** Test countries only (`SYSTEMS_TEST_COUNTRIES=Argentina,Iran`). First run: Iran 15 nodes, 8 valid edges.

**Key env vars:** `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `XAI_API_KEY` / `GROK_MODEL` / `GROK_API_URL` (legacy names — hold **DeepSeek** values in production), `SYSTEMS_TOP_N` (default: 5), `SYSTEMS_TEST_COUNTRIES`

---

### 10. `linkedInAutoPost`
**Path:** `amplify/backend/function/linkedInAutoPost/src/index.js`
**Trigger:** EventBridge Scheduler — `LinkedinThreadsDaily` — `cron(30 7/12 * * ? *)` (every 12 hours: 07:30, 19:30 UTC)

Intelligent scheduled LinkedIn poster — distinct from `newsPostLinkedIn` (manual/multi-platform).

**What it does:**
1. Scans `SUMMARIZE_PREDICT_TABLE` for thread analyses (`THREAD_ANALYSIS`) and country intelligence (`COUNTRY_INTELLIGENCE`)
2. Scores items by trend (rising/stable/fading) and risk level (critical/elevated/moderate/low)
3. Deduplicates against `SOCIAL_POSTS_TABLE`
4. Posts highest-scoring eligible item to LinkedIn; records with TTL

**Key env vars:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `SUMMARIZE_PREDICT_TABLE`, `SOCIAL_POSTS_TABLE`

---

### 11. `newsCountryFactsUpdater`
**Path:** `amplify/backend/function/newsCountryFactsUpdater/src/index.js`
**Trigger:** EventBridge Scheduler — `Fact` — `cron(0 5 * * ? *)` (daily 05:00 UTC)
**Deployed:** 2026-04-18 (Phase 2 complete)

Keeps country facts in DynamoDB current without manual editing.

**What it does:**
1. Fetches head-of-state/government data from **Wikidata** via SPARQL query
2. Fetches active conflicts from **ACLED API** (approval pending)
3. Detects leadership changes vs. previously stored facts
4. Stores results in `SUMMARIZE_PREDICT_TABLE` at `FACTS#{countryName}` / `COUNTRY_FACTS` (90-day TTL)
5. Supports partial updates for specific countries via payload

**DDB key:** `FACTS#{countryName}` / `COUNTRY_FACTS`
**Key env vars:** `SUMMARIZE_PREDICT_TABLE`, `ACLED_USERNAME` + `ACLED_PASSWORD` (OAuth token flow against `acleddata.com/oauth/token` — there is **no** `ACLED_API_KEY`)

---

### 12. `newsStripeWebhook` (name is legacy — handled Paddle) ⚠️ DEPRECATED
**Path:** `amplify/backend/function/newsStripeWebhook/src/index.js`
**Trigger:** Paddle webhook (separate API Gateway endpoint)

> **DEPRECATED 2026-05-26 — billing is not in use.** This Lambda once kept `USERS_TABLE` tiers in sync with Paddle subscription events (`subscription.created/updated/canceled`, HMAC-SHA256 of `${ts}:${rawBody}` with `PADDLE_WEBHOOK_SECRET`, UID via `data.custom_data.uid`). It is **no longer a maintained path.** It is also broken as deployed — the code reads `PADDLE_WEBHOOK_SECRET` but the live function only has stale `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` vars, so every signature check fails. Since subscriptions are deprecated this is **not a bug to fix** — it's a removal candidate. Do not build on it.

---

### 13. `newsMarketsData`
**Path:** `amplify/backend/function/newsMarketsData/src/index.js`
**Triggers:** EventBridge Rules — `MarketsDataHourly` (`rate(1 hour)`), `MarketsYieldsDaily` (`cron(0 6 ? * MON-FRI *)`), `MarketsMacrosWeekly` (`cron(0 2 ? * SUN *)`)

Free economic-data ingest — **no LLM**, all free feeds.

**What it does:**
1. **FX** — Frankfurter (ECB rates, no key), hourly
2. **Bond yields** — FRED (free key), daily on weekdays
3. **Commodities + equities + crypto** — Stooq CSV (15-min delayed, no key) / CoinGecko / Yahoo (VIX), hourly. Priced universe (~51 instruments, the spine behind `/economy` — see `ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`): commodities (Brent, WTI, gold, copper, DXY, VIX, **natural gas**), bond yields, equity indices + Russell 2000 (**IWM** proxy; Stooq lacks `^rut`), the **full 11 GICS sector SPDR ETFs** + thematic ETFs (defense/semis/gold-miners/**agriculture DBA**/**rare-earths REMX**), and BTC/ETH. (SILVER intentionally excluded — `si.f` returns an implausible value.)
4. **Country macros** — World Bank (no key), weekly
5. Writes `LATEST` rows plus dated `HISTORY#` rows (for sparklines) to `MARKETS_DDB_TABLE`

**Payload:** `{}` runs all sources appropriate for the time; `{ "source": "fx" | "yields" | "macros" | "commodities" | "equities" | "crypto" }` runs one; `{ "source": "seed_history" }` is a **one-time** backfill that downloads ~30 days of daily closes per instrument from **Yahoo Finance** (`chart?interval=1d&range=2mo`, sequential/throttled — Yahoo rate-limits bursts) and writes the past `HISTORY#YYYY-MM-DD` rows (35-day TTL, only dates < today, skips existing rows). Needed because Stooq's history CSV is now API-key-gated; the daily cron still appends today's row from the Stooq LATEST quote, and TTL keeps the window at ~30 days. This is what powers the `/economy` sparklines + Key-levels.

**Key env vars:** `MARKETS_DDB_TABLE` (default `GlobalPerspectiveMarkets`), `FRED_API_KEY`

---

### 14. `newsEconomicImpact`
**Path:** `amplify/backend/function/newsEconomicImpact/src/index.js`
**Trigger:** EventBridge Rule — `TriggerNewsEconomicImpact` — `cron(30 7 * * ? *)` (daily 07:30 UTC, after thread analysis)

Per-thread economic disruption analysis — the "Economic Disruption Layer." Uses **DeepSeek V4**.

**What it does:**
1. Reads 30 days of archive + each thread's `THREAD_ANALYSIS` and topic `SUMMARY` records
2. For threads with an economic dimension, calls DeepSeek with a **closed instrument allowlist** (commodities incl. natural gas, rates, equity indices, GICS sector + thematic ETFs incl. agriculture/rare-earths, crypto; any unknown ticker → dropped), presented as a live-priced menu via `buildInstrumentTable`, plus a curated `economic_analogs.json` catalog of real past events with realized moves (the model picks the closest by mechanism; the frontend shows the analog's *actual* past move, never a forecast)
3. Output is qualitative only — `direction` (up/down/mixed), `magnitude` (small/moderate/large), **never a fabricated %**; every claim must cite real `topicId`s (uncited claims dropped post-parse)
4. Snapshots **actual** prices from `MARKETS_DDB_TABLE` (compute, don't generate)
5. Writes tombstone records `{ hasImpact: false }` for threads with no economic dimension
6. Writes to `SUMMARIZE_PREDICT_TABLE` at `ECON#THREAD#{threadId}` / `ECONOMIC_IMPACT` (21-day TTL)

**Key env vars:** `XAI_API_KEY` / `GROK_MODEL` / `GROK_API_URL` (legacy names — hold **DeepSeek** values), `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `MARKETS_DDB_TABLE`, `LLM_CONCURRENCY` (default `4`), `ECON_MIN_ENTRIES` (default `2`), `ECON_MAX_THREADS` (default `15`)

---

### 15. `newsEconomicQuality`
**Path:** `amplify/backend/function/newsEconomicQuality/src/index.js`
**Trigger:** EventBridge Rule — `TriggerNewsEconomicQuality` — `cron(0 8 * * ? *)` (daily 08:00 UTC, after economic impact; aligned with Gemini quota reset)

LLM-as-judge quality gate for economic-impact records. Deliberately a **different model family** from the producer (DeepSeek produces, **Gemini 2.5 Flash** judges) so judge errors are less correlated with producer errors.

**What it does:**
1. Scans recent `ECON#THREAD#` records (`hasImpact: true`, not judged in last 7 days)
2. Builds a judge prompt, calls Gemini, parses 5-axis scores: `coherence`, `citation_fidelity`, `analog_match`, `severity_calibration`, `no_bs`
3. Flags the record `is_low_quality: true` if any axis ≤ 2
4. Writes `qualityScores` + `is_low_quality` + `quality_judged_at` back to the record

**Key env vars:** `XAI_API_KEY` (legacy name — holds **Gemini** key), `GROK_MODEL` (= `gemini-2.5-flash`), `GROK_API_URL` (= Gemini OpenAI-compat endpoint), `INTER_CALL_DELAY_MS` (= `13000`), `MAX_TOKENS` (= `16000`, large because Gemini thinking tokens count against the cap), `QUALITY_MAX_RECORDS` (default `15`), `QUALITY_RECENT_DAYS` (default `7`), `SUMMARIZE_PREDICT_TABLE`

---

### 16. `newsSavedItems`
**Path:** `amplify/backend/function/newsSavedItems/src/index.js`
**Trigger:** User-triggered — Lambda Function URL (`window.SAVED_ITEMS_ENDPOINT`) or AppSync resolver (auto-detected). **No LLM.**

Per-user save/bookmark store.

**What it does:**
1. Verifies a **Firebase JWT** (lightweight Node `crypto` + Google certs — no firebase-admin) on every action
2. Actions: `save_item`, `unsave_item`, `get_saved_items`
3. Item types allowed: `thread`, `country`, `daily`, `pair`. Caps: 500 items/user, 4KB metadata/item

**DDB:** `SAVED_ITEMS_TABLE` — **PK** `uid`, **SK** `savedKey` (= `{itemType}#{itemId}`)

**Key env vars:** `SAVED_ITEMS_TABLE`, `FIREBASE_PROJECT_ID`

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
| `SYSTEMS#{countryName}` | `SYSTEMS_ANALYSIS` | newsSystemsAnalysis | nodes[], edges[] with causal graph, confidence levels, citations (14-day TTL) |
| `DAILY_BRIEF#{dateKey}` | `DAILY_BRIEF` | newsPostDevTo | Full daily intelligence brief text (90-day TTL) |
| `FACTS#{countryName}` | `COUNTRY_FACTS` | newsCountryFactsUpdater | Head of state/govt (Wikidata), active conflicts (ACLED), leadership change detection (90-day TTL) |
| `ECON#THREAD#{threadId}` | `ECONOMIC_IMPACT` | newsEconomicImpact | direction, magnitude, instruments, analog, marketSnapshot, citations; quality scores added by newsEconomicQuality (21-day TTL) |
| `TOPIC#{topicId}` | `RESEARCH_BRIEFING` | NewsProjectInvokeAgentLambda | Research briefing (first pass of two-pass prediction) |

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
**PK:** `topicId` + `platform`. Deduplication table for LinkedIn/Bluesky/Dev.to posts. TTL: 30 days (90 days for Dev.to).

---

### Markets Table (`MARKETS_DDB_TABLE`, default `GlobalPerspectiveMarkets`, ap-northeast-1)
**PK:** `pk` / **SK:** `sk`. Written by `newsMarketsData`, read by `newsSensitiveData`.

| pk | sk | Contents |
|----|-----|---------|
| `FX#USD` | `LATEST` / `HISTORY#YYYY-MM-DD` | USD-base FX rates |
| `RATES#GLOBAL` | `LATEST` | US/UK/DE/JP bond yields |
| `COMMODITIES#GLOBAL` | `LATEST` | Brent, WTI, gold, copper, VIX, DXY |
| `EQUITIES#GLOBAL` | `LATEST` / `HISTORY#YYYY-MM-DD` | Indices + sector ETFs |
| `CRYPTO#GLOBAL` | `LATEST` / `HISTORY#YYYY-MM-DD` | BTC, ETH + 24h change |
| `MACRO#{country}` | `LATEST` / `HISTORY#YYYY-Q#` | GDP, CPI, reserves, debt/GDP, current account, unemployment |

All rows carry `asOf` timestamps + TTL. Honesty contract: never display stale data without labeling it.

---

### Saved Items Table (`SAVED_ITEMS_TABLE`, default `GlobalPerspectiveSavedItems`)
**PK:** `uid` (Firebase UID) / **SK:** `savedKey` (= `{itemType}#{itemId}`). Written/read by `newsSavedItems`. Item types: `thread`, `country`, `daily`, `pair`.

---

## Cloudflare Workers

Domain is registered and DNS-managed in Cloudflare. Orange cloud (proxy) is enabled — all traffic flows through Cloudflare before reaching GitHub Pages.

### Worker: `globalperspective-rss`

**Routes:** `globalperspective.net/*` and `globalperspective.net/rss*`

**Full source:** `WORKER_FULL_CODE.md`

The Worker handles these cases:

| Path | Visitor type | What happens |
|------|-------------|--------------|
| `/rss` | Anyone | Proxied to `newsSensitiveData ?action=rss`, returns RSS 2.0 XML, 30 min edge cache |
| `/weekly/country/:name` | Bot (24 patterns) | POSTs `country_preview` to Lambda, returns pre-rendered HTML with OG tags |
| `/weekly/thread/:id` | Bot (24 patterns) | POSTs `thread_preview` to Lambda, returns pre-rendered HTML with OG tags |
| `/daily` and `/daily/:dateKey` | Bot (24 patterns) | POSTs `daily_brief` to Lambda (with 7-day fallback lookback), returns pre-rendered HTML with OG tags |
| Everything else | Anyone | Passed through to GitHub Pages unchanged |

**Bot patterns detected:** Twitterbot, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Googlebot, Bingbot, and 13 others (24 total in `BOT_PATTERNS`).

**Why this matters:**
- Social shares of country/thread pages show rich previews (real headline, description, image) instead of blank cards
- AI crawlers (ChatGPT, Perplexity, Claude, Google) can read and cite page content — previously invisible due to React SPA empty shell
- Human visitors always get the full React app unchanged

**Key implementation detail:** The preview actions (`country_preview`, `thread_preview`, `daily_brief`) require POST with JSON body (`{ action, payload }`). The Lambda's `payload` field is only populated from POST body, not GET query params.

---

## Scheduling — EventBridge Rules + Scheduler (VERIFIED via AWS CLI 2026-05-26)

Most schedules use **EventBridge Scheduler** (separate service from EventBridge Rules). Several use EventBridge Rules. All times UTC.

### EventBridge Rules
| Rule name | Schedule | Target |
|-----------|----------|--------|
| `TriggerDailyAnalysis` | `cron(30 6 * * ? *)` | newsThreadAnalysis (06:30 UTC daily) |
| `TriggerNewsSystemsAnalysis` | `cron(15 7 * * ? *)` | newsSystemsAnalysis (07:15 UTC daily) |
| `TriggerNewsEconomicImpact` | `cron(30 7 * * ? *)` | newsEconomicImpact (07:30 UTC daily) |
| `TriggerNewsEconomicQuality` | `cron(0 8 * * ? *)` | newsEconomicQuality (08:00 UTC daily) |
| `MarketsDataHourly` | `rate(1 hour)` | newsMarketsData |
| `MarketsYieldsDaily` | `cron(0 6 ? * MON-FRI *)` | newsMarketsData |
| `MarketsMacrosWeekly` | `cron(0 2 ? * SUN *)` | newsMarketsData |

### EventBridge Scheduler
| Schedule name | Cron | Target |
|---------------|------|--------|
| `InvokeGoogleGemini` | `cron(0 */4 * * ? *)` | newsInvokeGemini-dev (every 4h) |
| `InvokeNewsAgent` | `cron(5 */4 * * ? *)` | NewsProjectInvokeAgentLambda-dev (every 4h at :05) |
| `countryIntelliegence` | `cron(0 7 * * ? *)` | newsCountryIntelligence (daily 07:00 UTC) |
| `InvokeLinkedIn` | `cron(20 */3 * * ? *)` | newsPostLinkedin (every 3h at :20) |
| `LinkedinThreadsDaily` | `cron(30 7/12 * * ? *)` | linkedInAutoPost (07:30 / 19:30 UTC) |
| `InvokeDev` | `cron(0 23 * * ? *)` | newsPostDevTo (23:00 UTC daily) |
| `Fact` | `cron(0 5 * * ? *)` | newsCountryFactsUpdater (05:00 UTC daily) |

> The every-2h pipeline cadence and 3×/day country-intelligence schedule were both reduced on 2026-05-16 alongside the DeepSeek migration to control cost.

### No schedule (manual only)
- `newsPairIntelligence` — invoke manually or via ad-hoc AWS CLI call
- `newsStripeWebhook` — event-driven (Paddle webhook via API Gateway)
- `newsSensitiveData` / `newsSavedItems` — user-triggered via REST

---

## External APIs

| API | Used by | Purpose |
|-----|---------|---------|
| DeepSeek V4 (`api.deepseek.com`) | newsInvokeGemini, NewsProjectInvokeAgentLambda, newsCountryIntelligence, newsSystemsAnalysis, newsEconomicImpact, newsPairIntelligence, newsPostDevTo | Topic clustering + AI content generation |
| Gemini 2.5 Flash (OpenAI-compat endpoint) | newsThreadAnalysis, newsEconomicQuality | Editorial analysis + LLM-as-judge (free tier, 13s pacing) |
| Brave Search (news + web) | newsInvokeGemini, newsThreadAnalysis, newsCountryIntelligence, newsPairIntelligence | News article search + grounding |
| Frankfurter / FRED / Stooq / World Bank / CoinGecko | newsMarketsData | Free FX, bond yields, commodities, equities, macros, crypto |
| Wikidata (SPARQL) | newsCountryFactsUpdater | Head of state/government data |
| ACLED API | newsCountryFactsUpdater | Active conflict data (approval pending) |
| Mapbox Geocoding | newsSensitiveData | Location name → lat/lng |
| Google Maps | WeeklyMap.jsx (embedded by CountryPage), WorldMap.jsx (legacy, unrouted) | Interactive map rendering. **Note:** WorldMapV2 (`/map`) uses **d3 + topojson**, not Google Maps |
| Paddle | newsStripeWebhook, newsSensitiveData | ⚠️ DEPRECATED 2026-05-26 — billing + Customer Portal no longer in use |
| Firebase Auth | AuthContext.jsx + newsSensitiveData + newsSavedItems | Passwordless sign-in + JWT verification |

---

## Frontend

**Stack:** React 19 + Vite, React Router v6, GitHub Pages
**Source:** `global-perspectives-starter/frontend/src/`
**Production:** `docs/` (served by GitHub Pages)

### Routes

Construction gate removed — all routes render real components in production. Auth routes show a preview/locked state for non-signed-in users with real public data visible for SEO.

Wired in `<Routes>` in `App.jsx` (verified 2026-05-26) — 17 routes incl. catch-all. Content is fully public in early-access mode.

| Path | Component | Access |
|------|-----------|--------|
| `/` | `Home.jsx` | Public |
| `/map` | `WorldMapV2.jsx` | Public |
| `/about` | `AboutContact.jsx` | Public |
| `/contact` | `Contact.jsx` | Public |
| `/privacy` | `PrivacyTerms.jsx` | Public |
| `/disclosures` | `Disclosures.jsx` | Public |
| `/whitepaper` | `WhitepaperPage.jsx` | Public |
| `/daily` | `DailyPage.jsx` | Public |
| `/daily/:dateKey` | `DailyPage.jsx` | Public |
| `/economy` | `EconomyPage.jsx` | Public |
| `/weekly` | `WeeklyPage.jsx` | Public |
| `/weekly/thread/:threadId` | `ThreadPage.jsx` | Public |
| `/weekly/countries` | `CountryListPage.jsx` | Public |
| `/weekly/country/:countryName` | `CountryPage.jsx` | Public |
| `/signin` | `SignIn.jsx` | Public |
| `/auth/callback` | `AuthCallback.jsx` | Public |
| `/account` | `Account.jsx` | Auth |
| `*` | `NotFound` (inline in App.jsx) | Public catch-all (404) |

**Removed/never-wired:** a "Cut: orphans" cleanup deleted several components and routes, and the 2026-05-26 subscription deprecation removed billing UI. The following are **no longer routed and the component files no longer exist**: `/cli` (CLIPage), `/intelligence-map` (IntelligenceMap), `/test/briefing-card` (BriefingCardTest), `/pricing` (Pricing), `/weekly/pairs` + `/weekly/pair/:slug` (PairPage/PairListPage), `/upgrade/success` (UpgradeSuccess — billing). Also deleted in the billing cleanup: `TrialBanner.jsx`, `WeeklyLockedPreview.jsx`, `useUserProfile.js`. `WorldMap.jsx` and `WeeklyMap.jsx` still exist as files but are **not routed** (`/map` uses WorldMapV2; there is no `/weekly-map` or `/map-v2` route).

### Key Components

63 total component files (50 in `src/components/` + 13 in `src/components/atoms/`) after the 2026-05-26 billing cleanup. Key ones:

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Nav shell with hamburger menu |
| `Home.jsx` | 3-col EditorialShell: StatusStrip + region-grouped daily topics with per-topic AI toolbar (Summarize/Predict/Trace Cause) + per-topic economic-disruption badge ("Economic impact →" when a thread has a disruption); `TodayArchiveSidebar` + `TopicNav` rails |
| `WorldMapV2.jsx` | The live map at `/map` — stacked layer lenses, arc overlays, "Today's pulse" |
| `WorldMap.jsx` | Legacy Google Maps view — file kept, no longer routed |
| `EconomyPage.jsx` | `/economy` — the markets-meets-news command center, **rebuilt 2026-05-27 to match the editorial mockup** (own masthead band + 3-col shell, no longer `EditorialShell`; full-bleed via a `:has(.ep-page)` container escape, sticky rails offset by `--nav-h + --strip-h`). **Two-layer model** (see `ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`): the right-rail **Market Context** is a *standing dashboard* — live levels for the full universe (Equities / Sectors / Commodities / Ags&Materials / Risk / Rates / Crypto via `useMarketsGlobal`), shown always, AI-independent. The center **leaderboard** ("Repricing today") is the *news-cited subset* (`useTopMovers` — consensus + direction-split + live level per instrument; **expand** → price sparkline (`useMarketsHistory`) + Key-levels box + a 5-col driving-stories sub-table [Severity · Story → thread Economy tab · Direction · Mechanism (per-instrument rationale) · Closest analog] + affected-country chips), then a dormant-instruments drawer + a severity-grouped by-story "Active disruptions" bridge. Left rail facets (severity / horizon / country). All real data — **honest degradation** where data is absent (no fabricated % change, severity bars, ISO codes, or analog %). |
| `MapSidePanel.jsx` | Per-country topic cards with AI toolbar |
| `WeeklyPage.jsx` | 3-col EditorialShell: narrative threads grouped **by category** in the feed (region is a left-rail filter), StatusStrip, left rail (search/period/sort/region/view-toggle), right rail "Rising This Week"; lazy-loaded `WeeklyMap` view mode |
| `WeeklyMap.jsx` | Thread-colored markers, date playback, thread sidebar |
| `ThreadPage.jsx` | 3-col EditorialShell thread deep-dive: StatusStrip, "Arc Intelligence" AI rail (tabs + key actors + grounding sources), 4-stat row, content tabs Timeline/Actors/Sources/**Economy** (economic disruption via `useEconomicImpact` + `MechanismCard`/`DisruptionPreview`) |
| `CountryListPage.jsx` | Grid index of all countries with intelligence |
| `CountryPage.jsx` | Map-first country page: Google Map hero, AI tabs, story arcs, coverage |
| `DailyPage.jsx` | Daily Intelligence Brief display (`/daily`, `/daily/:dateKey`) + an `EconomicFootprint` section aggregating top instruments from `useDisruptionsList` |
| `StoryEntryCard.jsx` | Entry card with Summarize/Predict/Trace Cause toggle |
| `ThreadIntelligence.jsx` | Thread-level AI analysis display (storyArc, trajectory, etc.) |
| `BriefingCard.jsx` | Formatted intelligence briefing card |
| `BackgroundTimeline.jsx` | Historical timeline display for country/thread context |
| `SaveButton.jsx` | Heart bookmark button — saves threads/countries/dailies to account |
| `SignIn.jsx` | Firebase sign-in form — magic link + Google + **guest/anonymous** (`signInAsGuest`, "Continue as guest") |
| `Account.jsx` | User account tabs: saved items + profile |
| `IntelligenceLoader.jsx` | Animated loading states (typewriter + explode variants) |

### Key Hooks

24 total hooks (in `src/hooks/`):

| Hook | Purpose |
|------|---------|
| `useGeminiTopics()` | Fetch daily topics; 1hr LocalStorage cache + 10min background poll |
| `useWeeklyArchive()` | Fetch `archive_range` (30 days, fully public in early access); 30min cache |
| `useThreadAnalyses(threadIds)` | Fetch thread-level AI analyses; 30min cache; no auth required |
| `useCountryIntelligence(countryNames)` | Fetch country-level AI intelligence; 30min cache; no auth required |
| `useCountryHistory(countryName)` | Fetch historical archive entries for a country |
| `useSystemsAnalysis(countryName)` | Fetch causal-graph (nodes/edges) for a country |
| `usePairAnalyses()` | Fetch all pair analyses list; 30min cache |
| `useDailyBrief(dateKey)` | Fetch Daily Intelligence Brief for a date |
| `useEconomicImpact(threadId)` | Fetch per-thread economic disruption analysis |
| `useDisruptionsList()` | Fetch all economic-impact records (powers `/economy`, Home topic badges, DailyPage footprint, CountryPage, WorldMapV2, CountryListPage) |
| `useMarketsHistory(symbol)` | Fetch per-instrument price history `[{date,value}]` for `/economy` sparklines; session-cached |
| `useTopMovers()` | Fetch highest-magnitude economic-impact threads |
| `useMarketsGlobal()` | Fetch global FX/rates/commodities/equities/crypto snapshot |
| `useMarketsCountry(countryName)` | Fetch country macro snapshot |
| `useResearchBriefing(topicId)` | Fetch cached research briefing |
| `useSavedItems(itemType)` | Manage user bookmarks via newsSavedItems Lambda (JWT required) |
| `useSummary(topicId)` | Fetch AI summary for a topic |
| `usePrediction(topicId)` | Fetch AI prediction for a topic |
| `useTraceCause(topicId)` | Fetch trace_cause deep context for a topic |
| `useTodayArchive()` | Fetch today's archive entries |
| `useArticles(topicId)` | Fetch article sources for a topic |
| `useCountrySignal(countryName)` | Country-level signal/metrics hook |
| `useBookmarks()` | Bookmark state management |
| `useIsMobile(breakpoint)` | Responsive breakpoint (default 600px) |

> Note: there is **no** `usePairIntelligence` hook — single-pair data is fetched via `restProxy.fetchPairAnalysis(slug)` directly.

### Service Layer

Two modules: `restProxy.js` (the actual transport) and `utils/contentService.js` (a thin wrapper over restProxy that adds normalization/sentence-trimming for topic content — **renamed 2026-05-26 from the misleading `graphqlService.js`; there is no GraphQL**). The topic AI hooks (`useGeminiTopics`, `useSummary`, `usePrediction`, `useTraceCause`, `useTodayArchive`) and `Home`/`MapSidePanel` call through `contentService`; everything else calls `restProxy` directly.

```
restProxy.js
  configureProxy() / setAuthProvider(getIdToken)   ← wired by AuthBridge on mount
  proxyAction(action, payload)            ← no auth (public actions)
    └─ fetchTopicsCache()
    └─ fetchSummaryCache(topicId)
    └─ fetchPredictionCache(topicId)
    └─ fetchTraceCauseCache(topicId)
    └─ fetchResearchBriefingCache(topicId)
    └─ fetchTodayArchive()
    └─ fetchArchiveRange(days)            ← public in early access
    └─ fetchNarrativeThread(threadId)     ← public in early access
    └─ fetchThreadAnalyses(threadIds)     ← public in early access
    └─ fetchCountryIntelligence(names)    ← public in early access
    └─ fetchCountryHistory(countryName)   ← public in early access
    └─ fetchSystemsAnalysis(countryName)  ← public in early access
    └─ fetchDailyBrief(dateKey)           ← public in early access
    └─ fetchPairAnalysis(slug)
    └─ fetchPairAnalysesList()
    └─ fetchEconomicImpact(threadId)      ← economic_impact
    └─ fetchDisruptionsList()             ← economic_impact_list
    └─ fetchTopMovers()                   ← economic_top_movers
    └─ fetchMarketsGlobal()
    └─ fetchMarketsCountry(countryName)
    └─ fetchMarketsHistory(key)
    └─ geocodeProxy(address)
    └─ fetchCountryPreview(countryName)   ← SEO public preview
    └─ fetchThreadPreview(threadId)       ← SEO public preview

  proxyActionWithAuth(action, payload)    ← attaches Bearer token if signed in; backend no longer requires it
    └─ (used internally by the archive/thread/country/daily helpers above; the billing
        helpers fetchUserProfile/fetchPortalSession were removed in the 2026-05-26 cleanup)

  savedItemsProxy (window.SAVED_ITEMS_ENDPOINT — separate Function URL)
    └─ saveItem(itemType, itemId, metadata)
    └─ unsaveItem(itemType, itemId)
    └─ fetchSavedItems(itemType)
```

### Caching Strategy

| Data | LocalStorage key | TTL |
|------|-----------------|-----|
| Daily topics | `gemini_topics_cache_v2` | 1 hour |
| Weekly archive | `gp_weekly_archive_v1` | 30 min |
| Thread analyses | `gp_thread_analyses_v2` | 30 min |
| Country intelligence | `gp_country_intel_v1` | 30 min |

> The cache keys are plain (not user-scoped) since all content is public in early-access mode.

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
| Lambda: causal graph analysis | `amplify/backend/function/newsSystemsAnalysis/src/index.js` |
| Lambda: economic disruption | `amplify/backend/function/newsEconomicImpact/src/index.js` |
| Lambda: economic quality judge | `amplify/backend/function/newsEconomicQuality/src/index.js` |
| Lambda: markets data ingest | `amplify/backend/function/newsMarketsData/src/index.js` |
| Lambda: save/bookmark | `amplify/backend/function/newsSavedItems/src/index.js` |
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
3. **Inferring the AI provider from env var names** — `XAI_API_KEY` / `GROK_MODEL` / `GROK_API_URL` are legacy names that hold **DeepSeek** (or **Gemini**) values in production. Confirm with `aws lambda get-function-configuration`.
4. **Reading old planning docs** — `HYBRID_NEWS_ARCHITECTURE.md`, `INTEGRATION_NOTES_Gemini_AppSync.md`, `NEWS_API_INTEGRATION_PLAN.md` are all outdated and should be ignored
5. **Using `x-api-key` for auth** — gated endpoints now use `Authorization: Bearer <firebase-id-token>`, not static API keys
6. **Assuming archive keys are `YYYY-MM-DD`** — the actual DynamoDB key format is `archive#YYYY-MM-DD`
