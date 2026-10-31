# The board

Design of the personal connection board (`/board`, `backend/board/`, `global-perspectives-starter/frontend/src/features/board/`). Code and live AWS stay the truth; the schema is `backend/board/schema/board.schema.json`. Storage rules: [DATA_STRATEGY.md](DATA_STRATEGY.md). Record the board reads: [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md).

Design canvas (12 boards, static): https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo. Design-check page (117 items; answers in its `decisions` collection): https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE.

Design check answered 2026-10-31 by one operator rule: build to design where the data is ready, is the reader's own, or arrives with the weekly review or verdicts (95 items); later for the items that need a model call and a price decision or an alert send (9: board summary and monthly text, the verdict's mechanism sentence, "what follows if", "what would break it", alert delivery); keep what matches, was fixed on 24 Oct, or differs on purpose (13). Any card's answer can be changed on the page; the build follows the page.

## 1. Purpose
The story page is state; the weekly is change; neither connects stories to each other. The board answers one question: do these things connect, how, and what follows if they do. Reading is free; asking costs compute; the answer is something a reader can put their name on. It replaces the "your countries" half of the personal weekly.

## 2. The build rule (operator, 2026-10-24)
The board drifted because it was built data-first, so the screen became a list of whatever data existed. Order now: build the complete UI of all 12 canvas boards from fixtures (`?devBoard=1`, absent from production chunks), then wire data one element at a time as it arrives (facts, then readings after the first weekly review, verdicts from the resolver, model pieces last).
- An element with no data is built and visible in the dev harness and simply absent on the live site. No placeholder text.
- Each artboard is eye-checked in Chrome against the canvas before merge.
- Dates and labels are formatted for a reader, never raw.
- Wording follows decision 0038 (`shared/lib/branchWording.js`): never "DEAD". A branch that did not happen reads "not reported by D MON", one that cannot be checked "could not be checked · reason", a late one "open · due D MON".

Artboard build order: 1 graph, 6 tree, 11 zoom ladder, 3 verdict, 4 weekly, 5 arrivals, 7 summary + monthly, 8 presets, 10 divergence, 12 folding, 9 alerts (UI only), 2 map.

Build started 2026-10-31 in parallel Sonnet lanes, each in its own worktree and files: A artboard 1 (BoardPage, BoardGraph, board.css); B artboards 6 and 11 (StoryTree, `storyTree.css`); C artboards 3, 4 and 5 (VerdictCard, BoardWeekly, ArrivalsTray, UnsettledZone, `panels.css`); D artboards 8, 10 and 12 (PresetsPanel, divergence, `presets.css`). Only lane A edits BoardPage; the coordinator adds other mounts at merge, eye-checks each artboard in Chrome against the canvas, then releases (operator yes). Second wave: 2 map, 9 alerts UI, the non-model parts of 7. The table in section 11 is updated from the code at each merge.

## 3. The object
- Pins: thread (`threadId`), country (ISO3), actor (the id the views carry: `wd:Q...` or `name:`; compared trimmed, whitespace-collapsed, lowercase). Budget 12 per board (schema constant).
- Strings: OURS (from the story web, weak / medium / strong) or YOURS (dashed). One reader line each. `a < b` lexically, one key per pair. Every ours-string is stored `strength: 'inferred'` until a review confirms it; it is never drawn solid before confirmation (`stringTexture`, `backend/shared/src/record.js`, mirrored in `shared/lib/board.js`).
- Branches: per pinned story, the scenarios with probability, trigger and date. The reader may weight them beside ours (`weights`).
- Textures: provisional (dashed, lighter), settled (solid), not-reported (grey, dated). Strength by number, tier word and line weight, never by colour.
- Nothing is deleted, only greyed. Our misses are public (a flagged node and a correction in the shared weekly); the reader's are private (their monthly).
- Storage: boards are `GlobalPerspectiveSavedItems` items `kind:'board'` (`board#` id, hidden from `newsSavedItems`); follows are `followedThreads` / `followedActors` in `GlobalPerspectiveUserPrefs` (`followedCountries` stays with `newsRecommend`). User data, so DynamoDB.

## 4. Views of one board
- Graph (home) and map. Tree per story: trunk of dated events, forks as count nodes, grey stubs for not-reported branches, a late flag past a branch's date, live branches by thickness (p) past the present line, the reader's weighting as a thin dashed row.
- Zoom ladder, four rungs everywhere: line, chapters, forks and events, the event (the only rung with raw sources: entries, outlets, the day's drift note, branches drawn that evening). The same rungs apply to a string and to the board.
- Divergence (private): solid where we agree, dashed where only the reader keeps it, dotted grey where the reader cut ours and it held ("Restore?").
- Summary (one dated paragraph, rewritten weekly, versioned), weekly (pins moved, strings changed, branches settled, due dates, coverage line) and monthly (the arc, strings, branches settled, the surprise, pins gone quiet, next month's dates).

## 5. The connection verdict (drop pin A on pin B)
Grounds tested: shared actor or place; shared mechanism (model-named, labelled); timing and lag; shared source chain (flagged as a coverage artefact); a path through a third story. Panel order: verdict with mechanism and confidence, joint trace with lag, direction, what follows if (labelled judgment), who sits in both, what would break it (falsifier with a date), evidence, the reader's line. The honest negative ("No link found. Shared: nothing but the week.") is a first-class result. Cheap grounds are computed without a model (`cheapGrounds`) and cached per pair; the model writes only the mechanism sentence. Today `connect` computes the cheap grounds only and no model runs (`newsBoard` README).

## 6. Arrivals
1. The next event of a pinned story lands on that pin's trunk as a fact; duplicate-story detection is the precondition.
2. A genuinely new story is tested against every pin. Strong (a confirmed record link plus non-empty cheap grounds) becomes a face-down card in the clue pool; medium overflows into the weekly; weak never reaches the board. Cap 5, strongest first. The reader places a card on a pin to keep it (a provisional string). Dismissals are remembered; a dismissed story may knock once more if it strengthens, flagged "came back".
3. A story that explains a string the reader keeps lands on the string as a dated node, not as a pin.
No popups and no notification stack; the pool badge counts only unseen cards. Births include the visit day.

## 7. Folding
Age over 4 weeks folds to one node with a count; a dead branch under 20% folds on day one; at most five arrivals show; several changes on one string become one summary edge. One-line chapter and fork summaries are written by the weekly run, dated, and never rewritten; paragraph summaries are versioned; counts are computed. Never delete, never rewrite a dated line, never show unfolded what the reader did not open.

## 8. Alerts and presets
Alerts come only from what the reader pinned or wrote (branch fired, a date is tomorrow, string strength changed, my line was tested); at most one daily email, nothing if nothing fired; a quiet board gets the weekly only. Enabling sends needs a fresh yes. Presets are ours, read-only, forked to become theirs (by region now; theme and desk later).

## 9. Pricing
Deferred (operator, 2026-10-20): the board is free for signed-in members until the verdict panel exists. If a seam is needed: verdict plus joint trace free, the rest paid. A business decision for the operator.

## 10. Where the build stands (read from the code)
Checked against `features/board/` on main after the merge of board wave 1 (2026-10-31).

Live on the site: `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. What is released is the page as it stood before wave 1: boards, pins up to the budget, drag or keyboard connect with the cheap verdict, keep or cut a string, region presets and fork, the arrivals tray, a list-style story tree, "This week on your board", the unsettled counts and the missing-actors card. Nothing of wave 1 is released yet; that needs the operator's yes.

Built on main, not released (wave 1): artboards 1, 3, 4, 5, 6, 8, 10, 11 and 12, mounted in `BoardPage`. The coordinator looked at them in Chrome on the dev harness (`/board?devBoard=1&devRecord=1`, boards `dev-graph` and `dev-record`) at desktop width: the graph with top bar, pin budget bar, legend band, strength widths, string labels placed clear of the pins, fog, week scrubber, due strip and a rail with the weekly, branches, missing card and divergence panel; the tree and zoom ladder full width under the graph; the verdict with who sits in both, evidence, your line and export as memo (the joint trace is absent live until `connect` returns dated moves); the weekly header with the ISO-week Sunday; the clue pool with face-down cards; presets with the OURS - READ-ONLY tag, mini picture and fork; the divergence panel; the folding sheet. Phone width was not checked in a browser. The Map switch in the top bar shows only in dev builds and leads to a one-line "not built" message.

What the live `get_board` feed gives a pin today (`newsBoard/src/recordViews.js`): `recordAvailable`, `line`, `born`, `entryCount`, `counts.liveBranches` and `lastMoved`. It does not give `risk`, `riskWas`, `category` or `board.coverage`, and `counts.chapters` and `counts.confirmedLinks` are null. So on the live site the risk number comes from thread analysis and the crisis dot from today's topics, while "was N", the no-coverage fog and the week scrubber stay absent until the feed carries those fields. An element with no data is built, shown in the dev harness and absent live.

Still on the old stores: pin titles and the add-pin list come from today's topics (`useGeminiTopics`, the `topics` action) and `thread_analysis`; the server-side presets and `connect` read the world through `backend/shared/src/world/` (`WEB#INDEX`, `THREAD_ANALYSIS`, `THREAD_HISTORY#`, `COUNTRY# HISTORY#`, the `latest` topic pool). Step 5 cannot delete those rows until the board reads views for them.

Reading fields wait on the weekly review: it has read 5 stories so far (canary, 2026-W43); the first full run is Monday 2026-11-02 01:00 UTC.

## 11. Checklist (status read from the board feature source, 2026-10-31)
Gap kinds: **data** (waits on a field or history that does not exist yet, named), **model** (a model call and a price decision), **wave 2** (map view = artboard 2, alerts = artboard 9 UI only, the non-model parts of artboard 7), **UI** (nothing but the build is missing).

### The 12 canvas artboards
| # | Artboard | State | What is built, and the gaps |
|---|---|---|---|
| 1 | Graph | built | Top bar, pin budget bar, legend band, pin cards (crisis dot and type line, title, line, counts, risk tier with "was N"), strings by texture and strength width with placed labels, suggested pins, "Combination failed" strings, fog, week scrubber, due strip, right rail. Gaps: live feed lacks `risk`, `riskWas`, `category` and `coverage` (data: feed fields); a string is drawn solid only once confirmed (data: confirmation by the weekly review); the scrubber only sets the week in the top bar and does not replay the graph (data: stored board snapshots per week) |
| 2 | Map | not built | Only a dev-only Map switch with a "not built" line. Wave 2 |
| 3 | Verdict | partly built | Verdict word, OURS and strength badges, note, joint trace, who sits in both, evidence, limits, your line, Keep string, Export as memo, Drop it. Gaps: the mechanism sentence, direction, "what follows if" and "what would break it" (model); the joint trace needs dated moves from `connect`, which the live reply does not carry (data: score history in `connect`); no shared-source-chain or third-story-path ground (data: `connect` computes only actor, place, outlet and co-movement) |
| 4 | Weekly | partly built | Header "Your board moved - week ending D Mon" (the ISO-week Sunday), pins that moved, strings that changed, branch outcomes, "New link we found" with Add pin and Dismiss. Gaps: old to new scores and a string strengthening (data: we store no score or strength history); the coverage line (data: a coverage field in the views); the board summary paragraph (model) |
| 5 | Arrivals | partly built | Clue pool with face-down cards, Turn over, unseen count, via lines with mechanism and direction, Keep story, Dismiss with a fade. Gaps: dragging a card onto a pin (UI); the landed-on-string node and a count on the pin (data: strength history); medium arrivals overflowing into the weekly and the "came back" re-knock (data: `arrivals` returns strong cards only and keeps no re-knock state) |
| 6 | Story tree | built | Dated trunk, present line, one dashed line per open branch weighted by its percentage, late flag, key, fold of older events, fork and branch rows worded by `branchWording`, OURS - PROVISIONAL tag. Gap: the reader's weighting as a thin dashed row on the tree (UI; weights are written in the divergence panel) and live branches only exist for stories the weekly review has read (data: the review) |
| 7 | Summary and monthly | not built | Nothing mounted. The dated summary paragraph, the monthly text and its arc, surprise and quiet pins need a model (model). The non-model parts (the versioned summary store, the monthly layout, pins gone quiet, next month's dates) are wave 2 |
| 8 | Presets | built | Region presets as cards with the OURS - READ-ONLY tag, a mini picture, pin and string counts and Fork; Sign in to fork when signed out. Gap: only the "By region" group exists; theme and desk presets come later (data: no such presets exist in the backend) |
| 9 | Alerts | not built | Nothing mounted. The UI is wave 2; delivery is a user-facing send and needs a fresh yes, and is on the later list of the design check (model and price decision for the text where one is written) |
| 10 | Divergence | partly built | Private panel: strings you cut with Restore?, your branch weights beside ours (writes `weights`), lines you wrote. Gap: the dotted grey "you cut it and it held" state on the graph (data: strength after the cut) |
| 11 | Zoom ladder | partly built | Four rungs for a story: line, chapters, forks and events, the event with its sources, the branches drawn that day and a link to the story page. Gaps: the day's drift note on rung 4 (data: no such field in the story view); rungs 1 and 2 only after the weekly review read the story (data: the review); the same rungs on a string and on the board (the board rung needs the summary, model) |
| 12 | Folding rules | built | The "How the board folds" sheet reads its numbers from `lib/folding.js`. Gap: the rules are not applied to the views except the tree keeping its last four events; `isOldNode`, `isDeadBranch` and `strongestArrivals` are written and tested but called by nothing (UI) |

### Items B0 to B14
| # | Item | Status |
|---|---|---|
| B0 | Live defects (title overlap, repeated "no reading yet", raw ISO dates, strings listed thrice, phone layout) | released (4d31cd28) and checked signed out; the strings list is one collapsed disclosure. Dates now print through `dayMonth` in the weekly, the tree, the arrivals and the verdict; a raw ISO due date remains in the branch detail line of the tree. Phone width of the wave 1 build is unchecked in a browser |
| B1 | Due-soon strip with the late flag | built: `DueStrip` lists up to four open branches by date with our percentage and "past due"; the tree and rail flag late branches. Gap: only stories the weekly review has read have branches (data: the review) |
| B2 | Weekly header "your board moved - week ending D MON" | built: the header appears when something changed, and the top bar shows the ISO-week Sunday. Gap: the coverage line (see B10) |
| B3 | Pin card counts and line | built on the graph card and the pin list. Gap: live `counts.chapters` and `counts.confirmedLinks` are null, and the line exists only after the review (data: the review and the feed) |
| B4 | Strings encode strength; "OURS - MEDIUM - NOT CONFIRMED" label | built: texture, width by strength, a label per string and the legend. Gap: ours strings are stored `inferred` until a review confirms them, so live ones read "Ours - Inferred" (data: confirmation) |
| B5 | ClaimTag kinds (OURS, judgment level, PROVISIONAL / SETTLED / PRIVATE) | partly built: `ClaimTag` has FACT, INFERENCE, MODEL JUDGMENT and YOURS. The board has its own OURS badge, an "OURS - PROVISIONAL" line on the tree and a "Private" kicker on the divergence panel; SETTLED and PROVISIONAL are not shared tag kinds (UI) |
| B6 | Drawn SVG tree (L) | built: `StoryTreeDrawing` |
| B7 | Zoom ladder polish, event card with sources | built except the day's drift note (data: no such field in the story view) |
| B8 | Verdict panel evidence and "who sits in both" | built: who sits in both, evidence, joint trace, memo export. Missing: mechanism, direction, "what follows if", falsifier (model) |
| B9 | Monthly card | not built (see artboard 7: text is model, the rest wave 2) |
| B10 | Coverage note on the weekly (needs a views field) | not built (data: a coverage field in the views) |
| B11 | Arrivals tray states | built: face-down card, unseen count, fade on dismiss. Missing: "came back" and the medium overflow (data: `arrivals` server side) |
| B12 | Preset grouping, OURS - READ-ONLY tag | built for the region group; theme and desk groups later (data) |
| B13 | Reader weights and divergence panel | built: the panel writes and reads `weights`. Gap: the weighting row on the tree (UI) |
| B14 | Map view of the board (L) | not built (wave 2) |

Waits for data, not UI:
- pin lines, chapters and confirmed links beyond the stories the weekly review has read (5 so far, canary 2026-W43; first full run Monday 2026-11-02 01:00 UTC);
- feed fields `risk`, `riskWas`, `category` and `coverage` on `get_board`;
- score and strength history (old to new scores, a string strengthening, the replay behind the scrubber);
- dated moves in the `connect` reply for the joint trace;
- RESURRECTED.

Waits for a model call and a price decision: the verdict's mechanism sentence, direction, "what follows if" and "what would break it"; the board summary paragraph and the monthly text. Alert delivery waits on a fresh yes for user-facing sends.

At the Cloudflare cutover add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS` in `scripts/prepare-site-assets.mjs` (it is not in the list today).

## 12. Not now
Leaderboards across readers, chat with the board, anything that answers without evidence, narrative / calendar / reading-list views, quarterly replay.
