# 66. The public board shows judged links, their direction and strength, and what moved lately

Status: accepted (operator, chat, 2026-11-20: "ok that looks better and you can do it"); being built, not live. The code on `main` does not carry it yet. Amends 0058 steps 5 and 6 and its section "What the theme page and the index show"; refines the preset naming of 0054; follows 0012, 0013, 0058, 0064.
Date: 2026-11-20

## Context
- The operator said the board reads as generic: every dot and line is one blue, and nothing says which pin or which connection differs from another.
- A team of three agents (planner, designer, tester reading cold) worked in three rounds on a mock built from real data. The papers are local, not in git: `.board/reviews/board-look-2026-11-20/` (`BUILD.md`, `3-planner.md`, `3-designer.md`, `3-tester.md`, `mock-r3.html`). The operator saw the merged proposal and answered with the quote above.
- Why the old board read as generic, found by the tester and the designer:
  - A link we judged (one story feeds into another) and two stories that only share a name were drawn as the same dashed blue line. They are different things (0012: shared facts are not links).
  - One blue carried four meanings: the link colour, "ours", the selected tab and the button.
  - Nothing marked change: no sign of which story took a new step or began lately.
  - The legend listed six line styles, and a region board showed only one of them.
- The public theme data is ready. `index/themes.json` is a public file; each theme carries its stories and its own directed links (`from`, `to`, `strength`, `reason`), checked by the planner on 2026-11-20 (theme 1: 8 stories, 7 links, 2 medium and 5 weak).
- Lag is not usable. The same pair has different lags in different country webs, and 13 of 47 lags are negative. One example in the mock ran the other way from the steps its link cites.

## Decision
The centre sentence of a board: "A board shows which stories we judge feed into others, which way, how strongly, and which moved lately." The seven points below were all accepted as the planner recommended them.
1. The public boards are built from the six live themes (`themes.json`, public). The region boards stay as a second list lower on the page. Nothing is removed.
2. Stories that only share a name are shown as a dotted text note, "not a judged link", never as a line.
3. The sentence list is the first view. The graph stays behind "Show as a diagram". The Map stays.
4. No lag is shown until the back end defines what it measures.
5. The region boards are retitled "Stories touching <Region>" (a change to the `newsBoard` preset name only; the rule of 0054, a story counts in every region its countries fall in, is unchanged).
6. The "How serious" chip stays, small. It tells stories apart on a theme board and does not on a region board where every story is high.
7. Direction in a member's own board is later. It changes the board schema and `newsBoard`, because a string is stored as one pair `a < b`. Signed-in members' boards keep working as today.

Change is shown for every reader. The box at the top says "This week" on a first visit and "Since your last visit" on a later one. The last-visit date lives only in the reader's browser (`localStorage` in try/catch; the page works without it).

## Not decided here
- Direction in members' own boards (point 7), and how a stored string would carry it.
- A history of link changes and of stories that left a board. It needs a stored copy of the earlier board.
- What lag means. The back end must first say why lags are negative and differ by country web.
- The phone page length (about four screens for 8 stories) and the crowded arc ends at the busiest card.

## Consequences
- Front-end work only for points 1 to 3: the public theme file already has stories and directed links. The preset path, which loses direction, is not used for the public theme boards. Point 5 is a one-line change in `backend/board/newsBoard/src/presets.js`.
- 0058 step 5 (`newsBoard` presets read the theme and region files and drop their own grouping code) is not needed for the public theme boards, because the browser reads `themes.json`. Step 6 is taken over by this record: the index and board layout it describes are replaced by the themes list first and the region boards second. 0058 steps 7 to 9 are not touched.
- `ARCHITECTURE_BOARD.md` describes the board as the code has it today and says this record is being built; it changes when the build is live.
- The release needs a fresh yes (CLAUDE.md).

Source: `.board/reviews/board-look-2026-11-20/` (local, not in git): `BUILD.md`, `3-planner.md`, `3-designer.md`, `3-tester.md`; public `record/views/index/themes.json` and `index/web.json` read 2026-11-20 by the planner.
