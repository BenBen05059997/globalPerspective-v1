# PAGES_GUIDE.md — Page-by-Page Reference & Verification

**Generated:** 2026-05-18, from on-disk source under `global-perspectives-starter/frontend/src/`.

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

> **⛔ Removed routes (correction 2026-05-28):** the following entries appear below but are **no longer registered in `App.jsx`** — they've been removed and are retained here for history only: `/weekly-map`, `/intelligence-map`, `/cli`, `/upgrade/success`, `/test/briefing-card`. The live route list is the 17 in `App.jsx` (incl. `/economy`).

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
- **Data sources:** `useWeeklyArchive()` (action `archive_range`, 30 days, 30 min cache), `useThreadAnalyses(qualifyingThreadIds)`, `useUserProfile()` (tier display only).
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
- **Data sources:** `useWeeklyArchive()` (filtered by `threadId`), `useThreadAnalyses([threadId])`, `useUserProfile()`.
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
- **States:** loading/empty/error inline; honest degradation where data is absent (no faked %/sparkline/analog).
- **Smoke-test:** (1) `/economy` — leaderboard + watchlist rail render with real levels. (2) Click an instrument row — expands to sparkline + driving-stories table. (3) Click a driving story — lands on its thread Economy tab.
- **Usage (CloudWatch proxy, 2026-05-27):** the **#2 content page** after Home — well ahead of Threads/Daily/Map/Countries (≈28 `economic_top_movers` loads/wk + 31 expands vs. ≤9 for other sections). Discovery is **not** a gap; site-wide traffic is low overall.
- **Known issues:** a heavily-cited instrument lists all its stories on expand (no "top N" cap yet); `markets_global` is over-counted in logs because the hook background-refreshes every 5 min.

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

- **Purpose:** User profile + saved-items management.
- **Primary user job:** Review subscription tier, manage saved threads/countries/dailies, sign out.
- **Data sources:** `useAuth()`, `fetchUserProfile()` (`user_profile`, JWT), `useSavedItems()` (newsSavedItems Function URL).
- **Auth gate:** **Requires real sign-in** — anonymous/guest redirected to `/signin` (line 409).
- **Inbound links:** Layout account button (when signed in); UpgradeSuccess "account" link.
- **Outbound links:** Profile-tab "Quick access" → `/weekly`, `/weekly-map`; saved cards → `/weekly/thread/:id`, `/weekly/country/:name`, `/daily/:dateKey`; sign-out → `/`; delete account → mailto.
- **Key UI elements:** Two tabs (`?tab=profile` / `?tab=saved`); Profile = avatar + tier badge + perks + quick access + billing-portal stub + sign-out + delete; Saved = chip filter + grid of cards with heart toggle.
- **States:** auth loading; saved loading; saved empty = "Nothing saved yet".
- **Smoke-test:**
  1. Sign in then click email in Layout — `/account?tab=saved`.
  2. Switch to Profile tab — tier badge appears.
  3. Click a saved thread card — opens the thread page.
- **Known issues:** Billing portal handler defined but unreachable in UI (line 259); `Pair` itemType has no `getItemHref` mapping (returns `null`, line 56).

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
Privacy + terms combined. **Known issue:** still references Stripe (~line 29); project migrated to Paddle.

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
 ├─ nav:        Topics(/)  ·  Daily(/daily)  ·  Map(/map)  ·  Threads(/weekly)  ·  Countries(/weekly/countries)
 ├─ nav-right:  Sign in(/signin) | Account(/account)  [conditional]
 └─ footer:     About · White Paper · Privacy · Disclosures · Contact(mailto)

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

AUTH GRAPH
  /signin
   ├─ Google / magic-link / guest  →  /weekly  on success
   └─ Privacy / Disclosures (footer)
  /auth/callback  →  /weekly  (success)  |  /signin  (error)
  /account  →  /signin  (if anonymous)  |  saved cards →  /weekly/thread|country|daily/...
  /upgrade/success  →  /weekly  (once tier confirmed)

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
| `/`, `/daily`, `/map`, `/weekly`, `/weekly/countries`, `/economy` | ✓ (primary nav) | `/economy` is in nav (last) + footer; CloudWatch proxy shows it's the #2 content page — NOT an orphan |
| `/weekly/thread/:id`, `/weekly/country/:name` | ✓ (indirect via list pages) | |
| `/signin`, `/account` | ✓ (Layout right-side) | |
| `/auth/callback` | ✓ (inbound from email magic-link) | |
| `/about`, `/privacy`, `/disclosures`, `/whitepaper` | ✓ (footer) | |
| `/contact` | ❌ effectively orphan | footer "Contact" is a mailto |
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
| `useUserProfile` | | | | ✓ | ✓ | | ✓ | | | (direct fetch) |
| `useSavedItems` | | | | | | | | | | ✓ |
| `useAuth` | | ✓ | | ✓ | ✓ | | ✓ | | | ✓ |

**Not consumed by any routed page:** `useMarketsGlobal`, `useArticles`, `useBookmarks`, `useSummary`, `usePrediction`, `useTraceCause`, `useResearchBriefing`, `usePairAnalyses` (Pair pages are no longer routed), `usePairIntelligence`. See `OPTIMIZATION_REPORT.md` OPT-22 (dead hooks).

---

## Regression sweep checklist (use before release)

Following Yuri Kan's 3-layer smoke model: **L1 Infrastructure → L2 Component → L3 Integration**. Target <10 minutes total.

### L1 — Infrastructure (1 min)
- [ ] `curl https://globalperspective.net/` returns 200.
- [ ] `curl https://globalperspective.net/rss` has ≥ 1 `<item>`.
- [ ] `curl -X POST <SENSITIVE_PROXY_ENDPOINT> -d '{"action":"topics"}'` returns ≥ 1 topic.

### L2 — Component (5 min) — visit each primary nav page
For each of `/`, `/daily`, `/map`, `/weekly`, `/weekly/countries`, run the 3-step smoke from the per-page sections above. Pages should all render without console errors.

### L3 — Integration (4 min) — golden user journeys
- [ ] **Anonymous → topic deep dive:** Land on `/` → click country pill → land on `/weekly/country/X` → click an arc → land on `/weekly/thread/Y` → AI rail "What's Next" populates.
- [ ] **Anonymous → daily reader:** Land on `/daily` → click "Previous day" twice → click country chip → land on country page.
- [ ] **Auth flow:** Open `/signin` → magic-link email → click link → `/auth/callback` → redirected to `/weekly` signed in.
- [ ] **Saved items:** From any thread page click the heart (Save) → open `/account?tab=saved` → unsave → card disappears.

---

## Cross-cutting findings

1. **Map duplication.** `/map` (WorldMapV2 / D3) vs. `/weekly-map` (Google Maps). Only `/map` is in primary nav. Either consolidate or rename so the distinction is obvious.
2. **Dead imports in `App.jsx`** — `Pricing` (line 21), `PairPage` (line 28), `PairListPage` (line 29) imported but no `<Route>` registered. See `OPTIMIZATION_REPORT.md` OPT-22.
3. **`Gate` wrapper unused** — `App.jsx:54-56` defines `Gate({ children })` and `isPreview` but no route wraps it. Maintenance leftover.
4. **PrivacyTerms still mentions Stripe** — project migrated to Paddle. Copy update needed.
5. **`/test/briefing-card`** is a public route with no preview gate — should be `<Gate>`-wrapped or removed from prod build.
6. **`/intelligence-map`, `/cli`** — true orphans (zero inbound links). Either link from nav/footer or delete.
7. **Layout search button** (`Layout.jsx:76-83`) renders the ⌘K affordance but only `preventDefault()`s the keystroke — no search modal exists yet.
8. **Auth posture:** every content route is public; only `/account` redirects anonymous users.

---

## Sources

Industry conventions this doc draws from:

- [How to do a website content audit in 2026 (with template) — Semrush](https://www.semrush.com/blog/content-audit/)
- [Content Audit — UO Digital Strategy](https://digital.uoregon.edu/project-kickoff/content-audit)
- [Creating a functional inventory database for website content audits — ONRR](https://blog.onrr.gov/content-audit/)
- [Smoke Test Checklist Documentation — Yuri Kan](https://yrkan.com/blog/smoke-test-checklist-docs/)
- [Ultimate Front-End Testing Checklist — QAwerk](https://qawerk.com/blog/front-end-testing-checklist/)
- [Web Application Testing Checklist 2026 — Testomat](https://testomat.io/blog/complete-web-application-testing-checklist/)
