# board

The member's personal connection board (`/board`). A signed-in reader pins stories, countries and actors, drags one pin
onto another to ask whether they connect, keeps or cuts strings, and writes one line per string. It is the **board**
of the three names in `project-docs/architecture/ARCHITECTURE_RECORD.md` §0; it never writes the record or the weekly.

## Status
- Slice 1, live 2026-10-20: `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. Without that key
  (local builds, or a config that lacks it) the page says "The board is not available yet." and shows no Board link.
- Slice 1 uses only data that exists: thread analyses, the story web, daily scores. Every string of ours is drawn dashed
  and labelled INFERENCE; nothing is shown as confirmed. Branch status, the tree, arrivals and the board's weekly wait
  for the record (`project-docs/plans/PLAN_2026-10-20_board.md`, "Waits for the record").

## Routes
- `/board` → the newest board (or the empty state with presets); `/board/:boardId` → that board. Built from `ROUTE.board`
  and `boardHref()` in `@/shared/lib/links.js`.
- The Board link sits in the account area (`app/layout/Layout.jsx`), shown only to a signed-in, non-guest user when
  `boardAvailable()` is true.

## Frontend
- `BoardPage.jsx` — header (inline rename, board switcher, New board, From preset, pin budget n / 12), graph, side sheet
  (bottom sheet on phones), pin and string lists for keyboard and screen-reader use; `board.css` (tokens only).
- `components/BoardGraph.jsx` — SVG graph: pins on a fixed circle ordered by kind then id; strings drawn by
  `stringTexture` (dashed = ours inferred, dashed-alt = yours, faint = cut). Drag a pin onto another (pointer captured
  only after a 6px move), or select two pins and press `c` / Connect.
- `components/VerdictCard.jsx` — the `connect` result: strength word, grounds (actor, place, outlet with "coverage
  artefact possible", co-movement with lag and "one pairing is not a pattern"), `limits[]`, the honest none; Keep string
  (optional line ≤ 280) or Dismiss.
- `components/StringDetail.jsx` (cut sets `cutAt`, never deletes; Restore clears it), `AddPinPanel.jsx` (followed
  threads and actors, today's topics, countries; disabled at the budget), `PresetsPanel.jsx` (region presets, fork),
  `MissingCard.jsx` (actors on 2+ of your pins that you do not follow).
- Hooks: `useBoards`, `useBoard` (debounced `update_board`, then shows the server's normalised board), `useFollows`,
  `usePresets`, `usePinInfo` (titles from topics / presets / thread analysis; risk from presets or analysis),
  `useMember` (signed-in, non-guest).
- `lib/boardApi.js` — the one call path: `boardAction` from `@/shared/api/restProxy.js` when `BOARD_ENDPOINT` is set;
  in a dev build only, the in-memory fake `dev/fakeBoardApi.js` (dynamic import behind `import.meta.env.DEV`, absent from
  production chunks). `?devBoard=1` in a dev build acts as a signed-in member for local testing.
- `lib/boardOps.js` — pure board edits (add/remove pin, keep/cut/restore string) on top of `@/shared/lib/board.js`.
- Public API (`index.js`): `boardAvailable`.

## Backend
`newsBoard` (`backend/board/newsBoard/`, Function URL, Firebase JWT): `list_boards`, `get_board`, `create_board`,
`update_board`, `delete_board`, `get_follows`, `follow_thread`, `unfollow_thread`, `follow_actor`, `unfollow_actor`,
`list_presets` (public), `fork_preset`, `connect`. Board shape: `backend/board/schema/board.schema.json`.

## Shared
`@/shared/lib/board.js` (pairKey, normalizeActor, stringTexture, PIN_BUDGET; mirrors `backend/shared/src/record.js`,
checked by `scripts/check-shared-sync.mjs`), `@/shared/lib/links.js`, `@/shared/lib/countries.js`, `@/shared/api/restProxy.js`
(`boardAction`, `boardConfigured`), `@/shared/data/useGeminiTopics.js`, `ClaimTag`, `TierChip`, tokens.
Imports from other features: none.

## Data
- `useBoards()` -> `list_boards`; `useBoard(boardId)` -> `get_board`, edits through `update_board` (debounced 600 ms); `useFollows()`
  -> `get_follows` and the four follow actions; `usePresets()` -> `list_presets` (public, no token). No local cache: boards are
  the member's own mutable data and always come from the server.
- `usePinInfo` reads titles and risk from today's topics (`useGeminiTopics`), preset pins, or `thread_analysis` through the
  read proxy.

## Pipeline
1. Existing writers feed it: `newsThreadAnalysis` (`THREAD_ANALYSIS`, `THREAD_HISTORY#`), `newsSystemsAnalysis` (`WEB#INDEX`),
   `newsCountryIntelligence` (`HISTORY#`), the agent Lambda (`NewsCache latest`).
2. `newsBoard` (on demand) reads them for presets and `connect`, and owns `GlobalPerspectiveSavedItems` items `board#<id>` and
   `GlobalPerspectiveUserPrefs` fields `followedThreads`, `followedActors`.
3. `BoardPage` renders the board; nothing else reads it. Later, the record (`record/`) feeds lines, branch status and arrivals.

## Docs
- Generated reference: [features.md#board](../../../../../project-docs/reference/features.md#board)
- Plan and stages: [PLAN_2026-10-20_board.md](../../../../../project-docs/plans/PLAN_2026-10-20_board.md)
- Architecture: [ARCHITECTURE_RECORD.md](../../../../../project-docs/architecture/ARCHITECTURE_RECORD.md) (§0 three names, §2 ownership)
- Backend: [newsBoard README](../../../../../backend/board/newsBoard/README.md), [schema](../../../../../backend/board/schema/board.schema.json)

## How to check it
- `npx vitest run src/features/board` — `boardOps.test.js`, `BoardGraph.test.jsx`, `BoardPage.test.jsx` (29 tests).
- Browser (2026-10-20, dev fake, 1440 wide): presets and fork, drag-connect, keyboard connect, keep with and without a
  line, dismiss, cut, rename, add pin (actor, country, story) up to 12 / 12, switch boards, delete board; no console
  errors. Phone (390 wide, in an iframe): no sideways scroll, graph scrolls in its container, connect opens the bottom
  sheet. Not tested in a browser: signed-out and not-available views (unit-tested), the What is missing follow,
  co-movement grounds, touch drag on a device.

Last verified: 2026-10-20
