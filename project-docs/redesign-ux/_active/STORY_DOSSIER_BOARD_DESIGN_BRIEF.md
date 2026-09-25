# Story page + story board — Design Brief

**Status:** the frontend design was approved by the operator on 2026-09-25 ("the frontend looks good"), so the
wireframe is the reference for the build. The layout decisions are recorded below. The connection to the home/map is
proposed and under discussion. Wireframe:
https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW, row 3 ("v3"). The sources are also in
`_reference/wireframe-2026-09-24/Dossier.dc.html` and `Board.dc.html`. This page uses the same console style as the home
(`HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md`, round 2).

## Concept (approved)
### Story page becomes the "Story dossier"
Modelled on Recorded Future's Intelligence Card.
- **Header:** a HUD strip (type, status, risk tier + the four axis bars, counts, honest "updated X ago"), then the headline
  and "the news" line. Actions: Follow, Analyze in Studio, Copy briefing.
- **At a glance:** bottom line + where it's heading, a mini radar locator (links to the console with the story selected),
  and an activity strip with the TURNING POINT marked.
- **Sections:**
  1. Timeline (with the turning point)
  2. **Why it's happening: the causal web** (see the spider merge below)
  3. Who's involved (actor cards)
  4. The view from (coverage by outlet country and type, from `sources[].outletCountry` / `outletType`)
  5. What to watch (live forecast checklist + track record)
  6. Other ways this could go (scenarios)
  7. Market impact
  8. What changed
  9. Sources and related stories
- **Right rail:** risk scorecard (an axis with no signal shows "no signal", never 0) and at-a-glance facts.
- **Archived state:** stories older than the 90-day window.

### Story board becomes the "Intel board"
- **Status per story** (CrisisWatch-style): ▲ escalating / ● new / ◆ steady / ▼ cooling. It is derived deterministically
  from TrendBadge + activity + driftNote; no LLM.
- **Four views:** BOARD (status columns), TABLE (sortable), MAP (the same flat map as the console's radar mode), and WEB
  (see below). Type chips filter all four.

## Spider page merged in (operator idea, 2026-09-25)
`/spider-demo` becomes part of these two pages and retires once both ship:
- **Dossier section 2** is the spider lane web for one story.
  - Lanes: conflict / diplomacy / energy / economy / politics / other.
  - A solid dot is a ✅ fact (backbone, from our sources); a dashed ring is a 💭 inference.
  - Click a dot to see which it is, with its source or confidence.
  - Edges: solid for causal chains from the analysis, dashed for inferred or "possibly related".
  - Data: `dossier_analysis` (public) + `systems_analysis`, the same hooks SpiderDemo uses.
- **Board WEB view** is the spider World tier: bubbles sized by risk, dashed links labelled with the shared country,
  actor or market. The wording is always "possibly related", **never "caused"**.

## Layout decisions (operator, 2026-09-25): the wireframe as shown
| # | Question | Decided | Not chosen |
|---|---|---|---|
| 1 | Dossier layout | **One scroll + a pinned jump menu** (skim everything, Ctrl+F works) | Tabs |
| 2 | Colour | **Dark console + a READING MODE (light) switch**, remembered per reader | Dark only |
| 3 | Board default view | **BOARD** (status columns); TABLE / MAP / WEB one click away, view kept in the URL | Table first |

## Connection to the home/map console (PROPOSED, in discussion)
**Principle: one job per page.** The console answers *what is happening now*. The board answers *everything we're
tracking* (90-day inventory). The dossier answers *everything about one story*. All three share one URL contract, one
status vocabulary and one set of building blocks, so moving between them never loses your place.

### Journeys
| From | Action | Goes to |
|---|---|---|
| Console: Intel feed row or map pin | click | Selects it; the **story card** opens in place (the preview), and the globe turns to it or the radar holds it lit |
| Console: story card | "Open dossier →" | `/story/:id` |
| Dossier: radar locator / "Show on console" | click | `/?story=:id&view=radar` (the console, story selected) |
| Dossier: back | browser back | The console or board exactly as left (selection and view live in the URL) |
| Board: any card / row / pin / bubble | click | `/story/:id` |
| Board: "Show on console" (per card) | click | `/?story=:id` |
| Console header: STORIES | click | `/stories?view=board` |
| Briefings item | "Read story" / "Show on map" | `/story/:id` / `/?story=:id` |

### What the console's story card shows (a strict subset of the dossier, same components)
The HUD strip (type · status · tier + 4 axis bars · updated X ago) → headline → bottom line → a mini timeline with the
turning point → a live-forecast line → [Open dossier →] [Analyze in Studio →]. No sections beyond that. Depth lives
in the dossier, and the card is its preview, never a second copy.

### Shared across all three (build once in `src/shared/ui` or a `stories` feature)
- **One status vocabulary:** ▲ escalating / ● new / ◆ steady / ▼ cooling, from one deterministic function. It is used
  by board columns, console feed rows and pins (pulse **only** for ▲ and ● under 24h, per the home brief), and the
  dossier HUD.
- **One flat map component:** the console's RADAR 2D map = the board's MAP view (the board shows all 90 days and
  filters; the console shows today + live situations). One projection, one pin style.
- **One HUD strip + axis-bar component:** dossier header = console story card header = board card meta.
- **Honest freshness:** the same "updated X ago / news desk paused" source as the console's Sensor status.

### Where the spider web shows on the console (proposal)
When a story is selected on the console, draw **dashed "possibly related" arcs** to its related stories: the same
links as the board's WEB view. The arc-layer idea comes from `LEGACY_MAP_IDEA_HARVEST_2026-09-24.md` §1 (the arc layer
already exists off by default on `/map`). Labels say why (shared country / actor / market), never "caused". Off when
nothing is selected, to keep the console calm.

### Open questions for the operator
1. Console pin click: open the story card first (**recommended**, keeps the reader on the console) or jump straight to
   the dossier?
2. Show related-story arcs on the console when a story is selected (**recommended**), or keep the web only on the board
   and dossier?
3. Keep the board's MAP view (**recommended**: it's the 90-day inventory, while the console is only "now") or drop it and
   link to the console instead?

## Build notes
- Routes: `/story/:id` (C6 rename + 301s via the Worker), `/stories` (board). `/weekly/thread/:id` and the old board
  redirect. `/spider-demo` retires after dossier section 2 + the board WEB view ship.
- Data: thread analysis (timeline, actors, axis scores, sources with outletCountry/outletType), prediction cache (what
  to watch), drift notes (what changed), `dossier_analysis` + `systems_analysis` (causal web), economy links (markets).
  No new pipeline; the only new logic is the deterministic status function.

## Caveats
- Statuses and web links on the wireframe are illustrative. `[brackets]` mark data the backend doesn't provide yet.
- The ESCALATING status shown for the AfD story is illustrative, not computed.
