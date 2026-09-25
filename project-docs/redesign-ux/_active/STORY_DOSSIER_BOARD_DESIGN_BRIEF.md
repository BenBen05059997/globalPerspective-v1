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
| Console: Intel feed row, map pin or alert | click | Selects it; the **story card** opens in the feed column, and the globe turns to it or the radar holds it lit |
| Console: story card, a linked mention of another story | click | That story's card opens in place, map follows, "← BACK TO …" |
| Console: story card | "Open dossier →" | `/story/:id` |
| Dossier: radar locator / "Show on console" | click | `/?story=:id&view=radar` (the console, story selected) |
| Dossier: back | browser back | The console or board exactly as left (selection and view live in the URL) |
| Board: any card / row / pin / bubble | click | `/story/:id` |
| Board: "Show on console" (per card) | click | `/?story=:id` |
| Console header: STORIES | click | `/stories?view=board` |
| Briefings item | "Read story" / "Show on map" | `/story/:id` / `/?story=:id` |

### The home story card: DECIDED (operator, 2026-09-25)
Clicking an event on the home page (a feed row, map pin or alert) opens its **story card first**. It never jumps
straight to the full story. Wireframe: board "Home — click an event: the story card" (row 3, right).
- **Where:** desktop, in the Intel feed column (the list is replaced by the card, with "← INTEL FEED" to go back). The map
  stays visible and turns to the story. Phone: a bottom sheet (half height, swipe up for full).
- **Order:** header (type · tier · 4 axis scores · updated X ago) → headline → **WHAT'S HAPPENING** (2–3 line summary)
  → **WHAT IT MEANS** (bottom line + the most likely path with its %) → **WHY** (a 2–3 step cause chain from the
  causal web, each step ✅ fact or 💭 inference) → [OPEN FULL STORY →] [ANALYZE].
- **Links into the story:** every block has its own link to the matching dossier section (headline or "Open full story"
  → top; summary → timeline; cause steps → causal web; outlook → other paths; axis header → risk scorecard).
- **Links inside the summary text** (so a reader can click whatever the summary mentions):
  | Mention | Looks like | Click does |
  |---|---|---|
  | An event in this story | dotted underline | Opens the full story at the timeline, that event highlighted |
  | Another story we track | underline in that story's type colour + a dot | Opens **that story's card here**, the map flies to it, "← BACK TO …" returns |
  | An actor or country | faint solid underline | Opens the actor / country page |
  Links are made deterministically: a mention becomes a link only when it matches a real `threadId`, timeline entry or
  known actor. Nothing is linked by guesswork, and an unmatched mention stays plain text.
- **Honesty:** the card is a strict subset of the dossier. A block with no data (no cause chain yet, no forecast) is
  omitted, never filled with placeholder text.

### Shared: story links + the StoryPeek hover preview: DECIDED (operator, 2026-09-25)
Anywhere a story is mentioned (a link in a summary, a map pin, a board card or bubble, a briefing item, a related-story
row), hovering it or focusing it with the keyboard shows the same small **StoryPeek**. This is one shared logic + design,
built once and used everywhere. Wireframe: board "Shared: StoryPeek" (row 3, far right), used live by the home card, the
globe/radar pins and the board MAP/WEB views.

**What the peek shows** (read-only, nothing clickable inside it):
type · place — status/tier → headline → a one-line brief (the story's latest summary line) → counts + honest
"updated X ago" → a hint saying what a click will do ("open its card here" on the home page, "open the full story"
elsewhere). If a field is missing it is left out; the peek is never padded with placeholder text.

**Behaviour:**
- Opens after ~300 ms hover (no flicker while the mouse passes over), instantly on keyboard focus; closes on leave, blur
  or Esc. It must never cover the link it belongs to, and it flips to the side or above near an edge.
- Accessibility: `role="tooltip"` + `aria-describedby` on the link; the link itself stays a normal link/button.
- Phones have no hover: a tap acts directly (on the home page it opens the story card, which is the preview there).
- Reduced motion: no fade or slide animation.

**Code shape (proposed, in `src/shared/ui/story/`):**
| Piece | Job |
|---|---|
| `StoryLink` | Renders a mention (event / other story / actor styles from the card decision above), wires hover/focus → peek, and click → the right action for the surface (passed in as a prop). |
| `StoryPeek` | The preview's look, pure presentational, props only. |
| `usePeek()` | Shared open/close timing, Esc, edge-aware positioning (small in-house helper; no new dependency without a yes). |
| `peekData(story)` | One pure function that turns a story record into the peek's fields, same wording everywhere. |
| `linkMentions(text, known)` | Deterministic: turns a summary string into text + link segments, only for exact matches to real `threadId`s, timeline events or known actors. |

**Data:** the lightweight story records the pages already load (archive_range entries, which already drop AI fields
to stay under the 6 MB limit, plus `world/latest.json` situations). No new endpoint; if a peek needs a field not in
the lightweight record, it's left out rather than fetched per hover.

**Replaces** five separate hand-made hover tooltips found in the code today: `SituationMap.jsx`, `SituationMap3D.jsx`,
`CountryOverviewMap.jsx`, `SpiderWorld.jsx`, and (a different kind, a quality flag) `economy/QualityFlag.jsx`.
The first four move to StoryPeek (or a country-flavoured variant of it). QualityFlag keeps its own content but should
use the same `usePeek()` behaviour.

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
1. ~~Console pin click~~: DECIDED: story card first (above).
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
