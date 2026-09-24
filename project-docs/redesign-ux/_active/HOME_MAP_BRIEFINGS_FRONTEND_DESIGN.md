# Home (map + stories) and /briefings: Frontend Design

**Status:** DESIGN ONLY, proposed 2026-09-24. No code has changed. This doc is what an engineer builds from.
**Author role:** frontend designer. **Binding input:** `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md` (operator decisions).
**Also grounded in:** `PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` §4 and §8 (adjudication), `PAGE_REVIEW_2026-09-24.md`
(findings not to repeat), `MAP_HOME_SITUATION_PLAN.md` and `MAP_HOME_SITUATION_LEDGER.md` (the shipped map),
`architecture/WORLD_MODEL.md` (one event with two narrations; one tier scale; no new IDs), and the current code
under `global-perspectives-starter/frontend/src/`.

**Verified facts this design relies on (checked 2026-09-24, live prod and source):**

| Fact | Evidence |
|---|---|
| The map bundle `/data/world/latest.json` has `generated_at`, `next_expected_at`, `sources{gdacs,news}`, `stale`, `situations[]`, `lede`, `ranked[]`. Today it holds **1 situation** (GDACS, India cyclone, `threadId: null`). | live curl |
| Situation rows carry `id` (`gdacs#…`, `news#…`, `breaking#…`), `verb_label`, `axis`, `tier`, `state`, `escalating`, `centroid`, `iso3_affected`, `affected_names`, `opened_at`, `last_change_at`, `tier_changed_at`, `what_changed`, `threadId`. | live curl |
| The `topics` proxy action returns **17 topics, `updatedAt` 2026-09-13** (11 days old because of the DeepSeek outage). **Every topic has `threadId`.** Topics also carry `iso3[]`, `primaryCountry`, `regions[]`, `actors[]`, `event_type`, `category`, `urgency`, `sources[]` (with `source`, `outletCountry`, `tier`, `url`). | live proxy call |
| `narrative_thread(threadId)` returns that thread's dated entries (13 for the Houthi thread, about 90 kB, each with `date`, `title`, `ai.summary`). `archive_range(30)` is about 720 kB. | live proxy call |
| `prediction_snapshot(topicIds)` returns scenarios with probabilities and dated triggers. `prediction_track_record` returns `brierScore` 0.154, `resolvedTriggers` 122, `totalDatedTriggers` 20,744. | live proxy call |
| `daily_brief` for 2026-09-12 has `headline`, `summary`, `topStories[]` (title, regions, category, sourceCount, prediction; **no `threadId`**), `countryToWatch`, `risingThread`, `stats`. Today and 09-13 return `data: null`. | live proxy call |
| `weekly_brief` (weekOf 2026-09-06) has `signals[]` (with `threadId`), `watch[]`, `threadIds[]`. It has **no week paragraph, corrections or scorecard**. | live proxy call |
| Prod main chunk is 1.30 MB (422 kB gzip). The deck.gl chunk is 942 kB (261 kB gzip). The bundled 110m topology is 108 kB (39 kB gzip). `SituationMap.jsx` imports `* as d3` (the whole library). | `docs/assets`, source |
| `restProxy.js` has a concurrency limiter (cap 4) but **no in-flight de-dupe**. | source |
| `/map` today = `SituationHome.jsx`: a dark page with a 70/30 map and rail, `?focus=<situationId>` (replace mode), a manual tour, a flat/globe toggle stored in `gp_map_view`, and a "since you last looked" marker stored in `gp_map_last_seen`. | source |

---

## §1 Principles

1. **The list is the product; the map is its instrument.** Every fact and action on the map is also reachable in
   the story list, by keyboard, as real HTML. The map is never the only way to learn or do anything. The map adds
   *where* and *how much at once*. The list carries *what* and *why*.
2. **Freshness is data, never decoration.** Every age shown on the page is computed from a timestamp in the data
   (`generated_at`, `sources.*`, `next_expected_at`, topics `updatedAt`, edition `generatedAt`). Nothing says
   "LIVE", "hourly" or "today" unless the underlying source earns it. When sources disagree, the page shows the
   disagreement instead of averaging it away.
3. **Readability over spectacle. Motion has exactly one meaning.** Motion means "changed in the last 24 h" and
   nothing else. There are no ambient animations, no autoplay, no camera move on load and no points. Under
   `prefers-reduced-motion`, every motion becomes a static mark with the same meaning. The borrowing from games
   is about how they *read* (Civ VI's notification stack, HOI4's map modes, DEFCON's restraint), not how they
   *reward*.
4. **Honest joins.** The page never implies a link between a story and a place that the data doesn't assert.
   Matched means a situation (a pin). Unmatched means the story's country (a fill), labelled as such. A
   situation with no story means a monitoring-only item that points to its official source.
5. **Words paint first.** The shell, lede, status bar and list render before any map byte loads. The 2D map loads
   next. The globe loads only when someone asks for it. Every async region has a fixed-height reservation, so
   layout shift is zero.
6. **One selection, one URL.** There is a single source of truth for "what the reader is looking at": the URL.
   Map, list, callout and briefings all read it and write it. Refresh, share, toggle and Back all keep it.

---

## §2 Home layout

### 2.1 Above-the-fold order (all breakpoints)

1. **Site nav** (existing `Layout.jsx`, 56px).
2. **Lede band.** One deterministic sentence, light editorial style, reusing `LedeBand` styling (§2.6).
3. **World status bar.** One row of counts plus honest freshness (§3.4). It is light and sits on `--paper`.
4. **Stage.** The map pane and the list pane (desktop split), or one of them (mobile toggle). The first-visit
   banner is drawn **inside the map pane** as an overlay strip, so dismissing it never shifts layout.

Below the stage, in order: **trust strip** (forecast score with N resolved, plus corrections count) →
**newsletter signup** (`SubscribeCard variant="home"`) → **"How we read the world"** methodology (carried over
from `SituationHome`, trimmed) → footer. The "Buy me a coffee" rail goes away (X-14). The "Elsewhere on Global
Perspectives" teaser grid is removed because the nav already does that job.

### 2.2 Desktop split (≥ 1200px), with proportions

- Content width `min(1440px, 100vw - 2×32px)`.
- Stage grid: `grid-template-columns: minmax(0, 1.4fr) minmax(420px, 1fr); gap: var(--space-4)`. At 1440 this
  gives about 790px of map and 560px of list. The list minimum of 420px keeps a headline plus three badges on
  two lines.
- Stage height: `height: clamp(560px, calc(100svh - var(--nav-h) - var(--home-lede-h) - var(--home-bar-h) - 32px), 860px)`.
  `--home-lede-h: 64px` and `--home-bar-h: 40px` are fixed reservations. Both panes fill that height. **The list
  pane scrolls internally** (`overflow-y: auto; overscroll-behavior: contain`), so scroll-into-view (§5) works
  without moving the page. The page scrolls normally below the stage.
- Each pane has a **36px pane header**:
  - Map header (dark): `Map · Situations ▾` (mode menu, hidden until a second mode ships) · spacer · `Globe` ·
    `Key` · `⤢`.
  - List header (light): `Stories · 17` · `Sort: Importance ▾` · filter chips toggle · `⤢`.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ G Global Perspectives   Stories  Briefings  Countries  Markets  Studio  Track Record  [Sign in]│
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ India — tropical cyclone is the one situation being watched; 17 stories in the news (as of Sep 13).│ ← lede (64px)
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Watching 1 · ●high 0 ●elev 1 ●mod 0 ●low 0 │ ◆0 ■0 ▲0 ●1 │ Map 12 min ago · next 11:44 UTC │ Stories 11 days old ⚠ ⓘ │ ← status bar (40px)
├───────────────────────────────────────────────────┬──────────────────────────────────────┤
│ MAP · SITUATIONS            [Globe] [Key] [⤢]      │ STORIES · 18   Sort: Importance ▾  [⤢]│
│┌─────────────────────────────────────────────────┐│ [Conflict][Political][Economic][Humanit.]│
││ ⓘ Colour = kind of crisis, glow = how serious.   ││──────────────────────────────────────│
││   Pick a dot or a story; the other follows. [Got it]││ BEING WATCHED · 1                     │
││                                  ┌─ALERTS──────┐││ ● ELEVATED · Humanitarian · New       │
││        (dark world, ±60°)        │● India cycl. │││   India — tropical cyclone            │
││                     ●◄ callout   │ opened 15h   │││   UN/EU GDACS · Orange · 15h ago  [›] │
││                                  └──────────────┘││──────────────────────────────────────│
││                                                 ││ IN THE NEWS · 17   last updated Sep 13 │
││ [+][−]                           ⌘+scroll to zoom││ ◆ Conflict · Saudi Arabia (country)   │
│└─────────────────────────────────────────────────┘││   Saudi Arabia shuts East-West pipeline│
│                                                   ││   Story · 13 events over 6 days ▮▮ ▮▮▮ │
│                                                   ││   ✓ 8 outlets · 3 regions · Sep 13 [›]│
│                                                   ││ …                                     │
└───────────────────────────────────────────────────┴──────────────────────────────────────┘
  TRUST STRIP  ·  NEWSLETTER  ·  HOW WE READ THE WORLD  ·  footer
```

### 2.3 Expand (⤢) behaviour and URL state

- The URL param is `view`, with values `split` (default, omitted from the URL), `map` or `list`. Changes use
  `replace` (toggling panes is not a navigation step). The selection param `story` is kept across view changes.
- **⤢ on the map** sets `view=map`. The list pane collapses to width 0 and is removed from the tab order with
  `inert`. The map takes the full content width, and the stage height stays the same. If a story is selected,
  the **rich callout** (§3.6) shows the story's level-2 summary (what's happening, latest change, tier, and links)
  so no content is lost. The header button becomes `⤡ Split` (aria-label "Back to split view").
- **⤢ on the list** sets `view=list`. The map pane collapses and the list becomes a centred reading column
  (`max-width: 760px`). The stage height constraint is lifted, so the list flows with the page and there is no
  internal scroll. Each item gains a `Show on map` action that sets `view=split` and selects the story.
- **Esc** in an expanded view (when no card is open and no menu has focus) returns to split. **Esc** while a card
  is open closes the card first (§5.6).
- Width transitions last 200ms `var(--ease)` on `grid-template-columns`. Under reduced motion they are instant.
  The deck.gl or SVG map re-measures through its existing `ResizeObserver`. The fly-to is re-applied after the
  resize settles so the selection stays centred.

```
view=map                                                   view=list
┌────────────────────────────────────────────────────┐    ┌────────────────────────────────────┐
│ MAP · SITUATIONS               [Globe][Key][⤡ Split]│    │   STORIES · 18   Sort ▾   [⤡ Split] │
│┌──────────────────────────────────────────────────┐│    │   [chips]                           │
││                                     ┌─ALERTS────┐ ││    │   BEING WATCHED                     │
││                                     │● India    │ ││    │   ● India — tropical cyclone  [Show on map]│
││          ●───┐                      └───────────┘ ││    │   IN THE NEWS                       │
││              ┌──────────────────────────────┐     ││    │   ◆ Saudi Arabia shuts pipeline     │
││              │ ELEVATED · Humanitarian · New│     ││    │     ┌ expanded story card ───────┐  │
││              │ India — tropical cyclone     │     ││    │     │ what's happening …          │  │
││              │ Orange alert · 83 km/h winds │     ││    │     │ timeline ▮▮ ▮ ▮▮▮          │  │
││              │ Official GDACS report →      │     ││    │     │ forecast · track record     │  │
││              │ ‹ prev   1 of 18   next ›    │     ││    │     └─────────────────────────────┘  │
││              └──────────────────────────────┘     ││    │   …   (page scrolls; no inner scroll)│
│└──────────────────────────────────────────────────┘│    └────────────────────────────────────┘
└────────────────────────────────────────────────────┘
```

In `view=map`, the callout's `‹ prev · n of N · next ›` steps through the list order under the current filters.
This replaces the old "Walk me through today" tour, which is removed (see §3.6). It is manual only and never
autoplays.

### 2.4 Tablet (960–1199px)

Same split, with the grid at `minmax(0, 1.15fr) minmax(380px, 1fr)` and the stage height formula unchanged. Pane
headers drop text labels to icons with `aria-label`s. The alert stack collapses to a single count chip
("2 alerts ▾") that opens the stack as a popover.

### 2.5 Mobile (< 960px): the [Map | List] toggle

- A **sticky segmented control** sits under the status bar: `[ Map | List ]`, 44px tall, a `role="tablist"` with
  two `role="tab"` buttons controlling two `role="tabpanel"`s. The URL param is `view=map|list`. **Default is
  `map`** (operator decision 4: open on the map). `view=split` on a narrow screen is treated as `map`.
- **Map view:** the map fills `calc(100svh - nav - status bar - toggle - peek)`, with a minimum of 360px. A
  **peek card** (72px, existing `.sh-peek`) at the bottom shows the selected story, or the top-ranked item when
  nothing is selected. Tapping it opens that item's story card **in List view**, scrolled and expanded. The
  alert stack becomes a single chip at the top left. Pinch zoom is native to the map. Page scroll is not
  hijacked, because the map sits above the fold and the page still scrolls below it.
- **List view:** the list flows in the page (no internal scroll). Items expand in place, and each expanded card
  has `Show on map` (switches the view, flies, and opens the peek).
- The status bar compresses to two lines on mobile: counts on line 1, freshness on line 2.
- The lede band is limited to 2 lines, with an ellipsis and full text in `title`.

```
Mobile · view=map                 Mobile · view=list
┌───────────────────────────┐     ┌───────────────────────────┐
│ G  Global Perspectives  ☰ │     │ G  Global Perspectives  ☰ │
│ India — tropical cyclone  │     │ India — tropical cyclone  │
│ is the one situation …    │     │ is the one situation …    │
│ Watching 1 · ●elev 1      │     │ Watching 1 · ●elev 1      │
│ Map 12m · Stories 11d ⚠   │     │ Map 12m · Stories 11d ⚠   │
│ ┌──────────┬────────────┐ │     │ ┌──────────┬────────────┐ │
│ │ ▣ Map    │   List     │ │     │ │   Map    │ ▣ List     │ │
│ └──────────┴────────────┘ │     │ └──────────┴────────────┘ │
│┌─────────────────────────┐│     │ [Conflict][Polit.][Econ.]…│
││ ⓘ Colour = kind …  [Got it]││     │ BEING WATCHED · 1         │
││ [2 alerts ▾]            ││     │ ● ELEVATED · Humanitarian │
││                         ││     │   India — tropical cyclone│
││        (dark map)       ││     │   GDACS Orange · 15h  [›] │
││            ●            ││     │ IN THE NEWS · 17 · Sep 13 │
││                    [+][−]││     │ ◆ Saudi Arabia shuts …    │
│└─────────────────────────┘│     │   Story · 13 events / 6 d │
│┌─────────────────────────┐│     │   ✓ 8 outlets   Sep 13 [›]│
││● ELEVATED  India — trop…││     │ …                         │
││            cyclone  Open›││     │ TRUST STRIP · SIGNUP …    │
│└─────────────────────────┘│     └───────────────────────────┘
└───────────────────────────┘
```

### 2.6 Lede band: one sentence, deterministic, honest

There is one composer, `composeHomeLede({ world, stories, now })`, in `features/home/lib/`. It is a pure,
unit-tested function that makes no LLM call. It replaces the two competing ledes (`composeTopicsLede` on Home,
`buildLede` on `/map`).

- It leads with the **highest-tier being-watched item** ("Philippines — tropical cyclone, a high humanitarian
  alert, is getting worse"). If there are no watched items, it leads with the **top in-the-news story**.
- It always ends with a coverage clause built from counts, for example: "…; 17 stories in the news (as of
  Sep 13)".
- The word "today" appears only when the source behind the clause is less than 24 h old. Otherwise the clause
  carries its date (principle 2 and B-2).
- When there is nothing at all, it reads "Nothing is being watched right now; the news list is unavailable." This
  is honest and empty, never filler.

---

## §3 The map pane

### 3.1 Framing: a dark map inside a light page

- The map pane is a **dark instrument panel** on `--paper`: `background: var(--map-bg)`,
  `border: 1px solid var(--line-2)`, `border-radius: var(--r-xl)`, with an inner 1px highlight
  `inset 0 1px 0 rgb(255 255 255 / 0.04)` so the edge reads on light paper. It has no outer shadow. The pane
  header is part of the dark panel, with a `--map-line` bottom rule.
- The list pane is a **light card** (`--card`, `--line`, `--r-xl`), the same height and aligned to the same top.
  This gives two framed objects side by side, not a dark page. It resolves review C-6 and proposal §4.5.
- The dark-panel tokens move out of `SituationHome.css` (`--sh-*`) into `tokens.css` (§7.1), so the alert stack,
  callout, globe and briefing snapshot all share them.

### 3.2 Marker system

| Channel | Encodes | Rule |
|---|---|---|
| **Hue** | axis (kind of crisis) | Existing normalized `oklch(0.70 0.155 h)` set: conflict `#ee7754`, political `#9b8cf8`, economic `#38b6e0`, humanitarian `#d89e28`. Unchanged (locked in MAP plan §6). |
| **Shape (the "icon per axis")** | axis, redundantly | conflict **◆ diamond**, political **■ square**, economic **▲ triangle**, humanitarian **● circle**. Shape is the colour-blind-safe second channel (WCAG 1.4.1). At marker sizes of 7–14px a glyph such as a missile or a wave does not read, but a silhouette does. Hazard sub-type icons (quake, cyclone, flood, volcano, drought, wildfire from GDACS `eventType`) appear **in the callout, list item and alert row**, never on the marker. |
| **Glow** | tier | low: no halo, core alpha 0.8 · moderate: no halo, alpha 0.92 · elevated: halo 15px at 13% alpha · high: halo 24px plus a white 1.25px keyline (the existing `TIER_HALO` values and keyline rule). Core size spans only about 1.5× (existing `TIER_R`) so low markers stay clickable. |
| **Pulse** | new or escalating in the last 24 h | One breathing halo (2.4s ease-out, opacity 0.9 → 0) **only** when `opened_at` < 24 h, **or** `escalating === true`, **or** `tier_changed_at` < 24 h with a tier *rise*. **At most 3 markers pulse at once**: those with the highest tier, then the most recent. The rest get a static outer ring. Reduced motion: every pulse becomes a static hollow ring. On the deck.gl globe, the pulse is always static (the ledger records that animated layers ate clicks). |
| **Selection** | the selected story | Core ×1.25, 2px white keyline, all other markers dimmed to 40% (existing behaviour), plus spread arcs and affected-country fill (existing selection-state layers). |
| **Country fallback** | an unmatched story's country | Country polygon fill in the story's axis hue at 18% alpha with a 1px 55% outline. There is no marker. A small label chip reads "Saudi Arabia · no live situation". This is honest fallback 3. |
| **Closed <48h** | ended situations | Grey hollow ring, not pickable (existing 2D behaviour), and hidden from the list. |

**Labels:** at most 6 labels are shown, for high and elevated items only (existing rule), drawn as
`Place — verb` from `verb_label` with a halo stroke. The rest reveal on hover or focus through the tooltip.

### 3.3 Alert stack (Civilization-style; replaces the `/breaking` feed page)

*Borrowed from:* Civ VI's notifications, which slide down the right-hand side of the screen and jump to the
location on click ([Game UI Database: Civ VI](https://www.gameuidatabase.com/gameData.php?id=639),
[gamepressure Civ 6 interface guide](https://guides.gamepressure.com/sidmeierscivilization6/guide.asp?ID=37562)).
*Lesson also taken:* Civ VI's right-click dismiss collides with map commands
([CivFanatics thread](https://forums.civfanatics.com/threads/right-clicking.659074/)). Our dismiss is therefore an
explicit × button and never a map gesture.

- **Placement:** inside the map pane, top-right, under the pane-header controls. It is `max-width: 260px`, sits
  12px from the edge, and stacks vertically. On tablet and mobile it collapses to a chip (§2.4, §2.5).
- **What qualifies (deterministic, the union of):** (a) confirmed breaking alerts under 24 h old (existing
  `useNotifications` → `newsRecommend list_alerts`); (b) situations with `opened_at` under 24 h at elevated or
  high tier; (c) situations whose tier rose (`tier_changed_at` under 24 h) or with `escalating: true`. Entries are
  de-duplicated by story key (§4.4). A breaking alert whose `threadId` matches a situation merges into one row.
- **Maximum 3 rows visible**, ordered tier desc → most recent. A 4th row reads "+N more", which opens a popover
  listing all qualifying items. Each row is 44px minimum: axis shape and hue, tier chip, `verb_label` or alert
  title (1 line), and reason plus age ("opened 3h ago", "raised to High 40m ago", "breaking alert 2h ago").
- **Click or Enter** on a row selects that story (`?story=`), which flies the map and expands the list item (§5).
  The row is marked seen.
- **Dismiss (×)** hides the row from the stack only. The story stays on the map and in the list. Seen and
  dismissed state is stored in `localStorage gp_alerts_seen = {<storyKey>: <isoSeenAt>}`, pruned after 7 days
  and purged on sign-out with the other `gp_*` keys. A row reappears if its reason changes after it was
  dismissed (for example, a tier rise after the dismiss time).
- **Empty:** no stack is rendered, and the status bar carries "No new alerts in 24 h". Quiet is the normal state,
  a copy line borrowed from `/breaking`.
- **Live region:** see §9.3.
- `/breaking` (the list page) redirects to `/`. `/breaking/:id` stays, because email deep links need it, and it
  gains "Show on map" → `/?story=<threadId>` (replacing the current `/map` link at `BreakingDetailPage.jsx:106`).

### 3.4 World status bar

This is a light, 40px, single row between the lede and the stage (two lines on mobile). It uses mono 12px
figures, sans labels, and a `role="status"` container (non-live; it is not announced on each poll).

**Exact fields, left to right:**

1. `Watching N`, where N counts open situations (state ≠ closed).
2. Tier counts: `● high a · ● elevated b · ● moderate c · ● low d`, with `--risk-*` dots. A zero is shown in
   `--ink-faint` and never hidden, because the zeros are the coverage statement (MAP plan §12, finding 1).
3. Axis counts: `◆ a  ■ b  ▲ c  ● d` in axis hues, with the name on hover or focus, dimmed when zero.
4. **Freshness**, from `world.sources` and topics `updatedAt` only:
   - **Map clause** uses the oldest `sources.*` stamp (the existing `oldestSource`): `Map 12 min ago · next
     11:44 UTC` (from `next_expected_at`). The "next" value is shown as an absolute UTC time, not "in N min",
     which removes the ledger's "next ~just now" bug class. When `next_expected_at` has passed by more than one
     cycle, it reads `next update overdue`.
   - **Stories clause** is based on topics `updatedAt`: `Stories 3h ago`.
   - **Collapse rule:** when both sources are *current*, the bar shows **one** stamp,
     `Updated 12 min ago · next 11:44 UTC`, based on the oldest source. When either is *delayed* or *stale*, it
     shows both clauses so the disagreement is visible.
   - **States** come from `shared/lib/freshness.js`: current (neutral ink), delayed (over 9 h, `--amber` with ⚠,
     matching the `newsFreshnessMonitor` threshold), stale (over 48 h, or `world.stale === true`, `--ink-dim`
     with an explicit date, "Stories last updated Sep 13"). The thresholds are constants in one file so they can
     be changed later.
   - An ⓘ button opens a popover listing every source age (`gdacs`, `news`, `topics`) plus the sentence "Ages
     come from the data, not the page load."
5. The "LIVE · Updated hourly" `StatusStrip` is **not** used on Home (B-1). The bar replaces it.

### 3.5 Map modes (layer toggles)

*Borrowed from:* Hearts of Iron IV's **map modes**: one base map, a single active lens, switched from a compact
control, and never overlaid. This is the answer to proposal §7 risk 6 ("country-risk layer is a second
encoding"). Modes are **exclusive**: one encoding at a time.

| Mode | Encodes | Ships | Data |
|---|---|---|---|
| **Situations** (default) | markers per §3.2 | **first (H1)** | `world/latest.json` |
| Country risk | country fill by canonical tier (`riskTiers.js` 25/50/75), no markers, legend = the 4 tiers | H6 | `world_overview` / country risk scores. Needs a check that coverage is broad enough; a sparse fill gets the same honest "N countries scored" note |
| Markets | a small systemic dock over the map (the bundle's `systemic[]`), not geographic fills | later | `world.systemic` (empty today) |
| Connections | pair arcs (`pair_analyses_list`) | later, after `/weekly/pair/:slug` returns (S6·T2) | existing |

The mode control (`Map · Situations ▾` in the pane header) is **hidden until a second mode ships**. The URL param
is `layer=` (existing reservation in MAP plan WS3), omitted for the default. Story selection and fallback
highlighting work in every mode.

### 3.6 The callout

- **When nothing is selected:** no callout. The top-ranked item is already first in the list and in the lede.
  This deliberately changes the `/map` behaviour, where the hero callout existed because there was no list
  beside it.
- **When something is selected (split view):** a compact callout (288px, existing placement algorithm
  `placeCallout`) shows the tier chip, axis shape and word, `verb_label` or story title, one line of
  `what_changed` or latest change, and `Details in the list ↓` (desktop) or `Open ›` (mobile). It does not
  duplicate the card.
- **When something is selected in `view=map`:** a rich callout (360px, capped at 60% of pane height with internal
  scroll) shows the level-2 content in short form (what's happening in 2 sentences, latest change, tier, outlets,
  forecast headline) plus `Read full story →` and `‹ prev · n of N · next ›`.
- **Unmatched story:** the callout anchors to the country centroid (`countryGeo.js` fallback table) and its first
  line reads **"No live situation: country shown."**
- **Globe:** the far-side cull stays (existing `onNearSide`).
- **The tour button ("Walk me through today") is removed.** Stepping through with prev/next in `view=map`
  replaces it. This makes one less control and ends the tour/selection split state (`tourId` vs `focus`).

### 3.7 First-visit banner

- **Placement:** a strip overlaid at the top of the map pane (inside the dark panel), 40px tall, full pane width
  minus 24px, left-aligned text with a `Got it` button on the right. It is `position: absolute`, so dismissing it
  causes **zero layout shift**. It never covers the pane header or the controls, and the map controls sit below
  it while it shows. On mobile it sits at the top of the map view.
- **Copy (normal):** "**What you're looking at:** events we're actively monitoring. Colour is the kind of crisis,
  glow is how serious, a pulse means it changed in the last day. The list is every story in the news; pick one
  and the map follows. `[Got it]`"
- **Copy (stale variant, which replaces the normal copy while any source is stale):** "**Our news feed hasn't
  updated since Sep 13.** Disaster alerts on the map are current (12 min ago); story text may be out of date.
  `[Got it]`" The date and age come from the data.
- **Copy (thin-coverage variant, while news axes have zero situations):** keep the existing honest line "Tracking
  severe natural disasters (UN/EU GDACS). Conflict, political and economic situations appear when the news layer
  is producing them." It sits as the second sentence of the banner.
- **Persistence:** `localStorage gp_home_intro = "v1:<isoDismissedAt>"`, purged on sign-out with `gp_*`. The
  normal banner never returns after a dismissal (bump `v1` → `v2` only on a material change of meaning). The
  **stale variant returns on each new session while stale** (it uses `sessionStorage gp_home_stale_seen`),
  because it carries a current fact, not onboarding.
- It never blocks navigation, has no scrim and takes no focus. It is a `role="note"` inside the map region, not a
  dialog. **The driver.js onboarding tour no longer auto-starts on `/`** (review X-1). It stays reachable from the
  `?` button only.

### 3.8 Default projection, 2D flat vs 3D globe, zoom and fly

- **Default: 2D flat** on every device (the whole world stays visible, the 3-second read from MAP plan §1). The
  Globe is an opt-in button whose preference persists in the existing `gp_map_view`. The deck.gl chunk loads
  **only** when the Globe is chosen, or when a stored preference says globe, and even then only after first
  paint (§8).
- **Target renderer for flat: the SVG `SituationMap`**, upgraded to parity (shapes, glow, pulse, selection arcs
  and fill, callout projection, fallback country fill). Until parity lands (phase H3), the flat view stays on the
  deck.gl `MapView` loaded lazily after first paint, with the skeleton in §8.
- **Framing:** crop to about −58°…72° latitude (existing `FRAME`), Equal Earth projection (2D).
- **Zoom:** `+` and `−` buttons (44px) at the bottom left. Pinch works on touch. On desktop, **the wheel zooms
  only with ⌘ or Ctrl held**, or after the map has been clicked or focused. A plain wheel scrolls the page, with
  a 1.5s hint "Use ⌘/Ctrl + scroll to zoom". The map sits in a scrolling page, so this prevents scroll hijack.
  Double-click zoom is off (existing). Zoom range is 1–8×.
- **Fly on select:** centre the item's centroid (situation) or country centroid (fallback) at zoom 3.0 (flat) or
  2.1 (globe, existing), over 800ms with `d3.zoom().transition()` or deck `FlyToInterpolator`. The target is
  offset so the callout fits (the callout's quadrant decides the offset). **Reduced motion: jump, 0ms.**
- **Fly back on clear:** return to the world fit, only if the user hadn't manually moved since the selection
  (existing `userMoved` rule). The same ID arriving from a 5-minute poll never re-flies (existing
  `focusCentroid` keying).
- A **`Reset view` button** appears only when the view differs from the world fit.

---

## §4 The story list pane

### 4.1 The target view-model: `StoryItem` (frontend-derived, not a new entity)

WORLD_MODEL §2 forbids new ID spaces. A `StoryItem` is a **view-model** derived in the browser from the two
narrations of one event. Its key is an existing identifier.

```ts
StoryItem {
  key: string            // threadId if the event has one, else situationId   (§4.4)
  kind: 'story' | 'monitoring'      // monitoring = situation with no thread (e.g. GDACS)
  group: 'watched' | 'news' | 'developments'
  threadId: string|null
  situationId: string|null          // present when joined to a live situation
  title: string                     // topic title (story) | verb_label (monitoring)
  headlines: {topicId, title}[]     // today's topics in this thread (usually 1)
  topicIds: string[]                // for prediction_snapshot, Studio link
  axis: 'conflict'|'political'|'economic'|'humanitarian'|null
                                    // situation.axis, else WORLD_MODEL §3 display mapping of event_type/category
  tier: 'low'|'moderate'|'elevated'|'high'|null
                                    // situation.tier only (canonical). NEVER derived from significance/urgency.
  state: 'emerging'|'escalating'|'peak'|'cooling'|null   // situation only
  escalating: boolean
  changedAt: iso                    // situation.last_change_at | newest topic's source age → topics updatedAt
  freshness: { at: iso, source: 'map'|'topics' }
  corroboration: { outlets, sources, regions } | null   // topic sources[] (existing Home math) | situation evidence.outlets
  place: { type: 'situation', centroid, iso3_affected }
       | { type: 'country', iso3, name }                 // honest fallback
       | { type: 'none' }                               // development / unplaceable
  arc: { events, firstDate, lastDate, dates: string[] } | null   // "Story · N events over M days"
  urgent: boolean                   // editorial urgency = tempo flag (WORLD_MODEL keeps it as tempo, labelled)
  official: { label, url } | null   // GDACS report for monitoring items
}
```

**Build function:** `buildStoryIndex({ topics, world, arcs, storyMap })` in `features/home/lib/buildStoryIndex.js`.
It is pure and unit-tested with the live shapes as fixtures.

**Join rules, in this order:**
1. **Thread ↔ situation:** `topic.threadId === situation.threadId`. Today the tracker sets `threadId` on news and
   breaking situations when available. When `threads/story-map.json` (the matcher output) becomes readable at
   the edge, a second pass joins `situation.storyId ↔ threadId` from it. Several topics with the same `threadId`
   fold into one `StoryItem`, with `headlines[]` holding each.
2. **Unmatched story → country fallback:** `place = {type:'country', iso3: topic.iso3[0] ?? iso3(primaryCountry)}`.
   If the topic has `iso3: []` and no `primaryCountry`, then `place = none` and `group = 'developments'`
   (WORLD_MODEL D1: developments never get a pin).
3. **Unmatched situation → monitoring-only item:** `kind:'monitoring'`, `key = situationId`, `official` = GDACS
   report URL from detail (lazy) or the "UN/EU GDACS" label. It carries **no** arc, forecast or summary.
4. Closed situations are excluded from the list (they stay as grey rings on the map for 48 h).

### 4.2 Grouping and sorting (decided)

The list is **grouped by what we know, then sorted within each group**. Grouping by region (today's Home) is
**rejected**: it scatters the most important items and is already covered by the map. Region becomes a filter.

| Group | Contents | Sort within |
|---|---|---|
| **Being watched · N** | items with a live situation (joined stories and monitoring-only) | tier desc → escalating first → `changedAt` desc (the existing `ranked` rule) |
| **In the news · N** *(header carries the topics freshness: "last updated Sep 13")* | stories with no live situation | **outlets desc** (counted corroboration, per WORLD_MODEL §4 "measured > counted > judged") → `changedAt` desc. `urgent` is a labelled tempo chip, **not** a sort key |
| **Developments · N** (collapsed by default, one line: "3 developments without a place: science, tech, society ▸") | `place.type === 'none'` | outlets desc |

**Honesty rule:** tier chips appear only when a canonical tier exists (a situation, and later a thread 4-axis
score through `riskTiers.js`). An in-the-news story with no tier shows **no** tier chip. The design never
promotes `significance` to a tier (WORLD_MODEL D2).

`Sort ▾` offers **Importance** (the grouping above, default) and **Latest change** (flat list by `changedAt`,
groups removed). The URL param is `sort=latest` (default omitted).

### 4.3 Filters

- **Axis chips** (4, multi-select; none selected means all): `axis=conflict,humanitarian`. Chips show live counts,
  and a zero-count chip is disabled but visible. **Filters apply to the map too**: filtered-out markers dim to
  15% and become non-pickable. The linked state stays consistent.
- **Region** menu (`region=middle-east`), using `situationLabels.regionOf` for ISO3 and `countryMapping` for
  names. Default is all.
- **Edition filter** (arrives from /briefings, §6.5): `edition=daily/2026-09-12` shows a removable chip "From the
  Sep 12 daily edition (8) ×". It restricts the list and map to that edition's stories and countries.
- If a selected story is filtered out, the selection wins: filters apply to everything else, and the selected
  item stays visible with a "filtered out: show anyway" note.
- An empty result after filtering reads "No stories match these filters. Clear filters", never a blank pane.

### 4.4 The story key and URL

`?story=<key>` holds either a threadId (`thread-…`) or a situationId (`gdacs#…`, `news#…`, `breaking#…`),
URL-encoded. The prefixes already discriminate the two roots, so no new IDs are needed. **Canonicalization:** if
`story=` holds a situationId that joins to a thread, the page rewrites it (`replace`) to the threadId. Legacy
`?focus=<situationId>` (the current `/map`, email and LinkedIn links) is read once and rewritten to
`story=`. Country-only deep links use `?country=<ISO3>` (used by briefings items without a thread, §6.5).

### 4.5 Item anatomy (level 1: scan)

This is one `<li>`. The whole header row is a `<button aria-expanded aria-controls>`, with a minimum height of
64px.

```
┌──────────────────────────────────────────────────────────────┐
│ ◆ CONFLICT · Saudi Arabia (country) · URGENT            Sep 13│  kicker row (mono 11px)
│ Saudi Arabia shuts East-West pipeline after drone attack…  › │  headline (sans 15/600, 2 lines max)
│ Story · 13 events over 6 days  ▮▮▯▮▯▮▮▮▯▯▮▮▮▮ ← 30-day strip │  arc badge + timeline strip
│ ✓ Corroborated · 8 outlets · 3 regions      ⚑ forecast open │  evidence row
└──────────────────────────────────────────────────────────────┘
Being-watched variant (joined or monitoring):
│ ● ELEVATED · Humanitarian · New · ▲ getting worse       15h │  tier chip first (risk-pill)
│ India — tropical cyclone                                   › │
│ UN/EU GDACS · Orange alert · Tropical storm, 83 km/h        │  what_changed (1 line)
```

- **Kicker:** axis shape and word in `--axis-*-ink` (the dark-on-paper variant, §7.1), then a place label. A
  joined item shows the situation's place ("India"). An unmatched item shows "Saudi Arabia (country)", where the
  parenthetical carries the honest fallback. Then tempo chips (`URGENT` for editorial urgency, `▲ getting worse`
  for situation escalation, `◇ new` since the reader's last visit through the existing `gp_map_last_seen`
  logic). Freshness (`Sep 13` or `15h`) is right-aligned, from `changedAt`.
- **Headline:** the topic title. If `headlines.length > 1`, "+1 more headline in this story" appears under it.
- **Arc badge:** "Story · N events over M days" only when `arc.events ≥ 2`. A single-event story shows no badge
  (not "Story · 1 event"). The **timeline strip** is a 120×10px inline SVG over the last 30 days, with one 2px
  tick per event date and today at the right edge. It is `aria-hidden`, and the badge text carries the meaning.
- **Evidence row:** the existing `SourceRobustness` pill ("✓ Corroborated · 8 outlets · 3 regions" or
  "⚠ Single-source"), plus `⚑ forecast open` only when the arc index says the thread has a v1 forecast (H6). The
  row hides when there is no data (honest-empty contract).
- **Monitoring item:** no arc and no evidence row. Its line 3 is `what_changed`, plus "Official: UN/EU GDACS".
- **Selected state:** a 3px left border in the axis hue, a `--paper-2` background, and the header stays in place
  while the card expands beneath it.

### 4.6 The in-place story card (level 2: understand)

This opens under the item. Only **one card is open at a time**: opening another closes the first, which matches
the single URL selection. Density is **compact analyst**: body 14px/1.55 and section labels in the `.label` mono
eyebrow style. The card's max height is natural (no inner scroll) inside the already-scrolling list.

```
┌ STORY CARD ─────────────────────────────────────────────────────────┐
│ WHAT'S HAPPENING                                          as of Sep 13│
│ 2–3 sentences: latest entry's ai.summary, first paragraph.           │
│                                                                      │
│ LATEST CHANGE                                                        │
│ Sep 13 · "Houthis claim strike on Sharurah base" (newest entry)      │
│ + for joined items: situation what_changed · 40 min ago              │
│                                                                      │
│ TIMELINE · 13 events over 6 days                                     │
│ Sep 8 ─●──●───●●──●────●●●─── Sep 13   (dates clickable → story page)│
│ Sep 13  Saudi Arabia shuts East-West pipeline…                       │
│ Sep 11  Houthis seize Perim Island…                                  │
│ Sep 8   Houthi attacks on Saudi Arabia wound 73…      [all 13 →]     │
│                                                                      │
│ SEVERITY                        (only if canonical data exists)      │
│ ● ELEVATED   Conflict 72 · Political 58 · Economic 64 · Humanit. 31 │
│                                                                      │
│ LIVING FORECAST · as of Sep 13                                       │
│ Most likely (60%): Aramco resumes East-West flows · next check Oct 15│
│ 0/9 triggers resolved on this story                                  │
│ Our forecasts overall: Brier 0.154 across 122 resolved →            │
│                                                                      │
│ SOURCES  ✓ 8 outlets · 3 regions   france24.com · … [show all 8]    │
│                                                                      │
│ [Read full story →]  [Analyze in Studio →]  [Copy link]  [Show map*] │
└──────────────────────────────────────────────────────────────────────┘
* "Show map" appears only in view=list and on mobile.
```

**Sections, their data, and when each loads:**

| Section | Data | Load | If missing |
|---|---|---|---|
| What's happening | newest `narrative_thread` entry `ai.summary`, first paragraph, max 3 sentences | **lazy on expand**, through the existing `useNarrativeThread` (sessionStorage 30 min) | fall back to `topic.context/description` if present, else omit the section. Never a placeholder |
| Latest change | newest entry `date` and `title`, plus `situation.what_changed` and age for joined items | lazy (same call) and bundle | omit |
| Timeline | all entries, newest 3 listed, dot strip across `firstDate…lastDate` | lazy (same call) | a single event shows the one row only |
| Severity | situation tier (bundle, instant) + 4-axis scores via `RiskScorecard` when a thread-level score is returned | tier instant; axis scores lazy (`thread_analysis`), **currently returns `{}`**, see §4.8 | show the tier row only. Omit the axis row, with no "N/A" |
| Living forecast | `prediction_snapshot(topicIds)` (existing `useThreadForecast`): top scenario, probability, next pending trigger and deadline, resolved/total. Footnote from `useTrackRecord`: Brier + **N resolved always shown next to it** (proposal §4.4 honesty guard) | lazy on expand | omit the block. The footnote is shown only when the track record loaded |
| Sources | topic `sources[]` (existing diversity sort), collapsed to outlet names with "show all" | instant (already in topics) | omit |
| Monitoring variant | GDACS facts (level, severity text, type, affected names), official report link, the existing pass-through note ("no AI analysis is generated at this level") | `situations/state/<id>.json`, lazy (existing `useSituationDetail`) | report link falls back to the "UN/EU GDACS" label |

**Level 3 (go deep):** `Read full story →` goes to `threadPath(threadId)` (becomes `/story/:id` once the rename
lands). `Analyze in Studio →` goes to `/analyze?stories=<topicId>` (existing entry-point contract).
`Copy link` copies `https://globalperspective.net/?story=<key>`. The old Summary / Predict / Trace Cause button
trio is **not** carried onto the home list. Summary and forecast are folded into the card, and Trace Cause
stays on the story page.

**Skeleton:** on expand, the card immediately renders its frame with fixed-height skeleton bars (what's happening
3×14px lines, timeline 3 rows, forecast 2 rows). Real content replaces the bars in place. The card grows once to
its final height, triggered by the user, so it does not count as CLS.

### 4.7 The three disclosure levels

| Level | Reader intent | Surface | Cost |
|---|---|---|---|
| 1 · Scan | "what's going on" | list item and map marker | zero extra requests beyond the page load (arc strip hydrates after idle, §8) |
| 2 · Understand | "tell me about this one" | in-place card, and the map flies to it | 2–3 lazy requests (`narrative_thread`, `prediction_snapshot`, maybe `situation state`) |
| 3 · Go deep | "I'm working this" | story page and Studio | route change |

### 4.8 What the frontend can do NOW vs what needs backend work

| Need | Now (existing endpoints) | Backend work (flagged, internals not designed here) |
|---|---|---|
| List of stories | `topics` (proxy), about 500 kB with source snippets; de-dupe it (§8) | **B1**: a slim list projection on the CDN (title, threadId, topicId, iso3, primaryCountry, category/event_type, urgency, source outlet+country only, updatedAt), ideally next to `world/latest.json`, so Home makes 2 CDN reads and no proxy read |
| Thread ↔ situation join | `threadId` on situations (0 of 1 today; the matcher links about 35% of stories) | **B2**: publish `threads/story-map.json` behind the Worker `/data/*` route (the matcher already writes it; today it returns 404 at the edge) |
| "Story · N events over M days" + strip | derive from `archive_range(30)` (about 720 kB), loaded **after idle** and cached in sessionStorage. The badge copy says "…over the last 30 days" when it is capped | **B3**: a small `threads/index.json` (threadId → events, first_date, last_date, dates[]) on the CDN. Then the badge renders at first paint and the 720 kB call disappears from Home |
| Tier for in-the-news stories | none (honestly omitted) | **B4**: thread-level canonical tier / 4-axis scores (`thread_analysis` returns `{}` today) |
| Axis for unmatched stories | frontend display mapping from `event_type`/`category` (WORLD_MODEL §3; that table is NEEDS-OPERATOR-REVIEW) | none, it is display-only |
| Forecast flag on level 1 | none. The per-item `prediction_snapshot` fan-out is too costly | covered by B3 (add `has_forecast` to the index) |
| Monitoring items | bundle plus lazy state object | none |
| Alerts | `list_alerts` plus the bundle | none |

---

## §5 Linked selection

### 5.1 State model

- **The single source of truth is the URL.** The params are `story`, `view`, `axis`, `region`, `sort`, `layer`,
  `edition` and `country`. There is no React state that mirrors the selection.
- **`useHomeState()`** (`features/home/hooks/useHomeState.js`) wraps `useSearchParams` and returns parsed values
  plus intent-named setters: `select(key, {origin})`, `clear({origin})`, `setView(v)`, `setFilters(f)`.
  - Selecting **pushes** a history entry: from nothing to a story, or from one story to another by a user action.
    Back therefore walks the reader's trail, which honours "the back button keeps it".
  - Clearing **replaces**. View, filter and sort changes also **replace**.
  - Canonicalization (situationId → threadId, `focus` → `story`) **replaces**.
- **Selection origin is transient and deliberately not in the URL.** It lives in a tiny React context,
  `SelectionOriginContext` (a `useRef` of `'list' | 'map' | 'alert' | 'url'` plus a monotonically increasing
  `seq`), provided by the Home page. It exists only so subscribers know *how* to react (scroll or not, fly or
  not). It is never used to decide *what* is selected.
- **Subscribers:**
  - `MapPane` reads `story` → resolves the `StoryItem` → derives `focusTarget` (situation centroid or country) →
    flies and highlights.
  - `StoryList` reads `story` → expands that item → scrolls it into view unless `origin === 'list'`.
  - `AlertStack` reads `story` to mark the active row.
  - The callout and peek read the same resolved item.

### 5.2 Event flows

**List → map:** click or Enter on an item header → `select(key, {origin:'list'})` → URL `?story=key` (push) →
list: the card expands, with no scroll because the reader is already there → map: fly to the target (§3.8),
highlight, show the compact callout → on mobile in List view, no view switch happens (the reader chose the list).
`Show on map` switches the view explicitly.

**Map → list:** click or tap a marker, or activate an alert row → `select(key, {origin:'map'|'alert'})` → URL
push → map: fly and highlight → list (desktop split): the item expands, then scrolls into view with
`block:'nearest'` inside the list pane only (`scrollIntoView` scoped to the pane scroller, never the window) →
on mobile Map view: the **peek card** updates and the view does not auto-switch. Tapping the peek opens List view
at the expanded card.

**Deep link / refresh / share:** on mount, `origin = 'url'` → the list expands and scrolls the item (instant, no
smooth) → the map sets its initial view **directly at the target** (no fly-in animation on load, per principle
3) → focus stays at the top of the document (no focus theft on load). A skip link "Jump to selected story" is
offered as the first item in the list pane.

**Clear:** the item's collapse button, Esc, or clicking empty ocean on the map → `clear()` → replace → the map
flies back only if the user hasn't moved it (§3.8).

### 5.3 Fallbacks

| Case | Behaviour |
|---|---|
| story key not in the current index (aged out, or the thread is no longer in today's topics) | Resolve by prefix. For a threadId: render a **stub item** at the top of the list: "This story isn't in today's list. Read the full story →" (link to the story page) and highlight the country if `narrative_thread` returns regions. For a situationId: reuse the existing "no longer being tracked" copy |
| story with no situation | country fill plus the callout line "No live situation: country shown" |
| story with no country (development) | no map change; the map shows a transient chip "Not on the map: a development without a single place" (3s, or static under reduced motion) |
| situation with no story | monitoring item; card = official facts and link |
| country centroid missing from topology | `ISO3_CENTROID_FALLBACK`; else no map change plus a chip "Location not mappable", and the raw string goes to `errorSink` kind `unmatched_region` (MAP plan WS3, no silent drop) |

### 5.4 Keyboard

- The list is a normal `<ul>` of disclosure buttons. Tab and Shift-Tab move between item headers and the controls
  inside an open card. **Enter or Space** toggles expand. **Esc** inside an open card collapses it and returns
  focus to its header button.
- The alert stack rows are buttons in DOM order before the map canvas. The dismiss × is a separate button with
  `aria-label="Dismiss alert: India — tropical cyclone"`.
- **Map:** individual markers are **not** in the tab order (justification in §9.2). The map region itself is one
  tab stop (`tabindex=0`, `role="application"` is **not** used). On focus, **arrow keys pan**, **+ and −
  zoom**, **0 resets**, and **[ and ]** step selection to the previous or next item in list order, which moves
  the list too. Those keys are announced in the map region's `aria-describedby` hint.
- The pane toggle (mobile) follows the tablist pattern: ←/→ between tabs, and Enter activates.

### 5.5 Focus management

- A card opened by a list click keeps focus on the header button (per the disclosure pattern). The card content
  follows in DOM order.
- A card opened **by the map or an alert**: focus does **not** move into the list (the pointer user is on the
  map). A polite announcement is made instead (§9.3). For keyboard `[` and `]` on the map, focus also stays on
  the map.
- On a **view change** (⤢ / ⤡ / mobile tab), focus moves to the newly visible pane's header heading
  (`tabindex=-1`).
- **Mobile peek → List view:** focus moves to the expanded item's header button.

### 5.6 Scroll-into-view and reduced motion

- Scroll the pane scroller only: `itemEl.scrollIntoView({block:'nearest', behavior})`, with `behavior = 'smooth'`
  unless reduced motion, in which case `'auto'`. On desktop split the list pane scroller is the scroll parent;
  in `view=list` and on mobile it is the window, offset by the sticky header (`scroll-margin-top`).
- Reduced motion also turns fly-to into a jump, removes pane width transitions, and makes pulses static.

### 5.7 Deep links from elsewhere

- `/briefings` items: `Show on map` → `/?story=<threadId>`, or `/?country=<ISO3>` when the item has no thread.
- An edition's map snapshot → `/?edition=daily/2026-09-12`.
- `/breaking/:id` → `/?story=<threadId>`.
- The Story page's "Being watched" chip (optional, MAP plan §9) → `/?story=<threadId>`.
- Email and LinkedIn: after the S6 swap, the Worker 301s `/map?focus=X` to `/?story=X` (§10, H5).
- All of these links are generated through one helper, `homeStoryPath(key, opts)` in `shared/lib/homePath.js`,
  modelled on `threadPath()`, so the contract lives in one place (`reference_page_wiring_contracts`).

---

## §6 /briefings

### 6.1 Routes

- `/briefings` shows the latest daily edition (Daily tab).
- `/briefings/daily/:date` and `/briefings/weekly/:weekOf` are the canonical, shareable edition URLs.
- `/briefings/weekly` shows the latest weekly edition.
- The tabs are **links to routes**, not query params, so each edition has one URL. `/daily`, `/daily/:date` and
  `/weekly-brief` redirect: in the SPA via `<Navigate replace>`, and at the Worker edge as 301s once the Stage-0
  Worker change lands.

### 6.2 Page layout (light editorial, reading column 720px, with a 280px right rail on desktop ≥ 1200)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ nav                                                                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│   BRIEFINGS                                                                      │
│   [ Daily ]  [ Weekly ]                                   (tabs = route links)   │
│  ┌────────────────────────────────────────────────┐  ┌──────────────────────┐   │
│  │ ‹ Sep 11      DAILY · SATURDAY, SEP 12, 2026    Sep 13 › (disabled: none)  │  │ EDITION MAP          │   │
│  │ Published Sep 12, 14:01 UTC · covers the 24 h to publication · ~3 min read│  │ ┌──────────────────┐ │   │
│  │ ⚠ Latest edition: Sep 12 — today's is not yet published                   │  │ │ (dark 2D, 8 dots) │ │   │
│  │                                                │  │ └──────────────────┘ │   │
│  │ Houthis complete Bab el-Mandeb takeover as …   (H1 = headline)            │  │ 8 stories · 11 countries│   │
│  │                                                │  │ Open on the map →    │   │
│  │ THE BIG PICTURE                                │  ├──────────────────────┤   │
│  │ three sentences…                               │  │ ARCHIVE              │   │
│  │                                                │  │ Sep 12 ● Sep 11 ●    │   │
│  │ KEY JUDGMENTS                                  │  │ Sep 10 ● Sep 9 ○ …   │   │
│  │ 1. Houthi forces will consolidate … LIKELY · moderate confidence            │  │ (○ = no edition)     │   │
│  │    Read story → · Show on map →               │  └──────────────────────┘   │
│  │ 2. …                                           │                              │
│  │ BY REGION   Middle East (3) · Europe (2) · …   │                              │
│  │ WATCH TODAY  • 14:00 UTC UNSC session on … │                              │
│  │ MARKETS  Brent $x ▲ · … → Markets             │                              │
│  └────────────────────────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

On mobile the rail content moves **below the edition header**: the map snapshot at full width (fixed 180px
height), then the edition body, then the archive strip as a horizontal scroller at the end.

### 6.3 Edition header (both tabs)

- **Kicker:** `DAILY · SATURDAY, SEPTEMBER 12, 2026` or `WEEKLY · WEEK OF SEPTEMBER 6, 2026`, from the edition's
  `dateKey` / `weekOf`.
- **Stamp:** `Published <generatedAt, UTC> · covers <period> · ~3 min read`. Read time = words / 230, rounded, and
  computed. **The page never shows a date that isn't in the data** (principle 2). The period is "the 24 h to
  publication" (daily) or "Sep 6–12" (weekly, from weekOf + 6).
- **Prev / next arrows** skip empty days. Only dates known to have an edition are linked. When there is no
  earlier or later edition, the arrow renders disabled with `aria-disabled` and the title "No earlier edition".
  This fixes X-10's dead arrow.
- **H1** = the edition headline (daily) or "The week's signals, ranked by risk" (weekly, existing).

### 6.4 Daily and weekly anatomy, mapped to data

**Daily** (target anatomy per the brief):

| Section | Now (from `daily_brief`) | Gap → backend |
|---|---|---|
| The big picture (3 sentences) | `summary`, clamped to 3 sentences client-side with a "Read more" disclosure | **B5**: the generator emits a 3-sentence `big_picture` |
| Key judgments (3–5, likelihood + confidence) | interim: `topStories[].prediction` as judgment text, with **no** likelihood or confidence badge (never invented) | **B6**: `key_judgments[]` {text, likelihood band (ICD-203 words), confidence, threadId} |
| By region | derived client-side from `topStories[].regions[0]` → `regionOf` → grouped titles | none |
| Watch today | `countryToWatch` as one item, until B7 | **B7**: `watch[]` {event, time, stake}, the same shape as weekly `watch` |
| Markets in one line | composed deterministically from `markets_global` at render time, labelled with its own stamp ("as of 10:00 UTC"). It can differ from the edition time, and it says so | none |
| Links | `Read story →` needs `threadId`: **`topStories` has none today**. Interim: `Show on map` uses `?country=<ISO3 of regions[0]>`; `Read story` is omitted | **B8**: `threadId` on each `topStories[]` item |

**Weekly:**

| Section | Now | Gap → backend |
|---|---|---|
| The week in one paragraph | none | **B9**: `week_summary` |
| Signals ranked by risk | `signals[]` (existing `WeeklyBriefPage` rendering, re-hosted) | none |
| What we corrected this week | `corrections_feed`, filtered client-side to the week window. Anon sees the newest 5 (member-gated ledger), so the section shows "N corrections this week · see all on Track Record →" with the public count | none (the count is public per Home's existing use) |
| This week's scorecard | `prediction_track_record.recent[]`, filtered to the week **if** items carry a resolution date; otherwise show the overall line only (Brier + N resolved) and flag it | **B10**: a resolved-at date on `recent[]`, or a per-week aggregate |
| Next week's watchlist | `watch[]` | none |
| Signup | `SubscribeCard` at the end of the weekly edition only | — |

### 6.5 Map snapshot: recommendation

**A lightweight client-rendered 2D SVG, not a static image.** Reasons:
- There is no image pipeline; a static image would be new backend work.
- It reuses the same Equal-Earth path code and bundled topology as the home 2D map (shared module, cached once).
- It stays accessible (the SVG carries `<title>`, and the list below is the twin).
- Its cost is only the 2D map chunk, about 40 kB gzip of topology plus d3-geo, which briefings shares with Home.

Specification:
- `EditionMapSnapshot` in `features/map/components/`, rendered non-interactively.
- Size: 280×150 (rail), or full width × 180 on mobile.
- The dark panel uses the map tokens. One dot per edition item with a place, in the axis hue (situation-joined
  items use their centroid; others use the country centroid). There are no labels, glow tiers or motion.
- The whole snapshot is one link: `aria-label="Open these 8 stories on the map"` → `/?edition=daily/2026-09-12`.
- Caption: `8 stories · 11 countries` (computed).
- It renders inside a fixed-size box, with a `--map-bg` block reserved while loading, so there is no shift.
- An edition with no placeable items gets no snapshot and a caption "No mappable items in this edition".

### 6.6 Empty and fallback behaviour

- **Requested edition missing:** show the **latest available** edition in full, with an amber note directly under
  the stamp: "**Latest edition: Sep 12.** Today's is not yet published." For a specific missing date:
  "No edition for Sep 13. Showing the latest (Sep 12)." It is never a dead end (X-10).
- **No edition ever available** (all fail): "No briefing is available right now. Our generation pipeline is
  delayed." Then a link "See what we're watching on the map →" (`/`). Honest and empty, with one onward link.
- **Loading:** fixed-height skeleton for the header (96px) and the first two sections.

### 6.7 Archive strip

- **Daily:** the last 14 days, one row of date chips. `●` means an edition exists (link), `○` means none (not a
  link, `aria-disabled`), and the current edition is outlined. **Weekly:** the last 8 weeks.
- **Data now:** the frontend does not know which dates exist without asking. **Interim:** probe backwards from
  the current date with `daily_brief(date)`, sequentially, stopping after 14 dates, through the de-duplicated
  proxy (§8) and cached in sessionStorage. This is acceptable because the archive strip is below the edition and
  loads after it. **B11 (backend):** an editions index (`daily_brief_index` → dateKeys with status), which also
  powers prev/next without probing.

### 6.8 Links and signup

- Every item has `Read story →` (`threadPath`) and `Show on map →` (`homeStoryPath`), only when their key exists
  (§6.4).
- Signup: the weekly edition ends with `SubscribeCard`. The daily edition ends with a one-line "Get the weekly
  brief (free) →" link to `/briefings/weekly#subscribe`, keeping "Get the brief (free)" separate from membership
  "Join" (proposal §4.3).

### 6.9 Weekly wireframe (mobile)

```
┌───────────────────────────┐
│ BRIEFINGS                 │
│ [ Daily ] [▣ Weekly ]     │
│ ‹ Aug 30   WEEK OF SEP 6  ›│
│ Published Sep 6, 06:00 UTC│
│ covers Sep 6–12 · ~3 min  │
│ ⚠ Latest edition: week of │
│   Sep 6; Sep 13 not yet   │
│ ┌───────────────────────┐ │
│ │ (edition map, 6 dots) │ │
│ └───────────────────────┘ │
│ 6 stories · 7 countries → │
│ The week's signals, ranked│
│ THE WEEK  (paragraph, B9) │
│ SIGNALS                   │
│ ● HIGH  UN raises ethnic… │
│   fact · so what          │
│   Read story · Show on map│
│ WHAT WE CORRECTED · 4 →   │
│ SCORECARD Brier 0.154/122 │
│ NEXT WEEK'S WATCHLIST     │
│ [ Subscribe: free ]       │
│ ARCHIVE ◂ Sep6 Aug30 … ▸  │
└───────────────────────────┘
```

---

## §7 Visual system

### 7.1 Tokens

Existing tokens used: `--paper/-2/-3`, `--card`, `--ink/-mid/-dim/-faint`, `--line/-2/-3`, `--accent`, `--risk-*`
and `--risk-*-soft` (tier chips via the `.risk-pill` class), `--amber` (delayed), `--serif/--sans/--mono`, the
text scale, `--r-*`, `--space-*`, `--ease/--fast/--base`, `--nav-h`.

**New tokens, added to `tokens.css` (moved from `SituationHome.css` `--sh-*`, not invented):**

```css
/* Map instrument panel (dark, framed inside the light page) */
--map-bg: #0d1017;  --map-panel: #141a24;  --map-panel-2: #10151f;  --map-line: #232c3a;
--map-land: #18202c; --map-land-line: #28324a;
--map-ink: #dfe6f2;  --map-ink-mid: #8b96a8;  --map-ink-dim: #7c879a;   /* ≥4.5:1 on --map-bg (ledger) */
/* Axis hues: marks on dark (normalised oklch .70/.155) */
--axis-conflict: #ee7754; --axis-political: #9b8cf8; --axis-economic: #38b6e0; --axis-humanitarian: #d89e28;
/* Axis ink: the same hues darkened for TEXT on --paper/--card (target ≥4.5:1; verify with the contrast
   checker in the build, values below are starting points: oklch .48 at same hue/chroma-clamped) */
--axis-conflict-ink: #b0452a; --axis-political-ink: #5f4fc4; --axis-economic-ink: #1f6f8f; --axis-humanitarian-ink: #8a5f0c;
/* Home layout reservations */
--home-lede-h: 64px; --home-bar-h: 40px; --home-pane-head-h: 36px;
```

The `-ink` axis values are starting points that **must be contrast-verified** (axe in `npm run verify` /
smoke-test) before merge. The `oklch(0.70…)` hues are too light for text on paper, so on light surfaces they are
used only as marks (shape dots, 3px selection bars) and always paired with a word.

### 7.2 Type scale

| Element | Style |
|---|---|
| Lede band | `--serif` 20px/1.35, weight 500, `--ink` (18px on mobile) |
| Status bar | `--mono` 12px figures, `--sans` 12px labels, `--ink-mid` |
| Pane header | `.label` (mono 11px, 0.16em, uppercase), `--ink-dim` on light and `--map-ink-mid` on dark |
| List group header | `.label`, plus the count in `--ink` |
| Item headline | `--sans` 15px/1.35, weight 600, `--ink` |
| Item kicker, evidence | `--mono` 11px / `--sans` 12px, `--ink-dim` |
| Card body | `--sans` 14px/1.55, `--ink-mid` |
| Card section labels | `.label` |
| Callout title | `--sans` 15px, weight 600, `--map-ink` (existing) |
| Briefings H1 | `--serif` 36px (desktop) / 28px (mobile), existing Daily/Weekly style |
| Briefings body | 16px/1.6 |

### 7.3 Dark panel inside the light page

- A 1px `--line-2` outer border, `--r-xl` radius, and the inner top highlight. There is no drop shadow (it would
  read as a modal).
- The map and list panes share the same top edge and height, so the eye reads one stage with two instruments.
- No gradient bleeds onto the paper. The dark ends at the border.
- The stale treatment (`filter: saturate(.3) brightness(.85)`, existing) applies to **the map panel only**, never
  the page. The list gets the stale header copy instead of a filter.

### 7.4 New and changed components, with their folders

These follow the eslint dependency rule: app → features → shared. `shared` must not import `features`. Features
may import other features, which is already done today.

| Component / module | Folder | Notes |
|---|---|---|
| `HomePage.jsx` (+ `HomePage.css`) | `features/home/` | New page, replaces `Home.jsx` at `/` in H5 and replaces `SituationHome` at `/map` from H1 |
| `HomeStage`, `PaneHeader`, `PaneToggle` (mobile tablist) | `features/home/components/` | Layout and ⤢ |
| `StoryList`, `StoryListItem`, `StoryCard`, `StoryListGroup`, `StoryFilters` | `features/home/components/` | §4 |
| `WorldStatusBar` | `features/home/components/` | §3.4, uses shared `FreshnessStamp` |
| `TrustStrip` | `features/home/components/` | Extracted from `Home.jsx` unchanged, plus a Brier-with-N card |
| `LedeBand` | `features/home/components/` (existing) | Fed by `composeHomeLede` |
| `buildStoryIndex.js`, `composeHomeLede.js`, `storyKey.js`, `axisDisplay.js` (WORLD_MODEL §3 mapping) | `features/home/lib/` | Pure and unit-tested |
| `useHomeState`, `useStoryIndex`, `useStoryArcs`, `SelectionOriginContext` | `features/home/hooks/` | §5 |
| `MapPane` | `features/map/components/` | Hosts map, controls, banner, alert stack, callout, legend; chooses 2D or globe |
| `SituationMap` (2D, upgraded; named d3-* imports) | `features/map/components/` | Default renderer |
| `SituationMap3D` (globe only after H3) | `features/map/components/` | Lazy |
| `MapCallout`, `MapLegend`, `AlertStack`, `FirstVisitBanner`, `MapModeMenu` | `features/map/components/` | Extracted from `SituationHome`/`SituationMap3D` |
| `EditionMapSnapshot` | `features/map/components/` | Used by briefings |
| `useMapAlerts` | `features/map/hooks/` | Union of alerts and situations (§3.3) |
| `geo2d.js` (projection, topology, centroid helpers shared by 2D map and snapshot) | `features/map/lib/` | Replaces duplicated topology setup |
| `BriefingsPage`, `EditionHeader`, `DailyEdition`, `WeeklyEdition`, `ArchiveStrip` | `features/briefings/` (new) | `features/daily` and `features/weekly-brief` hooks move here. The old pages become redirects |
| `useEdition`, `useEditionIndex` | `features/briefings/hooks/` | Probe interim (§6.7) |
| `FreshnessStamp` | `shared/ui/` | Used by Home, briefings, and later sitewide (X-2) |
| `freshness.js` (thresholds, state, `fmtAgo`, `fmtUtcTime`) | `shared/lib/` | One place, fixes the future-time bug class |
| `TimelineStrip` (30-day tick strip) | `shared/ui/` | Used by home items and the story page |
| `AxisMark` (shape + hue + word) | `shared/ui/` | Hue values come from tokens only |
| `Skeleton` (block / lines, fixed height) | `shared/ui/` | The first skeleton primitive in the codebase (X-4) |
| `homePath.js` (`homeStoryPath`) | `shared/lib/` | Deep-link contract |
| in-flight de-dupe | `shared/api/restProxy.js` | §8 |

**Retired with H5:** `SituationHome.jsx` (logic moves into `MapPane` and `HomePage`), the Home region-grouped
topic list, the three AI buttons on home cards, the coffee rail, `StatusStrip label="LIVE"` on Home, and the
driver.js auto-start on `/`.

---

## §8 Performance plan

**Loading order for `/`:**

1. **Route chunk** (`HomePage`, list, status bar, lede, trust strip) comes from route-level `React.lazy` in
   `App.jsx` (Stage 0, X-7). Firebase Auth leaves the critical path: it initializes after first paint, because
   Home content is public (never auth-gated).
2. **Parallel data at mount:** `world/latest.json` (CDN, small) and `topics` (proxy; until B1 ships this is the
   heavy one). The list renders from whichever arrives first. The watched group can render from the world bundle
   alone, and the news group from topics alone. The join refines in place without reordering what is already
   visible: the join only adds place and tier to items that exist.
3. **2D map chunk** (`SituationMap` + `geo2d` + topology; target about 60 kB gzip total) is imported with
   `React.lazy` but **kicked off at mount in parallel** (`import()` preload), because the map is above the fold.
   It renders into the pre-sized pane. It never blocks the list's paint because they are separate Suspense
   boundaries.
4. **Globe chunk** (deck.gl, 261 kB gzip measured) loads **only** when the Globe is pressed or stored as the
   preference. When stored, it loads after the 2D map has painted, and 2D shows meanwhile (no blank map).
   Hover-intent prefetch on the Globe button is allowed (`onPointerEnter` → `import()`).
5. **After idle** (`requestIdleCallback`, 2s timeout): `archive_range(30)` for arc badges (until B3),
   `useTrackRecord` + `useCorrectionsFeed` for the trust strip, and `list_alerts`. The trust strip sits below the
   fold, so its data can wait.
6. **On expand only:** `narrative_thread`, `prediction_snapshot`, the situation state object.

**Zero layout shift:**
- Lede band has a fixed 64px reservation (`min-height`, 2-line clamp). The status bar has a fixed 40px.
- The stage height is fixed by formula before any data arrives.
- List skeleton: 6 rows of fixed 88px item skeletons under a group header skeleton.
- Map pane: the dark panel with an outline-only world silhouette (an inline 2 kB SVG path) and the text
  "Loading map…".
- The banner is an overlay. Alert stack and callout are absolutely positioned inside the map.
- Arc badges reserve their line with a 10px-tall empty strip space when `arc` is pending and the item is known to
  have a thread. When the data resolves to ≤1 event, the line **stays** as the source line (outlets) instead of
  collapsing, because the evidence row is always present for news items.
- Trust strip cards have a fixed min-height, and the section renders only when data is present **below the
  fold**, so its appearance cannot shift content above the viewport.
- The target is CLS < 0.05 on `/` (today 0.32, per review C-19).

**Requests and de-dupe:**
- `restProxy.js`: add an in-flight map keyed `action + stableStringify(payload)` → shared promise, released on
  settle, plus an optional 60s memo for idempotent public reads (`topics`, `prediction_track_record`,
  `corrections_feed`, `archive_range`). This is a few lines (Stage 0, X-6). The concurrency limiter stays.
- `useGeminiTopics` is called once, by `useStoryIndex`, and passed down. Nothing else on Home calls it. The
  `IntelligenceLoader`'s independent topics fetch must not mount on `/` (X-6).
- CDN reads (`worldData.js`) keep `AbortController`. Add `If-None-Match` using the last ETag on the 5-minute
  visible-tab poll (MAP plan WS3 intent).

**Budget (targets; measured at build by comparing `docs/assets` sizes in the verify step):**

| Asset | Today (measured) | Target |
|---|---|---|
| JS needed to paint `/` (main + home route chunk) | 422 kB gzip (1.30 MB main, all routes) | ≤ 200 kB gzip |
| 2D map chunk incl. topology | n/a (full `d3` in main) | ≤ 60 kB gzip |
| Globe chunk | 261 kB gzip | unchanged; on demand only |
| Data before first list paint | `topics` (~500 kB per review) + world | ≤ 60 kB after B1; until then, topics as-is but fetched once |
| CLS `/` | 0.32 | < 0.05 |
| LCP element | — | the lede text (serif, fonts preconnected; `font-display: swap` already set) |

---

## §9 Accessibility plan

### 9.1 The list is the twin

Every map fact is in the list: place, tier, axis, state, escalation and freshness. Every map action is in the
list or its card: select, fly (`Show on map`), open the official report, read the story, and step prev/next.
Tier and axis are always **words** as well as colour and shape. The `sh-fold-index` crawlable index is
superseded, because the list itself is real HTML at the top of the page.

### 9.2 Map keyboard support: yes to the container, no to per-marker

- **Why no per-marker tab stops:** with dozens of markers the tab order becomes geographic noise, a spatial order
  that doesn't match reading order. Markers can also overlap, which makes focus rings ambiguous. The list already
  offers the same items in a meaningful order (importance). WCAG 2.1.1 is satisfied because every function is
  keyboard-operable through the list, plus `[` / `]` stepping inside the map.
- **Container support:** one tab stop with `role="region"`, `aria-label="Situation map"`, and
  `aria-describedby` → a visually hidden hint: "Arrow keys pan, plus and minus zoom, 0 resets, brackets step
  through stories. The story list has the same content."
- The SVG gets `<title>` "Map of N monitored situations"; decorative layers get `aria-hidden`.
- A **skip link**, "Skip map, go to the story list", sits before the map region.

### 9.3 Live regions

- **Alert stack:** a container with `role="region" aria-label="Alerts"` holding an `aria-live="polite"
  aria-atomic="false"` list. On the **first render nothing is announced** (initial items are inserted before
  the live attribute is enabled, and the region is mounted with `aria-live="off"` and flipped after mount). Later
  poll additions announce "New alert: India — tropical cyclone, elevated." Dismissals are not announced.
- **Selection from the map:** one shared visually-hidden `aria-live="polite"` node announces "Selected: <title>.
  Details open in the story list." It is used for map, alert and bracket-key selections only (list clicks are
  already announced through `aria-expanded`).
- **Status bar:** `role="status"` without live polling announcements. It updates silently, because announcing
  every 5-minute poll would be noise.

### 9.4 Card expand and focus

This is the disclosure pattern (`aria-expanded`, `aria-controls`, the card `id`). The card is a `region`
labelled by its headline. Focus rules are in §5.5. Esc collapses and returns focus. There is no focus trap,
because the card is inline and not modal.

### 9.5 Contrast

- Light surfaces use `--ink`, `--ink-mid` and `--ink-dim` for text. **`--ink-faint` is never used for
  information**, only for zero-count figures that are also stated elsewhere (review C-13 names this pairing).
  Axis text uses the `-ink` variants (§7.1), which are verified at 4.5:1 or better.
- Dark surfaces use `--map-ink` and `--map-ink-mid`, and `--map-ink-dim` at a minimum (4.6:1 per ledger).
- Tier chips use the `.risk-pill` pairs, which must be verified. The elevated and moderate pairs are the risk,
  since amber on soft amber is often below 4.5:1. The fix is at token level if needed.

### 9.6 Reduced motion

`prefers-reduced-motion: reduce` → no pulses (static rings), no fly-to (jump), no pane width transitions, no
smooth scroll, no skeleton shimmer (static blocks), and the banner has no slide-in. This is a single
`useReducedMotion()` in `shared/hooks/` plus a CSS media block in each new stylesheet (C-15).

### 9.7 Tap targets and landmarks

- Tap targets are 44×44px minimum for every control: ⤢, Globe, Key, +/−, alert rows and ×, filter chips, the
  toggle, the peek, and the archive chips (padding extends the hit area where the visual is smaller). This is
  above the brief's 40px floor.
- Landmarks: one `<main>` (the page), `<h1>` = the visually hidden "Global Perspectives: world situation and
  stories" (the lede is a `<p>`, not an H1). Each pane is an `<section aria-labelledby>` with its header as
  `<h2>`. List groups are `<h3>`. This avoids X-8's duplicate `main`.

---

## §10 Build phases

Each phase is its own branch, gated by `npm run verify`, browser-verified at 1440 and 390 (per
`feedback_test_ui_in_browser`), and deployed only on an explicit yes. Everything before H5 ships **behind the
unlisted `/map` route** (as the existing map did), so it is reversible and doesn't touch `/`.

| Phase | Scope | Depends on | Ship now? |
|---|---|---|---|
| **H0 · Foundations** | `restProxy` in-flight de-dupe; route-level `React.lazy`; `shared/lib/freshness.js` + `FreshnessStamp`; map and axis tokens in `tokens.css`; `Skeleton`; `useReducedMotion`; `homeStoryPath`; stop driver.js auto-start on `/` and `/map` | none (these are Stage-0 items) | **Yes** |
| **H1 · Split + list + linked selection** | `HomePage` at `/map` (replaces `SituationHome`): lede (`composeHomeLede`), status bar, split and ⤢ views, mobile toggle, `buildStoryIndex` (topics + world, threadId join, country fallback, monitoring items, developments), level-1 items, filters and sort, `useHomeState` URL model with `focus`→`story` rewrite, map on the existing deck.gl flat (lazy, skeleton), compact callout, peek | H0 | **Yes.** Content will be thin and stale (DeepSeek), and the design's honesty states are exactly what shows this |
| **H2 · Story card** | level-2 in-place card: lazy `narrative_thread`, `prediction_snapshot`, track-record footnote, sources, monitoring variant, skeleton; level-3 links | H1 | **Yes.** Summaries will be 11 days old until funded, shown with their dates |
| **H3 · Map pane patterns** | 2D SVG renderer at parity (shapes, pulse rules, selection arcs and fill, country fallback fill, callout projection, ⌘-scroll zoom, keyboard pan and step) → deck.gl becomes globe-only; alert stack (+ `useMapAlerts`, `gp_alerts_seen`); first-visit banner (3 variants); remove the tour; legend update (shapes) | H1 | **Yes** |
| **H4 · /briefings** | `features/briefings`: routes, tabs, edition header, prev/next with probe index, daily and weekly anatomy **with the interim data only**, edition map snapshot, archive strip, latest-edition fallback, signup placement; `/daily`, `/weekly-brief` → SPA redirects | H0, plus H3's `geo2d` for the snapshot (or ship the snapshot a phase later) | **Yes.** It is independent of the S6 gate (the §8 adjudication agreed the merge) |
| **H5 · S6 swap** | `/` → `HomePage`; `/map` → `/` (keep params); `/breaking` → `/`; `BreakingDetailPage` link; trust strip and signup below the fold; retire old Home pieces; Worker: 301s (`/map?focus=`→`/?story=`, `/daily*`, `/weekly-brief`) and pre-render of `/` from `world/latest.json`; smoke-test and link-crawl | **S6 gate:** DeepSeek funded → about 7 days at ≥5 open situations across ≥2 axes; plus the Stage-0 Worker SEO fix | **No, gated** |
| **H6 · Backend-enabled upgrades** | B1 slim list projection · B2 story-map at the edge · B3 thread arc index (badges at first paint, drop `archive_range`) · B4 thread tier and 4-axis · B5–B11 edition fields and index · the Country-risk map mode | each item's backend change | As each lands |

**What depends on DeepSeek funding:** fresh topics (the whole "In the news" group), story summaries, forecasts on
new stories, daily editions, news-axis situations (the map's density), and therefore the S6 gate. **What doesn't:**
H0–H4 code, GDACS monitoring items, the honesty states, the weekly edition's existing signals, and the track
record.

---

## §11 Open questions and risks

1. **The list will lead with 11-day-old stories until DeepSeek is funded.** The design shows this honestly (the
   group header "last updated Sep 13", the stale banner variant, the dated lede clause). But until the gate
   passes, `/map` (H1–H3) is the proving ground, which is why H5 is gated. *Operator:* confirm that H1–H4 may
   deploy to the unlisted `/map` and to `/briefings` while stale.
2. **Most stories will highlight a country, not a pin** (the matcher is at about 35%, and 0 of 17 topics join the
   1 live situation today). The map will look like "country fills plus a few dots". This is honest, but it's a
   different look from the approved map design. *Decision needed:* is the country fill (18% alpha) acceptable
   as the dominant state, or should unmatched stories show **no** map change until selected? My recommendation:
   **fill on selection only; no ambient fills**. This is what §3.2 specifies, since the fallback appears only
   for the selected story.
3. **No tier for in-the-news stories** (B4 missing). The list's top group is ranked by tier, the second by outlet
   count, so two different orderings sit on one page. This is the honest choice (WORLD_MODEL D2), and the
   group headers make it explicit. The risk is that readers read group order as importance order.
4. **The WORLD_MODEL §3 axis mapping for the five lossy categories is still NEEDS-OPERATOR-REVIEW.** The list's
   axis chips and shapes depend on it for unmatched stories.
5. **Nested scroll on the desktop list pane.** Trackpad users can scroll-trap inside the pane.
   `overscroll-behavior: contain` limits the chaining. The pane's bottom edge shows a fade and a "More below ↓"
   hint. If testing shows confusion, the fallback is the `view=list` behaviour (page scroll) at all widths, with
   a sticky map. I'd rather test the pane first.
6. **Removing the tour and the ambient hero callout** reverses two S5.5 design-port decisions. I think the
   side-by-side list makes both redundant. *Operator:* confirm.
7. **Ticker: decided NO.** It duplicates the list and the alert stack, it adds perpetual motion (WCAG 2.2.2
   requires pause/stop, and Plague Inc's ticker works because the game has no list), and with 1–5 situations it
   would loop the same line. On mobile Map view, the peek card does the ticker's job. Revisit only if the list
   is ever hidden by default.
8. **Briefings data gaps (B5–B11)** mean H4 ships a daily edition without likelihood and confidence badges and
   without "Read story" links, and a weekly edition without the paragraph and weekly scorecard. The anatomy is
   built to fill in without layout change. Any section without data is omitted, never faked.
9. **Probe-based edition index** (§6.7) costs up to 14 small proxy calls per briefings visit, sequential, after
   the edition paints. That is acceptable at today's traffic but should be retired by B11.
10. **deck.gl flat → SVG flat parity (H3)** is the biggest single frontend task. If it slips, H5 can still ship
    on lazy deck.gl flat, meeting the "never block first paint" rule, at a 261 kB gzip cost paid after paint on
    every home visit, including mobile.
11. **SEO for `/` after the swap** depends on the Worker pre-render reading `world/latest.json` (S6·T1) and the
    list being real HTML. Until the Stage-0 Worker fix, every non-`/` route (including `/briefings`) is a 404 to
    crawlers (X-3).
12. **The "Summary renders nothing" report** (review B1, unreproduced) touches the same `summary` content the
    card no longer calls. The card uses `narrative_thread` summaries instead, which may sidestep it, but the
    signed-in repro should still happen before H2.

**References borrowed and why:**
- Civ VI notification stack (right edge, click jumps to location), for the alert stack
  ([Game UI Database](https://www.gameuidatabase.com/gameData.php?id=639),
  [gamepressure](https://guides.gamepressure.com/sidmeierscivilization6/guide.asp?ID=37562)). Its right-click
  dismiss conflict is the reason our × is explicit
  ([CivFanatics](https://forums.civfanatics.com/threads/right-clicking.659074/)).
- Hearts of Iron IV map modes (exclusive lenses on one base map), for §3.5.
- DEFCON's minimal dark vector world with light-source events, for restraint (already the map's "world at night"
  treatment).
- Plague Inc's news ticker was considered and rejected (§11.7).
- Liveuamap's map with a companion news feed, where feed items jump to the map and map points lead to the news,
  with filters by type, location and time: this is the closest real-world precedent for the linked split and
  filters ([Bellingcat toolkit: Liveuamap](https://bellingcat.gitbook.io/toolkit/more/all-tools/liveuamap),
  [liveuamap.com](https://liveuamap.com/)). ACLED lists Liveuamap as a local data-collection partner
  ([ACLED](https://acleddata.com/research-local-data-collection-partner/live-universal-awareness-map)). We
  differ deliberately: our list is ranked by importance and corroboration, not a reverse-chronological
  firehose.

---

## §12 Debate + monitor adjudication (2026-09-24)

Two Sonnet critics reviewed this design: `HOME_MAP_BRIEFINGS_CRITIC1_READER.md` (reader, accessibility, brand) and `HOME_MAP_BRIEFINGS_CRITIC2_ENGINEERING.md` (build cost, performance, data truth). The monitor verified the disputed facts before ruling. **These rulings override the sections above where they conflict.**

### Fact corrections
- **The daily briefs exist; Critic 2's "daily_brief returns null for every date" is FALSE.** `DAILY_BRIEF#` records exist for 2026-09-05 → 09-12 (113 in total), and the API returns them when called with the real request shape (`{action, payload:{dateKey}}`). Critic 2 (and the monitor's first curl) sent `dateKey` at the top level, so the backend fell back to today's date. **The real bug:** `useDailyBrief.js` only looks back 7 days, and the outage is now 11+ days long, so `/daily`'s fallback never reaches the last real brief. This was handed to Stage-0 item (i). Consequence: the Daily tab of `/briefings` CAN ship with real content (it shows the latest edition, honestly labelled).
- **Data claims otherwise verified** (1 situation, `threadId: null`; 17 topics, all with a `threadId`, 11 days old; main chunk 422 kB gzip; deck.gl 261 kB gzip).
- **Stage-0 overlap:** request de-dupe (restProxy), route lazy-loading and the freshness helper are **owned by the in-flight Stage-0 fixes** (the de-dupe is already landing). H0 shrinks to: map tokens + contrast verification, fixed-height skeletons, and exposing `story-map.json`.

### Rulings

**Engineering (all AGREE):**
1. **No SVG map rewrite.** Ship the existing deck.gl flat map, lazy-loaded, through H5. The lightweight SVG map moves to H6+ at the earliest; it would redo the map programme's hard-won projection, callout and legibility fixes for little gain.
2. **Expose `threads/story-map.json` at the edge in H0/H1**, pulled forward from H6. It already exists and only 404s at the Worker's `/data` whitelist. It is the one cheap step that raises map↔story join coverage. It rides the operator-gated Worker deploy (checklist Y4).
3. **Suppress the fly-to animation on back/forward (POP) navigation.**
4. **Honest estimates:** H1 is ~1.5–2 weeks for one developer + agents. The "≤200 kB first paint" target stays an *estimate* until Stage-0 lazy-loading lands and is measured.
5. **Skeletons must match content height** (e.g. no 3-row timeline skeleton for a 1-event story), otherwise the card expansion shifts layout.

**Reader (all AGREE, some modified):**
6. **The status bar uses words, not a row of glyphs.** Inline labels, e.g. "Watching: 1 elevated · Conflict 0 · Humanitarian 1 · Map updated 12 min ago". The ⓘ popover stays for detail only.
7. **One story list, not three groups (MODIFY).** Show a single list ordered by importance: stories with a real severity tier first (by tier), then the rest by outlet count. "On the map" becomes a **badge on each item**, not a group. Stories with no place sit last under a small "Developments" divider. This removes the near-empty top-group problem (live data: 0–1 watched vs 17 in the news).
8. **Say the country fallback once**, in the list header or legend ("Stories without a live situation highlight their country on the map"), not as a "(country)" tag on every row.
9. **Skip link now:** a "Skip past the story list" link at the top of the list pane (keyboard trap fix). Keep `overscroll-behavior: contain` for trackpads.
10. **Axis-ink contrast verified before merge**, on the light page AND on the dark map panel, as part of H0 acceptance.
11. **Rename "Key judgments" to "What's moving"** in the Daily edition until the backend provides likelihood + confidence (B6). Restore the analyst label only when scored bullets exist.
12. **Story card actions have a hierarchy:** "Read full story" is primary; "Show on map", "Analyze in Studio" and "Follow" are secondary.
13. **The first-visit banner gains one orientation clause** (what the list is, what the map is, and how they connect), replacing the orientation the removed tour provided.
14. **The alert stack's "+N more" uses risk/axis tokens,** not a generic notification red (avoid game-HUD drift).

**Upheld from the design:** no ticker; flat 2D map by default with the globe on demand; URL as the single source of selection; client-built story view-model as the interim; `/briefings` tabs as routes; never a dead-end edition.

### Still needs the operator
- **(a) Tour + ambient hero callout removal:** both critics and the designer favour replacing them with the orientation banner.
- **(b) Country-highlight fallback acceptable** while only ~35% of stories join to a situation (it improves once `story-map.json` is exposed).
- **(c) H1–H4 may ship behind the unlisted `/map` route while content is stale.** Recommended: yes. They're invisible to the public until the S6 swap, and they let the build proceed during the outage.
