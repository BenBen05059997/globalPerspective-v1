# Economy Briefing — Plan & Quality Evaluation

**Status:** Proposed (not yet built) · **Drafted:** 2026-05-29

A "Today in the economy" synthesis lead for `/economy` (`components/EconomyPage.jsx`).

---

## Problem / diagnosis

`/economy` is the only major content page whose documented **primary user job is lookup-first**, not narrative:

| Page | Primary user job (from `PAGES_GUIDE.md`) | Shape |
|------|------------------------------------------|-------|
| `/` Home | "Skim the day's stories, then deep-dive into one" | narrative-first |
| `/daily` | "Read one curated daily summary instead of browsing" | synthesis-first |
| `/economy` | "Start from an instrument ('what's moving Brent, and why?')" | **lookup-first** |

Consequence: a first-time visitor lands on a leaderboard table and must assemble the
story themselves. The page reads as a dashboard, not a briefing. It serves the user who
**already arrives with a question** and offers nothing to the **orient-me** user.

Two doc-grounded reasons a briefing is *more* justified than it first appears:
1. **The page's stated reason to exist is the cross-story picture** — the code header +
   doc both say it "owns the cross-story picture the thread tab structurally can't show."
   Today that synthesis is *implicit*. A briefing makes the page's differentiator explicit.
2. **The page is partly bypassed** — most in-content economic surfaces deep-link to the
   per-story *thread* Economy tab, not here. The cross-story synthesis is this page's only
   unique offer; a briefing delivers it head-on.

**Decision:** add a "Today in the economy" briefing as the lead anchor. It does not replace
the instrument-first design — it adds the missing **orient-me** mode and makes the
cross-story claim real.

---

## Build approach — phased

- **Phase 1 — Deterministic lead (no LLM).** Compose 2–3 sentences from data already on the
  page. Cheap, ships now, zero new infra, **cannot fabricate.** Proves the placement earns
  its space. Becomes the test oracle for Phase 2 (see Quality below).
- **Phase 2 — LLM-written briefing (optional upgrade).** Analyst-depth synthesis. Richer /
  more editorial, but needs a new Lambda + cron + cost, and must be quality-gated.

Start deterministic. Only upgrade to LLM if the placement proves it earns the space.

---

## Data — no new endpoints, no separate news fetch

The "news" is **already attached** to the data the page loads. Every economic-impact record
is keyed to a **`scopeId` (= threadId)** and carries the story **`headline`** — the thread
*is* the news. The briefing synthesizes the three hooks the page already calls:

| Source | Fields | Briefing clause |
|--------|--------|-----------------|
| `useTopMovers` | `instrumentId`, `consensus`, `citations`, `consensusStrength`, `directions{up,down,mixed}` | "Strongest signal: **GOLD**, up across 4 of 5 stories." |
| `useDisruptionsList` | `severity` (counts), most-severe `headline`+`scopeId`, `winners`/`losers` (`type:'country'`) | "7 stories repricing markets — 2 severe. Sharpest: **[headline]** →." |
| `useMarketsGlobal` | `series[id].change` (real day-over-day %), `fx.asOf` | "Biggest real move: **VIX +6.2%**." |

Every clause traces to a real field. Nothing fabricated.

---

## Wiring / how it connects to other pages

Reuse the page's **existing link grammar** — do not invent endpoints:

| Link type | Target | Already used by |
|-----------|--------|-----------------|
| Story → its news | `/weekly/thread/:scopeId?tab=economy` | leaderboard expand, by-story bridge, Daily footprint |
| Country → its page | `/weekly/country/:name` | affected-country chips |
| Instrument → in-page | `setSingle('instrument', id)` filter (no nav) | leaderboard ticker click |

Hub model (Daily already proves the pattern):

```
Daily  ──"Today's Economic Footprint" teaser──▶  Economy  ──per-story──▶  Thread Economy tab
 (editorial sibling)   chips + lead headline      (cross-story hub)         (the actual news)
                       + "View all →"             + BRIEFING (new)
```

- `DailyPage.jsx` `EconomicFootprint` (line ~50) is **already a mini-briefing of the same
  data** (top-5 instruments by citation + lead headline + "View all →"). That's the *teaser*;
  the Economy briefing is the *full* version.
- **Dedup rule:** keep the "top instruments by citation" aggregation **consistent** between
  Daily's footprint and the Economy briefing — share the logic so the same day reads the same
  on both pages, rather than two divergent computations.
- Reuse existing components: `InstrumentChip`, `SeverityBadge`, `Sparkline`.
- **Cross-link the two briefs:** Economy briefing ends with "Full daily brief →" `/daily`
  (Daily already points here).

---

## How we test LLM quality (Phase 2)

Mirrors the existing 5-layer methodology in `ECONOMIC_DISRUPTION_QUALITY_PLAN.md`
(`newsEconomicQuality` Lambda = LLM-as-judge; `quality/` = human spot-check). The briefing
has **one advantage that feature didn't**: a deterministic version already computes the
ground-truth facts, so it acts as a free, programmatic test oracle.

### Layer 1 — Deterministic-grounding diff (free, always-on, the strongest check)
Because Phase 1 computes the same facts, the deterministic output **is the oracle** for the
LLM version. Programmatic assertions (no LLM judge needed):
- **No fabricated numbers** — every numeric token in the briefing must equal a computed value
  (top-mover %, severity count, real `series[id].change`) or be dropped. This is the honesty
  contract, enforced.
- **Top-instrument agreement** — if the briefing says "X is the strongest signal," X must be
  the actual top mover by citation.
- **Severity-count agreement** — stated counts must match `useDisruptionsList` tallies.
- **Citation existence** — every named story must resolve to a real `scopeId` present in the
  loaded set; every named country must appear in some `winners`/`losers`.
- **No contradiction with live levels** — directional claims ("VIX spiked") must agree in sign
  with the instrument's real `series[id].change`.

Any failure → drop the offending clause or fall back to the deterministic lead. Fail closed.

### Layer 2 — LLM-as-judge (cheap, daily)
Reuse the `newsEconomicQuality` pattern: a **different model family** judges (DeepSeek writes
the briefing → **Gemini 2.5 Flash** judges) to decorrelate errors. Score 1–5 on:
1. `grounding_faithfulness` — does every claim follow from the disruption/markets data?
2. `citation_fidelity` — do named stories actually support the claim attached to them?
3. `no_fabrication` — any number/move not in the source data? (hard fail axis)
4. `lead_selection` — is the chosen lead story genuinely the most consequential today?
5. `coherence` — analyst-depth and readable, not filler?

Any axis ≤2 → flag `is_low_quality: true` and **render the deterministic lead instead** (the
briefing fails safe to a version that cannot be wrong).

### Layer 3 — Human spot-check (slow, weekly)
Extend the existing `quality/pick_weekly_review.js` to sample one briefing/week for human
grading. Ground truth for calibrating the judge (Layer 2). Mirrors Phase C of the disruption
plan.

### Layer 4 — Golden-day regression set
Freeze ~5 days of `{disruptions, topMovers, markets}` snapshots with an expected briefing
shape. Re-run on every prompt change to catch drift. Cheap, deterministic, catches
regressions the daily judge would miss.

### Calibration
Don't tune the judge prompt until ≥4 weeks of human reviews exist (same discipline as the
disruption plan — tuning against <4 weeks is calibrating to noise).

---

## Doc hygiene (when built)

- Update the `/economy` entry in `PAGES_GUIDE.md` — "Primary user job" (add orient-me mode)
  + "Key UI elements" (add briefing).
- Add a `CHANGES.md` entry.
- If Phase 2 ships a Lambda: document it in `ARCHITECTURE.md` (Lambda list + DDB key + cron)
  and `SYSTEM_WIRING.md`.

---

## Phase 2 — draft LLM prompt + real-data check (2026-05-29)

Checked against a live day (data dated 2026-05-28, pulled from `economic_top_movers` /
`economic_impact_list` / `markets_global`). Two concrete quality traps found — both now
baked into the prompt rules and the Layer-1 checks.

### Findings from real-data check
1. **Garbage in the markets `series` map.** Junk keys with impossible values
   (`ETH_24H_CHANGE -311%`, `BTC_24H_CHANGE -166%` — can't fall >100%). A naive "biggest
   real move" line would headline `ETH −311%`. **Mitigation:** the briefing must whitelist
   `series` to tracked instruments and bound `|change|` (e.g. <25%) before picking a move.
   Real biggest legit moves that day: KOSPI +3.3%, Nikkei +2.5%, Brent −1.6%.
2. **Consensus vs. realized divergence (the #1 fabrication trap).** News consensus was
   overwhelmingly Brent **up** (27 stories, 85% agree). Brent's **actual day move was −1.6%.**
   These are different things — *what stories expect* vs *what actually moved today*. An LLM
   writing "oil is surging" is wrong on the day. **Mitigation:** prompt must keep CONSENSUS
   DIRECTION and REALIZED MOVE separate and flag divergence explicitly.

### Draft prompt (core rules)
- Use ONLY numbers present in INPUT; never invent a price/%/move.
- Separate **CONSENSUS DIRECTION** ("stories see Brent higher" — forward calls) from
  **REALIZED MOVE** ("Brent actually fell 1.6% today" — day-over-day from market data). When
  they disagree, say so; never smooth it over.
- Every named story must use its real `headline` from INPUT. No invented stories.
- No price targets / no magnitude forecasts beyond the qualitative direction + severity given.
- Omit any claim whose field is absent.
- Structure: (1) day's shape — story count, severity split, dominant most-cited cluster +
  consensus; (2) sharpest story by severity, named; (3) optional notable REALIZED move(s),
  labeled as actual moves, flagging divergence from consensus.
- INPUT shape: `{ asOf, totalStories, severity:{severe,moderate,minor},
  topMovers:[{instrumentId,consensus,citations,consensusStrength}],
  severeStories:[{headline,scopeId}], realizedMoves:[{instrumentId,changePct}] }`
  — `realizedMoves` pre-sanitized (tracked instruments only, `|change|` bounded).

### Grounded target output (2026-05-28 data)
> "36 stories are repricing markets today — 2 severe, 31 moderate — and the board is dominated
> by an oil-and-safe-haven cluster: Brent (27 stories, 85% higher), Gold (91%) and VIX (88%)
> all point one way on Iran–Hormuz tension. The sharpest is **Strait of Hormuz escalation
> threatens global oil supply chokepoint.** But note the divergence — while the news consensus
> is firmly oil-higher, Brent actually fell 1.6% on the day, and Asian equities led real gains
> (KOSPI +3.3%, Nikkei +2.5%)."

Every number traces to a real input field; the divergence is surfaced, not hidden.

### Eval-in-the-loop (dev-time)
Claude serves as the dev-time checker + prompt tuner (replaces Layer 3 human calibration
*during development*). Production still relies on Layer 1 (deterministic fail-closed) as the
runtime guardrail, since Claude isn't in the loop daily. To actually run the prompt against
the live model we need either a local `.env` key for a dry-run script, or generate via the
Lambda and paste output back for critique. Prompt above is hand-grounded, not yet model-run.

---

## Execution plan — eval-driven, who does what (2026-05-29)

Sequencing principle: **build the standard (eval set) before tuning anything.** You can't
optimize a prompt without a fixed target that comes from outside the optimizer.

### Workstreams

| # | Workstream | Owner | Blocked on | Status |
|---|-----------|-------|-----------|--------|
| W1 | **Eval set** — frozen fixtures + programmatic assertion harness + candidate target briefings | agent | — | ✅ done — `quality/briefing/` (12/12 self-test) |
| W1-gate | **Ratify targets** — operator approves/corrects the candidate target briefings → these become ground truth | **Ben (human)** | W1 | ✅ RATIFIED 2026-05-29 by Ben — `quality/briefing/targets/*.md` are now ground truth |
| W2 | **Markets `series` garbage-keys bug** — `ETH_24H_CHANGE -311%` etc. (independent live bug) | agent | — | ✅ fixed + DEPLOYED to `newsSensitiveData-dev` 2026-05-29; verified live (0 junk keys) |
| W3 | **Phase 1 deterministic lead** — compose + render briefing on `/economy` | claude | W1-gate | ✅ **SHIPPED + pushed to `main` 2026-05-29** (commit `7018247`) — `composeEconomyBriefing.js` + `.ep-briefing-band`; 5/5 fixtures pass `verify_compose.mjs`; browser-verified, 0 console errors. Live on GitHub Pages. |
| W4 | **Phase 2 LLM briefing + quality stack** — only if approved | tbd | W3 + decision | not started |

### Eval set layout (W1) — lives in `quality/briefing/` (matches existing `quality/` convention)
```
quality/briefing/
  fixtures/
    real-YYYY-MM-DD.json        ← frozen live snapshots {topMovers, disruptions, markets}
    edge-empty.json             ← no disruptions (must produce honest empty state)
    edge-garbage-series.json    ← contains ETH_24H_CHANGE -311% (must be filtered)
    edge-divergence.json        ← consensus up vs realized down (must be flagged, not smoothed)
    edge-missing-fields.json    ← absent fields (must omit, not guess)
  assertions.js                 ← programmatic honesty-contract checks (objective, pass/fail)
  targets/
    <fixture>.md                ← candidate target briefing per fixture — UNRATIFIED until Ben signs off
```

### Programmatic assertions (the objective floor — no human judgment needed)
1. No numeric token in the briefing absent from the fixture input.
2. Every named story resolves to a real `scopeId` in the fixture.
3. Stated severity counts equal the fixture tallies.
4. No directional claim contradicts the sign of the instrument's realized `series[id].change`.
5. `series` is whitelisted to tracked instruments and `|change|` bounded before any "biggest move" pick.

Subjective ceiling (lead-story choice, prose) → graded later vs Ben's ratified targets +
the Layer-2 LLM judge. Few human labels needed because the honesty floor is all objective.

---

## Open questions

1. Briefing placement — full-width band under the masthead, or top of the center column?
2. Length — tight 2-sentence lead, or 3–4 with most-severe-story hook + affected countries?
3. Phase 2 trigger — is the deterministic lead good enough indefinitely, or is the editorial
   depth worth a new Lambda + cron + cost?
4. If Phase 2: reuse `newsEconomicQuality` Lambda (add a briefing record type) or a new judge?
