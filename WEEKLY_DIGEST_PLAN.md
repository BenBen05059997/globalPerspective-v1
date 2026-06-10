# Weekly Intelligence Brief — Plan

**Date:** 2026-06-10 · **Status:** building (engine first)
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
5. **Email** — the Sunday send renders/links the published brief (shares the Resend send path; gated on email going live).
6. **Schedule** — EventBridge early-Sunday generation once quality is trusted; send Sunday ~9am local.

## Build order
- [x] Plan
- [x] `newsWeeklyBrief` engine + prompt → **DEPLOYED + manual-invoke verified** (real draft for week of 2026-06-10: BLUF + 5 ranked developments + cross-currents + markets read + watch-next, all grounded). No schedule yet.
- [x] `weekly/review.js` (one-click publish/hold/reject)
- [ ] serving action (`weekly_brief`) + `/weekly-brief` page + nav/bell link  ← **next**
- [ ] forecast-scorecard section merged from `prediction_track_record` at serve time
- [ ] email render + EventBridge Sunday schedule (with email go-live)

## Storage
`SUMMARIZE_PREDICT_TABLE`, **PK** `WEEKLY_BRIEF#{weekKey}` / **SK** `WEEKLY_BRIEF`. Fields: `weekOf`, `bluf`, `keyDevelopments[]` ({title, whatHappened, whyItMatters, trajectory, threadId}), `crossCurrents`, `marketsRead`, `watchNext[]`, `threadIds[]`, `status` (draft|published), `generatedAt`, `approvedAt`, `model`, `ttl` (~180d).
