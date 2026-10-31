# board

The member's personal connection board (`/board`). A signed-in reader pins stories, countries and actors, drags one pin onto another to ask whether they connect, keeps or cuts strings, and writes one line per string. It is the **board** of the three names in `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6; it never writes the record or the weekly.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the board page (/board). Timeline: reads boards via newsBoard and the record views (stories, links, counts) through the Worker; reading fields fill as the weekly review runs. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live. `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. Without that key (local builds, or a
  config that lacks it) the page says "The board is not available yet." and shows no Board link.
- Record views are read straight from `/data/record/views/` with no sign-in. Anything not generated yet (404) reads as an
  honest empty state, not an error.

## Routes
- `/board` -> the newest board (or the empty state with presets); `/board/:boardId` -> that board. Built from `ROUTE.board`
  and `boardHref()` in `@/shared/lib/links.js`. The page is noindex.
- The Board link sits in the account area (`app/layout/Layout.jsx`), shown only to a signed-in, non-guest user when
  `boardAvailable()` is true.

## Frontend
- `BoardPage.jsx` - header (inline rename, board switcher, New board, From preset, pin budget n / 12), graph, side sheet
  (bottom sheet on phones), pin and string lists for keyboard and screen-reader use; `board.css` (tokens only).
- `components/BoardGraph.jsx` - SVG graph: pins on a fixed circle ordered by kind then id; strings drawn by `stringTexture`
  (dashed = ours inferred, dashed-alt = yours, faint = cut). Drag a pin onto another, or select two pins and press `c` / Connect.
- `VerdictCard` (the `connect` result: strength word, grounds, `limits[]`, the honest none; Keep string with an optional
  line up to 280, or Dismiss), `StringDetail` (cut sets `cutAt`, never deletes; Restore clears it), `AddPinPanel`,
  `PresetsPanel` (region presets, fork), `MissingCard` (actors on 2+ of your pins that you do not follow).
- Record panels: `RecordPinDetails` (index-row line and counts), `StoryTree` (zoom: line, chapters, forks and events, one event),
  `BoardWeekly` ("This week on your board": moved pins, changed strings, branch outcomes and confirmed links of the last
  7 days), `UnsettledZone` ("This week, unsettled": counts only), `ArrivalsTray` (new stories linked to your pins).
- Hooks: `useBoards`, `useBoard` (debounced `update_board`, then shows the server's normalised board), `useFollows`,
  `usePresets`, `usePinInfo`, `useMember` (signed-in, non-guest), `useStoryViews`, `useWeekCounts`.
- `lib/boardApi.js` - the one call path: `boardAction` from `@/shared/api/restProxy.js` when `BOARD_ENDPOINT` is set; in a dev
  build only, the in-memory fake `dev/fakeBoardApi.js` (dynamic import behind `import.meta.env.DEV`). `?devBoard=1` acts as a
  signed-in member. `lib/boardOps.js` (pure pin and string edits), `lib/recordViews.js` (the shared view reader `shared/api/recordViews.js` with the board's dev fixtures, ISO-week helpers),
  `lib/recordProjection.js` (`boardWeek`, `sumCounts`), `lib/recordText.js`.
- Branch status is worded only by `@/shared/lib/branchWording.js` from the branch's verdict and due date (open, happened with the
  evidence quote, not reported by the due date, could not be checked, recorded before scoring began). A "no" is a claim about
  our coverage, never "did not happen".
- Public API (`index.js`): `boardAvailable`.

## Backend
`newsBoard` (`backend/board/newsBoard/`, Function URL, Firebase JWT) actions: `list_boards`, `get_board`, `arrivals`,
`visit_board`, `create_board`, `update_board`, `delete_board`, `get_follows`, `follow_thread`, `unfollow_thread`,
`follow_actor`, `unfollow_actor`, `list_presets` (public), `fork_preset`, `connect`. Board shape:
`backend/board/schema/board.schema.json`. Shared: `@/shared/lib/board.js` (pairKey, stringTexture, PIN_BUDGET; mirrors
`backend/shared/src/record.js`, checked by `scripts/check-shared-sync.mjs`), `links.js`, `countries.js`, `restProxy.js`
(`boardAction`, `boardConfigured`), `useGeminiTopics`, `ClaimTag`, tokens. Imports from other features: none.

## Data
- Boards: `useBoards` -> `list_boards`; `useBoard(boardId)` -> `get_board`, edits through `update_board` (debounced 600 ms);
  `useFollows` -> `get_follows` and the follow actions; `usePresets` -> `list_presets`. No local cache: boards are the
  member's own data and always come from the server.
- Record views (decision 0037): `useStoryViews` fetches `stories/<id>.json` and `links/<id>.json` for each pinned story (an
  alias story view fetches its survivor); `useWeekCounts` fetches `counts/<date>.json` for the current ISO week (UTC) and,
  when the last visit is at most 31 days back, the days since. Non-404 failures go to the error sink.
- Reading fields (pin line, story line, chapters) exist only after the story's weekly review; until then they are not shown.
- `usePinInfo` reads titles from today's topics, preset pins, or thread analysis through the read proxy.

## Pipeline
1. `newsStoryRecord` builds `record/views/` from facts; the Worker serves `/data/record/views/`; the weekly review fills readings.
2. `newsBoard` (on demand) reads the world store and record views for presets, `connect` and `arrivals`, and owns
   `GlobalPerspectiveSavedItems` items `board#<id>` and `GlobalPerspectiveUserPrefs` fields `followedThreads`, `followedActors`.
3. `BoardPage` renders the board; nothing else reads it.

## Docs
- Design: [ARCHITECTURE_BOARD.md](../../../../../project-docs/architecture/ARCHITECTURE_BOARD.md),
  [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md); decision [0037](../../../../../project-docs/decisions/0037-views-from-facts.md)
- Backend: [newsBoard README](../../../../../backend/board/newsBoard/README.md), [schema](../../../../../backend/board/schema/board.schema.json)

## How to check it
- `npx vitest run src/features/board` - `boardOps.test.js`, `BoardGraph.test.jsx`, `BoardPage.test.jsx`, `recordViews.test.jsx`, `ArrivalsTray.test.jsx`.
- Dev fakes: `?devBoard=1` for boards; add `&devRecord=1` (or open `/board/dev-record`) to serve `dev/recordViews/`; `devRecord=missing`
  shows the not-generated paths.
- Browser: presets and fork, drag-connect, keyboard connect, keep and dismiss, cut, rename, add pin up to 12, switch and delete
  boards; on a phone the connect result opens the bottom sheet.
