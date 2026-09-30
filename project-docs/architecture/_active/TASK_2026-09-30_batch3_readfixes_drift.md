## Batch 3: read fixes, drift-note direction check, region leftovers, code-drift audit, deploy readiness — 2026-09-30 — active (PLAN ONLY; nothing executed, nothing changed)

**Goal:**
- **A (read fix a):** stop old stories being stamped with today's date, so `/weekly` "NEW EVENTS TODAY", the story-page timeline and "newest first" story analysis are truthful.
- **B (read fix b):** a `latest_daily_brief` proxy action, so a cold `/map` makes 1 call instead of 21+.
- **C (read fix c):** a real `threadId` on each daily-brief `topStories[]` entry, so `/briefings` (and `/daily`) link a top story to its story page.
- **D (read fix f):** a public `country_facts` read action + a facts row on the country card (only verified facts, each with its as-of date).
- **E (D9):** a drift note can never explain a lower score with a worsening (or the reverse). Prompt fix + validator + one retry + a flag; audit and flag the existing notes.
- **F:** region leftovers (`newsSystemsAnalysis` still briefs Europe / Asia; four readers still read frozen region `COUNTRY#` records; the country list page includes region keys).
- **G:** code-drift audit of every news Lambda, deployed zip vs repo (table in §9; 37 Lambdas).
- **H:** two small phone fixes (`/weekly/country/:name` 454 px wide at 390; the `/map` country sheet covers the whole map).
- **I:** deploy readiness for the frontend, the Worker (D10) and the `map-console` to `main` merge: **plan only, not executed**.

**Source:** operator 2026-09-30: "do the read fixes, and any drift we have for our system for the news". `BACKEND_PLAN_2026-09-27.md` (work list items 2–7, end sections from 2026-09-30), `REDESIGN_MASTER_PLAN.md` §4 (D9, D10). PPA is out of scope (operator: ignore it). Format and evidence standard: `TASK_2026-09-28_batch1_efficiency.md`, `TASK_2026-09-29_batch2_models.md`, `playbooks/TASK_TEMPLATE.md`. **This step was read-only:** AWS reads, downloads of deployed zips, DynamoDB reads, a local dev server for two phone measurements, `git merge-tree`. No LLM call, no write, no edit except this file. No secret or env value was printed.

**Reads / references:**
- `CLAUDE.md`; `BACKEND_PLAN_2026-09-27.md`; `REDESIGN_MASTER_PLAN.md` §4, §3.6; `ARCHITECTURE.md` (proxy table L329–346, Lambdas §3, §4, §5, §7, §9, §11, §21, §23, §26, §29, §31, §37, DynamoDB L937–, Cloudflare Workers L1096–, Scheduling L1128–); `DATA_STRATEGY.md`; `ops/DEPLOYMENT_NOTES.md`; `distribution/WORKER_FULL_CODE.md` (the prepared SPA-fallback Worker + its test plan L459–500); `architecture/_active/STAGE0_FIXES_PLAN.md` (item a), `STAGE0_sitemap_proposed.xml`; `scripts/check-shared-sync.mjs` (the shared-copy guard).
- Repo code read: `NewsProjectInvokeAgentLambda/src/index.js` (`buildArchiveEntry` L1047, `buildAndWriteArchive` L1186–1281, run guard L128); `newsSensitiveData/src/index.js` (`readTodayArchive` L1566, `readArchiveRange` L1669, `readNarrativeThread` L1817, `daily_brief` L356, `country_intelligence` L516, `world_overview` L724); `newsThreadAnalysis/src/index.js` L97, `threadPolicy.js`; `newsPostDevTo/src/index.js` (L28–260); `newsDriftCorrector/src/{index,lib}.js` + `test/lib.test.js`; `newsCountryFactsUpdater/src/index.js`; `newsCountryIntelligence/src/{index.js,refreshPolicy.js,country_facts.json,placeNames.json,iso3Names.json}`; `newsSystemsAnalysis/src/index.js`; `newsBreakingAlert/src/index.js` L105; `newsWeeklyBrief/src/index.js` L60; `newsSignals/src/index.js` L165.
- Frontend read: `src/features/daily/hooks/useDailyBrief.js` + its 5 callers, `features/briefings/*`, `features/countries/{CountryListPage,CountryPage}.jsx` + `components/CountryCardV2.jsx`, `features/analysis-studio/lib/directionCheck.js`, `features/threads/hooks/useNarrativeThread.js`, `features/map/{SituationHome.jsx,components/BottomSheet.jsx}`, `deploy.sh`.
- Live reads: 51 `archive#` rows (2026-07-01 to 09-30) in `NewsCache`; `DAILY_BRIEF#2026-09-30`; 190 `DRIFTLOG#` notes for the 12 default drift countries; `FACTS#` rows; all `COUNTRY#…/COUNTRY_INTELLIGENCE` (50) and `SYSTEMS#…` (17) rows (keys + `generatedAt` only); 37 deployed zips (scratchpad `…/scratchpad/b3/z/`; **re-download before any deploy, the S3 link expires in minutes**).

---

## Changes (code)

Phase ids: A re-dating · B latest brief · C topStories threadId · D country facts · E drift direction · F regions · G drift audit · H phone fixes · I deploy readiness. **No IAM change, no schedule change, no env change** in any phase (the new proxy actions and the readers use tables the Lambdas already read). Every Lambda deploy is a bare single `aws lambda update-function-code` (standing authorization: "Lambda code updates for work the operator asked for").

### Repo files: create
| Phase | File | Purpose |
|---|---|---|
| A ✅ | `amplify/backend/function/{newsThreadAnalysis,newsSystemsAnalysis,newsCountryIntelligence,newsWeeklyBrief,newsDriftCorrector,newsPostDevTo}/src/dayZero.js` | `keepDayZero(entries, nowMs)`: byte-identical copy in each (guarded, see `scripts/check-shared-sync.mjs`) |
| A ✅ | `amplify/backend/function/newsThreadAnalysis/test/dayZero.test.js`, `newsSensitiveData/test/latestDayLabel.test.js` (added; the DriftCorrector copy was not needed) | unit tests for the helper, using the real 2026-09-13 row shape |
| A ✅ | `scripts/check-archive-dates.mjs` | read-only audit: every `archive#D` entry's `archivedAt` date == D, and cross-day `topicId` repeats (the check I ran by hand) |
| B | `amplify/backend/function/newsSensitiveData/test/latestBrief.test.js` | tests for the new pure picker in `lib.js` |
| C | `amplify/backend/function/newsPostDevTo/src/threadLinks.js` + `test/threadLinks.test.js` | pure `resolveStoryThreadIds(topStories, entries, threadAnalyses)` |
| C | `global-perspectives-starter/frontend/src/features/briefings/__tests__/storyLinks.test.jsx` | render test: a story with `threadId` links to `/weekly/thread/<id>`, without one it does not |
| D | `amplify/backend/function/newsSensitiveData/test/countryFacts.test.js` | shape / TTL-free / staleness of the read action |
| D | `frontend/src/features/countries/hooks/useCountryFacts.js`, `lib/countryFacts.js`, `__tests__/countryFacts.test.js` | fetch + pure `factRows(facts, now)` (only fresh, only sourced, each with its date) |
| E | `amplify/backend/function/newsDriftCorrector/src/directionCheck.js` + `test/directionCheck.test.js` | port of `checkDirectionInText` + axis-valence check, with fixtures from the real Iran / China / Germany notes |
| E | `scripts/audit-drift-direction.mjs` | read-only (default) scan of all `DRIFT#` / `DRIFTLOG#` notes; `--llm` mode and `--write-flags` mode are separate gates |
| E | `frontend/src/shared/lib/driftNote.js` + `__tests__/driftNote.test.js` | `isNoteTrusted(note)` shared by every reader of `whyChanged` |
| F | `amplify/backend/function/newsSystemsAnalysis/src/{placeFilter.js,placeNames.json,iso3Names.json}` + `test/placeFilter.test.js` | copy of the real-country rule |
| F | `amplify/backend/function/{newsPostDevTo,newsBreakingAlert,newsWeeklyBrief,newsSignals}/src/{recordPolicy.js,placeNames.json,iso3Names.json}` (+ tests) | `usableCountryRecord(name, record, nowMs)`: real country AND `generatedAt` within 30 days |
| F | `frontend/src/shared/data/placeNames.json` + `shared/lib/placeNames.js` + `__tests__/placeNames.test.js` | `isRealCountryName` for `CountryListPage` |
| G | `scripts/audit-lambda-drift.sh` | the read-only audit loop I ran (repeatable) |
| G | `amplify/backend/function/newsAnalyze/deployed-snapshot/index.js` (+ README line) | **only if the operator says yes (Q10):** the single copy of the patched deployed source that exists today only in AWS |
| H | `frontend/src/features/countries/__tests__/countryPageOverlay.test.jsx`, `features/map/__tests__/sheetCountryStop.test.jsx` | overlay wraps; country sheet opens at peek and the map is visible |

### Repo files: edit
| Phase | File | Change |
|---|---|---|
| A ✅ | `scripts/check-shared-sync.mjs` | pair `dayZero.js (x6)` (+ self-test) added |
| A ✅ | `newsSensitiveData/src/index.js` L1682–1699 (`readArchiveRange` day 0), L1838–1845 (`readNarrativeThread` day 0) + `src/lib.js` (`latestDayLabel`) | day 0 is labelled with the date of `latest.updatedAt`, not today; skipped when that date is unparsable |
| A | `newsThreadAnalysis/src/index.js` L97–125; `newsSystemsAnalysis/src/index.js` L98–125; `newsCountryIntelligence/src/index.js` L167–195; `newsWeeklyBrief/src/index.js` L157–185; `newsDriftCorrector/src/index.js` L60–74, L168–182; `newsPostDevTo/src/index.js` L292–300 | `today-archive` entries pass through `keepDayZero` |
| A | `newsPairIntelligence/src/index.js` L284; `newsEconomicImpact/src/index.js` L222 | **not edited** (dormant / parked); recorded in ARCHITECTURE so an unpark applies the same rule |
| B | `newsSensitiveData/src/index.js` (new `latest_daily_brief` branch after `daily_brief` L356–376) + `src/lib.js` (`pickLatestBrief`) | `BatchGetItem` of the last N `DAILY_BRIEF#` keys, newest wins |
| B | `frontend/src/shared/api/restProxy.js` (+ `fetchLatestDailyBrief`, after L187–193) | public `proxyAction('latest_daily_brief', { lookbackDays })` |
| B | `frontend/src/features/daily/hooks/useDailyBrief.js` | latest mode = 1 call, shared promise; `MAX_LOOKBACK_DAYS` stays exported (callers pass it to `pausedSince`); explicit `dateKey` keeps the current walk |
| B | `frontend/src/features/briefings/hooks/useDailyEditionsIndex.js` | (optional, Q3) read `editions[]` from the same action instead of 14 probes |
| B | tests: `features/daily/hooks/__tests__/useDailyBrief.test.js`, `app/__tests__/layout.test.jsx`, `features/account/__tests__/{accountShell,deskPanel}.test.jsx`, `features/briefings/hooks/__tests__/useDailyEditionsIndex.test.js` | mock `fetchLatestDailyBrief`; assert 1 call cold |
| B | callers `app/layout/Layout.jsx` L74, `features/map/SituationHome.jsx` L335, `features/static/AboutContact.jsx` L12, `features/account/components/DeskPanel.jsx` L26, `features/account/Account.jsx` L338, `features/daily/DailyPage.jsx` L205, `features/briefings/BriefingsPage.jsx` L26 | no code change expected (they call the hook with no date); verify each |
| C | `newsPostDevTo/src/index.js` L206–230 | after `risingThread` resolution, `brief.topStories = resolveStoryThreadIds(...)`; each story gets `threadId: string \| null` |
| C | `frontend/src/features/briefings/lib/briefingSlides.js` (comment L8–10 is now wrong), `components/BriefingSlides.jsx` L57–86 (`StorySlide`), `components/ReadAsText.jsx` L36–56, `features/daily/DailyPage.jsx` L396–430 | a story link via `threadPath(threadId)` only when `threadId` exists |
| D | `newsSensitiveData/src/index.js` (new `country_facts` branch after `country_intelligence` L516–541) | `GetItem` `FACTS#<name>/COUNTRY_FACTS` for ≤ 15 names; returns only display fields |
| D | `frontend/src/shared/api/restProxy.js` (+ `fetchCountryFacts`); `features/countries/components/CountryCardV2.jsx` L101–113 (the facts block; the comment "Wikidata facts job (D7, not built)" is stale) + `CountryCardV2.css` | facts row before macro / FX |
| D2 (optional, Q6) | `newsCountryFactsUpdater/src/index.js` | widen: capital (P36), population (P1082 with P585 date), country list by ISO3 (P298) from `iso3Names.json`; log line already newer in repo |
| E | `newsDriftCorrector/src/lib.js` (`buildDriftPrompt`, `parseDriftResponse`) and `src/index.js` (`processCountry` L~135, `processThread` L~223, `writeNote`, `writeThreadNote`, new `dryRun`) | valence output + validator + retry once + `directionFlag` |
| E | `frontend`: `features/countries/components/CountryWhatChanged.jsx` L42–46, L85, L115; `CountryCardV2.jsx` L69–74 (`latestChange`); `features/threads/ThreadPage.jsx`, `WeeklyPage.jsx`; `features/track-record/hooks/useCorrectionsFeed.js` + `TrackRecordPage.jsx`; `features/account/lib/desk.js`; `features/analysis-studio/lib/{countryDriftPicture,analysis}.js` | every place that shows `whyChanged` skips a note with `directionFlag` (numbers stay, text hidden) |
| E | `scripts/check-shared-sync.mjs` | new guard pair: the `WORSE_WORDS` / `BETTER_WORDS` / direction regex sources in `directionCheck.js` (Lambda) vs `features/analysis-studio/lib/directionCheck.js` (marker extraction, like pair (d)) |
| F | `newsSystemsAnalysis/src/index.js` L143–160 (`groupByCountry`) + `dryRun` | skip non-countries |
| F | `newsPostDevTo/src/index.js` L52–65; `newsBreakingAlert/src/index.js` L105–116; `newsWeeklyBrief/src/index.js` L60–66; `newsSignals/src/index.js` L165–172 | ignore region keys and records older than 30 days |
| F | `newsSensitiveData/src/index.js` `world_overview` L724–858 | skip `SYSTEMS#<region>` rows (reuses the existing `COUNTRY_NAME_SET`) |
| F | `frontend/src/features/countries/CountryListPage.jsx` L242–275 | filter `countries` with `isRealCountryName` before the `slice(0, 24)` |
| F | `scripts/check-shared-sync.mjs` | guard pair (f): `placeNames.json` + `iso3Names.json` copies (5 Lambdas + frontend) |
| H | `frontend/src/features/countries/CountryPage.css` (the `@media (max-width: 600px)` block L749) | overlay wraps |
| H | `frontend/src/features/map/SituationHome.jsx` L529–555, `features/map/SituationHome.css` L417–430 | country selection opens at `peek` and scrolls the map pane into view |

### Repo files: delete
None. (Region records already in DynamoDB are **not deleted**; see F.)

### Live resources touched (by phase)
| Resource | Phases | Kind of change |
|---|---|---|
| Lambda `newsSensitiveData-dev` (proxy) | A, B, D, F | code deploy ×4 (one per phase) |
| Lambdas `newsThreadAnalysis`, `newsCountryIntelligence`, `newsWeeklyBrief` | A (+F for WeeklyBrief) | code deploy |
| Lambda `newsSystemsAnalysis` | A, F | code deploy |
| Lambda `newsDriftCorrector` | A, E | code deploy |
| Lambda `newsPostDevTo` | A, C, F | code deploy |
| Lambdas `newsBreakingAlert`, `newsSignals` | F | code deploy |
| Lambda `newsCountryFactsUpdater` | D2 only | code deploy + one manual run (no LLM) |
| Proxy actions | B: `latest_daily_brief` (new); D: `country_facts` (new); A: `archive_range`, `narrative_thread` (behaviour); F: `world_overview` (behaviour) | |
| Tables / records | `NewsCache`: `today-archive`, `latest`, `archive#D` (read only). `SummarizeAndPredict`: `DAILY_BRIEF#D` (C adds `topStories[].threadId`), `FACTS#<country>/COUNTRY_FACTS` (read; D2 adds fields), `COUNTRY#<c>/DRIFT#D` + `DRIFTLOG#D` and `THREAD#<id>/DRIFT#D` + `DRIFTLOG#D` (E: new `directionFlag`), `COUNTRY#…/COUNTRY_INTELLIGENCE` and `SYSTEMS#…` (read only, F) | E adds one additive attribute on flagged notes (gated) |
| Schedules | none changed. Watch: `TriggerDriftCorrector` 05:30 UTC, `TriggerNewsSystemsAnalysis` 05:00, `InvokeDev` 14:00 UTC (daily brief), `TriggerWeeklyBrief` Sun 06:00, `Fact` Mon 05:00 JST | |
| Env var names | none added or changed. Read: `TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE` (already present on all of them), `GROK_MODEL` / `GROK_API_URL` / `XAI_API_KEY` (hold DeepSeek; drift retry uses them) | |
| Cloudflare Worker `globalperspective-rss` | I | code paste (gated, not now) |

---

## Docs to update on completion (same commit as each phase's code)

| Doc | Section / line | Phase | What |
|---|---|---|---|
| `architecture/ARCHITECTURE.md` | proxy actions table L329–346 | A, B, D, F | add `latest_daily_brief`, `country_facts`; note `archive_range` / `narrative_thread` day-0 label rule; `world_overview` skips regions |
| | §3 `newsThreadAnalysis` L271–294 | A | day-0 filter |
| | §4 `newsCountryIntelligence` L295–317 | A | day-0 filter |
| | §5 `newsSensitiveData` L318–398 | A, B, D, F | as above |
| | §7 `newsPostDevTo` L399–445 | A, C, F | day-0 filter; `topStories[].threadId`; region / age rule for the country block |
| | §9 `newsSystemsAnalysis` L446–486 | A, F | day-0; real-country rule; `dryRun` |
| | §11 `newsCountryFactsUpdater` L487–501 | D, D2 | what is stored (12 countries, leadership + ACLED), the read action, TTL 90 d **but TTL is disabled**, widening |
| | §21 `newsBreakingAlert` L646, §37 `newsSignals` L898 | F | ignore region / stale country records |
| | §23 `newsWeeklyBrief` L693 | A, F | day-0; region / stale rule |
| | §26 `newsDriftCorrector` L741–795 | A, E | valence check, retry, `directionFlag`, `dryRun` |
| | §29 `newsEmailSender`, §31 `newsGdacsIngest` | G | "repo ahead of deployed" note |
| | DynamoDB table list L937–1077 (`DAILY_BRIEF#`, `FACTS#`, `DRIFT#`) | C, D, E | new fields |
| | Cloudflare Workers L1096–1127 (the pre-render table L1114) | I | `/briefings`, `/analyze/s/*` skip, `latest_daily_brief` for `/daily` |
| | Frontend path map / hooks | B, C, D, F | `useDailyBrief`, `useCountryFacts`, `isRealCountryName` |
| `architecture/_active/BACKEND_PLAN_2026-09-27.md` | work list items 2, 3, 4, 6, 7 + "Order" step 4 + follow-ups L153–154 | all | mark done with evidence |
| `redesign-ux/_active/REDESIGN_MASTER_PLAN.md` | §4 rows D9, D10 (and D7's "country_facts" bullet) | E, D, I | status |
| `redesign-ux/_active/TASK_2026-09-27_pages_local.md` | S3 (`/briefings`) note "no threadId" | C | resolved |
| `INDEX.md` | row under "Architecture" after the Batch 1 row (L18) | — | add this task file |
| `CHANGES.md` | one entry per phase | all | |
| `ops/DEPLOYMENT_NOTES.md` | "Notes" | I | Pages serves `main:/docs`; deploy from `main` after ff-merge; `deploy.sh --commit` stages all of `frontend/src/`; Worker deploy is a dashboard paste (no wrangler project in the repo) |
| `distribution/WORKER_FULL_CODE.md` | pre-render table L427–436, notes L438+ | I | `/briefings` branch, `/analyze/s/*` skip, `latest_daily_brief` (prepared, not deployed) |
| `architecture/_active/STAGE0_sitemap_proposed.xml` / `docs/sitemap.xml` | add `/briefings`, `/map`; no `/analyze/s/*` | I | at the deploy step only |
| Memory | `reference_page_wiring_contracts.md` (topStories threadId, latest_daily_brief, country_facts shapes); `project_living_analysis.md` (D9 `directionFlag`); `feedback_editorial_fact_layer.md` (only Iran is `verified:true` in the operator JSON; FACTS# covers 12 countries); `reference_proxy_request_behavior.md` (new actions); `project_country_briefings` note in `MEMORY.md` if present (region rule now in 6 more readers); `reference_aws_deploy_gotchas.md` (NewsCache TTL is DISABLED: `today-archive` survives a stall) | | |

## Completion checklist
- [ ] operator "execute" + open questions answered
- [ ] A: code + tests + deploys (6 Lambdas + proxy) + local stale-fixture harness + docs
- [ ] B: proxy action deployed and read back; frontend hook + callers + tests; cold `/map` = 1 `latest_daily_brief` call (browser network tab)
- [ ] C: `topStories[].threadId` code + tests; verified on the next scheduled daily brief (14:00 UTC); `/briefings` links clicked in a browser
- [ ] D: `country_facts` deployed; card row shown only for fresh facts; clicked in a browser (desktop + 390 px)
- [ ] E: validator + tests; audit of existing notes reviewed by the operator; flags written only after a yes; frontend hides flagged text; browser check
- [ ] F: region rule in Systems + 4 readers + list page; guard pair added; `check-shared-sync.mjs` passes
- [ ] G: audit table committed; repo/deployed decisions recorded (no repo copy deployed over real divergence)
- [ ] H: both phone fixes verified at 390 px in a browser
- [ ] I: readiness list reviewed by the operator (nothing deployed)
- [ ] docs updated in the same commit as each phase
- [ ] CHANGES.md entry per phase
- [ ] `cd global-perspectives-starter/frontend && npm run verify` (currently 747 tests) + `bash quality/verify_pages.sh` + `node scripts/check-shared-sync.mjs` pass
- [ ] no deploy of the frontend or Worker: deferred to the gated deploy (I)
- [ ] status header flipped to `done`

---


### Operator answers (2026-09-30): "yes you can do all here with sonnet" (all as the monitor recommended)
- Q1: fix A on the read side only, no stored repair; the dormant / parked Lambdas are not edited. Q2: keep the frontend `dropRedatedRepeats`. Q3: `latest_daily_brief` also returns `editions[]`, and `/briefings` drops its 14 probes. Q4: explicit-date briefs keep the walk.
- Q5: one manual `newsPostDevTo` run to verify C. Q6: **D1 + D2** (leader for the 12; capital + population via Wikidata, ~40 countries, free).
- Q7: a one-off LLM audit of the ~190 stored drift notes (~$0.05); for flagged notes hide the text and show the numbers. Q8: on a second failed check, store the numbers-only sentence + `directionFlag`. Q9: `newsDriftCorrector` timeout 120 → 180 s.
- Q10: commit a snapshot of the deployed `newsAnalyze` source (after a secrets check). Q11: leave the `newsEmailSender` repo copy undeployed. Q12: the phone country sheet opens at `peek`.
- Q13: deploy order Lambdas → frontend on `main` (fast-forward) → Worker (operator pastes in the Cloudflare dashboard), **each deploy with its own fresh yes**. Q14: execute A–H.

## ▶ LIVE TRACKER
| Phase | What | Status | Evidence |
|---|---|---|---|
| 0 | Operator "execute" + Q1–Q13 answered | Queued | |
| A | Read fix a: day-0 readers + `dayZero.js` ×6 + `newsSensitiveData` label + audit script + tests + 7 deploys | **Done 2026-09-30** (awaiting monitor verify) | see Phase A evidence below |
| B | Read fix b: `latest_daily_brief` + hook + tests | Queued | |
| C | Read fix c: `topStories[].threadId` + `/briefings` and `/daily` links | Queued | |
| D | Read fix f: `country_facts` + card row (D2 widen updater: only if approved) | Queued | |
| E | D9: validator + retry + flag; audit of 190 notes; frontend hide | Queued | |
| F | Region leftovers: Systems + 4 readers + `world_overview` + list page | Queued | |
| G | Drift audit: table, snapshot decision, `scripts/audit-lambda-drift.sh` | Queued | |
| H | Phone fixes: country page overlay, country sheet | Queued | |
| I | Deploy readiness (plan only) | Queued | |

### Phase A evidence (2026-09-30)
- **Code:** `dayZero.js` ×6, six reader edits, `newsSensitiveData` `lib.js` (`latestDayLabel`, `dedupeTopicDate`) + `index.js` (`readArchiveRange`, `readNarrativeThread`), `scripts/check-shared-sync.mjs` (pair `dayZero.js (x6)` + self-test), `scripts/check-archive-dates.mjs`, tests `newsThreadAnalysis/test/dayZero.test.js` (5) and `newsSensitiveData/test/latestDayLabel.test.js` (3; planned name was `latestBrief`-style, this one is A's). Suites: ThreadAnalysis 13, SensitiveData 12, CountryIntelligence 15, DriftCorrector 14 all pass. `node scripts/check-shared-sync.mjs` ALL PASS; `--self-test` PASS. (The planned fixture copy of the test in `newsDriftCorrector/test/` was not added: the helper is byte-identical, one test covers it.)
- **Stale-fixture harness (offline, stubbed DynamoDB, `latest` = the REAL 2026-09-13 generation, clock = 2026-09-27):** deployed (old) code returned `archive_range` keys `[2026-09-27, 2026-09-13]` and a narrative thread with `2026-09-27:latest` (the operator's "13 Sep shown as 27 Sep" bug reproduced). New code: `[2026-09-13]` and the thread shows only `2026-09-13`.
- **Deploys** (each: `CodeSha256` re-checked against the recorded zip first; then a bare `update-function-code`; `LastUpdateStatus` Successful; downloaded zip compared with the repo byte for byte, 0 mismatches): `newsSensitiveData-dev` `UKSnvWs3…` -> `QoSZoCGb…`; `newsThreadAnalysis` `pV15UQo5…` -> `YXnu9PGW…`; `newsSystemsAnalysis` `2Bu4np7a…` -> `YOMJmc3e…`; `newsCountryIntelligence` `1KvJt7be…` -> `ze82OhAp…`; `newsWeeklyBrief` `89/Llp0Y…` -> `gEjnsNLx…`; `newsDriftCorrector` `iBAAoJiz…` -> `otWER+j6…`; `newsPostDevTo` `tga1S60w…` -> `LKVxbSkp…`. Rollback zips: `…/scratchpad/b3/z/<name>.zip` (the pre-deploy zips). Node_modules of Systems / PostDevTo untouched (overlay on the deployed zip).
- **Live checks (no LLM, no writes):** proxy `archive_range {days:7}` -> `{2026-09-30: latest, 15 entries}` (day 0 labelled with `latest.updatedAt`); `newsThreadAnalysis {dryRun}` -> 89 threads, plan `newest` dates real (09-08..09-13), 10 new-thread; `newsCountryIntelligence {dryRun}` -> 200, 56 situations. `node scripts/check-archive-dates.mjs --from 2026-09-25`: 0 mis-dated. Not observable on live data until the next pipeline stall (pipeline healthy).
- **Watch:** first scheduled runs after deploy: 04:40 story analysis, 05:00 systems, 05:15 countries, 05:30 drift (all read `today-archive`; the 04:25 agent run writes fresh entries first).

**Phase order (the site keeps working after each step; every step is additive or a stricter filter, and each deploy has a saved prior zip):**
1. **A** (Lambda-side only; no frontend). 2. **B** (Lambda first, verify, then the frontend code; not deployed until I). 3. **C** (Lambda; the frontend links appear only where a `threadId` exists, so old briefs render as today). 4. **D**. 5. **E** (validator first; flags and frontend hide last, after the operator reviews the audit). 6. **F**. 7. **G** (no deploys). 8. **H** (frontend only). 9. **I** (plan). Frontend edits from B–F, H are committed on `map-console` and go out with the gated deploy; each Lambda phase is safe for the currently deployed frontend because the frontend ignores unknown fields and unknown actions are only called by the new code.

---

## 0. Findings (live + code, 2026-09-30)

### 0.1 Read fix a: where the re-dating really comes from
- **The stored archive is correct.** I read all 51 existing `archive#D` rows in `NewsCache` (2026-07-01 to 09-30; rows for 07-12..23, 08-23..09-02 and **09-14..09-29** do not exist). In every row every entry's `archivedAt` date equals the row's date; a `topicId` reappears on a later day only 0–3 times a day (a stable title-hash id, so that is a real re-observation, not a copy). So **there are no mis-dated stored rows and no data repair is needed.** `NewsProjectInvokeAgentLambda` (`buildAndWriteArchive` L1186) writes `archivedAt = now` per run and replaces same-day same-id entries only; it is not the writer of the bug.
- **The mis-dating is a read-side rule.** Eight Lambdas read `today-archive` for "day 0" and stamp every entry in it with **today's** date, with no check of the entry's own `archivedAt`: `newsThreadAnalysis` L105 (also has no 24 h filter), `newsSystemsAnalysis` L100, `newsCountryIntelligence` L171, `newsWeeklyBrief` L160, `newsDriftCorrector` L62 / L170, `newsPostDevTo` L294, and (dormant / parked) `newsPairIntelligence` L284, `newsEconomicImpact` L222. `newsSensitiveData` does the same with `latest`: `readArchiveRange` L1682 and `readNarrativeThread` L1838 label `latest.topics` as today's date whatever its age. **`NewsCache` TTL is DISABLED** (`describe-time-to-live`), so `today-archive` and `latest` survive a pipeline stall (the 13–29 Sep outage: `latest` stayed `gen-1789257646696`, and no `archive#` row was written after 09-13). A 13-Sep AfD topic therefore came back as "27 Sep" (I inferred this from the code and the Batch 1 finding; the live data has since been replaced by the 2026-09-30 generation, so I could not re-observe the 27 Sep response).
- **Consequences:** `/weekly` "new events today" (`WeeklyPage.jsx` L336, `daysSince(t.dateRange.to) <= 1`), the story page span / scrubber, and story analysis "newest first" (`threadPolicy.js` `newestDate`) all inherit the false date.
- **Cannot be seen on live data right now:** the pipeline is healthy (`latest` 2026-09-30T02:15Z, `today-archive` 02:17Z). The next stall is the first live proof; until then proof is the stale-fixture harness (below).

**`dropRedatedRepeats` (frontend, `useNarrativeThread.js`):** can stay. After A it is a second line of defence only. It keeps the earliest of same-title entries, so a story that genuinely recurs under the exact same title on a later day loses its later appearance; that is a small, known cost. Recommendation: keep it unchanged for now (3 callers + tests), and re-judge in two weeks once the day-0 fix has run on healthy data (Q2).

### 0.2 Read fix b: the daily brief
`DAILY_BRIEF#<date>/DAILY_BRIEF` in `SummarizeAndPredict`; one row per day, ~4.6 KB, TTL attribute set but the table TTL is disabled (rows persist). Today: `useDailyBrief` checks today, then a remembered date, then batches of 10 (`MAX_LOOKBACK_DAYS = 30`); 5 callers mount it with no date (Layout, SituationHome, AboutContact, DeskPanel, Account), so a cold page costs 1–21 `daily_brief` calls and `useDailyEditionsIndex` adds up to 14 more on `/briefings`. Non-today keys go through `proxyActionWithAuth` (an auth-token round trip) although the action is not gated server-side.

### 0.3 Read fix c: the brief's `topStories`
Stored shape (live row 2026-09-30): `{ title, category, regions[], prediction, sourceCount }` — **no `threadId`**. The LLM copies the title "from the headlines above", and the headlines are the archive entries, each of which already carries a `threadId`. `risingThread.threadId` is resolved in code (`resolveRealThreadId`, L67–83) only against `THREAD#…/THREAD_ANALYSIS` rows (threads with ≥ 2 entries), so a one-day story would not resolve. The better key is the **archive entry itself**.

### 0.4 Read fix f: what country facts exist
- `newsCountryFactsUpdater` (Scheduler `Fact`, now **weekly** `cron(0 5 ? * MON *)` JST) writes `FACTS#<country>/COUNTRY_FACTS` in `SummarizeAndPredict`: `leadershipString`, `headOfState{name,since}`, `headOfGovernment{name,since}`, `leadershipSource:'wikidata'`, `leadershipChangedAt`, `acledData` (null today: no ACLED credentials), `lastUpdatedAt`, `ttl` (+90 d; TTL disabled, so a row never expires by itself). **Only the 12 hard-coded `TARGET_COUNTRIES`** (Iran, Israel, United States, China, Russia, Ukraine, India, Pakistan, Saudi Arabia, Lebanon, United Kingdom, Cuba). Live check: Iran and United States rows exist, updated 2026-09-28T20:03Z; Japan and Germany have **no row**.
- **Capital and population are not stored anywhere** (D7 was never built; the card comment at `CountryCardV2.jsx` L101 says so). So today's read action can honestly return **leader only**, for 12 countries. Capital / population need D2 (widen the updater).
- **Operator JSON** `newsCountryIntelligence/src/country_facts.json` (last reviewed 2026-04-18): 12 entries, **only Iran is `verified: true`** (Taiwan and others carry a TODO). It is free text, used in the country prompt, and lives in two Lambda zips. Iran's operator text and the Wikidata row agree (Mojtaba Khamenei).
- Precedence (memory rule): operator JSON > Wikidata `FACTS#` > search. The card reads only `FACTS#`, labels the source "Wikidata" and shows the date the check ran; for Iran the two agree.

### 0.5 D9: how bad, and what a heuristic can catch
- I ran the existing frontend `checkDirectionInText` / `checkDirection` over all **190** stored country notes (`DRIFTLOG#`, 12 countries): 3 text hits + 8 numeric hits, but by eye **at least 3 of those 11 are false positives** (Germany 2026-08-04 "Rhine falling to a record low … economic score up": "falling" is read as improving; the overall-score check misfires when axes move in opposite directions because the score is the max of the axes). And it **misses** real contradictions phrased without "score up/down". Reading all 18 Iran notes: 07-29 ("disrupted economic stability, lowering the economic score"), 07-30 ("humanitarian score down due to increased casualties"), 08-04 ("reducing the humanitarian risk score as … de-escalation becomes less certain"), 08-17, 08-19 (the operator's example) and probably 08-09 are contradictory, about 5–6 of 18 (consistent with the plan's "6 of 14").
- So a regex alone is not enough. The reliable lever is to have the model state, per moved axis, whether the cited event **worsens or improves** that axis, and compare that word to the sign of the stored delta in code (no NLP), then use the regex only as a second guard on the prose.
- Notes carry `changeScore.delta` and `changeDimensions{axis:{from,to,delta}}` already (both country and thread notes), so the validator needs no new data.

### 0.6 Regions
- `COUNTRY#…/COUNTRY_INTELLIGENCE`: 50 rows; **7 are not countries** (European Union 2026-07-28; Asia, Europe, Americas, Africa, Global, Middle East 2026-09-11/12); 17 rows are older than 30 days (16 real countries + the EU). The 6 region rows are still "fresh" (< 30 days) until about **2026-10-11**, so the age rule alone would not hide them yet; the region rule is needed now.
- `SYSTEMS#…`: 17 rows; **Europe, Asia, Middle East, Americas were regenerated today (2026-09-30)** by the manual chain run: `newsSystemsAnalysis` `groupByCountry` (L143–160) takes every `regions` string with ≥ 4 entries and ranks by count, so region strings win the top-N slots.
- Readers: `newsPostDevTo` `loadCountryIntelligence` (L52–65; the brief's country block and `countryToWatch` can name "Middle East"), `newsBreakingAlert` `maxRegionRisk` (L108–116), `newsWeeklyBrief` (L60–66), `newsSignals` (L165–172, scans every `COUNTRY#` row). The real-country rule is `isCountryName` in `newsCountryIntelligence/src/refreshPolicy.js` (ISO3 table 2.7 KB + `placeNames.json` 4 KB, 270 names). The two JSON files are small, so a copy per Lambda + the shared-sync guard is the repo's existing convention (pattern (e) in `check-shared-sync.mjs`).
- Frontend `CountryListPage.jsx` L242–275: `countries` is built from the archive `regions`, so region keys appear in the ranked list; `slice(0, 24)` (L275) feeds `useCountryIntelligence`. The frontend's `ISO3_NAME` table covers only crisis-context countries, so it is not a usable "real country" test (a bundled `placeNames.json` copy is).

### 0.7 Phone measurements (Playwright, local dev server, viewport 390 × 844; server stopped afterwards)
- **Country sheet:** `/map?country=Iran` → `.sheet.sheet-half` occupies y = 406–786 (380 px); `.sh-mapwrap` starts at **y = 556** (the HUD blocks above the map are 556 px tall) and is 506 px high. So the visible part of the map (556–844) is **entirely under the sheet**. `peek` (120 px) would still cover y = 666–786. The sheet is not "too big"; the map pane sits below the fold.
- **`/weekly/country/:name` overflow:** could not reproduce in this session, because the local dev origin cannot load the proxy data (no risk pill, no traj pill, the select is 42 px wide), so `scrollWidth` = 390. The 454 px figure is from the 2026-09-29 Batch 1 measurement (live data). The overlay is a single non-wrapping flex row (`.cpg-map-overlay`: back link 107 px + select "Country (n)" + risk pill + trajectory pill) with no rule below 960 px for `.cpg-map-overlay-right`; the maths matches. The fix must be verified with a data-bearing origin (the dev server on port 5173, the origin the proxy allows, per the earlier session) or by injecting a long select + both pills.

### 0.8 Deploy facts (read-only)
- `main` is an ancestor of `map-console`: **0 commits behind, 56 ahead; `git merge-tree --write-tree` is clean (tree 4932258…); a fast-forward is possible.** Pages serves `main:/docs` (`gh api …/pages` → branch main, path /docs). `docs/` is identical on both branches for the moment (no docs diff), 269 files / +24.5 k lines differ in `src`.
- Prod today: `/economy`, `/map`, `/briefings` and a bogus path all return **404** to browsers and to Googlebot (the Worker SPA fallback is not deployed; the map console is not deployed); `/daily` with a bot UA returns 200 `cf-worker-bot`.

---

## 1. Phase A: archive re-dating (read fix a)

**Goal:** an entry is dated by its own `archivedAt`; nothing old is ever stamped "today".

**Resources:** the 8 read sites in §0.1; `newsSensitiveData/src/index.js` L1682, L1838; `today-archive`, `latest`, `archive#D` in `NewsCache`; no env.

**Deployed vs repo:** `newsSensitiveData-dev` (`UKSnvW9…`, 85 s / 512 MB) identical (only `event.json` repo-only). `newsThreadAnalysis` (`pV15UQ…`, 630 s) identical. `newsCountryIntelligence` (`1KvJt7…`, 603 s) identical. `newsSystemsAnalysis` (`2Bu4np…`, 300 s) dead fallback string only (repo newer). `newsWeeklyBrief` (`89/Llp…`, 300 s) same. `newsDriftCorrector` (`iBAAoJ…`, 120 s) same. `newsPostDevTo` (`tga1S6…`, 240 s) same. So the repo is the base for all seven; no real divergence.

**Exact change:**
```js
// dayZero.js (identical in six Lambdas; CommonJS; pure)
function utcDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
// today-archive entries count as "today" only if THEY were archived today (UTC). An older entry is
// already in its own archive#<day> row (the writer puts every entry in both), so dropping it loses nothing.
function keepDayZero(entries, nowMs = Date.now()) {
  const today = utcDay(nowMs);
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    const t = Date.parse(e && e.archivedAt);
    return Number.isFinite(t) && utcDay(t) === today;
  });
}
module.exports = { keepDayZero, utcDay };
```
- Six reader loops: `for (const e of (i === 0 ? keepDayZero(Item.entries) : Item.entries))`.
- `newsSensitiveData/lib.js`: `latestDayLabel(latestItem)` = `updatedAt || activatedAt` as `YYYY-MM-DD`, or `null`. `readArchiveRange`: key the day-0 result by that label (skip when `null`); the loop for days 1..N then overwrites the same key when an `archive#` row for that date exists (richer, same content). `readNarrativeThread`: day 0 entries get `date = latestDayLabel`, then de-duplicate by `topicId + date` after the loop (the archive row for that date holds the same entry).
- Midnight edge (an entry archived 23:55 D-1 still in `today-archive` at 00:10 D): dropped from day 0, present in `archive#D-1`, which the loops read as day 1. No loss.
- `scripts/check-shared-sync.mjs`: new pair for `dayZero.js` (byte-identical, zero tolerance, like `riskDimensions.js`).
- **Zips list files explicitly** (Batch 2 notes `threadPolicy.js` etc.): every zip above must include `dayZero.js`; verify with `unzip -l` on the built zip and after deploy compare deployed vs repo byte-for-byte (Batch 2 method).

**Tests:** `dayZero.test.js`: (1) entry archived today kept; (2) entry from 13 Sep in `today-archive` dropped; (3) missing / invalid `archivedAt` dropped; (4) UTC-midnight boundary; (5) non-array input. `lib.test.js`-style tests for `latestDayLabel` (fresh, 17-day-old, missing). A local **stale-fixture harness** (node, stubbed DynamoDB client, the real `archive#2026-09-13` row supplied as `latest`) runs `readArchiveRange` and `readNarrativeThread` and must show the day-0 label `2026-09-13`, not today. Existing suites: `newsThreadAnalysis` `threadPolicy.test.js` (8), `newsCountryIntelligence` `refresh.test.js`, `newsDriftCorrector` `lib.test.js`, `newsSensitiveData` `capForTier.test.js` must still pass.

**Verification now (no LLM, no writes, pre-approved):** `node scripts/check-archive-dates.mjs` (read-only; reproduces §0.1: 51 rows, 0 mis-dated); `aws lambda invoke … newsThreadAnalysis {"dryRun":true}` before and after the deploy: selected threads and their `newestDate` (Batch 2 `dryRun`: no LLM, no writes); `newsCountryIntelligence {"dryRun":true}`; a public `archive_range {days:7}` and `narrative_thread` call through the proxy (read-only): day-0 label = date of `latest.updatedAt` (today). No real LLM run is needed for A.

**Rollback:** re-deploy the saved prior zip for each Lambda (`update-function-code --zip-file fileb://<saved zip>`); hashes recorded above; a redeploy of the same bytes gives the recorded `CodeSha256`. **Risk:** low. The change only removes entries that are stale for day 0. Watch: the first scheduled runs after deploy (04:40 story analysis, 05:00 systems, 05:15 countries, 05:30 drift) must still find entries (the 04:25 agent run writes fresh ones first).

---

## 2. Phase B: `latest_daily_brief` (read fix b)

**Goal:** one call returns the newest daily brief; a cold `/map` makes one brief request.

**Resources:** `newsSensitiveData/src/index.js` (`daily_brief` L356 for the style); table `SummarizeAndPredict` key `DAILY_BRIEF#<date>` / `DAILY_BRIEF`; proxy client `restProxy.js` L187; hook and 7 callers in "Changes".

**Deployed vs repo:** identical (see A). Same Lambda as A / D / F: **deploy after A is verified, then B, D, F each as its own deploy.**

**Exact change (Lambda):**
```js
// action === 'latest_daily_brief'  payload { lookbackDays? }  (default 30, max 60)
// keys = DAILY_BRIEF#<today - i> for i in 0..lookback-1  ->  one BatchGetItem (<= 100 keys)
// retry UnprocessedKeys once; pick the item with the greatest dateKey (lib.pickLatestBrief)
// response: { success:true, data: { ...brief }, dateKey, editions:[<dateKey>, ...] }   // data:null when none
```
Same field stripping as `daily_brief` (drop `PK`, `SK`, `ttl`). `editions` is free (the batch already returned every row in the window); it lets `/briefings` drop its 14-probe editions index. Cost: 30 keys × ~5 KB ≈ 150 KB read per uncached call; the frontend caches 30 min.

**Exact change (frontend):** `fetchLatestDailyBrief()` in `restProxy.js`; `useDailyBrief(dateKey)`: when `dateKey` is undefined, one shared in-flight promise → `{ data, served: data.dateKey }`, cached with the current 30-min TTL (also caching "nothing found"); when a `dateKey` is given (DailyPage `/daily/:dateKey`, BriefingsPage `?date=`), keep the existing today-then-walk logic unchanged (rare, user-initiated). On a request failure the hook reports the error and returns no brief (no fallback UI). `MAX_LOOKBACK_DAYS` stays (30) and is passed as `lookbackDays`.

**Tests:** Lambda: `pickLatestBrief` (newest of several, none, ties, unprocessed keys retried). Frontend: `useDailyBrief.test.js` add (a) two mounts with no date → `fetchLatestDailyBrief` called once, `fetchDailyBrief` never; (b) `data:null` cached; (c) explicit date behaves as before; update the mocks in `layout.test.jsx`, `accountShell.test.jsx`, `deskPanel.test.jsx`, `useDailyEditionsIndex.test.js`.

**Verification now:** after the Lambda deploy, call the action through the proxy (public read): expect `dateKey` 2026-09-30 today (or the newest), `editions` newest first; unknown-action behaviour unchanged for others. **Browser (frontend, later):** cold `/map` network tab shows exactly one `latest_daily_brief` and zero `daily_brief`. No LLM.

**Rollback:** Lambda: prior zip; the new action is unused by the deployed frontend, so it is inert. Frontend: `git revert` of the hook commit. **Risk:** low. Note: the deployed (old) frontend never calls the new action, so ordering is safe.

---

## 3. Phase C: `topStories[].threadId` (read fix c)

**Goal:** each top story carries the real `threadId` of the archive entry it came from, or `null`.

**Resources:** `newsPostDevTo/src/index.js` L206–230 (`generateAndStoreDailyBrief`), `loadThreadAnalyses` L34, `resolveRealThreadId` L67; record `DAILY_BRIEF#<date>`; frontend files in "Changes".

**Deployed vs repo:** `newsPostDevTo` deployed `tga1S6…` vs repo: only the dead fallback model string (repo newer). Repo is the base. Schedule `InvokeDev` `cron(0 23 * * ? *)` Asia/Tokyo = 14:00 UTC (unchanged).

**Exact change:** `threadLinks.js`:
```js
// resolveStoryThreadIds(topStories, entries, threadAnalyses) -> topStories with .threadId (string|null)
// 1 normalized-title exact match against archive entries that have a threadId (regions ignored)
// 2 else containment (either way, min 12 chars), 3 else token Jaccard >= 0.6 (same tokenizer as the drift lib)
// if the best matches point at more than one different threadId -> null (ambiguous is not a link)
// threadAnalyses is only a tie-breaker (a thread with an analysis wins); no match -> null
```
No prompt change (the model is not asked for ids, so it cannot invent one). Old briefs keep no `threadId` and the frontend renders them as today.

**Frontend:** in `StorySlide` (`BriefingSlides.jsx`), `ReadAsText.jsx` and `DailyPage.jsx`: `story.threadId ? <Link to={threadPath(story.threadId)}>Read the full story →</Link> : null`. `briefingSlides.js` L8–10 comment corrected. Never a link to a route that does not exist (`threadPath` returns `/weekly` for a blank id, so guard on truthiness first).

**Tests:** `threadLinks.test.js` with the real 2026-09-30 topStories titles + archive fixture (exact, paraphrased, ambiguous, no match); frontend render test as listed.

**Verification now (no LLM, no writes):** a read-only script pass of `resolveStoryThreadIds` over the stored `DAILY_BRIEF#2026-09-30` topStories and `archive#2026-09-30` entries (expect most of the 8 to resolve; print the ones that do not). **After the deploy:** the scheduled 14:00 UTC run writes real `threadId`s (check the row with a DynamoDB read; that is the one LLM call the schedule already makes). A manual `newsPostDevTo` invoke would overwrite today's edition with 1 v4-pro call (~$0.006 est.); I recommend **waiting for the 14:00 run** instead (Q5). Then click a `/briefings` story link and a `/daily` one in a browser.

**Rollback:** prior zip (the frontend ignores a missing field). **Risk:** low; wrong links are the only failure mode, which the ambiguity rule and the 0.6 threshold guard (corpus check in the script above).

---

## 4. Phase D: country facts (read fix f)

**Goal:** a public read action for the stored facts and a facts row on `CountryCardV2`, only for facts that are sourced and fresh, each with its as-of date.

**Resources:** `FACTS#<country>/COUNTRY_FACTS` (§0.4); Scheduler `Fact` (weekly Mon 05:00 JST); `CountryCardV2.jsx` L101–113; `restProxy.js`.

**Deployed vs repo:** `newsSensitiveData` identical; `newsCountryFactsUpdater` (`e2Tg5b…`, 183 s / 128 MB): repo differs by one improved ACLED error log line (repo newer, harmless).

**D1: exact change (no cost, no new source):**
- Lambda `country_facts { countryNames[≤15] }` → `{ [name]: { headOfState:{name,since}, headOfGovernment:{name,since}, leadershipString, source:'wikidata', lastUpdatedAt } }`. No `acledData`, `PK`, `SK`, `ttl`. A missing row = key absent.
- Frontend `factRows(facts, now)`: shows a leadership row only when `source` is set and `lastUpdatedAt` is within **10 days** (weekly job + 3 days' grace; because TTL is disabled a dead job would otherwise show stale leaders forever). Label: "Leader: <name> (since <date>) · Wikidata, checked <date>". For a country without a row, nothing is shown (no placeholder). If a later `capital` / `population` field exists it is shown with its own as-of (population: the data year, like `countryMacro.js`).
- Operator JSON precedence: only Iran is `verified:true` and it agrees with Wikidata; the display reads `FACTS#` only. A read-only check script comparing the operator text with `FACTS#` for the 12 countries is included in the tests (flags disagreement to the operator; does not change what is shown).

**D2 (optional, needs the operator's yes: it changes what a Lambda writes; still free: Wikidata; no LLM):** widen `newsCountryFactsUpdater`: resolve the QID by ISO3 (`P298`) from `iso3Names.json` instead of 12 hard-coded QIDs; add `capital` (P36) and `population` (P1082, latest by `P585`, keep the year); target list = the top ~40 briefed countries. Wikidata rate: 0.6 s sleep × 40 = 24 s, well inside 183 s. Verification: one manual invoke (no LLM) with `{"countries":["Japan","Germany"]}` then read the rows. Population can be wrong or lagging on Wikidata; the row shows its year and source.

**Tests:** Lambda `countryFacts.test.js` (field stripping, ≤ 15 names, missing row); frontend `countryFacts.test.js` (fresh shown, 11-day-old hidden, no source hidden, no row hidden); card render test.

**Verification now:** through the proxy, `country_facts {countryNames:["Iran","United States","Japan"]}` → Iran and US present, Japan absent. Browser: the Iran and US cards show the row with the date; Japan shows none; desktop and 390 px. **Rollback:** prior zip / revert. **Risk:** low; the accuracy risk is Wikidata itself, hence the source + date label and the 10-day cut-off.

---

## 5. Phase E: D9 drift-note direction check

**Goal:** a drift note's `whyChanged` never explains a lower score with a worsening (or the reverse); when it cannot be fixed after one retry, we store the numbers, not the contradictory text.

**Resources:** `newsDriftCorrector/src/{index,lib}.js`; records `COUNTRY#<c>` and `THREAD#<id>` `DRIFT#<date>` (60-day TTL, TTL disabled) + `DRIFTLOG#<date>` (permanent); schedule `TriggerDriftCorrector` 05:30 UTC; env `GROK_MODEL` (flash), `GROK_API_URL`, `XAI_API_KEY`; frontend consumers listed in "Changes".

**Deployed vs repo:** `iBAAoJ…` (120 s / 256 MB) vs repo: only a dead fallback model string + comment (repo newer). Base = repo. Timeout: the retry adds at most one LLM call per move; with ≤ ~12 countries and few moves per day 120 s stays enough, but to be safe raise to 180 s (env-free, `update-function-configuration --timeout`, Q9).

**Exact change:**
1. **Prompt** (`buildDriftPrompt`): give the sign in words for every moved axis ("economic: risk ROSE 80→90 (conditions worse)", "humanitarian: risk FELL 90→70 (conditions better)"); state "a higher score is worse"; require `axisEffects` = `{ "<axis>": "worsens" | "improves" | "unclear" }` for each moved axis describing what the CITED EVENT does to that axis; require `whyChanged` to describe why risk moved in the stated direction; "if the event does the opposite of the score movement, choose noSingleDriver".
2. **Validator** (`directionCheck.js`, pure): (a) per moved axis: `worsens` with delta < 0, or `improves` with delta > 0 = mismatch; (b) the ported prose check on `whyChanged` (`checkDirectionInText` clause splitter + a per-axis clause test), **tuned to fail toward silence**: drop the ambiguous words `falling|fallen|risen|rising|cooling|eased?` (the Germany 4 Aug false positive), add the verb forms the current regex misses ("lowering the economic score", "driving … down", "raising … score"); (c) `unclear` passes.
3. **Retry once** with the concrete mismatch in the message ("You said the humanitarian axis worsens, but its score fell 90 → 70").
4. **On the second failure:** write the note with `noSingleDriver: true`, no `triggerEvent`, `whyChanged` = a deterministic sentence built from the numbers only ("Humanitarian risk fell 20 points (90 → 70). No listed event explains a move in this direction."), and `directionFlag: { axes, attempts: 2, at }`. The rejected model text is logged to CloudWatch, never stored or served. On a retry that passes, store the passing note with no flag.
5. `dryRun`: `event.dryRun` lists the pending moves and the validator's verdict on existing stored notes; no LLM, no writes.
6. Same code path for thread notes (`processThread`, `writeThreadNote`).
7. **Guard:** the regex sources are compared against the frontend `directionCheck.js` by `check-shared-sync.mjs` (marker extraction), so the two ports cannot drift.

**Existing notes:** `scripts/audit-drift-direction.mjs` scans `DRIFTLOG#` for the 12 countries and the thread notes, default heuristic only (no LLM, read-only). My preliminary numbers (§0.5): 190 country notes; the current frontend heuristic flags 11 (≥ 3 false positives) and misses several real ones, so the heuristic list is a **candidate list, not a verdict**. Two gated follow-ups: `--llm` = one `deepseek-flash` valence classification per note (~190 short calls, roughly $0.03–0.06 estimated, real LLM, needs the operator's go); `--write-flags` = an additive `UpdateItem SET directionFlag = :f` on the confirmed `DRIFT#` **and** `DRIFTLOG#` rows (text untouched, reversible with `REMOVE directionFlag`; not destructive; needs a fresh yes with the reviewed list).

**Frontend (should we hide or flag existing contradictory notes? Yes, hide the text):** `isNoteTrusted(note)` = `!note.directionFlag`; every reader that shows `whyChanged` skips flagged text and shows the numeric change only (the Studio picture keeps its own explicit flag display). It is safe to ship before any flag exists (no flags = no change).

**Tests:** `directionCheck.test.js` fixtures from the real notes: Iran 07-29 / 07-30 / 08-04 / 08-19 must flag; Iran 07-28 and 08-06 (consistent) must pass; Germany 08-04 and China 08-13 (the current false positives) must pass; multi-axis opposite-direction notes pass. Retry flow with a stubbed `callLLM` (bad then good; bad then bad → flagged deterministic text). Existing `lib.test.js` (14 cases) must pass.

**Verification now (no LLM, no writes):** `node scripts/audit-drift-direction.mjs` (heuristic) → candidate list for the operator; Lambda `dryRun`. **LLM (minimal, after deploy, needs a go):** one `newsDriftCorrector {"country":"Iran"}` invoke would only write if a *new un-noted* move exists (it skips already-noted days), so a real end-to-end proof waits for the next real score move; the stubbed retry test is the pre-deploy proof.

**Rollback:** prior zip; flags are removable by attribute; frontend revert. **Risk:** medium-low. The prompt change can shift note wording; the validator can over-flag (mitigated by silence-on-doubt) and a flagged note shows numbers instead of prose (honest, not broken).

---

## 6. Phase F: region leftovers

**Goal:** regions and aggregates are neither briefed nor read as countries; stale country records are ignored.

**Resources:** `newsCountryIntelligence/src/refreshPolicy.js` (`isCountryName`, `normKey`, `canonicalName`), `iso3Names.json`, `placeNames.json`; readers in §0.6; DynamoDB rows `COUNTRY#<region>` (7) and `SYSTEMS#<region>` (4) stay.

**Deployed vs repo:** `newsSystemsAnalysis` dead-string only; `newsPostDevTo`, `newsWeeklyBrief` dead-string only; `newsBreakingAlert` (`fH11Us…`) and `newsSignals` (`PJcv1R…`) identical. Repo is the base.

**Exact change:**
- `placeFilter.js` (Systems) and `recordPolicy.js` (the four readers): `isCountryName(name)` copied from `refreshPolicy.js` (with `canonicalName` aliases), and `usableCountryRecord(name, rec, nowMs)` = `isCountryName(name) && Date.parse(rec.generatedAt) >= nowMs - 30 d`. Missing `generatedAt` → not usable (fail empty).
- `newsSystemsAnalysis.groupByCountry`: `.filter(c => isCountryName(c.countryName))` before the sort / top-N; add `dryRun` (prints the targets, no LLM, no writes).
- `newsPostDevTo.loadCountryIntelligence`: skip unusable records (so `countryToWatch` cannot be "Middle East"). `newsBreakingAlert.maxRegionRisk`: skip unusable regions. `newsWeeklyBrief`: skip in the top-countries loop. `newsSignals`: skip unusable rows in the `COUNTRY#` scan (a Signal API consumer never sees a region as a country; this changes the served signals document, a consumer-visible change: note in CHANGES).
- `newsSensitiveData.world_overview`: skip `SYSTEMS#<region>` rows with the existing `COUNTRY_NAME_SET` (verify it contains Kosovo, Taiwan, Palestine, Hong Kong before relying on it; otherwise use the same copy).
- Frontend: `isRealCountryName` (bundled `placeNames.json` copy) in `CountryListPage.jsx`: filter `countries` first, then `slice(0, 24)`, so region keys leave both the ranked list and the "other countries" bucket.
- Guard pair (f) in `check-shared-sync.mjs` for the six `placeNames.json` / `iso3Names.json` copies.
- **No deletion** of the existing region rows (destructive data ops need a fresh yes). They simply stop being read.

**Tests:** per-Lambda `placeFilter.test.js` / `recordPolicy.test.js` (Europe, Asia, Middle East, Americas, Africa, Global, European Union rejected; Iran, Taiwan, Palestine, Kosovo, "USA" accepted; a 31-day-old real record rejected); frontend `placeNames.test.js`; a `CountryListPage` render test with region keys in the archive.

**Verification now (no LLM, no writes):** re-run my two read-only scans through the new helper: expect 7 of 50 `COUNTRY#` and 4 of 17 `SYSTEMS#` rows rejected, plus the 17 stale `COUNTRY#` rows rejected by age. `newsSystemsAnalysis {"dryRun":true}` → target list has no region. After the next scheduled 05:00 UTC run: log line `Analyzing:` shows no region and no new region `SYSTEMS#` row (`generatedAt` of Europe stays 2026-09-30). No manual LLM run needed.

**Rollback:** prior zips / revert. **Risk:** low. Watch: the systems run must still produce its 5–10 country webs (regions no longer consume slots, so more real countries qualify).

---

## 7. Phase G: code-drift audit (news Lambdas only)

See the table in §9. Method (read-only): `aws lambda list-functions`; for each of the 37 news Lambdas `get-function` → download the zip → unzip → `diff -r` against `amplify/backend/function/<name>/src/`, excluding `node_modules` and `package-lock.json`. Excluded by instruction: PPA*, Polybot*, GCF*, OpenAIProxy, geminiCurrency, currencyRouter. Also present but not news and not audited: `LogWaifuActivity-dev`, `MemoryLambda-dev`, `requestUpload-dev`, `ecbHistory-dev`, `imfHistory-dev`, `amplify-newsproject-dev-2-UpdateRolesWithIDPFuncti-…` (flag if the operator wants them in scope).

**Result: 11 identical, 12 identical apart from repo-only test / `event.json` files, 9 trivial (dead strings / comments / a log line), 3 real divergence, 2 sandbox snapshots.** In every trivial and every real case except `newsAnalyze` the **repo is the newer side**. Nothing is behind in the repo except the patched `newsAnalyze`.

**Proposed actions:** (1) identical / trivial: no action; the edits ride the next real deploy of that Lambda (the trivial ones are dead fallback strings that never run because the env vars are set). (2) `newsAnalyze`: record only; **never deploy the repo copy**; optionally commit a snapshot of the deployed source (`newsAnalyze/deployed-snapshot/index.js`, Q10) because the patched zip is today the only copy (an AWS-side loss would mean re-deriving it from the repo minus the credits code). (3) `newsEmailSender`: repo has the member-perk copy in the breaking-alert footer and the weekly email; it is **not deployed**. That is user-facing email copy, so leave it undeployed until the operator decides (Q11). (4) `newsGdacsIngest`: the repo `situations-core.js` has the Phase-1 threadId latch; the deployed copy predates it. The latch is in the news-situation path, which only `newsSituationTracker` runs (its deployed copy equals the repo), so the difference is inert for GDACS; the sync guard already treats the two repo copies as a pair. Leave; the next GDACS change ships it. (5) the two `-sandbox` Lambdas have no repo directory (created by `_sandbox/deploy-sandbox.sh`); they are older snapshots of the parked credits code; leave.
`scripts/audit-lambda-drift.sh` makes the audit repeatable (read-only; prints the table; never uploads).

**Tests / verification:** the script's output equals §9. **Rollback:** delete the script / snapshot. **Risk:** none (no deploy).

---

## 8. Phase H: two phone fixes

**H1 `/weekly/country/:name` overflow.** `CountryPage.css` L19–31, L71–75, L93: `.cpg-map-overlay` is one flex row; add inside the existing `@media (max-width: 600px)` block (L749): `.cpg-map-overlay { flex-wrap: wrap; gap: 8px; padding: 8px 16px; }`, `.cpg-map-overlay-left { flex: 1 1 100%; min-width: 0; }`, `.cpg-country-select { flex: 1; min-width: 0; max-width: 100%; }`, `.cpg-map-overlay-right { flex-wrap: wrap; }`, and give `.cpg-map-hero` a taller `min-height` (~190 px) so two rows do not cover the map. Nothing is removed (both pills stay). Verify: 390 px with a long name ("Democratic Republic of the Congo") and both pills; `document.documentElement.scrollWidth === 390`; clicks on the select, Back link and the map. Needs a data-bearing origin (§0.7).

**H2 `/map` country sheet.** Cause (measured): the map pane starts at y = 556, the sheet at `half` covers y = 406–786, so no map is visible. Fix in `SituationHome.jsx`: (a) when a **country** is selected on phone the sheet opens at `peek` (title + risk line) instead of `half`; situations and stories keep `half`; (b) on any phone selection scroll `.sh-mapwrap` into view (`scrollIntoView({block:'start'})` under the sticky bar; `behavior:'auto'` under reduced motion) so the country is on screen above the sheet. The country card's own content stays reachable with Expand (44 px targets, existing). Verify: 390 × 844, select a country from the list and from the map; sheet at `peek`, the country polygon visible; Expand / Collapse / Close / Esc; focus returns (existing tests `bottomSheet.test.jsx`, `phoneLayout.test.jsx` must pass). If the operator prefers `half` with the map scrolled to the top, only the stop constant changes (Q12).

**Rollback:** revert. **Risk:** low (CSS + one selection effect).

---

## 9. Drift-audit table (deployed zip vs repo `src/`, 2026-09-30)

| Lambda (deployed name) | Repo dir | Class | What differs | Newer side | Proposed |
|---|---|---|---|---|---|
| NewsProjectInvokeAgentLambda-dev | NewsProjectInvokeAgentLambda | identical | repo-only `event.json` | — | none |
| newsBreakingAlert | same | identical | repo-only `test-significance.mjs` | — | none |
| newsClientErrors | same | identical | — | — | none |
| newsCountryFactsUpdater | same | trivial | one ACLED error log line (`… — ${body}`) | repo | none (ships with D2 if approved) |
| newsCountryIntelligence | same | identical | repo-only `event.json` | — | none |
| newsDriftCorrector | same | trivial | fallback `deepseek-chat` vs `deepseek-v4-flash` + comment | repo | none (rides phase E) |
| newsEconomicImpact | same | trivial | fallback string + comment (parked Lambda) | repo | none |
| newsEconomicQuality | same | identical | — | — | none (parked) |
| newsEmailSender | same | **real** | repo adds the member-perk teaser: `index.js` `appendUnsub` (breaking footer) + `renderWeeklyEmail.js` (text + HTML block) | repo (not deployed) | leave; deploy only on operator decision (Q11): user-facing copy |
| newsErrorDigest | same | identical | — | — | none |
| newsFreshnessMonitor | same | identical | — | — | none |
| newsGdacsIngest | same | **real (inert)** | `situations-core.js`: repo has the threadId latch (`opts.threadId \|\| prev.threadId`); deployed lacks it | repo | leave; ships with next GDACS change (news path runs in the Tracker only) |
| newsGdeltConflict | same | identical | repo-only `.gitignore` | — | none |
| newsImpactAudit | same | identical | — | — | none (parked) |
| newsInvokeGemini-dev | newsInvokeGemini | trivial | fallback `grok-4-1…` vs `deepseek-v4-flash`; repo-only `.DS_Store`, `test_enrichment.js` | repo | none |
| newsMarketsData | same | identical | — | — | none |
| newsModelGuard | same | identical | — | — | none |
| newsPairIntelligence | same | trivial | fallback string + comment (dormant) | repo | none |
| newsPolarBilling | same | identical | — | — | none |
| newsPostDevTo | same | trivial | fallback string | repo | none (rides A / C / F) |
| newsPostLinkedin | newsPostLinkedIn (case differs) | identical | repo-only `event.json` | — | none |
| newsPredictionResolver | same | trivial | fallback + comment (parked) | repo | none |
| newsPredictionsSnapshot | same | identical | repo-only `trackRecord.test.mjs` | — | none |
| newsRecommend | same | identical | repo-only `test-scoring.mjs` | — | none |
| newsSavedItems | same | identical | — | — | none |
| newsSensitiveData-dev | newsSensitiveData | identical | repo-only `event.json` | — | none (rides A, B, D, F) |
| newsSignals | same | identical | repo-only `test-adapter.mjs` | — | none (rides F) |
| newsSituationIngest | same | identical | repo-only `classifier-core.test.mjs` | — | none |
| newsSituationTracker | same | identical | repo-only `index.test.mjs` | — | none |
| newsSourceAudit | same | identical | — | — | none |
| newsSystemsAnalysis | same | trivial | fallback `grok-4-1…` vs `deepseek-v4-pro` + comment | repo | none (rides A / F) |
| newsThreadAnalysis | same | identical | repo-only `event.json` | — | none (rides A) |
| newsWeeklyBrief | same | trivial | fallback + comment | repo | none (rides A / F) |
| newsWeeklyMarkets | same | identical | — | — | none (parked) |
| **newsAnalyze** | newsAnalyze | **real, known** | deployed = pre-credits patched zip (179-line `index.js`, no `lib.js`); repo = 235-line `index.js` with the parked credits code + `lib.js` + new `package.json` scripts | neither: deployed is what serves; repo carries parked credits | **record only. Never deploy the repo copy**; optional snapshot commit (Q10) |
| newsAnalyze-sandbox | none (`_sandbox/deploy-sandbox.sh`) | real (snapshot) | older copy of the repo credits code (fallback model `deepseek-chat`, shorter prompt) | repo | leave (parked) |
| newsPolarBilling-sandbox | none | real (snapshot) | older than repo `newsPolarBilling` (the repo has the `productId` guard) | repo | leave (parked) |

Counts: 11 identical (no differences) + 12 identical apart from repo-only test / event files = 23; 9 trivial; 3 real (`newsEmailSender`, `newsGdacsIngest`, `newsAnalyze`); 2 sandbox snapshots = 37.

---

## 10. Phase I: deploy readiness (plan only; NOTHING here is executed)

Every step needs its own fresh operator "yes" (`./deploy.sh`, and the Worker deploy, each separately; `--push` rides the deploy gate).

**What `./deploy.sh` does (read):** hashes `docs/config.js`; `npm run build` in `global-perspectives-starter/frontend` (`prebuild` runs `eslint . --max-warnings 20`; `postbuild` copies `dist/index.html` to `dist/404.html`); checks `dist/index.html` and ≥ 2 files in `dist/assets`; `rm -rf docs/assets`, copies `dist/assets` and `dist/index.html`; deletes `docs/assets/*.map`; copies `docs/index.html` to `docs/404.html` and diffs them; re-hashes `docs/config.js` and aborts if it changed. With `--commit "msg"` it runs `git add docs/assets docs/index.html docs/404.html global-perspectives-starter/frontend/src/` **(the whole `src/` tree, so the working tree must be clean of unrelated edits)** and `CHANGES.md`, then commits; `--push` also runs `git push`. It does not touch `docs/sitemap.xml`.

**What the Worker deploy involves (D10):** the Worker is `globalperspective-rss`, source of truth `project-docs/distribution/WORKER_FULL_CODE.md`; **there is no wrangler project or `wrangler.toml` in the repo** (searched), so a deploy is a paste into the Cloudflare dashboard (or a new wrangler project, not present); I did not verify `wrangler` login. Already prepared in that file: the SPA-fallback branch (any non-asset GET → the shell with 200, `X-Rendered-By: cf-worker-spa-fallback`, after `/data/*`, `/rss` and the bot branches) and its test plan (L459–500), plus `STAGE0_sitemap_proposed.xml` (23 URLs). **Not yet prepared (to add before deploying):** the `/briefings` bot pre-render branch (today's file has none; source = `latest_daily_brief` from phase B, with `?mode=weekly` → `weekly_brief`), a skip for `/analyze/s/*` (share links; the route does not exist yet, D5 is later, so the skip is a harmless no-op today), `/map`, and switching the `/daily` 7-day probe to `latest_daily_brief`; add `/briefings` and `/map` to the sitemap. Prod facts (§0.8): the fallback is not live (`/economy` → 404).

**Merge `map-console` → `main`:** read-only comparison done: `git merge-tree --write-tree origin/main map-console` is **clean** (tree `4932258…`); `main` is an ancestor (0 behind / 56 ahead), so `git merge --ff-only map-console` works. **Not merged.**

**Order to run (after all backend phases are verified and committed on `map-console`):**
1. Local gates: `cd global-perspectives-starter/frontend && npm run verify`; `bash quality/verify_pages.sh`; `node scripts/check-shared-sync.mjs`. Working tree clean.
2. Backend already live (A–F Lambdas deployed and verified; the new frontend depends on `latest_daily_brief` and `country_facts`, so they must be live **first**).
3. Update `docs/sitemap.xml` from `STAGE0_sitemap_proposed.xml` + `/briefings`, `/map` (in the same commit as the build).
4. Operator "yes" for the frontend deploy. Fast-forward `main` to `map-console` (`git checkout main && git merge --ff-only map-console`), then `./deploy.sh --commit "<summary>"` **on `main`** (Pages serves `main:/docs`; deploying on `map-console` would leave `docs/` off `main`). Then, with the deploy "yes" covering it, `git push origin main` once (if it 403s: `gh auth switch --user BenBen05059997`, push, switch back) and let Pages settle (one push, then judge liveness by the served bundle hash; memory `reference_pages_deploy_concurrency`).
5. Post-frontend checks: `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net` → 200; `curl -s https://globalperspective.net | grep -o 'assets/index-[^"]*'` equals `docs/index.html`; `docs/404.html == docs/index.html`; `docs/config.js` hash unchanged (the script enforces it); in a browser: `/map`, `/briefings`, `/daily`, a story, a country card (desktop + 390 px), console clean, cold `/map` network tab: one `latest_daily_brief`.
6. Operator "yes" for the Worker deploy (separate gate). Update `WORKER_FULL_CODE.md` with the `/briefings` branch first; paste into the dashboard; **keep the previous version** (git history of that file + the dashboard's version list) for rollback.
7. Worker checks: the curl matrix in `WORKER_FULL_CODE.md` L459–500 (every route, browser UA and Googlebot UA → 200; bogus path → 200 shell; `x-rendered-by` = `cf-worker-bot` on `/`, `/weekly/country/<real>`, `/weekly/thread/<real id>`, `/daily`, `/briefings`; `/data/world/latest.json` 200 `cf-worker-data`; `/rss` 200 `application/rss+xml`); `xmllint --noout docs/sitemap.xml`; `node scripts/link-crawl.mjs`.
8. `CHANGES.md` + `ops/DEPLOYMENT_NOTES.md` + `WORKER_FULL_CODE.md` status flipped from "prepared" to "deployed" in one commit.

**Rollback:** frontend: `git revert` the deploy commit on `main` and push (Pages rebuilds); Worker: re-paste the previous version. **Risk:** frontend low-medium (large diff, 269 files); Worker **high** (fronts all traffic; the branch order `/data/*` → `/rss` → bot → fallback must not change).

---

## Open questions for the operator
1. **Q1 (A):** OK to fix this on the read side only? The stored rows are correct (0 mis-dated), so there is nothing to repair. `newsPairIntelligence` (dormant) and `newsEconomicImpact` (parked) are left unedited.
2. **Q2 (A):** keep the frontend `dropRedatedRepeats` (recommended; revisit in two weeks)?
3. **Q3 (B):** also return `editions[]` and cut `/briefings`' 14 edition probes (recommended: yes)?
4. **Q4 (B):** an explicit date (`/daily/2026-09-12`, `?date=`) keeps today's walk (recommended) rather than a second server action?
5. **Q5 (C):** verify on the scheduled 14:00 UTC run (recommended, zero manual LLM) or one manual `newsPostDevTo` invoke now (1 v4-pro call, overwrites today's edition)?
6. **Q6 (D):** D1 only (leader for 12 countries, dated) now; and approve D2 (capital + population + ~40 countries via Wikidata, free, no LLM)? Capital and population do not exist in storage today.
7. **Q7 (E):** run the LLM audit of the ~190 existing notes (~$0.03–0.06 est., `deepseek-flash`) before flagging? And hide the text of flagged notes (numbers stay)? Recommended: yes to both, flags written only after you review the list.
8. **Q8 (E):** on a second failed direction check, store the deterministic numeric sentence + `directionFlag` (recommended) rather than dropping the note?
9. **Q9 (E):** raise `newsDriftCorrector` timeout 120 → 180 s for the retry (recommended)?
10. **Q10 (G):** commit a snapshot of the deployed patched `newsAnalyze` source (only copy is in AWS)?
11. **Q11 (G):** `newsEmailSender` repo copy (member-perk teaser in breaking and weekly emails) is undeployed: leave (recommended: user-facing email copy is yours to approve)?
12. **Q12 (H):** country sheet on phone opens at `peek` (recommended) or `half` with the map scrolled to the top?
13. **Q13 (I):** order: Lambdas → frontend on `main` after fast-forward → Worker, each with its own yes; the Worker `/briefings` branch and sitemap additions prepared in the repo first. OK? (The Cloudflare paste has to be done by you or with your dashboard access; I cannot verify a `wrangler` login.)
14. **Q14 (general):** each Lambda phase is a separate deploy of a bare single `update-function-code`; standing authorization covers it. Confirm "execute" for A–H.
