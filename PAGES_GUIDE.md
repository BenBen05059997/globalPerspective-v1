# PAGES_GUIDE.md — Page-by-Page Reference & Verification

**Generated:** 2026-05-18, from on-disk source under `global-perspectives-starter/frontend/src/`.
**Updated:** 2026-06-22 — added the four pages that shipped after the original sweep (`/analyze`, `/weekly-brief`, `/track-record`, `/membership`), re-pointed existing entries' inbound/outbound links at them, and corrected stale references (removed `useUserProfile`, the deleted `Pricing`/`PairPage`/`PairListPage`/`Gate` imports, the Account tier/billing-portal UI, the Stripe mention in `/privacy`, and the nav/footer link sets).

This doc combines two industry conventions:

1. **Content audit / page inventory** — purpose, user job, data ownership, inbound/outbound links per page (Semrush + UO Digital Strategy convention — see Sources).
2. **3-layer smoke test** — for each page, the minimum click-path that proves the page is alive end-to-end (Yuri Kan QA convention — Infrastructure → Component → Integration, total <10 min per regression sweep).

Use this when:
- Onboarding a new contributor and they ask "what is each route for?"
- Doing a regression pass before a release.
- Investigating "is this page broken?" without spinning up dev tools first.
- Deciding whether a route is worth keeping (orphan check).

---

## Schema (each page entry)

```
## <route path> · <component file>

- Purpose            one sentence
- Primary user job   what the user wants to accomplish
- Data sources       hooks + restProxy actions / API endpoints
- Auth gate          none / sign-in required / both
- Inbound links      where users land here from
- Outbound links     where users go from here
- Key UI elements    3–6 things that matter on this page
- States             loading / empty / error / success behavior
- Smoke-test         3 steps that prove end-to-end
- Known issues       broken / dead / dev-only / orphaned bits observed in code
```

---

> **⛔ Removed routes (correction 2026-05-28):** the following entries appear below but are **no longer registered in `App.jsx`** — they've been removed and are retained here for history only: `/weekly-map`, `/intelligence-map`, `/cli`, `/upgrade/success`, `/test/briefing-card`.
>
> **➕ Pages added since this doc was first generated (2026-06-22):** `/analyze` (AnalysisStudio), `/weekly-brief` (WeeklyBriefPage), `/track-record` (TrackRecordPage), and `/membership` (MembershipPage) are now live and documented in their own sections below. The current `App.jsx` registers **21 content routes** (counting `/daily` + `/daily/:dateKey` separately) plus a dev-only `/__boom` error-boundary trigger (`Boom`, unlinked — see Orphan check) and the `*` catch-all (`NotFound`). The primary nav is now 9 links (see Site map), not the original 5.

## `/` · `components/Home.jsx`

- **Purpose:** Today's global topics grouped by region with on-demand AI Summary / Predict / Trace Cause per topic.
- **Primary user job:** Skim the day's stories, then deep-dive into one with AI analysis.
- **Data sources:** `useGeminiTopics()` (action `topics`, 1 h LocalStorage cache), `useTodayArchive()`, REST actions `summary` / `prediction` / `trace_cause` on click.
- **Auth gate:** None — fully public.
- **Inbound links:** Default landing, top-nav "Topics", brand logo (`Layout.jsx:55`), Home backlinks from Daily/Thread/Country topbars.
- **Outbound links:** Country pills → `/weekly/country/:name` (line 351); thread titles → `/weekly/thread/:threadId` (line 360); "Story arc →" → `/weekly`; external source URLs.
- **Key UI elements:** EditorialShell 3-col; left rail `TodayArchiveSidebar` + Coffee CTA; right rail `TopicNav`; center masthead + per-region topic cards with AI button trio + collapsible Sources.
- **States:** loading spinner (lines 320-324); **no empty-state UI** if `topics.length === 0` (silent); errors push to global `ErrorModal`; stale/fresh banners with refresh.
- **Smoke-test:**
  1. Open `/` — topics render grouped by region.
  2. Click "Summary" on any topic — AI summary appears below it.
  3. Click a country pill — navigates to `/weekly/country/<name>`.
- **Known issues:** AI buttons retry 6× on cache-miss/503; collision risk in `getTopicId` if titles ever repeat in one array.

## `/daily` and `/daily/:dateKey` · `components/DailyPage.jsx`

- **Purpose:** A single editorial Daily Intelligence Brief — lead story, top stories, rising thread, country to watch.
- **Primary user job:** Read one curated daily summary instead of browsing topics.
- **Data sources:** `useDailyBrief(dateKey)` → `proxyAction('daily_brief', { dateKey })`.
- **Auth gate:** None.
- **Inbound links:** Top-nav "Daily"; rising-thread blocks elsewhere; Layout topbar "← Home"; social shares.
- **Outbound links:** Date arrows → `/daily/{prev|next}`; country links → `/weekly/country/:name`; rising thread → `/weekly/thread/:threadId`; "Weekly Analysis →" → `/weekly`.
- **Key UI elements:** Date-nav topbar (prev/next + Share/Copy/Save); masthead with article/country/outlet counters; Lead story with AI prediction sidecar; numbered Top Stories; Rising Thread card; Country to Watch card; method grid; category breakdown chips.
- **States:** loading = `<IntelligenceLoader type="typewriter" />`; **empty** = "No brief available" card with prev-day link; **error** falls through to empty (not shown).
- **Smoke-test:**
  1. `/daily` — today's brief loads (article/country/outlet counters non-zero).
  2. Click "Previous day" — URL changes to `/daily/YYYY-MM-DD`, content updates.
  3. Click a country chip in a top story — navigates to country page.
- **Known issues:** Imports color constants from `WeeklyPage` (cross-page coupling). `nextDateKey` can navigate into the future (only the link's visibility is gated).

## `/map` · `components/WorldMapV2.jsx`

- **Purpose:** Interactive D3 + topojson choropleth with three layers (Today's pulse / Connections / Editorial) and a per-country detail panel.
- **Primary user job:** See where news is concentrating geographically and drill into a country.
- **Data sources:** `useCountrySignal`, `usePairAnalyses`, `useGeminiTopics`, `useWeeklyArchive`, `useCountryIntelligence([selected])`, `useCountryHistory`, `useSystemsAnalysis`, `useMarketsCountry` (lines 155-171).
- **Auth gate:** None.
- **Inbound links:** Top-nav "Map".
- **Outbound links:** Country panel → `/weekly/country/:name`.
- **Key UI elements:** SVG world map; layer toggles (Today / Connections / Editorial); signal-level checkboxes (H/E/L); flow-color filters; time-window selector; country search bar (in document flow as of commit e4a1d99); collapsible rail + detail panel with sparkline.
- **States:** map renders when TopoJSON resolves; no explicit loading UI for the map itself.
- **Smoke-test:**
  1. `/map` — world renders with country fills + markers.
  2. Toggle "Connections" layer — bilateral arcs appear between countries.
  3. Click a country — detail panel populates with intel + sparkline + systems edges.
- **Known issues:** Causal Graph fix landed 2026-04-27/28 (use `nodeMap[id].summary`, treat `e.confidence` as string label not 0-1 float).

## `/weekly` · `components/WeeklyPage.jsx`

- **Purpose:** Story-arc browser — multi-day threads grouped by category, filterable by region/country/time.
- **Primary user job:** Find evolving multi-day stories and jump into one.
- **Data sources:** `useWeeklyArchive()` (action `archive_range`, 30 days, 30 min cache), `useThreadAnalyses(qualifyingThreadIds)`. *(The `useUserProfile()` tier-display hook the original sweep listed here was removed in the 2026-06-01 billing teardown.)*
- **Auth gate:** None.
- **Inbound links:** Top-nav "Threads"; rising-thread cards from Daily; "Weekly Analysis →" from Daily.
- **Outbound links:** StoryCard → `/weekly/thread/:threadId`; tab toggle "Map" lazy-loads `WeeklyMap` in-page.
- **Key UI elements:** EditorialShell with left rail (search, period, sort, region, view toggle), right rail "Rising This Week" featured list, center category-grouped collapsible StoryCard list, Standalone Section for single-mention entries.
- **States:** loading = typewriter loader; **empty** = `weekly-empty-state` card; **filter empty** = "No stories match your current filters"; error = inline `weekly-error`.
- **Smoke-test:**
  1. `/weekly` — category groups render with story cards.
  2. Type in left-rail search — cards filter live.
  3. Click a StoryCard — navigates to `/weekly/thread/:threadId`.
- **Known issues:** Exports color/order constants consumed by Daily / Thread / CountryPage / CountryListPage — central source of truth lives here.

## `/weekly/thread/:threadId` · `components/ThreadPage.jsx`

- **Purpose:** Single story-arc deep dive — timeline, actors, sources + AI rail with Summary / Trajectory / Trace / Watch.
- **Primary user job:** Read the full evolution of one narrative thread.
- **Data sources:** `useWeeklyArchive()` (filtered by `threadId`), `useThreadAnalyses([threadId])`. *(`useUserProfile()` was removed in the 2026-06-01 billing teardown.)*
- **Auth gate:** None.
- **Inbound links:** Home topics with `threadId`; every WeeklyPage StoryCard; Daily "Rising Thread"; country page arc tab. `?from=country&country=Foo` rewires breadcrumb (line 54).
- **Outbound links:** Topbar Home → `/`; conditional country breadcrumb → `/weekly/country/:name`; "Threads" → `/weekly`; left-rail related threads → other `/weekly/thread/:id`.
- **Key UI elements:** Topbar (Share/Copy/Save); status strip (RISK label or ⚑ INFLECTION); 4-stat row (Risk / Events / Sources / Sentiment); content tabs (Timeline / Actors / Sources); CompactTimeline; AI rail with 4 tabs + Key Actors + Live Web Evidence.
- **States:** loading = typewriter; **not found** = "Story arc not found" with back link; success = full layout. Falls back to plain timeline if `analyses` missing.
- **Smoke-test:**
  1. From `/weekly`, click any card — page renders with H1, dek, 4-stat row.
  2. Switch AI rail tab to "What's Next" — trajectory text appears.
  3. Switch content tab to "Sources" — source rollup renders.
- **Known issues:** `RISK_COLOR` switches at hard thresholds 75/50.

## `/weekly/countries` · `components/CountryListPage.jsx`

- **Purpose:** Index of countries with AI briefings — map hero + sortable grid + leaderboard.
- **Primary user job:** Browse to a specific country's intel page.
- **Data sources:** `useWeeklyArchive()`, `useCountryIntelligence(top 10 country names)` (lines 213-214).
- **Auth gate:** None.
- **Inbound links:** Top-nav "Countries".
- **Outbound links:** Every card / leaderboard row / map pin → `/weekly/country/:name`.
- **Key UI elements:** Full-bleed `CountryOverviewMap` hero with legend; EditorialShell with left rail (search/sort/region) and right rail leaderboards (Highest Risk + Most Covered, 5 each); center "AI Briefings" grid + "Other countries" (no AI briefing yet) section.
- **States:** loading text only; filter-no-match silently hides featured grid.
- **Smoke-test:**
  1. `/weekly/countries` — map + grid render.
  2. Click a country pin on the map — navigates to its page.
  3. Sort "Coverage" — cards reorder.
- **Known issues:** Only fetches intel for top 10 — others fall into "no AI briefing" even when intel exists in DDB.

## `/weekly/country/:countryName` · `components/CountryPage.jsx`

- **Purpose:** Per-country intelligence briefing — situation, story arcs, coverage timeline + actors/risk/markets/causal-graph rails.
- **Primary user job:** Understand one country's current global signal and drill into its arcs.
- **Data sources:** `useWeeklyArchive`, `useCountryIntelligence`, `useThreadAnalyses(arcIds)`, `useMarketsCountry`, `useCountryHistory`, `useSystemsAnalysis`.
- **Auth gate:** None.
- **Inbound links:** Home country pills, Daily country chips, CountryListPage cards/map, ThreadPage breadcrumb with `?from=country`.
- **Outbound links:** Breadcrumb → `/weekly/countries`; sibling country → `/weekly/country/:other`; arc thread → `/weekly/thread/:id?from=country&country=:name`.
- **Key UI elements:** EditorialShell + WeeklyMap hero (`embedded`); status strip; left rail (sibling countries + facets: arc-type/category/urgency + actor chips); 3 main tabs (Situation / Story Arcs / Coverage); right rail with Key Actors, Risk Assessment + sparkline, What to Watch, Live Web Evidence, Causal Graph, Macro Snapshot, FX.
- **States:** loading = typewriter; auth-loading returns `null` (flash on first paint); empty intel → page still renders from raw archive (right-rail sections gate themselves).
- **Smoke-test:**
  1. `/weekly/country/Iran` — hero + tabs render with non-zero stats.
  2. Click "Story Arcs" tab, pick an arc — navigates to ThreadPage with `?from=country`.
  3. Toggle "Anchor only" facet — arc list filters.
- **Known issues:** Causal Graph shares the `summary`/`threadId` fix from WorldMapV2 (line 599-600).

## `/economy` · `components/EconomyPage.jsx`

- **Purpose:** The "markets-meets-news command center" — an instrument-first view of what today's news is repricing, across all active stories. Rebuilt to the editorial mockup 2026-05-27 (own masthead band + 3-col shell, **not** EditorialShell).
- **Primary user job:** Two modes — (1) **orient-me:** read the "Today in the economy" lead briefing for the day's synthesis; (2) **lookup:** start from an instrument ("what's moving Brent, and why?") and trace a move back to the news driving it.
- **Data sources:** `useDisruptionsList` (economic-impact records), `useTopMovers` (`economic_top_movers` — leaderboard), `useMarketsGlobal` (`markets_global`, incl. the `series` map for change% + sparklines), `useMarketsHistory` (`markets_history` — the 30-day expand sparkline). Price history is Yahoo-seeded (`newsMarketsData {source:"seed_history"}`).
- **Auth gate:** None — fully public.
- **Inbound links:** Primary nav "Economy" (last of 6); footer; Daily "Today's Economic Footprint → View all". (Most in-content economic surfaces deep-link to the per-story *thread* Economy tab `?tab=economy`, not here.)
- **Outbound links:** Leaderboard expand + by-story bridge → `/weekly/thread/:scopeId?tab=economy`; affected-country chips → `/weekly/country/:name`; disclaimer → `/disclosures`.
- **Key UI elements:** **"Today in the economy" briefing band** (full-width lead under the masthead) — deterministic synthesis (story count + severity split + most-cited cluster + sharpest story link + sanitized realized moves with consensus-vs-realized divergence flagged) composed by `utils/composeEconomyBriefing.js`, honesty-checked by `quality/briefing/assertions.js`. Then the two-layer model — center **leaderboard** ("Repricing today": per-instrument consensus + magnitude + live level + day-over-day change% + story count; expand → **"Why it's moving" cross-story synthesis line** (`.ep-why` — deterministic consensus split + lean + modal magnitude + closest-analog realized move, via `composeInstrumentWhy`, honesty-checked, no forecast) + 30-day sparkline + Key-levels + 5-col driving-stories sub-table incl. analog *realized move* + country chips) + dormant drawer + severity-grouped by-story bridge; right rail **watchlist Market Context** (mini-sparkline + level + ▲/▼ change% per row, AI-independent). Left rail facets (severity/horizon/country).
- **Quality verdict:** flagged records (`is_low_quality`, from `newsEconomicQuality`) show the `QualityFlag` ⚑ chip in the by-story bridge + the expanded driving-stories sub-table; the briefing's sharpest-story pick + the instrument analog pick skip flagged records. The expanded driving-stories list is severity-sorted and capped at 6 + "Show N more".
- **States:** loading/empty/error inline; honest degradation where data is absent (no faked %/sparkline/analog).
- **Smoke-test:** (1) `/economy` — leaderboard + watchlist rail render with real levels. (2) Click an instrument row — expands to sparkline + driving-stories table. (3) Click a driving story — lands on its thread Economy tab.
- **Usage (CloudWatch proxy, 2026-05-27):** the **#2 content page** after Home — well ahead of Threads/Daily/Map/Countries (≈28 `economic_top_movers` loads/wk + 31 expands vs. ≤9 for other sections). Discovery is **not** a gap; site-wide traffic is low overall.
- **Known issues:** a heavily-cited instrument lists all its stories on expand (no "top N" cap yet); `markets_global` is over-counted in logs because the hook background-refreshes every 5 min.

## `/analyze` · `components/AnalysisStudio.jsx`

- **Purpose:** BYOK ("bring your own key") self-serve analysis — pick ≤4 of today's stories, choose a lens or ask your own question, get a **cited deep-dive built from our own intelligence** (cached `SUMMARY`/`PREDICTION`/`TRACE_CAUSE`). A member "run it on our compute" path exists alongside BYOK.
- **Primary user job:** Go beyond reading — interrogate the day's stories with an LLM and get a sourced, honesty-checked write-up.
- **Data sources:** `useGeminiTopics()` (the selectable story list), `useAuth()` (registration gate), `useMembership()` (member vs BYOK). The analysis itself does **not** go through `restProxy`: `services/llm.js` `runChat()` calls the user's chosen provider **directly from the browser** with the user's own key. Member path instead calls `runMemberAnalysis()` (`restProxy` → `newsAnalyze` Lambda, our DeepSeek compute) when `analyzeConfigured()`. Supporting utils: `utils/analysis` (cited-context builder + prompts), `utils/analysisValidator` (honesty checks), `utils/sourceRobustness` (source-basis line), `utils/byok` (localStorage key store), `ProviderModal`.
- **Auth gate:** **Registered-only** — anonymous/guest users hit a blocking `as-gate` overlay ("Sign in to analyze"). This gate is scoped to this feature; it does not touch the public content hooks.
- **Inbound links:** Primary nav "Analyze" (`Layout.jsx:53`); Account → "Analysis Studio API key" tab → "Go to Analysis Studio →" (`Account.jsx:67`).
- **Outbound links:** Gate overlay → `/signin` and `/` (`AnalysisStudio.jsx:409-410`); "Run it on us with a membership →" → `/membership` (`:285`, shown to non-members when billing is available); `ProviderModal` (provider/model/key chooser — writes to `localStorage` only).
- **Key UI elements:** model chip (`provider · model`, or "Member · included"); **Step 1** select-stories list (`{n}/4` counter, disables at max); **Step 2** mode switch — **Guided lens** (5 fixed `LENSES`) / **Free-form** / **Deep research `web`** (the latter disabled with a reason for non-search providers — a no-search API can't honestly "search the web"); **Run** button; output = `Markdown` report + validator banner (`checks`: phantom-citation / invented-figure / invented-date / no-citations / thin-input) + **"Source basis"** robustness line + model-retrieved web-sources list (deep mode) + citations.
- **States:** topics loading/empty; **blocked** = sign-in gate; **running** = in-flight; **error** — a key/auth error (`401/403/invalid…`) points the user at the key editor, `daily_limit` → "reached today's limit", `membership_required` → needs membership. Honesty guardrails run on the *returned* text, not just the prompt.
- **Smoke-test:**
  1. Signed in, open `/analyze` — today's stories list renders; gate overlay is absent.
  2. Select a story, pick a Guided lens, set a key via the model chip, click **Run** — a cited report renders with a pass/verify/flag banner.
  3. Switch to "Deep research" with a non-search provider — the mode is disabled with an explanatory tooltip.
- **Known issues:** deep-research (Perplexity/Anthropic web search) plumbing is not yet live-tested (no key on hand); the member "our compute" path is a **no-op until `window.POLAR_BILLING_ENDPOINT` + the analyze endpoint are wired** (`useMembership().available` stays false), so today every run is BYOK.

## `/weekly-brief` · `components/WeeklyBriefPage.jsx`

- **Purpose:** A serif long-read of the latest **published** Weekly Signals Brief — a *signals digest* (discrete signals ranked by risk + a "what to watch" list), **not** a synthesized essay.
- **Primary user job:** Catch up on the week in one screen: the highest-risk signals, each with a one-line "so what" and its sources.
- **Data sources:** `useWeeklyBrief()` → `weekly_brief` action (latest `status:'published'` brief; null until one is published via `weekly/review.js`); 30-min cache. `Markdown.jsx` is used only for the backward-compatible legacy prose format.
- **Auth gate:** None.
- **Inbound links:** Primary nav "Weekly Brief" (`Layout.jsx:48`).
- **Outbound links:** Per-signal **source outlets** (external article URLs) only — signals do **not** currently deep-link into thread/country pages; `related` is plain text.
- **Key UI elements:** eyebrow + dateline (week-of / compiled / N signals); KPI row (signals tracked / highest risk / at high risk / to watch); `SignalCard` list — lede + **kind chip** (a color-coded `RISK` chip for `threat` signals, a neutral `DEVELOPMENT` chip for cooperative stories so they aren't shown as red risk) + region/as-of + fact + "So what" + source outlets; "What to watch" rows; methodology footer (risk/sources/dates are computed; the "so what" is editorial, not a prediction).
- **States:** loading / error / **no brief published yet** (honest empty) / signals success / legacy-prose fallback.
- **Smoke-test:**
  1. `/weekly-brief` — the latest published brief renders with a dateline + KPI row.
  2. A `threat` signal shows a colored RISK chip; a `development` signal shows a neutral DEVELOPMENT chip.
  3. Click a signal's source outlet — opens the external article in a new tab.
- **Known issues:** signals link external sources only — there is no internal link into the corresponding `/weekly/thread/:id`, so a reader can't jump from a signal to its full arc.

## `/track-record` · `components/TrackRecordPage.jsx`

- **Purpose:** The public forecast-accountability scoreboard — every published prediction is logged with dated, falsifiable triggers; as deadlines pass and a human confirms each verdict, this page shows the running Brier score + calibration.
- **Primary user job:** Judge whether the site's forecasts actually pan out before trusting them.
- **Data sources:** `useTrackRecord()` → `prediction_track_record` action (DDB Scan of `GlobalPerspectivePredictionLog`); 30-min cache.
- **Auth gate:** None.
- **Inbound links:** Primary nav "Track Record" (`Layout.jsx:54`); footer "Track Record" (`Layout.jsx:184`).
- **Outbound links:** None — citations are plain text, not links.
- **Key UI elements:** 4 stat cards (predictions logged / dated trigger signals / resolved & scored / awaiting deadline); **Brier score** + verdict pill (`excellent ≤0.1` / `strong ≤0.2` / `fair ≤0.25` / `weak`); **calibration** table (stated-probability bucket vs actual fired-rate bar); "Recently resolved" list with ✓ Fired / ✗ Did-not-fire pills.
- **States:** loading = `IntelligenceLoader`; error/no-data = "temporarily unavailable"; **`resolvedTriggers === 0` → honest pending state** ("Scoring begins as deadlines pass" — deliberately shows nothing rather than a fabricated number).
- **Smoke-test:**
  1. `/track-record` — the 4 stat cards render with real counts.
  2. If any trigger has resolved, the Brier score + calibration table render; otherwise the honest "scoring begins…" copy shows.
  3. A recently-resolved item shows a Fired/Did-not-fire pill + its citation.
- **Known issues:** none functional — the page is gated to honesty by design (empty until human-confirmed verdicts exist).

## `/membership` · `components/MembershipPage.jsx`

- **Purpose:** Polar subscription checkout — the paid tier that runs Analysis Studio on **our** compute (no BYOK) and bundles the full intelligence layer.
- **Primary user job:** Subscribe (or, if already a member, confirm status and jump to Account).
- **Data sources:** `useAuth()`, `useMembership()` (`membership` / `isMember` / `available`), `createCheckout(plan)` (`restProxy` → Polar checkout URL).
- **Auth gate:** Public page, but **subscribing requires a signed-in (non-anonymous) account** — otherwise the plan button becomes "Sign in to subscribe" → `/signin`.
- **Inbound links:** AnalysisStudio "Run it on us with a membership →" (`AnalysisStudio.jsx:285`). (Not currently in the primary nav or footer.)
- **Outbound links:** `/signin` (when not signed in); `/account` ("Manage in Account", shown to active members); external **Polar** checkout via `window.location` on subscribe.
- **Key UI elements:** benefits list; two plan cards (Monthly $15 / Annual $150 "Best value"); subscribe buttons; "membership isn't open yet" notice when `!available`; active-member badge + renews-date; Polar Merchant-of-Record fineprint.
- **States:** `!available` → "not open yet" notice; `isMember` → active badge; else plan cards; per-plan `busy` ("Starting checkout…"); inline error.
- **Smoke-test:**
  1. `/membership` — benefits + plan cards (or the "not open yet" notice) render.
  2. Signed out, click a plan — it routes to `/signin`.
  3. Signed in with billing wired, click a plan — redirects to the Polar checkout URL.
- **Known issues:** gated behind `window.POLAR_BILLING_ENDPOINT` — `useMembership().available` is false until that's set, so checkout is **not live yet** (the page shows the "not open yet" notice in production today). See `POLAR_BILLING_PLAN.md`.

## `/weekly-map` · `components/WeeklyMap.jsx`

- **Purpose:** Standalone Google-Maps-based weekly story map with date playback per thread / per country.
- **Primary user job:** Watch story evolution geographically over the 30-day window.
- **Data sources:** `useWeeklyArchive`, `useThreadAnalyses(qualifyingThreadIds)`, `@googlemaps/react-wrapper`.
- **Auth gate:** None.
- **Inbound links:** Weekly "Map" view toggle; Account quick-link. **Not in primary nav.**
- **Outbound links:** MapSidePanel cards into thread/country pages.
- **Key UI elements:** Google map; thread highlight via `?thread=`; region filter via `?region=`; date playback; MapSidePanel; CompactTimeline.
- **States:** depends on `useWeeklyArchive` loading; no explicit top-level empty.
- **Smoke-test:**
  1. `/weekly-map` — Google map renders.
  2. Click a thread in the side panel — markers + arcs filter to that thread.
  3. Use playback controls — date advances; markers update.
- **Known issues:** Two map experiences (`/map` and `/weekly-map`) is potentially confusing.

## `/intelligence-map` · `components/IntelligenceMap.jsx`

- **Purpose:** Showcase page for four loader animation variants.
- **Primary user job:** Preview animations used in `IntelligenceLoader`.
- **Data sources:** `useGeminiTopics()` only.
- **Auth gate:** None.
- **Inbound links:** **None** — direct URL only. **Orphan.**
- **Outbound links:** None.
- **Key UI elements:** Tabs A/B/C/D, animated SVG canvas.
- **States:** "Loading topics…" when no data; otherwise tab content.
- **Smoke-test:**
  1. Open `/intelligence-map` — tab A animation runs.
  2. Switch to tab D — "Exploding Paragraph" plays.
  3. Switch tabs back — animations remount via `key`.
- **Known issues:** Orphan. Only tabs C and D are shipped variants; A and B are experimental.

## `/signin` · `components/SignIn.jsx`

- **Purpose:** Authentication entry — Google popup, email magic link, or anonymous guest.
- **Primary user job:** Get signed in to access account features (saved items).
- **Data sources:** `useAuth()` → `signInWithGoogle`, `sendSignInLink`, `signInAsGuest`.
- **Auth gate:** None (public entry).
- **Inbound links:** Layout "Sign in" button when anonymous; Account redirect for guests on gated content; AuthCallback failure "Try again".
- **Outbound links:** On success → `/weekly`. Privacy / Disclosures footer links.
- **Key UI elements:** Logo, Google button, email input + magic-link submit, "Continue as guest", fine-print Privacy/Disclosures.
- **States:** **sent** = "Check your inbox" card; **error** = inline `weekly-gate-error`; per-method loaders.
- **Smoke-test:**
  1. Open `/signin`.
  2. Enter email + click "Send magic link" — "Check your inbox" view appears.
  3. Click "Continue with Google" — popup flow opens.
- **Known issues:** Hardcoded redirect to `/weekly` on success (no `returnTo` support); `auth/popup-closed-by-user` silently swallowed.

## `/auth/callback` · `components/AuthCallback.jsx`

- **Purpose:** Consume the email magic-link URL and complete Firebase sign-in.
- **Primary user job:** Finish the handshake from the inbox link.
- **Data sources:** `useAuth().completeSignIn(window.location.href)`.
- **Auth gate:** Used during auth.
- **Inbound links:** Email magic-link only.
- **Outbound links:** Success → `/weekly`; failure → `/signin` via "Try again".
- **Key UI elements:** Typewriter loader; error card on failure.
- **States:** loading, error.
- **Smoke-test:**
  1. Click magic-link email — lands here.
  2. Loader animates.
  3. Redirects to `/weekly` within ~1 s.
- **Known issues:** No success state — straight redirect.

## `/account` · `components/Account.jsx`

- **Purpose:** User account hub — saved items, notification prefs, and the Analysis Studio BYOK key.
- **Primary user job:** Manage saved threads/countries/dailies, toggle email notifications, view/change/remove the analysis API key, sign out.
- **Data sources:** `useAuth()`, `useSavedItems()` (newsSavedItems Function URL), `usePreferences()` (Notifications tab → `newsRecommend get/set_prefs`), `utils/byok` + `ProviderModal` (Analysis key tab). *(The old `fetchUserProfile()` / `user_profile` JWT call and the tier/billing-portal UI were removed in the 2026-06-01 billing teardown — Account no longer reads a profile or a subscription tier.)*
- **Auth gate:** **Requires real sign-in** — anonymous/guest redirected to `/signin` (`Account.jsx:491`).
- **Inbound links:** Layout account button (when signed in).
- **Outbound links:** Analysis-key tab → "Go to Analysis Studio →" `/analyze` (`:67`); saved cards → `/weekly/thread/:id`, `/weekly/country/:name`, `/daily/:dateKey`; sign-out → `/`; delete account → mailto.
- **Key UI elements:** **four tabs** via `?tab=` (default `saved`) — **Profile** (avatar + identity + "Since" date + sign-out + delete-account), **Saved** (chip filter + grid of cards with heart toggle), **Notifications** (email opt-ins), **Analysis** (BYOK key view/change/remove + link to `/analyze`).
- **States:** auth loading (redirects anon to `/signin`); saved loading; saved empty = "Nothing saved yet".
- **Smoke-test:**
  1. Sign in then click email in Layout — lands on `/account?tab=saved`.
  2. Switch to the Analysis tab — the stored key (masked) or a "Set up a key" prompt appears.
  3. Click a saved thread card — opens the thread page.
- **Known issues:** the Profile tab no longer surfaces membership status — there's no in-Account link to `/membership` even though billing now flows through Polar; `Pair` itemType has no `getItemHref` mapping (saved Pair items can't be opened).

## `/upgrade/success` · `components/UpgradeSuccess.jsx`

- **Purpose:** Post-Paddle-webhook landing — polls user profile until tier reflects paid status.
- **Primary user job:** Confirm subscription upgrade went through.
- **Auth gate:** Implicit — needs `user` for profile poll.
- **Inbound links:** Paddle checkout success redirect only.
- **Outbound links:** "Go to Weekly →" once confirmed; fallback to `/weekly` / `/account`.
- **States:** polling, confirmed, stuck-after-5-attempts.
- **Smoke-test:** Effectively unreachable in early-access mode (Paddle dormant). Manual URL test only.
- **Known issues:** Paddle code dormant per project memory.

## Static pages

### `/about` · `AboutContact.jsx`
Marketing about page — What We Do, How It Works, sources, contact. Footer-reachable. Outbound: `/whitepaper`, `/privacy`, `/disclosures`, mailto.

### `/contact` · `Contact.jsx`
Three contact-method cards. **Effectively orphaned** — Layout footer "Contact" is a `mailto:` link (`Layout.jsx:156`), bypassing this route.

### `/privacy` · `PrivacyTerms.jsx`
Privacy + terms combined. Footer-reachable. *(The earlier "still references Stripe" note is resolved — no Stripe/Paddle/Polar string remains in the component as of 2026-06-22.)*

### `/disclosures` · `Disclosures.jsx`
AI-content disclaimers and forward-looking carve-outs. Footer-reachable.

### `/whitepaper` · `WhitepaperPage.jsx`
Long-form technical white paper. Footer-reachable + linked from About.

### `/cli` · `CLIPage.jsx`
Marketing page for the `gp` Node CLI. **Orphan** — no inbound links.

### `/test/briefing-card` · `BriefingCardTest.jsx`
Dev preview of canvas-rendered shareable images. **Dev-only orphan exposed as public route** — should be gated or removed from prod build.

---

## Site map (graph)

```
Layout (always)
 ├─ nav:        Topics(/) · Daily(/daily) · Weekly Brief(/weekly-brief) · Map(/map) · Threads(/weekly)
 │              · Countries(/weekly/countries) · Economy(/economy) · Analyze(/analyze) · Track Record(/track-record)
 ├─ nav-right:  Sign in(/signin) | Account(/account)  [conditional]
 └─ footer:     Economy · Track Record · About · White Paper · Privacy · Disclosures · Contact(mailto)

PRIMARY GRAPH
  /  Home
   ├─ thread title  →  /weekly/thread/:id
   ├─ country pill  →  /weekly/country/:name
   └─ "Story arc →" →  /weekly

  /daily(/:dateKey)
   ├─ ← Home  →  /
   ├─ date arrows  →  /daily/{prev|next}
   ├─ country chip  →  /weekly/country/:name
   ├─ Rising Thread card  →  /weekly/thread/:id
   └─ "Weekly Analysis →" →  /weekly

  /weekly
   ├─ StoryCard  →  /weekly/thread/:id
   └─ "Map" toggle  →  embedded WeeklyMap (same route)

  /weekly/thread/:threadId
   ├─ topbar Home  →  /
   ├─ breadcrumb  →  /weekly  OR  /weekly/country/:name (?from=country)
   └─ related threads  →  /weekly/thread/:id

  /weekly/countries
   └─ card / leaderboard / map pin  →  /weekly/country/:name

  /weekly/country/:countryName
   ├─ breadcrumb  →  /weekly/countries
   ├─ sibling  →  /weekly/country/:other
   └─ arc  →  /weekly/thread/:id?from=country

  /map (WorldMapV2)
   └─ country panel  →  /weekly/country/:name

STANDALONE / NAV-ONLY PAGES (added 2026-06-22)
  /analyze (AnalysisStudio)   ← nav "Analyze"; Account "Analysis" tab
   ├─ sign-in gate  →  /signin  |  /
   └─ "Run it on us…"  →  /membership
  /weekly-brief (WeeklyBriefPage)  ← nav "Weekly Brief"
   └─ per-signal sources  →  external article URLs (no internal links)
  /track-record (TrackRecordPage) ← nav + footer "Track Record"
   └─ (no outbound links)
  /membership (MembershipPage)    ← /analyze "Run it on us…"
   ├─ not signed in  →  /signin
   ├─ active member  →  /account
   └─ subscribe      →  external Polar checkout

AUTH GRAPH
  /signin
   ├─ Google / magic-link / guest  →  /weekly  on success
   └─ Privacy / Disclosures (footer)
  /auth/callback  →  /weekly  (success)  |  /signin  (error)
  /account  →  /signin  (if anonymous)  |  saved cards →  /weekly/thread|country|daily/...  |  Analysis tab →  /analyze

ORPHAN / SECONDARY
  /weekly-map         ← only via Weekly toggle / Account quick-link
  /intelligence-map   ← NO INBOUND LINKS — orphan
  /cli                ← NO INBOUND LINKS — orphan
  /contact            ← effectively orphan (footer Contact is mailto)
  /test/briefing-card ← DEV-ONLY, exposed as public route
```

---

## Orphan check (quick reference)

| Route | Nav/footer reachable? | Notes |
|---|---|---|
| `/`, `/daily`, `/map`, `/weekly`, `/weekly/countries`, `/economy` | ✓ (primary nav) | `/economy` is in nav + footer; CloudWatch proxy shows it's the #2 content page — NOT an orphan |
| `/weekly-brief`, `/analyze`, `/track-record` | ✓ (primary nav) | added 2026-06-22; `/track-record` is also in the footer; `/analyze` is also linked from Account's Analysis tab |
| `/weekly/thread/:id`, `/weekly/country/:name` | ✓ (indirect via list pages) | |
| `/membership` | ⚠️ reachable, low-discoverability | only inbound is the `/analyze` "Run it on us…" link — not in nav or footer; checkout is dormant until Polar is wired |
| `/signin`, `/account` | ✓ (Layout right-side) | |
| `/auth/callback` | ✓ (inbound from email magic-link) | |
| `/about`, `/privacy`, `/disclosures`, `/whitepaper` | ✓ (footer) | |
| `/contact` | ❌ effectively orphan | footer "Contact" is a mailto |
| `/__boom` | ⚠️ dev-only, unlinked | inline `Boom` component that throws — exists to exercise the `ErrorBoundary`; reachable only by typing the URL |
| `/weekly-map`, `/intelligence-map`, `/cli`, `/upgrade/success`, `/test/briefing-card` | ⛔ REMOVED 2026-05-28 | no longer registered in `App.jsx` — entries above are historical |

---

## Data ownership map (hook × page)

| Hook | Home | Daily | Map | Weekly | Thread | CountryList | CountryPage | WeeklyMap | IntelMap | Account |
|---|---|---|---|---|---|---|---|---|---|---|
| `useGeminiTopics` | ✓ | | ✓ | | | | | | ✓ | |
| `useTodayArchive` | ✓ | | | | | | | | | |
| `useDailyBrief` | | ✓ | | | | | | | | |
| `useWeeklyArchive` | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `useThreadAnalyses` | | | | ✓ | ✓ | | ✓ | ✓ | | |
| `useCountryIntelligence` | | | ✓ | | | ✓ (top 10) | ✓ | | | |
| `useCountryHistory` | | | ✓ | | | | ✓ | | | |
| `useSystemsAnalysis` | | | ✓ | | | | ✓ | | | |
| `useMarketsCountry` | | | ✓ | | | | ✓ | | | |
| `useCountrySignal` | | | ✓ | | | | | | | |
| `usePairAnalyses` | | | ✓ | | | | | | | |
| `useSavedItems` | | | | | | | | | | ✓ |
| `useAuth` | | ✓ | | ✓ | ✓ | | ✓ | | | ✓ |

*(The `useUserProfile` row from the original sweep is gone — the hook was deleted in the 2026-06-01 billing teardown.)*

### New pages added 2026-06-22 (hook × page)

| Hook | Analyze | WeeklyBrief | TrackRecord | Membership |
|---|---|---|---|---|
| `useGeminiTopics` | ✓ (story list) | | | |
| `useAuth` | ✓ (reg. gate) | | | ✓ |
| `useMembership` | ✓ | | | ✓ |
| `useWeeklyBrief` | | ✓ | | |
| `useTrackRecord` | | | ✓ | |

Plus non-hook data paths: `/analyze` calls `services/llm.js` `runChat()` (BYOK, browser→provider) and `restProxy` `runMemberAnalysis()`/`analyzeConfigured()`; `/membership` calls `restProxy` `createCheckout()`.

**Still not consumed by any routed page:** `useArticles`, `useBookmarks`, `useSummary`, `usePrediction`, `useTraceCause`, `useResearchBriefing`, `usePairAnalyses` (Pair pages are no longer routed), `usePairIntelligence`. See `OPTIMIZATION_REPORT.md` OPT-22 (dead hooks). *(`useMarketsGlobal` was in the original not-consumed list but is consumed by `/economy` — corrected 2026-06-22.)*

---

## Regression sweep checklist (use before release)

Following Yuri Kan's 3-layer smoke model: **L1 Infrastructure → L2 Component → L3 Integration**. Target <10 minutes total.

### L1 — Infrastructure (1 min)
- [ ] `curl https://globalperspective.net/` returns 200.
- [ ] `curl https://globalperspective.net/rss` has ≥ 1 `<item>`.
- [ ] `curl -X POST <SENSITIVE_PROXY_ENDPOINT> -d '{"action":"topics"}'` returns ≥ 1 topic.

### L2 — Component (5 min) — visit each primary nav page
For each of `/`, `/daily`, `/weekly-brief`, `/map`, `/weekly`, `/weekly/countries`, `/economy`, `/analyze`, `/track-record`, run the 3-step smoke from the per-page sections above. Pages should all render without console errors. (`/analyze` requires a signed-in account to clear its gate.)

### L3 — Integration (4 min) — golden user journeys
- [ ] **Anonymous → topic deep dive:** Land on `/` → click country pill → land on `/weekly/country/X` → click an arc → land on `/weekly/thread/Y` → AI rail "What's Next" populates.
- [ ] **Anonymous → daily reader:** Land on `/daily` → click "Previous day" twice → click country chip → land on country page.
- [ ] **Auth flow:** Open `/signin` → magic-link email → click link → `/auth/callback` → redirected to `/weekly` signed in.
- [ ] **Saved items:** From any thread page click the heart (Save) → open `/account?tab=saved` → unsave → card disappears.

---

## Cross-cutting findings

1. **~~Map duplication.~~** ✅ Resolved — `/weekly-map` was removed (2026-05-28); `/map` (WorldMapV2 / D3) is now the only routed map. `WeeklyMap.jsx` survives only as an embedded hero inside CountryPage.
2. **~~Dead imports in `App.jsx`~~** ✅ Resolved — `Pricing`, `PairPage`, `PairListPage` are no longer imported in `App.jsx` (verified 2026-06-22).
3. **~~`Gate` wrapper unused~~** ✅ Resolved — the `Gate`/`isPreview` leftover is gone from `App.jsx`.
4. **~~PrivacyTerms still mentions Stripe~~** ✅ Resolved — no Stripe/Paddle/Polar string remains in `PrivacyTerms.jsx` (2026-06-22).
5. **~~`/test/briefing-card` ungated~~ / ~~`/intelligence-map`, `/cli` orphans~~** ✅ Resolved — all three routes were removed (2026-05-28).
6. **`/membership` is barely discoverable** — its only inbound link is the `/analyze` "Run it on us…" CTA; it's absent from nav and footer. Once Polar checkout is live (`window.POLAR_BILLING_ENDPOINT`), it likely wants a nav/Account entry.
7. **Layout search button** (`Layout.jsx:105-111`) renders the ⌘K affordance but only `preventDefault()`s the keystroke — no search modal exists yet.
8. **Auth posture:** every *content* route is public; `/account` redirects anonymous users to `/signin`, and `/analyze` blocks them with an in-page gate (registered-only). `/membership` is viewable by anyone but subscribing requires sign-in.
9. **`/__boom` is a public dev route** — the `Boom` error-boundary test component throws on render and is registered in `App.jsx`. Harmless (unlinked) but ideally dev-only.

---

## Sources

Industry conventions this doc draws from:

- [How to do a website content audit in 2026 (with template) — Semrush](https://www.semrush.com/blog/content-audit/)
- [Content Audit — UO Digital Strategy](https://digital.uoregon.edu/project-kickoff/content-audit)
- [Creating a functional inventory database for website content audits — ONRR](https://blog.onrr.gov/content-audit/)
- [Smoke Test Checklist Documentation — Yuri Kan](https://yrkan.com/blog/smoke-test-checklist-docs/)
- [Ultimate Front-End Testing Checklist — QAwerk](https://qawerk.com/blog/front-end-testing-checklist/)
- [Web Application Testing Checklist 2026 — Testomat](https://testomat.io/blog/complete-web-application-testing-checklist/)
