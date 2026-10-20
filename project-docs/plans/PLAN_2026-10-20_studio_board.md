# The Studio board: a personal connection board (brainstorm record)

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
| Settled forecasts (Forecasts section, dead branches, monthly) | `newsPredictionResolver` runs daily 10:30Z (`TriggerPredictionResolver` ENABLED): seeds, draws K=22 per week, drafts on Mondays. Live status: 44 sampled, 1 due, 1 draft, **0 verdicts**. Drafts are proposals; verdicts are written by the operator with `settle-review.js`. | The operator review has never been run, and the drafter works on abstract questions, not on story branches with triggers. | Run the review once on the existing draft (operator). Then add a per-story trigger check to the weekly run (fired / hold / dead, model draft, operator confirm) writing to the same log. |
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

## Open questions (operator)
1. Is the weekly the product for the next quarter, with the board after ten readers open it? (Claude's view: yes.)
2. What is free and what is paid: natural seam is verdict + joint trace free, the rest paid. Pricing is yours.
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
- 2026-10-20: human gate dropped everywhere (operator); backend design in `PLAN_2026-10-20_record_backend.md`.
- 2026-10-20: have/lack/how-to-get checklist added after checking the resolver (exists, daily, 0 verdicts because the
  operator review never ran) and preferences (countries followed, stories not).
- 2026-10-20: brainstorm recorded; Studio Board canvas built to 12 boards (graph, map, verdict, board weekly, clue
  pool, tree, summary + monthly, presets, alerts, divergence, zoom ladder, folding rules).
