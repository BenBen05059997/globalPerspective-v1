# Legacy map (WorldMapV2) idea harvest — 2026-09-24

**Why this doc exists:** `WorldMapV2.jsx` (`/map-legacy`) is slated for removal (see
`project-docs/architecture/CLEANUP_AUDIT_2026-09-24.md` §2.A / decision D3). This is a
**concepts-only harvest**, written before that removal, to preserve the useful ideas the legacy
map embodied so a future task can consider them for `/map` (`SituationHome` +
`SituationMap3D`/`SituationMap`) if they're ever wanted. **This is not a port plan and carries no
commitment to build any of it.** Read `project-docs/redesign-ux/_active/PAIR_ARCS_RELOCATION_PLAN.md`
first for the one idea (Connections arcs) that already went through a full verified analysis and
partial build.

**Status note:** the Connections bilateral-arc layer has *already been relocated* onto
`SituationMap3D` (commit `76d74d8`, "Relocate pair-arcs onto /map as an off-by-default Connections
layer (Phase 1)") — it is simplified (no group/strong-mod coloring, no flow-type filter, no
time-window UI, fixed 30d cutoff) but live and working. If a richer version (group coloring,
filters, dashing) is ever wanted, **a working deck.gl port already exists in local git history at
that commit — reference/diff it, don't rebuild the styling logic from scratch.**

Provenance below cites `WorldMapV2.jsx`/`.css` by line number as of the version read for this
harvest (1362 JS lines / 728 CSS lines).

---

## 1. Connections — bilateral-arc layer

**What it is:** quadratic-Bézier (SVG) / great-circle (deck.gl) arcs between two countries with an
active bilateral pair-analysis, colored by a regex-classified topic group (fx/tech/geo), with
opacity+width driven by whether either country is currently in elevated/high signal, and dashing
for stale (>time-window) relationships. `WorldMapV2.jsx:256-306` (data build), `:587-632` (SVG
render), `:784-841` (sidebar flow-type + arc-weight legend). Click opens the pair's country page.

**Data:** `pair_analyses_list` (`usePairAnalyses`) — 15 live records / 14 countries as of
2026-09-24 (verified in PAIR_ARCS_RELOCATION_PLAN §0). Countries resolved by parsing the
`-and-`-joined slug (the `countries` field on the DDB item is dead/unwritten — confirmed in the
plan). Alive and current.

**New-map equivalent:** yes, partially — the arc layer itself is live on `/map` as an off-by-default
"Connections" toggle (commit `76d74d8`). What did **not** port: per-group (fx/tech/geo) coloring
and its filter checkboxes, the 7d/30d time-window control, and signal-weighted strong/mod line
weight (dropped because `SituationMap3D` has no per-country signal feed, only per-situation data —
see plan §4).

**Worth-it verdict:** **already covered** (baseline) / **steal someday** (the dropped richness —
group coloring, filters, signal-weighted width) *if* usage data ever shows people toggling
Connections on and wanting more control. Don't build speculatively — plan §4 already reasoned
through why wiring `useCountrySignal` in just for arc width is a lot of hook plumbing for a cosmetic
delta on ≤15 arcs.

---

## 2. Layer-toggle architecture (stacked layers replacing a lens picker)

**What it is:** three independent, stackable boolean layers — "Today's pulse" (24h news rings),
"Connections" (arcs), "Editorial" (numbered top-5 picks) — each toggled on/off in a left rail,
composable (you can have all three on at once, or none). `WorldMapV2.jsx:115-119` (`LAYERS` array),
`:147` (state), `:730-747` (rail UI), `:449-661` (`drawMap` branches per layer).

**Data:** each layer's data source is independent (`useGeminiTopics`, `usePairAnalyses`,
`signal`/`editorialPicks` derived from `useCountrySignal`) — all alive.

**New-map equivalent:** partial. `/map` doesn't have a generalized layer-toggle system — it has one
opt-in boolean (`showConnections`) and everything else (situation pins, tier/axis coloring) is
always-on base state, not a toggleable "layer" in the WorldMapV2 sense. The situations-as-glow-dots
model is a genuinely different information architecture (event-centric, not country-metric-centric),
so a literal port of "stacked layers over a choropleth" doesn't map cleanly onto it.

**Worth-it verdict:** **let it die as an architecture**, but the *pattern* (multiple independent
toggles rather than a single mutually-exclusive lens picker) is worth remembering if `/map` ever
grows a second opt-in overlay beyond Connections — reuse the "one boolean control per data source,
default off, guarded on data-presence" convention `showConnections` already established, rather than
building a lens-radio-button UI.

---

## 3. Per-group flow filters (fx / tech / geo)

**What it is:** checkboxes to show/hide Connections arcs by a regex-classified topic group,
with a live count per group and an arc-weight legend explaining active-vs-on-watch dashing.
`WorldMapV2.jsx:296-298` (classification regex), `:786-841` (rail UI + legend).

**Data:** derived client-side from `pairTitle` text via regex — no separate data source, so it's
exactly as alive as the Connections data itself (see §1).

**New-map equivalent:** none — `showConnections` on `/map` is a single on/off, no sub-filtering.

**Worth-it verdict:** **let it die** for now. At 15 total pair records split across 3 groups, a
filter UI is solving a problem (visual clutter) that doesn't really exist yet at this data volume.
Revisit only if pair-analysis volume grows an order of magnitude.

---

## 4. 7d / 30d time-window control

**What it is:** a rail toggle switching the Connections cutoff between 7 and 30 days, with a live
count of relationships refreshed in that window; older relationships are kept but faded+dashed
rather than dropped. `WorldMapV2.jsx:154` (state), `:264-274` (cutoff calc), `:872-891` (rail UI).

**Data:** `pairAnalyses[].generatedAt` — alive, same field the shipped Connections layer already
reads for its fixed 30d stale cutoff.

**New-map equivalent:** no — the shipped layer hardcodes 30d with no UI (plan §2b step 3, explicit
"no time-window UI in v1" comment in the code).

**Worth-it verdict:** **steal someday, cheaply** — this is a small, low-risk addition (one more
rail control wired to a value the layer already computes) if a future pass wants to give the
Connections toggle more depth. Not worth doing solo; bundle it with #3 if either is ever picked up,
since both are "give Connections more knobs" work.

---

## 5. Signal-weighted arc emphasis

**What it is:** arc opacity/width is 'strong' (opaque, thicker, solid) if either endpoint country
is currently High or Elevated signal, else 'mod' (fainter, thinner, dashed). `WorldMapV2.jsx:290-294`.

**Data:** needs `useCountrySignal` — a live per-country z-score feed, keyed by every topojson
country. Alive as a hook, but not currently wired into `/map`'s data flow at all.

**New-map equivalent:** no (explicitly dropped per plan §4 — situations are event-keyed, not
country-keyed, so there's no existing per-country signal join on `/map`).

**Worth-it verdict:** **let it die** unless something else on `/map` independently needs a
per-country signal feed. The plan's own reasoning (a full second hook + name→ISO resolution path
for a cosmetic width delta on ≤15 arcs) is sound and still holds.

---

## 6. Country search bar with aliases

**What it is:** an incremental-search input above the map, matching country names *and* a curated
alias table (`EXTRA_ALIASES` — "US"/"UK"/"Burma"/"DRC"/etc.), sorted prefix-match-first, with a
dropdown of up to 8 results; Enter selects the top match, Escape clears. `WorldMapV2.jsx:94-109`
(`EXTRA_ALIASES`), `:684-711` (match logic + handlers), `:929-969` (JSX), `.css:603-705` (styling).

**Data:** static alias table + the topojson-derived `nameToISO` map — no backend dependency, fully
self-contained and always "alive."

**New-map equivalent:** none — `/map` has no search; navigation is via the situations list/rail or
clicking a pin directly. There's also no persistent 195-country universe on `/map` the way
WorldMapV2 had one (situations are a much smaller, dynamic set — typically single digits to
dozens), so "search all countries" is less obviously useful there; you'd really want "search
situations by title/country," a different (simpler) search.

**Worth-it verdict:** **steal someday** — a lightweight "search situations by verb_label / affected
country" box would be a genuinely useful `/map` addition once the situation count grows past what
fits comfortably in the rail list, and the alias-matching pattern (prefix-first, then substring,
capped result count) is directly reusable even though the underlying index would be simpler
(situations, not all 195 countries).

---

## 7. Country click → detail rail (archive-backed side panel with linked pairs)

**What it is:** clicking a country opens a right-panel showing signal level, risk tier + sparkline,
active economic disruptions, AI intel headline/trajectory, a "recent coverage" thread pulled live
from the weekly archive `dayMap` (filtered by country-name match), cross-country links (other pair
analyses this country is in), risk signals, a causal-graph excerpt, a markets snapshot, and grounding
sources — essentially a full per-country dossier assembled from ~7 different hooks.
`WorldMapV2.jsx:326-377` (`liveDetail` archive scan), `:1014-1348` (panel JSX),
`.css:322-449` (styling).

**Data:** `useWeeklyArchive` (`dayMap`), `useCountryIntelligence`, `useCountryHistory`,
`useSystemsAnalysis`, `useMarketsCountry`, `useDisruptionsList`, `usePairAnalyses` — all alive,
all still-used hooks elsewhere in the app (this was the legacy map's main value proposition: it
was a country-metric dashboard, not an event map).

**New-map equivalent:** partial-by-design, not by gap. `SituationHome`'s detail rail is
*situation*-scoped (one crisis event: tier, axis, evidence headlines, GDACS metrics, "open full
analysis" link) — deliberately thinner and evidence-first per the new map's design intent
(`MAP_HOME_SITUATION_PLAN.md` — situations as the atomic unit, not countries). It does not, and by
design doesn't try to, roll up a country's markets/risk-score/causal-graph/disruptions into one
rail view the way WorldMapV2 did.

**Worth-it verdict:** **already covered at the design-intent level, but the country-dossier idea
itself may be worth reviving as a *different* surface** — e.g. `/weekly/country/<name>` (which
`/map`'s "Open country →" already deep-links to) is the natural home for this multi-hook rollup,
not `/map` itself. Check whether `/weekly/country` already renders this content before building
anything; if it's thinner than WorldMapV2's panel was, that's the concrete gap, not `/map`.

---

## 8. Urgency halo rings

**What it is:** a pulsing (`@keyframes pulse-halo`, 2.2s ease-out) stroke ring around countries
with a `topic.urgency === 'high'` item from the last 24h. `WorldMapV2.jsx:564-585` (ISO selection),
`.css:475-484` (animation).

**Data:** `useGeminiTopics` — `topic.urgency` field — alive.

**New-map equivalent:** yes, functionally superior — `SituationMap3D` already has an "escalating"
visual state (a static, non-animated double-ring, `SituationMap3D.jsx:209-216`), explicitly chosen
*static* over pulsing so the animation loop can never re-render mid-click and eat a tap (comment at
line 209-210). This is a considered, deliberate improvement over the legacy pulsing-halo approach,
not a gap.

**Worth-it verdict:** **already covered** — and covered *better* (the static-ring choice fixes a
real interaction bug class the legacy pulsing version would have had). Let the pulsing-halo
implementation die; keep the static-ring pattern as the standard going forward.

---

## 9. Name-normalization / alias tables (~180 lines: `NUM_TO_A3`, `TOPO_NAME_FIXES`, `EXTRA_ALIASES`)

**What it is:** a UN M.49-numeric→ISO3 table (56 lines), a TopoJSON-raw-name→canonical-archive-name
fix table (34 lines), and a free-text-alias→ISO3 table (16 lines) — together the machinery that lets
WorldMapV2 resolve *any* of: a fetched-live topojson's raw country names, the news archive's
free-text country strings, and casual aliases ("US", "Burma", "DRC"), all down to one canonical ISO3
+ display name. `WorldMapV2.jsx:24-109`.

**Data asset status:** this is pure static lookup data, not a live feed — "alive" in the sense that
it's still correct/current (ISO3 codes don't change), but it exists only in `WorldMapV2.jsx` today.

**Does anything else need name→ISO robustness?** Yes, partially, and it already forked: the
Connections relocation (`countryGeo.js`'s new `NAME_TO_ISO3`, per PAIR_ARCS_RELOCATION_PLAN §2a)
deliberately did **not** reuse this table — it built a small, hand-maintained 14-country-plus-alias
table by inverting `situationLabels.js`'s existing `ISO3_NAME`, reasoning that pair-analysis country
names only need to cover what `newsPairIntelligence`'s `canonicalize()` can produce, not the full
195-country universe. So `situationLabels.ISO3_NAME` + `countryGeo.NAME_TO_ISO3` is the *current*
canonical name↔ISO3 path on `/map`, and it's smaller and more scoped than WorldMapV2's tables by
design.

**Worth-it verdict:** **let it die as a 180-line block**, but flag the risk: `situationLabels.js`'s
`ISO3_NAME` almost certainly covers fewer countries/aliases than WorldMapV2's three-table stack did
(WorldMapV2 needed to resolve *any* topojson country plus loose archive text; `/map` only needs to
resolve countries that actually appear in `situations[].iso3_affected` or pair-analysis slugs). If a
future situation or pair record involves a country whose name doesn't match `ISO3_NAME` exactly
(the kind of edge case `TOPO_NAME_FIXES` existed for — DRC vs. "Democratic Republic of the Congo",
Czechia vs. "Czech Republic", etc.), the fix is to extend `countryGeo.js`'s small alias overlay
incrementally (as the pair-arcs plan already did), not to resurrect the legacy tables wholesale.

---

## 10. CSS: tier/signal color tokens and visual language

**What it is:** WorldMapV2's design tokens (`WorldMapV2.css:7-32`) — semantic risk colors
(`--risk-h:#c94a33` red, `--risk-e:#d89540` amber, `--risk-l:#4fa07b` green, plus soft-background
variants), a light "paper" ink-on-cream palette, serif/sans/mono type stack (Fraunces/Inter/JetBrains
Mono), and a two-tier signal-marker system (headline dot+halo+full-label for top 5, small ambient dot
for next 10, tiny tail dot beyond that — `:520-562`) that keeps the map legible at scale without
labeling all ~195 countries at once.

**New-map equivalent:** yes and no. `/map` uses a completely different (and later, more
deliberately-designed) visual language: dark "world at night" base with axis-hue + tier-luminance
glow dots (`SituationMap3D.jsx:10-27` — oklch-normalized hues so no axis reads as "worse" than
another, an explicit design decision documented in `MAP_HOME_SITUATION_PLAN.md`/`DATA_STRATEGY §5`).
This supersedes WorldMapV2's light-paper/semantic-traffic-light palette; it isn't missing anything,
it's a different and later design system that already made its own considered color choices.

The one piece that *doesn't* have a direct equivalent: the **three-tier label-density system**
(top-5 full label, next-10 ISO-only + hover-reveal, rest unlabeled) that lets WorldMapV2 show ~15
labeled points without clutter. `SituationMap` (`SituationMap.jsx:101-109`) only labels the top 6
high/elevated situations and nothing else — simpler, and adequate at current situation counts
(single digits to dozens), but if situation volume ever grows substantially, WorldMapV2's
ambient/tail tiering is a reusable pattern for graceful label degradation.

**Worth-it verdict:** **already covered** (the color system) / **steal someday** (the 3-tier label
density pattern, only if situation counts grow enough that today's "top 6 only" labeling starts
losing information worth surfacing).

---

## Summary of verdicts

| # | Idea | Verdict |
|---|---|---|
| 1 | Connections bilateral arcs | Already covered (shipped, simplified); richer version = steal someday |
| 2 | Layer-toggle architecture | Let the architecture die; keep the "one boolean per source" convention |
| 3 | Per-group flow filters | Let it die (premature at 15 records) |
| 4 | 7d/30d time-window control | Steal someday, cheap, bundle with #3 |
| 5 | Signal-weighted arc emphasis | Let it die (plan's own reasoning still holds) |
| 6 | Country search bar w/ aliases | Steal someday (situations-search, not full-country-search) |
| 7 | Country detail rail (dossier) | Already covered by design intent on /map; possible gap check on /weekly/country instead |
| 8 | Urgency halo rings | Already covered, and covered better (static > pulsing) |
| 9 | Name-normalization alias tables | Let the 180 lines die; extend the smaller countryGeo.js table incrementally as needed |
| 10 | CSS tier/color tokens + label density | Color system already covered; 3-tier label density = steal someday if situation volume grows |
