# The board: a personal connection board (brainstorm record)

Name (operator, 2026-10-20): **board**. Folders `backend/board/` and `features/board/`. Not "Studio", not "personal digest".

Status: ideas, not decided (2026-10-20). Nothing here is built or scheduled. The analyst's weekly
(`PLAN_2026-10-20_analyst_weekly.md`) comes first; this records where the discussion landed so it is not lost.
Design sketch: Studio Board canvas, https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo (12 boards, static, unchecked
by eye). The earlier Personal Weekly canvas (https://claude.ai/artifact/CTKb75Mv3fC9Y6BV46hKnK) shows the personal
half of the weekly as "your countries"; this plan replaces that half with "your board" if adopted.

## Why
- The story page is state; the weekly is change; neither connects stories to each other. The connection between
  stories that moved this week is the analyst's real question and the one object no page of ours answers.
- Readers (thesis-producers) want three things: not to miss a change in what they follow; to check their read
  against a dated, labelled view and see later who was right; to lift a sourced line into their own note.
- The retired Analysis Studio did too many things. This one does one: tell me whether, and how, these things
  connect, and what follows if they do. Reading is free; asking costs compute; the answer is something a reader can
  put their name on. What sits behind payment is an operator decision (see Open questions).

## The object
- **Pins**: stories, countries, actors. Budget about 12 per board (Disco Elysium slot limit).
- **Strings**: connections. OURS (from the story web: weak / medium / strong, model-inferred until an operator
  sign-off makes it "defensible") or YOURS (dashed). Each string carries one reader line ("Both are Egypt's
  periphery; watch Cairo").
- **Branches**: per pinned story, the scenarios with probability, trigger and date (the prediction log already holds
  these; it never checks them). The reader may weight the same branches beside ours.
- **Textures**: provisional (dashed, lighter) for judgments not yet kept or confirmed; settled (solid); dead (grey,
  dated). Risk and strength by number, tier word and line weight, never colour.
- **Nothing is deleted, only greyed.** Cut strings, dead branches and retired pins stay with their dates.
- **Our misses are public, theirs are private.** A dead branch of ours that happens anyway is a flagged node and a
  correction in the shared weekly. A string the reader cut that held is a private line in their monthly.

## Views of one board
- Graph (thesis) and map (world); graph is the Studio home, map the site's.
- Tree per story: trunk of dated events, forks as count nodes, dead stubs with death dates, LATE flag for a branch
  past its date, RESURRECTED marker with both dates, live branches by thickness past the present line, the reader's
  weighting as a thin dashed row beneath.
- Zoom ladder, four rungs everywhere: line → chapters → forks and events → the event (the only level with raw
  sources: entries, outlets, the day's drift note, branches drawn that evening, what it killed, which string it
  touched). Same rungs for a string (summary → changes → one change → evidence) and the board (summary →
  clusters → pins → events).
- Divergence: solid where we agree, dashed where only the reader keeps it, dotted grey where the reader cut ours and
  it held ("Restore?"). Private.
- Narrative (board as prose), actor, calendar and reading-list views: later.

## The connection verdict (drop pin A on pin B)
Grounds tested: shared actor or place; shared mechanism (model-named, labelled); timing and lag; shared source
chain (flagged as a coverage artefact); a path through a third story. Panel, in order: verdict with mechanism and
confidence; joint trace with lag; direction (one pairing is not a pattern); what follows if (conditional branch
re-weighting, labelled judgment); who sits in both; what would break it (falsifier with date); evidence; the
reader's line + keep + export as memo. The honest negative ("No link found. Shared: nothing but the week.") is a
first-class result. Cheap grounds precomputed; the model call only for the mechanism sentence; pairs cached.

## Arrivals (new stories meeting the board)
1. Is it the next event of a pinned story? Then it lands on that pin's trunk as a fact (Obra Dinn: facts auto-fill)
   and the only question is whether a trigger fired. Duplicate-story detection is the precondition.
2. Genuinely new: run the connection tests against every pin. Strong → a face-down card in the clue pool at the
   board's edge (title, via, strength, date; Alan Wake 2 Case Board); medium → the pool's overflow, emptied into the
   weekly; weak → never reaches the board. The reader places a card on a pin to keep it (draws a provisional string
   and may open that pin's branches for re-weighting). Dismissals remembered; a dismissed story may knock once more
   if it strengthens to strong, flagged "came back".
3. A new story that explains a string the reader already keeps lands on the string as a dated node, not on the
   board as a pin.
4. The reader's own lines are matched against new entries: "Your line from 20 Sep was tested today."
No popups, no notification stack (X-COM / Civ VI lesson). The pool badge counts only unseen cards or is absent.

## Time
- Board summary: one paragraph above the pins, [SUMMARY · DRAFT], rewritten weekly, versioned, reader-editable.
- Weekly: the board's change report (pins moved, strings changed, branches killed or confirmed, new link found, due
  dates, coverage line). Replaces the "your countries" half of the personal weekly.
- Monthly: the arc (four weekly first lines), strings over the month, branches settled (ours public, theirs
  private), the surprise (the one event no branch predicted), what we missed, pins gone quiet (retire?), next
  month's dates.
- Quarterly season replay and a shareable record page: later.

## Folding rules (so it stays readable)
- Age > 4 weeks → one node with a count. Dead branch under 20% → folded on day one. Dense pins → a named cluster
  pin with count and one-line summary. Arrivals → count on the pin; the strip shows at most five, strongest first.
  Several changes on one string → one summary edge, toggle to each change (Linkurious / Ogma pattern).
- One-line chapter and fork summaries are written by the weekly run at the time, dated, never rewritten. Paragraph
  summaries are rewritten weekly and versioned. Counts are computed.
- Never: a later run rewriting a dated line; deletion; anything shown unfolded unless the reader opened it.

## Alerts, presets, other
- Alerts only from what the reader pinned or wrote: branch fired (instant, per pin, opt-in); a date is tomorrow;
  string strength changed; my line was tested; new pin we think belongs (weekly only). At most one daily email,
  nothing if nothing fired. "Quiet board" = weekly only.
- Presets, ours and read-only, forked to become theirs: by region, theme, desk; "this week's board" = the analyst's
  weekly as a board, linked from the email. A preset's monthly is a regional edition for free.
- Also discussed: compare boards across time, confidence slider on our strings (scored privately), side-sheet
  hand-off to the story page, keyboard navigation, export as memo or image, read-only share of a board.
- Deliberately not now: leaderboards across readers, chat with the board, anything that answers without evidence.

## What it needs that does not exist (shared with the weekly plan)
Forecast settling / trigger checking (never run); duplicate-story merge in the pipeline; story birth dates and
chapter marks (drift notes can seed chapters); operator sign-off for links; per-reader board state (DynamoDB, per
`rules/DATA_STRATEGY.md`); story following (today only countries are followed; to be checked).

## Checklist: have, lack, how to get (verified against code and live AWS, 2026-10-20)

| Need | Have today | Lack | How to get it |
|---|---|---|---|
| Settled forecasts (Forecasts section, dead branches, monthly) | `newsPredictionResolver` runs daily 10:30Z (`TriggerPredictionResolver` ENABLED): seeds, draws K=22 per week, drafts on Mondays. Live status: 44 sampled, 1 due, 1 draft, **0 verdicts**. Since 2026-10-20 (decision 0034) the resolver writes verdicts itself; `predictions/settle-correct.js` appends a correction with a reason. | The drafter works on abstract questions, not on story branches with triggers. | Per-story trigger check in `newsStoryRecord` (`PLAN_2026-10-20_record_backend.md` §3) writing dated status rows. |
| Branches with triggers per story | `PRED#<topicId>/<date>` scenarios with probabilities and triggers for every analysed story. | Trigger status is never updated; no "dead"/"late"/"resurrected" state. | The trigger check above writes a dated status row per branch; never rewrites the original. |
| Story birth date, chapters, dated one-line summaries | Earliest `archive#` date per threadId can be derived; daily drift notes (`THREAD#/DRIFT#`, 60-day TTL; `DRIFTLOG#` kept) say when a story changed nature. | No stored birth date, chapter mark or never-rewritten line. | Store birth date at thread creation; the weekly run writes a chapter row when a drift note changes the expected path; one line per chapter and per fork, dated, put-once. World data → S3/story rows per `rules/DATA_STRATEGY.md`. |
| One story per event | Threads CLI `split|merge --apply`; live read API to verify. | Duplicate threads for one event (Pakistan, Brazil, settlers this week). | Duplicate check at thread birth in the pipeline (shared actors + place + 48h window); CLI merge stays the fallback. |
| Trustworthy connections | Story web `WEB#INDEX`/`LATEST` → `web/latest.json`, links weak/medium/strong, shared actors; snapshots under `web/`. | All links model-inferred ("possibly related"); no sign-off path, no "defensible" field. | Operator review command (like the alert confirm) that sets `confirmedBy/at` on a link; the board and weekly show only confirmed links as solid OURS. |
| Corrections | Nothing. | No corrections store. | Falls out of the trigger check: a dead branch that happens is a correction row; plus a small operator-written store read by the weekly and the story page. |
| Following | `GlobalPerspectiveUserPrefs`: `followedCountries`, digest/breaking/drift opt-ins (`usePreferences.js`). `newsSavedItems` bookmarks per user. | No followed stories or actors; no board state. | Add `followedThreads` to prefs (user data → DynamoDB); board state as its own item set in the same table. |
| Weekly content | `newsWeeklyBrief` (Sun 06:00Z, top-6 by volume, no judgment); `newsEmailSender` (Sun 14:00Z, live). | The analyst's weekly, the changelog digest, the lead trace. | Weekly plan steps 3–6 (skill, check, publish, page, email, cloud run, retire old Lambda). |
| Connection tests and verdict | Shared actors, places, daily scores, entries with outlets: all stored. | The pair test, the lag/joint trace, the mechanism call, caching. | New read-API Lambda: precomputed grounds + one model call for the mechanism; cache per pair. Studio phase. |
| Member page, alerts, presets | Account desk, membership via Polar (live), breaking/drift email code (disabled). | `features/weekly`, board UI, per-pin alert prefs, presets. | Frontend work after the weekly page; alerts reuse the sender with a per-pin rule set. Studio phase. |

Order: resolver review once → trigger check in the weekly run → duplicate check → birth/chapter rows → link sign-off →
weekly steps 3–6 → following stories → board.

## Checklist: what the board can provide now, what waits, and for what (2026-10-20)

"Now" means from data that exists and is verified live today (thread analyses, the story web, scenarios in the prediction
log, daily history scores, drift notes, user prefs, saved items). "Waits" names the exact piece it waits for.

| Board feature (from the canvas) | Now? | Built from | Waits for | Note |
|---|---|---|---|---|
| Follow stories and actors | now | `UserPrefs` new fields (`followedThreads`, `followedActors`); `followedCountries` exists | — | `newsBoard` owns the new fields; `newsRecommend` keeps countries |
| Board store (create, rename, pins, strings, lines, weights, dismissals) | now | `SavedItems` item `kind:'board'` | the frozen pin/string schema (`backend/board/schema/`) | schema first, then code |
| Pins: title, risk number + tier, type hue | now | `THREAD#/THREAD_ANALYSIS` (risk, type), `NewsCache latest` | — | — |
| Pin line (one sentence as it stands) | **waits** | — | record: `line` in `record/stories/<id>` | until then the pin shows the latest headline, labelled as such |
| Pin counts (chapters, events, live branches, last moved) | **waits** | — | record: `record/index.json` | — |
| Strings OURS, dashed "inferred" | now | `web/latest.json` links (weak/medium/strong, shared actors) | — | all 56 links are model-inferred today; drawn dashed, never solid |
| Strings OURS, solid "confirmed" | **waits** | — | `newsSystemsAnalysis` link-confirmation rule | small change to an existing writer |
| Strings YOURS + your line | now | board item | — | — |
| Drag-to-connect: cheap grounds (shared actors, place, co-movement with lag, shared outlets) and the honest "no link" | now | `WEB#INDEX` actors, `resolveIso3`, `THREAD_HISTORY#` daily scores, archive outlets | — | computed in `newsConnect` without an LLM; result cached in `record/pairs/` |
| Drag-to-connect: mechanism sentence, direction, "what follows if", falsifier | **waits** | — | record (branches per pin) + the LLM step in `newsConnect` + a pricing decision | the paid part; not on inferred links |
| Branches on a pin (p, trigger, due) | now, read-only | `PredictionLog PRED#<topicId>/<date>` scenarios | — | shown as drawn; no status |
| Branch status (fired, dead, late, resurrected) | **waits** | — | record: trigger check in `newsStoryRecord` | nothing greys out until then |
| Your weighting of branches | now | board item `weights` | scoring of it waits for branch status | store now, score later |
| Tree mode (trunk, forks, dead stubs) | **waits** | — | record: events, forks, status rows | the trunk of dated events could be shown now from archives, but without forks it is a timeline, not a tree |
| Chapters and the zoom ladder | **waits** | — | record: chapter rows | — |
| Arrivals / clue pool | **waits** | — | record: duplicate check + `record/index.json` daily rows | without the duplicate check one event knocks twice |
| "What is missing" card | partly now | shared actors across your pins from `WEB#INDEX` | record counts for the full version | the actor-only version is cheap and honest |
| Board summary paragraph | **waits** | — | record lines + an LLM step in `newsBoard` | — |
| The board's weekly | partly now | diff of pin risk scores week on week (`THREAD_HISTORY#`), strings you changed | record for "branches killed", "new link found", confirmed strengths | a score-diff weekly is honest but thin; the useful one waits |
| The board's monthly | **waits** | — | four board weeklies + record | — |
| Alerts (branch fired, date tomorrow, strength changed, line tested) | **waits** | `newsEmailSender` exists with disabled alert modes | record status rows; alert rules in prefs; a fresh yes to enable sends | "a date is tomorrow" could run now from `PRED#` due dates |
| Presets by region / theme / desk | now | thread analyses grouped by `iso3[]` and type | confirmed strings for a good preset | first presets ship with dashed strings |
| "This week's board" preset | **waits** | — | the analyst's weekly (`weekly/latest.json`) | — |
| Divergence view | partly now | your strings vs ours; your weights vs ours | branch status for "cut but held" | — |
| Export as memo / image, read-only share | now (share), later (export) | `GlobalPerspectiveShares` exists for share links | — | export after the verdict panel exists |
| Map view of the board | now | `shared/map` kit | — | not first; graph is the home |
| Fog (coverage gaps) | partly now | missing archive days are known (e.g. 14 Oct) | record coverage block | — |
| Pin budget (12) | now | board store rule | — | — |

Summary: **now** = following, the store, pins with risk, inferred strings, your strings and lines, cheap-grounds connect
with honest negatives, read-only branches, your weights, region presets, share links, pin budget. **Waits for the record**
= lines, counts, branch status, tree, chapters, arrivals, confirmed strings, the real board weekly, monthly, alerts,
summary. **Waits for a decision** = enabling alert sends (fresh yes). Pricing is deferred until the verdict panel exists; the board is free until then.

## Build stages and checklist (written 2026-10-20; nothing started)
Status: planned. Each stage is one or two sequential Sonnet agents with the operator checking in between. A box is ticked
with its commit. Alerts and pricing are out of scope for all stages below.

### Stage 0: freeze the shape (no runtime code) — done 2026-10-20
- [x] `backend/board/schema/board.schema.json`: board `{boardId, uid, name, pins[], strings[], weights{}, dismissed[], summary{versions[]}, presetFrom?, createdAt, updatedAt}`;
      pin `{pinId, kind: thread|country|actor, refId, addedAt}`; string `{a, b, owner: ours|yours, strength?: weak|medium|strong|inferred, mechanism?, line?, keptAt?, cutAt?}`;
      weights `{forkId: {branchId: p}}`. Pin budget 12 as a schema constant. `a < b` lexically so one key per pair.
- [x] `backend/board/README.md`: the three-names table, what the group owns, what it never writes.
- [x] Decision: pins by `threadId` (stories), ISO3 (countries), actor name as written in `WEB#INDEX` (actors). Recorded here.
      Found: `WEB#INDEX` carries no actor ids. Actors are free-text names from the LLM (`newsSystemsAnalysis/src/index.js` `normalizeActors`, line ~342: trimmed, whitespace collapsed, case-insensitive dedupe keeping the first display form), and shared actors are matched by `toLowerCase()` (line ~444).
      Rule: actor `refId` = the name as stored; compare by trim + collapse whitespace + lowercase. Country pins use ISO3 from `resolveIso3`.

### Stage 1: shared code (used by board now, by record later)
- [ ] `backend/shared/src/record.js`: pure rules with tests: `stringTexture(string)` (ours+confirmed → solid; ours inferred → dashed; yours → dashed-alt), `pinBudgetOk(board)`, `pairKey(a,b)`, `cheapGrounds(pinA, pinB, ctx)` (shared actors, shared places via `resolveIso3`, shared outlets, co-movement with lag from two daily score series) returning `{strength: none|weak|medium, grounds[]}` with the honest `none`.
- [ ] `backend/shared/src/s3json.js`: `getJson`, `putOnce` (`If-None-Match: *`), `putLatest`; tests with a fake client. Unused until the record writes; written now so both sides share one implementation.
- [ ] Frontend `shared/lib/board.js` mirror of `stringTexture` and `pairKey` only (pure), guarded by `scripts/check-shared-sync.mjs` like `links.js`.

### Stage 2: backend `newsBoard` (code and tests only; not created in AWS)
- [ ] `backend/board/newsBoard/src/index.js`: Function URL handler, Firebase JWT verification copied from the `newsSavedItems` pattern (no firebase-admin), CORS per the Function-URL rule in CLAUDE.md.
- [ ] Actions: `list_boards`, `get_board`, `create_board`, `update_board` (schema-validated; pin budget; strings normalised with `pairKey`), `delete_board`, `follow_thread`, `unfollow_thread`, `follow_actor`, `unfollow_actor`, `list_presets`, `fork_preset`, `connect {a, b}`.
- [ ] Stores: `GlobalPerspectiveSavedItems` items `kind:'board'`; `GlobalPerspectiveUserPrefs` fields `followedThreads[]`, `followedActors[]` only (`followedCountries` stays with `newsRecommend`).
- [ ] Reads for presets and connect: `SummarizeAndPredict THREAD#*/THREAD_ANALYSIS` (risk, type, iso3), `WEB#INDEX` (actors, links), `NewsCache latest` (titles), `THREAD_HISTORY#` (daily scores for lag).
- [ ] Tests with a fake DynamoDB: every action, auth failure, budget exceeded, schema rejection, `connect` with and without grounds.
- [ ] `scripts/functions.json` entry (`group: board`, `features: [board]`, `nodeModules: true`), README with reads/writes/env.

### Stage 3: frontend `features/board/` (local only; no release)
- [ ] Route `/board` in `App.jsx` (lazy), nav entry only for signed-in members; `features/board/index.js` public API; README.
- [ ] `BoardPage.jsx`: graph view in SVG: pins (title, risk number + tier word, type hue dot), our strings dashed "inferred", yours dashed-alt, string weight by strength, a selected-pair side sheet.
- [ ] Drag a pin onto another → `connect` → verdict card: grounds listed or "No link found. Shared: nothing but the week." Keep draws a `yours` string with the line input.
- [ ] Presets chooser (region) and fork; pin budget indicator; "what is missing" actor-only card.
- [ ] Hooks: `useBoards`, `useBoard(boardId)`, `useFollows` on `restProxy` with the auth header; endpoint from `window.BOARD_ENDPOINT` (operator-owned `docs/config.js`; dev value in `frontend/public/config.js`).
- [ ] Shared only: `ClaimTag`, `TierChip`, `EntityLink`, `links.js` (`boardHref`), tokens; no local styling of shared blocks; ratchets pass; `npm run verify` passes.
- [ ] Browser click-through at desktop and phone width against a local fake endpoint (fixtures), since the Lambda is not deployed yet.

### Stage 4: deploy and wire (operator yes first)
- [ ] Operator: execution role for `newsBoard` (IAM) and `aws lambda create-function`; then standing auth covers code/config/URL updates.
- [ ] Env: `SAVED_ITEMS_TABLE`, `USER_PREFS_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `TOPICS_DDB_TABLE`, Firebase project id; IAM read on the two world tables, read/write on the two user tables only.
- [ ] `docs/config.js` `BOARD_ENDPOINT` (operator-owned); frontend release (fresh yes).
- [ ] Smoke: create a board, add two pins, connect, keep, fork a preset, on production as a member.
- [ ] Docs: `ARCHITECTURE_RECORD.md` §9 status, `ARCHITECTURE.md` data flow 8, `DATA_STRATEGY` §2 field note, reference regen, Atlas.

### Waits for the record (not in these stages)
Pin lines and counts, branch status, tree, chapters, arrivals, confirmed strings, the board's weekly and monthly, summary,
divergence "cut but held", `newsConnect` with the LLM grounds. See the now / waits checklist above.

## Open questions (operator)
1. Is the weekly the product for the next quarter, with the board after ten readers open it? (Claude's view: yes.)
2. What is free and what is paid: **deferred (operator, 2026-10-20)** until the record and the verdict panel exist. Until then
   everything on the board is free for signed-in members. The natural seam, if and when: verdict + joint trace free, the rest paid.
3. Strong arrivals: automatic faded pin, or always wait in the pool? (Discussion landed on the pool.)
4. Does the board's weekly replace or sit beside the personal half of the analyst's weekly? (Landed on replace.)

## References used
Alan Wake 2 Mind Place (clue pool, "anything on the board is a conclusion reached"); Disco Elysium Thought Cabinet
(face-down, slot limit); Return of the Obra Dinn (facts auto-fill, judgments provisional until validated); X-COM /
Civ VI notifications (what to avoid); Linkurious / Ogma (groups start collapsed, count badge, group on zoom, summary
edges); Google News Full Coverage (shared, unpersonalised timeline); Metaculus (forecast as a line over time);
Kialo / Arguman critique (dense trees hide what matters); i2 Analyst's Notebook (time view and link view are
different charts).

## Log
- 2026-10-20: build stages and checklist written; nothing started (operator: write down first).
- 2026-10-20: pricing deferred (operator); the board is free for members until the verdict panel exists.
- 2026-10-20: now / waits checklist added per board feature.
- 2026-10-20: human gate dropped everywhere (operator); backend design in `PLAN_2026-10-20_record_backend.md`.
- 2026-10-20: have/lack/how-to-get checklist added after checking the resolver (exists, daily, 0 verdicts because the
  operator review never ran) and preferences (countries followed, stories not).
- 2026-10-20: brainstorm recorded; Studio Board canvas built to 12 boards (graph, map, verdict, board weekly, clue
  pool, tree, summary + monthly, presets, alerts, divergence, zoom ladder, folding rules).
