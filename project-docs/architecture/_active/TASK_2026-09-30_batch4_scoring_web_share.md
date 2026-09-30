## Batch 4: scoring pipeline (D6 M2–M4), story web stage 2 (D8), Studio share links (D5) — 2026-09-30 — active (PLAN ONLY; nothing executed, nothing changed except this file)

**Goal:**
- **Scoring (D6 M2–M4):** every forecast question carries its **own probability `p` and a named `resolution_source`, frozen at issue** (M2). A **pre-registered weekly sample** (about 22 questions, at most one per story) is drawn with a **published seed commitment**, drafted by an agent, **confirmed by the operator in about 1 h a week**, and scored by Brier and skill against a base rate, with VOIDs published and a **dead-man's alarm** if a weekly settle is missed (M3). The site then shows each question's own `%` on WATCH, the country card, briefings and the story page, and `/track-record` gets the seed row, the settling log built from real weeks, and per-question deadlines (M4, read fix g).
- **Story web stage 2 (D8):** the web behind FED INTO gets real evidence. The systems prompt shows about 10 dated entries per story instead of 5 opaque ids, links are stored as a per-story `THREAD#id / WEB` record plus one `web_index` read, coverage is measured, and story-to-story lines are drawn on the map.
- **Studio share links (D5):** a reader can share a run that passed its checks as a read-only, noindex page `/analyze/s/:id` with sources frozen by the server; the signed-out Studio shows one real shared example.
- **Honesty rule for all three (operator, 2026-09-30):** where the information does not exist yet, the site says so ("not ready yet"), what the reader can expect, and when, computed from real dates and labelled as an estimate. No placeholders, no invented numbers.

**Source:** operator request 2026-09-30 ("build the remaining items"). `BACKEND_PLAN_2026-09-27.md` (work list 8, "Later"), `REDESIGN_MASTER_PLAN.md` §3.7, §3.8, §4 (D5, D6, D8), `TRACK_RECORD_AND_STUDIO_RULING.md` ("What we score", "Track record page design", "Studio page design", "Staged build"), `PREDICTION_METHODOLOGY_V1_PLAN.md`, `STORY_WEB_RETHINK_PLAN.md` §5 (stage 2). Format and evidence standard: `TASK_2026-09-30_batch3_readfixes_drift.md`, `TASK_2026-09-29_batch2_models.md`, `playbooks/TASK_TEMPLATE.md`. **This step was read-only:** AWS reads, downloads of deployed zips, DynamoDB scans/gets, one public proxy GET, local arithmetic. No LLM call, no AWS write, no code edit, no commit.

**Reads / references:**
- `CLAUDE.md`; `playbooks/TASK_TEMPLATE.md`; `architecture/_active/BACKEND_PLAN_2026-09-27.md`; `redesign-ux/_active/{REDESIGN_MASTER_PLAN,TRACK_RECORD_AND_STUDIO_RULING,STORY_WEB_RETHINK_PLAN}.md`; `prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md`; `predictions/V1_RESOLUTION_RUNBOOK.md`; `architecture/ARCHITECTURE.md` (§2 L225, §9 L458, §16 L585, §18 L620, §20 L652, §27 L788, §36 L923, DynamoDB L974–, Prediction calibration L1115, Scheduling L1165, Frontend L1242–); `architecture/DATA_STRATEGY.md` (§2 "nothing else goes in DynamoDB", §6 PredictionLog "stays"); `distribution/WORKER_FULL_CODE.md` (`/analyze/s/*` never pre-rendered, L79, L533).
- Repo code read: `NewsProjectInvokeAgentLambda/src/{index.js,lib.js}` (`PREDICTION_MAX_TOKENS` L21, `buildPredictionPrompt` L491–555, `ensureStored` L560, `logPredictionSnapshot` L915, `genCtx` L158; `lib.normalizeTrigger` L85, `validateTrigger` L123, `buildGatedScenarios` L173); `newsPredictionResolver/src/index.js` (legacy proposer, 212 lines); `newsPredictionsSnapshot/src/{index,trackRecord}.js`; `newsSensitiveData/src/index.js` (`prediction_snapshot` L697–745, `systems_analysis` L749, `world_overview` L771, `prediction_track_record` L1013, `readNarrativeThread` L1873); `newsSystemsAnalysis/src/index.js` (`groupByCountry` L154, `buildSystemsPrompt` L214, `validateGraph` L303, `writeAnalysis` L445); `newsFreshnessMonitor/src/index.js`; `newsAnalyze` (deployed zip, JWT + CORS pattern); `predictions/{resolve-v1-extract,resolve-v1-write,review}.js`.
- Frontend read: `features/track-record/**` (page, text page, `lib/{stageWording,accuracyLock,pastDeadline,settlingLog,pilotExclusion,postPilotBrier,forecastPlaces}.js`, `components/{ForecastBoard,SettlingLog}.jsx`); `features/threads/{lib/storyMode.js,lib/storyLinks.js,hooks/useStoryLinks.js,hooks/useThreadForecast.js,components/{StoryMode,ThreadForecast}.jsx}`; `features/briefings/components/BriefingSlides.jsx`; `features/countries/{lib/countryTriggers.js,components/CountryCardV2.jsx}`; `features/analysis-studio/{AnalysisStudio.jsx,lib/*,components/*}`; `shared/api/restProxy.js` (L258 track record, L266 snapshot, L435–460 analyze endpoint pattern); `shared/ui/Markdown.jsx` (XSS-safe renderer; links only from an explicit `[Wn]` map); `app/App.jsx` routes; `docs/config.js` (operator-owned; key names only).
- Live reads (2026-09-30): the 6 deployed Lambda zips in `…/scratchpad/b4/z/` (**re-download before any deploy, the S3 link expires in minutes**); `GlobalPerspectivePredictionLog` scan (5,896 items); `predictions/track_record.json`; 19 `SYSTEMS#` rows + 6 `archive#` rows + `today-archive`; IAM inline policies of 6 roles; EventBridge rule list; table key schemas; Function-URL config of `newsAnalyze`/`newsSavedItems`.

---

## 0. Findings (live + code, 2026-09-30)

### 0.1 Scoring: where the data really stands
- **Live aggregate** (`predictions/track_record.json`, built 06:30 UTC): 3,478 v1 snapshots (2026-07-04 to 09-30, 48 distinct issue days), 20,925 dated triggers, **122 resolved** (all from the one 24 Jul run), 20,788 "pending", Brier 0.154 (pilot, scenario-probability method, **not usable**), 2,418 legacy snapshots excluded. Nothing else changed since the ruling.
- **No trigger has its own probability today.** `scenarios[].probability` is the midpoint of the scenario's range; a trigger inherits it. 28 snapshots were written today (2026-09-30) on `deepseek-v4-pro` (Batch 2): the model works, but the rows are still the pre-M2 shape. **Every row issued before M2 goes live is permanently unscoreable** under the ruling (no `p`, no named source). So **every day M2 is late is a day off the front of the record** (same lesson as 2026-07-04).
- **Volume the sample can draw from** (real rows): median 6 triggers per snapshot; lead time (deadline minus issue day) p10/p25/p50/p75/p90 = 14 / 31 / 61 / 119 / 171 days; **57.6% of triggers fall in a 7–84 day lead window**, 40.1% beyond 84 days, 2.2% under 7 days. In the week 07–13 Sep the old pipeline wrote 554 snapshots (before R2's once-per-story-a-day rule) with 1,877 in-window triggers. Under R2 the daily count is about one snapshot per active story (28 today), so roughly **90 in-window questions a day and 40–80 distinct stories a week to draw from: 22 a week is feasible, one per story is feasible.**
- **`newsPredictionResolver` is the legacy proposer** (rule `TriggerPredictionResolver` DISABLED since 2026-09-28). It scores at scenario probability, scans all `open` snapshots, has no `p`, and takes items in scan order. Its role `newsPredictionResolver-role` already holds `Scan/GetItem/PutItem/Query/UpdateItem` on `GlobalPerspectivePredictionLog` and its env already holds the Brave key and the DeepSeek names (`XAI_API_KEY`, `GROK_API_URL`, `GROK_MODEL`, `BRAVE_SEARCH_API_KEY`, `LLM_CONCURRENCY`, `MAX_RESOLVE_PER_RUN`, `PREDICTION_LOG_TABLE`). So the **weekly settle Lambda needs no new function, no IAM change, no env change** if it reuses this one (decision Q1).
- **The alarm channel exists.** `newsFreshnessMonitor` (every 2 h, `sns:Publish` on `GlobalPerspectiveAlerts`, reads the public proxy over HTTP) can read `prediction_track_record` (GET works, verified) and alert on `settleHealth` with **no IAM change**.
- **The public track-record read is a pass-through of S3 `predictions/track_record.json`** written by `newsPredictionsSnapshot` (sole writer of `predictions/`, DATA_STRATEGY rule 1). New scoring output is an additive block in that object. Old frontend keeps working (it ignores unknown fields). **Trap:** the legacy aggregator scores any trigger with a `finalVerdict` at the scenario probability; if the new settle flow ever wrote `finalVerdict` on a question the old page and aggregate would silently score it wrongly. The new flow therefore never touches `PRED#` rows (immutable `Q#<qid>` rows instead, §1 B) and the aggregator skips `question:true` triggers in the legacy block.
- **Read fix g** (per-trigger deadlines so "past deadline, not checked" is computable): `pastDeadline.js` returns `computable:false` because the public action serves only an aggregate `pendingTriggers`. The fix serves deadlines **for the sampled questions** (the only ones that will ever be scored). The 20,788 legacy "pending" stay a labelled count ("never scored: issued before the method"); we do not ship 20k deadlines.
- **Threads are not known at issue time.** `logPredictionSnapshot` runs before `threadId` assignment (index.js L195–231). The cluster key for "max 1 per story" is therefore computed at issue with the same `assignThreadId(topic, ctx.pastEntries)` the archive uses, stored on the row, and verified against the served topics (§1 A verification 3). Fallback: the sampler reads `archive#` rows, which needs a **NewsCache read on the resolver role = IAM change = fresh yes**. Not planned.
- **Pre-registration arithmetic (illustrative; the page recomputes from real data).** Sample K = 22 a week, deadlines uniform over a 7–84 day lead, settled at the first Monday review at least 3 days after the deadline. If M2 is live by **Fri 2026-10-02**, the first commit-covered week is **Mon 2026-10-05**, its draw is **Mon 2026-10-12**, and 150 scored questions arrive **about 2027-01-11 (no voids) to 2027-01-25 (25% voids)** (K = 20: 01-18 to 02-01; K = 25: 01-04 to 01-18). This matches the ruling's "first meaningful read about four months after launch".

### 0.2 Story web: coverage and why it is low
- **19 `SYSTEMS#` rows** (TTL disabled, all kept): 13 regenerated 2026-09-30 by the manual chain run; **Japan 09-10, Palestine 09-12, DR Congo 08-22, South Africa 08-12, Venezuela 07-28 are stale**. Four rows are regions (Europe, Asia, Middle East, Americas) written before Batch 3 F; they are ignored by the readers already and must be ignored by `web_index`. Current totals: 78 distinct story nodes, 57 causal edges (50 distinct linked stories), 61 shared-actor edges.
- **Measured coverage today** (archive rows present: 2026-09-10..13, 09-30, `today-archive`; the AI was paused 09-14..09-29, so there are no rows for those days): **120 distinct stories; 29 in any web (24%), 17 in a causal link (14%).** Only 59 of the 120 have two or more entries, and **29 of those 59 (49%) are in a web**. Today's 28 stories: **0 in a web, 0 linked, all single-update.**
- **Structural cause, from `groupByCountry`:** a story is a node only if it has at least 2 entries **and** its country has at least 4 entries and at least 2 such stories, and only the top 15 stories per country and the top `SYSTEMS_TOP_N` = 10 countries (env value 10, `MAX_TOKENS` 6000, model v4-pro) are analysed. A brand-new story cannot be linked until its second update. This has to be said on the page (§5 copy), not hidden.
- **The prompt gives the model opaque ids.** `buildSystemsPrompt` lists each story as `threadId`, category, peak date, entry count, title, and `topicIds: [first 5]` (the 5 newest, because `readArchiveEntries` reads day 0 first). The model cannot see what any cited entry says, only that an id exists; `validateGraph` accepts any id from the whole country list. That is the recency artefact the rethink plan measured (83% of cites are "newest at generation").
- **Deployed = repo** for `newsSystemsAnalysis` (index.js byte-identical; deployed 2026-09-30 04:37). Last measured run cost: manual chain 10 countries in 123 s of a 300 s timeout.
- **Frontend today:** `useStoryLinks(threadId, regions)` fetches up to 3 `systems_analysis` records and derives FED INTO / fed-from (`storyLinks.js`, freshness rule amber at 7 d, hidden at 30 d). Map arcs for FED INTO are **not built** (S2.1 note). No `web_index`, no per-story record, no coverage measure.

### 0.3 Studio share: what exists and what the ruling requires
- **`newsAnalyze` (deployed, patched, not to be touched):** Firebase JWT check written inline (`verifyFirebaseToken`, Google x509 certs, `aud`/`iss` against `FIREBASE_PROJECT_ID`), CORS emitted in code (`corsHeaders`, allow-list, OPTIONS handled), Function URL `AuthType NONE`, **Function-URL CORS config null** (checked). `newsSavedItems` is the opposite (Function-URL CORS populated). The new Lambda follows the `newsAnalyze` pattern.
- **Where `SHARE#` can live (DATA_STRATEGY sorting test: "if the user deleted their account would it disappear? yes → DynamoDB").** Existing DynamoDB tables: `GlobalPerspectiveUserTable` (uid), `SavedItems` (uid, savedKey), `UserPrefs` (uid), `ApiKeys` (keyHash, 0 items), plus world tables with generic `PK/SK` (`PredictionLog`, `SummarizeAndPredict`, `Markets`). **None can be read by a public id without a new index.** Two options: **(1)** a new table `GlobalPerspectiveShares` (PK `id`, GSI `uid-createdAt-index`) with a recorded DATA_STRATEGY exception: lookup by public id, owner delete, per-user daily count and per-user cleanup are all indexed; **(2)** one row in `SavedItems` with `uid = 'SHARE#<id>'` (no new table, no index): a public GET works, an owner delete works by a condition on `ownerUid`, but the per-user daily count needs a counter on the Users row (extra IAM on the Users table) and the manual account deletion (Account.jsx L182: "email us") has no way to find a person's shares. **Recommendation: (1).** Either way a role and a Function URL are new, so it is gated (§ gates).
- **Account deletion is a manual email process today**, so shares must be findable by owner: `scripts/share-admin.mjs` (operator CLI, read-only by default) is part of the plan.
- **What a run is** (from `AnalysisStudio.jsx`): `buildAnalysisContext(selectedTopics)` (network layer in `analysis.js` L199 calling proxy actions `narrative_thread`, thread analyses, `prediction_snapshot`, summary/prediction/trace caches) feeds the **pure** `assembleContext` in `analysisPrompt.js`. `validateAnalysis` (analysisValidator.js L116), `validateStruct`/`extractStruct`, `webCitations.js`, `directionCheck.js` are **dependency-free ES modules with no imports**, so a Lambda package with `"type":"module"` can carry **byte-identical copies** guarded by `scripts/check-shared-sync.mjs`. `analysis.js` cannot be copied as is (it imports `restProxy`); it must be split into a pure `analysisContext.js` that takes injected fetchers (the browser injects `restProxy`, the Lambda injects HTTP calls to the public proxy).
- **`whatchanged` lens picture** is computed from a live `country_history` fetch (`buildLensPicture`). It cannot be re-derived from frozen sources. v1 of sharing carries the prose, the validated struct and the source list; the `whatchanged` picture is **not** included in a shared copy (stated on the page; decision Q14).
- **Signed-out Studio** is fully blocked today (`blocked = !authLoading && !isRegistered`, AnalysisStudio.jsx L172). The example must be a **real** share made once by the operator with their own key (the assistant never handles a key); until it exists the page says "not ready yet" (§7 copy).
- **Worker:** `/analyze/s/*` is already never pre-rendered (deployed 2026-09-30). The `noindex` meta is set by the SPA at runtime; an `X-Robots-Tag` on the HTML response would need a Worker edit (optional, gated; decision Q17).

### 0.4 Deployed vs repo (every Lambda whose code changes)
| Lambda | Deployed `CodeSha256` | Timeout / memory | Diff vs repo `src/` |
|---|---|---|---|
| `NewsProjectInvokeAgentLambda-dev` | `8dZ6qHr92CkXBLp8DTv2sbsRHtvTpA831gTanritlW0=` | 900 s / 512 MB | none (`index.js`, `lib.js` byte-identical) |
| `newsPredictionsSnapshot` | `cNikHncT73bOlks9a2S+3sA6cCslg1JHZv9Fy8G9iC8=` | 120 s / 256 MB | none (`index.js`, `trackRecord.js` identical; repo also has `trackRecord.test.mjs`) |
| `newsSensitiveData-dev` | `z0bVMR1F0761JunigjxnkctcstfnCyXW4AVSiV5zEKQ=` | 85 s / 512 MB | none (`index.js`, `lib.js` identical) |
| `newsSystemsAnalysis` | `AgzPGv2/z4XcIQ7dNQFe2cNykUuS9/rLLNTFOIEaBxY=` | 300 s / 512 MB | none (`index.js` identical) |
| `newsPredictionResolver` | `ezB+B2tnqbXQliK8xpzbOYFQBySbFrx5P4F690EyUDI=` | 300 s / 256 MB | **comment + dead fallback string only** (`'deepseek-chat'` vs `'deepseek-v4-flash'`, L24; L118 comment). The file is being replaced wholesale, so the repo is the base and the deployed file is kept as the rollback zip |
| `newsFreshnessMonitor` | `esLTQ79kBUvgilpejggtcYsO2udZOtBGYE4DVUyYtGs=` | 30 s / 128 MB | none |
| `newsAnalyze` | `4pTSGsz5uwf/qy3ffklEwHxBXsqPudj2BFHvS20FXhg=` | 120 s / 256 MB | **differs (patched deployed zip). NOT touched by this batch. Never deploy the repo copy.** |
Zips are in `…/scratchpad/b4/{<name>.zip, z/<name>/}`. The hashes are the rollback record: a redeploy of the same bytes gives the same `CodeSha256`.

### 0.5 Env, IAM, schedules: what does NOT change
- **No env var is added or changed in phases A–F.** The forecast token cap is raised in code (`PREDICTION_MAX_TOKENS` is not set in the live env; the code default moves 1500 → 2500). The resolver already has `BRAVE_SEARCH_API_KEY` and the DeepSeek names. `newsSystemsAnalysis` keeps `SYSTEMS_TOP_N=10`, `MAX_TOKENS=6000`. **No secret is read, printed or written by this plan.** GROK_* / XAI_* hold DeepSeek.
- **No IAM change in A–F:** `newsprojectLambdaRole1fd679db-dev` (forecast Lambda, and the proxy uses `newsprojectLambdaRolefcb19312-dev`) have `AmazonDynamoDBFullAccess`; the proxy also has `s3:GetObject predictions/*`; `newsSystemsAnalysis` uses `newsCountryIntelligence-role` (DynamoDB full); the resolver role is described in 0.1; `newsFreshnessMonitor-role` has `sns:Publish`; `newsPredictionsSnapshot-role` has `dynamodb:Scan` on the log and `s3:PutObject predictions/*` (enough: it only reads the log and writes the aggregate).
- **Schedules:** `TriggerPredictionResolver` (currently DISABLED, `cron(0 9 * * ? *)`, in DeepSeek's peak window) is re-pointed to `cron(30 10 * * ? *)` with a new input and enabled (standing authorization covers `aws events`; §1 B). No other rule changes.

---

## Gates: exactly which steps need the operator's fresh "yes"

Nothing in phases A–F needs one beyond the standing authorization (Lambda code updates, `aws events`, non-destructive DynamoDB reads/writes for work the operator asked for). **Execution must STOP at each line below and ask, in the current message, before doing it:**

| # | Step | Phase | Why gated |
|---|---|---|---|
| Y1 | **Create the DynamoDB table `GlobalPerspectiveShares`** (+ GSI `uid-createdAt-index`), and record the DATA_STRATEGY §2 exception; or, if Q13 answers "SavedItems", write `SHARE#` rows there | G | new table = explicit exception (DATA_STRATEGY §2) |
| Y2 | **Create the IAM role `newsSharedAnalysis-role` and its inline policies** (logs; DynamoDB `GetItem/PutItem/DeleteItem/Query` on the Shares table and its GSI only) | G | IAM change |
| Y3 | **Create the Lambda `newsSharedAnalysis`** (first `create-function`) | G | new Lambda |
| Y4 | **Create the Function URL** (`AuthType NONE`, Function-URL CORS left **empty**, CORS is emitted in code) | G | new public endpoint |
| Y5 | **Edit `docs/config.js`: `window.NEWS_SHARE_ENDPOINT`** | G/H | operator-owned runtime config |
| Y6 | **Frontend deploy `./deploy.sh`** (carries M4, story-web UI and the share UI; the share UI hides itself while `NEWS_SHARE_ENDPOINT` is unset) | I | production deploy gate |
| Y7 | **Worker `/analyze/s/*` `X-Robots-Tag` header** (optional; meta noindex works without it) | I | Worker deploy is its own yes |
| Y8 | **The operator creates the example share** with their own key (cost is theirs: about $0.01–0.05 on their provider); the assistant never touches a key | H | secret / operator action |

**Not needed, stated so nothing is assumed:** no new paid API (Brave and DeepSeek are already in use); no new npm dependency (bootstrap, SHA-256, JWT check use Node built-ins); no secret value is touched; no destructive data op (legacy `open` proposals and all `PRED#` rows stay; the aggregator simply ignores them); `newsAnalyze` is not touched; no email/cron send is enabled.

---

## Open questions for the operator (each has a recommendation; "yes to all" is a valid answer)

| # | Question | Recommendation |
|---|---|---|
| Q1 | The weekly sampler and the drafter live in the **existing `newsPredictionResolver`** (rewritten in place; the legacy proposer is retired by this), not a new Lambda | Yes. No gate, no IAM, no env. The name is misleading (hygiene list); a `newsPredictionSettle` Lambda would cost one Y-gate |
| Q2 | Sample = **rank by SHA-256(seed + question id) after the week closes, one per story, top K = 22**, instead of the ruling's "fixed threshold at issue" | Yes. Volume varies (28 to 117 snapshots a day), so a fixed threshold cannot hit 20–25; ranking is just as verifiable once the seed is revealed, and the seed hash is public before the week starts |
| Q3 | Only questions with **7–84 day lead** are eligible for the sample (58% of today's triggers); longer ones are logged with `p` but never sampled | Yes (ruling: "deadlines mostly 2–12 weeks"); it also bounds the "not ready yet" estimate |
| Q4 | Keep `methodologyVersion: 1`, add `questionSchema: 1` on the row and `question: true` on qualifying triggers (`methodologyVersion: 2` stays reserved for the calibration digest) | Yes |
| Q5 | Deterministic resolvers (GDACS, price history) are **deferred**: economy is parked and no cleaned deterministic source exists; every question is `resolver: human` for now | Yes; a GDACS-only stratum can follow |
| Q6 | Drafter model: `deepseek-v4-pro` (about $0.15 a week) vs flash | v4-pro (evidence judgment is the point) |
| Q7 | Show a question's own `%` publicly **at issue** (WATCH, card, briefings), sampled or not | Yes; labelled "not in this week's scored sample" when it is not |
| Q8 | Review day: **Monday**; the daily 10:30 UTC tick is idempotent and self-heals a missed day; the drafting pass runs Mondays | Yes |
| Q9 | A **"Verify this draw"** control on `/track-record` (SHA-256 of the revealed seed in the browser) | Yes, small; needs a guarded copy of the rank rule |
| Q10 | Story web: keep `SYSTEMS_TOP_N = 10`; raise it (and the 300 s timeout) only if measured coverage of eligible stories stays under 50% | Yes |
| Q11 | AI chapter titles (S4) are **out of scope** here (not in your list) | Yes |
| Q12 | Map lines between linked stories: on the selected story's map (story mode) and on the home map when a story is selected; strong and medium only, "approx." place rule (S7, S8) | Yes |
| Q13 | Share storage: **new table `GlobalPerspectiveShares`** vs a row in `SavedItems` | New table (indexed owner lookup, delete, quota, account-deletion cleanup) |
| Q14 | A shared copy omits the `whatchanged` lens picture (needs a live fetch) and says so | Yes |
| Q15 | Web sources in a share are **reader-supplied** (their provider's search), shown separately and labelled "not checked by us" | Yes |
| Q16 | Shares never expire while the owner keeps them; delete is immediate and hard | Yes |
| Q17 | Ask for the Worker header (Y7) at deploy time, or rely on the meta tag only | Meta tag now; header later |
| Q18 | **Live LLM runs (each named, minimal):** (a) 3 forced single-story forecasts to prove the new JSON on real stories, about $0.03; (b) the drafter replayed dry-run on 10 archived July-pilot triggers with known verdicts (no writes), about $0.06 plus 20 Brave searches; (c) one-country web run about $0.02, then one full manual web run about $0.25 | Approve all three |
| Q19 | One extra hour of operator time to do the **first Monday review together** (the CLI's first real use) | Yes |

---

## Changes (code)

Phase ids: **A** M2 questions at issue · **B** M3 sampler, drafter, confirm CLI · **C** M3 aggregate, scoring math, dead-man's alarm · **D** M4 frontend · **E** story web backend · **F** story web frontend and map lines · **G** share backend (**stops at the gates**) · **H** share frontend · **I** deploy and smoke (**gated**).

### Repo files: create
| Phase | File | Purpose |
|---|---|---|
| A | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/questions.js` | pure: `qidFor(pk, sk, triggerId)`, `questionGate(trigger, ctx)` (G7–G12), `jaccard`, `clusterKeyFor` |
| A | `…/NewsProjectInvokeAgentLambda/test/questions.test.js`, `test/fixtures/pre-m2-output.json`, `test/fixtures/m2-output.json` | gates; regression on the real pre-M2 output shape (all triggers demoted, none dropped by the new gates) |
| B | `amplify/backend/function/newsPredictionResolver/src/{lib.js,store.js,search.js,draft.js}` | pure week / seed / rank / eligibility / verdict-window rules; DynamoDB record IO; Brave; drafter prompt + validators |
| B | `…/newsPredictionResolver/src/package.json` (`"test": "node --test ../test/*.test.js"`) | the resolver has no package.json today |
| B | `…/newsPredictionResolver/test/{weeks,sample,draft,store}.test.js`, `test/fixtures/*.json` | tests (§1 B) |
| B | `predictions/settle-review.js` | operator confirm CLI (no `p`, ever) |
| B | `predictions/verify-draw.mjs` | anyone can recompute a published draw from the public aggregate |
| C | `amplify/backend/function/newsPredictionsSnapshot/src/{questionBoard.js,scoring.js}` + `questionBoard.test.mjs`, `scoring.test.mjs` | the new `questions` block; Brier, skill, base rate, cluster bootstrap, reliability bins, `settleHealth` |
| C | `amplify/backend/function/newsFreshnessMonitor/src/settleCheck.js`, `test/settleCheck.test.js`, `package.json` `"test"` | dead-man's alarm logic (pure) |
| D | `frontend/src/features/track-record/lib/{accuracyEstimate.js,questionStates.js,notReadyCopy.js,sampleRule.js}` | estimate window, state vocabulary, all "not ready yet" strings in one place, guarded copy of the rank rule |
| D | `frontend/src/features/track-record/components/{DrawRow,QuestionPanel}.jsx` + `.css` | the seed row; the right-hand panel |
| D | `frontend/src/features/threads/lib/questionChips.js`, `components/QuestionChip.jsx` | own-% chip shared by WATCH, ThreadForecast, card, briefing |
| D | `frontend/src/features/track-record/__tests__/{accuracyEstimate,questionStates,notReadyCopy,stageWordingV2,settlingLogV2,sampleRule,trackRecordNotReady}.test.{js,jsx}`; `features/threads/__tests__/questionChips.test.{js,jsx}` | tests |
| E | `amplify/backend/function/newsSystemsAnalysis/src/{spreadEntries.js,webRecords.js}` + `test/{spreadEntries,webRecords,coverage}.test.js` | ~10 dated entries per story; per-story record and index builders; coverage and reason codes |
| E | `amplify/backend/function/newsSensitiveData/test/webIndex.test.js` | `web_index` shapes |
| F | `frontend/src/features/threads/hooks/useWebIndex.js`, `lib/{webIndexLinks.js,linkStates.js}`, `frontend/src/features/map/lib/storyLinkArcs.js` + tests | reads `web_index`; derives fed-into / fed-from / empty-state reasons; arc endpoints |
| G | `amplify/backend/function/newsSharedAnalysis/src/{index.js,auth.js,cors.js,freeze.js,limits.js,urls.js,package.json}` | the Lambda source (`"type":"module"`) |
| G | `…/newsSharedAnalysis/src/{analysisValidator.js,analysisStruct.js,webCitations.js,directionCheck.js,analysisContext.js}` | **byte-identical copies** of the frontend modules (guarded) |
| G | `…/newsSharedAnalysis/test/{auth,cors,freeze,limits,urls,handler}.test.js` + fixtures | tests |
| G | `frontend/src/features/analysis-studio/lib/analysisContext.js` | the pure context builder split out of `analysis.js` (fetchers injected) |
| G | `scripts/share-admin.mjs` | operator: list / delete shares by uid (account-deletion requests); read-only by default |
| H | `frontend/src/features/analysis-studio/{SharedAnalysisPage.jsx,SharedAnalysisPage.css}`, `components/ShareButton.jsx`, `lib/{shareApi.js,sharePayload.js,sharedExample.js}`, `frontend/src/shared/hooks/useNoIndex.js` + tests | share UI |

### Repo files: edit
| Phase | File | Change |
|---|---|---|
| A | `NewsProjectInvokeAgentLambda/src/index.js` L21 (`PREDICTION_MAX_TOKENS` default 1500 → 2500), L491–555 (`buildPredictionPrompt`: trigger object gains `p`, `resolution_source`; rules), L158 (`genCtx`: load recent question texts per topic; `threadId` hint), L915–955 (`logPredictionSnapshot`: `questionSchema`, `regions`, `threadId`, capture report) | the schema and prompt change |
| A | `NewsProjectInvokeAgentLambda/src/lib.js` L85 `normalizeTrigger`, L173 `buildGatedScenarios` | carry `p` / `resolution_source`; call `questions.js`; emit `question`, `qid`, `p`, `resolutionSource`, `resolver`; capture counts |
| A | `NewsProjectInvokeAgentLambda/src/package.json` test script | run both test files |
| B | `newsPredictionResolver/src/index.js` | **replaced** (legacy proposer removed): actions `tick`, `draw`, `draft`, `status`; every action supports `dryRun` |
| B | `predictions/V1_RESOLUTION_RUNBOOK.md`, `predictions/review.js` header | runbook now points at the weekly flow; `review.js` marked legacy |
| C | `newsPredictionsSnapshot/src/index.js` (projection + `questionBoard`), `src/trackRecord.js` (skip `question:true` triggers in the legacy block) | additive |
| C | `newsSensitiveData/src/index.js` L697–745 `prediction_snapshot` | triggers gain `qid`, `p`, `source`, `sampled`, `state`; accepts `threadId` (resolved through `readNarrativeThread`) as well as `topicIds` |
| C | `newsFreshnessMonitor/src/index.js` | run the settle check first, in its own try/catch, once a day |
| D | `frontend/src/features/track-record/{TrackRecordPage.jsx,TrackRecordText.jsx,TrackRecordPage.css}`, `lib/{stageWording,accuracyLock,pastDeadline,settlingLog}.js`, `components/{ForecastBoard,SettlingLog}.jsx`, `hooks/useTrackRecord.js` | stages from the `questions` block; seed row; estimate; real settling weeks; board from sampled questions |
| D | `frontend/src/features/threads/{lib/storyMode.js (buildDeadlines),components/StoryMode.jsx (WatchSlide),components/ThreadForecast.jsx,hooks/useThreadForecast.js}`, `features/countries/{lib/countryTriggers.js,components/CountryCardV2.jsx}`, `features/briefings/components/BriefingSlides.jsx` (+ `lib/briefingSlides.js`) | own-% chip, source, state; note for pre-M2 forecasts |
| E | `newsSystemsAnalysis/src/index.js` (`buildSystemsPrompt` L214, `groupByCountry` L154 to carry entries, `validateGraph` L303 cites only shown entries, `writeAnalysis` L445, handler: WEB records + index + coverage, `dryRun` returns them, `{countries:[…]}` event override) | the stage-2 changes |
| E | `newsSensitiveData/src/index.js` (new `web_index` branch after `systems_analysis` L749) | one read; per-thread shape with `threadId` |
| F | `frontend/src/shared/api/restProxy.js` (+ `fetchWebIndex`); `features/threads/hooks/useStoryLinks.js`; `features/threads/components/StoryMode.jsx` (FED INTO slide + BRIEF line + empty state), `ThreadPage.jsx` (read-in-full "Why" links); `features/map/components/{SituationMap3D,RadarMap}.jsx` + `features/map/SituationHome.jsx`; legend text | consume the index; draw arcs |
| G | `frontend/src/features/analysis-studio/lib/analysis.js` (becomes a thin wrapper over `analysisContext.js`); `scripts/check-shared-sync.mjs` (+ pair: the five copies) | refactor without behaviour change |
| H | `frontend/src/features/analysis-studio/{AnalysisStudio.jsx,components/{StudioRunResult,StudioDeck}.jsx}`, `frontend/src/app/App.jsx` (route `/analyze/s/:id`), `frontend/src/shared/api/restProxy.js` (share endpoint config check), `docs/config.js` (**Y5 only**) | share button, page, signed-out example |
| I | `docs/` (build output via `deploy.sh`, not hand-edited); `docs/sitemap.xml` untouched (`/analyze/s/*` is never listed) | deploy |

### Repo files: delete
None. (The legacy resolver logic is replaced inside `newsPredictionResolver/src/index.js`; the deployed zip is kept as the rollback. `predictions/review.js` stays as a legacy tool.)

### Live resources touched (by phase)
| Resource | Phases | Kind of change |
|---|---|---|
| Lambda `NewsProjectInvokeAgentLambda-dev` | A | code deploy (bare `update-function-code`); zip lists `questions.js` explicitly |
| Lambda `newsPredictionResolver` | B | code deploy; `update-function-configuration --timeout 600` (config only; env untouched); rule re-point |
| EventBridge rule `TriggerPredictionResolver` | B | `put-rule` `cron(30 10 * * ? *)`, `put-targets` input `{"action":"tick"}`, `enable-rule` (standing authorization) |
| DynamoDB `GlobalPerspectivePredictionLog` | A, B | new **record families** written by the Lambdas (no schema change): `PRED#…` rows gain fields (A); `SEED#<week>`, `SAMPLE#<week>`, `Q#<qid>`, `SETTLE#<week>` (B) |
| Lambda `newsPredictionsSnapshot` | C | code deploy |
| S3 `predictions/track_record.json` | C | additive `questions` block (same key, same writer) |
| Lambda `newsSensitiveData-dev` | C, E | code deploy ×2 (`prediction_snapshot`; `web_index`) |
| Lambda `newsFreshnessMonitor` | C | code deploy |
| Lambda `newsSystemsAnalysis` | E | code deploy (+ one manual run) |
| DynamoDB `SummarizeAndPredict` | E | new rows `THREAD#<id>/WEB` and `WEB#INDEX/LATEST` written by `newsSystemsAnalysis` (no TTL attribute: TTL is disabled, freshness is client-side) |
| Frontend / Pages | I | `./deploy.sh` (Y6) |
| **New:** table, IAM role, Lambda `newsSharedAnalysis`, Function URL, `docs/config.js` | G, H | **Y1–Y5, gated** |
| Cloudflare Worker | I | optional header only (Y7) |

---

## 1. Phase A: M2, each question carries its own `p` and a named source, frozen at issue

**Goal:** from the day this deploys, every forecast trigger that qualifies is a standalone binary question `{text, deadline, p, resolutionSource}`; the row is written once and never edited. **Live first** (before B–I), because questions issued before it are unscoreable forever.

**Resources:** `NewsProjectInvokeAgentLambda-dev` (`index.js` L21, L158, L491–555, L915–955; `lib.js` L85, L123, L173), `SummarizeAndPredict` (`TOPIC#…/PREDICTION` served content) and `GlobalPerspectivePredictionLog` (`PRED#<topicId>/<day>`), env `PREDICTION_MODEL=deepseek-v4-pro`, `GROK_MODEL=deepseek-flash` (existing, unchanged), no IAM, no schedule.

**Deployed vs repo:** identical (0.4). The repo is the base.

**Exact change:**
- **Prompt** (trigger object; scenarios stay as narrative and keep `probability_range`):
```json
{ "text": "single concrete event: who does what", "deadline": "YYYY-MM-DD",
  "p": 0,                       // integer 2-98: YOUR probability that THIS event happens by the deadline
  "resolution_source": "..." }  // the specific public record that will settle it
```
  New rules appended to `TRIGGER RULES`: each trigger is judged **alone** (its `p` is not the scenario's; a trigger under "Optimistic" may have p 70); **at most 3 triggers per scenario**; **prefer deadlines 14 to 84 days after today** (longer only for a dated scheduled event); `resolution_source` must name the publisher or record (for example "Reuters or AP wire report", "Official Gazette of Japan", "UN Security Council press release", "IAEA Board report"), **never** "news", "media", "reports" or "sources"; the event must be **checkable from that source after the deadline**. Rules G2–G6 text stays.
- **New gates in `questions.js`** (pure, after the existing G1–G6 in `validateTrigger`, so nothing about the old gates changes):
  - **G7 own probability:** integer 2–98 after rounding; missing or out of range → the trigger stays in the log as a **narrative trigger** (`question:false`, reason `no_p`), it is never sampled.
  - **G8 named source:** length ≥ 8, not in a deny list (`news`, `media`, `reports`, `sources`, `online`, `the internet`, `various`, `press`); else demoted (`generic_source`).
  - **G9 lead time:** `deadline` at least 7 days after the issue day; a shorter lead is **dropped** (counted in `capture.dropped`, gate `G9`).
  - **G10 already reported:** token Jaccard ≥ 0.6 between the trigger text and any source snippet or the title of the topic → **dropped** (`G10`, "criterion already met at issue").
  - **G11 certain formality:** `p ≥ 95` and the text matches a scheduled-formality pattern (`will hold its (regular|scheduled)`, `is scheduled to`, `as planned`) → demoted (`formality`).
  - **G12 near-duplicate:** Jaccard ≥ 0.7 against a question text of the same topic in the last 14 days (rows read once per topic into `genCtx`) → demoted (`near_duplicate`).
  - A metric only: `capture.pEcho` = share of triggers whose `p` equals their scenario midpoint ± 1 (so a "copy the scenario" collapse is visible).
- **Trigger record after M2** (frozen; the log's `attribute_not_exists(PK)` write stays):
```js
{ id:'0-1', qid:'<sha256(pk|sk|id) first 20 hex>', text, deadline, status:'pending',
  question:true, p:64, resolutionSource:'Reuters or AP wire report', resolver:'human' }
```
  Row-level: `questionSchema: 1`, `regions` (from `topic.regions`), `threadId` (via `assignThreadId(topic, ctx.pastEntries)`, wrapped in try/catch), `capture.questions = {kept, demoted:[{text, reason}]}`. `methodologyVersion` stays 1 (Q4). Old rows are untouched.
- **Max tokens:** `PREDICTION_MAX_TOKENS` default 1500 → 2500 (a trigger now carries two more fields; 3 scenarios × ≤ 3 triggers). Live env has no override (checked by key names). Estimated added cost: about +700 output and +250 input tokens per story on v4-pro, 20–30 stories a day, **about $0.07 a day**.
- **Served content:** the `TOPIC#…/PREDICTION` JSON now also carries `p` and `resolution_source` per trigger; existing readers (`PredictionDisplay.jsx` `normalizeTrigger`) ignore unknown keys.
- **Zip:** lists `index.js lib.js questions.js matcher.js entity-normalize.js url-normalize.js package.json node_modules` explicitly; after deploy compare deployed vs repo byte for byte.

**Tests:** `questions.test.js`: G7 (missing, 1, 99, "64%", 64.4), G8 deny list, G9 (6 vs 7 days), G10 (a trigger that restates a snippet), G11, G12, `qidFor` determinism and collision check over the real 3,478 rows' triggers (zero collisions), the **pre-M2 fixture** (real output shape from today's rows: every trigger demoted `no_p`, none dropped by G9–G12 beyond what G1–G6 already drop, row shape otherwise identical to today), the M2 fixture (a real-shaped model output). Existing `lib.test.js` must pass untouched.

**Verification now (no LLM, no writes, pre-approved):** `npm test`; replay of all 3,478 stored rows' triggers through the new gates offline (expect: 100% demoted `no_p`, dropped counts by G9/G10 reported); `aws lambda invoke … NewsProjectInvokeAgentLambda-dev {"dryRun":true}` before and after the deploy (plan only, no LLM). **Live (named, needs Q18a):** three forced single-story runs `{"topicId":"<id>","action":"prediction","force":true}` (each: research call + forecast call on v4-pro, about $0.01) on three different live stories: check `content` parses as JSON with `p` and `resolution_source` on ≥ 90% of triggers, no truncation, latency inside the 900 s Lambda budget. **Limitation, stated:** the log row for a story already forecast today is not rewritten (`attribute_not_exists`, "first of the day stands"), so the log rows are verified on the **next scheduled run**: read the new `PRED#` rows, check `questionSchema`, `qid`, `p`, `capture.questions`, and compare each row's stored `threadId` with the served topic's `threadId` (target: ≥ 95% equal; if lower, the cluster key moves to the archive join, which is Y-gated IAM, and we stop and ask).

**Rollback:** redeploy the saved zip (`8dZ6qH…`); rows already written stay valid (additive fields; no reader breaks). Abort trigger: JSON parse failures > 5% of stories in the first scheduled run (then revert and lower to 2 triggers per scenario, or raise the cap to 3000).

**Risk:** medium-low. Worst case is a truncated or malformed forecast for some stories (stored as raw text by the existing path, story pages fall back to no forecast). Mitigated by the 3-story live check and the token headroom. Second risk: LLM `p` values cluster (60/20/20); the `pEcho` metric makes it visible and calibration will say so honestly once resolved; it is not a reason to hide the numbers.

**"Not ready yet" copy and when it goes away:** the pages show questions only from this deploy date on (§4). Nothing new on the site until D deploys.

**Operator time:** 0.

---

## 2. Phase B: M3, weekly pre-registered sample, agent draft, operator confirm

**Goal:** a verifiable weekly draw, a drafted verdict for each due sampled question, and the smallest possible operator step to confirm it.

**Resources:** `newsPredictionResolver` (replaced), `GlobalPerspectivePredictionLog` (new record families below), Brave via the existing `BRAVE_SEARCH_API_KEY`, DeepSeek via `XAI_API_KEY` / `GROK_API_URL` / `GROK_MODEL` (existing), rule `TriggerPredictionResolver`, `predictions/settle-review.js` (operator's AWS CLI). Role `newsPredictionResolver-role` already allows everything needed (0.1). Timeout 300 → 600 s (config only).

**Deployed vs repo:** comment and dead fallback string only (0.4); replaced wholesale; deployed zip saved for rollback.

**Record families** (all in `GlobalPerspectivePredictionLog`, key `PK`/`SK` strings; **none has `methodologyVersion`**, so `computeTrackRecord`'s v1 filter and `resolve-v1-*.js` ignore them; every write is a conditional put `attribute_not_exists(PK) AND attribute_not_exists(SK)`, i.e. immutable):
| PK / SK | Fields | Written by | Public? |
|---|---|---|---|
| `SEED#2026-W41` / `COMMIT` | `weekId`, `weekStart`, `weekEnd`, `commitHash` (SHA-256 of the seed), `rule:'v1'`, `committedAt` | tick, **before the week starts** (steady state: always two weeks ahead; bootstrap: `W0` is committed the day the tick is first enabled, before Monday) | yes (aggregate) |
| `SEED#…` / `SECRET` | `seedHex` (32 random bytes) | tick, same time | **never** (not projected anywhere) |
| `SEED#…` / `REVEAL` | `seedHex`, `revealedAt` | draw, after the week closes | yes |
| `SAMPLE#…` / `DRAW` | `weekId`, `K`, `eligible`, `clusters`, `picked:[{qid, h, clusterKey}]`, `drawnAt` | draw | yes |
| `Q#<qid>` / `SAMPLED` | `weekId`, `pk`, `sk`, `triggerId`, **denormalised** `question`, `deadline`, `resolutionSource`, `storyTitle`, `issuedAt`; **no `p`** | draw | yes (except nothing secret) |
| `Q#<qid>` / `DRAFT#<iso>` | `verdict` (`yes`/`no`/`void`/`not_yet`/`needs_human`), `quote`, `url`, `queries[]`, `model`, `at`; **never `p`** | draft | no (operator only) |
| `Q#<qid>` / `VERDICT` | `verdict` (`yes`/`no`/`void`), `voidReason?`, `decidedAt`, `decidedBy:'operator'`, `draftRef`, `evidence:{url, quote}` | operator CLI | yes (aggregate) |
| `SETTLE#2026-W41` / `TICK#<iso>` and `REVIEW#<iso>` | counts and timestamps (heartbeat, review minutes if given) | tick / CLI | yes (settling log) |
A correction is a new row `VERDICT#2` (latest wins, all shown), never an overwrite.

**Exact change:**
- **Weeks:** ISO weeks, Monday 00:00 UTC to Sunday 23:59 UTC (`lib.weekOf(iso)`, `weekStart`, `weekEnd`).
- **Tick** (`{"action":"tick"}`, daily 10:30 UTC, idempotent, no LLM): (1) ensure `COMMIT`+`SECRET` rows exist for the next **two** weeks (bootstrap: the first run commits `W0` = the next Monday and `W0+1`; every question issued **before `W0` starts is "warm-up": logged with its `p`, never sampled**, said on the page); (2) for every ended week with no `DRAW` row and a `COMMIT`: reveal + draw; (3) on Mondays run the draft pass; (4) write a `SETTLE#…/TICK#…` heartbeat. A missed Monday is repaired by Tuesday's tick; the alarm (C) is the backstop.
- **Draw** (`lib.draw(seedHex, questions, K=22)`): eligible = `question:true`, `issuedAt` in the week, lead 7–84 days (Q3), not already sampled; per question `h = sha256(seedHex + '|' + qid)` (hex, compared as strings); **per story keep only the lowest `h`** (`clusterKey` = row `threadId` or `topicId`); sort the survivors by `h`; take the first `K` (fewer if fewer stories: **never padded**). Writes `DRAW` and one `Q#…/SAMPLED` row per pick. `predictions/verify-draw.mjs` recomputes it from the public aggregate.
- **Draft pass** (`{"action":"draft","limit":N,"dryRun":bool}`): for each sampled question with `deadline ≤ today` and no `VERDICT`: (1) 2 Brave searches built from the question text and `resolutionSource` (news then web, existing `search.js` logic); (2) a DeepSeek `deepseek-v4-pro` call with the question, deadline, issue day, source and the results only; **the prompt never contains `p` or any scenario probability**; (3) output `{verdict:'yes'|'no'|'void'|'not_yet', quote, url, why}`; (4) **validation:** `quote` must occur (case-insensitive) in the cited result's title or snippet, `url` must be one of the results; else `needs_human`; a `yes` gets a **second independent call** with a different query set and is downgraded to `needs_human` if the two disagree (the V1 runbook rule); `no` is only allowed when `today ≥ deadline + 3 days` ("NO only after the deadline plus 3 days"), otherwise `not_yet`. Writes `DRAFT#`. Estimated cost per question about $0.005 (v4-pro) → about $0.13 a week at 22 questions.
- **Void reasons** (enum, published): `ambiguous_criterion`, `source_unavailable`, `event_moot`, `duplicate`, `criterion_met_at_issue`. Void rate above 15% is shown as "fix the questions" on the page, per the ruling.
- **Operator CLI** `predictions/settle-review.js` (node, `aws` CLI, no dependencies, like `review.js`): `--list` (what is due and drafted), then per question it prints the **question, deadline, named source, the draft verdict, the quoted passage and the URL** and asks `[y] accept draft  [n] override (yes/no/void + reason)  [o] open URL  [s] skip  [q] quit`. It reads only the `Q#…/SAMPLED` and `DRAFT#` rows, so it **cannot show `p`**. `y` and `n` write the immutable `VERDICT` row; a session summary row is written to `SETTLE#…/REVIEW#`. `--dry-run` prints without writing.
- **Schedule:** `aws events put-rule --name TriggerPredictionResolver --schedule-expression "cron(30 10 * * ? *)"`, `put-targets` with input `{"action":"tick"}`, `enable-rule` (three bare commands; the rule is DISABLED today; 10:30 is outside DeepSeek's peak window).
- **Retired legacy resolver:** the proposer code, its 40/day cap and the `open`-status scan are gone; the 122 pilot verdicts and the ~20k unscored triggers stay as they are.

**Tests:** `weeks.test.js` (ISO weeks across year boundaries, Monday/Sunday edges, commit-ahead rule, bootstrap `W0`); `sample.test.js` (determinism, one per cluster, K cap, fewer-than-K, ties, a reordered input gives the same draw, a mutated seed gives a different draw, the pre-registration check `sha256(seed) === commitHash`); `draft.test.js` (quote-in-result rule, `no` before deadline+3 becomes `not_yet`, yes needs two agreeing passes, `p` never appears in any prompt string: grep test on the built prompt); `store.test.js` (conditional-put immutability with a fake client, `VERDICT#2` correction). **Golden test:** run the draw on a fixture of 600 questions and compare with an independent 20-line implementation in the test file.

**Verification now (no LLM, no writes, pre-approved):** `npm test`; `{"action":"status"}` and `{"action":"tick","dryRun":true}` invoked after deploy (prints what it would commit and draw; writes nothing); `node predictions/settle-review.js --list --dry-run`. **Live (named, Q18b):** the draft pass replayed **dry-run on 10 archived July-pilot triggers** with known agent-verified verdicts (about 10 × 2 Brave searches and 10–15 v4-pro calls, about $0.06): report agreement, the share of `needs_human`, and any quote that fails validation. **First real writes** (`tick` real run) happen at the first scheduled 10:30 UTC run after the rule is enabled; before enabling, the operator says go (it starts the public commitments, which cannot be un-published).

**Rollback:** `aws events disable-rule`; redeploy the saved resolver zip (`ezB+B2…`) if the code itself must revert. Written `SEED#`/`SAMPLE#` rows are immutable **by design** (not deleted); if a wrong commit is ever published it is superseded by a documented `rule:'v2'` week, not erased.

**Risk:** medium. The commitment is a public promise: a bug in `draw` after a seed is committed cannot be fixed silently. Mitigations: the golden test, the dry-run, and one manual `draw` dry-run against the first real week before its close. Second risk: drafter hallucination; mitigated by the quote-in-result rule, the second pass, and the fact that **nothing is public until the operator confirms**.

**"Not ready yet" copy:** §4. **Operator's weekly time:** the CLI shows only what is due. Ramp: week 1–2 nothing is due (minimum lead 7 days, median 61); then 3–10 a week while the first samples mature; **steady state about 22 a week, about 2–3 minutes each, about 1 hour** (matching the ruling). A skipped week is not lost: the questions stay due and the alarm speaks after 10 days (Q19: do the first Monday together).

---

## 3. Phase C: M3, aggregate, scoring math, dead-man's alarm; `prediction_snapshot` gains `p`

**Goal:** the public object carries everything the page needs (real weeks, sampled questions with deadlines, verdicts, VOIDs, Brier and skill when honest), and a silent miss becomes an SNS alert.

**Resources:** `newsPredictionsSnapshot` (rate 30 min; its role can only `Scan` the log, which is all it needs), S3 `predictions/track_record.json`, proxy `prediction_snapshot` and `prediction_track_record` (pass-through), `newsFreshnessMonitor`, SNS `GlobalPerspectiveAlerts`.

**Deployed vs repo:** identical (0.4).

**Exact change:**
- **Aggregator input** grows the scan projection with `PK, SK, recordType-free attributes` (the new families are recognised by `PK` prefix `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#`); `questionBoard.js` builds `data.questions`:
```js
questions: {
  schema: 1, builtAt,
  method: { K:22, leadDays:[7,84], rule:'v1', graceDays:3 },
  firstIssuedAt, firstCommit:{ weekId, committedAt }, firstDrawWeek,
  issued, sampledTotal, warmUp,                       // counts, all real
  weeks:[{ weekId, weekStart, commit:{hash,committedAt}, reveal:{seedHex,revealedAt}|null,
           drawn:bool, eligible, clusters, picked, due, settled, void }],
  sampled:[{ qid, weekId, storyTitle, question, resolutionSource, p, deadline, issuedAt,
             state:'awaiting'|'past_deadline_unchecked'|'yes'|'no'|'void',
             verdict?:{ decidedAt, url, quote }, voidReason? }],   // last 26 weeks; older summarised
  counts:{ locked, resolved, yes, no, void, awaiting, pastDeadlineUnchecked },
  scoring: null | { n, brier, baseRate, brierRef, skill, ci:{lo,hi,method,resamples,seed},
                    voidRate, reliability:[{bin,n,meanP,rate}] },
  settleHealth:{ expectedDrawWeek, drawMissed, commitMissing, lastVerdictAt,
                 dueUnsettled, oldestDueUnsettledDays }
}
```
  `p` is public for sampled questions (it is frozen and was public on WATCH from issue).
- **Scoring (`scoring.js`, pure, no AWS):** `brier = mean((p/100 − outcome)²)` over `yes`/`no` only; `baseRate = mean(outcome)`; `brierRef = baseRate·(1 − baseRate)`; `skill = 1 − brier/brierRef`; **cluster bootstrap by story** (resample stories with replacement, 2,000 resamples, a fixed seed derived from `n` so the number does not jitter every 30 minutes) for the 95% CI of the skill; reliability in 10-point bins, a bin returned only when `n ≥ 20`; `voidRate = void / (resolved + void)`. **`scoring` is `null` until 150 resolved (Stage 2)**; below that the aggregate carries counts only, so a page bug cannot show a score. "Better than the base rate" is a client string allowed only when the CI excludes 0.
- **`trackRecord.js` legacy block:** skip `t.question === true` triggers, so `resolvedTriggers`, `brierScore`, `recent` and `calibration` keep describing the archived pilot exactly as today (the old page and cached tabs keep working).
- **Proxy `prediction_snapshot`** returns per trigger `{qid, p, source, question, sampled, state, verdict}`; it reads `Q#<qid>/SAMPLED` and `/VERDICT` by `BatchGetItem` (≤ 20 keys per call, the proxy role has full DynamoDB access); accepts `threadId` (resolved through the existing `readNarrativeThread` to topic ids) so briefings can ask by story. Legacy triggers (no `qid`) are returned exactly as today. **No `!user` guard** (public data hook rule).
- **Alarm** (`settleCheck.js`, called first in the monitor's handler, own try/catch, never blocks the freshness check): GET `PROXY_URL?action=prediction_track_record`; alert when `settleHealth.drawMissed` **or** `commitMissing` **or** (`dueUnsettled > 0` **and** `oldestDueUnsettledDays > 10`) **or** the block is missing more than 14 days after `firstCommit`; **once a day** (only the 12:30 UTC run of the `cron(30 0/2)` schedule sends); subject `[GP] Prediction settling overdue`, body with the week, counts and the exact command to run. The monitor currently repeats every 2 h; this one does not.

**Tests:** `questionBoard.test.mjs` (a fixture with 2 weeks, 3 due, 1 void, a missed draw); `scoring.test.mjs` (hand-computed Brier / skill on 6 questions; bootstrap determinism; `scoring` null at 149, present at 150; a bin under 20 is omitted; all-yes and all-no base rates do not divide by zero); an old-shape fixture (the 122 pilot) yields the **same legacy fields as today** (snapshot test against the live `tr.json` copy); `settleCheck.test.js` (each alarm condition, the once-a-day gate, silent on a healthy fixture).

**Verification now (no LLM, no writes, pre-approved):** `npm test` in the three Lambdas; run the new aggregator **locally against the live scan** (read-only) and diff the legacy fields against the live `track_record.json` (must be identical); after deploy, invoke `newsPredictionsSnapshot` once (it writes only its own S3 key; standing) and `curl` the public action: `data.questions` present with zero counts before B has run; `{"action":"tick","dryRun":true}` unaffected. Alarm: invoke `newsFreshnessMonitor` with a test event carrying a fake `settleHealth` only if the monitor supports it; otherwise verified by unit tests, and the first live check is the 12:30 UTC run (silent expected).

**Rollback:** redeploy saved zips (`cNikHn…`, `z0bVMR…`, `esLTQ…`); the extra S3 block is ignored by the old page; the alarm simply disappears.

**Risk:** low-medium. The scan projection change raises read volume slightly (the new families are a few hundred rows). The single behavioural risk is publishing a score too early; guarded by the server-side `null` below 150.

**"Not ready yet" copy:** §4 (the block is what lets the page compute it). **Operator time:** 0.

---

## 4. Phase D: M4, what the reader sees (frontend; built now, deployed only at I)

**Goal:** the pages show the truth about scoring at every stage, including "not ready yet", computed from real dates.

**Resources:** files in "Changes (code)"; data from `prediction_track_record` (`data.questions`) and `prediction_snapshot`; no new endpoint.

**Exact change:**
- **`stageWording.js`** takes the `questions` block (not the 30-item `recent` sample): **Stage 0** when there is no `firstCommit` (the current copy stays for that state, with the pilot detail); **Stage 1** as soon as a commitment exists (ruling: "Since <date> we lock a pre-selected sample each week — probability, rule and deadline fixed at publication. N resolved, V voided — too few to judge accuracy"); **Stage 2** at ≥ 150 resolved; **Stage 3** at ≥ 400 **and** ≥ 6 months since the first draw. Every number and date comes from the block.
- **`accuracyEstimate.js`** (pure): `estimateAccuracyWindow({ sampled, weeks, target, now, plannedK })` returns `{ earliest, latest, basis }`. It simulates forward: the real deadlines of the questions already locked, plus future weekly draws at the **observed** average sample size (or the published `K` while fewer than 2 weeks are drawn), with deadlines spread like the observed lead times of eligible questions (the published 7–84 window if fewer than 10 are observed), settled at the first Monday ≥ deadline + 3 days; `earliest` assumes 0% voids, `latest` 25%. It returns `null` (and the page says nothing) if there is nothing to base it on. Output is always rendered with the word "estimate".
- **Accuracy panel:** locked bar (`n of 150`) as today plus the copy in the table below; after 150, the score with `95% CI`, the base-rate guess beside it, and "better than a base-rate guess" only if the CI excludes 0.
- **Seed row** (`DrawRow.jsx`): "This week's draw: commitment `abcd…1234` published <date>; the seed is revealed <date> after the week closes; next commitment <date>" plus **Verify this draw** (Q9: SHA-256 of the revealed seed in the browser, and the ranked list from `sampleRule.js`, a guarded copy of the Lambda rule).
- **Settling log:** one square per real week from `weeks[]`: **grey "before the sampled method"**, **grey "drawn, nothing due"**, **green** (due and all confirmed), **amber** (some), **red "N due, none confirmed"**. Today's log (every week since 4 Jul red) is replaced; the pilot's one settled week stays as a labelled square.
- **Board:** `ForecastBoard` items come from `sampled` (glyphs ✓ happened, ✗ didn't, ▢ awaiting, ◌ void, and **"past deadline, not checked"** from `pastDeadline.js`, now computable because `sampled[].deadline` is served). Place mapping stays the text-match rule (never a country score, never a guess). Right panel: question, frozen `%`, named source, verdict with quote and link, and the wording "drafted by an agent that was not shown the probability, confirmed by the operator's review tool that does not show it".
- **Own-% chip** (`QuestionChip`): `64% · source: Reuters or AP · awaiting · by 15 Nov`. Used in `WatchSlide`, `ThreadForecast`, the country card's two future triggers (`futureDatedTriggers` keeps its rule, the row gains the chip) and the briefing story slide (a one-line "Next dated question" from `prediction_snapshot({threadId})`, only when the story has a `threadId` and a question). A trigger **without** `p` shows nothing extra and the slide carries one honest line: "Forecasts made before <first question issued date> have no probability of their own, so they are not scored." (date from `questions.firstIssuedAt`; if absent, "made before per-question probabilities began").
- **`TrackRecordText.jsx`** gets the same facts as plain text.

**"Not ready yet" copy (single file `notReadyCopy.js`; every date is computed, every estimate says "estimate"):**
| State (data) | Copy | Goes away when |
|---|---|---|
| No `questions.issued` | "Per-question forecasts have not started yet. When they do, each question will show its own probability and its named source, locked at publication." (no date: none exists) | the first question is issued |
| Issued but no commit yet (only if B is late) | "Questions are being logged since <firstIssuedAt>. The first weekly sample is committed on <next Monday − 7 d rule date>; questions logged before <first week start> are warm-up and are not scored." | the first commit exists |
| Commit exists, week open | "This week's sample is locked but not drawn. Commitment `…` published <date>. The week ends <date>; the draw of up to 22 questions (one per story) is published on <Monday>." | the draw is published |
| First results | "First results: the first locked questions reach their deadlines from <min deadline>; the first verdicts are confirmed the week of <that Monday>." | the first verdict exists |
| Accuracy locked | "Accuracy score: not ready yet. It appears after 150 questions are resolved (now <n>, void <v>, awaiting <a>). Expected between <earliest> and <latest> (estimate, based on <k> locked questions and about <w> new ones a week; it moves as real results arrive)." | 150 resolved |
| Calibration bands | "Calibration by probability band: not ready yet. Shown when a band has 20 resolved questions; expected after about <date at 400 resolved> (estimate)." | Stage 3 |
| Board with nothing resolved | "<n> questions locked, none resolved yet. The first deadline is <date> (<d> days)." | first resolution |
| Settling log week, nothing due | "Week of <date>: nothing due" (grey, not red) | never (it is a fact) |
| Draw fewer than 22 | "Only <n> stories had an eligible question this week, so the sample is <n>; it is never padded." | never |

**Tests:** `stageWordingV2` (each stage boundary, 149/150, 399/400 with and without 6 months); `accuracyEstimate` (the illustrative arithmetic in 0.1 reproduced: W0 2026-10-05, K 22 → 2027-01-11 and 2027-01-25; null on no data; monotone in K and void rate); `questionStates` (past deadline is never "awaiting" and never "missed"); `settlingLogV2` (grey vs red logic on a fixture); `sampleRule` parity with the Lambda (guarded byte copy + a golden draw); `notReadyCopy` (every state renders a date only when the input has it: a fixture without dates yields no date string); `trackRecordNotReady.test.jsx` render tests for each state; `questionChips` (chip absent without `p`; the pre-M2 note appears once). The existing capture tests are updated, not deleted.

**Verification now:** `npm run verify` (baseline 99 files / 747+ tests), `bash quality/verify_pages.sh`, `node scripts/check-shared-sync.mjs`. **UI (required by CLAUDE.md):** exercise every touched control in a browser against the live data before calling it done: `/track-record` (each state as far as live data reaches; the others via fixtures in a local dev server), MAP / BOARD toggle, click a place, the panel, the Verify control, `/track-record/text`, a story page WATCH slide and long-page forecast, a country card, `/briefings`, at 1280 px and 390 px. If a browser cannot be run, say so.

**Rollback:** the frontend is not deployed until I; before that nothing is live. After I, the previous bundle is redeployed with `deploy.sh` from the prior commit. **Risk:** medium (many surfaces): the state vocabulary lives in one module and one copy file to keep the wording consistent. **Operator time:** 0.

---

## 5. Phase E: story web stage 2 (backend)

**Goal:** the web behind FED INTO is built from what the model can actually see, is measured, and is one cheap read.

**Resources:** `newsSystemsAnalysis` (daily `TriggerNewsSystemsAnalysis` 05:00 UTC, v4-pro, `SYSTEMS_TOP_N=10`, `MAX_TOKENS=6000`, 300 s), `SummarizeAndPredict` (`SYSTEMS#<place>/SYSTEMS_ANALYSIS` kept; new `THREAD#<id>/WEB`, `WEB#INDEX/LATEST`), proxy `web_index`. No env, no IAM, no schedule change.

**Deployed vs repo:** identical (0.4).

**Exact change:**
- **Prompt (`spreadEntries.js`):** for each story keep its dated entries (already in `country.entries`), sort by date, and select **up to 10 spread across the span**: always the oldest and the newest, the rest at even index steps; each is listed as `date | topicId | title (≤ 110 chars)`. The `topicIds: [first 5]` line is replaced by that list. Estimated input growth: 15 stories × 10 lines × ~35 tokens ≈ 5,000 tokens per country, ten countries ≈ 50,000 input tokens a day on v4-pro ≈ **$0.07 a day** (off-peak half if moved later); output stays capped at 6,000.
- **Grounded cites:** `validateGraph` accepts a `citedEntries` id **only if it was shown** in the prompt; each surviving edge stores `cited:[{topicId, date, title}]` so a reader sees the evidence without another fetch. The confidence downgrade rules and the per-node cap stay.
- **Per-story record `THREAD#<id>/WEB`** (`webRecords.js`, pure): merges every web the story appears in: `{threadId, generatedAt, into:[link], from:[link], shared:[{other, actors, weight, country}], analysedIn:[{country, generatedAt, nodes}], places:[{name, n}] (real countries from its entries, for the map rule)}` with `link = {other, title, confidence, lagDays, mechanism, cited[], country, generatedAt}`. Each web keeps its **own confidence** (never the max, per the ruling). No `ttl` attribute (table TTL is disabled; freshness is computed by readers: amber 7 d, hidden 30 d).
- **Index `WEB#INDEX/LATEST`:** built from **all** `SYSTEMS#` rows after the run (real countries only via `placeFilter`, so the four stale region rows and old rows are handled by date, not by luck): `{generatedAt, links:[…], threads:{id:{state, title, places, analysedIn}}, coverage}`. `state` ∈ `linked`, `analysed_no_links`, `single_update`, `country_not_analysed`, `not_in_scope`.
- **Coverage measure** (logged and stored): `threadsInScope` (distinct threads in the last 14 days of archive rows), `eligible` (≥ 2 entries), `inAnyWeb`, `withLink`, `pctOfAll`, `pctOfEligible`, `byState`. **Baseline (2026-09-30, 120 stories over the 6 archive days present): 24% of all, 49% of eligible, 14% linked; today's 28 stories: 0%, all single-update.**
- **Proxy `web_index`** (public, no auth guard): `{}` → the index (client cache 30 min, like the other reads); `{threadId}` → that story's `THREAD#…/WEB` plus its `state`, or `{state, reason}` when it has none (the reason lets the page explain why). Reads one item.
- **Event override** `{"countries":["Japan"],"dryRun":true}` on the handler (today only the env `SYSTEMS_TEST_COUNTRIES` can narrow a run, and changing env is a gated dance); `dryRun` returns the prompt size, the selected entries and the would-be records with no LLM.
- **Timeout:** stays 300 s at 10 countries (123 s measured before the larger prompt; expect about 150–170 s). If Q10 later raises `SYSTEMS_TOP_N` to 15, raise the timeout to 600 s in the same command batch.

**Tests:** `spreadEntries` (n < 10 keeps all; n = 30 keeps 10 with both ends; dates strictly ascending; deterministic); `webRecords` (merge of two webs keeps two confidences; an edge whose cite was not shown is dropped; `shared` ambient rule untouched); `coverage` (a fixture reproducing today's 120 / 59 / 29 / 17); `webIndex.test.js` in the proxy (index shape, per-thread shape, `single_update` reason, unknown thread).

**Verification now (no LLM, no writes, pre-approved):** `npm test`; local run of the coverage function over the live rows (read-only) must reproduce the baseline above; `aws lambda invoke … newsSystemsAnalysis {"dryRun":true}` before/after (targets, excluded regions, prompt size, no LLM). **Live (named, Q18c):** one country `{"countries":["Iran"]}` about $0.02: compare its edges' cited titles with the entries; then **one full manual run about $0.25** (10 countries) and read back `WEB#INDEX/LATEST`: report coverage before/after and the number of links whose cites carry titles. Never over a scheduled run's time (05:00 UTC chain: story analysis 04:40 → web 05:00 → countries 05:15 → drift 05:30).

**Rollback:** redeploy the saved zip (`AgzPG…`); the new rows are additive and unread by the old frontend; delete nothing.

**Risk:** low-medium: prompt growth could raise the malformed-JSON rate (the existing `validateGraph` and the retry-free path drop bad edges, never write nonsense). Watch `Raw: n nodes, m edges → Valid: …` log lines against the last run's (10 countries, 57 causal edges).

**"Not ready yet" copy (story pages; a reason is chosen from `state`, never guessed):**
| `state` | Copy | Goes away when |
|---|---|---|
| `linked` | (the links) with "From analyses of <countries> · as of <date>" | — |
| `analysed_no_links` | "No linked stories found yet for this story. It was checked on <date> together with <n> other stories in <country>; none met our evidence bar (a named mechanism and at least one cited news item)." | a later run finds a link |
| `single_update` | "No linked stories found yet for this story. It has one update so far; stories are checked for links once they have two or more." | the story's second update, then the next run |
| `country_not_analysed` | "No linked stories found yet for this story. Story links are built for the <N> most-covered countries in each run; <country> was not among them last time." (N = the run's real target count from the index) | it is among them |
| `not_in_scope` / no index | "Story links have not been refreshed since <date>." (date from the index) | the next successful run |
| every empty state | second line: "Links are refreshed by a daily job. Last refresh: <date>. A new link can only appear after the next one." | — |
(No hour or schedule is asserted: the copy states the real last-refresh date only.)

**Operator time:** 0.

---

## 6. Phase F: story web frontend and map lines

**Goal:** FED INTO and the long page read the index; linked stories are drawn as lines on the map; every empty state explains itself.

**Exact change:**
- `useStoryLinks(threadId, regions)` calls `fetchWebIndex({threadId})` (one call; the 3-region fan-out is removed) and falls back to the current fan-out only when the action is unavailable (proxy older than the frontend). `deriveFedInto`/`deriveFedFrom` semantics are unchanged (freshness amber 7 d, hidden 30 d, per-web confidence). FED INTO rows now show the **cited dated headlines** stored on the link.
- **Empty states** exactly as §5's table, on the BRIEF slide (S6: the FED INTO slide is still skipped when there are no links, and BRIEF carries "not linked in current analyses" plus the reason line).
- **Map lines** (`storyLinkArcs.js`): from the story's main country to the linked story's **most-mentioned non-focal country** (`places[]`); strong and medium only (weak stay list-only); a linked story with no real country gets no line (broad regions are never points, per H2). Drawn as a `linkArcs` prop on `SituationMap3D` (existing `ArcLayer`, dashed per the legend) and `RadarMap` (SVG dashes); the legend gains "dashed line: a story judged to feed into another (approx. place)". On the home map they appear only when a story is selected (S8).
- No change to `/spider-demo`, the board WEB view or the country page (out of scope; unchanged).

**Tests:** `webIndexLinks` (freshness, per-web confidence, the empty-state reason mapping), `linkStates`, `storyLinkArcs` (no arc for regions, weak filtered, approx flag), a StoryMode render test per state, a map-prop render test. **Verification now:** `npm run verify`; browser: open a linked story (Iran or the US), a single-update story (any of today's), an analysed-no-links story if one exists; click every FED INTO row, the arcs on globe and radar, the phone layout at 390 px. **Rollback:** not deployed until I. **Risk:** low-medium (`SituationMap3D` is a large file: arcs go in as one added layer). **"Not ready yet":** §5 table. **Operator time:** 0.

---

## 7. Phase G: Studio share, backend (code and tests now; STOP at the gates)

**Goal:** the Lambda exists as tested source in the repo; nothing in AWS is created until the operator says yes to Y1–Y4.

**Resources (proposed, not created):** Lambda `newsSharedAnalysis` (nodejs22, ESM, 256 MB, 15 s), role `newsSharedAnalysis-role`, table `GlobalPerspectiveShares` (Q13), Function URL, env names `SHARES_TABLE`, `FIREBASE_PROJECT_ID`, `PROXY_URL`, `CORS_ORIGINS` (defaults to the newsAnalyze allow-list), `DAILY_SHARE_CAP` (default 20). **No secret is needed** (the JWT check uses Google's public certs; the proxy actions are public).

**Deployed vs repo:** not applicable (new). `newsAnalyze` is only **read** for its pattern.

**Exact change (repo, safe to do without a yes):**
- **API** (one Function URL, CORS emitted in code, `Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS`, `X-Robots-Tag: noindex` on every share response, `Cache-Control: no-store` on POST/DELETE, `private, max-age=60` on GET):
  - `POST /` (JWT required, any signed-in user, BYOK users included): body `{lens, topicIds, sourceKeys:[{n, topicId}], sections:[{lensId, prose, struct, webSources}], run:{provider, model, runAt}}`. The server: (1) verifies the Firebase JWT (the `newsAnalyze` pattern, copied); (2) **refuses** if the body exceeds 32 KB of prose in total, more than 8 stories or 4 sections, or any `webSources[].url` that is not `http:`/`https:` (parsed with `new URL`, credentials stripped, `javascript:`/`data:` rejected); (3) checks the **daily cap** with a `Query` on the owner GSI (`Select COUNT`, `createdAt ≥ UTC midnight`); over 20 → 429 `daily_limit`; (4) **re-fetches and freezes our sources itself** via the shared `analysisContext.js` (public proxy actions), then requires the numbering to equal `sourceKeys` (else 409 `sources_changed`: "re-run to share"); (5) **re-runs the checks** (`validateAnalysis`, `extractStruct`/`validateStruct`, `directionCheck`) on the server-built context and **refuses on any `error`** (422 `checks_failed`, listing the reasons); (6) generates a 128-bit random id (`crypto.randomBytes(16)`, base64url), writes the row with `attribute_not_exists(id)`, returns `{id, url}`.
  - `GET /?id=…` (public): returns the frozen doc (no `uid`), 404 `not_found` for unknown ids. Constant-time-ish: no enumeration hints, ids are unguessable.
  - `DELETE /?id=…` (JWT): deletes only if `uid` equals the caller (conditional delete); 204.
- **Stored item:** `{id, uid, createdAt, runAt, sourcesFrozenAt, lens, sections, sources[{n, kind, title, outlet, date, snippet, url?}], webSources[reader-supplied], checks{hasError:false, warnings[], validatedAt}, run{provider, model} (labelled "as reported by the reader's client"), schema:1, bytes}` ≤ 100 KB in practice (DynamoDB item limit 400 KB).
- **Prose safety:** prose is rendered by `Markdown.jsx` (React text nodes, no raw HTML, links only from the `[Wn]` map); the server additionally strips control characters and rejects any prose containing `<script` or `javascript:` after normalisation (defence in depth; a rejected share is a 422, not a silent edit).
- **Code sharing:** `analysisValidator.js`, `analysisStruct.js`, `webCitations.js`, `directionCheck.js`, `analysisContext.js` are **byte-identical copies** of the frontend files (no imports inside the first four; `analysisContext.js` takes fetchers), guarded by a new `check-shared-sync.mjs` pair (with a self-test that proves it can fail). `analysis.js` is refactored to call the pure `analysisContext.js` with the `restProxy` fetchers, with a **parity test**: the same fixture through the browser wrapper and the Lambda's fetchers must give byte-identical context text.
- **`scripts/share-admin.mjs`:** `--uid <uid> --list`, `--uid <uid> --delete` (`--commit` required), for the manual "Delete my account" email process (Account.jsx L182).
- **After the gates, the execution (each a bare command, one at a time, only after its Y):** Y1 `aws dynamodb create-table …` (PAY_PER_REQUEST, PK `id` S, GSI `uid-createdAt-index` uid S / createdAt S); Y2 `aws iam create-role` + `put-role-policy` (logs; `dynamodb:GetItem,PutItem,DeleteItem` on the table, `dynamodb:Query` on the GSI; nothing else); Y3 `aws lambda create-function` from the built zip (the Lambda lists its files explicitly, verified with `unzip -l`); Y4 `aws lambda create-function-url-config --auth-type NONE` with **no `--cors`**, plus the `add-permission` for public invoke (the same shape `newsAnalyze` has; check by reading its policy first); then `grep Access-Control-Allow-Origin` in the source to confirm CORS is emitted in code; Y5 the operator's `docs/config.js` edit. Record the exception in `DATA_STRATEGY.md` §2 and add ARCHITECTURE §38.

**Tests (all local, no AWS):** `auth.test.js` (valid token, wrong `aud`, wrong `iss`, expired, unknown `kid`, malformed); `cors.test.js` (allow-listed origin echoed, unknown origin gets the first allowed, OPTIONS 204, methods list); `urls.test.js` (`javascript:`, `data:`, `file:`, `//host`, userinfo, `HTTP://` upper case, overlong); `limits.test.js` (32 KB boundary in bytes not characters, section and story caps, the 20/day cap with a fake `Query`); `freeze.test.js` (source numbering equals `sourceKeys`, mismatch → 409, snippets clipped); `handler.test.js` (happy path with a fake DynamoDB and fake proxy fetch; check errors refuse; delete by non-owner refused; GET never returns `uid`); the byte-copy guard test.

**Verification now (no AWS, no LLM):** `npm test`, `node scripts/check-shared-sync.mjs --self-test`, `npm run verify` (the refactor must leave the Studio behaving identically: `analysisStudioScreens.capture` and the existing Studio tests unchanged). **After Y1–Y4 (each with its own yes):** `curl` OPTIONS from an allowed and a disallowed origin; `POST` without a token → 401; `GET` an unknown id → 404 with `X-Robots-Tag`; a real share is made in H by the operator (Y8).

**Rollback:** delete the Function URL and the Lambda; the table is kept or deleted **only on a separate destructive yes**. Nothing else depends on it (the frontend hides the share UI while the endpoint is unset).

**Risk:** medium: a new public endpoint that stores user content under our domain. The controls are the JWT, the server-side re-fetch and re-check, the URL scheme filter, the caps, the noindex headers and the owner delete; residual risk is a reader sharing their own opinions, which the page labels "written by a reader with their own key, from our frozen sources". **Operator time:** the yes-gates; account-deletion requests use `share-admin.mjs` (about 1 minute each).

---

## 8. Phase H: Studio share, frontend

**Goal:** share only what passed its checks; a clean read-only page; an honest signed-out example state.

**Exact change:**
- **`shareConfigured()`** (mirrors `analyzeConfigured()`): the share button and the route content depend on `window.NEWS_SHARE_ENDPOINT`. While it is unset the button is not rendered and `/analyze/s/:id` says: "Shared analyses are not available yet." (a real state, not a placeholder).
- **Share button** in `StudioRunResult` / the deck status strip (S5's rule: `shareable = !hasError`; the button is absent, not disabled-and-mysterious, on a failed run, which already says "not shareable"): clicking builds the payload (`sharePayload.js`), calls `POST`, shows the link with **Copy**, **Open**, **Delete**; the id list is kept in `localStorage` in try/catch as "Your shared analyses on this browser" (browser-only, not a library). Errors are named in words: 429 "You've reached today's limit of 20 shared analyses", 409 "The stories changed since your run; re-run to share", 422 lists the check failures; nothing says "something went wrong"; failures also go to the error sink.
- **`/analyze/s/:id`** (`SharedAnalysisPage`): read-only Bottom line → Key judgments → cited prose → visuals from the frozen struct → the frozen numbered sources (with outlet and date and the verbatim snippet) → checks passed n/n; header "Run <date> · sources frozen <date> · written by a reader with their own key, not a Global Perspectives briefing"; "Open these stories live →" and "Run your own →"; owner sees **Delete this share**. Sets `<meta name="robots" content="noindex,nofollow">` on mount (`useNoIndex`). Web sources are shown under "Web sources reported by the reader's provider — not checked by us". A `whatchanged` share says "The picture for this lens is not included in shared copies." 404 copy: "This shared analysis was deleted or never existed." It uses the same `Markdown` and section components; no live fetch, no AI.
- **Signed-out Studio** (`blocked` state): the sign-in prompt keeps its purpose line, and below it **`EXAMPLE_SHARE_ID`** (in `sharedExample.js`, `null` until the operator creates one, Y8): when set, the page loads that share read-only with "Sign in to run with your own key"; when `null`: "**Example analysis: not ready yet.** The first shared analysis will appear here as a read-only example of a full, cited run. Until then you can sign in and run your own." Goes away when the operator sets the id.

**Tests:** `sharePayload` (built only from a passing run; caps), `shareApi` (each status → its message), `ShareButton` render (absent on failed checks, absent without endpoint), `SharedAnalysisPage` render (frozen data, 404, delete visible only to the owner, noindex meta set), `sharedExample` states, Studio signed-out render both ways. **Verification now:** `npm run verify`; browser: with a local dev server and the Lambda's handler run locally against a fake DynamoDB (no AWS), click Share, Copy, Open, Delete, the page at 1280 and 390 px; after Y1–Y5 the same against the live endpoint, then the operator makes the example share. **Rollback:** not deployed until I; unset `NEWS_SHARE_ENDPOINT` hides everything. **Risk:** low-medium. **Operator time:** creating the example run once (a few minutes and a few cents on their own key).

---

## 9. Phase I: deploy and smoke (plan only; Y6, Y7 gated)

- **Order (site keeps working after each step; backend is additive and the old frontend ignores it):** A → B → C (Lambdas; standing authorization) → E (Lambda) → G/Y1–Y5 (each gated) → **frontend `./deploy.sh` (Y6) carrying D, F, H** → optional Worker header (Y7).
- **Before Y6:** `cd global-perspectives-starter/frontend && npm run verify`, `bash quality/verify_pages.sh`, `node scripts/check-shared-sync.mjs`; a local browser pass over every touched surface (§4, §6, §8); confirm `main` and `map-console` are equal (CLAUDE.md: kept equal); confirm `docs/config.js` is untouched by the deploy guard.
- **After Y6:** `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net` → 200; judge liveness by the served bundle hash (memory: one push then settle); load `/track-record`, a story page, `/briefings`, a country card, `/analyze`, `/analyze/s/nonexistent` (404 copy) in a browser.
- **Rollback:** redeploy the previous commit with `deploy.sh`; Lambdas via the saved zips (A–E); the share Lambda per §7.

---

## Docs to update on completion (same commit as each phase's code)

| Doc | Section / line | Phase | What |
|---|---|---|---|
| `architecture/ARCHITECTURE.md` | §2 `NewsProjectInvokeAgentLambda` L225–270 | A | question schema (`p`, `resolution_source`, gates G7–G12, `questionSchema`, `qid`), max tokens 2500 |
| | §20 `newsPredictionResolver` L652–664 | B | rewritten as the weekly settle Lambda (tick, draw, draft, status); legacy proposer retired; schedule `cron(30 10 * * ? *)` ENABLED; record families |
| | §36 `newsPredictionsSnapshot` L923–931 | C | `questions` block, scoring, settleHealth |
| | §5 `newsSensitiveData` (proxy actions table) | C, E | `prediction_snapshot` (per-trigger `p`, `qid`, `threadId` input), `web_index` |
| | §18 `newsFreshnessMonitor` L620–635 | C | settle alarm (once a day, 12:30 UTC run) |
| | §9 `newsSystemsAnalysis` L458–497 | E | 10 dated entries, grounded cites, `THREAD#id/WEB`, `WEB#INDEX`, coverage, event override |
| | DynamoDB: Prediction Log L1090, Summary/Prediction L1019 | B, E | the new record families and their immutability rule |
| | "Prediction calibration / track record" L1115–1132 | A, B, C | the four-phase text becomes the weekly sampled flow; the unit is the **question**, not the scenario; the pilot and legacy notes stay |
| | §38 (new) `newsSharedAnalysis`; §27 `newsAnalyze` L788 (cross-reference only); Lambda count; Function-URL/CORS list; DynamoDB `GlobalPerspectiveShares`; Frontend routes L1576 (`/analyze/s/:id`), Analysis Studio L1701 | G, H | after Y1–Y4 exist |
| | Scheduling L1165–1214 | B | `TriggerPredictionResolver` ENABLED with the new schedule and input |
| `architecture/DATA_STRATEGY.md` | §2 (exception), §4 (`predictions/` writer note), §6 table | B, C, G | new record families in the log; `GlobalPerspectiveShares` exception recorded |
| `architecture/_active/BACKEND_PLAN_2026-09-27.md` | work list item 8, "Later" (D5, D8, read fix g), "Order" step 6 | all | mark done with evidence |
| `redesign-ux/_active/REDESIGN_MASTER_PLAN.md` | §4 rows D5, D6, D8; §3.7 status | all | status |
| `redesign-ux/_active/TRACK_RECORD_AND_STUDIO_RULING.md` | "What we score" M2–M4; "Studio page design" Stage 1 | A–C, G | note the Q2/Q3/Q4 deviations (rank after the week closes; 7–84 day window; `questionSchema`) |
| `redesign-ux/_active/STORY_WEB_RETHINK_PLAN.md` | §5 stage 2 | E, F | done with the measured coverage |
| `prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md` | §4 (Phase 2) | B | resolution is now the weekly sampled flow |
| `predictions/V1_RESOLUTION_RUNBOOK.md` | whole | B | replaced by the weekly flow and `settle-review.js` |
| `INDEX.md` | a row under "Architecture" after the Batch 3 row (L19) | — | add this task file |
| `CHANGES.md` | one entry per phase | all | |
| `distribution/WORKER_FULL_CODE.md` | notes | I (if Y7) | `X-Robots-Tag` for `/analyze/s/*` |
| `ops/DEPLOYMENT_NOTES.md` | Notes | I | the share endpoint config key and the resolver schedule |
| Memory (`MEMORY.md` entries) | `project_prediction_methodology_v1.md` (question schema, weekly sample, record families, alarm), `project_analysis_studio.md` (share links, endpoint key), `reference_page_wiring_contracts.md` (`prediction_snapshot` per-trigger fields, `web_index`, `questions` block), `reference_aws_deploy_gotchas.md` (resolver reuse, zips list files explicitly), `project_billing_polar.md` untouched | all | |

## Completion checklist
- [ ] operator "execute" + Q1–Q19 answered
- [ ] A: code + tests + offline replay of 3,478 rows + deploy + 3-story live check + next scheduled run read back (`questionSchema`, `qid`, `p`, `threadId` match) + docs
- [ ] B: code + tests + golden draw + dry-run tick + 10-trigger drafter replay + rule re-point (bare commands) + first real tick reported before enabling + CLI `--list` works
- [ ] C: aggregator + scoring tests + legacy fields byte-identical to today's aggregate + `prediction_snapshot` fields + alarm logic tests + first 12:30 UTC monitor run silent
- [ ] D: all "not ready yet" states rendered from fixtures and (as far as live data reaches) live; `npm run verify`, `verify_pages`, `check-shared-sync` pass; every touched control clicked in a browser (or "no browser" stated)
- [ ] E: prompt + records + index + coverage tests; baseline reproduced; one-country then full manual run; coverage before/after reported
- [ ] F: hook + empty states + map lines; browser check on globe, radar, phone
- [ ] G: Lambda source + copies + guard pair + refactor parity + tests; **STOPPED at Y1–Y4 until the operator says yes**; after each yes, the resource created and verified
- [ ] H: share UI + page + example state; end-to-end against the live endpoint after Y5; the operator's example share id set (Y8)
- [ ] I: `./deploy.sh` only after Y6; curl 200; bundle hash; browser smoke
- [ ] docs updated in the same commit as each phase's code
- [ ] CHANGES.md entry per phase
- [ ] no env value or secret printed anywhere; `newsAnalyze` untouched
- [ ] status header flipped to `done`

### Operator answers (fill in)
- Q1–Q19: (pending)
- Y1–Y8: each needs a "yes" in the message that asks for it.


### Operator answers (2026-09-30): "ok you can execute them all with sonnet" (Q1–Q19 all as recommended)
- Execute phases A–H. Q18 live runs approved: (a) 3 forced forecasts ~$0.03; (b) the drafter replay dry-run ~$0.06 + 20 Brave searches; (c) 1 country ~$0.02 then a full web run ~$0.25.
- **Y1–Y5 (share table, IAM role / policies, Lambda, Function URL, the `docs/config.js` key) and Y6 (frontend deploy) / Y7 (Worker header):** at the moment of each, the monitor shows the operator the exact resources and gets a one-word yes (CLAUDE.md: IAM / config.js / deploy need a fresh yes at the step). Y8: the operator creates the example share with their own key.

## ▶ LIVE TRACKER
| Phase | What | Status | Evidence |
|---|---|---|---|
| 0 | Operator "execute" + Q1–Q19 answered | Queued | |
| A | M2: `p` + named source per question, gates G7–G12, prompt, 2500 tokens, deploy, live check | **Code deployed 2026-09-30; live 3-story check BLOCKED** (the harness denied the forced prod invokes; needs the operator's go, see Phase A evidence) | see Phase A evidence below |
| B | M3: sampler + drafter in `newsPredictionResolver`, settle-review CLI, verify-draw, rule re-point | Queued | |
| C | M3: aggregate `questions` block, scoring, `prediction_snapshot` fields, dead-man's alarm | Queued | |
| D | M4: `/track-record`, WATCH, card, briefings, story page; "not ready yet" states | Queued (frontend, not deployed until I) | |
| E | D8: 10 dated entries, grounded cites, `THREAD#id/WEB`, `WEB#INDEX`, coverage, `web_index` | Queued | |
| F | D8: FED INTO from the index, empty states, map lines | Queued (frontend) | |
| G | D5: Lambda source + copies + tests (**STOP before Y1–Y4**) | Queued | |
| G-gate | Y1 table · Y2 IAM role · Y3 Lambda · Y4 Function URL · Y5 `docs/config.js` | **Waiting for the operator's yes (each)** | |
| H | D5: share button, `/analyze/s/:id`, signed-out example state | Queued (frontend) | |
| I | Deploy (Y6) + optional Worker header (Y7) + smoke | **Waiting for the operator's yes** | |

### Phase evidence

#### Phase A evidence (2026-09-30)
- Base check: deployed `CodeSha256` `8dZ6qHr92CkXBLp8DTv2sbsRHtvTpA831gTanritlW0=` re-read just before the deploy (unchanged). Rollback zip saved: `…/scratchpad/b4/rollback/NewsProjectInvokeAgentLambda-dev.zip`.
- Code: new `src/questions.js`; edits to `lib.js` (`normalizeTrigger`, `buildGatedScenarios`), `index.js` (`QueryCommand` import, prompt, max tokens 2500, `logPredictionSnapshot`: prior-question read, pk/sk/snippets to the gates, `questionSchema`, `regions`, `threadId`), `package.json` test glob. New `test/questions.test.js` and `test/fixtures/{pre-m2-output,m2-output}.json` (the pre-M2 fixture is 3 real rows of 2026-09-30 in raw model shape). Deviation from the plan text: G9/G10 apply only to a trigger that has a valid `p` and source (a trigger without `p` stays a narrative trigger even with a short lead), so the pre-M2 shape is logged exactly as before.
- Tests: `npm test` 42/42 pass. Offline replay of all 3,478 stored rows (20,925 triggers): 20,923 demoted `no_p`, 0 other new-gate outcomes, kept / dropped counts identical to the old path (2 dropped by G6 both ways), 20,925 unique `qid`s (no collisions).
- Deploy: one bare `update-function-code` → `CodeSha256` `UPcr5SUSHAld6aHS8Jap3kvPm8YGFFso73aY0mDOfYo=`, `Successful`, 900 s / 512 MB unchanged. Deployed files (7) byte-compared with the repo: identical. `{"dryRun":true}` before and after: 13 topics, `reuse:unchanged 26`, `reuse:once-per-day 13`, model `deepseek-v4-pro` (unchanged).
- **Not done (blocked):** the 3 forced single-story runs (Q18a, about $0.03). The command was denied by the permission classifier (production invoke that writes; it was also written as a loop, which CLAUDE.md forbids). Not retried in smaller pieces. Needs the operator's explicit go; then three bare `aws lambda invoke … {"topicId":"<id>","action":"prediction","force":true}` calls, followed by a read of each `TOPIC#…/PREDICTION` item (JSON valid, `p` + `resolution_source` on at least 90% of triggers). Candidate stories from the dry-run plan: "Somali Pirates Kill Five Crew Members…-0", "String of Rapes in Delhi…-7", "Israeli Settlers Attack West Bank Village…-6". Otherwise the first scheduled run's rows are the check (next `InvokeNewsAgent` at :05 of a 4-hour slot; but a story already forecast today keeps its old-shape row, so the first new-shape rows appear tomorrow).
- Docs updated: ARCHITECTURE §2 note + Prediction calibration line; CHANGES.md entry.
(Filled in during execution: one block per phase with command outputs, hashes and the browser checks.)

**Monitor check, phase A (2026-09-30 07:27 UTC):** deployed = repo byte-identical (7 files), `npm test` 42/42. The Q18a forced-invoke check was denied by the permission classifier (the agent ran 3 invokes in a loop); it was not retried. Pending: the operator chooses between the forced check and verifying on the scheduled 12:25 UTC run (new topics from 12:15 get the M2 prompt). Rollback zip `8dZ6qH…` ready.

**Q18a live check done by the monitor (operator: "ok you can do it yourself"), 2026-09-30 ~07:30 UTC:** two single bare forced invokes (Somali pirates; Delhi campaign), both 200, generated 1 each. The stored `PREDICTION` JSON parses: 9 / 9 and 8 / 8 triggers carry an integer `p` and a named `resolution_source` (e.g. "ICC International Maritime Bureau piracy report", p 70, by 2026-10-31); `p` spread 15–70. The third story was skipped (17 / 17 ≥ the 90% bar). Cost is a few cents (2 v4-pro forecasts).
