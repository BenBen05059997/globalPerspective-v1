# Economic Disruption — Visualization + Deep-Link Plan

**Created:** 2026-05-26. Frontend-heavy → ships when the GitHub Pages outage clears; backend bits deploy via CLI anytime.

## Goal
Make the economic data + (qualitative) prediction **visual and easy to read** for the **markets-first reader**, and let them **trace the chain: instrument moving → which news → which countries/sectors it hits** ("how the news is affecting the world"). Grounds the differentiator the competitor research validated (causal + cited + free) while staying honest.

## 🔒 Honesty guardrail (non-negotiable)
- **Chart only real data or our own aggregates. NEVER a numeric forecast.**
- Real price history → OK to chart. Our cross-story consensus / severity counts → OK to chart.
- The *prediction* stays **qualitative** (direction arrow + magnitude). No projected-price line, no fake "+X%", no precision-implying confidence gauge. That's the line that separates us from the paywalled quant tools.

---

## Workstream A — Visualize the real data (sparklines)
- **A1. Per-instrument real-price sparkline** on `/economy` pivot rows (and optionally right-rail Market Context), next to the qualitative call. Uses the existing `Sparkline` atom + `markets_history` action.
- **Backend prerequisite — ✅ DONE 2026-05-26:** HISTORY# rows were written only for FX/equities/crypto, not commodities/rates. Added `COMMODITIES#GLOBAL` + `RATES#GLOBAL` `HISTORY#YYYY-MM-DD` writes (90-day TTL) to `newsMarketsData`, deployed + verified (both rows present in DDB). History now **accrues daily from 2026-05-26** — sparklines for Brent/gold/US10Y will have data after a few days.
- **Verify during build:** the `markets_history` action's response shape (per-instrument series) — extend it if it doesn't already cover these.

## Workstream B — Visualize our aggregates (no invented numbers)
- **B1. Consensus bar** per pivot instrument from `topMovers.directions {up,down,mixed}` — "5 ↑ / 1 mixed across stories." Honest aggregation, no fabricated index.
- **B2. (optional)** severity-distribution / horizon mini-bars in the header or right rail.

## Workstream C — Deep-link tracing (instrument → news → world)
- **C1. Instrument → stories** — *exists* (pivot expand → example stories → thread Economy tab). Make the instrument level/sparkline itself click-through to its stories too.
- **C2. Winners/losers → country pages** — render `winners[]`/`losers[]` of type `country` as deep links to `/weekly/country/:name` (on the pivot examples + the thread Economy tab's `MechanismCard`). This is the "how it affects the world" hop — instrument → story → affected countries.
- **C3.** Ensure the full path is seamless: `/economy` (instrument) → expand → thread Economy tab (`mechanism` + winners/losers, cited) → country page. Add "affected countries" chips per disruption where useful.

## Workstream D — Trust signals (from the competitor research; optional, fold in)
- **D1.** Surface the LLM-as-judge **quality grade** per analysis (now that it's populating) as a small badge — almost no consumer finance product exposes this.
- **D2.** Render citations **claim-level inline** in the mechanism, not just as a source list.

---

## Sequencing
- **MVP (highest value, mostly existing pieces):** C2 (winners/losers → country deep links) + A1 sparklines for the instruments that already have history (equities/crypto/FX) + B1 consensus bar.
- **Fast-follow:** the `newsMarketsData` commodities/rates HISTORY addition (unlocks sparklines for Brent/gold/yields), then D1/D2.

## Building blocks that already exist (verified)
`Sparkline` atom · `markets_history` action + `fetchMarketsHistory` in restProxy · `useTopMovers` (`.directions`, `.examples`) · `useDisruptionsList` · `DirectionArrow` · `/weekly/country/:name` route · winners/losers + `scopeId` linking spine.

## Constraints
- Frontend ships only after the GitHub Pages outage clears (the `/economy` rebuild is already queued).
- Honesty guardrail above is the hard rule.
- Sparklines for commodities/rates: HISTORY addition is live (2026-05-26); needs a few days of accrued data before the trend is meaningful.
