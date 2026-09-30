# Backend operations plan: AI models, refresh rates, reliability — 2026-09-27 — active (decisions in progress)

**Goal:** keep the site correct and alive on a small budget. The redesign's frontend is built (branch `map-console`, see `redesign-ux/_active/TASK_2026-09-27_pages_local.md`). This plan covers the backend it runs on: which model does what, how often each job runs, and how we stop the AI from silently going dark again.

**Why now:**
- The AI pipeline has been dark since **13 Sep** (DeepSeek "Insufficient Balance"). It is the **third** lapse since July; see "Facts".
- Country briefings all pass 30 days around **11–12 Oct**, after which the country card hides every score.
- Traffic is small (~430 home visits / 30 d, 13 users, 1 member), so effort goes to reliability and honesty, not new backend features.

**Evidence** (all read-only, 2026-09-27):
- the live env of every Lambda (model / provider names; keys compared by SHA-256 only);
- the deployed zips of `newsAnalyze`, `newsCountryIntelligence`, `NewsProjectInvokeAgentLambda-dev`, diffed against the repo;
- CloudWatch metrics (30 d) and Logs Insights;
- the EventBridge rules / Scheduler;
- `newsModelGuard` and `newsFreshnessMonitor` logs;
- official provider price pages: `AI_PROVIDER_PRICES_2026-09-27.md`, next to this file.

---

## Facts found (verified 2026-09-27)
1. **Three balance lapses:** Episode A 14–24 Jul (logs start 14 Jul), B 23 Aug – 3 Sep, C 13 Sep – ongoing. The pattern "Insufficient Balance" appears across the news Lambdas' logs.
2. **The lapses are invisible to CloudWatch:** nearly every AI Lambda catches the error and reports success (Errors = 0); only `newsWeeklyBrief` surfaces errors. `newsFreshnessMonitor` did fire ("Content STALE — 346.5h old", every 2 h) but names no cause and repeats every 2 h.
3. **Retired model name:** DeepSeek's live `/models` lists `deepseek-flash` and `deepseek-v4-pro`. `deepseek-v4-flash` has been missing since **18 Aug**; `newsModelGuard` flags 13 Lambdas daily. Jobs kept working until the balance ran out, so the old name is still accepted for now, and that can end any time.
4. **No fallback exists:** `XAI_API_KEY_BACKUP` is set on several Lambdas, but no repo code reads it. News and PPA use **separate** DeepSeek keys (hashes differ).
5. **Waste:**
   - `NewsProjectInvokeAgentLambda` (Scheduler `InvokeNewsAgent`, every 4 h) regenerates summary + cause + forecast for **every** topic on every run. The cache TTL is 1 h and the scheduled path never reads it (`src/index.js` handler, ~L147–164): ~6 runs × ~20 topics × ~4 calls a day.
   - Economy jobs (`TriggerNewsEconomicImpact` v4-pro, `TriggerNewsEconomicQuality`) run daily while economy is parked.
   - `newsPredictionResolver` proposes up to 40 verdicts a day (+ Brave searches); none have been confirmed since 24 Jul.
6. **Peak pricing:** six daily DeepSeek jobs run 06:30–09:00 UTC, inside DeepSeek's peak window (01:00–04:00 and 06:00–10:00 UTC, weekdays), where the rate is double.
7. **Repo ≠ deployed:** the repo copy of `newsAnalyze` carries the parked credits code **and has lost `thinking:{type:'disabled'}`**, so never deploy it as-is. `newsCountryIntelligence` and `NewsProjectInvokeAgentLambda` differ only in a dead fallback string.
8. **Studio member path** (`newsAnalyze`): 0 invocations in 30 days.

## Current AI map → recommended
Prices per 1M tokens (in / out), peak, from official pages 2026-09-27:
- DeepSeek flash: $0.30 / $1.20 (off-peak half)
- DeepSeek v4-pro: $1.32 / $3.96 (off-peak half)

| Job (Lambda) | Task | Runs | Now | Recommended | Status |
|---|---|---|---|---|---|
| Topic selection (`newsInvokeGemini-dev`) | Picks ~20 stories from ~224 articles | every 4 h → **8 h** | flash | **v4-pro** (high-leverage) | open (D3, R3) |
| Story summary (`NewsProjectInvokeAgentLambda-dev`) | Extraction | change-driven | flash | flash | open (R2) |
| Story cause chain (same) | Causal synthesis | change-driven | flash | flash | open (R2) |
| Story forecast (same) | Dated triggers that get scored | ≤ 1 / story / day | flash | **v4-pro** (high-leverage) | open (D3, R2) |
| Situation classification (`newsSituationIngest`) | Fixed categories, temp 0, JSON | hourly | flash | flash | keep |
| Daily brief (`newsPostDevTo`) | Flagship edition | 1 / day | flash | **v4-pro** (high-leverage) | open (D3) |
| Weekly brief (`newsWeeklyBrief`) | Signals digest, auto-publishes | 1 / week | flash | **v4-pro** (high-leverage) | open (D3) |
| Country briefings (`newsCountryIntelligence`) | Deep synthesis | daily → **weekly + on events** | v4-pro | v4-pro | open (R1) |
| Systems / story web (`newsSystemsAnalysis`) | Causal graph, JSON | daily, 5 countries | v4-pro | v4-pro | keep |
| Story analysis (`newsThreadAnalysis`) | Biggest reader-facing synthesis | on new events | **Gemini 2.5 Flash (free)** | **DeepSeek** (flash or v4-pro; compare first) | Gemini → DeepSeek **decided**; model open (D2b) |
| Drift attribution (`newsDriftCorrector`) | Pick one event from a list | after each country briefing | flash | flash | open (R4) |
| Source audit (`newsSourceAudit`) | Summary vs source check | 2–3 / week | v4-pro | flash | open (P4, R4) |
| Studio member runs (`newsAnalyze`) | Deep custom analysis | on demand | v4-pro | v4-pro | keep |
| Economic impact + quality judge | Economy (parked) | daily | v4-pro + Gemini | **park** | open (P1) |
| Forecast resolver (`newsPredictionResolver`) | Legacy verdict proposals | daily | flash | **park** until the new scoring | open (P2) |
| Impact audit (`newsImpactAudit`) | Missed-story check, fails silently | daily | flash | **park** | open (P3) |
| Pair intel, weekly markets | Dormant | — | — | already disabled | — |

**High-leverage** = many readers see it or much depends on it, but it runs rarely, so a stronger model costs little. The four: topic selection, daily brief, weekly brief, story forecast.

## Decisions
**Decided (operator, 2026-09-27):**
- **Gemini is replaced by DeepSeek** ("gemini is not that good and we should use flash deepseek instead of gemini"). Story analysis moves to DeepSeek; the Gemini judges are parked with economy; source audit goes to flash.
- **No fallback provider (D2c)** ("no need the fall back providr"). Protection = prepaid buffer (B1) + the balance alarm (D6m).
- **Parking goes first:** plan and checklist in `TASK_2026-09-27_parking.md`.
- **Scope approved:** the "needed now" (green) and "cheap, worth it" (yellow) lists below, **including the scoring pipeline (D6)** and the operator's ~1 h/week confirmation.

**Open:**
| # | Question | Recommendation |
|---|---|---|
| **D1** | Top up DeepSeek + rename `deepseek-v4-flash` → `deepseek-flash` | **Rename ✅ done 2026-09-29** on the 11 news Lambdas (`GROK_MODEL`; one bare `update-function-configuration` each; all `Successful`, every other env var byte-identical; no code branches on the model name). The 2 PPA Lambdas (other project, separate key) are not changed; operator's call. **Top-up: operator, before 11 Oct** |
| **B1** | Monthly AI budget + prepaid buffer (no auto-recharge on DeepSeek's official pages) | Operator's call; a buffer that covers several weeks |
| **D2b** | Story analysis: flash or v4-pro | Compare on ~10 real stories (`quality/analysis`), leaning v4-pro — **✅ done 2026-09-29 (Batch 2, `TASK_2026-09-29_batch2_models.md`)** |
| **D3** | v4-pro for the four high-leverage calls | Yes — **✅ done 2026-09-29 (Batch 2, `TASK_2026-09-29_batch2_models.md`)** |
| **D5** | Move the DeepSeek jobs out of the peak window (to ≥ 10:00 UTC) | Yes — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **D6m** | Monitoring: balance alarm + calmer freshness alert | **Declined 2026-09-29** (operator: "no need i know the reason so you can bypass the alarm one"). The existing `newsFreshnessMonitor` STALE alert stays as-is |
| **P1–P3** | ✅ **Done 2026-09-28:** economy impact + quality judge, forecast resolver, impact audit parked; economy surfaces hidden on the site | — |
| **P4** | Source audit on flash at 2–3 / week | Yes (next task) — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **Q1** | Signal API (`newsSignals`, 0 keys): park now + "signals v2" rebuilt on situations / GDACS / country risk / scored forecasts later? | Under discussion |
| **R1** | Country briefings weekly + early refresh on a HIGH situation / GDACS / coverage jump, max 1 a day; card "older" at 14 d | Yes — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **R2** | Story jobs only for new / changed stories; forecast ≤ 1 / story / day | Yes — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **R3** | Topic selection every 8 h | Yes — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **R4** | Drift chained after country briefings; source audit 2–3 / week; country facts weekly | Yes — **✅ done 2026-09-29 (Batch 1, `TASK_2026-09-28_batch1_efficiency.md`)** |
| **R5** | Check what `newsPostLinkedin` (every 3 h) posted during the pause | Yes, read-only |
| **B2** | Check the Brave Search plan / limits (used by 4 jobs) | Check before relying on it more |

## Work list
**Needed now (approved):**
1. The ops fixes: D1, D6m, P1–P4, R1–R4, D5, D3 as decided.
2. **Read fix a:** stop the archive re-dating old stories under today's date (/weekly "new events today"). **Done 2026-09-30 (Batch 3 A):** read-side day-0 rule in 6 Lambdas + the proxy; stored archive was already correct.
3. **Read fix b:** a `latest_daily_brief` field / action (replaces the client's day-by-day lookback, 21 calls on a cold /map). **Done 2026-09-30 (Batch 3 B):** Lambda deployed; frontend on `map-console`, not yet deployed.
4. **D9:** a drift-note direction check in the drift writer. For example, Iran 19 Aug: "shifts the humanitarian score down as … conditions worsen".
5. **D10:** Worker deploy (SPA fallback + sitemap + `/briefings` pre-render), together with the frontend deploy.

**Cheap, worth it (approved):**
6. **Read fix c:** `threadId` on the daily brief's `topStories` (so `/briefings` links to the story page).
7. **Read fix f:** a read action for country facts (the `Fact` schedule runs `newsCountryFactsUpdater` daily; check what's stored first). **Done 2026-09-30 (Batch 3 D):** `country_facts` action + card row; updater widened to 40 countries (capital + population; leadership stays the original 12).
8. **D6 scoring pipeline:**
   - one-pass schema (own `p` + source per trigger; needs DeepSeek back);
   - weekly hashed sample of ~20–25, ≤ 1 per story cluster;
   - agent drafts, operator confirms (~1 h / week);
   - VOIDs published; Brier skill vs base rate;
   - a dead-man's alarm.
   Spec: `prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md`, `redesign-ux/_active/TRACK_RECORD_AND_STUDIO_RULING.md`.

**Later (not now):**
- D5 Studio share Lambda (0 member runs in 30 d).
- D8 story web stage 2.
- Read fixes d (weekly editions by week), e (story drift history), g (per-trigger deadlines; comes with D6).
- D11 map as home page.
- Hygiene:
  - `GROK_*` / `XAI_*` env names; misleading Lambda names; `-dev` production names;
  - the unused `XAI_API_KEY_BACKUP`;
  - the `SummarizeAndPredict` TTL is disabled;
  - repair the repo `newsAnalyze` before any future deploy.

## Order
1. D6m alarm → D1 top-up + rename, verifying one run of each daily job.
2. Stop the waste before spending the top-up: P1–P4, R2.
3. D3 / D5 / R1 / R3 / R4.
4. Read fixes a, b, c, f and D9.
5. Frontend + Worker deploy (operator "yes").
6. D6 scoring.
7. Later items.

**Rules:**
- Lambda changes are bare single AWS CLI commands.
- Diff each deployed zip before editing.
- Env changes: fetch → merge → write the full map.
- Never deploy the repo `newsAnalyze` over the patched zip.
- Each phase gets its own task file with a live tracker; verify after each change.

**Check 2026-09-30:** `newsModelGuard` (2026-09-29 12:00 run) lists live `deepseek-flash`, `deepseek-v4-pro`; findings = 2, both PPA (`PPAfetchMarketNews-dev`, `PPAcomputeWardProfiles-dev` still `deepseek-v4-flash`). All news Lambdas, including `PREDICTION_MODEL`, are clean.

**Top-up verified 2026-09-30 ~02:15 UTC (operator topped up):**
- Manual `newsInvokeGemini-dev` on `deepseek-v4-pro`: 200, 15 topics in 48 s, `finish_reason: stop`, 5,751 completion tokens (cap 12,000).
- Manual `NewsProjectInvokeAgentLambda-dev`: 200 in 71 s, generated 45 (15 × summary / cause / forecast), swapped live; forecast research ~12–14 s per call on v4-pro.
- A follow-up `dryRun`: `reuse:unchanged` 30, `reuse:once-per-day` 15 (the R2 reuse works).
- 0 error / "Insufficient" lines in either Lambda. The live proxy serves the 15 new topics (updatedAt 2026-09-30T02:15:36Z).
- Next to watch: the scheduled 04:15 / 04:25 runs; story analysis on flash at 04:40 (first real run); story web 05:00; the 20 country briefings 05:15; drift 05:30 (the chain must finish before 06:00); daily brief on v4-pro ~14:00.

**Full chain run manually 2026-09-30 ~02:20–02:35 UTC (operator: "trigger them all once"; peak-rate hour; the weekly brief was left for Sunday since it auto-publishes):**

| Job | Result | Time |
|---|---|---|
| Story analysis (`newsThreadAnalysis`, deepseek-flash) | 10 generated, 0 failed | 90 s |
| Story web (`newsSystemsAnalysis`) | 10 generated, 0 failed | 123 s |
| Country briefings (`newsCountryIntelligence`, v4-pro) | 21 generated (18 weekly baseline, 2 new: Nepal, Brazil; 1 alert: **Mexico**, Hurricane Polo GDACS), 0 failed | 121 s |
| Drift (`newsDriftCorrector`) | ran clean; no notes (the previous readings, ~11 Sep, are outside the 16-day lookback) | 4 s |
| Daily brief (`newsPostDevTo`, v4-pro) | 2026-09-30 edition stored (8 top stories, country to watch Iran) | 23 s |
| Situation classification (`newsSituationIngest`) | 420 classified → 80 stories, 0 × 402 | 37 s |

**Follow-ups found:**
- Story analysis picks backlog threads over today's new ones because of the archive re-dating bug (read fix a).
- `newsSystemsAnalysis` still treats regions (Europe, Asia) as countries; extend the R1b exclusion.
