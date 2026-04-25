# Global Perspectives — Redesign v2 Plan

**Status:** Approved 2026-04-26 · Not started
**Target:** 1 focused day
**Cost delta:** ~$3-5/mo for v2 changes; potentially **net negative** with model tiering (~40-50% savings on current Grok spend)

---

## Why v2

v1 (shipped 2026-04-25, A1-A8) matched the editorial typography from `/tmp/gp_redesign/` HTMLs but **skipped most structural sections**:
- 3-col layouts collapsed to 2-col on Thread + Country
- Status strips missing on every page
- Left rails dropped (related threads, country list, filters, actor chips)
- Structured AI output flattened to plain text (Prediction, Trace Cause)
- Persistent map panel replaced with flyout
- Counter / alternative readings tab entirely absent

The audit found we have **~85% of the data the design wants** — most "missing" features are data we generate and discard, or sit unused in DDB.

---

## Hidden gold (data we have but don't surface)

These exist TODAY in production data:

1. **Two-pass prediction research briefing** — `NewsProjectInvokeAgentLambda` generates `{historicalPrecedents, keyActors, upcomingDeadlines, balanceOfForces}` per topic, uses it as prompt context, then **DISCARDS it**. Single biggest miss in the system.
2. **Trace_cause Impact Scores 1-10** — Human Impact / Economic Reach / Geopolitical Stability. Trapped inside markdown blob.
3. **Trace_cause Bias Note + Local/Alternative Perspective** — counter-narrative material, trapped in markdown.
4. **`newsSystemsAnalysis` Lambda** — generates causal graph `{nodes, edges with mechanism, lagDays, confidence, citedEntries}` for top 5 countries. Not in MEMORY, no CloudWatch rule documented, no UI surfacing.
5. **`pair_analysis.predictions[]`** — `{claim, timeframe, confidence, mechanism}` — most rigorous forecasting array in codebase. /weekly/pairs hidden from production nav.
6. **ACLED `dominantActors[]`** — closest thing to per-country actor data. Not displayed.
7. **Source `age` field** ("3 hours ago") — every source has it. Never displayed.
8. **`entryShortTitles[]`** — 6-10 word per-day micro-headlines per thread. Underused.
9. **`country.categories` histogram** — raw category counts. Could power donut chart.
10. **`leadershipChangedAt`** — high-signal field. No alert UI.
11. **`country_facts.activeConflicts`** — operator-verified war metadata. Only Iran filled in.
12. **FX `HISTORY#YYYY-MM-DD` (90d)** — written but no sparkline UI.
13. **`continues_topic` string** — preserved on archive entries. No "continues from" links.
14. **Brave grounding searches** in country/thread analysis — used in prompt, results discarded.

## Verified absent (genuinely need new work — defer to v3+)

- Sentiment per article (no producer)
- Publisher credibility scores (needs curated dataset like AllSides/Ad Fontes)
- Δ risk 24h (need historical snapshot table — covered by Change D below)
- Conflict event coordinates (ACLED returns lat/lng, field list doesn't request it — one-line fix)
- Article full text (only RSS descriptions + Brave snippets)

---

## The 7 backend changes (in priority order)

### Change G — Model tiering (DO FIRST)
**All Lambdas** currently use `grok-4-1-fast-non-reasoning`. Wasteful for trivial extraction tasks.

**Pattern — add 3 env vars per Lambda:**
```
GROK_MODEL_PREMIUM   # current default (or upgrade to grok-4 with reasoning for analysis)
GROK_MODEL_MID       # mid tier — e.g. grok-3-mini, gpt-4o-mini, gpt-4.1-mini
GROK_MODEL_NANO      # cheap tier — e.g. gpt-4.1-nano
```

**Per-task assignment:**

| Tier | Tasks |
|---|---|
| 🔴 Premium | `newsThreadAnalysis` (storyArc, trajectory, rootCauseChain) · `newsCountryIntelligence` (bluf, whyItMatters, trajectory) · `newsPairIntelligence` (predictions, rootDriver) · `newsSystemsAnalysis` (causal edges) · `NewsProjectInvokeAgentLambda` forecasting agent (pass 2) |
| 🟡 Mid | `NewsProjectInvokeAgentLambda` summary · trace_cause · research briefing pass 1 · `newsPostDevTo` daily brief |
| 🟢 Nano | `newsInvokeGemini` topic extraction · urgency classification · primaryCountry detection · continues_topic check · source tier classification · `entryShortTitles[]` · inflection detection |

**Validation pattern before committing:**
1. Run side-by-side on 5-10 samples (premium vs cheaper)
2. Check JSON validity rate
3. Spot-check quality on the structured fields you care about

**⚠️ Pricing:** verify current rates at [x.ai/api](https://x.ai/api) and [openai.com/api/pricing](https://openai.com/api/pricing) before committing. Don't trust assumed prices.

**Estimated savings:** 40-50% of current Grok spend (~$5-8/mo).

---

### Change A — Persist prediction research briefing
- **Lambda:** `NewsProjectInvokeAgentLambda`
- **What:** Save `{historicalPrecedents, keyActors, upcomingDeadlines, balanceOfForces}` as new action `RESEARCH_BRIEFING` alongside SUMMARY/PREDICTION/TRACE_CAUSE
- **Effort:** ~10 lines
- **Cost delta:** $0 (data already generated)
- **Unlocks:** Actors panel, Deadlines watch, Historical Precedents card, Balance of Forces meter

### Change B — Restructure prediction + trace_cause as JSON
- **Lambda:** `NewsProjectInvokeAgentLambda`
- **New prediction schema:**
  ```js
  {
    scenarios: [{ label, probability_range, horizon, rationale, triggers[] }],  // 3 items, range like "60-80%"
    winners: string[],
    losers: string[],
  }
  ```
- **New traceCause schema:**
  ```js
  {
    proximate: { what, when },
    contributing: [{ factor, evidence }],
    structural: { factor, depth },
    impactScores: { humanImpact, economicReach, geopolitical },  // 1-10 each
    biasNote: string,
    alternativePerspective: string,
    signalVsNoise: { verdict, confidence },
  }
  ```
- **Effort:** Prompt rewrite + JSON validator
- **Cost delta:** +10-20% output tokens → ~$1-2/mo
- **Unlocks:** Scenario cards with probability bars · PROXIMATE→ROOT cause chain · Counter-readings tab · Impact badges

### Change C — Add `urgency` + `primaryCountry` + source tier
- **Lambda:** `newsInvokeGemini` (use NANO tier for these)
- **New topic fields:**
  - `urgency: "high"|"medium"|"low"`
  - `urgencyReason: string` (one sentence)
  - `primaryCountry: string` (the anchor)
  - `mentionedCountries: string[]` (the rest of regions)
- **New source field:** `tier: "primary"|"secondary"` per source
- **Effort:** Prompt addition
- **Cost delta:** <$0.20/mo
- **Unlocks:** Urgency pills · anchor/linked filter on Country page · accurate source classification

### Change D — Country snapshot history for riskDelta
- **Lambda:** `newsCountryIntelligence`
- **What:** Also write `COUNTRY#{name} / HISTORY#{date}` with TTL 90d. Add numeric `riskScore` (0-100) alongside the enum.
- **Effort:** Extra DDB write + prompt addition
- **Cost delta:** <$0.10/mo
- **Unlocks:** Δ Risk 24h indicator · 7-day risk sparkline

### Change E — Persist Brave grounding hits
- **Lambdas:** `newsThreadAnalysis`, `newsCountryIntelligence`
- **What:** Save `groundingSources: [{ title, url, snippet, queryUsed }]` array
- **Effort:** A few lines per Lambda
- **Cost delta:** <$0.10/mo
- **Unlocks:** "Live web evidence" panel

### Change F — Wire `newsSystemsAnalysis` endpoint
- **Lambda:** `newsSensitiveData`
- **What:** Add `systems_analysis` action returning `{ nodes, edges }`
- **Effort:** ~15 lines
- **Cost delta:** $0 (exposes existing data)
- **Unlocks:** Cross-thread causal graph on Country page right rail

### One-line fixes
- `newsCountryFactsUpdater`: add `latitude|longitude` to ACLED fields query (line 184)
- `newsMarketsData`: implement quarterly macro history writes (in header docstring, never built)

---

## Component architecture

### EditorialShell — shared shell

```jsx
<EditorialShell>
  <StatusStrip {...pageStatus} />     // 34px mono row, page-specific data
  <Body grid="240/1fr/360">
    <LeftRail>...</LeftRail>
    <Center>...</Center>
    <RightRail>...</RightRail>
  </Body>
</EditorialShell>
```

### Per-page composition

| Page | Left rail (240) | Center | Right rail (360) |
|---|---|---|---|
| **Thread** | RelatedThreads + WatchingRegion lists | Header + 4-stat + tabs (Timeline / Actors / Sources / Geography) + inflection-marked timeline | AITabs (Summary / Prediction scenarios / Trace Cause chain / Counter from bias note) |
| **Country** | CountryList (region siblings) + Filters (anchor/linked, urgency, category) + ActorChips | Header + 4-stat + tabs (Threads grouped by category / Events / Actors / Sources / AI) | LinkMap (from systems analysis) + KeyActors + TopPublishers + Markets |
| **Map** | LensSelector + RiskFilter + ColorByAxis + TimeWindow + CategoryFilter | Choropleth (riskLevel fills) + arcs (FX/tech/geo) + EditorialAtlas markers + EditorCaption | CountryPanel (always visible — no flyout) |

### Reusable atoms (build once)

- `<StatusStrip>` — mono 34px row, slots for icon + key/value pairs
- `<StatBlock>` — Fraunces numeral + label + delta
- `<ThreadCard>` — anchor/linked variant + urgency pill + riskDelta
- `<ActorChip>` — avatar + name + role + mention count (uses ACLED + research briefing data)
- `<ScenarioCard>` — label + probability bar + horizon + rationale
- `<CauseChainNode>` — PROXIMATE/CONTRIBUTING/STRUCTURAL labeled node
- `<LinkMap>` — D3 mini-map with arcs (uses existing `IntelligenceLoader.buildGraph`)
- `<RiskDots>`, `<InflectionMarker>`, `<TimeAgo>`, `<AsOfBadge>`
- `<Sparkline>` — for FX and risk history
- `<DeltaPill>` — +0.6 ↑ rising

### Restore from existing codebase

Components that exist but were removed in v1:
- `SideNav.jsx` (left rail base)
- `SectionNav.jsx` (Country tabs)
- `BackgroundTimeline.jsx`, `CompactTimeline.jsx`
- `MapSidePanel.jsx` (make persistent, not flyout)
- `MiniMap.jsx`
- `WorldMapV2.jsx` (already partially built choropleth scaffold — your past self started this)

---

## Approved decisions

| Decision | Choice | Rationale |
|---|---|---|
| Anchor vs linked classification | Heuristic: `regions[0]` = anchor (with `primaryCountry` Grok field as override when present) | Free, upgradable later |
| Probability format on scenarios | **Range** ("60-80%") | Forces humility; Metaculus pattern |
| Cause chain depth | **3 layers** (proximate / contributing / structural) | Matches `pair_analysis.rootDriver` proven shape |
| Severity scales | Keep all 3 (significance/riskLevel/impactScores) | Different audiences, different layers |
| Counter-readings source | Synthesize from `biasNote + alternativePerspective` | No extra Grok call |
| Map lens system | Ship all 3 (Risk/Flows/Editorial) | Data exists for all three |
| Deploy strategy | Piecemeal with frontend null-safety | Lower risk |
| Inflection detection | Ask Grok in thread analysis | Cheaper than heuristics |
| Source primary/secondary | Grok tags per source | Cleaner than maintaining outlet tier list |
| Model tiering | 3-tier: PREMIUM/MID/NANO per task | Big cost savings, no quality loss for trivial tasks |

---

## Guiding principles

1. **Surface before generate** — check if data exists before adding pipelines
2. **Structured beats markdown** — JSON over regex-parsing prose
3. **Don't fake data** — empty states + "coming in v2" honest, fabricated content not
4. **Layout chrome is cheap** — status strips + 3-col + persistent panels are pure UI
5. **One shell to rule them all** — EditorialShell + atoms reused across all 3 pages
6. **Pay for thinking, not for typing** — premium model on synthesis, nano on extraction

---

## Algorithms to reconsider (v3, not v2)

- **Thread clustering**: continues_topic + Jaccard 0.4 → embedding cosine similarity (`text-embedding-3-small`)
- **Risk score**: 4-bucket enum → numeric 0-100 alongside enum (Maplecroft/Eurasia pattern)
- **Inflection detection**: Grok during thread analysis (one prompt addition) — included in v2 actually
- **Editorial Atlas marker selection**: weighted score = `urgency × 3 + sourceCount × 0.5 + crossCountryReach × 2 + recencyDecay`
- **Scenario calibration**: track predictions over time, score Brier loss (long-term, needs historical predictions table)

---

## Internet references

**Editorial layout:** [Foreign Affairs](https://www.foreignaffairs.com) · [The Economist](https://www.economist.com/the-world-in-brief) · [Stratfor Worldview](https://worldview.stratfor.com)

**Status chrome:** Bloomberg Terminal · [Trading Economics](https://tradingeconomics.com)

**Risk visualization:** [CFR Global Conflict Tracker](https://www.cfr.org/global-conflict-tracker) · [Crisis Group CrisisWatch](https://www.crisisgroup.org/crisiswatch)

**Scenario UI:** [Metaculus](https://www.metaculus.com) · [Manifold Markets](https://manifold.markets) · Good Judgment Project

**Map / choropleth:** [Observable D3 examples](https://observablehq.com/@d3/world-map) · [Natural Earth Data](https://www.naturalearthdata.com) · [Datawrapper](https://www.datawrapper.de)

**Bias / credibility (deferred to v3+):** [AllSides Media Bias Chart](https://www.allsides.com/media-bias/media-bias-chart) · [Ad Fontes Media](https://adfontesmedia.com) · NewsGuard

**Event datasets:** [GDELT](https://www.gdeltproject.org) (CAMEO codes) · [ACLED](https://acleddata.com) (already wired)

---

## Estimated cost impact

**One-time dev:** 1 focused day

**Recurring infra/AI cost (monthly):**

| Item | Delta |
|---|---|
| Change G — model tiering | **-$5 to -$8** (savings) |
| Change A — persist research briefing | $0 |
| Change B — JSON output structures | +$1 to +$2 |
| Change C — urgency + primaryCountry + tier | <+$0.20 |
| Change D — country history snapshot | <+$0.10 |
| Change E — Brave grounding persistence | <+$0.10 |
| Change F — systems_analysis endpoint | $0 |
| One-line fixes | $0 |
| **Net delta** | **~-$2 to -$5/mo (savings)** |

**Context:** current spend ~$12-15/mo (Grok) + ~$1/mo (AWS). After v2 + tiering: likely **$8-12/mo total** with better quality on premium tasks and ~85% of design surfaced.

---

## Day phasing

1. **Backend (4-5 hours):** Change G → A → B → C → D → E → F. Each tested in DDB before next.
2. **Component sandbox (1-2 hours):** Build atoms at `/test/components` with real data fixtures.
3. **Page integration (3-4 hours):** EditorialShell + Thread, Country, Map page assemblies.
4. **Polish + deploy (1 hour):** Empty states, mobile, build, deploy to docs/, commit.

Stop and review with user between steps 1 and 3.

---

## Status log

- 2026-04-25: v1 (A1-A8) shipped. User correctly called out skipped structural sections.
- 2026-04-26: Audit completed. Found 14 hidden-gold fields and that ~85% of design data already exists.
- 2026-04-26: v2 plan approved. Maintenance overlay still active (production unchanged from pre-v1). v1 commit `fe23730` exists in git but `docs/` not updated.
- **Next:** Start with Change G (model tiering) as first step when work resumes.
