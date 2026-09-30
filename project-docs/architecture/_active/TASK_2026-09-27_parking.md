## Park the jobs that feed nothing we show (P1–P4) — 2026-09-27 — active (P1–P3 done 2026-09-28; signals under discussion)

**Goal:** stop the scheduled AI jobs whose output no current page needs, **before** the DeepSeek top-up is spent, so each top-up lasts longer and parked features stop producing stale or unconfirmed data. Parking means disabling the schedule and keeping the code; every step is reversible with one command.

**Source:** `BACKEND_PLAN_2026-09-27.md` (items P1–P4). Operator: "you can plan the parking first … we need a checklist" (2026-09-27).

### What gets parked
| # | Schedule (EventBridge rule, UTC) | Lambda | Model | Why park | Downstream readers (checked in code 2026-09-27) |
|---|---|---|---|---|---|
| P1a | `TriggerNewsEconomicImpact`, cron(30 7 * * ? *) | `newsEconomicImpact` | v4-pro, ~15 threads / run | Economy is parked (soft-hidden since 09-25) | Backend: `newsWeeklyBrief` (optional `econ`, null-safe), `newsBreakingAlert` (optional `economic`, null-safe), `newsSignals` (signal API), `newsSensitiveData` (`economic_impact` / `economic_impact_list`). Frontend: see "Site changes" |
| P1b | `TriggerNewsEconomicQuality`, cron(0 8 * * ? *) | `newsEconomicQuality` | Gemini 2.5 Flash | Only grades P1a's output | none beyond the `is_low_quality` flag on econ records |
| P2 | `TriggerPredictionResolver`, cron(0 9 * * ? *) | `newsPredictionResolver` | flash + Brave search, ≤ 40 / run | Proposals need a human confirm; none confirmed since 24 Jul; the new scoring method (D6) replaces it | `scripts/predictions/review.js` (manual). The track record page reads `prediction_track_record`, which is unaffected |
| P3 | `TriggerImpactAudit`, cron(0 9 * * ? *) | `newsImpactAudit` | flash | Backend-only "missed story" audit; fails silently | none (S3 + SNS only) |

**Not parked:**
- **P4 source audit:** operator decision pending. Recommendation: keep it, move it to flash and run it 2–3 times a week. That's a model / schedule change, not parking, so it belongs to the next task.
- **Already disabled:** `TriggerWeeklyMarkets`, `TriggerPairIntelligenceWeekly`.

**Question raised by the dependency check:**
- **Q1:** `TriggerSignalsBuild` (daily, `newsSignals`, not AI) builds the key-gated signal API from econ + other records. The signal API isn't sold (project memory). Park it too, or keep it?

### Site changes (frontend, branch `map-console`)
Once P1 stops, the economy surfaces show frozen data from before 13 Sep. Economy is already soft-hidden at `/economy`; these surfaces still show it. **Decision needed (Q2): hide them (recommended: a soft hide, code kept), or label them "paused since <date>".** Surfaces:
- the story page, Read in full: **Economy tab** (`features/threads/ThreadPage.jsx`, `useEconomicImpact`; `?tab=economy` links then open Overview);
- the country page: **"Economic Disruption" rail** (`features/countries/CountryPage.jsx` ~L485, `useDisruptionsList`);
- the countries list: **"Disruption" sort** (`features/countries/CountryListPage.jsx` ~L146);
- `/daily`: **"Economic Footprint"** section (`features/daily/DailyPage.jsx` ~L117);
- the old home `/`: disruption links to `?tab=economy` (`features/home/Home.jsx` ~L461). The old home is replaced at the S6 swap; hide the links for now.

Studio's economic-ripple lens is already hidden (S5c).

### Steps
Bare single commands; each one verified before the next.
1. Record the current state: `aws events describe-rule --name <rule>` for each of the 4 rules. Paste State / ScheduleExpression into the tracker.
2. `aws events disable-rule --name TriggerNewsEconomicImpact`, then verify with `describe-rule` → `DISABLED`.
3. Same for `TriggerNewsEconomicQuality`, `TriggerPredictionResolver`, `TriggerImpactAudit`.
4. (Q1) `TriggerSignalsBuild`, only if the operator says park.
5. Frontend (Q2): hide or label the economy surfaces. Then `npm run verify`, page guards, and a click-through of the story page (all tabs + a `?tab=economy` link), a country page, the countries list and `/daily`, at desktop and 390 px. Commit on `map-console`.
6. The next day, check that none of the parked Lambdas ran: CloudWatch `Invocations` = 0 after the disable time.

**Rollback:** `aws events enable-rule --name <rule>` (the schedule expressions are recorded in step 1).

### Docs to update (same commits)
- `architecture/ARCHITECTURE.md`: the Lambda entries and schedule table for the 4 (or 5) rules → DISABLED, with the date.
- `BACKEND_PLAN_2026-09-27.md`: P1–P3 → done.
- `CHANGES.md` entry for the frontend change.
- `project-docs/INDEX.md` row for this task.
- Project memory `project_economy.md`.

### ▶ LIVE TRACKER
| Step | What | Status | Evidence |
|---|---|---|---|
| 0 | Operator "go" + Q1 + Q2 | ✅ 2026-09-28 | "yes you can part the four daily job … you can hide q2". Q1 (signals): operator wants to rethink the algorithm, so it is not parked yet (see below) |
| 1 | Record the current rule states | ✅ | all 4 `ENABLED`: EconomicImpact `cron(30 7 * * ? *)`, EconomicQuality `cron(0 8 * * ? *)`, PredictionResolver `cron(0 9 * * ? *)`, ImpactAudit `cron(0 9 * * ? *)` |
| 2–3 | Disable the 4 rules, verify each | ✅ 2026-09-28 14:40 UTC | `aws events disable-rule` ×4 (single commands); `describe-rule` → all `DISABLED` |
| 4 | Signals rule | ⏸ discussion | `newsSignals`: 0 API keys issued, 38 invocations / 30 d (its own daily build). Recommended: park + record "signals v2" (rebuilt on situations / GDACS / country risk / scored forecasts); operator deciding |
| 5 | Frontend economy surfaces hidden | ✅ 2026-09-28 | Shared flag `shared/lib/economyFlag.js` (`ECONOMY_PARKED`). Hidden: story Economy tab (`?tab=economy` → Overview), country "Economic Disruption" rail, list "Disruption" sort, `/daily` "Economic Footprint", old home disruption links; no `economic_impact*` request fires (Playwright, 7 pages × 2 widths, 0 errors). Verify 742 tests, guards 52/0. `/economy` direct URL unchanged. The country card's GDP / FX row is from the live markets feed, so it's kept |
| 6 | Next-day check: 0 invocations | ✅ 2026-09-30 | CloudWatch Invocations since the 2026-09-28 14:41 disable: 0 for all 4 |

**Completion checklist:**
- [x] 4 rules DISABLED and verified (signals: under discussion)
- [x] economy surfaces hidden, verified in the browser
- [x] next-day invocation check
- [x] docs updated (ARCHITECTURE, BACKEND_PLAN, CHANGES, INDEX, memory)
- [ ] status → done
