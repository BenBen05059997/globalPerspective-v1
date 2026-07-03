# Weekly Intelligence Brief — Plan

> **PIVOT 2026-06-10 → SIGNALS, not deep analysis.** After an expert audit caught the LLM overstating the lead (dramatic read over the better-supported one) + stale/unsourced numbers, and research into how rigorous weeklies actually work (Economist "world this week", ISW, Semafor "Semaform" — they surface discrete signals and keep fact separate from judgment, never melting a grand thesis into the stream), the product became a **Weekly Signals Brief**, not an essay. The LLM writes only per-signal `lede/fact/soWhat` under strict epistemic rules (verb-mark, calibrate, no thesis, no forced cross-links, no invented specifics); **risk level, region, as-of date, and sources are deterministic (our data).** SHIPPED: signals engine + `/weekly-brief` signals page + `TriggerWeeklyBrief` Sunday schedule (draft → human publish via `weekly/review.js`). The sections below predate the pivot (kept for history).

**Date:** 2026-06-10 · **Status:** ✅ **LIVE + AUTO-PUBLISHING (2026-07-03).** Signals engine + `/weekly-brief` page + Sunday schedule shipped 2026-06-10. **2026-07-03:** the page had been empty ~3 weeks — two bugs fixed + deployed: (1) the `weekly_brief` serving scan wasn't paginated and the table outgrew the 1 MB scan page, so published rows past page 1 were invisible → `null` (same latent bug fixed in `weekly_markets` + `pair_analyses_list`); (2) the **human-publish gate was dropped** — `newsWeeklyBrief` now writes `status:'published'` directly (the grounded prompt is the quality guarantee; "set to draft" is a manual kill-switch), so the Sunday cron now lights the page weekly with no human step. `weekly/review.js` still works as an optional hold/reject tool. See CHANGES.md 2026-07-03 + [[project_weekly_brief]].
**Decided:** professional analyst-grade weekly (NOT a link roundup) · LLM synthesis grounded in our already-generated, already-cited analysis · **on-site `/weekly-brief` page + email** · **one-click human approve** before publish/send · Sunday ~9am local send · broadcast v1.

The second of the two email types ([[project-breaking-alerts]] is the first). Distinct from the existing **daily** brief (`DAILY_BRIEF`, `/daily`) — this is a 7-day *strategic synthesis* with trajectory + a forecast scorecard.

## Why professional-grade (the bar)
Everyone reading this site is a pro reader ([[feedback-audience-depth]]). The weekly must read like a research desk's weekly, not a newsletter of headlines: synthesis, judgment, connections, forward view.

## Structure of the brief (the definition of "professional grade")
1. **The Week in Brief (BLUF)** — 2–3 sentences: the defining development + the through-line.
2. **What moved** — the ~5 most significant threads: *what happened → why it matters → trajectory*.
3. **Cross-currents** — how the threads connect (conflict → energy → markets); the systems view.
4. **Markets & economic read** — the week's real economic disruptions + realized moves (honest, no fabricated %).
5. **Forecast scorecard** — what we predicted & how it's tracking (deterministic, from `prediction_track_record`; honest empty state until verdicts exist). *Computed, not LLM-narrated, to keep numbers honest.*
6. **What to watch next week** — forward watch items.

## Composition & honesty (decided 2026-06-10)
**Free-form Markdown prose, not a rigid field schema** — fixed fields produced formulaic, summary-like output. The prompt encodes real tradecraft (ICD 203 analytic standards, Sherman Kent's estimative-probability ladder, Heuer's bias traps, BLUF + nut-graf + Economist-leader arc): lead with the judgment, stand-back context, evidence per beat, cross-currents, a steel-manned alternative reading, calibrated forward view with falsifiable indicators.

**Generation mode = FREE by default** (model may enrich with its own knowledge for richer analysis), pass `{mode:'grounded'}` for strict. The honesty guarantee is the **mandatory one-click human review** (`weekly/review.js`) before publish — the human is the grounding/verification layer, scanning for any too-specific ungrounded number/date. This is acceptable for the *weekly* (not time-pressured) in a way it isn't for breaking. Output stored at the canonical `WEEKLY_BRIEF` SK as `{ headline, dek, brief(Markdown), mode, status }`.

## Pipeline
1. **`newsWeeklyBrief` Lambda** (dedicated; [[feedback-clean-architecture]]). Gathers the 7-day window → selects top threads/countries by significance → feeds their real analyses into a **DeepSeek V4** synthesis prompt → produces the qualitative sections → stores `WEEKLY_BRIEF#{weekKey}` / `WEEKLY_BRIEF`, `status: 'draft'`. **Manual-invoke first (no schedule) until output quality is trusted** — mirrors the breaking-detector dry-run approach.
2. **`weekly/review.js`** — one-click human approve: list drafts, preview, `status → published` (or hold). No public auth surface (mirrors `predictions/review.js`).
3. **Serving** — public `weekly_brief` action (latest published) on `newsSensitiveData`; the forecast-scorecard section merged in from `prediction_track_record` at serve time (deterministic).
4. **Frontend** — `/weekly-brief` page (`WeeklyBriefPage` + `useWeeklyBrief`), linked from nav + the bell + the email.
5. **Email** — the Sunday send renders/links the published brief. **BUILT + DEPLOYED (dry-run) 2026-07-03** as `newsEmailSender` (Lambda #29; shared Resend seam; `TriggerWeeklyEmailSend` Sunday cron). Gated only on operator Resend domain-verification. See `EMAIL_SENDER_PLAN.md`.
6. **Schedule** — EventBridge early-Sunday generation once quality is trusted; send Sunday ~9am local.

## Build order
- [x] Plan
- [x] `newsWeeklyBrief` engine + prompt → **DEPLOYED + manual-invoke verified** (real draft for week of 2026-06-10: BLUF + 5 ranked developments + cross-currents + markets read + watch-next, all grounded). No schedule yet.
- [x] `weekly/review.js` (one-click publish/hold/reject)
- [x] serving action (`weekly_brief`, latest published) on `newsSensitiveData` + **`/weekly-brief` signals page** (`WeeklyBriefPage` + `useWeeklyBrief`) + nav link. SHIPPED 2026-06-10; **serving scan paginated + auto-publish 2026-07-03** → page is live (WEEK OF JUNE 28) and self-refreshes each Sunday.
- [ ] forecast-scorecard section merged from `prediction_track_record` at serve time  ← **next**
- [x] email render + EventBridge Sunday **send** → **`newsEmailSender` BUILT + DEPLOYED (dry-run) 2026-07-03** (Lambda #29, `renderWeeklyEmail.js`, `TriggerWeeklyEmailSend` cron ENABLED, one real send-to-self verified). Subscribe UI (`SubscribeCard`) **LIVE on Home + `/weekly-brief`**. **Remaining = operator only:** verify `globalperspective.net` in Resend → flip `EMAIL_FROM`+`EMAIL_SEND_DRY_RUN=false`+clear `TEST_RECIPIENT`. See `EMAIL_SENDER_PLAN.md`, [[project-email-sender]].
- [ ] (optional) bell link to the latest weekly brief

## Storage
`SUMMARIZE_PREDICT_TABLE`, **PK** `WEEKLY_BRIEF#{weekKey}` / **SK** `WEEKLY_BRIEF`. Fields: `weekOf`, `bluf`, `keyDevelopments[]` ({title, whatHappened, whyItMatters, trajectory, threadId}), `crossCurrents`, `marketsRead`, `watchNext[]`, `threadIds[]`, `status` (draft|published), `generatedAt`, `approvedAt`, `model`, `ttl` (~180d).
