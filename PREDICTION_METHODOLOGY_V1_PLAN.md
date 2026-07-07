# Prediction Methodology v1 — clean-start forecast pipeline

**Status:** Phase 1 **DEPLOYED 2026-07-04** (era-cut date) — `NewsProjectInvokeAgentLambda-dev` live on v1 code; verified in prod (27 `methodologyVersion:1` snapshots, gates firing live: G4 caught 3 relative-window triggers, 0 retrodictions). Phase 2 **tooling built** (`predictions/resolve-v1-*.js` + runbook; awaits ~2026-07-11 deadlines). Phase 3 **SHIPPED 2026-07-05** — `/track-record` → "Accountability" hub live (§5). Phase 4 **SHIPPED 2026-07-06** — "Living forecast" board on ThreadPage (§5). **All four phases shipped;** only the first live resolution run (weekly agent-in-session, once ~2026-07-11 deadlines pass) remains to light up verdicts.
**Decision (operator, 2026-07-04):** do NOT score the existing prediction-log backlog — rebuild the pipeline first, start the public track record at a methodology cut-date. The old log stays immutable but unscored.
**Depends on / relates to:** `LIVING_ANALYSIS_PLAN.md` (drift notes feed the accountability page; Phase 4 unblocks when verdicts flow), `PITCH.md` pillar 4, `ARCHITECTURE.md` Lambda #2/#20.

---

## 1. Why (evidence from the 2026-07-04 resolution pilot)

A 50-trigger pilot (oldest due triggers, 5 parallel verification agents, blind vs DeepSeek's `newsPredictionResolver` proposals; plus a 10-trigger blind self-consistency re-check) found:

| Finding | Number | Implication |
|---|---|---|
| DeepSeek proposals punting `unclear` | 43/50 (mostly "no search results") | proposals are hints, not verdicts; a real (agent) resolver recovers 22/33 of the punts |
| Proposals whose own citation contradicted a high-confidence `fired` | 2 | `--accept-all` would corrupt the public Brier score |
| **Retrodictions** — trigger `deadline ≤ generatedAt` | **14/50 (28%)** | the generator "predicts" events already past (or same-day) at generation → automatic wins → silent track-record inflation. THE killer defect. (A strict `<` sweep counted 8; the correct gate rule `≤` catches same-day retrodictions too — verified by running the real `lib` gates over all 50 pilot triggers: 14 G2 rejections, 0 false rejections.) |
| False-premise triggers (nonexistent SK April-2026 election; misnamed Mozambican president) | 2 | UPCOMING DEADLINES in the research pass is confabulated from parametric memory |
| Date-extraction artifacts (2021/2023 deadlines; relative window recorded as its anchor) | 3 | "must reference a specific date" pressure + no capture validation |
| Blind re-check: evidence reproduction | 10/10 (0 factual contradictions, 0 fired↔not_fired flips) | agent verification is evidence-stable; variance was rule-application, now made mechanical |

Root cause (verified in code, `NewsProjectInvokeAgentLambda/src/index.js:337-417`): predictions are generated from **48h of RSS/Brave snippets only** (title + snippet, no full text), a research pass whose HISTORICAL PRECEDENTS / **UPCOMING DEADLINES** come from **model memory (no Brave call, no FACTS# lookup)**, and **no thread history** even for month-long arcs. No validation exists between the LLM's JSON and the prediction-log write.

## 2. Era cut

- New records get `methodologyVersion: 1` + a `capture` gate-report block.
- **Scoring/serving filters on `methodologyVersion >= 1`.** Pre-v1 records are never mutated (immutable-log ethos) and never scored; the accountability page discloses this: *"predictions logged before <cut date> had trigger-generation defects; we excluded them from scoring rather than cherry-pick."*
- The false-premise scoring-policy question dissolves going forward: premise-gated triggers never enter the log, and legacy is unscored.

## 3. Phase 1 — generation rebuild (`NewsProjectInvokeAgentLambda`)

The deploy date of this phase = the birthday of the track record. Everything else can lag.

**1a. Ground the research pass.** Add Brave news+web search (same pattern as `newsThreadAnalysis`) for the topic's keywords/regions; the briefing's precedents/deadlines must cite searched or snippet material. New env: `BRAVE_SEARCH_API_KEY` (merge-don't-clobber the env map — fetch, merge, write back via temp file).

**1b. Inject verified premises.** For each `topic.regions` country with a `FACTS#{country}` / `COUNTRY_FACTS` row (Wikidata leaders, updated daily by `newsCountryFactsUpdater`), prepend `leadershipString` as a **VERIFIED FACTS** block ("these override anything you recall"). Coverage boundary: no FACTS row → no premise block (skip, don't guess). Role already has table access (it writes SUMMARIZE_PREDICT_TABLE).

**1c. Feed the thread's history.** For topics with `threadId`, include a compact arc digest (date + title for up to ~30 prior entries; the Lambda already reads the archive for Jaccard threading — reuse that read). Example: today's St Petersburg topic sits on a 44-entry, month-long arc the current prompt never sees.

**1d. Structured triggers + capture gates.** Prediction prompt emits triggers as objects `{ text, deadline: "YYYY-MM-DD" }` (deadline = the date the claim is checkable, i.e. the END of any window). Pure `src/lib.js` (node --test suite, repo pattern) validates each trigger:

| Gate | Rule | Catches (pilot example) |
|---|---|---|
| G1 date-valid | `deadline` parses as a real ISO date | — |
| G2 forward-looking | `deadline > generatedAt` (date part) | #0 (2021), #2/#3 (New START retrodiction), #42 |
| G3 horizon | `deadline ≤ generatedAt + 180d` | far-future junk |
| G4 falsifiability lint | reject relative windows ("within N days of…"), precedent references ("as seen in…"), and no-event texts | #29 (window-as-anchor), #1 (2023 precedent) |
| G5 premise check | leader names in trigger text must match `FACTS#` leadership when a row exists; skip when no coverage | #15-class (Nyusi/Chapo) — flagged at capture instead of resolution |
| G6 capture-scope (added 2026-07-07) | reject pure sporting results — requires BOTH a sporting-competition context (world cup, match, round of N, …) AND a result/participation verb (wins, starts, scores, …); sport-adjacent governance survives (no result verb) | Trump–FIFA/Balogun box-score triggers ("U.S. wins its round of 16 match", "Balogun starts"); corpus-validated: drops 2/1038, 0 false positives |

Failing triggers are **dropped from the log and counted** in the capture report (`{ dropped: [{text, gate}] }`); a scenario with zero surviving dated triggers is logged but marked unscoreable. Gates are pure functions — no LLM, no network.

**1e. Stamp** `methodologyVersion: 1` on the snapshot. Keep the existing never-throw guarantee (capture must never break the content pipeline).

**Verify (ladder):** hermetic `npm test` on lib.js; one manual invoke `{topicId, action:'prediction'}` against a live topic; read the written log row back and check gates/stamp; then let the 4h cron run and spot-check the next cycle.

## 4. Phase 2 — resolution loop v1 (agent-run, no new Lambda)

Weekly (or on-demand) agent-driven batch, per the pilot's validated design:

1. Scan for due v1 triggers (`deadline ≤ today`, no `finalVerdict`), **oldest-first, batch-complete** (no cherry-picking; publish resolved/pending ratio).
2. **Mechanical R3 pre-filter** (belt-and-braces; should be no-ops post-gates).
3. Blind independent verification (web-grounded; verdict formed before reading any proposal). `unclear` under doubt; unclear is Brier-excluded.
4. **Every `fired` gets a second blind pass**; the two passes disagreeing on scoreability → `unclear`.
5. Write `finalVerdict`, `confirmedAt`, `confirmedBy: 'agent-verified'`, `methodologyVersion: 1`. Operator blind-spot-checks ~10% per batch; agreement rate is published on the methodology page.
6. `newsPredictionResolver` (#20) may keep running as a cheap hint layer (pilot: 86% punts — hints only). Optionally point it at v1 triggers only.

## 5. Phase 3 — accountability page ✅ SHIPPED 2026-07-05

**DECISION: reused `/track-record`** (not a new route) — reversible, no equity to lose; a nicer alias + redirect stays a trivial future add. Commits `8f94806` (source) + `c76fbd9` (deploy); prod-verified (live bundle within ~30s, 404 byte-identical, both API actions curl-verified live).

The page (`components/TrackRecordPage.jsx` → "Accountability") ships three sections, exactly as scoped:
1. **Forecast record** — era-cut-framed stats + honest-empty "Scoring begins as deadlines pass" (live: eraCutFrom 2026-07-04, resolved 0, 2418 legacy excluded). Brier/calibration/recently-resolved render only once `resolvedTriggers > 0`.
2. **Corrections ledger** — `hooks/useCorrectionsFeed.js` → `corrections_feed`; recent DRIFT# notes across all countries+threads (live: 26 country notes, "elevated → high · ↳ Because: <cited event>"). The living-analysis loop's site-level home.
3. **How this works** — published methodology incl. the pre-v1 exclusion disclosure ("2418 earlier predictions … excluded rather than cherry-pick").

**Backend (`newsSensitiveData/src/index.js`, deployed):**
- `prediction_track_record` now scores **only `methodologyVersion >= 1`** — returns `eraCutFrom` + `legacyPredictionsExcluded`, reads v1 `agentVerdict.evidence` citations. Legacy backlog stays immutable + unscored.
- NEW `corrections_feed` action: Scans DRIFT# rows (same pattern as `economic_impact_list`); newest-first; client-cached 30min. **Deferred optimization (not built):** the cheap-serve `CORRECTIONS_FEED` single-row GetItem (have `newsDriftCorrector` append) — the Scan is fine at current scale + cache.
- GOTCHA: `update-function-code` replaces the whole package, so `newsSensitiveData` needs the FULL src zip (index.js + dossier.js + node_modules, ~13MB), not just index.js.

### Phase 4 — "Living forecast" board on ThreadPage ✅ SHIPPED 2026-07-06

**DECISION: latest-forecast board** (not the evolution-down-thread view — that's a later follow-on). Commits `d53e40a` (source) + `6192fcb` (deploy); prod-verified (live bundle ~30s). Built now even though verdicts don't exist yet — it renders every trigger **pending** today and the strike/check states light up automatically as Phase 2 resolution writes verdicts (~2026-07-11+). This is the user's original "living prediction" vision.

- **Backend (`newsSensitiveData/src/index.js`):** new `prediction_snapshot` action — given the thread's topicIds, parallel Query-latest per topic → returns the NEWEST `methodologyVersion>=1` `PRED#` snapshot (scenarios + dated triggers + `finalVerdict`/`agentVerdict` citations). **v1-only** (legacy snapshots never surface). Honest-empty (`snapshot:null`) when the thread has no v1 forecast.
- **Frontend:** `hooks/useThreadForecast.js` (fetches for the thread's entry topicIds) + presentational `components/ThreadForecast.jsx` rendered at the top of ThreadPage's Arc Intelligence rail (rail gate widened to `hasAiRail || hasForecast`). Scenarios (label + probability pill) → trigger checklist; states struck = `not_fired` (cited), check = `fired`, `⌛` = deadline passed / awaiting check, `☐` = open. **Never strikes prose, only dated triggers.**
- **Wiring proven:** 55/145 active threads carry a v1 forecast whose `topicId` matches its `PRED#` key.
- Follow-on (not built): evolution-down-thread view (a board per timeline entry showing forecasts made→struck→remade); "superseded/dimmed" state for revised-not-invalidated triggers.

## 6. Rollout order

1. Phase 1 (generation) — first v1 predictions within ~4h of deploy (next `InvokeNewsAgent` cycle); **every day of delay costs a day off the front of the record**
2. Phase 2 first batch — ~3–7 days later (first v1 deadlines pass)
3. Phase 3 page — ✅ SHIPPED 2026-07-05 (honest-empty scorecard + live corrections ledger)
4. Phase 4 scenario board — ✅ SHIPPED 2026-07-06 (renders pending now; verdicts light up ~2026-07-11)

## 7. Open decisions (operator)

- [x] Accountability page URL/name — **reused `/track-record`** (2026-07-05); alias + redirect deferred as trivial future add.
- [x] Resolution cadence — **agent-in-session weekly** (2026-07-05); first run once ~2026-07-11 deadlines pass.
- [x] Era-cut date = **2026-07-04** (Phase 1 deploy). `/track-record` v1 scoring starts here; pre-v1 records stay unscored.

## 8. Appendix — worked example (real data, 2026-07-04)

See `PREDICTION_V1_EXAMPLE.md` — today's live topic ("Ukraine strikes oil and military facilities near Russia's St Petersburg", threadId `thread-ukrainian-drones-strike-st-pet-b69cc4`) assembled with all three v1 input upgrades (5 real snippets + 44-entry thread digest + verified `FACTS#Russia`), a hand-worked exemplar of the v1 prediction output, and the capture gates executed against both the exemplar triggers and four real defective pilot triggers (all four correctly rejected/flagged; exemplar passes).
