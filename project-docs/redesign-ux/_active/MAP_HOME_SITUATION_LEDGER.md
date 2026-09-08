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
Status: ✅ done (2026-09-08, deployed + live-verified)
Reads/refs: `newsGdacsIngest/src/index.js` (deployed == committed re-verified); `DATA_STRATEGY.md` §3.2, §4
Changes: new `situations-core.js` (pure: `buildObservation` + fold `buildSituation`/`coolSituation` refactored to take observations) + `situations-core.test.mjs` (11 tests); GDACS rewritten to mirror events (unchanged) + write ONE snapshot `situations/inbox/<ts>-gdacs.json` of current Orange/Red observations (lazy S3 client, no state, NO LLM); removed the DDB Situations grant from `newsGdacsIngest-pol`; **dropped `GlobalPerspectiveSituations`**
Docs to update: `ARCHITECTURE.md` (table → deleted; Lambda + IAM rows) ✅ · `BACKEND_GUIDE.md` ✅ · `CHANGES.md` ✅
Verify / exit: ✅ 11 tests pass; deployed; live invoke wrote `situations/inbox/…-gdacs.json` (1 Orange observation, China flood, centroid ok), events mirror still 100/100 geo; zero readers confirmed (code + roles); table gone from `list-tables`
Done-check: [x] code  [x] IAM  [x] table dropped  [x] docs  [x] CHANGES  [x] verify
Commit: `1cf8526`
Notes: **design refinement vs the original ledger** — instead of GDACS diffing against `gdacs/last-seen.json` and emitting per-event level_changed/gone events, GDACS writes a single **observation snapshot** per run and the S2 tracker computes transitions (opened/raised/spread/gone) by folding the snapshot against its own state. Cleaner event-sourcing: openers observe, the folder decides. The fold logic + tests already live in `situations-core.js` ready for S2. `gdacs/last-seen.json` is not needed. Deployed bundle = index.js + situations-core.js + package.json (SDK from runtime).

---

## Stage S2 — Tracker (the folder)

### S2 · T1 — `newsSituationTracker` sweep: inbox → state/index/history → `world/`
Status: ✅ done — tracker built, deployed, shadow sweeping every 10 min (the ~1-week shadow accrual is the S2·T2 gate, not this row)
Reads/refs: plan §3.1, WS2 (REVISED), §4; `DATA_STRATEGY.md` §4–§5; `situations-core` from S1
Changes: new Lambda `newsSituationTracker` (Node 22, 512MB, 120s) + role `newsSituationTracker-role` (least-priv S3 situations/*,world/*,shadow/*,stories/* + scoped ListBucket + PutMetricData); `TriggerSituationTracker` `rate(10 minutes)` + target/permission; fold sweep (buildSituation/coolSituation + close-after-3-cool + drop-after-48h), `situations/state|index|history` + `world/latest.json`(+member+HHMM snapshot); `stale`/`sources`/`lede`/`ranked` derived; `systemic` empty (markets later); NO LLM; metrics `GlobalPerspective/Situations`; `situations-core.js` copied into tracker dir (byte-identical, sync note); 7 unit tests
Docs to update: `ARCHITECTURE.md` (Lambda + schedule + S3 writers) ✅ · `CHANGES.md` ✅ · memory `project_map_home_situation` ✅
Verify / exit: ✅ 7 tests pass; deployed; live shadow invoke wrote `world/shadow/latest.json` (China flood, tier elevated, lede/ranked/sources correct) + state/index/history; `movedInbox:0` (shadow doesn't consume inbox); stale=false. **Pending (S2·T2 gate):** ~7 days of shadow snapshots + threshold tuning + forced-stale check.
Done-check: [x] code  [x] IAM  [x] deploy+schedule  [x] shadow-bundle verified  [x] docs  [x] CHANGES  [ ] shadow-week (→S2·T2)
Commit: `d390c72`
Notes: lede is deterministic-from-situations for now (composeTopicsLede/topics enrichment + systemic-from-markets deferred — good S2·T2 or S3 add). `situations-core.js` duplicated in newsGdacsIngest + newsSituationTracker (manual-deploy repo, no layers) — keep in sync; candidate for a Lambda layer later.

### S2 · T2 — Flip tracker to live `world/latest.json` + continuous tuning (replaces the shadow week)
Status: ✅ done (2026-09-08)
Reasoning: the shadow week was to tune NEWS-driven escalation thresholds — but those signals arrive with S3; GDACS input is deterministic (nothing to tune). Live is safe because nothing consumes `world/latest.json` in the UI yet (S4). So we flip now and move the safety to metrics + alarms + env knobs, tuning against real churn continuously.
Changes: `DRY_RUN=false` (flipped, live-verified); per-transition metrics (Opened/Raised/Spread/Cooled/Closed/Observations/Stale); env-tunable knobs `CLOSE_AFTER_COOL_CHECKS`/`GDACS_STALE_MIN`/`CLOSED_KEEP_HOURS` (no redeploy); **archive-on-drop** (closed+aged → `situations/archive/<id>.json`, IA-30d rule) so life stories aren't orphaned; `scripts/situations-log.mjs` transition digest; two alarms → `GlobalPerspectiveAlerts` (`situation-tracker-stalled` 30-min no-sweep, `situation-tracker-errors`)
Docs to update: `ARCHITECTURE.md` ✅ · `DATA_STRATEGY.md` (archive prefix) ✅ · `CHANGES.md` ✅ · memory ✅
Verify / exit: ✅ live invoke → `world/latest.json` real (China flood), Worker serves it (not fixture), inbox → 4 processed; alarms created; digest runs; 7 tests pass. Freshness handled by the `situation-tracker-stalled` alarm (cleaner than a `newsFreshnessMonitor` probe — that probe is NOT needed).
Done-check: [x] flip  [x] alarms  [x] metrics/knobs  [x] archive  [x] digest  [x] docs  [x] CHANGES
Commit: `4eb3442`
Notes: tune over the next days with `node scripts/situations-log.mjs --days 3`; watch `Cooled`/`Closed` vs `Observations` — if GDACS's ~100-event window drops active events and causes flapping, raise `CLOSE_AFTER_COOL_CHECKS` via `update-function-configuration` (merge env).

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

### S4 · T1 — `worldData.js` + `useWorld()` + `useSituationDetail()` + new map
Status: ✅ done (source; browser-verified; NOT deployed to prod — `./deploy.sh` gated)
Reads/refs: plan WS3 (REVISED); `DATA_STRATEGY.md` §5
Changes: `services/worldData.js`, `hooks/useWorld.js` (useWorld/useSituationDetail, 5-min visible-tab poll, asOf/stale); **new** `components/SituationMap.jsx` (dark D3 map, hue=axis/radius=tier/ring=escalating) + `components/SituationHome.jsx`+css (freshness grey-out, lede, ranked list, detail panel, `?focus=`); routed at `/map` (old map → `/map-legacy`). Did NOT wire into WorldMapV2 (built a clean new map instead — WorldMapV2 retired to /map-legacy, deleted in S6)
Docs to update: `ARCHITECTURE.md` (read path fixes) ✅ · `DATA_STRATEGY.md` ✅ · `CHANGES.md` ✅
Verify / exit: ✅ build + lint clean; **headless Playwright**: 177 country paths + marker render, freshness/lede/list correct, click → detail + `?focus=`, **0 console errors**
Done-check: [x] code  [x] docs  [x] CHANGES  [x] browser-verified  [ ] prod deploy (gated)
Commit: `4a3ddf2`
Notes: **3 contract bugs found+fixed during testing** (see CHANGES): tracker stable-pointer (`gdacs-latest.json`, amends S1/S2 — was spuriously cooling+stale); state-object key sanitization (`#`→`_`, both tracker & worldData); Worker CORS-on-errors. Backend fixes deployed+live-verified.

### S4 · T2 — Canonical ISO + centroids + unmatched → error sink
Status: ✅ done-by-obviation (not needed for the new map)
Notes: the new map renders situations from **pre-resolved centroids in the bundle** (the pipeline already did the geography), so no frontend name→ISO matching exists to fix — the Palestine/Kosovo class of bug is handled upstream in ingest (S3 classifier emits ISO3/latlon; unmatched → error sink there). WorldMapV2's alias tables are retired with it (S6). `countryCentroids.js` unnecessary. If a future situation ever lacks a centroid, the map simply omits its marker (still in the list) — acceptable.

### S4 · T3 — Bundled topology + URL state
Status: ✅ done (part of S4·T1)
Changes: `src/assets/countries-110m.json` (pinned world-atlas 2.0.2, imported — no CDN fetch); `?focus=<id>` URL state (replace mode). Scrubber `?t=` deferred to S5.
Verify / exit: ✅ no CDN fetch (bundled import); `?focus=` deep-link sets the selection; no topology present in the network graph means no silent CDN hang
Done-check: [x] code  [x] verify
Commit: `4a3ddf2`
Notes: topology-load-failure path is moot now (bundled, not fetched). Full `?t=` scrubber + `?layer=` land with S5.

---

## Stage S4.5 — Legibility & honesty pass (added 2026-09-08 after the first browser review; plan §12) — **gate before any prod deploy of /map**

### S4.5 · T1 — Legend-as-coverage + briefing lede + coverage note
Status: 🔭 todo
Reads/refs: plan §12 (findings 1–3); `SituationHome.jsx`, `SituationMap.jsx`; tracker `deriveLede` (`newsSituationTracker/src/index.js`)
Changes: legend with live per-axis counts (conflict/political/economic/humanitarian; inactive dimmed "none active"); tracker `deriveLede` → real briefing sentence from counts by axis + top item + what is NOT tracked; coverage note while the news layer is absent ("Tracking severe natural disasters (GDACS). Conflict, political and economic situations arrive with the news layer."); in-map empty/low-coverage state (<3 situations) showing legend + note
Docs to update: `DATA_STRATEGY.md` §5 (lede contract) · `CHANGES.md`
Verify / exit: browser: a stranger can say what the map watches and why it's sparse without clicking
Done-check: [ ] code  [ ] docs  [ ] CHANGES  [ ] browser
Commit: —

### S4.5 · T2 — Freshness: fix future-time bug + one truthful claim
Status: 🔭 todo
Reads/refs: `SituationHome.jsx` `fmtAgo`; app header `StatusStrip` ("LIVE · Updated hourly") in `Layout.jsx`/`atoms/StatusStrip`
Changes: `fmtIn()` for future stamps ("next in 25 min"); hide the app StatusStrip on this page or drive it from the bundle — never two freshness claims
Docs to update: `CHANGES.md`
Verify / exit: only one freshness line visible; "next in N min" correct
Done-check: [ ] code  [ ] CHANGES  [ ] browser
Commit: —

### S4.5 · T3 — Rich, plain-language detail card + richer GDACS observation
Status: 🔭 todo
Reads/refs: plan §12 (findings 6–7); `situations-core.js buildObservation` (both copies); `SituationHome.jsx` detail panel; GDACS feed fields (`description`, `severitydata`, population in `htmldescription`)
Changes: observation += `description`, `population` (parse from GDACS), keep `severityText`; card: report link first, description, severity text, population affected, full country names (via `countryMapping`), timeline (opened / last change), state labels New/Getting worse/Ongoing/Easing/Ended, "Deterministic alert from UN/EU GDACS — no AI analysis at Orange level" (Option A wording); for `threadId` situations: outlets count + latest headlines (S3 data)
Docs to update: `DATA_STRATEGY.md` §5 (observation/summary fields) · `ARCHITECTURE.md` (Situations object shape) · `CHANGES.md`
Verify / exit: card explains what/where/how bad/why-no-analysis in plain words; both `situations-core.js` copies byte-identical; tests pass
Done-check: [ ] backend  [ ] frontend  [ ] docs  [ ] CHANGES  [ ] browser
Commit: —

### S4.5 · T4 — Map basics: crop ±60°, hover tooltip, zoom/pan, stronger severity scale
Status: 🔭 todo
Reads/refs: `SituationMap.jsx`; plan §12 (findings 4, 8)
Changes: `fitExtent` to ±60° lat; d3-zoom pan/zoom; hover tooltip (label · tier · state · ago); radius scale widened + glow for elevated too (interim until S5 columns)
Docs to update: `CHANGES.md`
Verify / exit: browser: tooltip on hover, zoom works, Antarctica gone, severity visibly graded
Done-check: [ ] code  [ ] CHANGES  [ ] browser
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
