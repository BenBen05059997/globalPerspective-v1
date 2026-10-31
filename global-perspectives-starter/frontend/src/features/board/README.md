# board

The member's personal connection board (`/board`). A signed-in reader pins stories, countries and actors, drags one pin onto another to ask whether they connect, keeps or cuts strings, and writes one line per string. It is the **board** of `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6; it never writes the record or the weekly.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the board page (/board). Timeline: reads boards via newsBoard and the record views (stories, links, counts) through the Worker; reading fields fill as the weekly review runs. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. Without that key the page says "The board is not available yet." and shows no Board link; in a dev build the in-memory fake stands in.
- Waves 1 and 2 of the canvas build are merged (artboards 1 to 6, 8 to 12, and the non-model parts of 7) and were checked in Chrome and at 390px on the dev harness: no page-level sideways scroll, the graph and map scroll inside their own box. None of it is released (needs the operator's yes).
- Later: the model-written summary paragraph and "the surprise" (7). The alerts settings (9) show in dev builds only; choices are not stored (the board schema has no field) and nothing sends. Per-artboard status: `ARCHITECTURE_BOARD.md` §10 and §11.
- Record views are read from `/data/record/views/` with no sign-in; a 404 is an honest empty state. An element with no data is absent, never a placeholder.

## Routes
- `/board` opens the newest board (or the empty state with presets); `/board/:boardId` opens that one. `ROUTE.board` and `boardHref()` in `@/shared/lib/links.js`; lazy-loaded in `app/App.jsx`; noindex.
- The Board link sits in the account area (`app/layout/Layout.jsx`) for a signed-in, non-guest user when `boardAvailable()` is true. Signed out, the page shows a sign-in line and the region presets.

## Frontend
`BoardPage.jsx` holds the state and lays out: `BoardTopBar`, board switcher, toolbar (Connect, Delete board), then the canvas (graph, `DueStrip`, story tree on desktop, `WeekScrubber`, folded strings and pins lists) beside a right rail (side sheet, `BoardWeekly`, `RailBranches`, `MissingCard`, `DivergencePanel`); below: `ArrivalsTray`, `UnsettledZone`, "How the board folds". On a phone the sheet and story tree are a `BottomSheet`. Styles: `board.css`, `panels.css`, `storyTree.css`, `presets.css` (tokens only).
- `BoardTopBar` - "Studio board", the name (click to rename), Map / Graph switch, `PinBudget` (n / 12), "Week ending D Mon YYYY" (ISO-week Sunday), + Add pin.
- `BoardGraph` - SVG graph. Pin cards: crisis dot and type line ("New this week" if born in 7 days), title, line, counts, risk tier with "was N". Strings by `stringTexture` (dashed ours inferred, dashed-alt yours, faint cut, solid once confirmed), width by strength, labels placed clear of pins (`placeLabels`), a legend band. Also suggested pins, "Combination failed" strings, and a fog panel for a day with no coverage. Drag a pin onto another, or select two (the touch way) and press Connect or `c`.
- `BoardMap` - the map view (artboard 2): a coastline sketch with a ring per placed pin (weight = risk tier, hue = crisis type) and unfilled arcs for strings (weight = strength, dashed ours, dotted yours); a string label with no clear spot is left out (its title and the string list keep the text). A story sits on the country its entries name most (`lib/mapPlaces.js`) and every other country it touches gets a small mark tied to its ring. Pins with no place (actors, stories naming no country) wait as "No place" chips. On a phone it opens scrolled to its pins. Click a pin or arc for detail; connect only in Graph. `MapRail` - the collapsed rail (week counts, first gap) that opens the full rail.
- `WeekScrubber` - steps through kept week-ending dates; sets the top bar's week only, no replay. `DueStrip` - up to four open branches by due date, "past due" flag. `RailBranches` - open branches of the newest fork of up to two stories.
- `BoardWeekly` - "Your board moved - week ending D Mon": pins moved, strings changed, branch outcomes, "New link we found" (Add pin, Dismiss). `MissingCard` - actors on 2+ pins you do not follow. `DivergencePanel` - private: strings you cut (Restore?), your branch weights vs ours (`board.weights`), lines you wrote.
- `VerdictCard` - verdict, strength and OURS badges, note, `JointTrace` (only with dated moves; absent live), who sits in both, evidence (dated headlines of shared outlets), limits, your line (280), Keep string, Export as memo, Drop it. No mechanism, direction, "what follows if" or falsifier: those need a model.
- `StringBadges`, `StringDetail` (Cut sets `cutAt`, never deletes; Restore), `AddPinPanel` (search and followed items; 12-pin stop), `RecordPinDetails`.
- `PresetsPanel` - region cards: OURS - READ-ONLY tag, mini picture, counts, Fork or Sign in to fork.
- `StoryTree` - zoom ladder: 1 line, 2 chapters (rungs 1 and 2 only after the weekly review), 3 forks and events (`StoryTreeDrawing`: trunk, present line, a dashed line per open branch weighted by percent, late flag; events older than 4 weeks fold into one button), 4 one event (sources, branches drawn that day, story link). Fork due dates read "1 Nov".
- `ArrivalsTray` - "Clue pool": the 5 strongest face-down cards, Turn over, via lines, Keep story, Dismiss (fades). `UnsettledZone` - counts only. `MonthlyCard` - "The monthly" (no model): previous summaries, the arc from stored summaries, strings kept or cut over 30 days, branches settled (ours, yours), what we missed (`coverage.note`), pins quiet 4+ weeks with Retire, next dates; each part absent when empty. `AlertsPanel` - per-pin and per-string alert choices, dev builds only. `FoldingRules` - the fold sheet, numbers from `lib/folding.js`.
- Hooks: `useBoards`, `useBoard` (`edit(fn)` applies at once, saves via `update_board` debounced 600 ms, shows the server's board), `useFollows`, `usePresets`, `usePinInfo`, `useMember` (`?devBoard=1` acts as a member), `useStoryViews`, `useWeekCounts` (ISO week UTC plus days since the last visit, max 31).
- Lib: `boardApi` (one call path: `boardAction`, or the dev fake behind `import.meta.env.DEV`), `boardOps` (pin and string edits, layout, label placement), `graphText`, `mapPlaces`, `monthly`, `alerts`, `storyTree`, `branchView` (the one reading of a branch: question, scenario name, percent), `divergence`, `folding` (28 days, 20 percent, 5 arrivals; `isOldNode`, `strongestArrivals` used by the tree and the clue pool; `isDeadBranch` not yet called), `panelParts`, `recordViews` (shared reader plus ISO-week helpers), `recordProjection`, `recordText`. Branch wording only via `@/shared/lib/branchWording.js`. Public API (`index.js`): `boardAvailable`.

## Backend
`newsBoard` (`backend/board/newsBoard/`, Function URL, Firebase JWT) actions: `list_boards`, `get_board`, `arrivals`, `visit_board`, `create_board`, `update_board`, `delete_board`, `get_follows`, `follow_thread`, `unfollow_thread`, `follow_actor`, `unfollow_actor`, `list_presets` (public), `fork_preset`, `connect`. Shape: `backend/board/schema/board.schema.json`. Shared: `@/shared/lib/board.js` (mirrors `backend/shared/src/record.js`, checked by `scripts/check-shared-sync.mjs`), `links.js`, `countries.js`, `restProxy.js`, `useGeminiTopics`, `ClaimTag`, `branchWording.js`. Imports from other features: none.

## Data
- Boards come from the server (`list_boards`, `get_board`, `update_board`), follows from `get_follows`, presets from `list_presets`; no local cache.
- Live `get_board` adds per pin `recordAvailable`, `line`, `born`, `entryCount`, `counts.liveBranches`, `lastMoved` (`newsBoard/src/recordViews.js`). It lacks `risk`, `riskWas`, `category`, `coverage`; `chapters` and `confirmedLinks` are null. Live risk comes from thread analysis and the crisis dot from today's topics, so "was N", the fog and the scrubber are absent.
- Record views (decision 0037): `stories/<id>.json`, `links/<id>.json`, `counts/<date>.json` through the Worker. Readings (line, chapters) exist only after the story's weekly review. Non-404 failures go to the error sink.

## Pipeline
1. `newsStoryRecord` builds `record/views/`; the Worker serves it; the weekly review fills readings.
2. `newsBoard` (on demand) reads the world store and views for presets, `connect`, `arrivals`; owns `GlobalPerspectiveSavedItems` items `board#<id>` and `GlobalPerspectiveUserPrefs` `followedThreads`, `followedActors`.
3. `BoardPage` renders the board; nothing else reads it.

## Docs
[ARCHITECTURE_BOARD.md](../../../../../project-docs/architecture/ARCHITECTURE_BOARD.md), [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md), decision [0037](../../../../../project-docs/decisions/0037-views-from-facts.md), [newsBoard README](../../../../../backend/board/newsBoard/README.md), [schema](../../../../../backend/board/schema/board.schema.json).

## How to check it
- `cd global-perspectives-starter/frontend && npm run verify`; board only: `npx vitest run src/features/board` (tests in `__tests__/`, one per area: ops, graph, page, tree, panels, presets and divergence, record views, arrivals).
- Dev harness (`dev/`, dev builds only): `/board?devBoard=1` is a member on the in-memory fake; add `&devRecord=1` to serve `dev/recordViews/` (`devRecord=missing` shows the not-generated states). The newest board, "Gulf and the Horn" (`/board/dev-graph?...`), shows every graph element, the map (Map switch) and the monthly (three stored summaries, one pin quiet 35 days): crisis types, risk, "was 95", all string kinds, fog, scrubber. Connect Hormuz with the sanctions pause for a suggested pin, Sudan with Albanian protests for a failed combination. `/board/dev-record?...` shows the record panels: due strip, weekly with a new link, clue pool, unsettled counts, tree and ladder (open a story pin), verdict with joint trace and memo (connect pins 1 and 2).
- Browser: click every control you touched (presets and fork, drag and keyboard connect, keep, dismiss, cut, restore, rename, add up to 12, delete, zoom, Turn over). Phone: sheets open at the bottom (checked at 390px).
