# Map-as-Home + Situation Tracker — Execution Ledger

> Execution record for `MAP_HOME_SITUATION_PLAN.md`, per `project-docs/playbooks/PLAN_EXECUTION_PLAYBOOK.md`. One row per task; declare (fill the four fields, set 🔧) before doing; on finish update the listed docs in the same commit, tick the boxes, set ✅ + commit hash. An agent resuming reads the plan then this file; the first 🔧 active row (or first 🔭 todo in stage order) is next.

**Legend:** 🔭 todo · 🔧 active · ✅ done · ⛔ blocked · ♻️ superseded
**Started:** 2026-09-08 · **Region:** ap-northeast-1 · **Ingest fn deployed name:** `newsInvokeGemini-dev`
**v2 restructure 2026-09-08:** phases P0–P6 → stages S0–S8 (plan §11) after the data-strategy decision (`architecture/DATA_STRATEGY.md`: S3 for the world, DynamoDB for the user). Completed P0 rows kept below as history; P1·T1 kept with a supersession note.

---

## History — Phase P0 (measure; complete)

### P0 · T1 — Brave investigation (protocol §5.1) — ✅ done · `2bb6ee7`
brave_unique_chosen = 0.4% (12/2,740 over 197 runs) → remove Brave from ingest, no fallback. Brave = 5.8% of pool, ~18% 429-throttled, reuters ~0.38/run. Grounding volume needs the operator's Brave dashboard (⛔ deferred, separate follow-up). Full audit `scripts/brave-audit.md`. Prod `BRAVE_CONCURRENCY=1`. Brave key seen in env, never written down.

### P0 · T2 — Live-bytes drift diff — ✅ done
`newsGdacsIngest`, `newsGdeltConflict`, `newsBreakingAlert` byte-identical to main (2026-09-08). Re-diff at edit time.

### P0 · T3 — Env facts — ✅ done
`TOPICS_LIMIT=13`; GDACS was `cron(0 */6…)`; ingest "GROK" alias = DeepSeek `deepseek-v4-flash` (`GROK_API_URL=https://api.deepseek.com`).

## History — P1 · T1 — ♻️ superseded (shipped `623247f`, reversed in S1)
Shipped 2026-09-08: `GlobalPerspectiveSituations` DDB table (2 GSIs, TTL), GDACS role grant, `newsGdacsIngest` rewrite (geometry → lat/lon; Orange/Red → situation rows; state machine; templated what_changed; lazy SDK; `cleanSeverity`; 9 tests), `TriggerGdacsIngest` → `rate(20 minutes)`. Live-verified (100/100 geo, 1 Orange → 1 situation, idempotent).
**Superseded the same day** by the data strategy: situation *state* must live in S3 with the tracker as sole writer. **What survives:** geometry capture, the 20-min cadence, the state-machine helpers + tests (they move into the tracker), the IAM lesson. **What S1 reverses:** the DDB table (drop) and GDACS writing state (becomes an inbox writer). Docs written by P1·T1 (ARCHITECTURE Situations Table, BACKEND_GUIDE row) get a supersession note in S1.

---

## Stage S0 — Foundation (read path before producers)

### S0 · T1 — DATA_STRATEGY.md + plan/ledger v2
Status: ✅ done (2026-09-08)
Reads/refs: discussion 2026-09-08; plan §3.1; existing table inventory (ARCHITECTURE §DynamoDB Tables)
Changes: new `project-docs/architecture/DATA_STRATEGY.md`; plan v2 banner, §3.2, WS1/WS2/WS3 REVISED notes, §5 superseded, §6/§9 amended, new §11 stages; this ledger restructured
Docs to update: `INDEX.md` ✅ · `CHANGES.md` ✅ · memory `project_map_home_situation` ✅
Verify / exit: docs coherent; no build
Done-check: [x] docs  [x] INDEX  [x] CHANGES
Commit: `0ad78eb`

### S0 · T2 — S3 bucket, prefixes, lifecycle, IAM
Status: ✅ done (2026-09-08)
Reads/refs: `DATA_STRATEGY.md` §3–§4; account 280362093938
Changes: created bucket `globalperspective-world-280362093938` (all public-access-block flags on, no bucket policy, default SSE-S3, versioning off); 5 lifecycle rules; `newsGdacsIngest-pol` += `s3:PutObject` on `situations/inbox/*`+`gdacs/*` (DDB Situations grant kept until S1)
Docs to update: `ARCHITECTURE.md` (new S3 World Store section) ✅ · `CHANGES.md` ✅
Verify / exit: ✅ public-access-block all true; `get-bucket-policy-status` = no policy (not public); 5 lifecycle rules present; write/read/delete round-trip on `world/_probe.json` OK
Done-check: [x] bucket  [x] lifecycle  [x] IAM  [x] docs  [x] CHANGES
Commit: `bce4193`
Notes: **could not** test PutObject *as the gdacs role* — Lambda execution roles trust `lambda.amazonaws.com`, not the admin user, so no assume-role path. Verified the grant by policy inspection + admin round-trip; the role's actual write is exercised when GDACS runs in S1. `world/` expire rule is safe for `latest*.json` (continuously overwritten → never ages to 400d).

### S0 · T3 — Cloudflare Worker `/data/*` route + fixture
Status: ✅ done (2026-09-08, deployed to prod + live-verified)
Reads/refs: `project-docs/distribution/WORKER_FULL_CODE.md`; `DATA_STRATEGY.md` §3.6, §5; memory `project_cloudflare_worker`
Changes: IAM user `gp-worker-s3-reader` + read-only policy; SigV4 GET + `/data/*` route in `WORKER_FULL_CODE.md` (key whitelist `DATA_ALLOWED`, `s-maxage=300`, member fail-closed, **403→404 map** for missing keys since the reader has no ListBucket); `frontend/fixtures/world.json` uploaded to `s3://…/world/latest.json`; `fixtures/README.md`; **deployed to `globalperspective-rss`** (compat date matched at 2026-04-01, routes preserved) with secrets `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` set via stdin
Docs to update: `ARCHITECTURE.md` ✅ · memory `project_cloudflare_worker` ✅ · `CHANGES.md` ✅
Verify / exit: ✅ proven in a throwaway CF worker first, then LIVE on `globalperspective.net`: `/data/world/latest.json`→200 (`x-rendered-by: cf-worker-data`, correct bundle), missing→404, member→401, disallowed→404; **regression-clean** — `/rss`→200 XML, bot pre-render→`cf-worker-bot`, passthrough→200
Done-check: [x] worker code  [x] fixture+upload  [x] reader IAM  [x] SigV4 proven  [x] **Cloudflare deploy (live)**  [x] docs  [x] CHANGES
Commit: `065b4be` (code) + `86a8a29` (403→404 fix + deploy)
Notes: deploy done by me via authenticated `wrangler` (user added `Bash(wrangler:*)` allow + authorized). Reader user holds exactly 1 active key = the prod Worker secret; test/probe keys deleted, temp files scrubbed — no secret in repo/transcript. `world/latest.json` serves the fixture until the tracker (S2) overwrites it. **Minor follow-up:** the deploy warned that Preview URLs are enabled for the prod worker (workers.dev route on); `/data` there serves the same public bundle, so no data exposure — optionally disable preview_urls later.

---

## Stage S1 — Openers → inbox

### S1 · T1 — Re-point `newsGdacsIngest` to inbox events; drop the DDB table
Status: 🔭 todo
Reads/refs: `amplify/backend/function/newsGdacsIngest/src/index.js` (as shipped in `623247f`; re-diff vs deployed first); `DATA_STRATEGY.md` §3.2, §4; plan §3.2
Changes: replace `syncSituations`/DDB writes with `putInboxEvent()` → `situations/inbox/<ts>-gdacs-<eventKey>.json` for every Orange/Red feature **and** for open→Green transitions the tracker needs to know about (emit a `level_changed`/`gone` event by comparing against the previous run's own mirror — GDACS keeps a tiny `gdacs/last-seen.json` it owns); keep `buildEventItem` mirror to DDB until S8; move `buildSituation`/`coolSituation` helpers + tests to a shared `situations-core` module for the tracker; IAM: PutObject `situations/inbox/*` + `gdacs/*`, remove DDB Situations grant; **`aws dynamodb delete-table GlobalPerspectiveSituations`** after confirming zero readers
Docs to update: `ARCHITECTURE.md` (Situations Table → supersession note; Lambda row) · `BACKEND_GUIDE.md` (row) · `CHANGES.md`
Verify / exit: inbox objects appear within 20 min for the live Orange event; zero LLM; table deleted; unit tests still pass in the new module
Done-check: [ ] code  [ ] IAM  [ ] table dropped  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S2 — Tracker (the folder)

### S2 · T1 — `newsSituationTracker` sweep: inbox → state/index/history → `world/`
Status: 🔭 todo
Reads/refs: plan §3.1, WS2 (REVISED), §4 cadence table; `DATA_STRATEGY.md` §4–§5; `situations-core` helpers from S1; `composeTopicsLede` (frontend util → port to Node); `getGeminiTopics` source for lede/ranked inputs; `newsMarketsData` output for `systemic`
Changes: new Lambda `newsSituationTracker` (Node 22, 512MB, 120s, `rate(10 minutes)`, `DRY_RUN=true` initially → writes `world/shadow/`); role `newsSituationTracker-role` with PutObject on `situations/state|index|history/*`, `world/*`, GetObject on `situations/inbox/*`, `stories/*`, and DeleteObject/move on processed inbox events (`situations/inbox/processed/`); fold logic; `next_check_at` cadence; cheap-detect; templated `what_changed`; LLM narrative gate + `TrackerLLMCallsToday` metric (cap 300); `stale` computation from per-source stamps; assemble `world/latest.json` + `latest.member.json` + `world/YYYY/MM/DD/HHMM.json`
Docs to update: `ARCHITECTURE.md` (Lambda, schedule, bucket prefixes) · `BACKEND_GUIDE.md` · `CHANGES.md` · memory `project_map_home_situation`
Verify / exit: unit tests for fold/state machine; 7 days of `world/shadow/` snapshots; thresholds tuned; disasters = 0 model calls; forced-stale fixture → `stale:true`
Done-check: [ ] code  [ ] IAM  [ ] shadow week  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S2 · T2 — Flip tracker from shadow to live `world/latest.json`
Status: 🔭 todo (gated on S2·T1 shadow week + S4·T1)
Changes: `DRY_RUN=false`; Worker cache purge; `newsFreshnessMonitor` probes `world/latest.json` age
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: live bundle updates every 10 min; monitor alarms on a stalled tracker
Done-check: [ ] flip  [ ] monitor  [ ] docs  [ ] CHANGES
Commit: —

---

## Stage S3 — Ingest (Option A)

### S3 · T1 — `newsSituationIngest` hourly: RSS + GDELT → classify → cluster → `corpus/` + `stories/`
Status: 🔭 todo
Reads/refs: plan WS1 (REVISED) §1–§3, §3.1.1/.2/.5; `newsInvokeGemini/src` (RSS feed list + parser to reuse, DeepSeek client pattern); GDELT DOC 2.0 (1 req/5s); `DATA_STRATEGY.md` §4
Changes: new Lambda `newsSituationIngest` (`rate(1 hour)`); reuse feed list; GDELT queries (serialized); batched classification on `deepseek-v4-flash` (30 headlines/call), strict JSON, ISO3-only, unmatched → error sink; `ClassifierLLMCallsToday` metric + 600/day cap; deterministic clustering vs open stories (read `stories/index.json`), one-event-one-pin merge rule vs `situations/index.json`; URL dedup via `corpus/seen/<hash>` objects or a rolling `corpus/seen.json` (owner: ingest); write `corpus/YYYY/MM/DD/HH.jsonl`, `stories/state/<id>.json`, `stories/index.json`
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `SOURCE_DIVERSITY_PLAN.md` · `IMPACT_VALIDATION_METHODOLOGY.md` · `CHANGES.md` · memory `reference_web_data_sources`
Verify / exit: 24h of corpus + stories across languages; ≥8-outlet cluster never absent; merge rule produces one situation for a GDACS event with news coverage
Done-check: [ ] code  [ ] IAM  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S3 · T2 — `newsBreakingAlert` becomes an inbox writer
Status: 🔭 todo
Reads/refs: `newsBreakingAlert` (byte-identical to main per P0·T2; re-diff); `significance.js` axisForCategory
Changes: on writing an alert, also PutObject `situations/inbox/<ts>-breaking-<threadId>.json` (tier from significance, axis, regions → iso3 via canonical mapping); IAM PutObject on `situations/inbox/*`
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `CHANGES.md`
Verify / exit: a real alert produces an inbox event; tracker opens a `breaking#<threadId>` situation with `threadId` set
Done-check: [ ] code  [ ] IAM  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S3 · T3 — Tracker consumes stories (escalation + merge)
Status: 🔭 todo
Changes: tracker reads `stories/index.json` in the sweep; escalation dims (spread, velocity, category weight, spillover); merge rule
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: shadow data shows escalation flips on real spread/velocity; no duplicate pins
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S4 — Map data layer (parallel with S2/S3, on fixtures)

### S4 · T1 — `worldData.js` + `useWorld()` + `useSituationDetail()`
Status: 🔭 todo
Reads/refs: plan WS3 (REVISED); `DATA_STRATEGY.md` §5; `services/restProxy.js` (leave untouched); `fixtures/world.json`
Changes: `services/worldData.js` (fetch `/data/world/latest.json`, ETag, 5-min visible-tab refresh, `VITE_WORLD_URL` override); hooks; wire into the existing `WorldMapV2` as the situations source (replacing the z-score signal as the driver)
Docs to update: `ARCHITECTURE.md` (hooks/services) · `reference_page_wiring_contracts` · `CHANGES.md`
Verify / exit: map renders situations from the fixture and from the shadow bundle; `npm run verify`
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S4 · T2 — Canonical ISO + `countryCentroids.js` + unmatched → error sink
Status: 🔭 todo
Reads/refs: `utils/countryMapping.js`; `WorldMapV2.jsx` l.25-109 (alias tables to delete); `errorSink.js`
Changes: as WS3 item 2
Docs to update: `ARCHITECTURE.md` (Common Mistakes) · `CHANGES.md`
Verify / exit: Palestine/Kosovo render; forced unmatched string hits the sink
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S4 · T3 — Bundled topology + URL state
Status: 🔭 todo
Changes: `src/assets/countries-110m.json` (pinned 2.0.2); remove CDN fetch; `?focus=/?t=/?layer=`
Docs to update: `reference_page_wiring_contracts` · `CHANGES.md`
Verify / exit: no CDN fetch; deep-link restores; topology failure → list still renders
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S5 — Map UI (WebGL; behind /map; parallel with S3)

### S5 · T1 — deck.gl 2.5D world: hue/height/ripple/luminance + spread arcs; retire z-score tests
Status: 🔭 todo
Reads/refs: plan WS4; §9 blast radius (4 tests)
Changes: new map component(s); deck.gl layers; dark theme; code-split; rewrite/delete `test/useCountrySignal.test.js`, `layers.test.jsx`, `signalFilters.test.jsx`, `searchBar.test.jsx`; Option-A situation card
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: browser click-through; mobile; reduced-motion; bundle size; `npm run verify` green
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S5 · T2 — Globe fly-to, idle tour, scrubber, honesty states
Status: 🔭 todo
Changes: fly-to; tour (`gp_map_tour`); scrubber over `world/YYYY/MM/DD/HHMM.json`; grey-out on `stale`; empty-world line; hover facts
Docs to update: `ARCHITECTURE.md` · `CHANGES.md`
Verify / exit: scrubber replays real shadow history; forced-stale greys; tour pauses on input
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S6 — Home swap, routes, cleanup

### S6 · T1 — `/` → SituationHome; `/map` redirect; nav; links; smoke-test; Worker pre-render for `/`
Status: 🔭 todo
Reads/refs: plan WS5, §9; `App.jsx`, `Home.jsx`, `Layout.jsx:67`, `BreakingDetailPage.jsx:106`, `scripts/smoke-test.mjs:106,423`; Worker pre-render code
Changes: as WS5 + §9; Worker `/` pre-render from `world/latest.json`
Docs to update: `ARCHITECTURE.md` (routes) · `SITE_ORIENTATION_PLAN` follow-ups · `reference_page_wiring_contracts` · memory `project_home_map_lede` · `CHANGES.md`
Verify / exit: smoke-test + link-crawl; SEO text in DOM; no dangling `/map` links; `./deploy.sh` gated
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

### S6 · T2 — `/weekly/pair/:slug` back; delete legacy WorldMap/MapSidePanel/MiniMap; Option B (Red → thread)
Status: 🔭 todo
Changes: pair route + page; `tokens.js` MiniMap ref then delete 3 files; tracker: Red GDACS situation → create thread (Option B) — LLM under cap
Docs to update: `ARCHITECTURE.md` · `reference_page_wiring_contracts` · memory `project_pair_intelligence` · `CHANGES.md`
Verify / exit: arc click opens pair; zero-ref grep before delete; a Red event yields a thread next cycle
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S7 — Editorial switch

### S7 · T1 — Selector consumes `stories/index.json`; remove Brave from `newsInvokeGemini`; capture → corpus
Status: 🔭 todo (Brave removal unblocked by P0·T1)
Reads/refs: `newsInvokeGemini` selection prompt (l.651+), Brave block (l.388-461), `captureIngestion` (l.576)
Changes: prompt receives top-N clusters; `continues_topic` → `storyId`; delete Brave block; `captureIngestion` records the corpus key instead of truncated input
Docs to update: `ARCHITECTURE.md` · `BACKEND_GUIDE.md` · `IMPACT_VALIDATION_METHODOLOGY.md` · `SOURCE_DIVERSITY_PLAN.md` · `CHANGES.md`
Verify / exit: brief quality unchanged per methodology; Brave ingest calls → 0 in CloudWatch
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] verify
Commit: —

---

## Stage S8 — Table migrations (after S6; one mini-plan per table)

### S8 · T1 — PredictionLog → `predictions/` (+ Athena)
Status: 🔭 todo
Gate: nothing reads `GlobalPerspectivePredictionLog` (grep + CloudWatch) before drop
### S8 · T2 — GDACS/GDELT/ImpactAudit/IngestCapture mirrors → `corpus/` + `audit/`
Status: 🔭 todo
### S8 · T3 — Markets snapshots → `markets/`
Status: 🔭 todo
### S8 · T4 — ClientErrors → `errors/` logs; Signals → `signals/`; BreakingAlerts (after review→inbox)
Status: 🔭 todo
### S8 · T5 — Topics (`NewsCache`) + SummarizeAndPredict via dual-write → flip readers → retire
Status: 🔭 todo (last; everything reads these)

---

## On completion of all stages
Move `MAP_HOME_SITUATION_PLAN.md` + this ledger `_active/` → `_shipped/`; update `project-docs/INDEX.md`; update memory `project_map_home_situation` to SHIPPED; `DATA_STRATEGY.md` stays in `architecture/` as standing reference.
