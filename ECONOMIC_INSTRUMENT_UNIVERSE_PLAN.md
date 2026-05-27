# Economy Page — Instrument Universe Plan

**Created:** 2026-05-27. Feeds the `/economy` redesign (see `global perspective (1) 2/Economy.html` mockup + `economy-page-design-brief.md`). Decides *what instruments the page shows* and *in which layer*, grounded in a citation-coverage audit of live data — not aspiration.

## The question this answers
The redesign asks for a richer instrument leaderboard (sectors, AI, energy, commodities) + a "Market Context" rail. Before expanding the universe we asked: **can the AI actually grab these instruments from the news it currently produces?** If we add 11 sector ETFs but the news never cites them, we ship empty buckets.

## How an instrument becomes "grabbable" (the wiring chain)
```
newsMarketsData fetches price → DDB LATEST row → marketContext
   → buildInstrumentTable()  (newsEconomicImpact/src/index.js:329)
   → injected into prompt as "ALLOWED INSTRUMENTS (with current values)"
   → LLM picks 2-5 most-relevant → validated vs INSTRUMENT_ALLOWLIST (:66) → stored
   → served by economic_top_movers / economic_impact_list (newsSensitiveData)
```
Hard rule in the prompt: *"instrumentId MUST be from the table above. Anything else dropped."* So an instrument is invisible to the AI unless it appears in `buildInstrumentTable`. Prompt Rule 5: *"Pick 2-5 instruments MOST relevant"* — even a long menu yields only a few citations per story, driven by what the story is actually about.

---

## The audit (evidence)
Scanned `SummarizeAndPredict` (region ap-northeast-1), filter `begins_with(PK,'ECON#THREAD#') AND SK='ECONOMIC_IMPACT' AND hasImpact=true`. **2026-05-27 snapshot.**

- **30 active impact records** (573 rows scanned). Severity: 25 moderate · 4 minor · 1 severe.
- **~117 instrument citations**, **29 distinct instruments**, avg ~3.9 per record (consistent with "pick 2-5").

**Citation frequency (desc):**
| Tier | Instruments | Read |
|---|---|---|
| Dominant | **BRENT 23 · GOLD 18 · VIX 14 · WTI 13** | The geopolitics-risk complex: oil + safe-haven + fear. **68 of 117 = 58%** of all citations. |
| Mid | EEM 6 · DXY 5 · XLE 4 · US10Y 3 · EIS 3 · COPPER 3 | EM equity, dollar, energy sector, rates. |
| Long tail (1–2) | 9 distinct **USD/** FX pairs (CAD,CNY,GBP,EUR,CHF,IDR,BRL,ILS,MXN) · SPX 2 · UK10Y 2 · singletons N225, TWII, FTM, JP10Y, EMB, ITA, EQUITIES_DM/EM | Country-specific FX + scattered indices. |

Top-10 instruments = **79%** of all citations.

**What it proves:**
1. **Heavy concentration in the oil/gold/VIX complex** — exactly the geopolitics-heavy news flow this site produces.
2. **Sector ETFs barely register**: only XLE (4) and ITA (1). **SOXX, XLF = zero**, despite being in the menu. The other 9 GICS sectors we'd add (XLK/XLV/XLI/XLY/XLP/XLU/XLB/XLRE/XLC) have **no news that maps to them today** → as leaderboard rows they'd be permanently empty.
3. **Crypto (BTC/ETH) = zero** — the prompt's "sanctions/capital-flight only" gate works; crypto is context, not a repricing driver.
4. **FX is surprisingly active** in the tail (9 pairs) — the AI reaches for FX on country stories, even though FX isn't surfaced in today's leaderboard.
5. **Caveat — n=30, single news cycle.** This is an Iran/Hormuz/Russia week, hence oil/gold/VIX. A banking-crisis or China-tech week would cite XLF/SOXX/EEM more. The universe must be robust to cycle skew — which is exactly what the two-layer model below gives us.

---

## Decision: the two-layer model
The audit resolves the "complete dashboard vs lean, news-driven page" tension. They are **different layers with different fill rules** — build both:

### Layer 1 — Right rail "Market Context" = standing economic dashboard
- **Fill rule:** live price levels, shown **always**, independent of AI citation.
- **What goes here:** the *complete* economic map — all 11 GICS sectors, full rates curve, full commodity set, dollar/vol, geographic, crypto. Completeness is cheap and correct here because it's just live data.
- **This is "how the economy is doing right now."** Robust to news cycle — a quiet-news day still shows a full dashboard.

### Layer 2 — Leaderboard "Repricing today" = news-cited subset
- **Fill rule:** an instrument earns a row **only when the AI cites it** in an active story.
- **What shows up:** realistically the ~10–12 the audit reveals (BRENT, GOLD, VIX, WTI, EEM, DXY, XLE, US10Y, COPPER, + a rotating FX/index tail), and it **adapts automatically** to whatever the cycle reprices.
- **This is "what today's news is repricing."** Don't pad it — empty sector rows would be noise.

**Consequence:** adding the 9 missing GICS sectors helps **Layer 1 only**. Do not expect (or wait for) them in the leaderboard.

---

## Target instrument universe

### A. Equity sectors — the "where is money flowing" map (Layer 1)
| Sector | ETF | Status | Layer |
|---|---|---|---|
| Technology | XLK | add | dashboard |
| Semiconductors (AI proxy) | SOXX | have | dashboard (rarely cited) |
| Energy | XLE | have | both (cited) |
| Financials | XLF | have | dashboard (0 cites) |
| Health Care | XLV | add | dashboard |
| Industrials | XLI | add | dashboard |
| Consumer Discretionary | XLY | add | dashboard |
| Consumer Staples | XLP | add | dashboard |
| Utilities | XLU | add | dashboard |
| Materials | XLB | add | dashboard |
| Real Estate | XLRE | add | dashboard |
| Communication Svcs | XLC | add | dashboard |
| Aerospace/Defense | ITA | have | both (cited) |

### B. Size / style
SPX ✅, NDX ✅, DJI ✅ — **add RUT** (Russell 2000 = small-cap/domestic-economy gauge, `^rut`). Dashboard.

### C. Rates & credit
US10Y/US2Y/UK10Y/DE10Y/JP10Y ✅ · SHY/HYG/EMB ✅ · optional add **LQD** (IG credit), **TLT** (long end). Both layers (rates are cited).

### D. Commodities — the geopolitics-flow gap (candidate for **Layer 2**, not just dashboard)
Unlike sectors, these have **latent leaderboard demand** the current menu can't capture — Russia-energy → natgas, Ukraine/food → grains, China-leverage → rare earths. Worth adding to the menu so the AI *can* cite them, then watch.
- **NATGAS** (`ng.f`) — Europe/Russia energy
- **SILVER** (`si.f`) — industrial/haven (mockup expected it)
- **Grains** — DBA ETF (`dba.us`) or wheat (`zw.f`) — food security / Ukraine
- **Critical minerals / rare earths** — REMX ETF (`remx.us`) — China export leverage

### E. Dollar & volatility — DXY ✅, VIX ✅ (both layers).
### F. Geographic — EEM ✅, EFA ✅ + country indices ✅ (both; EEM is actively cited).
### G. Crypto — BTC/ETH ✅ (dashboard only; gated out of leaderboard by design).

**No single names** (no NVDA/TSMC). Keeps every call an aggregate — the honesty principle. AI stays represented by SOXX/XLK.

---

## Wiring checklist — adding one instrument
Per ticker, all small mechanical edits in `newsEconomicImpact/src/index.js` (+ data source):
1. **Price source** — add a Stooq symbol to `STOOQ_ETFS`/`STOOQ_INDICES`/`STOOQ_SYMBOLS` in `newsMarketsData` (sector ETFs are `xxx.us`, identical to existing XLE/XLF). For commodities use the `.f` future symbol.
2. **Menu** — add a line to `buildInstrumentTable()` (:329) so the LLM sees it. *(Dashboard-only instruments can be surfaced in the rail without this step — but listing them lets the AI cite them too.)*
3. **Allowlist** — add to `INSTRUMENT_ALLOWLIST` (:66) so validation doesn't drop it.
4. **Analog (optional)** — add an entry to `economic_analogs.json` with `realizedMoves` keyed by the ticker, so a cited analog can show a real historical move.
5. **Serving** — `markets_global` returns the full equities/crypto objects already (`stripMeta`), so dashboard rows need no API change; `markets_history` resolves any symbol across HISTORY rows.

---

## Sequenced execution
1. **Dashboard expansion (Layer 1) — safe, AI-independent, do first.** Add the 9 missing GICS sectors + RUT to `STOOQ_*` fetch maps and the right-rail Market Context groups. Pure data/display; always populates. *(Cost: trivial — same pattern as existing ETFs.)*
2. **Commodity menu expansion (Layer 2 test).** Add NATGAS / SILVER / grains / rare-earths to the fetch maps **and** `buildInstrumentTable` + allowlist + analog catalog. Then re-run this audit in ~1–2 weeks to measure whether the AI actually cites them. Keep the ones that earn citations; the rest fall back to dashboard-only.
3. **Leaderboard stays news-driven.** No padding. Wire it to degrade gracefully (no price/sparkline for the 4 qualitative buckets, "no close analog" empty state — the mockup already shows this pattern).
4. **Re-audit cadence.** Re-run the citation tally each time the news cycle shifts materially, to confirm the leaderboard reflects reality and to catch latent demand for new instruments.

## Honesty constraints (unchanged)
- Real prices + our own aggregates only. **Never a numeric forecast.** Direction (up/down/mixed) + magnitude (small/moderate/large) for the call; real price history beside it.
- Every served level carries an `asOf`. Stale data is labeled, never hidden.
- ETF/index/commodity level only — no single-stock calls.

## Audit reproduction
```
aws dynamodb scan --table-name SummarizeAndPredict --region ap-northeast-1 \
  --filter-expression "begins_with(PK,:p) AND SK=:sk AND hasImpact=:hi" \
  --expression-attribute-values '{":p":{"S":"ECON#THREAD#"},":sk":{"S":"ECONOMIC_IMPACT"},":hi":{"BOOL":true}}' \
  --projection-expression "instruments, severity, headline"
```
Then tally `instruments[].instrumentId` + `.direction`. (Script used 2026-05-27 lives in shell history; n=30, ~117 citations.)
