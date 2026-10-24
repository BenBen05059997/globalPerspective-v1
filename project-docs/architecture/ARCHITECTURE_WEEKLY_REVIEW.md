# The weekly review

Status: design adopted by the operator 2026-10-22. Code in `backend/record/newsRecordReview`; created in AWS 2026-10-23 (function, role `newsRecordReview-role`, rule `TriggerRecordReview` DISABLED), no readings written yet; `functions.json` entry and first-deploy runbook in `backend/record/newsRecordReview/DEPLOY.md`. Decision: [0039](../decisions/0039-weekly-review.md). Place in the system: [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md). Work order: `plans/PLAN_2026-10-21_foundation.md`, step 3. Code and live AWS stay the truth.

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
|  |           (record/readings), verdict facts, the operator alias file; placed recovered articles are headline-only items (prompt review-3)
|  +- output : one bundle per story; every fact carries its eventId so the model can cite it
|
+- 3 READ       model, boxed        [newsRecordReview]
|  +- rule   : returns JSON only: line, chapters, branch status, links, merge proposal, alias proposals
|  |           every item cites >= 1 eventId from THIS bundle (links: >= 1 from each story); no citation -> item rejected
|  +- model  : DeepSeek larger model (env); a stub model in tests and in the golden-week run
|
+- 4 CHECK      no model            [newsRecordReview]
|  +- rule   : citations exist and belong to the story (or both stories for a link); dates inside the chapter span;
|  |           branch status only for branches of the story; merge auto-allowed only under the merge rule below
|  +- output : accepted readings, rejected items with reason (kept in the review Run)
|
+- 5 WRITE      no model            [newsRecordReview -> record/readings/ ; merges -> record/inbox/merges/]
|  +- record/readings/YYYY-Www.jsonl   one line per accepted reading (append-only per week; a re-run supersedes)
|  +- record/runs/review-YYYY-Www.json  started -> ok | partial | failed, counts, rejections
|  +- record/inbox/merges/YYYY-MM-DD.jsonl  accepted auto-merges, for newsStoryRecord to turn into story_merged facts
|
+- 6 BUILD      no model            [newsStoryRecord, nightly]
|  +- reads readings + inbox merges + operator aliases; fills line, chapters, branchStatus, confirmedLinks in the views;
|  |   applies story_merged / story_split; applies aliases to actorIds in views only (facts never rewritten)
|
+- LOOP BACK : new entries all week -> nightly facts and views -> Monday review reads them with hindsight -> views show it
```

## 3. Stages in detail
1. Select. Reads the active index (any fact in 60 days) and the views manifest; if the manifest is not built for the week's last day the run is `failed` and writes nothing. A story with no new fact since its last reading is skipped, unless a branch received a verdict that week.
2. Assemble. Facts for the story across all its days, entries capped at the newest 60; the story's previous readings; verdict facts; the alias file. Each fact is shown with its `eventId`. No other input: no raw tables, no DynamoDB, no search.
3. Read. One call, JSON only. The model proposes: a `line` (at most 200 characters), `chapter`s ({title, from, to, summary at most 300}), `branch_status` ({branchId, status fired|dead|holding|late, why}), `link`s ({otherThreadId, mechanism at most 200, direction drives|driven_by|shared_cause}), a `merge_proposal` ({otherThreadId, why}), `alias` ({variants, canonical, wikidataId}), `assignment` ({entryId, threadId, why}: an entry that belongs to another story; a proposal only). Model: DeepSeek larger model, env `REVIEW_MODEL`, through the shared `llm.js`.
4. Check. Pure code. An item is rejected, with a reason kept in the Run, when: it has no citation; a cited `eventId` is not in the bundle (a link needs one from each story); a chapter date lies outside the story's span; a branch status names a branch the story does not have; a status contradicts a verdict fact (a `yes` verdict means `fired`, a `no` means `dead`; the model may set `holding` or `late` only for open branches); an auto-merge fails the merge rule.
5. Write. Accepted readings are appended to the week file; the review Run records counts and rejections; accepted auto-merges go to the inbox. Readings are never edited. A rerun for the same week writes readings whose `supersedes` points at the earlier `readingId`.
6. Build. Not the review's job: `newsStoryRecord` rebuilds all views nightly and now also reads readings, inbox merges, `story_split` facts and the alias file.

Merge rule (auto-merge only if all hold): the two stories share a specific actor (the 5% rule of 0037) and a country; their entries are within 14 days; the reading cites entries from both; confidence is high. The older story survives. Otherwise the reading stays a `merge_proposal`, shown to the operator and not applied.

## 4. Objects and where they live
| Object | Where | Shape and rules |
|---|---|---|
| Readings | `record/readings/YYYY-Www.jsonl` | One line: `{schemaVersion:1, readingId: sha1(week+threadId+subtype+key), week, threadId, subtype: line\|chapter\|branch_status\|link\|merge_proposal\|alias\|assignment, payload, cites[eventId], covers{from,to}, supersedes: readingId\|null, run, model, promptVersion, confidence: high\|medium\|low}`. Append-only per week |
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
- Not run live until the DeepSeek top-up, a passing golden-week score and a 2-3 story canary (`threadIds`); then the rule (Monday 01:00 UTC, disabled) is enabled with the operator's yes. Deployed: function, role, `REVIEW_MODEL=deepseek-v4-pro`; a 2026-W42 dry run selected 502 of 519 active stories and skipped 17 (`no_facts_by_week_end`).
- Branch status depends on verdict facts from the forecast loop (0038); until verdicts exist, branches stay `holding` or `late`.
- Not now: the weekly report reading the readings (lane weekly), retiring `newsWeeklyBrief`.

## 8. Decisions
[0039](../decisions/0039-weekly-review.md) (this loop), [0035](../decisions/0035-facts-are-the-system-of-record.md) (two clocks), [0036](../decisions/0036-facts-file-format.md) (kinds, Run), [0037](../decisions/0037-views-from-facts.md) (views, one builder), [0038](../decisions/0038-forecast-loop.md) (verdicts the review reads).
