# Home (map + stories) and Briefings — Design Brief

**Status:** operator decisions recorded 2026-09-24; frontend design debate in progress. Builds on
`project-docs/architecture/PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` §8 (the adjudication: keep S6
map-as-home, no new composed "Today" page, `/briefings` merge yes, `/world` merge no, "story" is
the public unit of news) and `PAGE_REVIEW_2026-09-24.md` (the findings this design must not repeat).

## Operator decisions (binding)

### Home: one page, map + story list, linked selection
1. **Desktop: both views side by side** (map + story list), **each pane expandable to full width**
   (⤢), with one click back to the split. **Mobile: a [Map | List] toggle.**
2. **Linked selection in both directions.** Selecting a story in the list → the map flies to it,
   pulses the spot, and opens its callout. Selecting a spot on the map → the list scrolls to the
   story, highlights it, and expands it. The selection lives in the URL (`/?story=<id>&view=…`),
   so toggling, refresh, sharing and the back button all keep it. Join key: `threadId`, already
   present on map situations and home topics.
3. **Honest fallbacks** (the matcher links only ~35% of stories to a situation today): a story
   with no situation highlights its **country** ("no live situation — country shown"); a
   situation with no story (e.g. a GDACS disaster) appears in the list as a monitoring-only item
   linking to its official report.
4. **Open on the map** (after the S6 gate: DeepSeek funded, then ~7 days at ≥5 open situations
   across ≥2 types), with a **slim, dismissible first-visit banner** explaining what the reader
   is looking at. The banner states plainly when data is stale. It never blocks navigation.
5. **Game-inspired map, readability not gamification:**
   - incident markers: icon by type, glow by severity, pulse only for new/escalating (<24h);
   - an alert stack on the map edge (Civilization-style), click → fly there; this replaces the
     separate `/breaking` page;
   - an optional news ticker (Plague Inc-style), pause on hover, static under reduced motion;
   - a top "world status" bar with counts by severity/type and an honest
     "updated X ago · next in Y" (replaces the false LIVE badge);
   - map modes (layer toggles): situations / country risk / markets (connections later).
   No points, no dramatic effects.
6. **Stories inside the news, progressive disclosure:**
   (1) scan: every news headline in the list; items belonging to a larger story carry a badge
   "Story · N events over M days" with a tiny timeline strip; (2) understand: clicking expands a
   **story card in place** (what's happening, latest change, mini timeline, severity tier + 4 axis
   scores, live forecast + track-record score), and the map follows; (3) go deep: "Read full
   story →" (story page) and "Analyze in Studio →".
7. **Page order:** lede band → map + list → (alert stack lives on the map) → trust strip
   (forecast score + corrections) → newsletter signup.

### Briefings: `/briefings`, editions
- **[Daily | Weekly] tabs.** Every edition is dated, finite, and readable in about 3 minutes.
- **Header:** the real publication date + period covered, previous/next arrows that skip empty
  days, and a **small map snapshot** of the edition's incidents (click → home map filtered to
  them). Missing edition → show the latest, clearly labelled ("Latest edition: Sep 12 — today's
  not yet published"). Never a dead end.
- **Daily edition:** the big picture (3 sentences) → key judgments (3–5 bullets, each with a
  likelihood + confidence, in the Studio's analyst format) → by region → watch today (deadlines,
  scheduled events) → markets in one line (→ /economy).
- **Weekly edition:** the week in one paragraph → signals ranked by risk → **what we corrected
  this week** (drift notes) → **this week's scorecard** (resolved forecasts, hits/misses) → next
  week's watchlist.
- **Every item links to** "Read story" and **"Show on map"** (deep link to the home map with that
  story selected). The weekly email signup sits at the end of the weekly edition, plus an
  archive strip.

## Constraints the design must respect (from the review)
- Light editorial is the site's visual system; the dark map is framed as a panel within it.
- Performance: the deck.gl globe chunk is ~943 kB. With map-as-home it must never block the first
  paint of the page shell / story list.
- Accessibility: the story list is the accessible twin of the map (every map action is
  reachable from the list by keyboard); honour prefers-reduced-motion; tap targets ≥ 40px;
  contrast via tokens.
- Freshness honesty everywhere; no fabricated timestamps.
- Tokens only (`src/shared/styles/tokens.css`), no new hard-coded palettes; no layout shift.
- The frontend is feature-foldered: `src/app`, `src/shared`, `src/features/<name>`, with an
  eslint dependency rule (app → features → shared).
