# Global Perspectives — Redesign + Markets Data Plan

**Created:** 2026-04-25
**Status:** Planning → Ready to execute
**Owner:** Ben

---

## Summary

Two parallel tracks:

- **Track A — Frontend redesign** to the new design system in `global perspective.zip` (Direction A: Editorial Brief, hybridized with SaaS chrome). ~9 working days.
- **Track B — `newsMarketsData` Lambda** ingesting free economic data (FX, bond yields, country macros, commodities) to support the cross news+economic positioning. ~4.5 working days.

The two tracks are independent (different files, no merge conflicts). They sync at three checkpoints.

---

## Strategic positioning

> **Global Perspectives** — the AI-powered platform connecting global news to the markets and macro data that explains it.

Every news topic becomes a richer object: not just "Argentina IMF talks" but "Argentina IMF talks → peso 38% gap, reserves $28.1B, blue-dollar +6pp this week."

**Audience:** analysts, traders, policy folk, founders with global ops. Self-selecting pro readers (per `feedback_audience_depth.md`).

**Honesty contract:** every market data point shows `asOf` timestamp. No fake "live" badges. Stale data hurts credibility more than missing data.

---

## Design system reference

Design package: `global perspective.zip` (extracted to `/tmp/gp_redesign/`).

### Three directions explored
| Direction | Voice | Vibe |
|---|---|---|
| A · Editorial Brief | Fraunces serif + Source Serif + JetBrains Mono · cream + ink + rust accent | The Economist / Foreign Affairs |
| B · Analyst Terminal | JetBrains Mono · near-black + amber + risk colors | Bloomberg / Palantir / Stratfor |
| C · Modern SaaS | Geist + Inter · off-white + teal accent · soft cards | Linear / Notion / Attio |

### Winning hybrid (chosen)
**Direction A's editorial soul + Direction C's product chrome.** Specified across 6 production HTML files: Design System, Brief, Daily, Map Redesign, Thread Detail, Country Detail.

### Design tokens (from `Design System.html`)
```
--paper:#fbfbf9 · --ink:#0a0a0a · --accent:#a2442e (rust)
--risk-h:#c94a33 · --risk-e:#d89540 · --risk-l:#4fa07b
--serif:Fraunces · --sans:Inter · --mono:JetBrains Mono
```

### Common shell
- 56px sticky top nav (logo · centered links · search w/ ⌘K · primary button)
- 34px status strip (mono ticker)
- Main 3-column body (varies per page)
- 26px footer status bar

---

## Data gap audit

### Free wins (use today, no backend changes)
- `country` from `regions[0]`
- `countryCode` from `utils/countryMapping.js` (already exists)
- `firstSeen` derived from archive scan
- `trend` from country/thread `trajectory` field
- Sources count from `sources.length`
- Thread micro-titles via existing `entryShortTitles`

### Small backend tweaks needed
- **Structured `traceCause`** — change `NewsProjectInvokeAgentLambda` Grok prompt to emit `[{t, e}]` array instead of prose. ~1 day.
- **Sources scanned count** — expose count from `newsInvokeGemini` runs in `topics` response. ~2 hours.

### Net-new data (Track B)
- FX rates, bond yields, commodities, country macros, Global Risk Index, 14-day risk sparkline (after 14 days of logging).

### Deferred (not in v1)
- Real-time live ticker (use delayed snapshots)
- Peso-blue / lira-street scrapers
- Country×institution edges (could derive later from news mentions)
- Bloomberg/Reuters terminal data

---

## Track A — Frontend redesign

| Step | What | Files | Days | Status |
|---|---|---|---|---|
| A1 | Port design tokens from `Design System.html` into `tokens.css` | `frontend/src/styles/tokens.css` (new), `index.css` | 0.5 | ✅ 2026-04-25 |
| A2 | Add Google Fonts (Fraunces, Inter, JetBrains Mono) | `index.html` | 0.1 | ✅ 2026-04-25 (via @import in tokens.css) |
| A3 | Rebuild nav shell (56px nav + 34px status strip + footer) | `Layout.jsx`, `Layout.css` | 1 | ✅ 2026-04-25 |
| A4 | Redesign Home → match `Brief.html` | `Home.jsx`, `Home.css` | 1.5 | ✅ 2026-04-25 |
| A5 | Redesign Daily → match `Daily.html` | `DailyPage.jsx`, `DailyPage.css` | 1 | ✅ 2026-04-25 |
| A6 | Redesign Thread → match `Thread Detail.html` | `ThreadPage.jsx`, `ThreadPage.css` | 1.5 | ✅ 2026-04-25 |
| A7 | Redesign Country → match `Country Detail.html` (markets sidebar wires in here) | `CountryPage.jsx`, `CountryPage.css` | 1.5 | ✅ 2026-04-25 |
| A8 | Redesign Map → match `Map Redesign.html` | `WorldMap.jsx` | 2 | ✅ 2026-04-25 |

**Total: ~9 days.**

---

## Track B — `newsMarketsData` Lambda (free sources only)

### Architecture
```
EventBridge crons → newsMarketsData Lambda
  ├─ Frankfurter (FX, hourly, no key)
  ├─ FRED (yields, daily, free key)
  ├─ World Bank (macros, weekly, no key)
  ├─ Stooq (commodities, hourly, no key)
  └─ IMF SDMX (quarterly, no key) [optional v1]
        ↓
  MARKETS_DDB_TABLE
        ↓
  newsSensitiveData (3 new actions)
        ↓
  React frontend hooks
```

### DynamoDB schema — `MARKETS_DDB_TABLE`

| PK | SK | Contents | TTL | Refresh |
|---|---|---|---|---|
| `FX#USD` | `LATEST` | `{ EUR, JPY, ARS, TRY, ... }` + asOf | 2d | hourly |
| `FX#USD` | `HISTORY#YYYY-MM-DD` | daily snapshot | 90d | daily 00:00 UTC |
| `RATES#GLOBAL` | `LATEST` | `{ US10Y, UK10Y, DE10Y, JP10Y, US2Y, ... }` | 2d | daily |
| `COMMODITIES#GLOBAL` | `LATEST` | `{ brent, wti, gold, copper, vix, dxy }` | 1d | hourly (delayed) |
| `MACRO#{country}` | `LATEST` | `{ gdp, cpi_yoy, reserves_usd, debt_to_gdp, current_account, unemployment }` | 90d | weekly |
| `MACRO#{country}` | `HISTORY#YYYY-Q#` | quarterly history for sparklines | 5y | quarterly |
| `INDEX#GLOBAL` | `RISK#YYYY-MM-DD` | computed Global Risk Index daily snapshot | 90d | daily, by `newsCountryIntelligence` |

### New `newsSensitiveData` actions

| Action | Auth | Payload | Returns |
|---|---|---|---|
| `markets_global` | none | — | Latest FX + bond yields + commodities + global risk index |
| `markets_country` | none | `{ country }` | `MACRO#{country}` + relevant FX + yields + risk history |
| `markets_history` | none | `{ symbol, days }` | History array for sparklines |

### Steps

| Step | What | Source | Refresh | Days | Status |
|---|---|---|---|---|---|
| B1 | Create `MARKETS_DDB_TABLE`, Lambda skeleton, IAM role | `amplify/backend/function/newsMarketsData/src/index.js` | — | 0.5 | ✅ 2026-04-25 (skeleton + all 4 sources written, needs DDB table + deploy) |
| B2 | Wire Frankfurter (FX, USD base, 30 pairs) | built into B1 | hourly | 0.5 | ✅ 2026-04-25 |
| B3 | Wire FRED (US 2Y/10Y, UK/DE/JP 10Y) | built into B1 | daily | 0.5 | ✅ 2026-04-25 (needs FRED_API_KEY env var) |
| B4 | Wire World Bank (top 50 countries by article volume) | built into B1 | weekly | 1 | ✅ 2026-04-25 |
| B5 | Wire Stooq (Brent, WTI, gold, copper, VIX, DXY) | built into B1 | hourly | 0.5 | ✅ 2026-04-25 |
| B6 | Deploy Lambda + IAM role + EventBridge schedules | `newsMarketsData` (ap-northeast-1, nodejs24.x, 300s, 512MB) | — | 0.25 | ✅ 2026-04-25 — 3 EventBridge rules: hourly/daily/weekly. Smoke test passed — FX 29 pairs + commodities writing to DDB |
| B7 | Add 3 actions in `newsSensitiveData` | `newsSensitiveData-dev` deployed | — | 0.5 | ✅ 2026-04-25 — markets_global/country/history all verified |
| B8 | Add `restProxy.js` fns + `useMarketsGlobal()`, `useMarketsCountry()` hooks | `hooks/useMarketsGlobal.js`, `hooks/useMarketsCountry.js` | — | 0.5 | ✅ 2026-04-25 |
| B9 | All sources verified end-to-end | FX 29 pairs, yields US10Y 4.34%/DE10Y 2.91%/JP10Y 2.35%, commodities all 6, macros Sunday | — | — | ✅ 2026-04-25 |

**Total: ~4.5 days.**

### Operational properties
- **Rate limits**: FRED 120 req/min, others uncapped. Comfortable within hourly cron.
- **Failure mode**: each source wrapped in try/catch — one source dying never fails the whole run.
- **Cost**: $0 ingest, ~$0.10/mo DDB. Lambda invocation negligible.
- **Honesty**: every response includes `asOf` timestamp.

---

## Sync points

| Sync | When | What |
|---|---|---|
| **S1: Token alignment** | After A1 | Tokens file is the contract — no hardcoded colors elsewhere |
| **S2: Hook contracts** | After B8 | Lock shape of `useMarketsCountry()` before A7 starts using it |
| **S3: Country page integration** | A7 + B complete | Country sidebar's macro indicators wire in. Both tracks must be done by here |

---

## What this unlocks beyond the redesign

1. **Smarter AI prompts** — `newsCountryIntelligence` can reference actual peso gap and reserves numbers instead of paraphrasing news. Quality jump.
2. **New page `/markets`** — country-by-country macro index. SEO play.
3. **Daily brief enrichment** — AI Daily Brief leads with "Markets reacted: peso -3.1%, S&P +0.4%, Brent flat."
4. **Predictions become falsifiable** — "peso devaluation by Q3" can be checked against actual moves. Builds trust.

---

## Risks acknowledged

1. **Scope creep** — bundling two projects. Mitigation: tracks are genuinely independent, sync points minimal.
2. **Mock-vs-data gap on launch** — if markets data is sparse early, redesigned country sidebar shows blanks. Mitigation: graceful fallback per indicator; never render an empty card.
3. **Audience repositioning** — readers signed up for "AI explains news," now getting "news + markets." Mitigation: markets are additive, not replacement. Existing reading flow unchanged.
4. **Maintenance burden** — 5 free APIs = 5 things that can break. Mitigation: independent try/catch per source; cached values keep serving. Solo operator reality.
5. **World Bank data is slow-moving** — quarterly/annual, not real-time. Reality: that's how official macro data works. We label refresh cadence honestly.

---

## Decisions log

- **2026-04-25** — Chose Direction A hybrid (editorial soul + SaaS chrome) per `global perspective.zip`. Rejected pure Terminal (B) and pure SaaS (C).
- **2026-04-25** — Adding live economic data approved. Free sources only in v1. No paid feeds (Polygon, Trading Economics, Bloomberg) until validated.
- **2026-04-25** — Tracks A and B run in parallel. Frontend redesign does NOT block on markets data; pages render with graceful empty states until Track B catches up.
- **2026-04-25** — Skipping for v1: real-time ticker, peso-blue scraper, country×institution edges. Revisit after launch.

---

## Open questions

- Do we want `/markets` as a new top-level route or keep markets data scoped to existing pages (Country, Daily, Home)?
- Should markets ingestion be a single Lambda with multiple cron schedules, or split into 3 Lambdas (FX-hourly, yields-daily, macros-weekly)? Single is simpler; split is cleaner failure isolation.
- Top 50 countries for macro pull — derive from last 30 days article volume, or hardcode a list? Derive is dynamic but adds a dependency.

---

## Next actions

- **A3** — Rebuild `Layout.jsx` nav shell (56px nav + 34px status strip)
- **B6** — Create `MARKETS_DDB_TABLE` in AWS console + EventBridge schedules + deploy Lambda
- **B7** — Add `markets_global`, `markets_country`, `markets_history` actions to `newsSensitiveData`
- **Need from Ben** — FRED free API key (https://fred.stlouisfed.org/docs/api/api_key.html)
