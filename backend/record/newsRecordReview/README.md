# newsRecordReview

The weekly review. For the ISO week that ended, every active story gets one boxed model call; the answer is checked in code; accepted items become readings with hindsight. Output: `record/readings/YYYY-Www.jsonl`, the Run `record/runs/review-YYYY-Www.json`, and accepted auto-merges in `record/inbox/merges/YYYY-MM-DD.jsonl`. The review is the only writer of those keys. It never writes facts or views (`newsStoryRecord` builds the views from readings) and never touches DynamoDB. Design: decision 0039 (written from the operator-approved step 3 spec, 2026-10-22). Status: live since 2026-10-31. Rule `TriggerRecordReview` cron(0 1 ? * MON *) ENABLED with payload `{"shadow":false}`, env `REVIEW_CONCURRENCY` 12 (a week has about 520 active stories; 6 in flight needed about 870 s of the 900 s). Prompt review-4 passed the golden-week gates (fixture README); live canary 2026-W43 on 5 stories (operator checked); first full run 2026-11-02 for 2026-W44.

## The loop

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
|  +- rule   : returns JSON only: line, chapters (title, summary, cites; no dates), links, merge proposal, alias proposals
|  |           assignment proposals: an entry that does not belong to the story, with the story it belongs to (or new); a flag only
|  |           every item cites >= 1 eventId from THIS bundle (links: >= 1 from each story); no citation -> item rejected
|  +- model  : DeepSeek larger model (env); a stub model in tests and in the golden-week run
|
+- 4 CHECK      no model            [newsRecordReview]
|  +- rule   : citations exist and belong to the story (or both stories for a link); a chapter's from/to = the dates of its cited facts;
|  |           merge auto-allowed only under the merge rule below;
|  |           assignment: entry of this story, or a cited neighbour entry; target an active story or new; written as a reading, never applied
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

## What a run does

1. Writes `runs/review-WEEK.json` with `status:"started"` (a review Run left at `started` is the alarm).
2. Select: reads `views/manifest.json` (its `factsThrough` must reach the week's Sunday, else the run fails) and `views/index/active.json`; reads every facts day in `facts/manifest.json` up to that Sunday once; reads the operator aliases (missing = empty) and the readings of the 8 weeks before. Skips a story with no `entry` or `verdict` fact newer than its last reading's `covers.to` (reason `no_new_fact`, listed in the Run).
3. Assemble: per story, entries (newest 60, `entriesOmitted` says how many were cut), forks (newest 10) with each branch's verdict (legacy `issued_before_method` voids dropped), corrections, merges, the story's latest earlier readings, the operator aliases that touch its actors, and up to 5 neighbouring stories (specific shared actor or country, within 14 days) with their 3 newest entries, so a link or merge can cite both sides.
4. Read: one call per story through shared `llm.js` (provider `deepseek`, model `REVIEW_MODEL`, `json:true`, `maxTokens` 6000, temperature 0, 6 in flight). `src/prompt.js` holds the prompt and `PROMPT_VERSION`; the answer shape is `schema/model-output.schema.json`. A failed call or a non-JSON answer fails that story only (recorded; its old readings stay).
5. Check (`src/check.js`), then write: the week's file is rewritten whole (other stories' stored lines kept, the stories read this run replaced), then the inbox, then the Run (`ok`, `partial` or `failed`). The handler throws when the Run is not `ok`, so the schedule's Errors metric moves.

| Check | Rejects with |
|---|---|
| no cites / an eventId not in the bundle | `no_citation` / `unknown_eventId` |
| link or merge not citing both stories, or an unknown other story | `cites_not_from_both` / `unknown_story` |
| link the model rates `low` confidence | `low_confidence` |
| chapter citing no dated fact (its span comes from the cited facts) | `no_dated_citation` |
| alias without a Q-number, with an actor not in the bundle, conflicting with the operator file, or already in it | `alias_no_wikidata`, `alias_unknown_actor`, `alias_conflicts_operator`, `alias_in_operator_file` |
| assignment proposal: entry neither shown in this story nor a cited neighbour entry, a target that is not an active story (or `new`), or the entry's own story | `entry_not_in_scope`, `unknown_story`, `already_assigned` (and `unknown_eventId` for any cite the model was not shown) |
| wrong shape or length (line 200, chapter summary 300, mechanism 200), repeat of the same item, over the per-story cap | `bad_shape`, `duplicate`, `over_cap` |

Merge rule (the 5% rule of 0037): a `merge_proposal` is always a reading; it also goes to the inbox only if the two stories share a specific actor (fewer than 5% of active stories carry it) and a country, their last entries are within 14 days, the reading cites both stories, and confidence is `high`. The older story (earlier `born`) survives. One inbox line per pair and per `from` story.

Assignment proposals (0040 rule 3, operator answer 6: proposals only): reading subtype `assignment`, payload `{entryId, threadId, why}` where `threadId` is an active story or `new`; key = `entryId`; cap 5 per story. They are written to the readings file and nothing else: no inbox line, no fact, no view change. The operator applies one by writing a line `{entryId, threadId, by:'operator', at, reason}` to `record/inbox/assignments/DAY.jsonl`, which `newsStoryRecord` turns into an `assignment` fact. The prompt is `review-4` (recovered article headlines placed on a story are bundle items marked `kind:"article"`, citable, no detail).

Reading: `{schemaVersion, readingId, week, threadId, subtype, payload, cites, covers:{from,to}, supersedes, run, model, promptVersion, confidence}` ([schema](schema/reading.schema.json)). `readingId = sha1(week + threadId + subtype + key)` with key = chapter `from`, `branchId`, `otherThreadId`, alias `canonical`, empty for a line. `supersedes` is the `readingId` of the newest earlier-week reading of the same story, subtype and key, else null. `covers` is the first fact date of the bundle to the week's Sunday.

## Event

| Field | Meaning |
|---|---|
| `week` | `YYYY-Www`; default the ISO week that ended before now |
| `threadIds` | read only these stories (the skip rule still applies) |
| `shadow` | default `true`: every key moves under `record/shadow/` (views, facts, operator file, readings, runs, inbox); `false` is live |
| `dryRun` | select and assemble only: no model call, no write; returns the stories and each bundle's size |

## Environment

`WORLD_BUCKET`, `REVIEW_MODEL` (the DeepSeek model name), optional `REVIEW_CONCURRENCY` (model calls in flight, default 6), and the shared llm.js variables `GROK_API_URL` and `XAI_API_KEY` (they hold DeepSeek). The runtime supplies AWS SDK v3; the committed `src/_shared` symlink supplies shared code. `src/runtime.js` stops starting stories when under 60 s of Lambda time remain and records them as `timeout` failures.

## Choices

- Default week is the ISO week that ended before now. The schedule is Monday 01:00 UTC so that is the week that just ended (coordinator, 2026-10-22: the Friday slot in the first spec read the previous week).
- Readings of earlier weeks are found by reading the 8 previous weekly files (there is no listing and no readings manifest). A thing last read more than 8 weeks ago has no `supersedes` link.
- A story skipped for no new fact keeps its older readings; a re-run of a week replaces only the stories it read. `covers.to` is the week's Sunday, and "since the last reading" means entry or verdict facts dated after that Sunday.
- The skip rule counts `entry` and `verdict` facts only; a verdict on a branch is the exception to "no new fact" and always brings a story back.
- Assignment: the model sees this story's newest 60 entries and each neighbour's 3 newest; an entry outside those is out of scope even when it exists. A neighbour's entry must also appear in `cites`. `new` is accepted as a target without a thread id; applying it needs the operator to pick one.
- Alias readings that fail the rule (no Q-number, conflict) are not written as readings; they appear as rejections in the Run, which is where the operator sees the proposals.
- The merge rule's country condition is any shared country (not 5%-specific): the specific actor carries the specificity.
- Links and merges: the prompt shows the model up to 5 neighbours (cheap, no extra reads); the check accepts any active story the model cites correctly, and assembles that story's citable ids from the facts already in memory.
- No branch status from the model (0039 amendment 2026-10-31): a branch's status is its verdict fact, else open/past due from its `due` date, derived where it is shown (`shared/lib/branchWording.js`). Forecasts stay in the bundle as context; a verdict may be cited.
- Chapter dates are not the model's: `from`/`to` are the first and last date of the facts the chapter cites, so `from` (the chapter key) is stable across weeks.
- Bad answers are not re-asked: one call per story per week. `dryRun` makes no model call.
- Shadow mode reads and writes under `record/shadow/` only, including `operator/aliases.json`, so a shadow run needs a shadow copy of the views and facts.

## Follow-ups (coordinator; not done by this lane)

- `scripts/functions.json` entry: `newsRecordReview`, dir `backend/record/newsRecordReview`, group `record`, Node runtime, timeout 900 s, memory 1024 MB.
- Role and IAM: `S3 GetObject record/*`; `PutObject` on `record/readings/*`, `record/runs/review-*`, `record/inbox/merges/*` and their `record/shadow/` equivalents. No DynamoDB.
- Schedule: Monday 01:00 UTC, `cron(0 1 ? * MON *)` (the default week is the one that just ended), payload `{"shadow":false}` (enabled 2026-10-31).
- Env: `REVIEW_MODEL`, `WORLD_BUCKET`, `GROK_API_URL`, `XAI_API_KEY`.
- Deploy with `scripts/lambda.sh` (diff first). Deployed and live (2026-10-31).
- `newsStoryRecord` (view builder, lane T): read readings and `inbox/merges`, apply aliases, add `story_split`. Watch the first full Run's `notReached`: a re-run of the same week re-reads every story (only earlier weeks' readings count for the skip rule), so raise `REVIEW_CONCURRENCY` or split by `threadIds` if it times out.
- Golden week: `node scripts/golden-week.js capture|real|replay DIR` runs this handler on the frozen fixture in memory; results under `fixtures/golden-week/runs/` (see its README).

## Tests

```sh
FRONTEND_NODE_MODULES=<main checkout>/global-perspectives-starter/frontend/node_modules node --test backend/record/newsRecordReview/test/*.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Tests are offline: a fake ETag-aware S3, a stub `chat`, a tiny record for 2026-W42. `FRONTEND_NODE_MODULES` is needed only for the schema tests (the frontend's Ajv).
