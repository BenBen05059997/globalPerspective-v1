# Economic Disruption Layer — Plan

**Status:** APPROVED 2026-05-18
**Target:** Phase 1 ships in ~2 days. Phase 2 + 3 in ~3 more days.
**Marginal infra cost:** <$1/month

## Why

For every news thread with an economic dimension, surface **how the world is being repriced**: which instruments move, in what direction, with what severity, why (mechanism), who wins/loses, and what historical analog applies — every claim citing a real topicId.

The methodology research (Caldara & Iacoviello 2022, BlackRock MDS, Eurasia Group, IMF GFSR 2025) is unanimous: **compute the numbers, don't generate them.** LLMs hallucinate point estimates badly (FAITH benchmark: 10-20% error on multi-step numerical reasoning). Serious quant firms never publish precise % impact predictions — they use severity bands.

Our split:
- **LLM generates:** direction signs (↑/↓), severity bands (small/moderate/large), 2-3 sentence mechanism narrative, historical-analog selection, list of relevant instruments from a closed allowlist
- **Markets Lambda provides:** actual price levels, observed % moves since event date (labeled "Observed since…" not "Caused by…")
- **Curated analog table** (Phase 3): ~30 reference events with their realized historical asset moves

## Architecture

```
news threads ───┐
                ▼
       newsThreadAnalysis (06:30 UTC)
                │
news countries ─┤
                ▼
   newsCountryIntelligence (07:00 UTC)
                │
                ▼
      newsSystemsAnalysis (07:15 UTC)
                │
                ▼
   newsEconomicImpact (07:30 UTC) ◄── NEW Lambda
                │
                ├── reads thread analyses + topic SUMMARIES + MARKETS_DDB_TABLE
                ├── calls DeepSeek with closed instrument allowlist
                ├── validates JSON, drops uncited claims, drops out-of-allowlist instruments
                └── writes ECON#THREAD#{id} / ECONOMIC_IMPACT to SUMMARIZE_PREDICT_TABLE (21d TTL)
                       │
                       ▼
            newsSensitiveData adds 2 actions (Phase 1) + 1 more (Phase 2)
                       │
                       ▼
         Frontend: ThreadPage Economy tab + CountryPage Disruption rail + /economy index (Phase 2)
```

No new DDB table. No new IAM. Mirrors `newsSystemsAnalysis` Lambda pattern exactly.

## The JSON contract (LOCKED)

```jsonc
{
  "scope": "thread",                            // "thread" | "country" (Phase 2)
  "scopeId": "thread-iran-israel-a3f2",
  "headline": "Iran-Israel tensions push Brent +4% as supply risk repriced",
  "severity": "severe",                          // enum: minor | moderate | severe
  "severityScore": 72,                            // 0-100 for cross-disruption sort
  "confidence": "high",                           // enum: low | medium | high
  "horizon": "days",                              // enum: immediate | days | weeks | months
  "instruments": [
    {
      "instrumentId": "BRENT",                    // CLOSED ALLOWLIST — anything else dropped
      "direction": "up",                          // up | down | mixed
      "magnitude": "moderate",                    // small | moderate | large (NO percentages)
      "rationale": "Supply-risk premium reflects Hormuz exposure...",
      "citedTopicIds": ["topic-abc","topic-def"]  // required, non-empty
    }
  ],
  "winners": [{"name":"Saudi Arabia","type":"country","why":"Spare capacity bid up"}],
  "losers":  [{"name":"Japan","type":"country","why":"95% oil import-dependent"}],
  "mechanism": "1-2 paragraph causal chain, must cite at least one [topic-xxx] inline",
  "historicalAnalog": {
    "event": "2019 Abqaiq attack",
    "year": "2019",
    "outcome": "Brent +15% intraday, retraced 60% within 2 weeks",
    "caveat": "Different scope: facility-level vs regional"
  },
  "watchSignals": ["Hormuz transits below 50/day", "OPEC+ emergency call"],
  "citedTopicIds": ["topic-abc","topic-def","topic-ghi"],
  "marketContext": {
    "BRENT": {"value": 82.40, "asOf": "2026-05-18T07:00:00Z"},
    "VIX":   {"value": 18.2,  "asOf": "..."}
  },
  "generatedAt": "2026-05-18T07:30:00Z",
  "modelId": "deepseek-chat",
  "hasImpact": true                               // false = tombstone, see below
}
```

### Critical guards (the anti-hallucination spine)

1. **Closed instrument allowlist** — server-side drop of anything not in the list
2. **Citation requirement** — every claim cites topicIds in the input set; uncited claims dropped post-parse
3. **No prices/percentages from LLM** — all numbers come from `marketContext` snapshot
4. **Tombstones** — when no economic dimension exists, write `{hasImpact: false}` to prevent regeneration

## Closed instrument allowlist

```
COMMODITIES (6):    BRENT WTI GOLD COPPER VIX DXY
RATES (5):          US10Y US2Y UK10Y DE10Y JP10Y
EQUITY_INDICES (15): SPX NDX DJI FTM DAX N225 HSI SSEC KS11 TWII NSEI BVSP MERV XU100 TA125
SECTOR_ETFS (8):    XLE ITA SOXX XLF EEM EFA GDX SHY
CREDIT (2):         EMB HYG
FX (29):            USD/EUR, USD/JPY, ..., USD/ARS (existing Frankfurter list)
CRYPTO (2):         BTC ETH (Phase 2, tagged geopoliticalRelevance)
MACRO_BUCKETS (4):  EQUITIES_EM EQUITIES_DM CREDIT_EM CREDIT_DM (qualitative direction)
```

Total: ~71 instruments. Wide enough for narrative coverage, narrow enough to prevent fabrication.

## Phase 1 — Foundation (~2 days)

### Backend

| File | Action | Effort |
|---|---|---|
| `amplify/backend/function/newsMarketsData/src/index.js` | Extend with `fetchEquitiesAndETFs()` — 23 indices/ETFs via Stooq (same pattern as commodities). New DDB rows: `EQUITIES#GLOBAL/LATEST + HISTORY#`. | ~30 lines |
| `amplify/backend/function/newsEconomicImpact/src/index.js` | **NEW Lambda**. Copy `newsSystemsAnalysis` skeleton. Reads thread analyses + topic SUMMARIES + markets data. Calls DeepSeek with closed allowlist. Validates JSON. Writes `ECON#THREAD#{id}`. | ~280 lines |
| `amplify/backend/function/newsEconomicImpact/src/package.json` | New | ~10 lines |
| `amplify/backend/function/newsSensitiveData/src/index.js` | Add 2 actions: `economic_impact`, `economic_impact_list` | ~50 lines |
| EventBridge Rule `TriggerNewsEconomicImpact` | `cron(30 7 * * ? *)` daily 07:30 UTC (manual AWS Console step) | — |
| IAM | Reuse existing `SUMMARIZE_PREDICT_TABLE` + `MARKETS_DDB_TABLE` read perms | — |

### Frontend

| File | Action |
|---|---|
| `src/components/atoms/SeverityBadge.jsx` | NEW — mirrors RiskScoreBadge, uses risk tokens (severe→h, moderate→e, minor→l) |
| `src/components/atoms/DirectionArrow.jsx` | NEW — ↑/↓/→ mono glyph |
| `src/components/atoms/InstrumentChip.jsx` | NEW — `[BRENT $82.4][↑ moderate ▇▇░]` |
| `src/components/atoms/MechanismCard.jsx` | NEW — mechanism + winners/losers split + analog row |
| `src/components/atoms/DisruptionPreview.jsx` | NEW — right-rail teaser card |
| `src/components/atoms/atoms.css` | Add styles for above atoms |
| `src/hooks/useEconomicImpact.js` | NEW — fetch single thread impact, 30min localStorage cache |
| `src/hooks/useDisruptionsList.js` | NEW — fetch list, optional country filter |
| `src/services/restProxy.js` | Add `fetchEconomicImpact` + `fetchDisruptionsList` |
| `src/components/ThreadPage.jsx` | Add 4th center tab "Economy" + right-rail DisruptionPreview above Live Web Evidence |
| `src/components/CountryPage.jsx` | Insert "Economic Disruption" section above Macro Snapshot; relabel Macro to **MACRO BASELINE** |
| `src/components/Disclosures.jsx` | Add "not investment advice" paragraph + methodology section |

## Phase 2 — `/economy` flagship index (~1 day)

### Backend
- `economic_top_movers` API action (Scan + in-memory aggregation; no GSI needed at this scale)
- Country aggregator pass in `newsEconomicImpact` Lambda: `ECON#COUNTRY#{name}` records synthesizing all country's threads (separate LLM call per country, daily)
- Crypto via CoinGecko free tier (BTC + ETH only, tagged `geopoliticalRelevance`)

### Frontend
- New route `/economy` + nav entry + footer link
- New atoms: `DisruptionRow`
- New page: `EconomyPage.jsx` with 3-col EditorialShell (left=facet filters, center=severity-grouped list, right="Today's Top Movers")
- SEO: Cloudflare Worker bot pre-rendering for `/economy` (matches `/weekly/country/:name` pattern)
- `WeeklyPage.jsx` StoryCard inline `SeverityBadge`

## Phase 3 — Map lens + calibration moat (~1.5 days)

### Backend
- `amplify/backend/function/newsEconomicImpact/src/economic_analogs.json` — curated ~30 reference events with their *realized historical* asset moves
- `amplify/backend/function/newsGeopoliticalRiskIndex/src/index.js` — Caldara & Iacoviello-style port: categorized keyword z-score on your 26 RSS feeds; stores `GPR#GLOBAL/LATEST` + `HISTORY#`
- Direction-call calibration tracker: store each direction call with timestamp + instrument; at 30/60/90 days, compute hit rate vs realized market moves from `MARKETS_DDB_TABLE` HISTORY

### Frontend
- WorldMapV2: 4th lens "Economy" — choropleth (severity exposure), transmission arcs (producer→importer), pulse markers on hot spots, time window 24h/7d/30d. Reuses existing Flows lens scaffolding.
- DailyPage: "Today's Economic Footprint" section between masthead and Top Stories
- CountryListPage: severity sort + column
- Home: optional inline `[SEVERE]` badge in top-story kicker
- Hit-rate "trust badge" on `/economy` page footer (the moat — no LLM product does this)

## Crypto strategy

- **Tier 2** (Phase 2 only). BTC + ETH only. CoinGecko free tier.
- Tagged `geopoliticalRelevance: "sanctions" | "capital_flight" | "general"` per instrument citation
- Surfaces ONLY when LLM cites it on a relevant story (Russia sanctions, Argentina capital flight, China crackdown)
- Never default-displayed on US election / climate / etc. threads
- No memecoins, no altcoins, no on-chain metrics

## Skip list (analyst clutter > additive value)

- ❌ Individual stocks (e.g., TSM, Aramco) — SOXX/XLE handles it without LLM precision risk
- ❌ Sovereign CDS spreads — requires Bloomberg/Refinitiv (paid)
- ❌ Options skew / IV — paid feeds, institutional-only
- ❌ Memecoins / altcoins — credibility killer
- ❌ Home "markets strip" — competes with editorial lede
- ❌ Instrument detail pages (`/instrument/BRENT`) — replaced by `/economy?instrument=BRENT` filter
- ❌ Per-topic disruption records — too noisy, thread is the right unit
- ❌ Reverse Lambda (market anomaly → news) — Phase 4 or never
- ❌ Empty "no impact" stubs — analyst audience reads silence correctly

## Methodology rigor (the differentiation moat)

Three things that take this from "AI markets blurb" to "credible analyst tool":

1. **Closed instrument allowlist + cited claims + tombstones** — eliminates the LLM failure modes that kill credibility (fabricated tickers, made-up moves, confident BS when no story exists)
2. **Historical analog table with realized moves** (Phase 3) — shows readers what *actually happened* last time, not what we predict will happen now
3. **Direction-call hit rate published quarterly** (Phase 3) — at 30/60/90 days, score ourselves. Caldara & Iacoviello + BlackRock dashboards are the references the audience knows.

Plus: prominent "not investment advice" disclosure + every record carries `asOf` + `confidence` + `marketContext.asOf`.

## Risks

| Risk | Mitigation |
|---|---|
| LLM picks "BRENT" but cites a thread about an Argentine election (spurious instrument) | Hallucination guard: drop instruments whose `citedTopicIds` don't include a topic where category ∈ relevant set OR region in a relevant country list (per-instrument relevance check) |
| `marketContext` from MARKETS_DDB_TABLE is stale (>4h) | Render with `asOf` timestamp + amber dot; do not hide |
| Audience perceives precision we don't have | Magnitude is enum (small/moderate/large), never %; analog row shows historical moves, not predictions |
| Regulatory exposure (US, financial guidance without RIA) | "Not investment advice" disclosure on every page footer + Disclosures.jsx update + no imperatives in prompt ("buy gold" never appears) |
| Existing CountryPage Macro Snapshot redundancy | Strictly additive — Macro stays, relabeled to **MACRO BASELINE** to disambiguate baseline vs event-driven. No existing features moved or hidden (`feedback_no_unauthorized_removal.md`). |

## Cost estimate

| Component | Monthly cost |
|---|---|
| DeepSeek calls (~20 analyses/day × 2000 tokens × $0.21/M average) | ~$0.33 |
| Additional Lambda compute | within free tier |
| Additional DDB writes/reads | negligible |
| CoinGecko, Stooq, Frankfurter, FRED, World Bank | all free |
| **Total marginal cost** | **<$1/month** |

For reference: current AI spend is ~$8-10/month total. This adds ~3-4% to that.

## Sources / methodology references

- [Caldara & Iacoviello GPR Index](https://www.matteoiacoviello.com/gpr.htm) — academic standard, free data, peer-reviewed
- [BlackRock Geopolitical Risk Dashboard](https://www.blackrock.com/corporate/insights/blackrock-investment-institute/interactive-charts/geopolitical-risk-dashboard) — UI/UX precedent for MDS layer
- [Eurasia Group Top Risks](https://www.eurasiagroup.net/issues/top-risks-2026) — qualitative methodology
- [Kilian 2009 / Dallas Fed WP 2609](https://www.dallasfed.org/~/media/documents/research/papers/2026/wp2609.pdf) — geopolitical oil shock literature
- [FAITH benchmark](https://arxiv.org/abs/2508.05201) — LLM hallucination on financial numbers
- [FTC influencer disclosure guidance](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers) — disclosure compliance

## Approval log

- **2026-05-18:** Phase 1 + 2 + 3 design approved by user
- **2026-05-18:** Equity indices + sector ETFs in Phase 1: APPROVED
- **2026-05-18:** Crypto (BTC + ETH only) in Phase 2: APPROVED
- **2026-05-18:** Skip individual stocks + CDS + options + memecoins: APPROVED

## Execution order (Phase 1)

1. Extend `newsMarketsData` Lambda with equity indices + sector ETFs (Stooq batch)
2. Build `newsEconomicImpact` Lambda
3. Add 2 actions to `newsSensitiveData`
4. Build 5 frontend atoms + atoms.css
5. Build 2 frontend hooks
6. Update restProxy.js
7. Wire ThreadPage Economy tab + right-rail DisruptionPreview
8. Wire CountryPage Disruption section + relabel Macro
9. Update Disclosures.jsx
10. `npm run build` — verify no errors
11. Hand off Lambda code with deploy instructions to user (manual AWS step)
12. After Lambda deploys + first run: verify with browser test
