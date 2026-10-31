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
Live: `newsBoard` is deployed and `window.BOARD_ENDPOINT` is set in `docs/config.js`. The page offers boards, pins up to the budget, drag or keyboard connect with the cheap verdict, keep or cut a string, region presets and fork, the arrivals tray, the story tree for a pinned story, "This week on your board", the unsettled counts and the missing-actors card. It reads the record's story, links and counts views through the Worker, and the active and all indexes through `newsBoard`.

Still on the old stores: pin titles and the add-pin list come from today's topics (`useGeminiTopics`, the `topics` action) and `thread_analysis`; the server-side presets and `connect` read the world through `backend/shared/src/world/` (`WEB#INDEX`, `THREAD_ANALYSIS`, `THREAD_HISTORY#`, `COUNTRY# HISTORY#`, the `latest` topic pool). Step 5 cannot delete those rows until the board reads views for them.

## 11. Checklist (data-wiring list; status checked against the board feature source 2026-10-31)
| # | Item | Status |
|---|---|---|
| B0 | Live defects (title overlap, repeated "no reading yet", raw ISO dates, strings listed thrice, phone layout) | released (4d31cd28) and checked signed out; the strings list is now one collapsed disclosure. A signed-in look is still to do. ISO dates still print raw in `BoardWeekly` (moved pins, branch dates), the `StoryTree` trunk and chapters, and `ArrivalsTray`; only fork dates use `dayMonth` |
| B1 | Due-soon strip with the late flag | not built |
| B2 | Weekly header "your board moved · week ending D MON" | partly built: the `BoardWeekly` card "This week on your board" lists pins moved, strings changed, branch outcomes and confirmed links of the last 7 days; the dated header is not built |
| B3 | Pin card counts and line | partly built: the pin list rows show the line and counts (`RecordPinDetails`: chapters, live branches, confirmed links); the graph pin card shows kind, title and risk only |
| B4 | Strings encode strength; "OURS · MEDIUM · NOT CONFIRMED" label | partly built: texture by owner and state (dashed ours, dashed-alt yours, faint cut) with a short tag on the line; strength is not encoded and the full label is not built |
| B5 | ClaimTag kinds (OURS, judgment level, PROVISIONAL / SETTLED / PRIVATE) | partly built: `ClaimTag` has FACT, INFERENCE, MODEL JUDGMENT and YOURS and the board uses them; OURS, PROVISIONAL, SETTLED and PRIVATE are not built |
| B6 | Drawn SVG tree (L) | not built: `StoryTree` is a list with collapsible forks |
| B7 | Zoom ladder polish, event card with sources | partly built: the four rungs exist (line, chapters, forks and events, event) and the event rung links its sources; the day's drift note and the branches drawn that evening are not on it |
| B8 | Verdict panel evidence and "who sits in both" | partly built: `VerdictCard` shows strength, shared actors, places, outlets and score co-movement with limits; no mechanism, direction, "what follows if", falsifier or evidence list |
| B9 | Monthly card | not built |
| B10 | Coverage note on the weekly (needs a views field) | not built |
| B11 | Arrivals tray states | partly built: `ArrivalsTray` shows strong arrivals (confirmed link plus grounds) with the via line and Keep or Dismiss; the face-down card, the unseen badge and "came back" are not built |
| B12 | Preset grouping, OURS · READ-ONLY tag | not built: `PresetsPanel` lists region presets with pin and string counts and a Fork button |
| B13 | Reader weights and divergence panel | not built (the schema carries `weights`; no UI writes or reads them) |
| B14 | Map view of the board (L) | not built |

Waits for data, not UI:
- pin lines and chapters beyond the stories the weekly review has read: the review has read 5 stories so far (canary, 2026-W43); the first full run is Monday 2026-11-02 01:00 UTC;
- mechanism, direction, "what follows if" and "what would break it" (model plus pricing);
- summary and monthly arc;
- alert sends (fresh yes);
- RESURRECTED and the time scrubber.

At the Cloudflare cutover add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS` in `scripts/prepare-site-assets.mjs` (it is not in the list today).

## 12. Not now
Leaderboards across readers, chat with the board, anything that answers without evidence, narrative / calendar / reading-list views, quarterly replay.
