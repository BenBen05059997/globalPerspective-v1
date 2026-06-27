# Weekly Markets Report — Plan

**Status:** PROPOSED (not built). Authored 2026-06-27.
**One-liner:** A weekly, **price-first** AI markets wrap — "what moved this week and why" — that grounds each move in our own news coverage when we have it, and falls back to a clearly-labeled web-search explanation when we don't.

This is the *instrument → explanation* counterpart to `/economy` (which is *news → instrument*). It is a sibling of the existing **Weekly Signals Brief** pipeline (`newsWeeklyBrief`) and clones that pipeline's shape: scheduled draft → human approval → publish → serve → page.

---

## Why this shape (decisions already made)

- **Price-first, not news-first.** The reader wants "what moved and why" — this must not depend on our news pipeline having caught the story. The current `/economy` is news→instrument; this fills the missing half.
- **Weekly cadence + human gate.** Reuses the proven `newsWeeklyBrief` → `weekly/review.js` → `/weekly-brief` skeleton. Generate→review→publish→serve.
- **Hybrid grounding.** For each mover: link our DB thread if one cites that instrument; else a free-form explanation where **the model does its own web search** (a search-capable LLM — Perplexity `sonar`, the same provider the Analysis Studio "Deep research" mode already uses — not a separate Brave fetch). No DB story and no key/result ⇒ honest "no clear driver found", never fabricated.
- **Dedicated infra** (a `newsWeeklyMarkets` Lambda + own record type), not bolted onto the geopolitical signals brief — mixing a price-wrap into that brief muddies both. (Matches the "prefer dedicated Lambdas/tables" preference.)
- **Predictions stay free-form.** No rigid predicted-vs-realized calibration loop (explicitly dropped as over-engineering). Keep the existing per-topic PREDICTION as-is.
- **v1 = page-only.** No email in v1 (the pattern supports Resend later if wanted).

---

## The honesty layering (the make-or-break)

This project's honesty contract is strict (faithfulness ≠ truth; no fabricated analysis; honest empty states). Attributing a weekly price move to a cause is notoriously post-hoc, so the report MUST visibly separate three trust tiers:

| Tier | What it is | Source | Label |
|---|---|---|---|
| **The move** | the real % change over the week | computed from our `GlobalPerspectiveMarkets` history (never AI) | plain number |
| **Our coverage** | a linked DB thread that cites this instrument | our `ECONOMIC_IMPACT` records | "Our coverage →" (our analysis) |
| **Web context** | free-form explanation when we have no story | a **self-searching LLM** (Perplexity `sonar`), **cited** | "Web context (not our analysis)" + sources |

Rules: web-context is framed as **candidate drivers, not causation** ("news search attributes the move to X [source]", never "rose because X"). No invented figures/dates. Empty sections omitted. If a mover has neither our coverage nor a credible web explanation, show the move with "No clear driver found" rather than inventing one.

**Web-search provider:** Perplexity `sonar` (OpenAI-compatible endpoint `https://api.perplexity.ai/chat/completions`), key `PERPLEXITY_API_KEY` (plaintext Lambda env var, per convention). The model performs the search itself and returns cited context — we do NOT run a separate Brave/search call. Reference the existing Perplexity call shape in `services/llm.js` (Analysis Studio). **Optional + graceful-degrade:** if the key is unset or the call fails, that mover falls back to `grounding:"none"` ("no clear driver found") — never blocks the report, never fabricates. Cost is negligible (weekly run, only movers lacking our coverage).

---

## Data flow

```
newsWeeklyMarkets (weekly cron, manual-invoke first)
  1. Read GlobalPerspectiveMarkets HISTORY# rows for the tracked universe
     → compute each instrument's 1-week realized % move (deterministic)
  2. Select the week's biggest movers (top gainers + losers by |%|, vol-aware)
  3. For each mover:
       a. find ECONOMIC_IMPACT records citing it this week  → "our coverage"
            → DeepSeek writes a SHORT note grounded ONLY in our records
       b. if none → Perplexity sonar (self-searching LLM)   → "web context" (cited)
       c. if neither available → grounding:"none" (honest "no clear driver found")
  4. Write WEEKLY_MARKETS#{weekKey} / WEEKLY_MARKETS, status:'draft' (180d TTL)
        │
weekly-markets/review.js  → human publishes (status → 'published')
        │
newsSensitiveData  action "weekly_markets" → latest published record
        │
restProxy.fetchWeeklyMarkets() → useWeeklyMarkets() → WeeklyMarketsPage (/weekly-markets)
```

The deterministic move computation reuses the same `HISTORY#` transpose logic the `markets_global` action already does (per-instrument daily-close series → week-over-week %).

---

## Record schema (`WEEKLY_MARKETS#{weekKey}` / `WEEKLY_MARKETS`)

```json
{
  "PK": "WEEKLY_MARKETS#2026-06-28", "SK": "WEEKLY_MARKETS",
  "weekOf": "2026-06-28", "asOf": "2026-06-28",
  "status": "draft",                          // → published via review script
  "movers": [
    {
      "instrumentId": "BRENT", "name": "Brent crude",
      "changePct": 6.4, "direction": "up",    // deterministic, real
      "weekStart": 71.2, "weekEnd": 75.8,     // deterministic anchors
      "grounding": "coverage" | "web" | "none",
      "note": "...",                          // LLM text, grounded only
      "coverage": [ { "threadId": "...", "headline": "...", "severity": "..." } ],
      "sources": [ { "title": "...", "url": "..." } ]  // web-context citations
    }
  ],
  "generatedAt": "...", "model": "deepseek-chat",
  "ttl": <180d>
}
```

Mirrors the weekly-brief record (draft→published, 180d TTL, deterministic data + LLM text joined server-side, model never supplies the numbers).

---

## Cross-page linking (hub-and-spoke)

`/weekly-markets` is the **weekly markets hub**. Other pages link **up** to it; the report links **down** to threads + countries.

**Pages link UP to the report:**
- **Home + Map** — a slim "Markets this week →" entry (Home: near the economic badges; Map: by the Economy lens). The report is global, so this is a "zoom out to markets" link.
- **Country page** (`/weekly/country/:name`) — when the country has market exposure (it already loads `useDisruptionsList({country})`), show "How markets moved this week →". v1: contextual link to `/weekly-markets`. v2: deep-link `?country=X` once movers carry affected-country tags.
- **Thread page** (`/weekly/thread/:id`, Economy tab) — when the thread's instruments appear in the week's movers, "This story moved markets this week →" deep-linking to that mover (anchor `#<instrumentId>`).
- **`/economy`** (live daily dashboard) — sibling cross-link: a "Weekly wrap →" header link; the report links back "Live dashboard →". The two economic surfaces should reference each other.

**The report links DOWN (reciprocal):**
- Each mover's "Our coverage" → the thread Economy tab (`threadPath(threadId, {tab:'economy'})`), exactly as `/economy` already does.
- Affected-country chips → `/weekly/country/:name`.

**Deep-link mechanism:** anchor by instrument id (`/weekly-markets#BRENT`) — no backend filter needed for v1. Country filtering is a v2 nicety.

---

## Build stages

1. **Backend Lambda `newsWeeklyMarkets`** — clone `newsWeeklyBrief`; swap the gather step for the markets-history move computation + mover selection; add the per-mover coverage-lookup / Brave-fallback / DeepSeek note. Manual-invoke first (no schedule until output is trusted), then `cron(0 7 ? * SUN *)`-class EventBridge rule.
2. **Serve** — add `weekly_markets` action to `newsSensitiveData` (latest published record); add `fetchWeeklyMarkets` to `restProxy.js`.
3. **Review script** — `weekly-markets/review.js`, cloned from `weekly/review.js` (scan drafts → publish/reject).
4. **Frontend** — `useWeeklyMarkets()` hook (clone `useWeeklyBrief`); `WeeklyMarketsPage.jsx` + `/weekly-markets` route; honest empty state when nothing published.
5. **Cross-page links** — the hub-and-spoke wiring above (Home/Map/Country/Thread/Economy ↔ report).

Each stage is independently shippable; the page renders an honest empty state until the first draft is published.

---

## Open items to verify before/while building
- **Self-search web fallback** — Perplexity `sonar` call shape (clone from `services/llm.js`); operator must set `PERPLEXITY_API_KEY` (TODO). Degrades to "our coverage only" if unset.
- **Mover selection** — vol-aware threshold vs. plain top-N by |%|; start simple (top gainers + losers), refine.
- **Universe coverage** — week-over-week % needs ≥2 weekly anchors of history; instruments with thin history are shown as "history accruing", not dropped silently.
- Finnhub (the earlier idea) is **deferred** — only needed if we later want intraday precision or to de-risk Yahoo; daily closes are sufficient for a weekly wrap.
