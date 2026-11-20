# The board

Design of the personal connection board (`/board`, `backend/board/`, `global-perspectives-starter/frontend/src/features/board/`). Code and live AWS stay the truth; the schema is `backend/board/schema/board.schema.json`. Storage rules: [DATA_STRATEGY.md](DATA_STRATEGY.md). Record the board reads: [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md). Per-file detail: the [newsBoard README](../../backend/board/newsBoard/README.md) and the [board feature README](../../global-perspectives-starter/frontend/src/features/board/README.md). Facts marked "read 2026-11-17" were read from the code and live AWS that day.

Design canvas (12 boards, static): https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo. Design-check page: https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE. Both links come from the earlier version of this doc and were not re-opened.

The design check (2026-10-31) was answered by one operator rule: build to design where the data is ready, is the reader's own, or arrives with the weekly review or verdicts; later for what needs a model call and a price decision or an alert send (board summary and monthly text, the verdict's mechanism sentence, "what follows if", "what would break it", alert delivery).

## 1. Purpose
The story page is state; the weekly is change; neither connects stories to each other. The board answers one question: do these things connect, how, and what follows if they do. Reading is free; asking costs compute; the answer is something a reader can put their name on. It replaces the "your countries" half of the personal weekly.

## 2. The build rule (operator, 2026-10-24)
The board drifted because it was built data-first, so the screen became a list of whatever data existed. The order is: design the complete UI of all 12 canvas boards from fixtures (`?devBoard=1`, absent from production chunks), then wire data one element at a time as it arrives (facts, then readings after the weekly review, verdicts from the resolver, model pieces last).
- An element with no data is built, visible in the dev harness and absent on the live site. No placeholder text.
- Each artboard is eye-checked in a browser against the canvas before release.
- Dates and labels are formatted for a reader, never raw.
- Wording follows decision 0038 (`shared/lib/branchWording.js`): never "DEAD". A branch that did not happen reads "not reported by D MON", one that cannot be checked "could not be checked · reason", a late one "open · due D MON".
- Decisions 0058 (regions and themes) and 0066 (the board look) apply this rule to the board redesign.

## 3. The object
- Pins: thread (`threadId`), country (ISO3), actor (the id the views carry: `wd:Q...` or `name:`; compared trimmed, whitespace-collapsed, lowercase). Budget 12 live pins per board (schema constant); a retired pin (`retiredAt`) is greyed, keeps its strings and the reader's lines and does not count. A member holds at most 20 boards and 40 pins per board.
- Strings: OURS (from the story web, weak / medium / strong) or YOURS (dashed). One reader line each. `a < b` lexically, one key per pair. Every ours-string is stored `strength: 'inferred'` until a review confirms it; it is never drawn solid before confirmation (`stringTexture`, `backend/shared/src/record.js`, mirrored in `shared/lib/board.js`). Texture is the rule decisions 0012 and 0058 cite: dashed until the weekly review confirms a link, solid only after.
- Branches: per pinned story, the scenarios with probability, trigger and date. The reader may weight them beside ours (`weights`).
- Textures: provisional (dashed, lighter), settled (solid), not-reported (grey, dated). Strength by number, tier word and line weight, never by colour.
- Nothing is deleted, only greyed: Retire sets `retiredAt` (Restore clears it) and no path removes a reader's line. Our misses are public (a flagged node and a correction in the shared weekly); the reader's are private (their monthly).
- Storage: boards are `GlobalPerspectiveSavedItems` items `kind:'board'` (`board#` id, hidden from `newsSavedItems`); follows are `followedThreads` / `followedActors` in `GlobalPerspectiveUserPrefs` (`followedCountries` stays with `newsRecommend`). User data, so DynamoDB.

## 4. Views of one board
- Graph (home) and map. Tree per story: trunk of dated events, forks as count nodes, grey stubs for not-reported branches, a late flag past a branch's date, live branches by thickness (p) past the present line, the reader's weighting as a thin dashed row (not built, section 11).
- Zoom ladder, four rungs: line, chapters, forks and events, the event (the only rung with raw sources: entries, outlets, the branches drawn that evening). Built for a story; the same rungs on a string and on the board are not built.
- Divergence (private): solid where we agree, dashed where only the reader keeps it, dotted grey where the reader cut ours and it held ("Restore?").
- Summary (one dated paragraph, rewritten weekly, versioned), weekly (pins moved, strings changed, branches settled, due dates, coverage line) and monthly (the arc, strings, branches settled, the surprise, pins gone quiet, next month's dates).

## 5. The connection verdict (drop pin A on pin B)
Grounds tested: shared actor or place; shared mechanism (model-named, labelled); timing and lag; shared source chain (flagged as a coverage artefact); a path through a third story. Panel order: verdict with mechanism and confidence, joint trace with lag, direction, what follows if (labelled judgment), who sits in both, what would break it (falsifier with a date), evidence, the reader's line. The honest negative ("No link found. Shared: nothing but the week.") is a first-class result. Cheap grounds are computed without a model (`cheapGrounds`). Today `connect` computes only those (actor, place, outlet, co-movement), uses no model, writes nothing and caches nothing (read 2026-11-17, `backend/board/newsBoard/src/connect.js`).

## 6. Arrivals
1. The next event of a pinned story lands on that pin's trunk as a fact; duplicate-story detection is the precondition. Not built.
2. A genuinely new story is tested against every pin. Strong (a confirmed record link plus non-empty cheap grounds) becomes a face-down card in the clue pool; medium overflows into the weekly; weak never reaches the board. Candidates are the stories born in the last 14 UTC days (a fixed window, so a card left alone stays until kept, dismissed or aged out); `lastVisitedAt` only marks cards unseen. Cap 5, strongest first. The reader places a card on a pin to keep it (a provisional string). Dismissals are remembered; a dismissed story may knock once more if it strengthens, flagged "came back". Built: strong cards, the window, the cap, Keep, Dismiss. Not built: medium overflow and "came back" (`arrivals` returns strong cards only and keeps no re-knock state).
3. A story that explains a string the reader keeps lands on the string as a dated node, not as a pin. Not built.
No popups and no notification stack; the pool badge counts only unseen cards. Births include the visit day.

## 7. Folding
Age over 4 weeks folds to one node with a count; a branch under 20% starts folded in the story tree (`isDeadBranch`); at most five arrivals show; several changes on one string become one summary edge (not built). One-line chapter and fork summaries are written by the weekly run, dated, and never rewritten; paragraph summaries are versioned; counts are computed. Never delete, never rewrite a dated line, never show unfolded what the reader did not open. The numbers live once in `features/board/lib/folding.js`.

## 8. Alerts and presets
Alerts come only from what the reader pinned or wrote (branch fired, a date is tomorrow, string strength changed, my line was tested); at most one daily email, nothing if nothing fired; a quiet board gets the weekly only. Enabling sends needs a fresh yes. Presets are ours, read-only, forked to become theirs (by region now; theme and desk later). Region presets are built by `newsBoard` `list_presets` from the region table in `backend/shared/src/regions.js`; decision 0058 planned to move them onto the record's `index/regions.json` and `index/themes.json`. Today nothing in `newsBoard` or the frontend reads those two files (checked in the code, 2026-11-20). Decision 0066 plans a public board that the browser builds from `themes.json` (see the end of section 10).

## 9. Pricing
Deferred (operator, 2026-10-20): the board is free for signed-in members until the verdict panel exists. If a seam is needed: verdict plus joint trace free, the rest paid. A business decision for the operator.

## 10. Where the build stands
Read from the code and live AWS, 2026-11-17.

Backend. `newsBoard` is deployed: `nodejs22.x`, 1024 MB, 15 s, last modified 2026-11-14T06:13:05Z, env `RECORD_READS=record`, Function URL CORS config populated (the code emits no `Access-Control-*` headers). Fifteen actions (list in the newsBoard README). It reads the record views `index/active.json`, `index/all.json` and `links/<id>.json` for pins and arrivals (`src/recordViews.js`, `src/arrivals.js`), and the world families for presets and `connect` through `backend/shared/src/world/` (`src/world.js`): with `RECORD_READS=record` the record answers and DynamoDB answers only when the views are over 9 hours old or a read fails. It writes only the member's board items and follows. The region table is the shared `backend/shared/src/regions.js` (decision 0058 step 2, deployed 2026-11-14).

What `get_board` gives a pin: `recordAvailable`, `line` (or null), `born`, `entryCount`, `counts.liveBranches`, `lastMoved`; `counts.chapters` and `counts.confirmedLinks` are null. It does not give `risk`, `riskWas`, `category` or `coverage`. So on the live site the risk number comes from the thread analysis (`usePinInfo`) and the crisis dot from today's topics; "was N", the no-coverage fog, the week scrubber and "what we missed" stay absent until the feed carries those fields.

Frontend. `BOARD_ENDPOINT` is set in `docs/config.js` and is a required field in `scripts/prepare-site-assets.mjs`. The route is `/board` and `/board/:boardId` (`app/App.jsx`, lazy, noindex). The Board link shows to every visitor when `boardAvailable()` is true. In the top bar (`app/layout/Layout.jsx`) it shows for everyone on desktop; on a phone it shows there for a signed-in, non-guest member only, and a signed-out visitor finds it in the "?" help panel's page list (`app/layout/HelpPanel.jsx`, `shared/ui/SiteGuide.jsx`). Signed out, the page shows a sign-in line ("Sign in to build your own board") and the public region boards. The alerts settings panel is mounted only when `import.meta.env.DEV` (`BoardPage.jsx`). I did not open the live site, so I make no claim about the served bundle.

Readings. The weekly review has written readings for `2026-W43` (5 stories, canary), `2026-W44` and `2026-W45` (S3 listing of `record/readings/`, and manifest `readingsThrough: 2026-W45`, read 2026-11-17). Pin lines, chapters and live branches exist only for stories a review has read.

Rules in the code worth keeping:
- One helper, `lib/branchDays.js`, defines today (the UTC day), open, live (open, due today or later), late (open, due before today) and due this week (live, due by the ISO-week Sunday). Every panel uses it, so counts agree everywhere.
- Saves carry `expectedUpdatedAt`; a moved board answers 409 `stale_board` and the page reloads. `update_board` keeps only the schema's pin fields.
- A forecast branch is read through `lib/branchView.js`, which accepts both record shapes (`trigger` is the question, `text` the scenario name, `p` else `scenarioP` the percent).
- Map (`lib/mapPlaces.js`, `BoardMap`): a story pin sits on the country its entries name most (ties alphabetical); every other country it touches gets a small mark tied to its ring (a place involved is a place affected); a country pin sits on its country; an actor, or a story naming no country, waits as a "No place" chip. The frame fits the rings only.
- Pin titles and the add-pin list still come from today's topics (`useGeminiTopics`) and `thread_analysis`.
- Dev harness: `/board?devBoard=1` (member on an in-memory fake), `&devRecord=1` serves `features/board/dev/recordViews/`.

Open, not built:
- The board redesign of decision 0066 (next paragraph) and 0058 steps 7 to 9.
- Everything in section 11 marked data, model, later or UI.
- A live browser re-check of the current build (arrivals Keep and fade, the signed-out view and network failures were never recorded as checked).

Next, accepted and being built, not live: decision [0066](../decisions/0066-board-look-judged-links-and-change.md) (operator, chat, 2026-11-20). The public board will be built from the six live themes, with the region boards as a second list, judged links shown with direction and strength, shared names as a dotted note and never a line, the sentence list first with the graph behind "Show as a diagram", no lag, and a "This week" or "Since your last visit" box. Region boards will be named "Stories touching <Region>". Direction in members' own boards is later. Nothing in this document describes that board as existing; this document changes when it is live.

## 11. Checklist
Gap kinds: **data** (waits on a field or history that does not exist yet), **model** (a model call and a price decision), **later** (named by the operator as after this build), **UI** (only the build is missing). Status read from the board feature source, 2026-11-17.

| # | Artboard | State | Gaps |
|---|---|---|---|
| 1 | Graph | built | Live feed lacks `risk`, `riskWas`, `category`, `coverage` (data). A string is drawn solid only once confirmed (data: the review confirms none yet). The scrubber sets the week in the top bar and does not replay the graph (data: stored weekly snapshots) |
| 2 | Map | built | An actor pin has no place by design; a story naming no country has none (data); connecting pins is Graph only (UI) |
| 3 | Verdict | partly built | Mechanism sentence, direction, "what follows if", "what would break it" (model). Joint trace needs dated moves from `connect`, which it does not return (data). No shared-source-chain or third-story ground (data) |
| 4 | Weekly | partly built | Old to new scores and a string strengthening (data: no history stored). Coverage line (data: a views field). Board summary paragraph (model) |
| 5 | Arrivals | partly built | Dragging a card onto a pin (UI). Landed-on-string node (data). Medium overflow and "came back" (data: server side) |
| 6 | Story tree | built | The reader's weighting as a thin dashed row on the tree (UI). Live branches only for stories a review has read (data) |
| 7 | Summary and monthly | partly built | Summary paragraph and "the surprise" (model, later). The arc and previous summaries need stored `summary.versions`, which `newsBoard` creates empty and nothing in `backend/board` fills (data: a weekly summary writer). "What we missed" needs `coverage.note` (data) |
| 8 | Presets | built | Only the "By region" group exists; theme and desk presets are not built (decision 0066 plans public theme boards that the browser builds from `themes.json`, not presets) |
| 9 | Alerts | partly built | Panel is dev builds only; choices are not stored (the schema has no field) and nothing sends. Storing needs a schema field; delivery needs a fresh yes (later) |
| 10 | Divergence | partly built | "You cut it and it held" needs strength after the cut (data) |
| 11 | Zoom ladder | partly built | The day's drift note on rung 4 (data: no such field in the story view). Rungs 1 and 2 only after a review (data). The same rungs on a string and on the board (the board rung needs the summary, model) |
| 12 | Folding rules | built | No count on the pin and no editing of summaries exist, so the sheet does not claim them |

Waits for data, not UI: feed fields `risk`, `riskWas`, `category`, `coverage` on `get_board`; score and strength history; dated moves in the `connect` reply; a writer for `summary.versions`; a schema field for alert choices; readings for stories no review has read yet.

Waits for a model call and a price decision: the verdict's mechanism sentence, direction, "what follows if" and "what would break it"; the board summary paragraph, "the surprise" and the monthly text. Alert delivery waits on a fresh yes for user-facing sends.

## 12. Not now
Leaderboards across readers, chat with the board, anything that answers without evidence, narrative / calendar / reading-list views, quarterly replay.
