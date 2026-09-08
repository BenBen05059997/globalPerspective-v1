# Map-as-Home + Situation Tracker — Execution Ledger

> Execution record for `MAP_HOME_SITUATION_PLAN.md`, per `project-docs/playbooks/PLAN_EXECUTION_PLAYBOOK.md`. One row per task; declare (fill the four fields, set 🔧) before doing; on finish update the listed docs in the same commit, tick the boxes, set ✅ + commit hash. An agent resuming reads the plan then this file; the first 🔧 active row (or first 🔭 todo in phase order) is next.

**Legend:** 🔭 todo · 🔧 active · ✅ done · ⛔ blocked
**Started:** 2026-09-08 · **Region:** ap-northeast-1 · **Ingest fn deployed name:** `newsInvokeGemini-dev`

---

## Phase P0 — measure (read-only; no code, no deploy)

### P0 · T1 — Brave investigation (protocol §5.1)
Status: ✅ done (ingest decision conclusive; grounding parts C/D/E ⛔ blocked on operator dashboard, deferred to a separate follow-up)
Reads/refs: CloudWatch Logs group `/aws/lambda/newsInvokeGemini-dev`; capture table `GlobalPerspectiveIngestCapture`; Lambda `Invocations` for the 5 grounding fns; Brave dashboard (operator, not yet supplied); plan §5.1
Changes: `scripts/brave-audit.md` created; plan §2.6 + §5.1 decision table filled
Docs to update: `MAP_HOME_SITUATION_PLAN.md` §2.6/§5.1 ✅ · `scripts/brave-audit.md` ✅ · `CHANGES.md` ✅ · this ledger ✅
Verify / exit: decision table filled; ingest-Brave removal go/no-go recorded ✅
Done-check: [x] numbers  [x] docs updated  [x] CHANGES.md  [x] table filled
Commit: — (uncommitted; awaiting user go-ahead to commit — branch off main per repo rule)
Notes: **brave_unique_chosen = 0.4%** (12/2,740 chosen over 197 runs) → remove Brave from ingest, no fallback. Brave = 5.8% of pool, ~18% 429-throttled, reuters returns ~0.38/run. Grounding fns log Brave only on failure → true volume needs the Brave dashboard (operator). Incidental: prod `BRAVE_CONCURRENCY=1` (src default 3); Brave key valid (no 401/403). **The live Brave key is in the Lambda env — seen but deliberately NOT written to any doc/commit.**

### P0 · T2 — Live-bytes drift diff (GDACS / GDELT / breaking-alert)
Status: ✅ done
Reads/refs: deployed code of `newsGdacsIngest`, `newsGdeltConflict`, `newsBreakingAlert` (via `aws lambda get-function` → Code.Location → curl → unzip) vs `amplify/backend/function/*/src` on main
Changes: none (record findings)
Docs to update: ledger Notes ✅
Verify / exit: each fn marked identical-or-drifted ✅
Done-check: [x] diffed  [x] recorded
Commit: n/a (read-only)
Notes: **All three byte-IDENTICAL to main** (gdacs index.js; gdelt index.js; breaking-alert index.js/render.js/sendEmail.js/significance.js). No drift → P1·T1 and P2·T2 may edit these directly from main. (Still re-diff at edit time — this snapshot is 2026-09-08.)

### P0 · T3 — Confirm env facts
Status: ✅ done
Reads/refs: `aws lambda get-function-configuration` for newsInvokeGemini-dev + newsGdacsIngest; `aws events describe-rule TriggerGdacsIngest`
Changes: none
Docs to update: ledger Notes ✅ (plan §2 already correct)
Verify / exit: `TOPICS_LIMIT`, GDACS cadence, provider aliases confirmed ✅
Done-check: [x] TOPICS_LIMIT=13  [x] GDACS `cron(0 */6 * * ? *)` ENABLED, default feed (no env override)  [x] provider aliases
Commit: n/a (read-only)
Notes: ingest "GROK" alias = **DeepSeek**: `GROK_API_URL=https://api.deepseek.com`, `GROK_MODEL=deepseek-v4-flash` (confirms `feedback_misleading_grok_naming`). **P1·T2 classifier reuses this flash provider/model** — no new provider wiring needed. Also present: XAI_API_KEY(+BACKUP), OPENAI_API_KEY.

---

## Phase P1 — ingest (shadow tables only; UI untouched)

### P1 · T1 — `GlobalPerspectiveSituations` table + GDACS writes situations directly (geometry, alertHistory, 20-min)
Status: 🔭 todo
Reads/refs: `amplify/backend/function/newsGdacsIngest/src/index.js` (byte-identical to main per P0·T2); EventBridge rule `TriggerGdacsIngest`; plan §3.1 (LLM boundary, decision 6), §4 WS2 record schema
Changes: **create table `GlobalPerspectiveSituations`** (PK situationId; GSI state+next_check_at; GSI updated_at; TTL 60d); newsGdacsIngest index.js (store `f.geometry`→lat/lon, `alertHistory[]`, upsert situation row on Red/Orange or level-rise — Red→Critical, Orange→High, axis=humanitarian, verb_label; no LLM); rule cron→`rate(20 minutes)`
Docs to update: `ARCHITECTURE.md` (Lambda + DDB schema + schedule table) · `BACKEND_GUIDE.md` · `pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md` (un-shadow) · `CHANGES.md`
Verify / exit: new GDACS items carry coordinates; a live Orange/Red event produces a situation row with no model call; 20-min runs visible; deploy gated (explicit yes)
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify/deploy-gate
Commit: —

### P1 · T2 — `newsArticleClassifier` (per-article structured classification)
Status: 🔭 todo
Reads/refs: plan §4 WS1.2; `newsInvokeGemini/src` (RSS+source shape, model client, `captureIngestion`); `project_ai_provider_migration` (flash model)
Changes: new Lambda `newsArticleClassifier` (separate; **hourly** rule — decoupled from the 4h editorial run, §3.1.1); reuses `deepseek-v4-flash` via GROK_API_URL/GROK_MODEL; batched JSON schema output; unmatched→error sink; `ClassifierLLMCallsToday` metric + 600/day cap (§3.1.5)
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `CHANGES.md`
Verify / exit: batch of 30 real headlines → valid per-article JSON (iso3/axis/severity/entities); unmatched logged not dropped
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P1 · T3 — Deterministic clustering → `GlobalPerspectiveStories`
Status: 🔭 todo
Reads/refs: plan §4 WS1.3
Changes: clustering stage; new table `GlobalPerspectiveStories` (PK storyId, GSI last_seen, TTL 30d); **merge rule** — cluster with same iso3 + disaster/humanitarian axis within 48h of a GDACS situation attaches to it (§3.1.2, one event one pin)
Docs to update: `ARCHITECTURE.md` (DDB schema) · `BACKEND_GUIDE.md` · `CHANGES.md`
Verify / exit: 7 days of stories with outlets/velocity/spread; Red-alert GDACS or ≥8-outlet cluster never absent in its cycle (§4 WS1.5 acceptance)
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P1 · T4 — Sources: add GDELT DOC 2.0, remove Brave ingest queries
Status: 🔭 todo — **UNBLOCKED by P0·T1** (`brave_unique_chosen`=0.4% → remove Brave outright, no transitional fallback)
Reads/refs: plan §4 WS1.1; GDELT DOC 2.0 (1 req/5s); `newsInvokeGemini` Brave block (l.388-461)
Changes: newsInvokeGemini — GDELT fetch (serialized), remove or transitional-keep Brave queries per P0 decision
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `pipeline-ingest/SOURCE_DIVERSITY_PLAN.md` · `CHANGES.md` · memory `reference_web_data_sources`
Verify / exit: GDELT articles ingested across languages; ingest still fills the pool with Brave removed/reduced
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P1 · T5 — Extend `captureIngestion` with clusters (eval basis)
Status: 🔭 todo
Reads/refs: `captureIngestion` (newsInvokeGemini l.576); `IMPACT_VALIDATION_METHODOLOGY.md`
Changes: capture write adds `clusters`
Docs to update: `IMPACT_VALIDATION_METHODOLOGY.md` · `CHANGES.md`
Verify / exit: missed-high-impact audit runnable on the new field
Done-check: [ ] code  [ ] docs  [ ] CHANGES
Commit: —

---

## Phase P2 — situation tracker

### P2 · T1 — `newsSituationTracker` (state machine, adaptive cadence, cheap-detect → template → maybe-LLM)
Status: 🔭 todo
Reads/refs: plan §3.1 + §4 WS2 (record schema, cadence table, 4 escalation dims, conservative thresholds: spread ≥1 new iso3 OR velocity ≥2×); `newsDriftCorrector` (grounded pattern); `riskTiers.js`; table from P1·T1
Changes: new Lambda `newsSituationTracker` (rate(10 min), DRY_RUN); templated `what_changed` from deltas, LLM narrative only on material news change and under the 300/day cap; metrics SituationsOpen/ChecksRun/LLMCallsAvoided/TrackerLLMCallsToday
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `CHANGES.md` · memory `project_map_home_situation`
Verify / exit: state machine unit tests; **≈1 week in DRY_RUN (shadow) before any pin is shown** — thresholds tuned on that data; LLM calls ≈ material changes only; disasters cost 0 calls
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P2 · T2 — Openers: breaking-alert → openSituation; GDACS Red → Option-B thread
Status: 🔭 todo
Reads/refs: `newsBreakingAlert` (byte-identical to main per P0·T2); GDACS situation rows from P1·T1; plan §3.1 Option A/B
Changes: newsBreakingAlert upserts a situation row (threadId, tier from significance, axis via `axisForCategory`); **Red-alert GDACS situations only → create a thread** so the existing analysis pipeline picks it up (Option B); Orange stays deterministic-card-only (Option A) with the card stating "Analysis: not generated for Orange-level events"
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `CHANGES.md`
Verify / exit: ≥1 real situation opened by each opener; a Red event yields a thread next cycle; no situation-level predictions generated (§3.1.3)
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P2 · T3 — newsFreshnessMonitor: add tracker to probe set
Status: 🔭 todo
Reads/refs: `newsFreshnessMonitor`
Changes: probe situations table freshness
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: stale tracker triggers SNS
Done-check: [ ] code  [ ] docs  [ ] CHANGES
Commit: —

---

## Phase P3 — map data layer

### P3 · T1 — Proxy actions: situations_list / situation_get / freshness_status
Status: 🔭 todo
Reads/refs: plan §4 WS3.1; `newsSensitiveData/src` (proxy `{action,payload}`); `services/restProxy.js`
Changes: 3 actions in newsSensitiveData; hooks `useSituations`, `useFreshness` (5-min visible-tab poll)
Docs to update: `ARCHITECTURE.md` (routes/actions) · `BACKEND_GUIDE.md` · `reference_proxy_request_behavior` (memory) · `CHANGES.md`
Verify / exit: actions return live data; public no-auth reads OK
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P3 · T2 — Canonical name→ISO + centroids + error-sink on miss
Status: 🔭 todo
Reads/refs: plan §4 WS3.2; `utils/countryMapping.js`; `WorldMapV2.jsx` l.25-109; `errorSink.js`
Changes: delete WorldMapV2 alias tables → import countryMapping; new `utils/countryCentroids.js` (PS/XK/small states); unmatched→errorSink
Docs to update: `ARCHITECTURE.md` (Common Mistakes: unmatched-region logging) · `reference_page_wiring_contracts` · `CHANGES.md`
Verify / exit: Palestine/Kosovo render; unmatched string hits error sink (forced test)
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P3 · T3 — Bundle topology locally + URL state
Status: 🔭 todo
Reads/refs: plan §4 WS3.3/3.5; `threadPath()` convention
Changes: `src/assets/countries-110m.json` (pinned 2.0.2); remove CDN fetch; `?focus=/?t=/?layer=` URL sync
Docs to update: `reference_page_wiring_contracts` · `CHANGES.md`
Verify / exit: no CDN fetch; deep-link restores view; topology failure → list still renders
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Phase P4 — map UI (WebGL rewrite; behind /map, not yet home)

### P4 · T1 — deck.gl 2.5D world: hue/height/ripple/luminance + spread arcs
Status: 🔭 todo
Reads/refs: plan §4 WS4 (encoding table, palette); plan §10 blast radius
Changes: new map component(s); deck.gl layers; dark theme; code-split map route; **rewrite/delete the 4 z-score tests** (`test/useCountrySignal.test.js`, `layers.test.jsx`, `signalFilters.test.jsx`, `searchBar.test.jsx`) so `npm run verify` stays green; situation card = Option A deterministic fields + honest "Analysis: …" line
Docs to update: `ARCHITECTURE.md` (components) · `CHANGES.md`
Verify / exit: browser click-through (`feedback_test_ui_in_browser`); mobile; reduced-motion fallback; bundle-size checked
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P4 · T2 — Globe fly-to, idle tour, scrubber, honesty states
Status: 🔭 todo
Reads/refs: plan §4 WS4 (fly-to, tour, scrubber, grey-out/empty/hover-fact states)
Changes: fly-to view; auto-tour (localStorage `gp_map_tour`); 7-day scrubber over history; freshness grey-out + empty-world + hover-card states
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: grey-out forced via stale fixture; empty state shows honest line; tour pauses on input
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Phase P5 — home swap, routes, cleanup

### P5 · T1 — `/` → SituationHome; `/map` redirect; below-fold list/SEO
Status: 🔭 todo
Reads/refs: plan §4 WS5; `App.jsx` (routes); `Home.jsx` (lede/trust-strip/topics to keep); `project_cloudflare_worker`
Changes: App.jsx routes (`/map` → `<Navigate to="/" />`); SituationHome page; demote Home content below fold as real HTML; `Layout.jsx:67` remove Map nav entry; `BreakingDetailPage.jsx:106` "See on the map" → `/?focus=<threadId>`; `scripts/smoke-test.mjs:106,423` retarget `/map` checks to `/`; optional ThreadPage/CountryPage "Being watched" chip
Docs to update: `ARCHITECTURE.md` (routes) · `SITE_ORIENTATION_PLAN` follow-ups · `reference_page_wiring_contracts` · memory `project_home_map_lede` · `CHANGES.md`
Verify / exit: `/` is the map; smoke-test + link-crawl pass; SEO text present in DOM; no dangling `/map` links (grep)
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### P5 · T2 — Restore /weekly/pair/:slug; delete legacy WorldMap/MapSidePanel/MiniMap
Status: 🔭 todo
Reads/refs: plan §4 WS5; `project_pair_intelligence`; `tokens.js` (MiniMap ref), `components/WorldMap.jsx`, `MapSidePanel.jsx`, `MiniMap.jsx`
Changes: pair route + page; fix tokens.js MiniMap ref then delete the 3 legacy files; add `/weekly/pair/<slug>` to `scripts/smoke-test.mjs`
Docs to update: `ARCHITECTURE.md` · `reference_page_wiring_contracts` · memory `project_pair_intelligence` · `CHANGES.md`
Verify / exit: arc click opens pair; zero-reference grep before delete; verify passes
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Phase P6 — editorial switch

### P6 · T1 — Selector consumes scored clusters (quotas/dedup kept)
Status: 🔭 todo
Reads/refs: plan §4 WS1.4; `newsInvokeGemini` selection prompt (l.651+); `GlobalPerspectiveStories`
Changes: selection prompt receives top-N clusters instead of raw headlines; `continues_topic`→storyId linkage
Docs to update: `ARCHITECTURE.md` · `IMPACT_VALIDATION_METHODOLOGY.md` · `CHANGES.md`
Verify / exit: brief quality unchanged per IMPACT_VALIDATION_METHODOLOGY
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## On completion of all tasks
Move `MAP_HOME_SITUATION_PLAN.md` + this ledger `_active/` → `_shipped/`; update `project-docs/INDEX.md`; update memory `project_map_home_situation` to SHIPPED.
