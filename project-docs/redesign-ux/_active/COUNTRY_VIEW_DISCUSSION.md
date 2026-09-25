# Country view: what readers want × what we can provide (discussion, 2026-09-25)

**Direction (operator, 2026-09-25):** split the country page by job:
- a **country card on the map**: quick, public, stored data, no AI run on view;
- **deep analysis in the Analysis Studio** on demand: deep-dive, country web, bilateral;
- the `/weekly/country/:name` URL stays as a simple public page with the card content, for search engines and old links.

Design only; nothing built. Evidence: a reader-needs research pass and a live data inventory (Iran, Germany).

## What readers want (research)
Professional products lead with **state + direction + why, dated**:
- CrisisWatch: a monthly arrow (deteriorated / improved / unchanged) plus a one-line dated reason.
- Sovereign ratings: **grade** (state), **outlook** (direction over 1–2 years) and **watch** (imminent change). Three horizons, never blended.
- ACLED / Fragile States Index / EIU: one headline score broken into **named sub-scores**.
- US State Dept advisories: a level plus **reason letters** inline.
- BBC profiles / Wikipedia infobox: the same **baseline facts** in the same order for every country.
- Victoria 3 / HOI4: a fixed stat strip plus a "what's in motion" panel, with depth one click away.
- Civilization's lesson: a status chip without its history is not enough.

## The 8 reader questions × our data
| # | Reader question | What we have | Fresh? | Gap / how to close |
|---|---|---|---|---|
| 1 | Better or worse, and since when? | `HISTORY#` risk snapshots (Iran 90, Germany 42) | frozen since 11–12 Sep | **Compute the arrow deterministically** from snapshot deltas with its date range; no LLM |
| 2 | What just happened, and why? | `keyDevelopments`, `bluf`, drift notes (`whyChanged`), stories in the country | AI parts 13–14 days old | Show them dated; the "what changed" line comes from drift |
| 3 | Who's in charge? | Wikidata leaders in `FACTS#`, **12 countries only, never served to the frontend**; `keyActors` is AI-inferred from news | Wikidata not scheduled for most countries | **Extend the Wikidata job to every covered country + a small read action** (non-LLM). Label keyActors "in the news", not "officials" |
| 4 | How risky, and what kind? | `dimensions`: 4 axes, score + why | frozen | Show as 4 named chips (FSI/EIU pattern), worst axis leads |
| 5 | Baseline facts | `markets_country` macro (GDP, CPI, unemployment, debt) + FX | live-ish (20 Sep) | Add capital / population / government type / currency from Wikidata (same job as #3) |
| 6 | What to watch next? | `riskSignals` (undated); **per-story forecasts with dated triggers** | frozen / partly | **Aggregate the dated forecast triggers of this country's stories** (deterministic); no election calendar today |
| 7 | Does it affect markets / travel? | FX + macro (live, non-AI); disruptions by country (frozen; economy parked) | mixed | Keep a small FX/macro line. Travel advisories are a **new outside source**, so check its terms first; later |
| 8 | How fresh and reliable is this? | `generatedAt` per source | — | **Per-section freshness** (legend brightness rule) + an "analysis paused since 12 Sep" line; no false "live" |

Also verified: **GDACS alerts are live** (non-AI) and can drive the card's **watch flag**. News-classified map situations are 0 right now (the outage).
Coverage: AI briefings exist for **~20 countries** (top by article volume). Other countries can still get a card with the non-AI parts.

## Proposed country card (map, one screen)
1. **Header strip** (infobox): name · leader (verified) · government · capital · population · GDP · currency.
2. **Status triad** (rating-agency pattern):
   - **RISK** tier + worst axis;
   - **DIRECTION** ▲ worse / ▼ better / ◆ unchanged "since 12 Aug", computed from history;
   - **WATCH** flag when a live alert, or a story escalating in the last 24 h, is in the country.
3. **Four risk chips** (conflict / political / economic / humanitarian), each with its one-line why; no-signal axes say so.
4. **What happened**: 3 dated developments + the latest "what changed" note.
5. **Stories here**: the top 3 stories (StoryLink + StoryPeek) and live alerts, which highlight on the map.
6. **What to watch**: dated forecast triggers from this country's stories, with days left.
7. **Money line**: FX + one macro figure (non-AI).
8. **Footer**: freshness per section · "Analyze in Studio →" (deep-dive, country web, bilateral, full timeline).

Goes to the **Studio instead**: the causal/systems web, bilateral relations, scenario analysis, cross-country comparison, and long background timelines.

## Decisions for the operator
| # | Decision | Recommendation |
|---|---|---|
| C1 | Confirm the split (map card + Studio deep-dive + public URL) | Yes |
| C2 | Direction arrow computed from risk history (no AI) | Yes |
| C3 | Extend the Wikidata facts job to all covered countries + expose it (small backend, no LLM) | Yes: closes "who's in charge" and baseline facts |
| C4 | Countries without an AI briefing get a card with only the non-AI parts | Yes, with the line "no AI briefing for this country yet" |
| C5 | Money line on the card while economy is parked | Yes, FX + macro only (non-AI); no disruption claims |
| C6 | Countries list becomes a "country risk" map layer + ranked list, with freshness on every row | Yes (fixes the 121-day-old country styled as fresh) |
| C7 | Travel advisories as a new source | Later, after checking the source's terms |
| C8 | ACLED conflict counts (already fetched internally) | Don't publish until ACLED's redistribution terms are checked |
