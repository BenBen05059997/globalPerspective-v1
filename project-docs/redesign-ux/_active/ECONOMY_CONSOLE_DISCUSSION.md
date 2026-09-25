# Economy in the console style: discussion (2026-09-25)

**Status:** options for operator discussion. Design only, nothing built. It builds on the approved console, story mode, legend and
default tokens (`STORY_WEB_RETHINK_PLAN.md` §7–9).

## Where /economy is today (verified 2026-09-25)
- **Two modes:** `?view=today` and `?view=week`.
  - **Today** shows, in order:
    - a masthead;
    - "Today in the economy", a deterministic one-paragraph lead;
    - a filter rail;
    - the "Repricing today" instrument leaderboard (expandable rows: sparkline, key levels, why it's moving, driving stories, country chips);
    - a dormant-instruments drawer;
    - "Active disruptions" cards;
    - a right-rail "Market Context" dashboard.
  - **This week** is a published weekly wrap.
- **Data:**
  - Prices: `newsMarketsData`, hourly, no LLM. **Live**, as of 09:36 UTC today.
  - Disruptions (story → instruments): `newsEconomicImpact` (DeepSeek v4-pro, daily). **Frozen since 12 Sep** by the DeepSeek balance. 102 records span 05-19 → 09-12.
    These records do **not** expire: the table's TTL is disabled, so old ones stay served.
  - Quality judge: `newsEconomicQuality` (Gemini).
  - Weekly: `newsWeeklyMarkets`. Last published 20 Sep; next run 27 Sep.
- **Links:** every disruption has `threadId` + per-instrument `citedTopicIds` (dated news), plus winners/losers of type country/sector/company.
  So story → instrument → countries is buildable client-side, with no new backend.
- **Known problems** (page review):
  - 27% of `/economy` story links point to stories aged out of the 30-day archive (they need the archived-story state).
  - "Today's driver" once cited a 103-day-old story.
  - Worst layout shift on the site (CLS 1.19).
  - Right-rail numbers truncate.

## References (research pass)
- **Offworld Trading Company:** a news ticker and a price board share one screen; "read the ticker, react on the board".
- **TradingView:** news/event markers drawn on the price chart at their time.
- **Bloomberg WEI:** a dense world grid with drill-down; NI news hyperlinks tickers.
- **Finviz map:** a treemap with size ≠ colour. Good for scanning, poor for exact numbers (NN/g), so use it for overview only.
- **Victoria 3 market screen:** even game players want a sortable table.
- **Kpler/Vortexa/EIA:** chokepoint flow maps framed as volume-at-risk, and as scenario rather than cause.

## Options
- **A. Board + ticker** (recommended home view):
  - An instrument board grouped by class (energy · metals · FX · rates · equities · crypto). Each tile shows price, day move, sparkline and
    freshness brightness, plus a badge "2 stories" when disruptions point at it.
  - A **disruption ticker** beside it, one line per story → instrument link:
    "US–Iran Hormuz → BRENT ▲ moderate · model judgment · judge ✓ · 12 Sep".
  - Hovering a line shows the StoryPeek and lights its tile. Clicking opens the story (story mode, MARKETS slide).
- **B. Instrument detail = chart with story markers** (TradingView). Dashed vertical markers sit at the dates of the cited news,
  labelled "model judgment". This is reached from a tile, not a home view.
- **C. WHERE mode (map).** Pick an instrument or disruption and the map tints its winner/loser countries, using ▲/▼ badges and brightness, never
  new hues. Chokepoint flow arcs are only for commodity stories, later.

## Decisions for the operator
| # | Decision | Recommendation |
|---|---|---|
| E1 | Economy home layout | **A: board + ticker**, one screen, console style |
| E2 | Instrument drill-down | **B: price chart with dated story markers** |
| E3 | Map on economy | **C as an optional WHERE toggle**; flow arcs later, commodity stories only |
| E4 | "This week" wrap | Move it into **/briefings Weekly** as its markets section; the economy page links to it |
| E5 | Story mode | Add a **MARKETS slide** when a story has an impact record (tiles for its instruments, with direction + magnitude words) |
| E6 | While DeepSeek is out | Prices stay live; the ticker header says "story analysis paused since 12 Sep"; items older than 7 days are amber, over 30 days hidden (legend rule) |
| E7 | Home console | Optional thin market ticker strip (Plague-Inc-style), with the instruments only, no AI claims |
| E8 | Old disruption links | Show the archived-story state instead of the "aged out" fallback (fixes 27% dead links) |

Honesty carried over: magnitude is **words** (small/moderate/large), never %; every AI line reads "model judgment" plus the quality flag;
price freshness and analysis freshness are shown separately.
