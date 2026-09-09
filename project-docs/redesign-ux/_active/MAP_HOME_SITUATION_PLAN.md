# Map-as-Home + Situation Tracker — Plan

> **STATUS: ACTIVE — executing (P0 done, P1·T1 shipped then superseded).** Tracked in `MAP_HOME_SITUATION_LEDGER.md`.
>
> **REVISION v2 — 2026-09-08 (data strategy).** After P1·T1 shipped, the data layer was rethought: **S3 is the source of truth for everything computed about the world; DynamoDB only for per-user state** — see `project-docs/architecture/DATA_STRATEGY.md` (authoritative). Consequences inside this plan: new §3.2 (prefixes + `world/latest.json` contract), REVISED notes at the top of WS1/WS2/WS3, **§5 phases superseded by §11 stages**, §6/§9 amended. The `GlobalPerspectiveSituations` DDB table from P1·T1 is to be dropped (Stage S1). Older text below is kept for the record (ADR-style: supersede, don't overwrite).
>
> Cross-cutting: touches ingest (`pipeline-ingest`), a new backend subsystem (situation tracker), and the frontend home/map. Written for hand-off to an implementing agent. Read `CLAUDE.md`, `agent-kit/PROJECT.md`, and `project-docs/architecture/ARCHITECTURE.md` first; every fact below was verified against source on 2026-09-08 — re-verify anything that touches deployed Lambda bytes (they drift from `main`).

**Status:** PROPOSED 2026-09-08
**Owner decisions recorded:** map becomes the home page; hue-by-crisis-type; 2.5D tilted world as hero + globe fly-to on click; dark "world at night" theme; idle auto-tour with pause; breaking-alert detector + GDACS as the two situation openers; adaptive re-check cadence per situation; replace Brave in *ingest only* with GDELT DOC 2.0; keep Brave for analysis-time grounding.
**Build order is load-bearing:** ingest → tracker → map data → map UI → home swap. Building the map first would only render today's flawed signal more beautifully.

---

## 1. Why

A visitor's first question is **"what is happening, where, and how bad — right now?"** The current home (`/`) is a ranked story list: the visitor must scroll and read to learn *where*. The current `/map` (`components/WorldMapV2.jsx`) answers the wrong question — it colours countries by a **z-score of our own mention counts** (a signal about our coverage, not about the world), lights up 30–40 countries at once, cannot say *what kind* of thing is happening, cannot say *whether it is getting worse*, and hides its own staleness.

The goal: land on `globalperspective.net` and, in ~3 seconds, see **where** the world is hurting, **what kind** of hurt (conflict / political / economic / humanitarian), **how bad**, **which of it is escalating**, and **how current** the picture is — with the page continuing to refresh while you watch, and honest about when it isn't.

## 2. Verified current state (2026-09-08)

### 2.1 Ingest — `newsInvokeGemini` (every 4h, `InvokeGoogleGemini` scheduler)
- Sources: ~22 English-language RSS feeds (BBC, Guardian, Al Jazeera, NPR, CNA, Nikkei, …) + **10 fixed Brave News queries** (`site:reuters.com…`, `site:apnews.com…`, Latin America, climate, science…; `search_lang=en`). Articles >48h dropped.
- Selection: **one LLM call** sees every headline and picks up to `TOPICS_LIMIT` (**env = 13**; code default 15) under (a) a **category-balance rule** (no category >25%; must include climate/science/… when possible) and (b) a **24h soft-dedup rule** ("PRIORITIZE genuinely NEW events not already covered today"). Continuity only via LLM-guessed `continues_topic` title string.
- Regions emitted as **free-text names** chosen by the model (`"Palestine"`, `"the Sahel"`, …). No ISO codes, no coordinates, no per-story severity persisted.
- `captureIngestion()` already logs SAW-vs-CHOSE per cycle (the eval basis; see `pipeline-ingest/IMPACT_VALIDATION_METHODOLOGY.md`).

### 2.2 Deterministic feeds already ingested but **shadowed** (never reach the UI)
- `newsGdacsIngest` (`cron(0 */6 * * ? *)`, 71 lines) → `GlobalPerspectiveGdacsEvents`. Stores `eventKey/eventType/alertLevel/alertScore/country/affectedCountries/iso3/name/description/severity*/fromDate/toDate/dateModified/reportUrl`. **Drops `f.geometry` (coordinates).** Only readers: `newsImpactAudit`, `newsGdeltConflict`.
- `newsGdeltConflict` (`cron(0 */6 * * ? *)`) → `GlobalPerspectiveGdeltConflict`, keyed `day#country` with `totalMentions/eventCount/minGoldstein/worstTone/topEvent…`. Per-country daily aggregate, conflict-only. Only reader: `newsImpactAudit`.

### 2.3 Breaking-alert detector — `newsBreakingAlert` (`cron(15 */4 * * ? *)`, ENABLED)
- Scores significance of the latest topics (`significance.js`; `axisForCategory` maps category → 4-axis dimension; `RISK_CAP=50`; ~14% precision by design). Writes `GlobalPerspectiveBreakingAlerts` keyed `alertKey = threadId`, triggers email via `newsEmailSender` (`rate(15 minutes)`). **Fires and forgets — nothing keeps watching the story afterwards.** Tuned to country-risk dominance → will miss most natural disasters.

### 2.4 Other cadences the design depends on
- `newsDriftCorrector` 07:20 UTC daily (per-analysis "what changed"); `newsFreshnessMonitor` `cron(30 0/2 * * ? *)` (SNS if content >9h stale; **status not exposed to the frontend**); `newsMarketsData` hourly; `newsPairIntelligence` Mondays 08:00.

### 2.5 Frontend — `WorldMapV2.jsx` (1362 lines, route `/map`)
- D3 `geoEqualEarth`, **fully imperative SVG** (full teardown/rebuild on every redraw, including UI-chrome toggles; `ResizeObserver` redraw undebounced).
- Topology from **unpinned CDN** `cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`, **no `.catch()`/fallback** → stuck on "Loading world topology…" forever on failure.
- Own name→ISO tables (`NUM_TO_A3` l.25-56, `TOPO_NAME_FIXES` l.59-91, `EXTRA_ALIASES` l.94-109) — **diverged from the canonical `utils/countryMapping.js`**, which has `Kosovo→XK` and `Palestine→PS`. **Palestine / Gaza / West Bank / Kosovo silently match nothing** (and Natural Earth 110m has no Palestine polygon → no centroid either). All match misses are silent.
- Signal = 7-day mention count vs prior-window mean/std (`hooks/useCountrySignal.js`); High ≥1.5σ, Elevated ≥0.5σ; **degrades to raw count-difference** for low-variance / <10-day-history countries yet keeps the σ thresholds.
- Layers: today / connections (pair arcs from `pair_analyses_list`) / editorial. Pair-arc click opens one country (`// /weekly/pair has no route`, l.611-612). No URL state. Legacy `components/WorldMap.jsx`, `MapSidePanel.jsx`, `MiniMap.jsx` are v1 leftovers.
- Data actions used: `archive_range`, `pair_analyses_list`, `getGeminiTopics`, disruptions list; on select `country_intelligence`, `country_history`, `systems_analysis`, `markets_country`. `Home` = `components/Home.jsx` at `/` (`App.jsx:100`), `WorldMapV2` at `/map` (`App.jsx:101`).

### 2.6 Brave usage — MEASURED 2026-09-08 (P0·T1; full audit `scripts/brave-audit.md`)
Six Lambdas call Brave: `newsInvokeGemini-dev` (ingest gap-fill, ~10 queries × 6/day ≈ 1,800 attempts/mo) and five **analysis-grounding** callers (`newsCountryIntelligence`, `newsThreadAnalysis`, `newsPairIntelligence`, `newsPredictionResolver`, `NewsProjectInvokeAgentLambda-dev`). Config: `BRAVE_CONCURRENCY=1` in prod (source default 3), key valid (no 401/403). Pricing 2026-09-08: free ≈2K/mo, then ≈$3–5/1K.

**Ingest — measured:** Brave is **~5.8% of the article pool** (avg 10.4 Brave vs 167.5 RSS/run), **18%-ish 429 rate-limited** (334 failures/30d, *all* 429), and the flagship wire target `reuters.com` returns **~0.38 articles/run** (apnews never succeeds). Decisive value metric from the capture table (197 runs, 2,740 chosen topics): **`brave_unique_chosen` = 0.4%** — only 12 chosen topics were sourced *solely* from Brave-only domains; the rest also had RSS. **→ Brave adds ~nothing unique to ingest; remove it (P1·T4), GDELT replaces with no meaningful loss, no fallback needed.**

**Grounding — partially measured:** 30-day invocation anchors (country/thread/resolver = 30, pair = 5, agent = 180); true Brave volume = invocations × internal loop size and is **not log-derivable** (grounding fns log Brave only on failure). Real usage/plan **blocked on the operator's Brave dashboard**. Grounding stays on Brave; value (part D) + Exa trial (part E) deferred to a separate provider follow-up (does not gate the map/tracker).

## 3. Target architecture

```
RSS (primary) ─┐
GDELT DOC 2.0 ─┤ (breadth: 65 langs, source country)      GDACS (natural hazards, geo, alert level)
               ▼                                                       │
   WS1  per-article STRUCTURED classification (batched, flash-class)   │  no LLM
        { iso3[], latlon?, category, axis, severity 1-5, event|commentary, entities }
               ▼                                                       │
   WS1  deterministic CLUSTERING → stories                             │
        (iso3-set × category × entities) · outlets · first_seen · velocity · spread
               │                                                       │
               ├───────────────► editorial selector (existing prompt, quotas+dedup kept) → topics/brief (unchanged UI)
               │                                                       │
               ▼                                                       ▼
   WS2  newsSituationTracker  ◄── openers: newsBreakingAlert (LLM-scored) + GDACS Red/Orange (deterministic)
        GlobalPerspectiveSituations · state machine · adaptive next_check_at · cheap-detect → LLM only on change
               ▼
   WS3  proxy actions: situations_list / situation_get / freshness_status
               ▼
   WS4  Map UI (WebGL 2.5D world · hue=axis · height=severity · ripple=escalating · luminance=age · spread arcs · tour · scrubber · globe fly-to)
               ▼
   WS5  `/` = map; ranked list + systemic dock below the fold (real HTML, carries SEO/a11y); old Home content demoted
```

### 3.1 The LLM boundary (decided 2026-09-08, second pass)

The cost and honesty line of the whole design. **A disaster pin can appear, grow, spread and fade without a single model call.**

| Step | Cadence | LLM? |
|---|---|---|
| GDACS poll → situation opened/updated (level, score, affected countries, coordinates) | 20 min | **No** — authoritative UN/EU data |
| GDELT poll → per-country event counts / geo | 6h (faster later) | **No** |
| Tracker check: did anything move? (level change, new iso3, cluster velocity, GDELT delta) | 10-min sweep; per-situation cadence | **No** — deterministic deltas |
| Tracker `what_changed` text | only when a delta fired | **Template first** ("Alert raised Orange→Red · 2 new countries affected · 14 new reports"). LLM only for a narrative line, and only when the *news cluster* changed materially |
| Per-article classification (iso3/axis/severity) | **hourly** (see below) | Yes — `deepseek-v4-flash` (already the ingest provider), batched 30/call |
| Editorial topics / summaries / predictions | 4h / daily as today | Yes — unchanged pipeline |

**Two object models — thread vs situation.** Everything user-facing today hangs off a *thread* (summary, prediction, drift, LinkedIn, email). A GDACS-opened situation has **no thread**. Decision:
- **Option A (default): situation card is deterministic** — event type, magnitude/level, affected countries, GDACS report link, spread history, since-opened timeline. No summary, no prediction. The card *states* it: "Analysis: not generated for Orange-level events" / "Analysis: pending (next run 18:00)".
- **Option B (Red alerts only): auto-create a thread** so the existing analysis pipeline (summary → prediction → drift) picks it up next cycle. Rare, high-value, worth the cost.
- Breaking-alert-opened situations carry a `threadId` and get full depth for free.

**Further decisions locked in this pass:**
1. **Ingest cadence decoupled.** RSS fetch + per-article classification runs **hourly** (cheap: fetch + ~10–20 flash calls); editorial selection stays **4h**. Otherwise a war escalates for 4h before the map notices.
2. **Merge rule — one event, one pin.** A GDACS situation and a news cluster with the same iso3 + `disaster`/humanitarian axis within 48h → the cluster **attaches** to the GDACS situation. Never two pins for one quake.
3. **No situation-level predictions in v1.** A situation shows its thread's predictions when it has a thread; it never generates its own (methodology-v1 calibration untouched).
4. **Escalation thresholds start conservative** — `escalating` = spread ≥1 new iso3 in a cycle **or** velocity ≥2× the prior cycle — and are tuned on shadow data: **P2 runs `DRY_RUN` for ~one week before any pin is shown.**
5. **Daily LLM budget.** Two hard caps, both as CloudWatch metrics: tracker narrative + Option-B thread creation **300 calls/day** (`TrackerLLMCallsToday`; over cap → template text only), classifier **600 calls/day** (`ClassifierLLMCallsToday`; over cap → skip classification for the remainder of the hour, log it). Never a silent bill.
6. **Build-order fix.** `GlobalPerspectiveSituations` is created **first** (P1·T1) and **`newsGdacsIngest` writes situations directly** — it is a deterministic opener, so it needs no tracker to exist. The tracker Lambda then only sweeps the table.
7. **Retention:** closed situations stay on the map 48h (grey outline), in the table 60d (scrubber history).

### 3.2 Data strategy (v2, 2026-09-08) — S3 for the world, DynamoDB for the user

Authoritative text: `project-docs/architecture/DATA_STRATEGY.md`. Summary as it binds this plan:

- **No new DynamoDB tables.** Situations, stories, corpus, snapshots are S3 objects in `globalperspective-world-<account>` (private). `GlobalPerspectiveSituations` (P1·T1) is dropped in S1.
- **One writer per prefix; openers append events, the tracker folds state:**
  `corpus/` + `stories/` ← `newsSituationIngest` (hourly) · `situations/inbox/` ← openers (GDACS, breaking-alert; append-only) · `situations/state|index|history/` + `world/` ← `newsSituationTracker` (10-min sweep, sole writer).
- **The frontend reads one object, `world/latest.json`**, via the Cloudflare Worker (`/data/*`, SigV4 to S3, edge-cached); `world/latest.member.json` is served only with a valid Firebase JWT. Per-situation detail = `situations/state/<id>.json` on click; scrubber = `world/YYYY/MM/DD/HHMM.json`. Contract in DATA_STRATEGY §5.
- **Freshness is in the data** (`generated_at`, per-source stamps, `stale`) — the page displays it, never computes it. `composeTopicsLede` + the ranked list are computed by the tracker, once per sweep.
- **WS3's three proxy actions are gone** — replaced by `services/worldData.js` + `useWorld()` + the Worker route. `newsSensitiveData` trends toward user-actions-only.
- **Local dev on fixtures** (`fixtures/world.json`) — frontend never waits for backend.

## 4. Workstreams

### WS1 — Ingest: score every article, then aggregate (replaces "ask the model to pick 13")

> **REVISED v2:** one hourly Lambda **`newsSituationIngest`** (Option A) does fetch → classify → cluster and writes **`corpus/YYYY/MM/DD/HH.jsonl` + `stories/state|index`** in S3. No `GlobalPerspectiveStories` table, no separate classifier Lambda. GDACS (§6 below) becomes an **inbox writer** (`situations/inbox/`), not a state writer. Everything else in WS1 (classification schema, clustering rule, merge rule, eval, GDELT, Brave removal) stands.

**Problem being solved:** fixed slots + category quotas + "prioritize NEW" suppress ongoing crises and can't express importance, spread, or location structurally (§2.1).

1. **Sources.** Keep RSS as primary. **Add GDELT DOC 2.0** (`api.gdeltproject.org/api/v2/doc/doc?…&mode=artlist&format=json`, free, no key, **1 request / 5 s** rate limit — serialize calls; rolling 3-month window; returns title/url/domain/language/sourcecountry, **no snippet**). Query set: one per world region + one per active situation (tracker feeds back its entity terms). **Remove the 10 Brave queries from `newsInvokeGemini`.** Keep RSS description text; GDELT is breadth/languages/geo, not backbone (GDELT has occasional outages — degrade to RSS-only, log it).
2. **Per-article classification** — new Lambda `newsArticleClassifier` (or a stage inside `newsInvokeGemini`; prefer a separate Lambda per `feedback_clean_architecture`). Batch ~30 headlines(+description) per call on the flash-class model (see `project_ai_provider_migration`: flash = "rest"). Strict JSON per article:
   ```json
   { "id": "...", "iso3": ["IRN","ISR"], "latlon": [lat, lon] | null, "category": "conflict|politics|economy|military|disaster|technology|…",
     "axis": "conflict|political|economic|humanitarian", "severity": 1-5, "kind": "event|commentary|analysis", "entities": ["Strait of Hormuz","IRGC"] }
   ```
   Rules: **ISO3 only** (model may not emit free-text regions); sub-national events carry `latlon`; anything the model can't code → `iso3: []` and is written to the error sink (`newsClientErrors` pattern / CloudWatch metric `UnmatchedRegion`) — **never silently dropped**.
3. **Deterministic clustering** (no LLM): group by (iso3-set ∩ category ∩ ≥1 shared entity) across the last 72h → `story` with `outlets` (distinct domains), `first_seen`, `last_seen`, `velocity` (Δ articles/cycle), `spread` (new iso3 vs previous cycle), `max_severity`. Persist to a new table `GlobalPerspectiveStories` (PK `storyId`, GSI on `last_seen`; TTL 30d). This is the honest importance signal: *how many independent outlets, how fast, how many countries.*
4. **Editorial selector unchanged in behaviour** — the existing selection prompt now receives the scored clusters (top-N by outlets×severity) instead of raw headlines; keeps quotas and dedup **because those rules are right for a brief**. Threads keep their current shape so `/weekly/*`, LinkedIn, email are unaffected. `continues_topic` becomes `storyId` linkage (structural continuity), keep the string field for backward compat.
5. **Eval.** `captureIngestion` already records SAW vs CHOSE; extend it with `clusters` so `IMPACT_VALIDATION_METHODOLOGY.md` can measure missed-high-impact per cycle. Acceptance: a Red-alert GDACS event or a ≥8-outlet conflict cluster is never absent from `stories` in the cycle it appears.
6. **GDACS promotion.** In `newsGdacsIngest`: keep `f.geometry` → `lat/lon`; keep `alertScore` history (`alertHistory: [{at, level, score}]`); cadence `cron(0 */6 …)` → **`rate(20 minutes)`** (free feed, no LLM); **write/update a row in `GlobalPerspectiveSituations` directly** on any Red/Orange or on a level rise (§3.1 decision 6 — no tracker dependency; Red → also Option B thread creation). GDACS covers EQ/TC/FL/VO/DR/WF only — famine/displacement/epidemics still come via news; ReliefWeb (UN OCHA) is a *candidate* third opener — verify terms before planning.
7. **GDELT `newsGdeltConflict`** — un-shadow later (WS2 uses its per-country daily conflict intensity as a cheap change-detector). Live bytes verified **identical to `main`** 2026-09-08 (P0·T2); re-diff at edit time.

**Cost:** ~300–600 headlines/hour-window, batched 30/call → ~10–20 flash calls per **hourly** classification run (≈300–500/day, inside the §3.1 daily cap). Brave ingest calls −1,800/mo.

### WS2 — Situation tracker (new subsystem)

> **REVISED v2:** the tracker is the **folder** and the **sole writer** of `situations/state/<id>.json`, `situations/index.json`, `situations/history/…` and the frontend bundle `world/latest.json` (+ member bundle + timestamped snapshots). Each 10-min sweep: read `situations/inbox/` (new events from openers) → fold into state → read `stories/index.json` for escalation/merge signals → cheap-detect → template `what_changed` (LLM only on material news change, under the daily cap) → write state + index + history + `world/`. Adaptive cadence lives as `next_check_at` inside each state object; the sweep reads `index.json`, not a GSI. `DRY_RUN` writes to `world/shadow/` for the ~1-week shadow. Record schema below is unchanged except: no `gsiAll`, no DDB keys; `situationId` is the object name.

**Problem being solved:** nothing keeps watching a story after it's flagged; cadence is a property of the pipeline, not of the story.

- **Lambda `newsSituationTracker`** (Node 20, 512MB, 120s), **table `GlobalPerspectiveSituations`** (PK `situationId`; GSI1 `state`+`next_check_at`; GSI2 `updated_at`; TTL 60d after close). Trigger: `rate(10 minutes)`; each run processes rows with `next_check_at ≤ now`.
- **Record:**
  ```
  situationId, source ('breaking'|'gdacs'), threadId?, storyId?, gdacsEventKey?,
  title, verb_label ("Hormuz — shipping halted"), axis, tier (Low|Moderate|High|Critical via utils/riskTiers bands),
  escalation {geo_spread, velocity, category_weight, spillover} → escalation_score 0-1 (INTERNAL, not displayed),
  state ('emerging'|'escalating'|'peak'|'cooling'|'closed'),
  iso3_origin[], iso3_affected[], centroid {lat,lon}, spread_arcs [[from,to,since]],
  opened_at, updated_at, last_change_at, next_check_at, check_count, cadence_min,
  what_changed (latest 1–2 sentences), evidence {outlets, articles_24h, gdacs_level, gdelt_events},
  history [{at, tier, escalation_score, state}]
  ```
- **Openers:** (a) `newsBreakingAlert` on writing an alert → `openSituation(threadId)` (conservative: only the detector, not every Moderate+ thread — owner decision); (b) GDACS Red → Critical / Orange → High, `axis=humanitarian`, `verb_label` from `eventType`+`name` (“Sulawesi — M7.2 earthquake”), `iso3_affected` from `affectedCountries`. Green tracked silently (not shown unless it rises).
- **Escalation (4 measurable dimensions):** geographic spread (Δ|iso3_affected|), velocity (2nd derivative of cluster article count), category weight (war/disaster/financial contagion/epidemic high; ruling/summit low), cross-domain spillover (conflict story co-moving with `newsMarketsData` energy/shipping/neighbour FX, or an `economy` cluster sharing entities). Score internal; UI shows the **evidence** (“spreading to 3 new countries since yesterday”), never the number.
- **Cadence table:**
  | tier / state | recheck |
  |---|---|
  | Critical or `escalating` | 30 min |
  | High | 2 h |
  | Moderate / `cooling` | 6 h |
  | Low for 3 consecutive checks | → `closed`, stop |
- **Cheap-detect → template → (maybe) LLM:** each check first computes deterministic deltas (new cluster articles? GDELT/GDACS change? iso3 set grew? velocity up?). If nothing moved, bump `check_count`/`next_check_at` and stop. If something moved, write a **templated** `what_changed` from the deltas ("Alert raised Orange→Red · 2 new countries affected · 14 new reports"). Call the LLM for a narrative line **only** when the *news cluster* changed materially (velocity ≥2× or new iso3 from news) and the daily cap (§3.1.5) allows — reuse `newsDriftCorrector`'s grounded pattern. A quiet war, and every disaster, must cost ~0 model calls/day.
- **Closing:** tier Low for 3 checks or GDACS event closed → `closed`; the map fades it (WS4), never deletes. `history` kept for the sparkline and for the scrubber.
- **Verify/acceptance:** unit tests for the state machine + cadence; a dry-run mode (`DRY_RUN=true` like siblings); CloudWatch metrics `SituationsOpen`, `ChecksRun`, `LLMCallsAvoided`. Add to `newsFreshnessMonitor`'s probe set.

### WS3 — Map data layer (frontend + Worker)

> **REVISED v2:** item 1 (three proxy actions + polling hooks) is **replaced** by: `services/worldData.js` (fetch `/data/world/latest.json` through the Cloudflare Worker; ETag/If-None-Match; 5-min refresh while the tab is visible), `useWorld()` and `useSituationDetail(id)` hooks, and a Worker `/data/*` route (SigV4 → S3, `s-maxage` ≈ sweep interval, JWT check for `*.member.json`). `freshness_status` is the bundle's own `stale`/`sources` fields. Items 2–5 (canonical ISO + centroids, bundled topology, drop z-score, URL state) stand unchanged.

1. **Proxy actions** in the shared proxy Lambda (`newsSensitiveData`): `situations_list` (open + closed <48h; public, no auth), `situation_get {situationId}` (full record + history), `freshness_status` (latest `newsFreshnessMonitor` result: `{ok, oldest_source_at, next_expected_at}`). Follow `services/restProxy.js` `{action, payload}` pattern; add hooks `useSituations()`, `useFreshness()`; poll every 5 min while tab visible (`document.visibilityState`).
2. **One canonical name→ISO.** Delete `WorldMapV2`'s `NUM_TO_A3`/`TOPO_NAME_FIXES`/`EXTRA_ALIASES`; import `utils/countryMapping.js`; add a **manual centroid table** for territories with no 110m polygon (`PS`, `XK`, small states) in `utils/countryCentroids.js`. **Any unmatched name → `errorSink` with the raw string** (silent drop forbidden; `feedback_no_misinformation_fallback`).
3. **Bundle topology locally** (`src/assets/countries-110m.json`, ~100KB; pin `world-atlas@2.0.2` in the copy's header comment). Remove CDN fetch. Failure → render the ranked list immediately with the stamp, never a blank hero.
4. **Retire the z-score as the visual driver.** `useCountrySignal` stays available for the country drill-down only (label it "attention", not risk). Situations drive the map.
5. **URL state:** `?focus=<situationId|iso3>`, `?t=<ISO date>` (scrubber), `?layer=` — follow the `threadPath()` query convention (`reference_page_wiring_contracts`). LinkedIn/email links must land on the right view.

### WS4 — Map UI (rewrite; WebGL)

**Encoding — five questions, five channels**
| Question | Channel | Rule |
|---|---|---|
| Where | column base position | situation `centroid`; bilateral → midpoint |
| What kind | **hue** | conflict `#E4572E` (red-orange) · political `#8E6CEF` (violet) · economic `#2BB3D6` (cyan) · humanitarian/disaster `#F2B134` (amber). Colour-blind checked; never red vs green as a pair |
| How bad | **column height + glow radius** | Low = flat dot · Moderate = short · High = tall · Critical = tall + bloom |
| Getting worse | **outward ripple rings** | only `escalating`; `peak` steady; `cooling` no motion. Motion is reserved |
| How current | **luminance decay** | <1 cycle full · fades over 24h · `closed` = grey outline, removed after 48h |
Plus **spread arcs** (thin, situation hue) from origin to each newly affected iso3 as `iso3_affected` grows.

**Renderer:** deck.gl (`GeoJsonLayer` base + `ColumnLayer` + `ArcLayer` + custom ripple layer) over an Equal-Earth-projected flat world, camera pitched ~25° → "2.5D tilted world" (whole world always visible — a globe hides half the Earth and fails the 3-second job). **Click → fly-to** into a globe view (globe.gl/three.js, or deck.gl `_GlobeView`) centred on the situation with neighbours, arcs, spillover chain; Escape returns. `prefers-reduced-motion` → static tilt, no ripple/tour. Dark ground ("world at night"): matte relief countries, situations as light sources. **An empty dark world is the honest "nothing critical" state** — no filler.

**Labels:** top 5–7 only, `Place — verb` from `verb_label`; others unlabeled light, hover reveals.

**Layout (desktop):** floating translucent top bar (brand · `● Updated 14:00 UTC · next ~18:00` · 7-day scrubber) → hero world → bottom strip "N situations being watched" (ranked rows: tier chip, state arrow, evidence line, age; hover row ⇄ column brightens, rest of world dims) → **Systemic dock** (non-geographic: rates/oil/shipping/export rules from economic disruption + weekly markets) → old Home content (lede band, topic list, trust strip) below the fold as real HTML.
**Mobile:** world = top ~45% (pinch/pan, top-3 labels), ranked list is primary; tour still runs.
**Idle auto-tour:** after ~4s idle, fly to top 3–5 situations ~6s each with caption; any input interrupts; visible ⏸ toggle; preference in `localStorage` (`gp_map_tour`, purged on sign-out like other `gp_*`).
**Scrubber:** replays `history` (tiers/hues/arcs) over 7 days.

**Honesty states (designed, not accidental):**
- `freshness_status.ok=false` (>9h stale) → whole world desaturates to grey, columns freeze, banner "Not updated since HH:MM UTC — analysis delayed". Stamp always shows the **oldest** dependent source, not the newest.
- No open situations → calm dark world + "No critical situations being tracked · last check HH:MM".
- Hover card states facts: "Watching every 30 min · last change 14:12 UTC" vs "Closed — tier Low since Sep 5".

### WS5 — Home swap, routes, cleanup

- `App.jsx`: `/` → new `SituationHome` (map hero + below-fold list); `/map` → redirect to `/`. Keep `Home.jsx`'s lede/trust-strip/topic list as sections of the new page (SEO text the Cloudflare Worker doesn't pre-render for `/` — `project_cloudflare_worker`).
- Restore **`/weekly/pair/:slug`** so arc/bilateral click-through opens the pair, not one country (pair records exist: `project_pair_intelligence`).
- Delete legacy `components/WorldMap.jsx`, `MapSidePanel.jsx`, `MiniMap.jsx` after a zero-reference grep (`tokens.js` references `MiniMap` — fix that first).
- Nav/cross-links: "Map" entry becomes "Home"; update `SITE_ORIENTATION_PLAN` follow-ups.

## 5. Build order & phases — **SUPERSEDED 2026-09-08 by §11 (stages S0–S8)**

> Kept for the record. P0 (all tasks) and P1·T1 were executed under this section; P1·T1's DDB-table outcome is reversed in Stage S1. §5.1 (Brave protocol) remains valid and its results stand.

| Phase | Scope | Exit criterion |
|---|---|---|
| **P0 measure** | Brave investigation protocol (§5.1); GDACS/GDELT live-bytes diff vs `main`; confirm `TOPICS_LIMIT` env | numbers written into §2.6 + §5.1 decision table filled |
| **P1 ingest** | WS1 §1–3, §6 (GDACS geometry + 20-min cadence) — shadow tables only, UI untouched | 7 days of `stories` + `captureIngestion.clusters`; missed-high-impact audit passes |
| **P2 tracker** | WS2 end-to-end in `DRY_RUN`, then live | ≥1 real situation opened by each opener; cadence + closing observed; LLM calls ≈ changes only |
| **P3 map data** | WS3 (proxy actions, canonical ISO, local topology, URL state) on `/map` with the existing renderer | Palestine/Kosovo render; no CDN fetch; unmatched → error sink |
| **P4 map UI** | WS4 behind `/map` (not yet home) | browser click-through per `feedback_test_ui_in_browser`; mobile; reduced-motion; grey-out state forced via a stale fixture |
| **P5 home swap** | WS5 | `/` is the map; `/weekly/pair` works; legacy components gone; smoke-test + link-crawl pass |
| **P6 editorial switch** | WS1 §4 (selector consumes clusters) | brief quality unchanged per `IMPACT_VALIDATION_METHODOLOGY` |

### 5.1 P0 — Brave investigation protocol (CloudWatch + DDB; read-only, no code changes)

**Question to answer:** is Brave earning its place — (a) in ingest, does it surface stories the RSS set misses? (b) in grounding, does it work reliably and get used? Decide on numbers, then act per the decision table.

**Fact that shapes the method (verified 2026-09-08):** the five grounding Lambdas log Brave **only on failure** (`console.warn('Brave news search failed…')`, `'Brave web search failed…'`, `'Brave grounding failed for …'`, `'Brave search failed for ${countryName}'`). A successful call leaves no log line, so their volume must be **derived**, not counted. `newsInvokeGemini` is the exception: it logs `Fetching N Brave queries…`, one `Brave "<query>…": N articles` per query, `Brave "<query>…" failed: <status>`, and `COMBINED: N unique articles (X RSS + Y Brave)`.

Log groups are `/aws/lambda/<deployed function name>` — deployed names may carry a suffix (the scheduler targets `newsInvokeGemini-dev`; cf. `newsSensitiveData-dev`). Run `aws lambda list-functions --query 'Functions[].FunctionName'` first and substitute. Window: last 30 days.

**A. Ingest volume, yield and failure rate** — CloudWatch Logs Insights on the `newsInvokeGemini` group:
```
# per-query yield
fields @timestamp, @message | filter @message like /Brave "/ | parse @message /Brave "(?<q>[^"]+)\.\.\.": (?<n>\d+) articles/ | stats avg(n), min(n), max(n), count() by q
# failures by HTTP status (429 = rate limit, 401/403 = key/plan)
fields @timestamp, @message | filter @message like /Brave .* failed: / | parse @message /failed: (?<status>\d+)/ | stats count() by status
# Brave's share of the combined pool per run
fields @timestamp | filter @message like /COMBINED:/ | parse @message /\((?<rss>\d+) RSS \+ (?<brave>\d+) Brave\)/ | stats avg(rss), avg(brave), avg(brave/(rss+brave)) by bin(1d)
```
Expected: 10 queries × 6 runs/day ≈ 60 calls/day ≈ 1,800/mo. Record the actual.

**B. Ingest value — does Brave content get *chosen*?** — the capture table (`CAPTURE_TABLE` in `newsInvokeGemini`; `captureIngestion` writes `input[]{title,source,url}` and `chosen[]{sourceUrls}` per run). Brave articles are not tagged, but Brave-only domains are known from the query list: `reuters.com`, `apnews.com`, `straitstimes.com`, `timesofindia.indiatimes.com`, `koreaherald.com`, `kyivindependent.com`. Script (Node, read-only scan of last 30 days):
- `brave_share_input` = input articles from Brave-only domains ÷ all input.
- `brave_share_chosen` = chosen topics with ≥1 `sourceUrls` on a Brave-only domain ÷ all chosen.
- `brave_unique_chosen` = chosen topics whose **only** sources are Brave-only domains (the stories RSS would have missed entirely).
Interpretation: `brave_unique_chosen` is the number that matters. If it is ~0 (wire stories re-carried by BBC/Guardian/NPR/CNA within the hour, as expected), Brave adds no unique coverage to ingest and GDELT replaces it with no loss. If it is material (>5% of chosen), keep the two wire-service queries as a transitional Brave fallback while GDELT settles.

**C. Grounding volume (derived) and failure rate** — for each of `newsCountryIntelligence`, `newsThreadAnalysis`, `newsPairIntelligence`, `newsPredictionResolver`, `NewsProjectInvokeAgentLambda`:
- Volume = CloudWatch metric `AWS/Lambda Invocations` (Sum, 30d) × Brave calls per invocation from source (country: news+web = 2 per country; thread: 2; pair: 2; resolver: 2 per unresolved prediction; agent: 1 per topic). Sum → estimated monthly grounding calls.
- Failure rate = Logs Insights `filter @message like /Brave .* failed/ | stats count() by bin(1d)` ÷ derived volume. Note the `err.message` distribution (timeouts vs 429 vs non-JSON).
- **Truth check:** operator opens the Brave API dashboard (usage page) and records the real monthly query count and plan/tier; reconcile against the derived estimate. The dashboard is the only ground truth for grounding volume — record both numbers.

**D. Grounding value — are Brave results actually cited?** Sample 20 recent analyses across country/thread/pair; for each, compare the cited `sources` URLs in the DDB record (field name to verify per Lambda — `sources[]`, `citations`, or inline) against what the Brave call returned (re-run the same query locally with the key, compare domains). Report: % of analyses citing ≥1 Brave-sourced URL. If grounding Lambdas rarely cite Brave results, the calls are cost without value and the Exa trial (§5.1 E) moves up.

**E. Alternative trial (grounding only, optional in P0, required before any grounding swap):** take the 20 queries from D, run them blind through Brave and Exa (free tier), have a reviewer score each result set 1–5 on "evidence usable to support/refute the analysis claim" without knowing the provider. Only a clear Exa win (≥1 point mean) justifies re-plumbing five Lambdas.

**Decision table — FILLED 2026-09-08 (P0·T1):**
| Metric | Value | Threshold → action |
|---|---|---|
| Ingest calls/mo (A) | ~1,800 attempts | informational |
| Ingest failure rate (A) | **~18%, all HTTP 429** (334/30d); no 401/403 | key/plan fine; Brave rate-limited → unreliable for ingest |
| `brave_unique_chosen` (B) | **0.4%** (12/2,740) | **<5% → REMOVE Brave from ingest outright (WS1 §1 / P1·T4); no fallback** |
| Grounding calls/mo derived vs dashboard (C) | anchors only (inv: 30/30/30/5/180); dashboard **not yet supplied** | ⛔ blocked on operator dashboard |
| Grounding failure rate (C) | not derivable (success unlogged) | measure via dashboard |
| % analyses citing Brave (D) | not measured | deferred to grounding-provider follow-up |
| Exa vs Brave blind score (E) | not run | deferred |

**Outcome:** ✅ ingest-Brave removal approved by the numbers (P1·T4 unblocked, no transitional fallback). Grounding stays on Brave; parts C/D/E become a separate "grounding search provider" follow-up gated on the operator supplying dashboard usage — they do not block the map/tracker build. Full audit + queries: `scripts/brave-audit.md`. No Lambda modified in P0.

Each phase is a separate branch off `main`, verified with `cd global-perspectives-starter/frontend && npm run verify`, deployed only on an explicit "yes" (`agent-kit/CLAUDE.template.md` gate). Lambda mutations: bare single `aws` commands (`feedback_prod_aws_deploy_classifier`); merge-don't-clobber env; new Function URLs are not needed (all new reads go through the shared proxy).

## 6. Decisions already taken (don't re-open)

- Map is the home page; the list is the drill-down, not the hero.
- Hue = crisis **type** (4 axes), not a single severity scale.
- 2.5D tilted flat world = hero; globe = fly-to mode only.
- Dark theme for the front door.
- Auto-tour ships with visible pause + remembered preference.
- Openers = breaking-alert detector + GDACS only (conservative). Escalation score is internal; UI shows evidence.
- Brave: **remove from ingest** (→ GDELT DOC 2.0); **keep for grounding**; Exa is a later quality trial, not a cost move. The P0 protocol (§5.1) does not re-open this — it sizes the ingest removal (transitional wire-service fallback or not) and decides whether a grounding trial is worth scheduling. *(P0 result: `brave_unique_chosen`=0.4% → removed outright.)*
- **Data strategy (v2):** S3 is the truth for everything computed about the world; DynamoDB only for `Users`/`SavedItems`/`UserPrefs`/`ApiKeys`. One writer per prefix. Openers append inbox events; the tracker is the sole writer of situation state and of `world/latest.json`. Frontend reads S3 through the Cloudflare Worker (private bucket, JWT-gated member bundle). Existing tables migrate incrementally (prediction log first), never big-bang. → `DATA_STRATEGY.md`.
- **Option A ingest:** one hourly `newsSituationIngest` Lambda (fetch → classify → cluster), not a separate classifier Lambda.
- **Tiers:** canonical `low/moderate/elevated/high`; "critical" is display-only (`high` + escalating).
- No "LIVE" badge — batch cadence is shown as `Updated · next`.

## 7. Open items (decide during build, defaults given)

- ReliefWeb as a humanitarian opener — verify API terms; default: not in v1.
- Whether `newsArticleClassifier` is its own Lambda (default yes) or a stage in `newsInvokeGemini`.
- deck.gl `_GlobeView` vs globe.gl for fly-to — default: prototype both on one situation, keep the lighter bundle.
- Non-English RSS additions per blind region (Latin America, Central Asia, francophone Africa) — label provenance; state media flagged (`feedback_editorial_fact_layer`).

## 8. Risks

- **Cost creep** if the tracker calls the model on every check → the cheap-detect gate is mandatory, with the `LLMCallsAvoided` metric watched.
- **GDELT availability** → RSS-only degradation path, logged.
- **Bundle size** (deck.gl + globe) → code-split the map route; measure against current `docs/assets` size.
- **Deployed-bytes drift** on `newsGdacsIngest`/`newsGdeltConflict`/`newsBreakingAlert` → diff before edit.
- **Home SEO** → below-fold content must be real HTML; check `scripts/smoke-test.mjs` + link-crawl after swap.

## 9. Blast radius — what else is affected (verified against the link graph 2026-09-08)

Headline: **the topic/thread world is untouched.** Every consumer of `getGeminiTopics` (Home list, LinkedIn, email, RSS, breaking-alert) keeps the same data shape. Change concentrates in the map, the home shell, and ingest internals.

### Frontend — replaced / rewritten
| File | Change |
|---|---|
| `components/WorldMapV2.jsx` (1362 l.) | Retired; replaced by the WebGL `SituationHome` map. Its drill-down calls (`country_intelligence`, `country_history`, `systems_analysis`, `markets_country`) move to the new side panel unchanged |
| `components/Home.jsx` | Becomes the below-fold of `SituationHome`. All 26 imports reusable as-is (`LedeBand`/`composeTopicsLede`, `BreakingStrip`, `StatusStrip`, `SourceRobustness`, `TopicNav`, topic list, `SubscribeCard`, trust strip via `useTrackRecord`/`useCorrectionsFeed`) — re-hosted, nothing deleted |
| `App.jsx:100-101` | `/` → `SituationHome`; `/map` → `<Navigate to="/" />`; new `/weekly/pair/:slug` |
| `hooks/useCountrySignal.js` + tests `test/useCountrySignal.test.js`, `layers.test.jsx`, `signalFilters.test.jsx`, `searchBar.test.jsx` | z-score demoted to "attention" in the drill-down or removed. **The 4 tests encode the retired behaviour and must be rewritten/deleted with it** or `npm run verify` breaks |

### Frontend — touched lightly
| File | Change |
|---|---|
| `components/Layout.jsx:67` | nav entry `{ to: '/map', label: 'Map' }` removed (home *is* the map); nav groups re-checked vs `SITE_ORIENTATION_PLAN` |
| `components/BreakingDetailPage.jsx:106` | "See on the map →" → `/?focus=<threadId>` (lands on *that* situation) |
| `components/ThreadPage.jsx`, `CountryPage.jsx` | additive, optional (P5): "Being watched · Critical" chip when an open situation references the thread/country |
| `services/restProxy.js` | +3 actions |
| `utils/countryMapping.js` | canonical for the map (already canonical for Home's `categorizeTopicsByRegion`); new sibling `utils/countryCentroids.js` |
| `utils/errorSink.js` | new kind `unmatched_region` |
| `tokens.js` | drop `MiniMap` ref before deleting `MiniMap.jsx` |
| `scripts/smoke-test.mjs:106, 423` | `/map` route entry + the map-specific check → retarget to `/`; add `/weekly/pair/<slug>` |

### Frontend — deleted
`components/WorldMap.jsx` (v1), `MapSidePanel.jsx`, `MiniMap.jsx` — after the `tokens.js` fix and a zero-reference grep.

### Frontend — unchanged
`/daily`, `/economy`, `/weekly`, `/weekly/countries`, `/weekly-brief`, `/track-record`, `/analyze`, `/account`, `/saved`, `/signin`, `/spider-demo`, legal pages, `AuthBridge`, **`docs/config.js`** (no new endpoints — everything rides the shared proxy). deck.gl grows the bundle → the map route is code-split so other pages don't pay for it.

### Backend — modified (all byte-identical to `main` as of 2026-09-08, P0·T2)
| Lambda | Change | Downstream |
|---|---|---|
| `newsGdacsIngest` | geometry, `alertHistory`, `rate(20 minutes)`, writes `GlobalPerspectiveSituations` directly; Red → Option-B thread | none — `newsImpactAudit` reads same table + new fields |
| `newsBreakingAlert` | +1 write `openSituation(threadId)` | email path untouched |
| `newsInvokeGemini-dev` | Brave block removed, GDELT fetch, `captureIngestion.clusters`; P6: selector consumes clusters | **topics shape unchanged** → Home, LinkedIn, email, RSS, breaking-alert unaffected |
| `newsSensitiveData` (proxy) | +3 read actions | none |
| `newsFreshnessMonitor` | +1 probe | new SNS condition |

### Backend — new
`newsSituationTracker` (`rate(10 minutes)`), `newsArticleClassifier` (hourly; reuses the `deepseek-v4-flash` provider in env), tables `GlobalPerspectiveSituations` + `GlobalPerspectiveStories`, 3 EventBridge rules. Load ≈ +72/day GDACS, +144/day tracker, +24/day classifier invocations — trivial.

### Backend — unchanged
thread/country/pair intelligence, prediction methodology + resolver, drift corrector, email sender, LinkedIn/DevTo posters, Signal API, markets, economic-impact/quality, recommend, saved-items, billing, Cloudflare Worker (still pre-renders `/weekly/*`; `/` was never pre-rendered, so SEO posture is unchanged provided the below-fold list is real HTML).

### Data layer (added v2, 2026-09-08)
| Item | Change |
|---|---|
| **New S3 bucket** `globalperspective-world-<account>` (private) | prefixes per `DATA_STRATEGY.md` §4; lifecycle rules; one IAM inline policy per writer Lambda; read-only credentials for the Worker |
| **Cloudflare Worker** (existing RSS-proxy / pre-render worker) | new `/data/*` route: SigV4 fetch to S3, edge cache, JWT check for `*.member.json`; `/` pre-render reads `world/latest.json` |
| `newsSensitiveData` (proxy) | **no new actions** (the three planned ones are dropped); trends to user-actions-only as content reads move to the bundle |
| `services/restProxy.js` | untouched for user actions; content path bypasses it via `services/worldData.js` |
| `GlobalPerspectiveSituations` (DDB, created P1·T1) | **dropped in S1** before any reader exists |
| Existing content tables | migrate per `DATA_STRATEGY.md` §6 (S8), gated by "nothing reads the table" |

### Docs & memory touched by the programme
`ARCHITECTURE.md`, `BACKEND_GUIDE.md`, `INDEX.md`, `CHANGES.md` per phase, `pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md`, `SOURCE_DIVERSITY_PLAN.md`, `IMPACT_VALIDATION_METHODOLOGY.md`, `SITE_ORIENTATION_PLAN` follow-ups; memories `reference_page_wiring_contracts`, `project_pair_intelligence`, `project_home_map_lede`, `reference_web_data_sources`, `project_map_home_situation`.

## 10. Docs to update when shipping (docs-as-code)

`ARCHITECTURE.md` (Lambda inventory: new `newsSituationTracker`, `newsSituationIngest`; S3 bucket + prefixes + per-role IAM; table retirements; schedule table; frontend routes/components/hooks; Common Mistakes: unmatched-region logging), `DATA_STRATEGY.md` (prefix table as it grows), `BACKEND_GUIDE.md`, `pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md` (mark the un-shadowing), `reference_page_wiring_contracts` (URL params), Worker docs (`project_cloudflare_worker`), `CHANGES.md` per stage, `project-docs/INDEX.md` (move this file `_active` → `_shipped`).

## 11. Stages (v2, 2026-09-08) — replaces §5

Ordering principle: **prove the read path first; add producers in the order that gives visible value earliest with the least LLM; frontend runs parallel on fixtures.** Each stage is a ledger group; each gate must be true before the next stage starts.

| Stage | Scope | Gate | Parallel |
|---|---|---|---|
| **S0 Foundation** | `DATA_STRATEGY.md` ✅; plan/ledger v2 ✅; bucket + prefixes + lifecycle; one IAM policy per writer; Worker `/data/*` route; hand-placed fixture `world/latest.json`; `fixtures/world.json` for `npm run dev` | browser fetches `world/latest.json` through the Worker; dev runs on the fixture — **read path works before any producer exists** | — |
| **S1 Openers → inbox** | re-point `newsGdacsIngest` to append `situations/inbox/` events (keep geometry + state logic + tests; keep events mirror for now); **drop `GlobalPerspectiveSituations`** | inbox objects at 20-min cadence for Orange/Red; zero LLM; table gone | — |
| **S2 Tracker (folder)** | `newsSituationTracker` 10-min sweep: inbox → `situations/state|index|history`; assembles `world/latest.json` (+member, +snapshots); **shadow to `world/shadow/` ~1 week**; `stale` logic; lede + ranked precompute | 7 days of shadow snapshots; thresholds tuned; disasters cost 0 model calls; forced-stale fixture greys the map | **S4 starts here on fixtures** |
| **S3 Ingest (Option A)** | `newsSituationIngest` hourly: RSS + GDELT → classify (flash, batched, 600/day cap) → cluster → `corpus/` + `stories/`; `newsBreakingAlert` becomes an inbox writer; tracker consumes stories (escalation + one-event-one-pin merge) | stories index populated across languages; GDACS + news cluster → one situation; LLM-cap metrics live | **S5 starts here** |
| **S4 Map data layer** | `worldData.js`, `useWorld()`, `useSituationDetail()`; canonical ISO + `countryCentroids.js`; bundled topology; URL state; unmatched → error sink — on the **existing** renderer | Palestine/Kosovo render; deep-links restore; grey-out driven by `stale`; forced unmatched string hits the sink | with S2/S3 |
| **S4.5 Legibility & honesty pass** (added 2026-09-08 after the first browser review — see §12) | legend with live per-axis counts (inactive dimmed); real briefing lede from counts + explicit coverage note; fix `next ~just now` + reconcile with the app header strip (one freshness claim); rich detail card (GDACS description, severity text, population affected, country names, timeline, report-link first; "Deterministic UN/EU alert — no AI analysis at Orange level" instead of "not generated"); plain-language states (New / Getting worse / Ongoing / Easing / Ended); crop ±60°, hover tooltip, zoom/pan; in-map empty/low-coverage state; add `description`+population to the GDACS observation | browser re-test shows: a stranger can tell what the map watches, why it's sparse, and what each dot is — **before any prod deploy** | — |
| **S5 Map UI (WebGL)** | deck.gl 2.5D world, hue/height/ripple/luminance, spread arcs, tour, scrubber (reads `world/…/HHMM.json`), globe fly-to, honesty states — behind `/map`; rewrite/delete the 4 z-score tests | browser click-through; mobile; reduced-motion; scrubber replays real shadow history; `npm run verify` green | with S3 |
| **S6 Home swap** | `/` → `SituationHome`; `/map` redirect; `Layout.jsx` nav; `BreakingDetailPage` link; `/weekly/pair/:slug` back; delete legacy WorldMap/MapSidePanel/MiniMap (fix `tokens.js`); Option B (Red → thread); Worker pre-render for `/`; smoke-test routes | smoke-test + link-crawl pass; SEO text in DOM; no dangling `/map` links | — |
| **S7 Editorial switch** | selector consumes `stories/index.json`; **remove Brave from `newsInvokeGemini`**; `captureIngestion` → points at `corpus/` | brief quality unchanged per `IMPACT_VALIDATION_METHODOLOGY`; Brave ingest calls → 0 | — |
| **S8 Table migrations** | **revised 2026-09-09** after two independent verifications (§11.1 below): **T1 Signals → S3** (redirect, approved, not started) → **T2** audit-table mirrors (GDACS/GDELT/ImpactAudit/IngestCapture) → **T3** PredictionLog → **T4** Markets + ClientErrors → **T5** BreakingAlerts (folds into S3·T2) → **T6** NewsCache + SummarizeAndPredict via dual-write, last | "nothing reads the table" (grep + CloudWatch) before each `delete-table`; T3–T6 also need explicit operator OK per edit to `newsSensitiveData` (risk gate — the proxy is the live site's spine) | after S6 |

Gates are enforced through the ledger (`PLAN_EXECUTION_PLAYBOOK.md`). Deploys remain per-step gated; prod mutations are bare single `aws` commands.

### 11.1 S8 sub-plan (revised 2026-09-09 after verification)

Two independent verifications — a code-reader grep/audit and a 7-day CloudWatch metrics pull — re-ordered S8. Numbers below are as measured, not estimated.

**Evidence (7-day daily averages, GlobalPerspective tables only):**

| Table | Reads/day | Writes/day | Note |
|---|---|---|---|
| SummarizeAndPredict | 13,342 | 2,007 | core; ~8 writers, ~20 proxy actions, ~12 backend readers |
| PredictionLog | 12,503 | 388 | 2nd hottest: `/track-record` does a full Scan of 5,478 items per load via proxy `prediction_track_record`; also read by `prediction_snapshot`, `newsPredictionResolver`, `newsSignals` |
| NewsCache | 8,543 | 2,305 | core |
| BreakingAlerts | 6,907 | 70 | user-facing via `newsRecommend` `list_alerts`/`get_alert` (a direct-call Lambda, NOT the proxy); writer `newsBreakingAlert`; read by `newsEmailSender` + `newsSignals` |
| IngestCapture | 388 | 344 | read only by `newsImpactAudit` |
| GdacsEvents | 92 | 1,100 | written by `newsGdacsIngest` (20-min); read only by `newsImpactAudit` |
| GdeltConflict | 10 | 39 | read only by `newsImpactAudit` |
| Markets | 12 | 232 | proxy `markets`/`weekly_markets` actions |
| ClientErrors | 14 | ~ | `newsClientErrors` writer; `errors.mjs` / `newsErrorDigest` readers |
| Signals | 0 | 23,390 | 14-day check: 0 reads every day; `newsSignals` invoked 1/day (cron only, zero HTTP); 5,815 items ~25MB; only `newsSignals` reads/writes it |
| ImpactAudit | 0 | 3 | write-only |
| ApiKeys | 0 | 0 | 0 items, 0 keys ever minted; **stays in DDB** (user table) |

**Corrections this forced:**
- `PredictionLog` was understated by the earlier "PredictionLog first" framing (implying lightest-touch) — it is the **2nd-hottest table**, almost entirely `/track-record`'s full 5,478-item Scan per page load. Migrating it is real perf/cost work (S8·T3), not a warm-up task.
- A proxy-action (`newsSensitiveData`) DDB→S3 flip is a **backend-only change needing no frontend deploy** — the frontend already goes through `services/restProxy.js` regardless of what sits behind the action. The real gate is **risk**, not deploy surface: the proxy is the live site's spine, so every proxy-action edit needs explicit operator OK per edit, not a one-time blanket approval.
- `Signals` is **write-only** (0 reads/day over a 14-day window; `newsSignals` receives zero HTTP invocations, only the daily cron) — it costs nothing to move first (0 consumers) and is the cleanest possible S8 opener.
- The frontend also reaches DDB via **5 direct-call Lambdas** (`newsRecommend`, `newsAnalyze`, `newsPolarBilling`, `newsSavedItems`, `newsClientErrors`) besides the `newsSensitiveData` proxy — most user reads go through the proxy, but these five bypass it entirely and need their own review when their table migrates (e.g. `BreakingAlerts` via `newsRecommend`).
- Cost honesty: Signals' ~23K/day on-demand writes cost **≈$1/month** — the win from migrating it is consistency (one fewer world table, strategy conformance), not cost.
- Account also holds unrelated tables (`ppa-*`, `Polybot*`, `Currency`, `BestWaifu*`) — out of scope, never touch.

**Decision (operator approved 2026-09-09): Signals → S3 via "redirect" (option 2), not pause.**

**Revised order (replaces the old S8 ordering; three-move method unchanged — dual-write → flip readers → retire only when grep + CloudWatch both show zero reads):**

- **S8·T1 Signals → S3.** Design: `newsSignals` BUILD collects envelopes and writes ONE `signals/latest.json` (top-level projections `type`/`event_time`/`severity`/`country_isos`/`country_names` + envelope) plus dated `signals/snapshots/YYYY-MM-DD.json`; reads previous `latest.json` to preserve `first_emitted_at`; replaces the 120-day DDB TTL with an explicit `event_time ≥ now−120d` filter at build. SERVE (`/v1/signals`, `/v1/signals/{id}`) reads `latest.json` cached in module scope by ETag (today it already full-Scans per request, so behaviour is identical); `/v1/track-record` unchanged until T3. Rate-limit + auth stay in `ApiKeys` (DDB). IAM: `newsSignals-role` inline policy `newsSignals-ddb` gains `s3:GetObject`/`PutObject` on `arn:aws:s3:::globalperspective-world-280362093938/signals/*`. Env: add `WORLD_BUCKET`; keep `SIGNALS_TABLE` until retirement. S3 lifecycle: `signals/snapshots/` → Glacier IR after 30d, expire 365d (~20MB/day). Worker: deliberately **no** `/data/signals/*` route — signals are the paid key-gated product and stay behind the Function URL; this is now a standing rule. Verify: one build, `latest.json` count ≈ 5,815 matches table, keyed curl (temp key via `mint-key.mjs` then revoked) returns same shape; then `delete-table GlobalPerspectiveSignals`. Gate: none (0 consumers). Files to change: `amplify/backend/function/newsSignals/src/index.js`, `amplify/backend/function/newsSignals/src/test-adapter.mjs` (add pure snapshot-builder test), `project-docs/architecture/DATA_STRATEGY.md`, `project-docs/architecture/ARCHITECTURE.md` (newsSignals Lambda row ~line 793; tables rows ~962-963), `project-docs/pipeline-ingest/_shipped/SIGNAL_API_PLAN.md` (storage note), `CHANGES.md`, the ledger. Blast radius: zero user-facing; frontend untouched. Status: **APPROVED, not started.**
- **S8·T2 Audit tables** (`GdacsEvents`, `GdeltConflict`, `IngestCapture`, `ImpactAudit`) → `corpus/` + `audit/`; rewrite `newsImpactAudit` to read S3; stop the 1,100/day GDACS DDB mirror (S3 inbox `situations/inbox/gdacs-latest.json` already exists). Touches `newsGdacsIngest`, `newsGdeltConflict`, `newsInvokeGemini` capture harness, `newsImpactAudit`. Gate: none (backend-only). Status: todo.
- **S8·T3 PredictionLog → `predictions/`:** dual-write from `NewsProjectInvokeAgentLambda` + `newsPredictionResolver`; daily `predictions/latest.json`; flip proxy `prediction_track_record`/`prediction_snapshot` and `newsSignals` `/v1/track-record` to S3; removes the 5K-item Scan per `/track-record` load (perf + cost + Athena calibration). Gate: operator OK to edit `newsSensitiveData`. Status: todo.
- **S8·T4 Markets** (proxy `markets`/`weekly_markets`) **+ ClientErrors** (→ `logs/errors/`, `errors.mjs` + `newsErrorDigest` read S3). Gate: proxy edit OK. Status: todo.
- **S8·T5 BreakingAlerts** — reader `newsRecommend`, writer `newsBreakingAlert`, also `newsEmailSender`; folds into S3·T2 (breaking → analysis threads). Status: later.
- **S8·T6 NewsCache + SummarizeAndPredict** — dual-write across ~8 writers, flip ~20 proxy actions, retire; LAST, after S6 home swap. Status: later.

## 12. Design review of the first S4 build (2026-09-08) — why S4.5 exists

Reviewed the browser-verified S4 build (D3 map at `/map`, one live situation: China flood). It proves the pipeline; it does **not** yet deliver the designed experience. Findings, in the order they hurt:

1. **The map doesn't say what it watches.** One dot, no legend, no inactive categories → a visitor can't tell "broken", "calm", or "floods only". Fix: legend with live per-axis counts, inactive axes dimmed — a *coverage statement*, and the mechanism by which a reader learns that conflict/political/economic situations exist (they light up when S3 lands).
2. **Lede is a fragment** ("China — flood.") — must read like a desk briefing, incl. what is *not* being tracked.
3. **Emptiness reads as failure.** The "calm dark world" honesty state needs words in-map, not silence.
4. **Severity encoding too weak** (3→10 px radius). Real fix is S5's 2.5D height; interim: glow + stronger radius scale.
5. **Freshness bug + contradiction:** `fmtAgo` mangles future times ("next ~just now"); the app header strip says "Updated hourly" while the page says "next 30 min" — two claims, one wrong. One truthful claim only.
6. **Jargon** (Elevated · emerging · just now) → plain-language state labels.
7. **Detail card thin and negatively framed** — GDACS gives description, severity text, population, report; show them; explain *why* there's no AI analysis (Option A) rather than "not generated".
8. **No interactivity**, Antarctica wastes canvas.

Structural truth recorded: **the map will feel thin until S3 exists** regardless of rendering. Sequence: S4.5 makes one-flood legible and honest → S3 makes the map worth looking at → S5 makes it beautiful. **No prod deploy of `/map` before S4.5.**

"How does a user understand there are articles going on?" — three mechanisms, all to build: (a) the legend-as-coverage-statement; (b) evidence in the card (outlet count + latest headlines for news situations; UN/EU alert level + population for disasters); (c) an explicit coverage note while the news layer is absent.

**2026-09-09 decision:** Signals — redirect to S3 (option 2) over pause; Worker never serves `signals/`. See §11.1 (S8 sub-plan) for the evidence and design.
