# Story page + story board — Design Brief

**Status:** concept approved by the operator on 2026-09-25; three layout decisions still open (see below). Wireframe:
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

## Open decisions (flip the toggles on the wireframe)
| # | Question | Recommended | Alternative |
|---|---|---|---|
| 1 | Dossier layout | One scroll + pinned jump menu (skim everything, Ctrl+F works) | Tabs (shorter, hides sections) |
| 2 | Colour | Dark console + a READING MODE (light) switch | Dark only |
| 3 | Board default view | BOARD (status columns) | TABLE |

## Caveats
- Statuses and web links on the wireframe are illustrative. `[brackets]` mark data the backend doesn't provide yet.
- The ESCALATING status shown for the AfD story is illustrative, not computed.
