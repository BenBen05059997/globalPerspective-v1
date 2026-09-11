# System Usage Map — how every backend area is actually used, end to end (2026-09-11)

Three Sonnet tracing passes (verticals V1-V10), code-grounded on both ends + live-verified spot
checks. Companion to ARCHITECTURE.md (registry) and SYSTEM_WIRING.md (wiring; drift found — see
each section). ORCHESTRATOR CORRECTIONS on agent claims: (1) V3's "situation.threadId is
permanently null" is OUTDATED — the Phase 1 matcher shipped 2026-09-11 and 6 live situations carry
verified threadIds (see EVENT_REGISTRY_MATCHER_SPEC.md); (2) V7's "monthly allowance" describes the
REPO code — the DEPLOYED newsAnalyze runs the older ANALYZE_DAILY_CAP gate (known repo≠deployed
drift, BACKEND_AUDIT). Live bugs found by this pass: /daily returns data:null (broken); /economy
"This week" last published 2026-06-29 (~10wk stale, review gate unrun).


---

# USAGE.md — Global Perspectives functional-usage trace (2026-09-11)

Code-grounded "how is this actually used" trace, verified against on-disk source plus live curls
against `https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy` (endpoint from
`docs/config.js:2`). Base docs read: `project-docs/architecture/SYSTEM_WIRING.md`, `ARCHITECTURE.md`,
`FRONTEND_STRUCTURE_AUDIT_2026-09-11.md`. Full per-vertical detail (file:line index) lives in
`V1.md`, `V2.md`, `V3.md` in this same directory — this file is the synthesis.

---

## V1 — The editorial content core

**How it's used, in plain language.** Every ~2 hours `newsInvokeGemini` scrapes 27 RSS feeds + 9
Brave News queries and asks DeepSeek to cluster them into topics, writing the raw cluster to
Topics `id='staging'`. Five minutes later `NewsProjectInvokeAgentLambda` reads `staging`, runs three
DeepSeek calls per topic (SUMMARY, a two-pass RESEARCH_BRIEFING→PREDICTION, TRACE_CAUSE), assigns
each topic a stable `threadId` (inherit via `continues_topic`, else Jaccard≥0.4 against the last 7
days of archive, else mint new), overwrites Topics `id='latest'`, and writes two archive snapshots
(`today-archive`, 24h TTL; `archive#YYYY-MM-DD`, 90-day TTL). A visitor on `/` gets `Home.jsx`
rendering a deterministic "today's lede" band (`composeTopicsLede`, no LLM) above per-region topic
cards pulled from `latest`, each linking via its `threadId` to `/weekly/thread/:threadId`. `/weekly`
groups 30 days of `archive#…` entries by `threadId` into thread cards; `/weekly/thread/:id`
re-assembles that thread's full history plus a separately-generated `THREAD_ANALYSIS` layer (V2).
`/daily` (`DAILY_BRIEF#<date>`) is a **separate, currently dead** product — fed only by
`newsPostDevTo`'s 23:00 UTC cron, and a live proxy call for today's date returns
`{"success":true,"data":null}`; every `/daily` visitor sees an empty state, not stale content. Raw
per-topic AI content lives only 1 hour in `SUMMARY_TABLE` (unset TTL env → code default 3600s, plus
an immediate prune on next swap) — what survives is only the trimmed copy baked into the archive
entry, which is what `/weekly` and `/weekly/thread/:id` actually read.

**Surface table**

| Route | What renders | Backend product / cadence |
|---|---|---|
| `/` (Home.jsx) | Deterministic lede band + per-region topic cards linking to threads | Topics `latest`, refreshed ~2h |
| `/weekly` (WeeklyPage.jsx) | Thread cards from 30 days of daily archives | `archive_range` (30d frontend request; 90d durable window) |
| `/weekly/thread/:threadId` (ThreadPage.jsx) | Full story arc + THREAD_ANALYSIS (V2) + economic-impact panel | Archive continuous (2h) + THREAD_ANALYSIS daily 06:30 UTC |
| `/daily`, `/daily/:dateKey` (DailyPage.jsx) | "Daily Intelligence Brief" masthead | `DAILY_BRIEF#<date>` via `newsPostDevTo` cron 23:00 UTC — **verified live-broken (`data:null`)** |
| `/weekly/countries`, `/weekly/country/:name` | Country cards/detail | `COUNTRY_INTELLIGENCE` (V2, see below), loosely joined to V1 only via threadIds |

**Topic lifecycle:** `staging` (ephemeral, clobbered every 2h) → `latest` (overwritten every ~2h,
no TTL, frozen stale only if a run fails) → `today-archive` (24h TTL, rolling merge, 1500-char AI
trim, 50-entry cap) → `archive#YYYY-MM-DD` (90-day TTL, one item/UTC day, durable record read by
`/weekly` and `/weekly/thread/:id`) → DDB TTL sweep deletes `today-archive` at 24h and each
`archive#<date>` at 90 days; the raw `SUMMARY_TABLE` `TOPIC#<id>` rows are gone within ~1 hour
(default TTL + immediate `pruneObsoleteEntries` sweep on every swap).

**Corrections vs SYSTEM_WIRING.md:**
1. `/daily` is confirmed live-broken (not just a doc claim) — a fresh curl on 2026-09-11 returned
   `data:null` for both today's date and no-date. SYSTEM_WIRING's "CURRENTLY BROKEN (OPT-1)" is the
   accurate framing; `OPTIMIZATION_REPORT.md`'s "SYNCED 2026-05-18" note was about source/deployed
   byte parity, not about the feature actually running end-to-end.
2. **`/map` no longer routes to `WorldMapV2`.** `App.jsx:102` → `/map` = `SituationHome`;
   `App.jsx:103` → `/map-legacy` = `WorldMapV2` (unlinked from nav). SYSTEM_WIRING §3.3/§3.4 still
   list `WorldMapV2` as the live `/map` consumer — stale.
3. The "7-day archive continuity" framing is imprecise: frontend requests 30 days
   (`useWeeklyArchive.js:34`), backend/TTL supports up to 90.
4. §6's caching table ("14d-90d" for `SUMMARIZE_PREDICT_TABLE`) conflates families — `TOPIC#` rows
   are actually ~1h; only `COUNTRY#`/`THREAD#`/`SYSTEMS#`/`PAIR#` carry the longer TTLs.
5. Threading is confirmed genuinely live (not aspirational) — a live `topics` call returned topics
   already carrying real `threadId`s.

---

## V2 — The analysis/intelligence layer

**How it's used, in plain language.** Five analysis Lambdas sit on top of the V1 pipeline, and four
of the five are genuinely visible to visitors, not just generation-input. `newsThreadAnalysis`
(daily 06:30 UTC, Gemini 2.5 Flash) writes `THREAD_ANALYSIS` per thread and every field it produces
lands somewhere on `ThreadPage` — hero story arc/trajectory, risk/sentiment stats, root-cause chain,
watch questions, an inflection-point timeline, key actors, and grounding links. `newsCountryIntelligence`
(every 10h) writes `COUNTRY_INTELLIGENCE` and is the single most fully-rendered V2 product on the
site: `CountryPage` is built almost entirely around it (risk tier/trajectory badges, headline, BLUF,
why-it-matters, risk signals, timeline, key actors), confirmed live via curl with a fresh
2026-09-11 `generatedAt`. `newsSystemsAnalysis` (daily 07:15 UTC) writes a cited cause→effect graph
(`SYSTEMS_ANALYSIS`) that renders on CountryPage's **"Causal Web" tab** — the real, in-nav
distribution channel — while `/spider-demo` is a second, working consumer of the same hook that has
**zero nav links anywhere in the app** and is reachable only by typing the URL directly. `newsDriftCorrector`
is the most widely surfaced of the five: it feeds CountryPage's "what changed" band, ThreadPage's
drift block, the site-wide `/track-record` corrections ledger, and member drift-alert emails.
`newsCountryFactsUpdater` is the one true generation-input-only Lambda — its `FACTS#` rows are read
by three other Lambdas' prompts (topic summaries, country intelligence, pair intelligence) but never
by any frontend code path; a visitor only ever sees its effect several hops removed, e.g. a leader's
name grounding a sentence they read on CountryPage.

**Surface table**

| Route | What renders | Backend product | Cadence | Visitor-visible? |
|---|---|---|---|---|
| `/weekly/thread/:threadId` | Story arc, trajectory, risk/sentiment, root-cause chain, watch Qs, inflection timeline, actors, grounding, drift block | `newsThreadAnalysis` + `newsDriftCorrector` | Daily 06:30 UTC + on-change | YES |
| `/weekly/country/:name` | Risk/trajectory badges, headline, BLUF, why-it-matters, signals, timeline, actors | `newsCountryIntelligence` | Every 10h (02/12/22 UTC) | YES |
| `/weekly/country/:name` "Causal Web" tab | Cited cause→effect graph | `newsSystemsAnalysis` | Daily 07:15 UTC, top-5 | YES (via CountryPage) |
| `/spider-demo` | Same causal graph, alt viz | `newsSystemsAnalysis` | same | Technically yes, but **zero nav links** — orphan route |
| `/map` (WorldMapV2 consumer) | Systems-analysis overlay | `newsSystemsAnalysis` | same | YES (but see V1 note — `/map` no longer serves WorldMapV2) |
| CountryPage "what changed" band | Deterministic diff + grounded drift note | `newsDriftCorrector` | On-change | YES |
| `/track-record` | Site-wide corrections ledger | `newsDriftCorrector` via `corrections_feed` | On-demand | YES |
| Member drift-alert emails | Per-country drift note | `newsDriftCorrector` | On new note | YES, out-of-band |
| (no route) | — | `newsCountryFactsUpdater` (FACTS#) | Daily 05:00 UTC | NO — generation-input only |

**Corrections vs SYSTEM_WIRING.md:**
1. `useSystemsAnalysis` has three live importers (CountryPage, WorldMapV2, SpiderDemo) — SYSTEM_WIRING
   only names CountryPage; not wrong, just incomplete.
2. SYSTEM_WIRING's pipeline diagram implies `newsSystemsAnalysis` reads facts from
   `newsCountryFactsUpdater` (cron-sequence proximity, 05:00 → 07:15). **False** — grep of
   `newsSystemsAnalysis/src/index.js` finds no `FACTS#` read at all. Only `newsCountryIntelligence`,
   `NewsProjectInvokeAgentLambda`, and `newsPairIntelligence` actually read FACTS#.
3. `/spider-demo` being called "LIVE" in project memory overstates its reach — it resolves, but has
   no in-product path to it.

---

## V3 — Cross-links

**How it's used, in plain language.** Every editorial surface (Home, EconomyPage,
BreakingDetailPage, TrackRecordPage) carries a `threadId` and/or country name on its cards, and all
of them funnel through one shared helper, `utils/threadPath.js`, into
`/weekly/thread/:id[?tab=&from=&country=]` — deliberately centralized after ~20 inconsistently
hand-built links caused bugs; country links remain simpler, hand-built inline at ~8 call sites. Once
on ThreadPage or CountryPage, the two link back to each other: ThreadPage links to the story's
origin country, and CountryPage derives "related story arc" cards **entirely client-side** by
grouping the already-fetched weekly-archive payload by `threadId` (nothing in the `COUNTRY_INTELLIGENCE`
DDB item itself stores threadIds), then hydrates titles/risk scores via `useThreadAnalyses`. Risk
badges everywhere (`RiskScoreBadge`, and now `RiskDeltaPill` via `CountryWhatChanged` — no longer
orphaned per SYSTEM_WIRING) are driven by `utils/riskTiers.js`'s canonical 25/50/75 thresholds, fed
by `COUNTRY_INTELLIGENCE.riskScore` or `THREAD_ANALYSIS.riskScore`. The `/map` world (now
`SituationHome`, not `WorldMapV2`) has a wired-but-dormant link from `situation.threadId` to
`/weekly/thread/:id` — the JSX exists, but per `EVENT_REGISTRY_PLAN.md` the backing field is null
everywhere: the map brain and editorial brain still don't share IDs, only a matcher spec has been
drafted. The old `WorldMapV2` still genuinely consumes `pair_analyses_list` for cross-country arcs,
but that component now lives at the unlinked `/map-legacy` route, not `/map`.

**Cross-link table**

| From | To | Mechanism |
|---|---|---|
| Home / EconomyPage / BreakingDetailPage / TrackRecordPage cards | `/weekly/thread/:id` | `threadPath()` helper (centralized) |
| Same surfaces | `/weekly/country/:name` | inline hand-built links (~8 sites) |
| ThreadPage | `/weekly/country/:name` | link to story's origin country |
| CountryPage | `/weekly/thread/:id` ("story arc" cards) | client-side threadId derivation from weekly-archive cache + `useThreadAnalyses` hydration |
| SituationHome (`/map`) | `/weekly/thread/:id` | `situation.threadId` — **field null everywhere today**, link is dead-but-wired |
| WorldMapV2 (`/map-legacy`, unlinked) | cross-country arcs | `pair_analyses_list` action |
| CountryPage/CountryListPage risk badges | `riskTiers.js` (25/50/75) | fed by `COUNTRY_INTELLIGENCE`/`THREAD_ANALYSIS` risk fields |

**Corrections vs SYSTEM_WIRING.md / memory:**
1. `/map` is `SituationHome`, not `WorldMapV2` (see V1 correction #2) — this ripples through every
   doc/memory reference to "`/map` = WorldMapV2."
2. `pair_analyses_list → map arcs` is real in code but now feeds the **demoted, unlinked**
   `/map-legacy` — effectively dead in the live product even though `usePairAnalyses` isn't fully
   dead code (WorldMapV2 still imports it; a different failure mode than the outright-dead
   PairPage/PairListPage).
3. "situation.threadId → /weekly/thread — just shipped 09-08" (memory) should read as "the
   plan/approach was approved 09-08," not "the link is live" — `EVENT_REGISTRY_PLAN.md` states the
   field is null everywhere; only a matcher spec exists as of 2026-09-11.
4. `RiskDeltaPill` is no longer orphaned (SYSTEM_WIRING §3.5 is stale on this point) — it's wired via
   `CountryWhatChanged.jsx` into CountryPage.
5. CountryPage's "related threads" relationship is a pure client-side join over two independently
   fetched caches, not a server-computed field — SYSTEM_WIRING's CountryPage end-to-end trace (§3.6)
   omits this entirely.

---

## The 3 most surprising usage facts

1. **`/daily` is dead right now.** A live curl for today's `DAILY_BRIEF` returns `data:null` — every
   visitor to `/daily` sees an empty state. The generation Lambda (`newsPostDevTo`, 23:00 UTC cron)
   hasn't successfully written a row in at least a week, despite a doc note elsewhere marking the
   drift issue "SYNCED."
2. **`/map` quietly changed owners.** `App.jsx:102` now routes `/map` to `SituationHome`, not
   `WorldMapV2` — which got demoted to an unlinked `/map-legacy`. This invalidates several
   still-standing claims in SYSTEM_WIRING.md and project memory about what `/map` consumes
   (`useGeminiTopics`, `useCountryIntelligence`, `pair_analyses_list` arcs, Google Maps JS wiring)
   — none of that is what a visitor to `/map` sees today.
3. **The map-to-editorial link everyone thinks shipped, didn't.** `situation.threadId →
   /weekly/thread/:id` has fully-built click-through UI (`SituationHome.jsx:285-288`), but the field
   it depends on is null on every situation object — the map/editorial ID-matching layer is still
   just a drafted spec, not running code. Separately, `/spider-demo` — called "LIVE" in project
   memory — has a working systems-analysis causal graph behind it, but literally zero links to it
   anywhere in the app; it's a URL, not a feature anyone can find.

---

# Usage-B: Economy, Predictions/Track-Record, Map-World Connections

Code-grounded, live-verified (curl against `https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy`, 2026-09-11).

## V4 — ECONOMY: how it's actually used

A visitor lands on `/economy` and sees a **Today / This week** segmented toggle
(`EconomyPage.jsx:592-603`, `?view=week` in the URL).

**Today mode (default):**
1. **Masthead + "Today in the economy" briefing band** — a deterministic (no-LLM) lead
   sentence built client-side by `composeBriefing()` (`utils/composeEconomyBriefing.js`)
   from data already in memory (top movers + disruptions + markets). Bolds the sharpest
   headline as a link to that thread's Economy tab.
2. **Repricing-today leaderboard** (center) — `useTopMovers(20)` →
   `fetchTopMovers` → proxy action `economic_top_movers` → `newsSensitiveData`
   Scans `ECON#THREAD#*`/`ECONOMIC_IMPACT` records, tallies citations/direction per
   instrument. Rows are sortable (Instrument/Chg/Stories), each expandable into an
   `ExpandedPanel` showing a 30-day sparkline (`useMarketsHistory` → `markets_history`),
   30d high/low/Δ, the driving-stories list (severity-sorted, capped at 6), and affected
   countries. A **"Dormant" drawer** lists the ~50 tracked-but-not-cited-today instruments
   (`TRACKED_UNIVERSE` constant minus `citedIds`).
3. **Active disruptions bridge** — `useDisruptionsList({limit:200})` → `economic_impact_list`
   → same `ECON#THREAD#`/`ECONOMIC_IMPACT` records (written daily by **newsEconomicImpact**,
   one record per thread, `hasImpact:true/false` tombstone, 21-day TTL), grouped by
   severity (severe/moderate/minor) into cards linking to each thread's `?tab=economy` view.
4. **Right rail — Market Context** — `useMarketsGlobal()` → `markets_global` →
   `newsSensitiveData` reads `GlobalPerspectiveMarkets` (written hourly/daily/weekly by
   **newsMarketsData** from Frankfurter/FRED/World Bank/Stooq→Yahoo/CoinGecko). Renders
   Equities/Sectors/Commodities/Rates/Crypto groups with per-instrument sparkline + level +
   day-over-day change pill.
5. **QualityFlag** (`atoms/QualityFlag.jsx`) — a small "⚑ auto-judged: review" chip that
   renders ONLY when a disruption record has `is_low_quality === true`. It's a passive
   visible warning, not a hard gate — the flagged story still shows, just badged, with a
   tooltip listing which axis (coherence/citations/analog-match/severity/no-BS) scored ≤2
   and why. Written by **newsEconomicQuality** (Gemini-2.5-Flash judge), which does an
   `UpdateExpression` onto the SAME `ECON#THREAD#`/`ECONOMIC_IMPACT` item (adds
   `qualityScores`/`qualityReasons`/`is_low_quality`/`quality_judge_model`) — it never
   creates its own record, it annotates the impact record in place.

**This-week mode (`?view=week`):** renders `WeeklyMarketsView`, sourced from
`fetchWeeklyMarkets()` → action `weekly_markets` → a single precomputed report written
by **newsWeeklyMarkets** (Sunday draft, `weekly-markets/review.js` human-gate → publish).
**Live-verified 2026-09-11: the served report's `weekOf` is still `2026-06-29`** —
the Sunday cron/review step has not produced a fresh report in ~10 weeks; this mode is
visibly stale in production right now, not a code bug.

**No economic badges surface on Home** — grep found no `QualityFlag`/economic-impact
import outside `EconomyPage.jsx` and the thread Economy tab; ThreadPage's Economy tab is
literally the same `economic_impact` action keyed by `threadId` (single-record GET, not
the list scan).

## V5 — PREDICTIONS & TRACK RECORD: how it's actually used

**Birth:** every 4h, `NewsProjectInvokeAgentLambda` (after summarizing a topic) calls
`logPredictionSnapshot()` which runs the model's forecast through capture gates G1–G6
(date-valid, forward-looking, ≤180d horizon, falsifiability, premise-check, sport-scope)
and writes a v1 snapshot straight into a **separate DynamoDB table**,
`GlobalPerspectivePredictionLog` (`PREDICTION_LOG_TABLE`) — **not** the shared
`SUMMARIZE_PREDICT_TABLE` `PREDICTION` SK that `SYSTEM_WIRING.md` §1.1 documents. This is
a real drift: the legacy `TOPIC#/PREDICTION` SK still exists for the old (pre-v1) display
path, but the whole scored, resolvable forecast system lives in its own table.

**ThreadPage "Living forecast" board:** `useThreadForecast(topicIds)` →
`fetchPredictionSnapshot` → action `prediction_snapshot` → a point Query against
`PredictionLog` for the thread's newest v1 record → `ThreadForecast.jsx` renders each
scenario's triggers as a checklist with `triggerState()` mapping to glyphs:
`☐` pending · `✓` fired · `✗` not_fired · `–` unclear · `⌛` awaiting (deadline passed,
no verdict yet). Honest-empty: renders nothing if the thread has no v1 forecast.

**Resolution loop:** `newsPredictionResolver` (daily) Scans for triggers whose deadline
has passed and no verdict, greps fresh Brave results, asks the LLM to **propose**
fired/not_fired/unclear + citation — it never finalizes. `predictions/review.js`
(repo-root script) is the human-confirm gate that writes the final verdict onto the
`PredictionLog` item. **Live note from ARCHITECTURE.md: this queue has a 37,021-trigger
backlog against a 40/day resolver cap** — i.e. resolution is structurally behind
generation by orders of magnitude; only a small, roughly-weekly-agent-run slice actually
gets scored.

**`/track-record` page:** `useTrackRecord()` → `fetchPredictionTrackRecord()` → action
`prediction_track_record`. This does **not** Scan live on every page load — it reads a
precomputed `predictions/track_record.json` object from the S3 "world" bucket
(`globalperspective-world-280362093938`), written every ~30min by **newsPredictionsSnapshot**
(a read-optimization Lambda added because the naive Scan was ~12.5k reads/day, the table's
2nd-hottest path). Only if that S3 object is missing does the proxy fall back to a live
`PredictionLog` Scan+compute. Live-verified 2026-09-11: `totalPredictionsLogged:3289`,
`legacyPredictionsExcluded:2418` (pre-2026-07-04 era cut), `resolvedTriggers:122`,
`firedTriggers:30`, `brierScore:0.154`, 3 populated calibration buckets. The page also
renders a **corrections ledger** (`useCorrectionsFeed` → `corrections_feed`, a Scan over
`DRIFT#`/`DRIFTLOG#` rows in `SUMMARIZE_PREDICT_TABLE` — a completely different subsystem,
the "living analysis" drift-correction feed, reused here as accountability evidence) plus
a `FollowButton` per country-scope row for member change-alerts.

**newsSignals:** confirmed to have **no frontend surface**. It's a separate,
API-key-gated Function URL product (the "Signal API") that packages the SAME underlying
records — `ECONOMIC_IMPACT`, `PredictionLog`, `COUNTRY_INTELLIGENCE`, confirmed
`BreakingAlerts` — into a stable v1 envelope via `signalAdapter`, writes
`signals/latest.json` (+ dated snapshots) to the S3 world bucket, and serves
`GET /v1/signals`, `/v1/signals/{id}`, `/v1/track-record` behind API keys with free/paid
rate tiers. It is deliberately **not** routed through the Cloudflare Worker's public
`/data/*` path — it's the paid horizontal product, kept separate from the free site.

## V6 — MAP/WORLD CONNECTIONS

- **`pair_analyses_list`** (Scan `PAIR#*`/`PAIR_ANALYSIS` in `SUMMARIZE_PREDICT_TABLE`,
  written weekly by `newsPairIntelligence` on the enabled `TriggerPairIntelligenceWeekly`
  rule) still feeds **`WorldMapV2`'s "Connections" bilateral-arc layer**
  (`usePairAnalyses` → `realFlows` in `WorldMapV2.jsx:256+`, parses country names out of
  each pair's `slug`, resolves ISO codes, colors/weights arcs by signal bucket + keyword
  category geo/fx/tech).
- **`WorldMapV2` is still live** but demoted: `App.jsx` now routes `/map` to the new
  `SituationHome` (the 2026-09 map-as-home redesign) and `WorldMapV2` only at
  **`/map-legacy`** — a real, reachable, un-linked-from-nav fallback, not dead code.
  Confirms + extends the ARCHITECTURE.md note that `/map`'s old 4th "Economy" layer lens
  was deleted (`d14a2ff`) — that deletion happened on `SituationHome`/`/map`, not on
  `WorldMapV2`, which still has its own independent economic-disruption tooltip wiring
  (`selectedCountryDisruptions` from `useDisruptionsList`).
- **Does economy touch the S3 world store?** No. `newsEconomicImpact` and
  `newsWeeklyMarkets` never reference `WORLD_BUCKET` — the whole Economy vertical stays in
  DynamoDB (`ECON#THREAD#` family in `SUMMARIZE_PREDICT_TABLE` + `GlobalPerspectiveMarkets`).
- **Does predictions touch the S3 world store?** Yes, but narrowly — only the
  `/track-record` **read-cache** (`predictions/track_record.json`, built by
  `newsPredictionsSnapshot`). The actual prediction records stay in DynamoDB
  (`PredictionLog` table); S3 is purely a precomputed-aggregate cache to avoid a full
  table Scan on every page load — consistent with `DATA_STRATEGY.md`'s "S3 for the world"
  principle (grep shows the world bucket is otherwise the domain of
  `newsGdacsIngest`/`newsGdeltConflict`/`newsSituationTracker`/`newsSituationIngest`/
  `newsImpactAudit`/`newsSignals` — the situation/impact-first pipeline — plus
  `NewsProjectInvokeAgentLambda` and `newsInvokeGemini`, presumably for shared
  world-snapshot writes feeding that same pipeline).
- **One table, many tenants — `SUMMARIZE_PREDICT_TABLE` PK families relevant to these
  verticals** (beyond the six SYSTEM_WIRING already lists):
  - `ECON#THREAD#<threadId>` / `ECONOMIC_IMPACT` — Economy vertical (newsEconomicImpact
    writes, newsEconomicQuality annotates in place).
  - `DRIFT#<date>` / `DRIFTLOG#<date>` under `COUNTRY#`/`THREAD#` PKs — living-analysis
    corrections, reused by BOTH CountryPage's "What changed" band AND the
    `/track-record` corrections ledger (shared tenant, two different UI surfaces).
  - `PAIR#<slug>` / `PAIR_ANALYSIS` — feeds `WorldMapV2` arcs only (V6).
  - **`PREDICTION_LOG_TABLE` (`GlobalPerspectivePredictionLog`) is a wholly separate
    DynamoDB table**, not a PK family of `SUMMARIZE_PREDICT_TABLE` — the biggest structural
    correction to SYSTEM_WIRING's §1.1 table inventory for this vertical set.

## Route → renders → data product → cadence

| Route/UI element | Renders via | Data product | Cadence |
|---|---|---|---|
| `/economy` (Today) briefing band | `composeBriefing()` client-side | in-memory top movers + disruptions + markets | on page load, no server call |
| `/economy` leaderboard | `useTopMovers`→`economic_top_movers` | `ECON#THREAD#*` Scan (newsEconomicImpact) | daily writer; 30min localStorage cache |
| `/economy` disruptions bridge | `useDisruptionsList`→`economic_impact_list` | same ECON#THREAD# records | daily; 30min cache |
| `/economy` right rail | `useMarketsGlobal`→`markets_global` | `GlobalPerspectiveMarkets` (newsMarketsData) | hourly/daily/weekly EventBridge; 5min cache |
| `/economy?view=week` | `WeeklyMarketsView`→`weekly_markets` | newsWeeklyMarkets published report | Sunday cron + human review (stale live: last `weekOf` 2026-06-29) |
| QualityFlag chip (economy + thread tab) | inline in `EconomyPage`/thread Economy tab | `is_low_quality` on ECON#THREAD# item | newsEconomicQuality judge overlay, same-day |
| ThreadPage Living-forecast board | `useThreadForecast`→`prediction_snapshot` | `GlobalPerspectivePredictionLog` (Query) | every 4h generation; resolved async |
| `/track-record` | `useTrackRecord`→`prediction_track_record` | S3 `predictions/track_record.json` (newsPredictionsSnapshot) | ~30min precompute; ~weekly-agent resolution runs |
| `/track-record` corrections ledger | `useCorrectionsFeed`→`corrections_feed` | `DRIFT#`/`DRIFTLOG#` Scan | daily (newsDriftCorrector 07:20 UTC) |
| `/map-legacy` Connections arcs | `usePairAnalyses`→`pair_analyses_list` | `PAIR#*` Scan (newsPairIntelligence) | weekly (`TriggerPairIntelligenceWeekly`) |
| Signal API (`/v1/signals`, external) | N/A — no frontend | S3 `signals/latest.json` (newsSignals BUILD mode) | scheduled build; served via Function URL, API-key gated |

## SYSTEM_WIRING.md drift found

1. §1.1's table inventory is missing an entire table for this vertical set:
   `GlobalPerspectivePredictionLog`, written by `NewsProjectInvokeAgentLambda`, read/updated
   by `newsPredictionResolver`, read by `newsPredictionsSnapshot` and `newsSignals`, served
   to `/track-record` via an S3 cache — none of this is documented in §1.1 or §1.3.
2. Two Lambdas entirely absent from the SYSTEM_WIRING 14-row core AND not called out by
   name anywhere in the doc: `newsPredictionResolver` (daily resolver-proposal pass) and
   `newsPredictionsSnapshot` (S3 track-record precompute, added under an "S8·T3"
   optimization initiative not referenced in SYSTEM_WIRING at all).
3. `newsEconomicImpact` / `newsEconomicQuality` / `newsWeeklyMarkets` are absent from
   SYSTEM_WIRING's core table (it says see ARCHITECTURE.md for the full ~33 list, so this
   is a known/flagged gap, not silent — but worth reconfirming they're accurately described
   there, which they are).
4. SYSTEM_WIRING never mentions the S3 "world" bucket (`globalperspective-world-*`) at all
   — it only documents DynamoDB tables. The bucket is now a real second storage tier for
   at least 3 unrelated concerns (situation/GDACS pipeline, signals API, prediction
   track-record cache), which is exactly the kind of infra SYSTEM_WIRING's mandate should
   cover.
5. `/map` no longer routes to `WorldMapV2` (SYSTEM_WIRING §3.4's route list, last touched
   2026-09-08, doesn't mention `SituationHome` or `/map-legacy` at all — this predates or
   missed the map-as-home redesign that ARCHITECTURE.md's changelog says shipped).

## Three most surprising usage facts

1. **`/economy?view=week` ("This week") is silently stale in production** — it's still
   serving a report dated `weekOf: 2026-06-29` (confirmed live), roughly 10 weeks old,
   while `/economy` (Today) is fully live and hourly-fresh right next to it behind one
   toggle click. A visitor has no way to know the two tabs have wildly different
   freshness.
2. **The prediction-resolution loop is enormously backlogged relative to generation**:
   19,543 pending triggers vs. a 40/day resolver cap and a 37,021-trigger backlog noted
   in ARCHITECTURE.md — the `/track-record` Brier score (0.154, n=122 resolved) is
   computed over a tiny, roughly-weekly-manually-curated slice of a firehose the system
   generates every 4 hours. The "accountability" page's honesty is real, but its sample
   size relative to what's been predicted is minuscule (122 of ~19,665 total dated
   triggers ever come due and get scored).
3. **QualityFlag and the whole prediction-resolution mechanism are non-blocking
   annotations on records that already shipped** — a low-quality-judged economic
   disruption still renders in the leaderboard/bridge (just badged), and an
   about-to-expire prediction trigger sits at `⌛ awaiting` indefinitely until a human runs
   `predictions/review.js`. Nothing in either vertical ever hides or withholds content
   pending review; "the owner/AI proposes, review annotates" is the consistent shape, not
   a hard gate — mirroring the same pattern documented for `newsDriftCorrector`/member
   gating elsewhere in the codebase.

---

# USAGE.md — How Global Perspectives is actually used, end to end

Compiled 2026-09-11. Read-only trace across four verticals (identity/membership, engagement
loops, distribution/guards, the Cloudflare Worker). Grounded in source (file:line), live curls
to https://globalperspective.net, and read-only DynamoDB/EventBridge checks. Sources of record:
`V7_identity_membership.md`, `V8_engagement_loops.md`, `V9_distribution_guards.md`,
`V10_worker.md` in this directory (full detail + citations); this file is the synthesis.

---

## V7 — Identity & Membership

**Story:** Every page is readable anonymously. Firebase auth (`AuthContext.jsx`) only gates four
things: saved items, notification/follow prefs, buying membership/credits, and running Analysis
Studio on GP's own compute. Anonymous Firebase guest sessions exist but are treated as "signed
out" everywhere that matters. Sign-in is magic-link or Google popup; signing out purges all
`gp_*` localStorage so a shared browser doesn't leak the previous user's data.

Membership (`/membership`) is a real Polar integration: click Subscribe → `create_checkout` →
`newsPolarBilling` (verifies the Firebase JWT server-side) → Polar-hosted checkout → signed
webhook writes `tier`/`subscriptionStatus` onto the `USERS` row. The **only** visible UI change
from being a member is on `/membership` itself ("You're a member" card) and inside `/analyze`
(BYOK prompts replaced by "Member · included") — there is no nav pill or badge anywhere else.

Analysis Studio (`/analyze`) has two independent axes: BYOK (free, any signed-in user, direct
browser→LLM) vs. our-compute (`newsAnalyze`, member or credit-holder). The "cap" is a **monthly
allowance** (`MEMBER_MONTHLY_ALLOWANCE`, default 100/month), not daily — consumed first, then
credits. The frontend never shows "N of 100 used"; members are silently switched to spending
credits once the allowance runs out, surfacing only as a hard stop when credits hit zero.

The "parked" credit-packs feature is **not invisible** — `MembershipPage.jsx` renders a full
"Analysis credits" section with live balance for every signed-in user; only the buyable-pack IDs
(`POLAR_CREDIT_PACKS`) are unset in prod config, so it shows "coming soon" rather than being
absent. The follow-country perk (member-gated 403 for non-members) flips `followedCountries[]` +
`driftOptIn:true`, but the drift email it's meant to trigger is cron-disabled (see V9) — so
following a country changes a DB flag today with no downstream effect.

### Surface table
| Entry | Action | Backend | Storage | Visible result |
|---|---|---|---|---|
| `/signin` | magic link / Google | Firebase Auth SDK | Firebase Auth | Nav shows Account |
| `/membership` → Subscribe | click plan | `create_checkout` → `newsPolarBilling` | reads `PRODUCTS` env | Redirect to Polar checkout |
| Polar checkout completes | webhook | `newsPolarBilling` | `USERS.tier/subscriptionStatus` | "You're a member" card; `/analyze` switches to member copy |
| `/membership` → Buy credits | click pack | `create_checkout{kind:credits}` | idempotent `grantCredits` | `creditBalance` increments (packs UI present, inert — no IDs configured) |
| `/analyze` → Run (member/credit) | click Run | `runMemberAnalysis` → `newsAnalyze` | `USERS.analyzeCount/creditBalance` | Report streams, no key prompt; silent allowance→credit switch, hard stop at 0 credits |
| `/analyze` → Run (BYOK) | click Run | direct browser→provider | none | Report labeled "your chosen model" |
| Country/TrackRecord page → Follow ★ | click | `follow_country` → `newsRecommend` | `USER_PREFS.followedCountries[]` | Button toggles; 403 if not member; no downstream email (disabled) |

**Active vs dormant:** Sign-in + membership purchase + BYOK analysis = ACTIVE. Our-compute
analysis path and credit-pack code = fully built but pack IDs unconfigured (inert, visible
"coming soon"). Follow-country perk = active toggle, dormant email effect.

---

## V8 — Engagement Loops

| Loop | Verdict | Evidence |
|---|---|---|
| Saved items (heart button, Country/Thread/Daily pages → `newsSavedItems` → Account "Saved" tab) | **DORMANT** | Fully wired end to end; `GlobalPerspectiveSavedItems` table scan = **0 rows** |
| Recommendations (`newsRecommend` default `recommend()` action: topic scoring using saved items) | **DORMANT / dead code** | Real scoring logic exists server-side; grep of the entire frontend finds **zero call sites** — no rail/page ever invokes it |
| Breaking-alert bell (nav icon, all visitors, no auth, polls `list_alerts` every 5 min) | **ACTIVE** | `GlobalPerspectiveBreakingAlerts` table has **36 real alerts**; public, always populated for every visitor |
| Notification prefs + unsubscribe (Account tab; public token-based unsubscribe HTML page) | **DORMANT as growth loop** | Machinery correct and live, but `GlobalPerspectiveUserPrefs` = **2 total rows** (breakingOptIn:1, digestOptIn:2, driftOptIn:0) — matches and confirms standing memory |

**Most surprising fact:** `newsRecommend` is named and documented as "the recommendations
engine," but in production 100% of its live traffic is prefs/breaking-alerts/follow-country/
unsubscribe — the actual `recommend()` personalization function is unreachable dead code. Second:
the Saved Items feature (full auth-gated Lambda + table + Account UI) has never been used by a
single visitor despite appearing on three page types.

### Surface table
| Entry | Action | Backend | Storage (live count) | Result |
|---|---|---|---|---|
| Heart icon | save/unsave | `newsSavedItems` (JWT) | `GlobalPerspectiveSavedItems` (0) | Account → Saved tab |
| — (no UI entry) | — | `newsRecommend` default `recommend()` | reads Topics+SavedItems | Nothing renders it |
| Nav bell (public) | click, poll 5min | `newsRecommend` `list_alerts` (no auth) | `GlobalPerspectiveBreakingAlerts` (36) | Dropdown → `/breaking/:id` |
| Account → Notifications | toggle/follow | `newsRecommend` `get/set_prefs`, `follow_country` (auth; follow member-gated) | `GlobalPerspectiveUserPrefs` (2) | Toggle persists |
| Emailed unsubscribe link | click, no login | `newsRecommend` `unsubscribe` (token-auth) | flips OptIn flag | HTML confirmation page |

---

## V9 — Distribution & Guards (invisible to visitors except final outputs)

**Email (`newsEmailSender`, 3 modes on shared Resend seam):** Live EventBridge check shows
**only the Sunday weekly digest (`cron(0 14 ? * SUN *)`) is enabled.** `TriggerBreakingEmailSend`
(rate 15min) and `TriggerDriftEmailSend` (`cron(40 7)`) are both **disabled** — this extends the
known memory fact (drift disabled) to include breaking-alert email also being disabled. The drift
*corrector* (note generation, not the emailer) still runs daily even though nothing ever emails
those notes.

**Social posting:** `newsPostLinkedIn` (every 3h) posts to LinkedIn/Bluesky/Mastodon/Telegram/
Farcaster with commentary + a generated map image, dedup'd via `SOCIAL_POSTS_TABLE` fingerprints.
`linkedInAutoPost` (07:30/19:30) is a *separate* second LinkedIn stream with a known no-op dedup
bug (its overlap filter builds a Set from a raw string, not words — OPT-13). `newsPostDevTo`
(23:00 UTC daily) posts to Dev.to — **SYSTEM_WIRING.md's "CURRENTLY BROKEN" flag is stale**; this
was fixed and md5-verified 2026-05-18 per OPTIMIZATION_REPORT.md OPT-1.

**`/daily` page:** Not an independent pipeline — `newsPostDevTo` writes the `DAILY_BRIEF#<date>`
DDB record as a *side effect* of building its Dev.to article. `DailyPage.jsx` just reads that
record back via a plain `newsSensitiveData` proxy read. If Dev.to posting were ever disabled,
`/daily` would go stale as a direct side effect.

**Guard trio** (`newsFreshnessMonitor`, `newsSourceAudit`, `newsModelGuard`) — all SNS-alert-only
to the operator, silent when healthy. Freshness probes the live read path (not just DDB) so it
also validates the proxy; source-audit LLM-checks top topics for drift; model-guard scans all
Lambda envs daily for deprecated DeepSeek model IDs (built after the 2026-07-28 outage).

**Error sink:** `installErrorSink()` fires once in `main.jsx`, before `<App/>` even renders — so
it is genuinely global across every route, not opt-in per page. Captures window `error`/
`unhandledrejection` plus React ErrorBoundary catches, rate-limited (20/session), POSTs to
`newsClientErrors` → DDB → `newsErrorDigest` → SNS to operator.

**RSS:** Live-verified `curl -I https://globalperspective.net/rss` → 200
`application/rss+xml`. Served by the Worker proxying `?action=rss` into the same
`newsSensitiveData` Lambda — no dedicated Lambda.

### Surface table
| Trigger | What happens | Backend | Lands where |
|---|---|---|---|
| Sun 14:00 UTC (ENABLED) | Weekly brief emailed | `newsEmailSender` weekly | digestOptIn inboxes |
| every 15min (DISABLED) | would email fresh breaking alerts | `newsEmailSender` breaking | nobody |
| 07:40 UTC (DISABLED) | would email per-country drift notes | `newsEmailSender` drift_alert | nobody |
| 07:20 UTC (enabled) | generates drift notes, unsent | `newsDriftCorrector` | DDB only |
| every 3h:20 | posts to 5 social platforms | `newsPostLinkedIn` | LinkedIn/Bluesky/Mastodon/Telegram/Farcaster |
| 07:30 / 19:30 UTC | second LinkedIn stream (dedup bug) | `linkedInAutoPost` | LinkedIn feed |
| 23:00 UTC | Dev.to article + writes `DAILY_BRIEF#` | `newsPostDevTo` | Dev.to + feeds `/daily` |
| visitor loads `/daily` | reads yesterday's brief | `newsSensitiveData` | `/daily` page |
| scheduled | read-path freshness probe | `newsFreshnessMonitor` | SNS → operator |
| scheduled | LLM source-drift audit | `newsSourceAudit` | SNS → operator (≥2 drift) |
| daily | scans Lambda envs for stale model IDs | `newsModelGuard` | SNS → operator |
| any JS error, any page | captured client-side | `newsClientErrors`→DDB→`newsErrorDigest` | SNS → operator |
| `GET /rss` (curl-verified 200) | Worker proxies to Lambda | `newsSensitiveData` `rss` action | Public XML — crawlers |

---

## V10 — The Cloudflare Worker (`globalperspective-rss`)

**Story:** The domain is fully Cloudflare-proxied (orange-cloud; DNS resolves to Cloudflare
anycast IPs). The Worker's `fetch()` handler intercepts **every** request to the zone with no
route scoping, does 3 special-cased things, then falls through to `fetch(request)` → GitHub
Pages for everything else:

1. `/data/*` — SigV4-signs a GET against a private S3 bucket, streams JSON (map-as-home data:
   `world/latest.json`, `situations/state/<id>.json`), edge-cached 5 min. Live-verified.
2. `/rss` — proxies to the Lambda REST proxy's `action=rss`, edge-cached 30 min. Live-verified.
3. Bot pre-render — ~25-entry UA allowlist gets server-rendered HTML with OG tags for exactly 4
   route shapes (`/`, `/weekly/thread/:id`, `/weekly/country/:name`, `/daily[/:dateKey]`). Root
   `/` is hardcoded static (no Lambda call, "can't go stale-wrong"). Live-verified: bot UA on
   `/weekly/country/Iran` returns full pre-rendered HTML with a real headline; plain UA returns
   the raw SPA shell.
4. Everything else — transparent pass-through to GitHub Pages (verified: `x-github-edge-region`/
   Fastly headers present on a plain `/` request, confirming pass-through).

**If the Worker died:** This is **not** an auxiliary component. Because the zone is fully
Cloudflare-proxied and the Worker's own final line (`return fetch(request)`) is the only bridge
to GitHub Pages, a broken Worker means a **full site outage** — even a plain browser GET of `/`
never reaches origin. Specifically broken if only the map/RSS/bot-preview logic failed (not the
whole Worker): `/map` goes blank (no other path to the private S3 bucket), `/rss` has no
alternate endpoint, and crawler/social previews regress to the empty SPA shell. If only the
backing Lambda (not the Worker) is down, bot pre-render and RSS gracefully degrade rather than
error.

**Most surprising fact:** Neither SYSTEM_WIRING.md nor WORKER_FULL_CODE.md states that this
Worker — documented as a bot-preview/data-proxy add-on — is actually the mandatory front door for
100% of site traffic. It also has zero footprint in the repo (no wrangler.toml, no source file;
dashboard-deployed with the markdown doc as its only "source control").

### Route table
| Route | Purpose | Caller | Backend |
|---|---|---|---|
| `/data/*` | map-as-home data feed | `services/worldData.js` on `/map` | Private S3 (SigV4 by Worker) |
| `/rss` | public RSS | RSS readers/aggregators | Lambda `action=rss` |
| `/` (bot UA) | SEO preview | crawlers | Static string, no backend |
| `/weekly/thread/:id`, `/weekly/country/:name`, `/daily[/:dateKey]` (bot UA) | SEO/social preview | crawlers | Lambda `thread_preview`/`country_preview`/`daily_brief` |
| everything else | the actual app | every real visitor | Pass-through → GitHub Pages SPA |

---

## SYSTEM_WIRING.md drift found this pass

1. **§1 row 14 / §1.3 diagram:** `newsPostDevTo` flagged "CURRENTLY BROKEN — see OPT-1" is
   **stale** — fixed and md5-verified 2026-05-18 per OPTIMIZATION_REPORT.md.
2. **Missing fact:** `TriggerBreakingEmailSend` (15-min rate rule) is disabled in addition to the
   documented drift-email disablement — neither SYSTEM_WIRING.md nor prior memory called this out.
3. **Framing gap:** `newsRecommend` is documented/named as a recommendations engine; in live
   traffic it is 100% prefs/alerts/follow-country/unsubscribe — the `recommend()` function is
   dead code with zero frontend call sites.
4. **Biggest gap:** neither SYSTEM_WIRING.md nor WORKER_FULL_CODE.md states the Worker is the
   mandatory front door for all traffic (full-outage blast radius on failure), not just a
   bot-preview/data-proxy convenience.
5. (Already known/consistent) Task brief's "daily cap" for Analysis Studio is actually a
   **monthly allowance** — confirmed from source, not a new drift but worth correcting wherever
   "daily cap" phrasing propagates.

## Three most surprising usage facts (overall)

1. **Saved Items has zero real usage** (0 DynamoDB rows) despite a fully built heart-button UI on
   three major page types, an auth-gated Lambda, and an Account tab — a complete, correctly-wired
   feature nobody has ever used.
2. **The Cloudflare Worker is a single point of total-outage failure for the entire site**, not
   the auxiliary SEO/map-data helper both architecture docs frame it as — every browser request,
   including plain SPA delivery, depends on its `fetch(request)` passthrough line.
3. **Two of three built email products (breaking-alert and drift-alert) are fully coded, safe
   (dry-run gated), and completely inert at the EventBridge trigger level** — only the Sunday
   weekly digest actually fires. Related: `/daily`'s content generation is not its own pipeline
   at all, but a side effect of the nightly Dev.to cross-post job.
