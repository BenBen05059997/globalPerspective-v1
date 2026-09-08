# Brave Search audit — P0·T1 of MAP_HOME_SITUATION plan

Read-only investigation, run 2026-09-08 (region ap-northeast-1). Answers: is Brave earning its place in **ingest** and in **analysis grounding**? Protocol: `project-docs/redesign-ux/_active/MAP_HOME_SITUATION_PLAN.md` §5.1.

Config facts (from `aws lambda get-function-configuration newsInvokeGemini-dev`): `TOPICS_LIMIT=13`, `BRAVE_CONCURRENCY=1` (source default is 3 — prod was throttled down), Brave key present and valid (no 401/403 seen). Capture table = `GlobalPerspectiveIngestCapture` (default name; `INGEST_CAPTURE_TABLE` unset), 45-day TTL, ~197 rows. **Caveat:** the ingest log group stores only ~177KB, so log-derived counts (A1–A3) cover a *shorter* effective window than 30 days; capture-table counts (B) are the complete picture over ~45 days.

## A — Ingest volume / yield / failures (CloudWatch Logs Insights, group `/aws/lambda/newsInvokeGemini-dev`)

A1 per-query yield — `filter @message like /Brave "/ | parse /Brave "(?<q>[^"]+)\.\.\.": (?<n>\d+) articles/ | stats avg(n),max(n),count() by q`:
| query | avg articles | max | success-runs logged |
|---|---|---|---|
| site:timesofindia… | 10 | 10 | 8 |
| **site:reuters.com** | **0.38** | 1 | 42 |
| site:koreaherald… | 9.67 | 10 | 15 |
| site:kyivindependent… | 9.35 | 10 | 17 |
| corporate labor migration… | 8 | 10 | 2 |
| site:straitstimes… | 10 | 10 | 2 |

A2 failures — `filter @message like /Brave/ and /failed/ | parse /failed: (?<status>\d+)/ | stats count() by status`:
| status | count |
|---|---|
| **429 (rate limit)** | **334** |
_All logged Brave failures are 429. No 401/403 → the key/plan is fine; Brave is simply rate-limited (even at concurrency 1). `apnews.com` never produced a success line (always 429/empty)._

A3 pool share — `filter @message like /COMBINED:/ | parse /\((?<rss>\d+) RSS \+ (?<brave>\d+) Brave\)/ | stats avg(rss),avg(brave),max(brave),count()`:
- avg RSS = **167.5**, avg Brave = **10.4** (max 20) per run → **Brave ≈ 5.8% of the combined pool**.

## B — Ingest value: does Brave-sourced content get *chosen*? (scan of `GlobalPerspectiveIngestCapture`, 197 rows)

Brave-only domains = reuters, apnews, straitstimes, timesofindia, koreaherald, kyivindependent (the site: query targets; these have no RSS, so a chosen topic sourced *only* from them is coverage RSS could not have provided).

| metric | value |
|---|---|
| input articles | 34,920 |
| … from a Brave-only domain | 2,070 (**5.9%**) |
| chosen topics | 2,740 |
| … with ≥1 Brave source | 113 (**4.1%**) |
| **… with ONLY Brave sources (`brave_unique_chosen`)** | **12 (0.4%)** |

**Interpretation:** Brave adds ~0.4% unique coverage to ingest. The 4.1% of chosen topics that cite a Brave source also carry RSS sources (RSS would have surfaced them anyway). Reuters — the flagship wire target — returns ~nothing (0.38 avg) and Brave is 18%-ish 429-throttled. **Verdict: remove Brave from ingest; GDELT DOC 2.0 replaces it with no meaningful loss.** No transitional wire-service fallback warranted.

## C/D — Grounding (5 Lambdas: country, thread, pair, resolver, agent)

30-day invocation anchors (`AWS/Lambda Invocations` Sum): predictionResolver 30, countryIntelligence 30, threadAnalysis 30, pairIntelligence 5, `NewsProjectInvokeAgentLambda-dev` 180. Each loops internally (2 Brave calls per country/thread/pair/unresolved-prediction; 1 per topic for the agent), so true Brave volume = invocations × per-run loop size — **not derivable from logs** (grounding fns log Brave only on failure). **Ground truth = the Brave dashboard (operator login).**

**Status: BLOCKED on operator** — needs the Brave dashboard's real monthly query count + plan/tier. Parts D (are Brave results actually cited in analyses) and E (blind Exa-vs-Brave quality trial) are **deferred**: they do not gate the map/tracker build and belong to a separate "grounding search provider" follow-up. Decision on ingest (above) stands independently.

## Decision table (P0·T1 result)

| Metric | Value | Action |
|---|---|---|
| Ingest calls/mo | ~1,800 attempts (~10 q × 6/day); many 429 | informational |
| Ingest failure rate | 334 × 429 / 30d ≈ 18%, all rate-limit (no key/plan error) | Brave unreliable for ingest |
| **`brave_unique_chosen`** | **0.4%** (<5%) | **REMOVE Brave from ingest (WS1 §1 / P1·T4); no fallback** |
| Grounding volume | invocation anchors only; true count on dashboard | BLOCKED on operator dashboard |
| % analyses citing Brave (D) | not measured | deferred to grounding-provider follow-up |
| Exa vs Brave (E) | not run | deferred |

**Go/no-go:** ✅ ingest-Brave removal approved by the numbers. Grounding stays on Brave for now; revisit as a separate follow-up once the operator supplies dashboard usage.
