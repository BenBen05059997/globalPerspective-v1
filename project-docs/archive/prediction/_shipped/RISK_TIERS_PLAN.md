# Risk Tiers — score → tier migration + /weekly front-page hierarchy

**Status:** ✅ **COMPLETE — P1+P2+P3 all shipped + prod-verified 2026-07-03** (commits `fe80176`, `9201bf0`, `30cc344`). Created 2026-07-03.

> **Completion summary (2026-07-03):**
> - **P1 `fe80176`** — `utils/riskTiers.js` (`tierFromScore`/`tierFromLevel`/`TIER_ORDER`/`tierLabel`, canonical 25/50/75). Migrated `tokens.riskScoreToVar`, `RiskScoreBadge`, `CountryListPage` sort. Fixed the moderate→elevated alias + added the missing moderate paint (`--risk-m`, `.rsb-moderate`). New `test/riskTiers.test.js`.
> - **P2 `9201bf0`** — tier-first state displays: ThreadPage (header + stat tile + strip), CountryPage (stat tile + pill + strip + arc cards — killed a **4th** divergent band hiding in the arc cards), WorldMapV2 (panel + chip + `riskColor`). Pill/tile/strip derive tier from the score so they always agree. Added `tokens.riskTierToVar`.
> - **P3 `30cc344`** — `/weekly` LEAD + DEVELOPING hierarchy above the category river; drift "↳ What changed" delta line; hides on search/filter; promoted threads removed from river + rail (no double-show); honest-empty. **DEVIATION:** dropped the bare "rising" DEVELOPING qualifier — that overlaps the existing right-rail "Rising This Week"; DEVELOPING is the risk/living-analysis signal instead.
> - **P3 follow-up `8420f90`** — two polish fixes after live review: (1) `firstSentence()` is now abbreviation-safe (skips `St.`/`U.S.`/initials), so the lead "why" line no longer cuts at *"...targeting a St."*; (2) a Jaccard title-similarity check (≥0.5 content-word overlap) de-dups near-identical clusters so the same story doesn't fill two DEVELOPING slots.
> - Rule held throughout: **state = tier · change = audit numbers** (What-changed band / chain / delta pill stayed numeric). Playwright-verified live on every surface; 192 tests green.
>
> **Follow-on IA — same day 2026-07-03 (built on the tier foundation, beyond the original P1–P3 scope):**
> - **`/weekly` time-banded river `bd5e323`** — the river (below the LEAD/DEVELOPING hierarchy) went from category-grouped piles (default period `'all'` = "too many threads") to a **time-primary river with density decay**: This week (≤7d) = full cards · Earlier this month (8–30d) = condensed rows · Older (>30d) = collapsed count (collapses only when a fresher band has content). **Category demoted to a filter-chip row.** Buckets by `dateRange.to`. `components/WeeklyPage.{jsx,css}`.
> - **`/weekly/countries` risk-tier bands `e87bd5d`** — briefings grid grouped into **High / Elevated / Moderate / Low** bands (High = full `CountryCard`s, calmer tiers = condensed `CountryRow`s; risk is the axis since countries are persistent). Banding on the default risk sort only; other sorts stay flat. **Also fixed a correctness bug:** the page fetched briefings for only the top **10** countries while the backend has **20** (`MAX_COUNTRIES`) → 10 briefing-having countries were mislabeled "not enough coverage"; raised the batched fetch to top-**24** (15 briefings now show). `components/CountryListPage.{jsx,css}`.
> - Doc trail for both: `CHANGES.md`, `ARCHITECTURE.md` (WeeklyPage + CountryListPage rows), `PAGES_GUIDE.md` (`/weekly` + `/weekly/countries` entries).
**Decision (operator, 2026-07-03):** tiers, NOT a blended dominance score — scores are jittery (Japan 40↔62 daily oscillation, ~37% cosmetic noise) and opaque; tiers are explainable ("a sentence you can print on the card"), stable, and match how the pro tools work (Dataminr Flash>Urgent>standard, CrisisWatch categorical deltas). Display style decided: **tier-first + small number** (tier word is the headline; raw score stays as muted fine print — datum inspectable, false precision killed).

---

## Why (two problems, one fix)

1. **The `/weekly` threads page has no lead story.** Every thread renders as the same-sized card inside a fixed category order — the dominant story of the day (risk 85, 37 events) can sit below the fold under a 2-article business story. Research (2026-07-03, agent-verified): every serious news product — NYT, BBC, Techmeme, Ground News, Axios, Dataminr, CrisisWatch — uses **tiered hierarchy: 1 lead + few secondary + river**. Nobody ships a flat uniform list. Techmeme (algorithmic, text-first, no editor) is our closest analog.
2. **The frontend has THREE conflicting risk-band definitions** (audit 2026-07-03):

| Where | Bands | Problem |
|---|---|---|
| Backend `newsThreadAnalysis` prompt (**canonical**) | low 0-24 · moderate 25-49 · elevated 50-74 · high 75-100 | how the LLM was calibrated — the source of truth |
| `tokens.js` `riskScoreToVar` | high ≥75 · elevated ≥50 · low <50 | drops "moderate" |
| `atoms/RiskScoreBadge.jsx` `LEVEL_FROM_SCORE` | high ≥70 · elevated ≥40 | **score 72 = "high" here, "elevated" elsewhere** |
| `RiskScoreBadge` `LEVEL_FROM_STRING` | maps `moderate` → `elevated` | BUG: moderate renders orange |

Raw numbers ("62/100") shown as **current state** in 4 places (ThreadPage header + risk stat tile; CountryPage risk stat tile + arcs-tab cards; WorldMapV2 side panel) — invites reading jitter as signal.

**Keep numeric (do NOT tier-ify):** change/audit contexts — the What-changed band ("40 → 62"), correction-chain rows, `RiskDeltaPill` ("↗ +14"). They are the living-analysis audit record; exact values are the honest record there. **Rule: state = tier · change = audit numbers.**

**Explicitly out of scope:** the backend drift-gate (`|Δscore|≥8` in `newsDriftCorrector/lib.js` + `utils/countryDrift.js`) stays numeric — tier-crossing-only gating would miss big within-band moves (50→74) and worsen boundary flapping. Separate decision if ever.

---

## Phases

### P1 — `utils/riskTiers.js`: the single shared source
- Canonical bands **25 / 50 / 75** (matches the backend calibration).
- Exports: `tierFromScore(score)`, `tierFromLevel(str)` (fixes moderate→elevated bug), `TIER_ORDER` (high 0 … low 3), `tierLabel()`. Colors stay in `tokens.js` (`RISK_COLORS`/`RISK_SOLID`) — tiers = semantics, tokens = paint.
- Migrate the three divergent definitions onto it: `tokens.riskScoreToVar` (delegate or deprecate), `RiskScoreBadge`, ThreadPage's imported `RISK_COLOR`, `CountryListPage`'s local `RISK_ORDER`.
- ⚠️ Honest behavior change: boundary scores visibly shift tier in a few spots (72: high→elevated; 45: elevated→moderate). That IS the consistency being restored — note it in CHANGES.md.

### P2 — state displays become tier-first (+ small number)
- ThreadPage header meta + Thread Risk stat tile; CountryPage Risk stat tile + arcs-tab "62 risk" cards; WorldMapV2 country panel.
- Pattern: `ELEVATED` (tier color, headline) · `62 · 7-day ▁▂▅` (muted fine print).
- Change contexts untouched (band, chain, delta pill).

### P3 — `/weekly` front-page tiers (the original goal)
Above the existing category river (river + its collapsible groups stay untouched — browse mode):
- **LEAD (exactly 1):** qualifies = tier `high` AND new events ≤24h. Among qualifiers: freshest activity, then articleCount. Full-width, Techmeme-style text-forward: big serif headline, one-line why-it-matters, evidence row (`HIGH · 37 events · 23 sources · updated 3h ago`), arc dots, **drift note as the delta line** ("↳ What changed: <cited event>" — CrisisWatch-deteriorated pattern powered by the living-analysis loop; unique to us). **Rule printed on the card** ("Top story — high risk · new events today").
- **DEVELOPING (2-3):** fresh drift note (conclusion moved) OR tier ≥ elevated with events ≤48h OR trend rising/new. Half-width row.
- Ordering inside tiers = legible tie-breaks (fresher → more covered). No blended math anywhere.
- Guards: never two leads (tie → newer thread); lead tier renders **only on the default view** (hidden when searching/filtering — work mode); if nothing qualifies for LEAD, show none (honest-empty, no forced promotion).
- Note: thread `driftNote`s only started accruing 2026-07-01 (need 2 THREAD_HISTORY# snapshots) — DEVELOPING-by-drift lights up over the first days; qualification degrades gracefully to the other two rules.

### P4 — verify + ship (per phase)
- `npm run verify` + update `test/redesign.test.jsx`, drift tests if touched.
- Playwright against live/dev per the established flow (tour dismissed via `localStorage gp_tour_v1_*`); screenshot evidence.
- One push per phase → let Pages settle (rapid-push skip trap); confirm served bundle hash; CHANGES.md per phase.

---

## File inventory (from the 2026-07-03 audit)

| File | Uses today | Change |
|---|---|---|
| `tokens.js` | `riskScoreToVar` (75/50), color maps | delegate bands to riskTiers; colors stay |
| `atoms/RiskScoreBadge.jsx` | own bands 70/40; raw number; moderate→elevated bug | use riskTiers; tier-first display |
| `components/ThreadPage.jsx` | "Risk 85/100" header + stat tile | P2 tier-first |
| `components/CountryPage.jsx` | risk stat tile + arc-card "62 risk" | P2 tier-first |
| `components/WorldMapV2.jsx` | panel "/100" + own H/E/L maps | P2 tier-first; keep map fill maps (paint) |
| `components/CountryListPage.jsx` | local `RISK_ORDER` sort | import from riskTiers |
| `components/WeeklyPage.jsx` | **no risk usage; flat category list** | P3 LEAD/DEVELOPING tiers |
| DailyPage / WeeklyBriefPage / BriefingCard / CopyBriefing / CountryOverviewMap | riskLevel string + colors (already tiered) | optionally route level-normalization through riskTiers; no visual change |
| `utils/countryDrift.js`, `newsDriftCorrector/lib.js` | numeric gates (≥8) | **unchanged** (out of scope) |
| `atoms/RiskDeltaPill.jsx`, `atoms/CountryWhatChanged.jsx` | numeric deltas | **unchanged** (audit contexts) |

## Research notes (agent-verified 2026-07-03)
- NYT: lead = position + column span + the one hero image; editorial "importance ladder". BBC: per-slot "volume" variants.
- Techmeme: algorithmic Top News; dominance signal = coverage-cluster depth; strong time decay rotates the lead (~a day without new events). Verified live.
- Ground News: source-count badges carry dominance. Axios: "1 big thing" + why-it-matters.
- Dataminr: named severity tiers (Flash > Urgent) as badges. CrisisWatch: categorical monthly deltas (deteriorated/improved). Bloomberg: curated Top News separate from velocity-ranked News Trends.
