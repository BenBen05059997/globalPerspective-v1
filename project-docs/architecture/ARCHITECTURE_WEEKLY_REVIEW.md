# The weekly review

Status: design adopted by the operator 2026-10-22. Code in `backend/record/newsRecordReview`. Decision: [0039](../decisions/0039-weekly-review.md). Place in the system: [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md). Code and live AWS stay the truth (deployed state, rule state and run results: read them from AWS).

## 1. Why
Facts say what happened each day. They do not say what a story means, which chapter it is in, whether a forecast branch fired, or which stories drive each other. That needs hindsight, so it runs once a week: one model call per active story reads the story's facts and its own earlier readings and writes readings. Every reading cites facts; code rejects what it cannot check. Readings are append-only and a rerun supersedes.

## 2. The loop
```text
WEEKLY REVIEW LOOP  (Monday 01:00 UTC, after the ISO week ends · one call per active story · decision 0039)
|
+- 1 SELECT     no model            [newsRecordReview]
|  +- inputs : record/views/index/active.json, record/views/manifest.json (must be built for the week's last day)
|  +- rule   : active stories only; skip a story with no new fact since its last reading unless a branch got a verdict;
|  |           facts are placed as the views place them (shared placement.js): latest assignment, merged stories folded into the survivor
|  +- output : the week's story list
|
+- 2 ASSEMBLE   no model            [newsRecordReview]
|  +- inputs : the story's facts (record/facts, all days of the story, entries capped at the newest 60), its last readings
|  |           (record/readings), verdict facts, the operator alias file; placed recovered articles are headline-only items (prompt review-4)
|  +- output : one bundle per story; every fact carries its eventId so the model can cite it
|
+- 3 READ       model, boxed        [newsRecordReview]
|  +- rule   : returns JSON only: line, chapters (no dates), links, merge proposal, alias proposals
|  |           every item cites >= 1 eventId from THIS bundle (links: >= 1 from each story); no citation -> item rejected
|  +- model  : DeepSeek larger model (env); a stub model in tests and in the golden-week run
|
+- 4 CHECK      no model            [newsRecordReview]
|  +- rule   : citations exist and belong to the story (or both stories for a link); chapter dates = the dates of its cited facts;
|  |           merge auto-allowed only under the merge rule below
|  +- output : accepted readings, rejected items with reason (kept in the review Run)
|
+- 5 WRITE      no model            [newsRecordReview -> record/readings/ ; merges -> record/inbox/merges/]
|  +- record/readings/YYYY-Www.jsonl   one line per accepted reading (append-only per week; a re-run supersedes)
|  +- record/runs/review-YYYY-Www.json  started -> ok | partial | failed, counts, rejections
|  +- record/inbox/merges/YYYY-MM-DD.jsonl  accepted auto-merges, for newsStoryRecord to turn into story_merged facts
|
+- 6 BUILD      no model            [newsStoryRecord, nightly]
|  +- reads readings + inbox merges + operator aliases; fills line, chapters, confirmedLinks in the views;
|  |   applies story_merged / story_split; applies aliases to actorIds in views only (facts never rewritten)
|
+- LOOP BACK : new entries all week -> nightly facts and views -> Monday review reads them with hindsight -> views show it
```

## 3. Stages in detail
1. Select. Reads the active index (any fact in 60 days) and the views manifest; if the manifest is not built for the week's last day the run is `failed` and writes nothing. A story with no new fact since its last reading is skipped, unless a branch received a verdict that week.
2. Assemble. Facts for the story across all its days, entries capped at the newest 60; the story's previous readings; verdict facts; the alias file. Each fact is shown with its `eventId`. No other input: no raw tables, no DynamoDB, no search.
3. Read. One call, JSON only. The model proposes: a `line` (one sentence, at most 200 characters), `chapter`s ({title, summary at most 300, cites}; the code sets from/to from the cited facts), `link`s ({otherThreadId, mechanism at most 200, direction drives|driven_by|shared_cause}), a `merge_proposal` ({otherThreadId, why}), `alias` ({variants, canonical, wikidataId}), `assignment` ({entryId, threadId, why}: an entry that belongs to another story; a proposal only). Model: DeepSeek larger model, env `REVIEW_MODEL`, through the shared `llm.js`.
4. Check. Pure code. An item is rejected, with a reason kept in the Run, when: it has no citation; a cited `eventId` is not in the bundle (a link needs one from each story); a chapter cites no dated fact; an auto-merge fails the merge rule. Branch status is not a reading: a branch's status is its verdict fact, else open or past due by its `due` date, derived where it is shown.
5. Write. Accepted readings are appended to the week file; the review Run records counts and rejections; accepted auto-merges go to the inbox. Readings are never edited. A rerun for the same week writes readings whose `supersedes` points at the earlier `readingId`.
6. Build. Not the review's job: `newsStoryRecord` rebuilds all views nightly and now also reads readings, inbox merges, `story_split` facts and the alias file.

Merge rule (auto-merge only if all hold): the two stories share a specific actor (the 5% rule of 0037) and a country; their entries are within 14 days; the reading cites entries from both; confidence is high. The older story survives. Otherwise the reading stays a `merge_proposal`, shown to the operator and not applied.

## 4. Objects and where they live
| Object | Where | Shape and rules |
|---|---|---|
| Readings | `record/readings/YYYY-Www.jsonl` | One line: `{schemaVersion:1, readingId: sha1(week+threadId+subtype+key), week, threadId, subtype: line\|chapter\|link\|merge_proposal\|alias\|assignment, payload, cites[eventId], covers{from,to}, supersedes: readingId\|null, run, model, promptVersion, confidence: high\|medium\|low}`. Append-only per week |
| Review Run | `record/runs/review-YYYY-Www.json` | started, then ok \| partial \| failed; counts; rejected items with reasons. The one mutable object |
| Inbox merges | `record/inbox/merges/YYYY-MM-DD.jsonl` | `{from, into, at, reason, cites, readingId}`; `newsStoryRecord` turns each into a `story_merged` fact |
| Operator aliases (the who's who file) | `record/operator/aliases.json` | `{schemaVersion:1, aliases:[{canonical:'name:...', variants:['name:...'], wikidataId\|null}]}`; written only by the operator |
| `story_split` | fact kind, via the inbox | `{from, into, at, reason}`; operator only; cancels a merge in the views |
| Golden week | `backend/record/newsRecordReview/fixtures/golden-week/` | frozen facts 2026-10-13..10-19 plus earlier facts of those stories, and expected readings |

Alias rule: review alias readings apply only with a Wikidata Q-number and no conflict with the operator file; otherwise they are proposals. The operator file wins; canonical ids in the views are `wd:Q...`. Aliases are applied by the view builder to `actorIds` (and to the links specificity rule); facts are never rewritten.

## 5. Ownership
- `newsRecordReview` writes readings, review Runs and inbox merges. It reads facts, views index and manifest, its own earlier readings and the alias file. It writes no view and no fact.
- `newsStoryRecord` is the only view builder. It reads readings, inbox merges, `story_split` facts and aliases, fills the reading fields in the views, and converts inbox merges into `story_merged` facts.
- The operator writes `record/operator/aliases.json`, `story_split` lines (`record/inbox/splits/`) and applies assignment proposals through `record/inbox/assignments/`; the review writes neither.
- Two writers never share a file.

## 6. Verification
- Golden week: the Lambda runs against the frozen fixture with a stub model in tests (deterministic).
- Expected readings are drafted by two independent Claude Opus agents and checked by the operator, the method of the judge benchmark.
- A scored run compares a real model's readings to the expected ones: citation validity must be 100%; line and chapter agreement is judged by the two Claude judges.
- Citation checks run on every live item (stage 4); the rejection rate is in the Run.
- Operator check: merge proposals and alias proposals are read by the operator; first live weeks are spot-checked.

## 7. Limits
- A reading is a model judgment. Citation and date checks prove it points at real facts, not that it is right.
- Entries are capped at the newest 60 per story; older context comes only from earlier readings.
- Live gate (met 2026-10-31): golden-week gates passed (prompt review-4), a live canary on 5 stories checked by the operator, then the rule (Monday 01:00 UTC) enabled with the operator's yes.
- Branch status comes from verdict facts of the forecast loop (0038), never from the review.
- Not now: the weekly report reading the readings (lane weekly), retiring `newsWeeklyBrief`.

## 8. Decisions
[0039](../decisions/0039-weekly-review.md) (this loop), [0035](../decisions/0035-facts-are-the-system-of-record.md) (two clocks), [0036](../decisions/0036-facts-file-format.md) (kinds, Run), [0037](../decisions/0037-views-from-facts.md) (views, one builder), [0038](../decisions/0038-forecast-loop.md) (verdicts the review reads).

## 9. The analyst's weekly (the published brief)
The weekly brief is a view of the week's readings, written as an argument, not a digest of the most-covered stories. Design (operator, 2026-10-20); the content model is in code: `backend/weekly/sections.js` and `backend/weekly/schema/weekly.schema.json` (v2). Code is the truth for caps and fields.

Why a reader opens it: not to miss a change in what they follow; to check their read against a dated, labelled view and later see who was right; to lift a sourced line into their own note.

Sections, in order: lead (the week's most important change as an argument: what happened, what we now expect, what would prove us wrong); where our view moved (one line per story, before to after with the mechanism, "none this week" stated); the trace (up to five anchor stories: where it was, is, goes, with the branches we drew); next week's dates; new this week (cap 3, events only); what we did not see (coverage). No scoreboard and no Brier number in the weekly; that stays on `/track-record`. "Moved" means a change in the expected path or a risk move that holds, only for stories at moderate risk or above. Selection is never by coverage volume.

Honesty rules (enforced by the check script when it exists):
- A fact line carries at least one archive source (date plus entry id or URL); no figure, date or name that is not in the cited source.
- Every non-fact line is labelled `judgment` with a confidence; every judgment is one plain sentence with the mechanism spelled out, no internal terms.
- A link between stories is `possibly_related` unless it is defensible (typed link from the review).
- A test or watch date is after the send date.

Publication: publish unless vetoed. There is no human gate (consistent with 0034); the operator may veto, which writes `status: held`. Enabling the sender on the new path is a user-facing send and needs a fresh yes.

Storage (world data, so S3 per [DATA_STRATEGY.md](DATA_STRATEGY.md)): `weekly/YYYY-MM-DD.json` (week ending; status draft | published | held, create-only) and `weekly/latest.json` (newest published). The email sender and the future `/briefings/weekly?week=` page read these files, not DynamoDB.

Code layout: one backend source of truth, `backend/weekly/`. `newsEmailSender` imports it through a `_weekly` symlink (as `_shared`); the frontend mirror is checked by `scripts/check-shared-sync.mjs`. A headless scheduled Claude Code run (cloud, skill in the repo, IAM scoped to read the tables and bucket and write `weekly/*` only) is the intended author. The old `newsWeeklyBrief` Lambda retires after one new-path send.

Built so far: the content model (W0, on main). The pull, check and publish scripts, the skill, the email renderer (W1-W3) and the cloud routine live on the unmerged branches `lane/weekly` and `lane/routine`; they pull live tables and must be reviewed against the readings before merge. The page (W5) and retirement (W6) are not built. Known gaps the weekly cannot paper over: no corrections store, first reads are thin for stories born in the week, country drift notes are shown nowhere, and every story link is model-inferred until the review confirms it.
