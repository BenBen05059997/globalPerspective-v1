# 0039. The weekly review: readings by one model call per story, one view builder

Status: accepted (operator, 2026-10-22; implements step 3 of 0035; amends 0036 kinds and 0037 section 2)
Date: 2026-10-22

## Context
0035 gives the system a weekly clock: facts are daily, readings are the weekly understanding with hindsight. Step 3 builds the Lambda that writes them. Open questions were the model, whether the review may merge stories, how spelling variants of an actor become one, and how to test a model Lambda before it runs live. Design: `architecture/ARCHITECTURE_WEEKLY_REVIEW.md`.

## Decision
Four operator decisions:
1. Model: DeepSeek larger model through the shared `llm.js` (provider deepseek, model from env `REVIEW_MODEL`). One call per active story per week. It does not run live until the DeepSeek top-up and a passing golden-week score.
2. Merges: the review may auto-merge two stories only if all hold: they share a specific actor (the 5% rule of 0037) and a country, their entries are within 14 days, the reading cites entries from both, and confidence is high. The older story survives. Anything else stays a `merge_proposal` reading, shown to the operator and not applied. Undo is a new fact kind `story_split`, written by the operator only; views treat a split as cancelling the merge.
3. Aliases: the operator file `record/operator/aliases.json` wins. A review alias reading applies only with a Wikidata Q-number and no conflict with the operator file; otherwise it is a proposal. Aliases are applied by the view builder to `actorIds` in views; facts are never rewritten.
4. Testing: a golden week. Real facts for 2026-10-13..2026-10-19 are frozen as a fixture with expected readings drafted by two independent Claude Opus agents and checked by the operator. Tests run the Lambda against it with a stub model; a scored run compares a real model's readings to the expected ones.

The reading object, one JSONL line in `record/readings/YYYY-Www.jsonl`: `schemaVersion`, `readingId` = sha1(week + threadId + subtype + key), `week`, `threadId`, `subtype` (`line`, `chapter`, `branch_status`, `link`, `merge_proposal`, `alias`), `payload`, `cites[eventId]`, `covers{from,to}`, `supersedes`, `run`, `model`, `promptVersion`, `confidence`. A reading with no valid citation is rejected; a branch status must agree with verdict facts.

Changes to earlier decisions:
- 0037 section 2 said `newsRecordReview` would own the story views from step 3. Changed: `newsStoryRecord` stays the only view builder and reads readings; the review writes readings, review Runs and inbox merges only.
- 0036 kinds: add `story_split` {from, into, at, reason}. Inbox kinds: add `merges`.

## Rejected
- The review writes the views itself: two builders and two writers for one tree; one builder means one rebuild path and one rebuild test.
- Merges always automatic: a wrong merge fuses two stories' history; only the narrow rule above is safe without a human.
- Aliases that rewrite facts: breaks append-only; a wrong alias would be unrecoverable. Views apply aliases and can be rebuilt.
- Testing only live: costs model calls and shows errors to readers first; a frozen week is repeatable and diffable.

## Consequences
- Needs: Lambda `newsRecordReview` (IAM, Monday 01:00Z schedule (amended 2026-10-22: the review reads the ISO week that just ended, so it runs after Sunday; a Friday run would read the previous week), model key, each an operator yes), the golden-week fixture, builder changes in `newsStoryRecord` (readings, inbox merges, `story_split`, aliases).
- The review's typed links replace the planned `newsSystemsAnalysis` typed-links field (dropped).
- Limits: a reading is a model judgment checked for citations and dates, not for truth; quality is measured on the golden week and by operator spot check.

## Amended by 0040 (2026-10-22)
`assignment` proposal subtype; recovered articles used when re-running a week.

## Amended 2026-10-31 (golden-week score)
The first scored run (DeepSeek, prompt review-3) failed: 4-5 of 27 stories cut off at 3000 tokens, 45 rejected items (30 fired/dead on open branches, 9 chapter dates outside the cited facts), and 126 `holding` statuses that headlines cannot support. Changed (operator: "if there is a better design, do it"):
- No `branch_status` reading. fired/dead only restated the verdict, late is date arithmetic, holding was unsupported. A branch's status is its verdict fact, else open or past due by `due`, derived where it is shown.
- Chapter `from`/`to` are set in code from the dates of the cited facts; the model writes title, summary, cites.
- `maxTokens` 6000; prompt review-4 (line at most 30 words; chapters group several entries, do not overlap).
- Testing: instead of a reconciled two-drafter answer key for every story, the score is objective gates (no failed story, no citation rejection, no rule-breaking subtype) over three runs, plus an operator spot check of a few stories and the canary. The two Opus drafts of 2026-10-30 were lost with the temp folder; their findings are in the fixture README.

