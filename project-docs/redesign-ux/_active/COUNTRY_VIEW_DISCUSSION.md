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

## Who gets an AI briefing (verified in code, 2026-09-25)
`newsCountryIntelligence`:
- groups 30 days of news by country and keeps countries with **≥ 2 articles**;
- sorts them by **total article volume**;
- briefs the **top 20** (`MAX_COUNTRIES = 20`, index.js:75, 191, 225).

So selection is by **how much news**, not by how big the event is. A severe event in a thinly covered country can miss the cut;
GDACS disasters still show on the map regardless.

## Frontend: four country states (proposal)
| State | When | Card shows | Map shows |
|---|---|---|---|
| **Briefed** | AI briefing ≤ 7 days old | Full card (triad, 4 chips, what happened, stories, watch, money) | Country tinted by risk (legend brightness rules) |
| **Briefed, older** | Briefing 7–30 days old | Full card; sections amber "older analysis · date" | Tint desaturated |
| **Tracked, no briefing** | Has stories or live alerts, but outside the top 20 | Facts + stories + alerts + money, plus "No AI briefing this cycle (we brief the 20 most-covered countries)" and **"Generate a briefing in Studio →"** (on demand) | Thin outline, no tint |
| **Quiet** | No stories in 30 days | Facts + money only: "No coverage in the last 30 days" (**never implies safe**) | Nothing |

Open: C9. Should selection also include event-driven countries (e.g. top 20 by volume **plus** any country with a GDACS red alert or an
escalating high-severity story), so big events aren't missed? This is a backend change, after the DeepSeek top-up. Recommended yes.

## Debate outcome: country card v2 (2026-09-25)
Wireframe `CountryCard.dc.html` on the canvas (Iran · Germany · Yemen · Brazil · Uruguay, real data), built, critiqued by two agents, then revised.

**Corrections to my earlier message** (caught by critic 2 and verified):
- The `country_intelligence` action reads **at most 15 countries per call** (newsSensitiveData index.js:517). I sent 60, so "Yemen has no briefing" was wrong.
- Yemen **was briefed on 18 Aug** (now 38 days old), as were France (12 Sep) and India (21 Aug).
- Re-checked in batches: 33 countries have a briefing, and some are months old (Nigeria and Sudan from 28 Apr). Never briefed: Brazil (10 entries), Nepal (9), Egypt, Argentina…
- "17 stories, below the cut" can't be claimed. The count is archive **entries**, not stories, and the ranking is never saved.

**Rules adopted in v2:**
- **One screen, no scroll.** Order: state line with date and age → name + verified facts → one-sentence summary → RISK + DIRECTION → 4 risk bars (WHY opens on click) → latest change (only if it cites an event) → ≤3 stories → ≤2 **future** dated forecast triggers → FX + Studio button.
- **Direction rule** (critic 2): v2 snapshots only.
  - Compare the median of the last 3 readings against the median of the 3 nearest to 14 days earlier (±3 days); each bucket needs ≥3 readings within ≤5 days.
  - An arrow needs |Δ| ≥ 10 on the worst-axis score. Name an axis only if its own Δ ≥ 15.
  - If both medians are ≥95, show **"at top of scale"** with no arrow, plus the latest cited axis move.
  - Compute only if the latest reading is ≤7 days old; 7–30 days amber "as of"; over 30 days hidden.
  - Otherwise **"not enough readings (gap …)"**.
  - Today: Iran = top of scale; Germany = not enough readings, so no "easing" claim.
- **Watch flag:**
  - GDACS situations whose `iso3_affected` includes the country and whose tier is elevated or higher.
  - News situations only when the country is `iso3_origin[0]`, `escalating` is true and it's less than 24 h old.
  - Omitted when off. Needs a name↔ISO3 table.
- **Passed watch items are never shown on the card.** Signals are parsed for dates. After the day passes they say "passed · outcome not checked" (only in deeper views); otherwise "Nd left".
- **Facts:**
  - Leaders only from Wikidata `FACTS#`, with its update date; otherwise the **row is omitted** (no placeholders).
  - Macro figures only if the year is ≥ current year − 3, always with the year.
  - No FX row when the currency isn't in the ECB feed (e.g. IRR, YER, UYU).
- **States:**
  - **Briefed** (≤7 d full colour; 7–30 d amber).
  - **Too old** (>30 d): scores and text hidden, "last briefed <date>". Shows story count + trend + "mentioned in <other country's> briefing".
  - **Never briefed:** stories + figures + "Generate a briefing in Studio".
  - **Quiet:** a small popover, not the panel.
  - The same freshness rule applies to every row of the country list.
- **Map:** the selected country gets brackets; countries its stories connect to get dotted lines (fact-style, not judged links).

**Build needs (for later, not approved):**
- New read actions `country_facts`, `country_rank` and a slim `country_history` (scores only, ~3 KB).
- Widen the Wikidata job (+capital/population/currency).
- `newsCountryIntelligence` to persist `COUNTRY_RANK#<date>`, plus optional **event-driven picks** (C9: top 20 by volume + ≤5 countries that are the origin of a red GDACS alert or a critical/escalating news situation within 48 h).
- Fix the World Bank fetch (`mrv=5` returns the last 5 *reported* values, e.g. Iran reserves 1982).
- A timeline risk to decide: with the AI paused, Iran and Germany cross 30 days around **11–12 Oct** and the whole map falls into "too old".
