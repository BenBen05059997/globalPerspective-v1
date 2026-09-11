# Frontend Structure + Data-Contract Audit — globalperspective.net

Scope: `global-perspectives-starter/frontend/src/`. Read-only. Verified against prod
(`docs/config.js`, live curls 2026-09-11) and `project-docs/architecture/ARCHITECTURE.md`
(touched 2026-09-10, so drift below is *current*, not stale-doc noise).

## 1. Route inventory (App.jsx:100-129, 27 `<Route>`)

| Path | Component | Nav-linked? | Notes |
|---|---|---|---|
| `/` | Home.jsx | Yes (Topics) | |
| `/map` | **SituationHome.jsx** | Yes (Map) | ⚠ DRIFT — ARCHITECTURE.md route table says `/map → WorldMapV2.jsx`. As of the map-as-home redesign (commits `4a3ddf2`…`3a8bb36`, last 2026-09-10) `/map` is `SituationHome.jsx` (deck.gl 2.5D `SituationMap3D`, S3 `world/latest.json` via Worker) |
| `/map-legacy` | WorldMapV2.jsx | No (unlisted) | ⚠ Not in ARCHITECTURE.md's route table at all — the doc doesn't know this route exists |
| `/privacy`,`/about`,`/disclosures`,`/contact` | static pages | Footer only | matches doc |
| `/daily`, `/daily/:dateKey` | DailyPage.jsx | Yes | matches doc |
| `/economy` | EconomyPage.jsx | Yes | matches doc |
| `/analyze` | AnalysisStudio.jsx | Yes | matches doc |
| `/membership` | MembershipPage.jsx | Footer only | matches doc |
| `/track-record` | TrackRecordPage.jsx | Yes | matches doc |
| `/weekly-brief` | WeeklyBriefPage.jsx | Yes | matches doc |
| `/weekly-markets` | WeeklyMarketsPage.jsx | No (permalink redirect → `/economy?view=week`) | matches doc |
| `/breaking`, `/breaking/:id` | BreakingFeedPage/BreakingDetailPage | No (deep-linked from BreakingStrip/bell) | matches doc |
| `/weekly` | WeeklyPage.jsx | Yes (Threads) | matches doc |
| `/weekly/thread/:threadId` | ThreadPage.jsx | No (deep link) | matches doc |
| `/weekly/countries` | CountryListPage.jsx | Yes (Countries) | matches doc |
| `/weekly/country/:countryName` | CountryPage.jsx | No (deep link) | matches doc |
| `/signin`, `/auth/callback`, `/account` | auth flow | Account/Sign-in button | matches doc |
| `/whitepaper` | WhitepaperPage.jsx | Footer only | matches doc |
| `/spider-demo` | SpiderDemo.jsx | No (unlisted prototype) | matches doc |
| `/__boom` | inline `Boom` | No | matches doc (deliberate error-boundary test) |
| `*` | inline `NotFound` | — | matches doc |

**Drift summary:** ARCHITECTURE.md's Frontend §Routes table is stale on exactly one axis — the
map-as-home swap. It still describes `/map` as the old WorldMapV2 experience and is silent on
`/map-legacy`. Everything else in the route table (27 routes incl. catch-all) matches code
1:1 (App.jsx:100-129 vs ARCHITECTURE.md:1228-1257).

## 2. Component/hook/service inventory

~70 files in `components/` (+19 atoms), 34 hooks, 6 services/utils layers, ~25 `utils/*.js`.
Per-file purpose in ARCHITECTURE.md's Key Components / Key Hooks tables (lines 1261-1339) was
spot-checked against source and is accurate **except** it has zero mentions of the map-as-home
frontend surface — `SituationHome.jsx`, `SituationMap.jsx`, `SituationMap3D.jsx`,
`hooks/useWorld.js`, `services/worldData.js`, `utils/situationLabels.js` — none of these six
files appear anywhere in the Frontend section (confirmed via grep, `ARCHITECTURE.md` frontend
section lines 1216-1445). The backend half of the same programme (`newsSituationTracker`, the S3
bucket, the Worker `/data/*` route) IS thoroughly documented (lines 838-946) — the frontend
consumer of that pipeline was never added to the Frontend section when it shipped.

**Shared layers:**
- `services/restProxy.js` — the `newsSensitiveData` proxy client. `proxyAction` (public,
  no-auth actions) + `proxyActionWithAuth` (attaches Firebase Bearer JWT when signed in,
  but per ARCHITECTURE.md the backend no longer requires it) + a client-side concurrency
  limiter (`MAX_PROXY_CONCURRENCY=4`, restProxy.js:31-47) guarding cold-start bursts. Also
  hosts three *separate* Function-URL clients bolted onto the same file: `savedItemsRequest`
  (newsSavedItems), `prefsRequest` (newsRecommend), `polarRequest` (newsPolarBilling), plus a
  standalone `runMemberAnalysis` (newsAnalyze). One file, four backends.
- `services/worldData.js` — bypasses restProxy entirely: plain `fetch()` of static JSON off
  the Cloudflare Worker `/data/*` CDN route (`world/latest.json`, `situations/state/<id>.json`).
  No Lambda in this path.
- `services/appsyncProxy.js` — **dead file.** Grep confirms zero importers anywhere in
  `src/` outside itself. Legacy AppSync GraphQL client from before the 2026-05-26
  `graphqlService.js → contentService.js` rename (ARCHITECTURE.md:1367 already notes "there is
  no GraphQL" but doesn't flag the leftover file).
- `services/errorSink.js` — posts to `window.CLIENT_ERRORS_ENDPOINT` (newsClientErrors).
- `contexts/AuthContext.jsx` — Firebase auth; wires `setAuthProvider(getIdToken)` into
  restProxy via `AuthBridge` (App.jsx:82-88).

## 3. Data-contract map (condensed — see grep dump for full per-hook detail)

| Page | Hook(s) | restProxy action / endpoint | Backend Lambda | Source |
|---|---|---|---|---|
| Home | useGeminiTopics→contentService | `topics` | newsSensitiveData | Topics DDB (`latest`) |
| Home | useTrackRecord, useCorrectionsFeed | `prediction_track_record`, `corrections_feed` | newsSensitiveData | Prediction Log / drift notes |
| **Map** (`/map`) | **useWorld** | *(no proxy — direct fetch)* | Worker `globalperspective-rss` `/data/*` → S3 (private, SigV4) | `world/latest.json` (newsSituationTracker, sole writer) |
| Map detail panel | useSituationDetail | *(no proxy)* | same Worker route | `situations/state/<id>.json` |
| `/map-legacy` | useCountrySignal (client z-score), usePairAnalyses, useWorldOverview via WorldMapV2 | `world_overview`, `pair_analyses_list`, `archive_range` | newsSensitiveData | Systems/topics tables |
| Weekly / ThreadPage | useWeeklyArchive, useThreadAnalyses, useNarrativeThread | `archive_range`, `thread_analysis`, `narrative_thread` | newsSensitiveData / newsThreadAnalysis cache | Summary/Predict table |
| ThreadPage rail | useThreadForecast | `prediction_snapshot` | newsPredictionsSnapshot cache | Prediction Log |
| CountryPage | useCountryIntelligence, useSystemsAnalysis, useCountryHistory | `country_intelligence`, `systems_analysis`, `country_history` | newsCountryIntelligence / newsSystemsAnalysis | respective caches |
| Economy | useMarketsGlobal/-Country/-History, useTopMovers, useDisruptionsList | `markets_global`, `markets_country`, `markets_history`, `economic_top_movers`, `economic_impact_list` | newsMarketsData / newsEconomicImpact | Markets DDB |
| /economy?view=week | useWeeklyMarkets | `weekly_markets` | newsWeeklyMarkets | published report cache |
| /weekly-brief | useWeeklyBrief | `weekly_brief` | newsWeeklyBrief | published brief cache (verified live: returns `{headline,dek,brief,signals[],watch[]}`, matches WeeklyBriefPage.jsx:84-148 field reads exactly) |
| /track-record | useTrackRecord, useCorrectionsFeed | `prediction_track_record`, `corrections_feed` | newsPredictionResolver / drift | Prediction Log |
| /breaking* | useNotifications, useBreakingAlert | `list_alerts`, `get_alert` on **USER_PREFS_ENDPOINT** (not the main proxy) | newsRecommend | Breaking Alerts DDB |
| /analyze | AnalysisStudio | BYOK: direct browser→provider (services/llm.js), no restProxy for inference; story context via restProxy public actions; member path via `runMemberAnalysis`→NEWS_ANALYZE_ENDPOINT | newsAnalyze (members only) | — |
| Account (saved) | useSavedItems | SAVED_ITEMS_ENDPOINT | newsSavedItems | Saved Items DDB |
| Account (prefs/follow) | usePreferences | USER_PREFS_ENDPOINT | newsRecommend | User Prefs DDB |
| Account (membership) / nav credits pill | useMembership | POLAR_BILLING_ENDPOINT | newsPolarBilling | — |

**Flags:**
- `fetchCountryHistory`, `fetchSystemsAnalysis`, `fetchDisruptionsList`, `fetchTopMovers` etc.
  all funnel through the generic `proxyAction(action, payload)` shape with no per-action
  response-shape validation in restProxy.js itself — each hook trusts the shape ad hoc
  (e.g. `res?.data || null`). No shared schema/type guard layer.
- Auth-gating is inconsistent by *design* (documented) but easy to misread from code alone:
  `proxyActionWithAuth` attaches a bearer token opportunistically but the backend accepts the
  call with or without it (early-access public mode) — so "Auth" in the route table only
  really applies to `/account` and the four dedicated Function URLs (SavedItems/Prefs/Polar/
  Analyze), which do hard-require a JWT (restProxy.js:261-262, 290-291, 364-365, 411-412).
- `metricsFor()` in SituationHome.jsx:47-54 regex-parses `outlets`/`coverage ratio` back out of
  the tracker's human-readable `what_changed` string (`"5 outlets · coverage 1.67× prior"`)
  as a fallback when structured `evidence.outlets`/`evidence.coverage_ratio` are absent —
  a live example of a field being regex-scraped that could be (and partly already is)
  structured on the backend.

## 4. config.js runtime contract (docs/config.js, 9 lines)

| Global | Read by | Live? |
|---|---|---|
| `SENSITIVE_PROXY_ENDPOINT` | restProxy.js (6 refs) | Live, verified (`topics` action returns 200) |
| `SAVED_ITEMS_ENDPOINT` | restProxy.js | wired |
| `CLIENT_ERRORS_ENDPOINT` | errorSink.js | wired |
| `USER_PREFS_ENDPOINT` | restProxy.js (alerts/prefs/follow) | wired |
| `POLAR_BILLING_ENDPOINT` | restProxy.js | wired |
| `NEWS_ANALYZE_ENDPOINT` | restProxy.js | wired |
| `GOOGLE_MAPS_API_KEY` | geocoding.js / map components | wired |
| `FIREBASE_CONFIG` | AuthContext.jsx | wired |
| *(absent)* `POLAR_CREDIT_PACKS` | restProxy.js `creditPacks()` (restProxy.js:389-392) | **Not set in prod config.js** — code degrades to `[]` → honest "coming soon" UI (matches MEMORY: credit packs parked/off) |

**Dead/legacy code referencing globals config.js does NOT define:**
- `window.APPSYNC_ENDPOINT` / `window.APPSYNC_API_KEY` — only read by the dead
  `services/appsyncProxy.js`.
- `window.APP_CALLBACK_URL` — optional override in `AuthContext.jsx:33`, never set; falls
  through to the computed origin-based callback URL. Not dead, just unused today.

No endpoints exist in config.js that aren't referenced somewhere in source — no pure-dead
config keys, only the reverse (code referencing a global config.js doesn't provide).

## 5. State/caching inventory

localStorage keys in use (grepped across `src/`):

| Key | Owner | TTL / behavior |
|---|---|---|
| `gp_topics_cache` | Home/Layout (topic count in strip) | ad hoc, read on mount only in Layout.jsx:50 |
| `gp_map_last_seen` | SituationHome.jsx:83 | stamped every mount; drives "N new since you last looked" |
| `gp_map_view` | SituationMap/SituationMap3D (view-mode persistence, referenced in map components) | no TTL (sticky pref) |
| `gp_arc_intro_dismissed` | ThreadPage-adjacent onboarding | sticky, no TTL |
| `gp_return_to` | SignIn/AuthCallback post-login redirect | one-shot |
| `ep-lrail-w`, `ep-rail-w` | EditorialShell resizable rail widths | sticky pref, no TTL |
| `gp_just_signed_in` (sessionStorage) | AuthContext / post-auth toast | per-tab, one-shot |

ARCHITECTURE.md's "Caching Strategy" table (lines 1420-1427) only lists 4 of these
(`gemini_topics_cache_v2`, `gp_weekly_archive_v1`, `gp_thread_analyses_v2`,
`gp_country_intel_v1` — note: none of those exact key names matched a grep hit under those
exact strings either; hooks like `useWeeklyBrief`/`useWeeklyMarkets`/`useCorrectionsFeed` each
define their own `CACHE_KEY`/`CACHE_TTL_MS` locally (e.g. `gp_weekly_brief_v1`, 30 min) that
aren't in the doc's table at all). The doc's caching table is a partial, stale snapshot, not an
exhaustive inventory — treat it as illustrative only.

**Duplicate client/server logic — confirmed, with a second instance beyond the known one:**
1. **Known (per task brief), verified:** `SituationHome.jsx` recomputes `lede` and `ranked`
   client-side even though the S3 bundle already carries both, backend-derived
   (ARCHITECTURE.md:944, "lede/ranked derived from situations"; live curl of
   `world/latest.json` confirms top-level keys `lede`, `ranked`, `systemic`, `_counts` are
   present in the payload). But:
   - `ranked` (SituationHome.jsx:71-78) is built with its own `useMemo` sort over
     `open` situations by `TIER_WEIGHT`/`escalating`/`last_change_at` — **never reads
     `world.ranked`**.
   - `lede` (SituationHome.jsx:113-114) is built by `buildLede(open, hero)` from
     `utils/situationLabels.js` — **never reads `world.lede`**.
   - Net effect: the backend computes both fields every 30 min for nothing (no consumer),
     and the frontend's version can silently diverge from the backend's intended ranking/lede
     logic since they're two independent implementations of the same rule.
2. **New finding:** `metricsFor()` (SituationHome.jsx:47-54, see §3 above) regex-parses
   `outlets`/`coverage_ratio` out of the tracker's free-text `what_changed` field as a
   fallback path, duplicating parsing logic that ideally lives once, server-side, in the
   structured `evidence{}` object it already prefers when present.

## 6. Live contract spot-checks (2026-09-11)

1. `POST {SENSITIVE_PROXY_ENDPOINT} {"action":"topics"}` → 200, `{success,cached,stale,asOf,data:{model,limit,topics[...]}}`. Fields match `useGeminiTopics`/`contentService` reads (model, topics[].regions/sources/title/url/age).
2. `GET https://globalperspective.net/data/world/latest.json` → 200, keys
   `schema,generated_at,next_expected_at,sources,stale,situations,lede,systemic,ranked,_counts`.
   Matches `useWorld.js` reads (`world.sources`, `world.situations`, `world.stale`) — confirms
   the Worker route is live and the SigV4 proxy to the private S3 bucket works end-to-end.
3. `POST {SENSITIVE_PROXY_ENDPOINT} {"action":"weekly_brief"}` → 200,
   `{success,data:{model,asOf,watch[],signals[],headline,dek,brief,weekOf}}` — matches every
   field `WeeklyBriefPage.jsx` reads (`brief.weekOf`, `.asOf`, `.headline`, `.dek`, `.brief`,
   `.signals`, `.watch`). No drift on this contract.

## Top 5 structural observations

1. **ARCHITECTURE.md's Frontend section did not travel with the map-as-home ship** — the
   backend half (S3 bucket, Worker route, newsSituationTracker) is documented in detail as of
   2026-09-10, but the Routes/Components/Hooks tables still describe `/map` as the pre-redesign
   WorldMapV2 experience and omit `/map-legacy`, `SituationHome.jsx`, `SituationMap.jsx`,
   `SituationMap3D.jsx`, `useWorld.js`, `worldData.js`, `situationLabels.js` entirely. This is
   the highest-value drift to fix — an architect reading the doc today would materially
   misunderstand what `/map` renders and how it gets its data.
2. **The lede/ranked duplication is real and now double** — not only does `SituationHome.jsx`
   recompute what the backend already ships (`world.lede`/`world.ranked`), it also has a
   second, smaller instance of the same pattern (`metricsFor()` regex-scraping `what_changed`
   instead of trusting `evidence{}`). Low risk today (both surfaces get similar answers) but a
   silent-divergence trap the moment either side's ranking rule changes independently.
3. **`services/restProxy.js` is one file serving five distinct backends** (newsSensitiveData
   proxy + newsSavedItems + newsRecommend + newsPolarBilling + newsAnalyze), each with its own
   inline auth/error-handling block copy-pasted with small variations (compare
   `savedItemsRequest`, `prefsRequest`, `polarRequest`, `runMemberAnalysis` — restProxy.js
   258-427). Functionally fine, but any of the four inline fetch helpers could regress
   independently since none share a factory.
4. **`services/appsyncProxy.js` is dead code** — zero importers, a holdover from the pre-2026
   GraphQL era the docs already declared over. Harmless but should be deleted or the doc
   should note it's intentionally kept for some reason not evidenced in code.
5. **No shared response-shape validation between restProxy and its ~25 consumer hooks** — every
   hook trusts its own ad hoc unwrap (`res?.data || null`, `body?.topics`, etc.) with no shared
   schema guard. Combined with `proxyAction`'s own quiet Lambda-proxy-vs-direct-body format
   sniffing (restProxy.js:87-95), a backend response-shape change would surface as scattered
   per-page `undefined` reads rather than one clear contract-break signal.
