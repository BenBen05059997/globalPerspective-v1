# board

The member's personal connection board (`/board`). A signed-in reader pins stories, countries and actors, drags one pin onto another to ask whether they connect, keeps or cuts strings, and writes one line per string. It is the **board** of the three names in `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6; it never writes the record or the weekly.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the board page (/board). Timeline: reads boards via newsBoard and the record views (stories, links, counts) through the Worker; reading fields fill as the weekly review runs. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. Without that key (local builds, or a config that lacks it) the page says "The board is not available yet." and shows no Board link. In a dev build the in-memory fake stands in, so the page is always available there.
- Wave 1 of the canvas build (artboards 1, 3, 4, 5, 6, 8, 10, 11, 12) is merged on main and has been looked at in Chrome on the dev harness at desktop width. Phone width has not been checked in a browser. None of wave 1 is released to the live site yet; that needs the operator's yes.
- Not built (second wave): the map view (artboard 2), the alerts UI (9) and the summary and monthly (7). The Map / Graph switch in the top bar shows only in dev builds, and the Map side says "The map view is not built yet (dev harness only)." Design status per artboard: `project-docs/architecture/ARCHITECTURE_BOARD.md` §10 and §11.
- Record views are read straight from `/data/record/views/` with no sign-in. Anything not generated yet (404) reads as an honest empty state, not an error. An element with no data is absent, never a placeholder.

## Routes
- `/board` opens the newest board (or the empty state with presets); `/board/:boardId` opens that board. Built from `ROUTE.board` and `boardHref()` in `@/shared/lib/links.js`; both routes lazy-load `BoardPage` in `app/App.jsx`. The page is noindex.
- The Board link sits in the account area (`app/layout/Layout.jsx`), shown only to a signed-in, non-guest user when `boardAvailable()` is true.
- Signed out, the page shows one line with a sign-in link and the region presets with "Sign in to fork".

## Frontend
### Page
`BoardPage.jsx` owns the state (open panel, selected pins, connect results, notice, view) and lays out, top to bottom: `BoardTopBar`, the board switcher (a chip per board, New board, From preset), the toolbar (Connect, hint, Delete board with a confirm), then `board-main`: the canvas column (graph, `DueStrip`, the story tree for an open story pin on desktop, `WeekScrubber`, the folded strings and pins lists) beside a right rail (the side sheet, `BoardWeekly`, `RailBranches`, `MissingCard`, `DivergencePanel`). Under that: `ArrivalsTray`, `UnsettledZone` and a "How the board folds" disclosure holding `FoldingRules`. On a phone the sheet is a `BottomSheet` and the story tree opens inside it. Styles: `board.css` (page, graph, top bar, rail, due strip, scrubber), `panels.css` (verdict, weekly, arrivals), `storyTree.css` (tree and zoom ladder), `presets.css` (presets, pin budget, divergence, folding); tokens only.

### Components (`components/`)
- `BoardTopBar` - "Studio board" eyebrow, the board name (click to rename, Enter saves, Esc cancels, 80 characters), the Map / Graph switch (only when there is more than one view, so dev only), `PinBudget`, "Saving", "Week ending D Mon YYYY" (the ISO-week Sunday), and the + Add pin button.
- `PinBudget` - "Pin budget n / 12" with one segment per slot.
- `BoardGraph` - the graph in plain SVG (1080 by 660). Pin cards: a crisis-type dot and type line ("New this week" for a story born in the last seven days, else crisis type and kind), title, our line, counts, risk as a tier chip with "was N". Pins sit on an ellipse with joined pins adjacent (`layoutPins`). Strings are drawn by `stringTexture` (dashed = ours inferred, dashed-alt = yours, faint = cut, solid = ours once confirmed) and line width follows strength (weak, medium, strong); each string has a label placed clear of the pins and of other labels (`placeLabels`, which falls back to a short tag). A legend band above the graph keys strong, medium, weak, inferred, yours and cut. Also drawn when the data exists: suggested pins ("Suggested · Not followed") with strings to the pins that touch the actor, "Combination failed" strings from this session's connect tests, and a fog panel "No coverage D Mon" when `board.coverage.gaps` exists. Drag a pin onto another (mouse), or select two (click, Enter, Space; the only way on touch) and use Connect or press `c`.
- `WeekScrubber` - a range over the kept week-ending dates, with a note line; absent with fewer than two weeks. It currently only sets the week shown in the top bar; the graph is not replayed.
- `DueStrip` - "Due on your board": up to four open branches of pinned stories with a due date, nearest first, with date, our percentage and "past due" for an open branch past its date. Absent with none.
- `RailBranches` - the open branches of the newest fork of up to two pinned stories, with our percentage, the trigger and a MODEL JUDGMENT tag.
- `BoardWeekly` - "Your board moved - week ending D Mon" when something changed (counts of pins moved, strings changed, new links), otherwise "This week on your board". Sections, each absent when empty: pins that moved, strings that changed (kept or cut, OURS or YOURS), branch outcomes, and "New link we found" cards with Add pin and Dismiss when the other story is not already pinned. Facts and readings of the last seven days only.
- `MissingCard` - "What is missing": actors on two or more of your pins that you do not follow, with Add pin and Follow. Built from this session's connect results.
- `DivergencePanel` - "Where you differ from us", private: strings you cut (Restore?), your branch weights beside ours per open fork (writes `board.weights`, 0 to 100), lines you wrote. Absent when there is no difference.
- `VerdictCard` - the connect result. Verdict word and strength badge with an OURS badge, the server's note, "Joint trace" (via `JointTrace`) when the co-movement ground carries dated moves, otherwise the plain "Scores moved together" line, "Who sits in both" chips (actors and places, one chip per name), "Evidence" (dated headlines of shared outlets from the pinned stories' record views), the limits, "Your line" (up to 280), Keep string (or Replace with my string), Export as memo (copies a plain-text memo) and Drop it. The honest none ("No link found") is shown as returned. No mechanism sentence, direction, "what follows if" or "what would break it": those need a model.
- `JointTrace` - both pins' score moves on a shared date axis with the lag bracketed. Absent when the reply carries no dated moves (the live `connect` does not return them yet).
- `StringBadges` - `OursBadge` and `StrengthBadge`, shared by the verdict, weekly and arrivals panels.
- `StringDetail` - one string: who drew it, its line or mechanism, Cut string (sets `cutAt`, never deletes) or Restore string.
- `AddPinPanel` - search of today's stories and countries plus followed stories and actors; the 12-pin budget is a hard stop with a message.
- `PresetsPanel` - region presets as cards: OURS - READ-ONLY tag, a mini picture of the pins and strings (`MiniGraph`), pin and string counts, Fork (members) or Sign in to fork. One group, "By region".
- `RecordPinDetails` - the pin's line and counts in the folded pin list.
- `StoryTree` - the zoom ladder for one pinned story: 1 the line, 2 chapters, 3 forks and events (the drawn tree, the trunk list, fork and branch rows), 4 one event (summary, sources, branches drawn that day, link to the story page). Rungs 1 and 2 exist only after the weekly review read the story; rung 3 opens first when there is no line. Older trunk events fold into one button. Full width under the graph on desktop, in the bottom sheet on a phone.
- `StoryTreeDrawing` - the SVG of rung 3: dated trunk, the present line (the day the facts run to), one dashed line per open branch whose width is its percentage, late flag, key. Scored branches are not drawn as stubs; they stay in the lists, worded by `branchWording`.
- `ArrivalsTray` - "Clue pool": new stories linked to your pins as face-down cards with "Turn over"; a turned card shows the via lines with mechanism and direction, Keep story and Dismiss arrival (the dismissed card fades). The header counts unseen cards.
- `UnsettledZone` - "This week, unsettled": counts only (new entries, branches due, verdicts) for the pinned stories, plus new entries since the last visit.
- `FoldingRules` - the "How the board folds" sheet: what folds, what is written when, three promises, borrowed from. Thresholds come from `lib/folding.js`.

### Hooks (`hooks/`)
`useBoards` (list, create, fork, remove), `useBoard` (one board by id; `edit(fn)` applies at once and saves through `update_board` debounced 600 ms, then shows the server's normalised board; a rejected save puts the server copy back and says why), `useFollows` (followed threads and actors, follow and unfollow), `usePresets` (public `list_presets`), `usePinInfo` (titles, risk and category for pins), `useMember` (signed-in, non-guest; in a dev build `?devBoard=1` acts as a member), `useStoryViews` (story and links views of the pinned threads), `useWeekCounts` (counts for the current ISO week in UTC and the days since the last visit when that is at most 31 days).

### Lib (`lib/`)
- `boardApi.js` - the one call path: `boardAction` from `@/shared/api/restProxy.js` when `BOARD_ENDPOINT` is set; in a dev build only, the in-memory fake (a dynamic import behind `import.meta.env.DEV`, so production chunks drop it).
- `boardOps.js` - pure pin and string edits (`addPin`, `removePin`, `keepString`, `cutString`, `restoreString`), `layoutPins`, `ghostPosition`, `placeLabels`, `failedCombos`, `missingActors`, `pinLabel`, `countryName`, `KIND_WORD`, `MAX_LINE`, `MAX_NAME`.
- `graphText.js` - the words on pin cards and string labels; nothing is worded that the data does not hold.
- `storyTree.js` - present day, late and open tests, fork outcome counts, chapter scoping, trunk folding.
- `divergence.js` - strings cut by you, lines written by you, fork weights, `setWeight`.
- `folding.js` - the fold thresholds (28 days, 20 percent, 5 arrivals) and `isOldNode`, `isDeadBranch`, `strongestArrivals`. The sheet reads the numbers; the helpers are tested but no view calls them yet (the tree folds by keeping its last four events, and the server caps arrivals at 5).
- `panelParts.js` - `evidenceRows` and `verdictMemo`.
- `recordViews.js` - the shared view reader `shared/api/recordViews.js` with the board's dev fixtures, plus ISO-week helpers (`isoWeekStart`, `isoWeekEnd`, `weekMonday`, `datesBetween`).
- `recordProjection.js` - `boardWeek`, `sumCounts`, `isoWeekOf`. `recordText.js` - the "recovered from public records" labels (decision 0040).
- Branch status is worded only by `@/shared/lib/branchWording.js` from the branch's verdict and due date (open, happened with the evidence quote, not reported by the due date, could not be checked, recorded before scoring began). A "no" is a claim about our coverage, never "did not happen".
- Public API (`index.js`): `boardAvailable`.

## Backend
`newsBoard` (`backend/board/newsBoard/`, Function URL, Firebase JWT) actions: `list_boards`, `get_board`, `arrivals`, `visit_board`, `create_board`, `update_board`, `delete_board`, `get_follows`, `follow_thread`, `unfollow_thread`, `follow_actor`, `unfollow_actor`, `list_presets` (public), `fork_preset`, `connect`. Board shape: `backend/board/schema/board.schema.json`. Shared: `@/shared/lib/board.js` (pairKey, stringTexture, PIN_BUDGET; mirrors `backend/shared/src/record.js`, checked by `scripts/check-shared-sync.mjs`), `links.js`, `countries.js`, `restProxy.js` (`boardAction`, `boardConfigured`), `useGeminiTopics`, `ClaimTag`, `branchWording.js`, tokens. Imports from other features: none.

## Data
- Boards: `useBoards` -> `list_boards`; `useBoard(boardId)` -> `get_board`, edits through `update_board`; `useFollows` -> `get_follows` and the follow actions; `usePresets` -> `list_presets`. No local cache: boards are the member's own data and always come from the server.
- What the live `get_board` adds to each pin from the record index (`newsBoard/src/recordViews.js`): `recordAvailable`, `line`, `born`, `entryCount`, `counts` (only `liveBranches` is filled; `chapters` and `confirmedLinks` are null), `lastMoved`. The live feed does not carry `risk`, `riskWas`, `category` or `board.coverage`, so on the live site the risk number comes from thread analysis (`usePinInfo`), the crisis dot from today's topics, and "was N", the fog and the week scrubber are absent.
- Record views (decision 0037): `useStoryViews` fetches `stories/<id>.json` and `links/<id>.json` for each pinned story; `useWeekCounts` fetches `counts/<date>.json`. Non-404 failures go to the error sink.
- Reading fields (pin line, story line, chapters) exist only after the story's weekly review; until then they are not shown.
- `usePinInfo` reads titles from today's topics, preset pins, or thread analysis through the read proxy.

## Pipeline
1. `newsStoryRecord` builds `record/views/` from facts; the Worker serves `/data/record/views/`; the weekly review fills readings.
2. `newsBoard` (on demand) reads the world store and record views for presets, `connect` and `arrivals`, and owns `GlobalPerspectiveSavedItems` items `board#<id>` and `GlobalPerspectiveUserPrefs` fields `followedThreads`, `followedActors`.
3. `BoardPage` renders the board; nothing else reads it.

## Docs
- Design: [ARCHITECTURE_BOARD.md](../../../../../project-docs/architecture/ARCHITECTURE_BOARD.md), [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md); decision [0037](../../../../../project-docs/decisions/0037-views-from-facts.md)
- Backend: [newsBoard README](../../../../../backend/board/newsBoard/README.md), [schema](../../../../../backend/board/schema/board.schema.json)

## Dev harness (dev builds only; absent from production chunks)
All fakes live in `dev/` and are reached by a dynamic import behind `import.meta.env.DEV`.
- `/board?devBoard=1` - acts as a signed-in member against the in-memory fake `dev/fakeBoardApi.js` (state in sessionStorage). Boards start empty; presets are built from today's topics.
- `/board?devBoard=1&devRecord=1` - also serves the record-view fixtures in `dev/recordViews/` and seeds two boards. The newest, "Gulf and the Horn" (`dev/devGraphBoard.js`, id `dev-graph`), opens first.
- `/board/dev-graph?devBoard=1&devRecord=1` - "Gulf and the Horn" shows every element of the graph (artboard 1): pins of each kind with crisis type, risk, "was 95" on the USA pin, a line, counts and a story born this week; strings of every strength and owner (a medium not-confirmed, a strong, a weak, yours with a line, yours cut, an inferred); the fog for a day with no coverage; the week scrubber with five weeks. Connect "Ship attacks near Hormuz" with "Trump's Russia sanctions pause" (they share "Oil price") for a suggested pin, and "Sudan gold-mine airstrikes" with "Albanian protests" for a "Combination failed" string.
- `/board/dev-record?devBoard=1&devRecord=1` - "Record views example" (three stories from the fixtures, one yours string) shows the record panels: the due strip and rail branches (fixture branches are re-dated to fall within the week), "Your board moved" with a new link (Add pin, Dismiss), the clue pool with three face-down cards, the unsettled counts, the story tree and zoom ladder (open a story pin), and the verdict with who sits in both, evidence, the joint trace, your line and export as memo (connect the first two pins).
- `devRecord=missing` serves nothing, which shows the not-generated empty states.
- Presets, divergence and folding: the preset cards show with `?devBoard=1` ("From preset" or an empty board); the divergence panel shows on `dev-graph` at once for the line you wrote on the Sudan and Ethiopia string, and gains a "Restore?" row when you cut an ours string; on `dev-record` it offers branch weights where a pinned story has open branches with a percentage; the folding sheet is the "How the board folds" disclosure on every board. `dev/divergenceFixture.js` and `dev/panelFixtures.js` feed the tests and the verdict and arrivals fixtures.

## How to check it
- `cd global-perspectives-starter/frontend && npm run verify` (eslint, then vitest). Board tests only: `npx vitest run src/features/board`. Files in `__tests__/`: `boardOps.test.js` (pin and string edits, layout, label placement, missing actors), `BoardGraph.test.jsx`, `GraphParts.test.jsx` (top bar, due strip, rail branches, scrubber, suggested pins, graph words), `BoardPage.test.jsx` (page flows, connect, keep, cut, budget), `StoryTree.test.jsx`, `panels.test.jsx` (verdict, weekly, arrivals), `presetsDivergence.test.jsx`, `recordViews.test.jsx`, `ArrivalsTray.test.jsx`.
- Browser (dev harness above): click every control you touched. Presets and fork, drag-connect, keyboard connect (select two, `c`), keep and dismiss, cut and restore, rename, add pin up to 12, switch and delete boards, the tree zoom ladder, Turn over and Keep story, Export as memo. On a phone the connect result and the story tree open in the bottom sheet; that width is still unchecked.
