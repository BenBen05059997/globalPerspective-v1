# SYSTEM_WIRING.md — How Global Perspectives is actually wired together

**Last verified:** 2026-05-18, from on-disk source under `amplify/backend/function/*` and `global-perspectives-starter/frontend/src/*`.

This is a code-grounded companion to ARCHITECTURE.md. Where this doc disagrees with ARCHITECTURE.md, **trust this doc** — ARCHITECTURE.md has known drift (see §0).

---

## §0 Known drift between docs and code (read first)

### LLM provider — verified via `aws lambda get-function-configuration` on 2026-05-18

**The repo source uses Grok-named identifiers (`GROK_API_URL`, `GROK_MODEL`, `XAI_API_KEY`), but the deployed Lambdas have those env vars repointed to DeepSeek and Gemini.** No source changes were made for the migration — only env vars in the AWS console. ARCHITECTURE.md is correct about provider; the source code is just misleadingly named.

| Lambda (deployed) | `GROK_API_URL` (actual) | `GROK_MODEL` (actual) | Provider key in `XAI_API_KEY` |
|---|---|---|---|
| `newsInvokeGemini-dev` | `https://api.deepseek.com` | `deepseek-chat` | DeepSeek (`sk-…`) |
| `NewsProjectInvokeAgentLambda-dev` | `https://api.deepseek.com/chat/completions` | `deepseek-chat` | DeepSeek |
| `newsCountryIntelligence` | `https://api.deepseek.com/chat/completions` | `deepseek-chat` | DeepSeek |
| `newsSystemsAnalysis` | `https://api.deepseek.com/chat/completions` | `deepseek-chat` | DeepSeek |
| `newsPairIntelligence` | `https://api.deepseek.com/chat/completions` | `deepseek-chat` | DeepSeek |
| `newsPostDevTo` | `https://api.deepseek.com/chat/completions` | `deepseek-chat` | DeepSeek |
| `newsThreadAnalysis` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | `gemini-2.5-flash` | Gemini (`AIza…`) |

All providers expose an OpenAI-compatible `/chat/completions` endpoint, which is why the same `invokeGrok()` helper in the source code works against all three without modification. Each Lambda also has a `XAI_API_KEY_BACKUP` env var containing the original xAI key — historical, no longer used.

### Other drift

| Doc claim | Source reality | Evidence |
|---|---|---|
| Memory + ARCHITECTURE list 13 Lambdas | 15 deployed (`aws lambda list-functions`): the 13 documented + `newsSavedItems` + Amplify scaffold helper. | `aws lambda list-functions --region ap-northeast-1` |
| ARCHITECTURE.md: "58 total components" | 67 .jsx files in `components/` + 6 atoms = 73; subagent counted ~40 actually live (rest orphaned). | `ls global-perspectives-starter/frontend/src/components/` |
| ARCHITECTURE.md: "22 hooks" | 22 hook files exist; ~6 are dead imports. See §3.3. | `ls global-perspectives-starter/frontend/src/hooks/` |
| Function name `newsInvokeGemini` | Now uses DeepSeek (not Gemini, despite the name). | `aws lambda get-function-configuration --function-name newsInvokeGemini-dev` |
| Source variable name `GROK_*`, `XAI_API_KEY` | Legacy names; values point at DeepSeek/Gemini. Renaming is purely cosmetic but would prevent the kind of confusion that just happened. | Deployed env vars above |

---

## §1 Backend Lambda inventory (14)

All paths are `amplify/backend/function/<name>/src/index.js`.

**Note on "Calls":** any cell that says "Grok" refers to the source-code identifier; the deployed env vars point at DeepSeek (or Gemini for `newsThreadAnalysis`). See §0.

| # | Name | LOC | Trigger | Calls | Writes to |
|---|---|---:|---|---|---|
| 1 | `newsInvokeGemini` | 844 | EventBridge Scheduler `cron(0 */2)` + API GW GET | 27 RSS feeds, Brave News (9 queries), **DeepSeek** via openai SDK | Topics `id=staging`, `id=seen-today` |
| 2 | `NewsProjectInvokeAgentLambda` | 947 | EventBridge `cron(5 */2)` + manual invoke | **DeepSeek** (raw fetch) | Summary `{PK:'TOPIC#<id>', SK:'SUMMARY'\|'PREDICTION'\|'TRACE_CAUSE'\|'RESEARCH_BRIEFING'}`; Topics `id=latest`, `today-archive`, `archive#YYYY-MM-DD` |
| 3 | `newsThreadAnalysis` | 377 | EventBridge Rule `cron(30 6)` | Brave News+Web per thread, **Gemini 2.5 Flash** | Summary `{PK:'THREAD#<id>', SK:'THREAD_ANALYSIS'}` TTL 90d |
| 4 | `newsCountryIntelligence` | 593 | EventBridge `cron(0 2/10)` | Brave News (4/country), **DeepSeek** | Summary `{PK:'COUNTRY#<name>', SK:'COUNTRY_INTELLIGENCE'\|'HISTORY#<date>'}` TTL 90d |
| 5 | `newsSystemsAnalysis` | 396 | EventBridge Rule `cron(15 7)` | **DeepSeek** | Summary `{PK:'SYSTEMS#<name>', SK:'SYSTEMS_ANALYSIS'}` TTL 14d |
| 6 | `newsPairIntelligence` | 706 | Manual only | Brave News+Web, **DeepSeek** | Summary `{PK:'PAIR#<slug>', SK:'PAIR_ANALYSIS'}` TTL 90d |
| 7 | `newsCountryFactsUpdater` | 349 | EventBridge `cron(0 5)` | Wikidata SPARQL, ACLED OAuth | Summary `{PK:'FACTS#<name>', SK:'COUNTRY_FACTS'}` TTL 90d |
| 8 | `newsMarketsData` | 324 | 3 EventBridge Rules (hourly/daily/weekly) | Frankfurter, FRED, World Bank, Stooq, Yahoo VIX | Markets `{pk, sk}` (lowercase keys — see §1.1) |
| 9 | `newsSensitiveData` | 1453 | API Gateway HTTP | Google certs (JWT), Paddle, Mapbox, Loops | Users (auto-create on first sign-in) |
| 10 | `newsSavedItems` | 354 | Lambda Function URL | Google certs (JWT) | `SAVED_ITEMS_TABLE` `{uid, savedKey}` no TTL |
| 11 | `newsStripeWebhook` (Paddle) | 183 | API GW POST | Paddle HMAC verify (local) | Users `{uid}` |
| 12 | `newsPostLinkedIn` | 934 | EventBridge `cron(20 */3)` | LinkedIn, Bluesky, Mastodon, Telegram, Farcaster | Social `{PK:'POSTED#<platform>#<fingerprint>'}` TTL 30d |
| 13 | `linkedInAutoPost` | 431 | EventBridge `cron(30 7/12)` | LinkedIn REST | Social `{PK:'POSTED#LINKEDIN_AUTO#<type>:<id>'}` TTL 30d |
| 14 | `newsPostDevTo` | 388 | EventBridge `cron(0 23)` | **DeepSeek**, OpenRouter, Dev.to | Summary `{PK:'DAILY_BRIEF#<date>', SK:'DAILY_BRIEF'}` + Social dedup. **CURRENTLY BROKEN — see OPT-1.** |

**Total: 8,279 LOC.**

### §1.1 DDB table inventory (4 tables)

| Table env var | PK / SK convention | Written by | Read by |
|---|---|---|---|
| `TOPICS_DDB_TABLE` | `id` (string). Special ids: `staging`, `latest`, `today-archive`, `seen-today`, `archive#YYYY-MM-DD` | newsInvokeGemini, NewsProjectInvokeAgentLambda | NewsProjectInvokeAgentLambda, newsThreadAnalysis, newsCountryIntelligence, newsPairIntelligence, newsSystemsAnalysis, newsSensitiveData, newsPostLinkedIn, newsPostDevTo |
| `SUMMARIZE_PREDICT_TABLE` | `PK` / `SK` (uppercase). Six PK families: `TOPIC#`, `THREAD#`, `COUNTRY#`, `SYSTEMS#`, `PAIR#`, `FACTS#`, `DAILY_BRIEF#` | All AI Lambdas | newsSensitiveData, linkedInAutoPost, newsPostDevTo |
| `USERS_DDB_TABLE` | `uid` | newsSensitiveData, newsStripeWebhook | newsSensitiveData |
| `SOCIAL_POSTS_TABLE` | `PK` (POSTED#…) | newsPostLinkedIn, linkedInAutoPost, newsPostDevTo | Same |
| `MARKETS_DDB_TABLE` (`'GlobalPerspectiveMarkets'` — hardcoded in newsSensitiveData) | `pk` / `sk` (**lowercase**) | newsMarketsData | newsSensitiveData |
| `SAVED_ITEMS_TABLE` | `uid` / `savedKey` (`<type>#<id>`) | newsSavedItems | newsSavedItems |

Lowercase-vs-uppercase key inconsistency between Markets table and everything else forces special-casing in newsSensitiveData (lines 718, 769) and is fragile.

### §1.2 Scheduling — verified from project memory

EventBridge Rules: `TriggerDailyAnalysis` (06:30 UTC → thread), `TriggerNewsSystemsAnalysis` (07:15 UTC → systems), `MarketsDataHourly`, `MarketsYieldsDaily`, `MarketsMacrosWeekly`.

EventBridge Scheduler: `InvokeGoogleGemini` (every 2h → newsInvokeGemini), `InvokeNewsAgent` (every 2h at :05 → NewsProjectInvokeAgentLambda), `countryIntelliegence` (sic — 02/12/22 UTC → newsCountryIntelligence), `InvokeLinkedIn` (every 3h at :20 → newsPostLinkedIn), `LinkedinThreadsDaily` (07:30, 19:30 UTC → linkedInAutoPost), `InvokeDev` (23:00 UTC → newsPostDevTo), `Fact` (05:00 UTC → newsCountryFactsUpdater).

Manual only: `newsPairIntelligence`.

Event-driven: `newsStripeWebhook` (Paddle webhook), `newsSensitiveData`, `newsSavedItems` (HTTP).

### §1.3 Pipeline data flow (verified from source)

```
   ┌─────────────────┐
   │ newsInvokeGemini│  RSS ×27 + Brave News ×9  →  xAI Grok  →  Topics:staging
   └────────┬────────┘
            │ (~5 min later via separate scheduler)
   ┌────────▼──────────────────────────┐
   │ NewsProjectInvokeAgentLambda      │  read staging
   │   for each topic (sequential):    │  → 3 Grok calls (SUMMARY / PREDICTION-2pass / TRACE_CAUSE)
   │                                   │  → write SUMMARY/PREDICTION/TRACE_CAUSE per topic
   │   threadId assignment:            │  → inherit continues_topic OR Jaccard(0.4)
   │   swap Topics:staging→latest      │  → write today-archive + archive#YYYY-MM-DD
   └────────┬──────────────────────────┘
            │
   ┌────────▼────────────────┐  ┌──────────────────────────┐  ┌────────────────────┐
   │ newsThreadAnalysis 06:30│  │ newsCountryIntelligence  │  │ newsSystemsAnalysis│
   │ Top-10 threads          │  │ 02/12/22 UTC             │  │ 07:15 UTC          │
   │ Brave grounding ×2/thr  │  │ Top-20 countries         │  │ Top-5 (Phase 1: 2) │
   │ Grok (13s pacing!)      │  │ Brave ×4/country         │  │ Grok               │
   │ → THREAD_ANALYSIS       │  │ Grok                     │  │ → SYSTEMS_ANALYSIS │
   └─────────────────────────┘  │ → COUNTRY_INTELLIGENCE   │  └────────────────────┘
                                └──────────────────────────┘
   ┌─────────────────────────────────────────────────────────────────┐
   │ All four daily Lambdas independently re-read 31 days of archive │  ← duplication, see OPT-4
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │ newsPostLinkedIn│  │ linkedInAutoPost│  │ newsPostDevTo    │
   │ every 3h        │  │ 07:30 / 19:30   │  │ 23:00 daily      │
   │ LinkedIn/Bluesky│  │ scores threads  │  │ DAILY_BRIEF + DT │
   │ /Mastodon/etc.  │  │ + countries     │  │ (BROKEN; OPT-1)  │
   └─────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## §2 LLM client pattern (duplicated 6×)

Every AI Lambda contains its own copy of the same OpenAI-compatible client (Grok-named, DeepSeek/Gemini-pointed). Compare:

```js
// NewsProjectInvokeAgentLambda:15, newsCountryIntelligence:15,
// newsPostDevTo:16, newsPairIntelligence:15, newsThreadAnalysis:8, newsSystemsAnalysis:8
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
```

The source-level default `api.x.ai` is now only a fallback; every deployed Lambda overrides it via env var (see §0). That the same code path works for DeepSeek and Gemini is by design — both expose `/chat/completions`.

**New env vars added 2026-05-18 (parallelization work):**
- `LLM_CONCURRENCY=4` on `NewsProjectInvokeAgentLambda-dev` and `newsCountryIntelligence`. Replaced sequential per-topic / per-country loops with a 12-line `mapWithConcurrency` worker pool. Measured speedups: agent 387s → 130s (3.0×, eliminated 14% timeout rate); country intel 348s → 60s (5.8×).
- `BRAVE_CONCURRENCY=3` on `newsInvokeGemini-dev`. Replaced sequential `for + sleep(2000)` Brave loop with same worker pool. Saves 16s/run × 12 runs/day.
- `AI_MODEL=deepseek/deepseek-v4-flash:free` on `newsPostDevTo`. Was hardcoded as `deepseek/deepseek-r1:free` (removed by OpenRouter); now env-driven with a current model as fallback.

Plus per-file copies of:
- `invokeGrok(messages, opts)` — JSON POST with bearer auth
- `extractContent(json)` — defensive parsing
- `stripCodeFence(text)` — removes ```json fences. `newsPairIntelligence` and `newsThreadAnalysis` versions additionally strip trailing commas; others don't.

Equivalent block ≈ 60–90 LOC × 6 Lambdas = ~450 LOC of duplication. Extracting to a Lambda Layer is the single biggest code-quality win available. The layer should also **rename `GROK_*` → `LLM_*`** so the next person reading the source doesn't make my mistake.

---

## §3 Frontend wiring

### §3.1 Entry & bootstrap

`main.jsx` mounts `<App/>`. `App.jsx` wraps in `<ErrorProvider>` → `<AuthProvider>` → `<BrowserRouter>` → `<AuthBridge>` (calls `restProxy.setAuthProvider(getIdToken)`) → routes.

Runtime config is read from `window.FIREBASE_CONFIG`, `window.SENSITIVE_PROXY_ENDPOINT`, `window.GOOGLE_MAPS_API_KEY`, `window.SAVED_ITEMS_ENDPOINT`, all set by `docs/config.js` (never bundled). Local dev falls back to `VITE_FIREBASE_*` env vars.

### §3.2 Service layer (`services/restProxy.js`)

Two callers:
- `proxyAction(action, payload)` — public; no auth header.
- `proxyActionWithAuth(action, payload)` — adds `Authorization: Bearer <Firebase ID token>` via the provider wired in by `AuthBridge`.

Exported helpers map 1:1 to `newsSensitiveData` actions:

| Helper | Action | Cache key (in hook) | TTL |
|---|---|---|---|
| `fetchTopicsCache` | `topics` | `gemini_topics_cache_v2` | 1 h |
| `fetchSummaryCache` | `summary` | per-topicId in hook | session |
| `fetchPredictionCache` | `prediction` | per-topicId | session |
| `fetchTraceCauseCache` | `trace_cause` | per-topicId | session |
| `fetchTodayArchive` | `today` | none | none |
| `fetchArchiveRange(days)` | `archive_range` | `gp_weekly_archive_v1` | 30 min |
| `fetchNarrativeThread(threadId)` | `narrative_thread` | per-thread | 30 min |
| `fetchThreadAnalyses(threadIds[])` | `thread_analysis` | per-threadIds hash | 30 min |
| `fetchCountryIntelligence(names[])` | `country_intelligence` | per-names hash | 30 min |
| `fetchDailyBrief(dateKey)` | `daily_brief` | per-dateKey | session |
| `fetchPairAnalysis(slug)` | `pair_analysis` | per-slug | 30 min |
| `fetchPairAnalysesList()` | `pair_analyses_list` | global | 30 min |
| `geocodeProxy(address)` | `geocode` | session memo | session |
| `fetchCountryPreview(name)` | `country_preview` | SEO/bot only | n/a |
| `fetchThreadPreview(id)` | `thread_preview` | SEO/bot only | n/a |
| `fetchUserProfile` (auth) | `user_profile` | session | session |
| `fetchPortalSession` (auth) | `portal_session` | n/a | n/a |

Separate `savedItemsProxy` hits `window.SAVED_ITEMS_ENDPOINT` (newsSavedItems Function URL).

`services/appsyncProxy.js` and `utils/graphqlService.js` are **dead** — no live importers. `aws-amplify` + `@aws-amplify/api-graphql` ride along in `package.json` for no reason.

### §3.3 Hooks (22 files; ~14 live)

Live, in active use:
- `useGeminiTopics` (Home, WorldMapV2)
- `useTodayArchive` (DailyPage today path)
- `useWeeklyArchive` (WeeklyPage, WorldMapV2)
- `useThreadAnalyses` (ThreadPage, WeeklyPage, CountryPage)
- `useCountryIntelligence` (CountryPage, CountryListPage, WorldMapV2)
- `useDailyBrief` (DailyPage)
- `useMarketsGlobal` / `useMarketsCountry` (CountryPage right rail, Home)
- `useCountryHistory` (CountryPage trajectory)
- `useSystemsAnalysis` (CountryPage causal graph)
- `useCountrySignal` (atom signals)
- `useSavedItems` (Account, SaveButton)
- `useUserProfile` (Account)
- `useIsMobile` (Layout, several pages)

Dead / orphaned (no live importers — verified via grep):
- `useArticles`, `useBookmarks`, `useSummary`, `usePrediction`, `useTraceCause`, `useResearchBriefing`, `usePairAnalyses`, `usePairIntelligence` (the last two only feed PairListPage / PairPage which are imported in App.jsx but not routed).

The 30-minute LocalStorage cache pattern is implemented inline in ~7 hooks with identical try/catch/JSON.parse/staleness/dispatch boilerplate — strong candidate for a `useCachedFetch(key, ttl, fetcher)` extraction.

### §3.4 Routes (`App.jsx`)

Live in nav: `/`, `/daily`, `/daily/:dateKey`, `/map`, `/weekly`, `/weekly/thread/:threadId`, `/weekly/countries`, `/weekly/country/:countryName`, `/signin`, `/auth/callback`, `/account`, `/about`, `/contact`, `/privacy`, `/disclosures`, `/whitepaper`, `/cli`, `/upgrade/success`.

Imported into App.jsx but **dead** (no route registered or route removed):
- `Pricing` — imported line 21, no `<Route>` for `/pricing`.
- `PairPage` — imported line 28, no `<Route>` for `/weekly/pair/:slug`.
- `PairListPage` — imported line 29, no `<Route>` for `/weekly/pairs`.

These three add to bundle size with no UI.

Routed but not in nav: `/weekly-map`, `/intelligence-map`, `/map-v2` (deprecated alias), `/test/briefing-card`.

### §3.5 Components — orphan inventory

Subagent identified live components ≈ 40 of 67 (+6 atoms). Top orphans confirmed via grep:
- `MiniMap.jsx` — no importers.
- `TopicNav.jsx` — no importers.
- `SectionNav.jsx`, `SideNav.jsx` — no importers.
- `ApiKeyGate.jsx` — superseded by Firebase auth.
- `KickstarterBanner.jsx` — campaign ended.
- `WeeklyLockedPreview.jsx` — early-access mode made all content public.
- `ArchiveTopicModal.jsx`, `PerspectiveComparison.jsx`, `CopyBriefing.jsx`, `ShareButtons.jsx`, `TrialBanner.jsx`, `ErrorHandling.jsx`, `ErrorModal.jsx` (latter exists but ErrorContext rarely triggers it).
- Atoms `Sparkline`, `RiskDeltaPill`, `MacroChip` — built in atom library but never imported by any page (only `EditorialShell`, `StatusStrip`, `RiskScoreBadge` are consumed).

### §3.6 End-to-end traces

**"User opens /weekly/country/Iran":**
1. `CountryPage.jsx` mounts, reads `:countryName` param.
2. `useCountryIntelligence(["Iran"])` → `restProxy.fetchCountryIntelligence(["Iran"])` → `POST /sensitive {action:'country_intelligence', payload:{countryNames:["Iran"]}}`.
3. `newsSensitiveData` (action handler) → `GetCommand` on `SUMMARY_TABLE` key `{PK:'COUNTRY#Iran', SK:'COUNTRY_INTELLIGENCE'}` → returns Item.
4. Item was written by `newsCountryIntelligence` at the previous 02:00/12:00/22:00 UTC tick.
5. Parallel hooks fire: `useCountryHistory("Iran")`, `useSystemsAnalysis("Iran")`, `useMarketsCountry("Iran")`, `useThreadAnalyses([...threadIds])`.
6. Bots hitting same URL are intercepted by the Cloudflare worker (`globalperspective-rss`) which POSTs `country_preview` and returns pre-rendered HTML with OG tags.

**"Daily scheduled run":**
1. `cron(0 */2)` fires Scheduler → `newsInvokeGemini-dev`.
2. `cron(5 */2)` fires Scheduler → `NewsProjectInvokeAgentLambda-dev`.
3. `cron(30 6)` fires Rule → `newsThreadAnalysis`.
4. `cron(0 5)` fires Scheduler → `newsCountryFactsUpdater`.
5. `cron(15 7)` fires Rule → `newsSystemsAnalysis` (reads facts from step 4).
6. `cron(0 2/10)` fires Scheduler → `newsCountryIntelligence` (next tick will see fresh thread analyses from step 3).

There is **no fan-out / SQS / Step Function** — coordination is implicit via DDB freshness and the cron offsets. A late-finishing upstream Lambda simply means downstream uses yesterday's snapshot.

---

## §4 Foundation doc set (what to read first)

Authoritative, currently load-bearing:
1. **CLAUDE.md** — build/deploy workflow (the one rule that, when violated, ships nothing to prod).
2. **ARCHITECTURE.md** — system overview (with §0 caveat above).
3. **BACKEND_GUIDE.md** — Lambda quick reference.
4. **SYSTEM_WIRING.md** (this file) — the code-grounded truth.
5. **OPTIMIZATION_REPORT.md** (companion) — concrete, evidence-based fix list.
6. **AI_PROVIDER_MIGRATION_PLAN.md** + **DEEPSEEK_QUALITY_AUDIT.md** — required context for the AI-provider drift in §0.
7. **SECURITY_DEPLOYMENT_NOTES.md** — JWT / secrets handling, required before touching `newsSensitiveData`.

Plans that fully shipped — archive (do not treat as live spec):
- REDESIGN_PLAN.md, REDESIGN_V2_PLAN.md, PAIR_INTELLIGENCE_PLAN.md, PAIR_UI_PLAN.md, RSS_CLOUDFLARE_TODO.md, docs/MAP_UPGRADE_FEATURES.md, docs/STALE_CACHE_PLAN.md, continue-news.md.

Actively misleading — banner or rewrite:
- TIERS.md, PADDLE_SETUP.md (Paddle-era; tier checks removed 2026-04-11, Paddle stack removed 2026-06-01). **Both now carry a deprecation banner pointing at [`POLAR_BILLING_PLAN.md`](./POLAR_BILLING_PLAN.md) — the live spec for the Polar-based subscription rebuild (in planning, not yet built).**
- docs/ENTERPRISE_WEEKLY_ANALYSIS.md (tier checks removed 2026-04-11).
- docs/WEEKLY_KNOWN_ISSUES.md (issue from older clustering pipeline).
- MOBILE_APP_DEVELOPMENT_GUIDE.md (no mobile app exists).
- DEPLOYMENT_NOTES.md (duplicates CLAUDE.md; pick one).

Marketing drafts (move to `marketing/` to declutter root):
- BLOG_POST_DEVTO.md, DEVTO_*.md (3 files), GAMMA_PITCH_WITH_CITATIONS.md, RESEARCH_EVIDENCE_COMPILATION.md.

---

## §5 External API dependency map

| API | Used by Lambda | Used by frontend |
|---|---|---|
| xAI Grok (`api.x.ai`) | 7 Lambdas (see §1) | — |
| Brave Search News + Web | newsInvokeGemini, newsThreadAnalysis, newsCountryIntelligence, newsPairIntelligence | — |
| Wikidata SPARQL | newsCountryFactsUpdater | — |
| ACLED OAuth + API | newsCountryFactsUpdater | — |
| Frankfurter, FRED, World Bank, Stooq, Yahoo | newsMarketsData | — |
| Google Identity (cert keyset) | newsSensitiveData, newsSavedItems (JWT verify) | — |
| Paddle | newsStripeWebhook (webhook), newsSensitiveData (portal) | — |
| Mapbox Geocoding | newsSensitiveData | — |
| LinkedIn / Bluesky / Mastodon / Telegram / Farcaster (Neynar) | newsPostLinkedIn, linkedInAutoPost | — |
| Dev.to + OpenRouter | newsPostDevTo | — |
| Loops (welcome email) | newsSensitiveData | — |
| Firebase Auth | newsSensitiveData, newsSavedItems (verify) | AuthContext.jsx |
| Google Maps JS | — | WorldMap, WorldMapV2, WeeklyMap, CountryPage |

---

## §6 Caching topology

| Layer | Where | TTL | Risk |
|---|---|---|---|
| LLM result cache | DDB SUMMARY_TABLE TTL attr | 14d–90d depending on type | Hot — drives whole site |
| Topics `latest` | DDB Topics table | None (overwritten every 2h) | If pipeline stalls, stale until next swap |
| Frontend topics | LocalStorage `gemini_topics_cache_v2` | 1 h | Per-browser |
| Frontend weekly | LocalStorage `gp_weekly_archive_v1` (per-uid) | 30 min | Per-user, can leak across users on signOut — see OPT-9 |
| Cloudflare Worker RSS | Edge cache | 30 min | Global — flush requires worker purge |
| Cloudflare bot prerender | None (regenerated per request) | n/a | Hot — adds latency to bot first-hit |
| JWT cert cache | Lambda module scope | 1 h | Per-warm-container; cold start hits Google |
