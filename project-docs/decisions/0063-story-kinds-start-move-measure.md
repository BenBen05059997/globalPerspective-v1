# 63. The news picking step asks of each event "does it start a story, or move a story we follow?"; three kinds get in, each entry carries a role label, and the story page shows it

Status: built on branch `story-kinds` and tested offline and by a paid replay on 2026-11-18/19; NOT DEPLOYED. No Lambda zip, setting or frontend release has changed. Each deploy step below needs the operator's yes in the message that asks for it. Two replay pass lines failed as written (see Evidence). Takes over the `newsIngest` part of 0062 only (see "Relation to 0062"). Amends 0040 (selector rules). Follows 0020, 0057, 0058, 0060.
Date: 2026-11-19

## Context
- 0040 gave the selector a done-not-said rule (0020) and a significance floor in place of "Generate N topics". It had no test for whether an event belongs to a story. In the record, 67% of stories had a single entry on 2026-10-22 (0040 context), and the picking prompt showed the model only a flat list of recent titles ("NARRATIVE CONTINUITY", the archive titles of the last 7 days).
- A story that is quiet for more than 7 days and then moves again is split: `newsAgent` joins by title and keyword score inside a 7-day window (`threading.js`), so the later entry gets a new thread id.
- The story page showed entries with no word for what each one is in the story.
- The plan papers are local, not in git: `.board/reviews/story-kinds-plan-2026-11-18/` (`plan-proposal.md`, `settled.md`, which wins over the proposal, `replay/`, `shadow/REPORT.md`).

## Decision
1. **One question per event.** The picking step (`newsIngest`, `backend/pipeline/newsInvokeGemini/src/selection.js`) asks: does this event start a story, or move a story we already follow? Three kinds get in:
   - **A start**: an event that opens a story readers will want to follow.
   - **A move**: something done in a followed story, even a quiet step (a vote held, a ruling issued, troops moved, a deal signed, talks held). A reaction, warning or claim is not a move (0020 holds).
   - **A measured change**: an official figure (statistics office, central bank, UN agency, government data release) or a major published study, when the change is large by the source's own account or feeds a followed story. The model sets `event_type: "measure"`. An opinion, forecast, poll or commentary is never one.
   - An event that connects to nothing before or after it (a single crime, a minor accident, a one-day stunt, a celebrity announcement, one expert's opinion) is left out. A case against an office-holder or political figure is not a one-off.
   - The 0040 significance floor still wins: an event that clears it always gets in, as a start or a move. A quiet move never takes the place of a floor event. Fewer than the limit is correct.
2. **The list STORIES WE FOLLOW.** `followedStories()` in `selection.js` builds it from the DynamoDB `archive#YYYY-MM-DD` rows in `NewsCache` that `newsIngest` already reads (`readArchiveEntries`, `index.js`): today plus the 14 days before (15 GetItems; the read was 7 days before), keeping `threadId`. One numbered line per thread: `S12 · 2026-11-17 · 4 · <newest title> (began: <oldest title>)` (number, last entry date, entries in the window, newest title; the "began" part only when the oldest title differs). Stories with 2 or more entries come first, then single-entry stories, newest first in each group. Cap 350 lines (`FOLLOWED_CAP`); the cap cuts the oldest single-entry stories. The run logs `FOLLOWED: n stories listed, m cut`. Numbers are per run. The old "NARRATIVE CONTINUITY" block is gone; the seen-today list stays in code for the repeat drop.
3. **The model names a story by number.** The answer field is `follows: "S12"`, left out for a start. Code (`processSelection`) maps a listed number to `continues_thread` (the story's thread id) and `continues_topic` (its listed title). An unknown number is dropped and logged (`FOLLOWS: unknown "S99"`). The model never copies a title. Rule 6 says to name a story only when the event plainly belongs to it, to leave `follows` out when unsure, and, when several listed stories cover the same situation, to name the one with the most entries.
4. **Rules text.** The picking rules are those of 0062 draft commit `10f2d27a` (cherry-picked: who reads the output, a reason for each rule, a hard topic limit with its consequence, every reporting article listed as a source), with the three kinds, rule 6, a "measured change" title example and the field list above on top. Two later revisions follow the replay (commits `46b7ce6d`, `7d055ca0`): the list is written in order of significance; sharper leave-out examples; what "same situation" means (the same talks, campaign or scandal, not the same country or war); titles built only from their own source articles; quiet moves never displace floor events. The answer cap `maxTokens` goes from 12000 to 16000.
5. **`newsAgent` joins by thread id first** (`threading.js` `matchThread`). A topic with a usable `continues_thread` (`thread-...`) joins that thread whatever the age of its last entry, `via: 'continues_thread'`. A malformed value is ignored and logged. Without it the join is unchanged (title, then keyword score in the 7-day window). A story quiet for more than 14 days and then back is still a new story.
6. **The builder stamps `role` on each entry.** `newsStoryRecord` (`src/views.js` `entryRows`, schema `schema/views/story.schema.json`) sets `role` on every non-article row of a story view, over all rows before the 400-entry cap:
   - the first non-article row in the order we first recorded the rows (`recordOrder`: archive day, then place in that day's list, then record date, `at`, eventId; merged-in entries included) is `start`; every later one is `move`. The record date is not the first key: it is the earliest source's publish time, so a step recorded later can carry an earlier date. The story's title keeps `entryOrder`. (Corrected 2026-11-19 on the branch, before any deploy: under the first wording a later run could take the start. A merge, a reassignment, a story written late (0061), a backfilled archive day or a missing archive key can still move a start.);
   - an entry whose `eventType` is `measure` is `measure`, wherever it stands;
   - the first row is null instead of `start` when the `story_born` fact of its story says `windowLimited` (the story may be older than the record);
   - article rows carry no `role`. A merge or reassignment re-labels on the next build.
   The label says the entry's place in our record, so a topic the model called a start but the agent joined to a story is `move`. The agent's join is not changed by it. This is 0058's rule: the builder stamps, pages display.
7. **The story page shows the label.** `src/shared/ui/EntryRole.jsx` renders the word (START, MOVE, MEASURED CHANGE) in the existing `.gp-cat` class without the dot; MEASURED CHANGE also carries the MODEL JUDGMENT tag (0012), because "measured change" is the model's call; START and MOVE come from the order of our record and carry no tag. Null or unknown renders nothing. It shows on the chapter slide (desktop and phone), the compact timeline rows, the opened entry card and the plain list in Read in full. `viewEntries.js` passes `role` through; the 90-day archive fallback has none, so no label.
8. **Links into the story page.** The FED INTO slide in story mode lists both directions (the stories this feeds into and the earlier news judged to feed in). Map story links open the normal story page again, not the Read in full view (commit `21274c77`, undoes `53ae49b6` of 2026-11-09). The "From the story" title in the map's situation detail and the track-record text page's "because" event link to their story (`31ea5328`, `63185ee5`).
9. **Local fixture.** `npm run dev:fixture` serves a record-views fixture (`fixtures/record-views/`, one story with start, move, measure, a written-late entry, an article row and a merged-in entry, plus links in both directions); nothing ships in the build. A test checks its entry keys against `story.schema.json`.

## What changes (code, nothing deployed)
| Part | Where | Change |
|---|---|---|
| `newsIngest` | `backend/pipeline/newsInvokeGemini/src/{selection.js,index.js}`, README | prompt, `followedStories`, `follows`, `measure`, 14-day archive read with `threadId`, cap 16000, repeat-drop log line carries the story number |
| `newsAgent` | `backend/pipeline/NewsProjectInvokeAgentLambda/src/threading.js` | `continues_thread` joins first |
| `newsStoryRecord` | `backend/record/newsStoryRecord/src/views.js`, `schema/views/story.schema.json`, golden, README | `role` |
| recovery script | `backend/record/cli/recover-late-lib.mjs` | uses the same `followedStories` (0061's script) |
| frontend | `EntryRole.jsx`, `features/threads/**`, `features/map/**`, `features/track-record/TrackRecordText.jsx`, `vite.config.js`, `fixtures/` | label, FED INTO both ways, links, fixture |

The repeat drop (`dropRepeatTopics`, Jaccard 0.5 against today's and yesterday's titles) is unchanged. Reason: a repeat is a move of the same story, and exempting moves would reopen the hole 0040 closed. Only its log line gains `[follows S12]`.

## Relation to 0062
0062 exists only on a side branch (commit `f6505163`, "proposed, not in effect") and is not in this branch. 0063 takes over **only its `newsIngest` part**: Decision 1 of 0062 (topic selection stays on Sonnet and gets the clearer prompt) and the code behind it (commit `10f2d27a`). One difference: 0062 left the ingest `maxTokens` at 12000; 0063 raises it to 16000 (outputs reached 10,800 live and 11,098 in 0062's test). **Not taken over, still open under 0062:** the cause chain on Opus 5.5 (with `TRACE_CAUSE_MODEL`, `TRACE_CAUSE_MAX_TOKENS`, the `llm.js` Opus rule and the price entry), the drift note on Sonnet 5.5, and the prompt changes for those two jobs. Nothing here depends on them.

## Evidence (measured 2026-11-18/19)
**Builder shadow rebuild** (`.board/reviews/story-kinds-plan-2026-11-18/shadow/REPORT.md`): old and new builder over a copy of the full record, 10,169 files each side. The only change is `role` added in 3,886 story views (plus `digests.json`, whose changes are the checksums of those files). Role counts: 3,886 start, 2,981 move, 0 measure, 0 null. No story has two starts. All 4,565 story views with entries pass the schema. Size +0.13%. **Not exercised on live data:** the `measure` and the `windowLimited` (null) paths; live data has neither. They ran in unit tests only.

**Paid replay** (`.board/reviews/story-kinds-plan-2026-11-18/replay/`): 7 real news runs (16 to 18 Nov 2026), 2 runs each, 3 rounds, Sonnet 5.5, the real `selectionRequest`, `selectionChatOptions` and `processSelection`, 42 calls, 8.057510 USD of a 10 USD cap. The rule text was revised after rounds one and two (`46b7ce6d`, `7d055ca0`). Final-text results, round three:
- No parse failures, no cut-off answers.
- 109 of 109 `follows` numbers valid.
- Said-not-done titles 19.7%, against a 24.4% baseline (same regex).
- One measure pick: "US loses measles elimination status", correct.
- Repeat drop: it drops all restatements; repeat-drop code left unchanged.

**Two pass lines FAIL as written:**
- **P4 (same story as the live join): FAIL.** The new pick lands in the same story as the live join in 50 of 71 cases (70.4%); the line was 80%. Clear mistakes are 2 of 71 (2.8%) against a limit of 10%, which passes. Almost all the gap is the live record having one situation split across several stories (Iran war, Ukraine talks, Nvidia), so the model picks one of several defensible stories. This build does not merge them (see below).
- **P5 (live picks left out): FAIL.** Live picks are still left out, about 3 to 4 of 13 per run in every round. That is the same size as the difference between two runs of the same rules (about 70 of 90 picks match). One floor event, "China and Canada Agree Fresh Tariff Relief as Xi and Carney Meet Ahead of APEC Summit", was missed in every run of every round.

**Known remaining faults:** one over-join in 14 runs (a drone attack put on the peace-talks story); one title that begins with a label and a colon; a quiet move sometimes left out of a list that had room.

**Not exercised by any test on live data:** the deployed Lambda zips and settings. A first live builder run rewrites every story view once (the digest changes; about 9,300 PUTs).

## What is not done
- **Old split or wrongly grouped stories are not merged.** 0040 forbids automatic reassignment; the weekly review's merge repair stays the only path. This is the main cause of the P4 gap.
- **The list depends on the `archive#` rows.** See Dependencies.
- **Theme pages** (0058 steps 5 to 9) are not built. A second theme mock exists under `.board/` only; the route and page wait for the design talk.
- **The briefing writer does not stamp a story id.**
- **The "X trends" fallback prompt that 0057 forbids is still in `selectionRequest`** (`selection.js`, for a run with no articles at all).
- **Ingest capture does not record `follows`** (`captureIngestion` in `index.js` writes title, category, regions, `threadId` and source URLs).
- **`quality/analysis/prompt_fixes_ingest.mjs` still passes `pastArchiveTitles`** to `buildSelectionPrompt`, which no longer takes that argument (it takes `stories`). It is not changed here.
- The prompt pool (newest 8 items per feed, same-event items collapsed) is unchanged.
- The repeat-drop code is unchanged.

## Dependencies
- **The followed-story list reads the `archive#` rows in `NewsCache`.** Decision 0051 step 5 plans to retire those rows (and `today-archive`). If they are retired before `newsIngest` is moved to read the record (the entries inbox or the story views), the list is empty: `readArchiveEntries` logs the failed read, the prompt shows `(none)`, every pick becomes a start and `continues_thread` is never set. The run does not fail, but the feature stops without an error. Step 5 therefore needs a replacement source for this list first. The list also needs the agent to keep writing `threadId` on the archive entries.
- **The 0061 outage-recovery note** says the selector's archive titles are always read from DynamoDB; the same holds for this list, so late-written stories (0061) are not on it until the rows exist for them.
- Order of deploy matters (below): the builder and agent must be ready before the picker sets `continues_thread`.

## Rollout (nothing is deployed; each step needs the operator's yes in that message)
Readers before writers. Offline checks first (`node --test` in each package, `npm run verify`).
1. `newsAgent` (reads `continues_thread`; does nothing while it is absent). Check: next run's `[join]` lines and run time are normal. Diff deployed against the repo first (`scripts/lambda.sh newsAgent diff`).
2. `newsStoryRecord` (stamps `role`; start and move show on old data at once). Check: the next refresh Run is `ok` and a public story view has `role`. The first run rewrites every story view once.
3. `newsIngest` last. Check: the next run logs `FOLLOWED`, `finish_reason stop`, tokens under the cap; ten minutes later the agent's `[join]` shows `via: continues_thread`. Watch the number of picks (fewer than 13 is expected) and the share of floor events picked.
4. Frontend: `./deploy.sh --target candidate`, click every changed control in a browser (story mode slides, phone tabs, Read in full, FED INTO both ways, each changed link, signed out, 1440 and 390 px), then `--target production`. The label shows nothing until step 2 has run.

## Rollback
In reverse: frontend (restore the previous Worker version; a new push alone is not a rollback), then `newsIngest`, `newsStoryRecord`, `newsAgent`, each with `scripts/lambda.sh <name> rollback`. Entries already written with `event_type: "measure"` stay in the facts (append-only, 0036). Without the builder stamp the page shows no label and fails empty. The map-link change is its own commit (`21274c77`) and can be reverted alone.

## Consequences
- 0040's selector rules are amended: the done-not-said rule and the floor stay; "does it start or move a story" and the measured change are added, and one-offs are left out. A story gets entries by the model's `follows` first, then by the agent's old rules.
- The prompt grows by the list: up to 350 lines. The replay's 42 calls used 53,884 to 61,122 input tokens each and cost 0.18 to 0.21 USD each at the ledger's Sonnet prices (`replay/ledger.jsonl`); the live cost per day is not measured.
- The record gets `event_type: "measure"` entries for the first time. The plan found no reader that branches on `eventType` (`plan-proposal.md` section 2, read on `main`; not re-checked here).
- A story's label can change after a merge or reassignment, on the next build.

Source: code on branch `story-kinds` (14 commits ahead of `main`, `git log main..story-kinds`); `.board/reviews/story-kinds-plan-2026-11-18/{settled.md,plan-proposal.md,shadow/REPORT.md,replay/}` (local, not in git); 0062 as of commit `f6505163`.
