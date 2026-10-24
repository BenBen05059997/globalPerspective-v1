# newsPredictionResolver

Daily prediction settle Lambda (methodology v1, forecast loop 0038). `tick` (default action, idempotent) commits seed hashes for the next two weeks, draws a seeded sample (K=22, rule `v1`) from every ended week's question-schema predictions, settles every due sampled question whose draft is waiting, then runs the nightly WATCH -> GATHER -> JUDGE -> RECORD pass for any open question branch, and writes a heartbeat. Other actions: `draw {weekId}`, `draft {limit}` (the same check pass on demand), `watch {limit}` (lists tonight's candidates, no model, no writes), `status` (read-only counts), `replay {items}` (drafter only, no writes), `correct {qid, verdict, reason, evidence?}` (operator dispute). `dryRun: true` = no LLM, no writes. Nothing waits for a human (decision 0034): a `yes`/`no`/`void` draft is written as the `Q#<qid>`/`VERDICT` row at once, for any question (`sampled` marks the weekly sample): `decidedAt`, `decidedBy` (model id), `confirmedBy: 'resolver'`, `draftSk`, `reason`, `evidence {eventId, quote, date}`, `voidReason` for void. An unclear draft (`not_yet`, `needs_human`) is not written; the third unclear draft (`MAX_UNCLEAR_DRAFTS`) made at or after due + 3 days and 5 days (`REDRAFT_AFTER_DAYS`) apart writes `void` with reason `unclear after 3 drafts`. The resolver does not write `record/`; `newsStoryRecord` turns the inbox lines (and verdict rows) into verdict facts. A wrong verdict is corrected with `correct` (appends `VERDICT#<n>`, `confirmedBy: 'operator'`, `reason`; CLI `predictions/settle-correct.js --correct <qid> <yes|no|void> "<reason>"`); the snapshot reads the highest n. The drafter never sees a question's probability (`draft.js`).

Design of the loop this Lambda implements (watch, gather, judge, record): [ARCHITECTURE_FORECAST_LOOP.md](../../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md).

## Stages

```text
FORECAST LOOP  (nightly stages of newsPredictionResolver; draw and review live elsewhere)
|
+- 2 WATCH       nightly, no model                   [newsPredictionResolver]   src/watch.js
|  +- inputs : record/facts (yesterday's and today's entry facts), open question branches (PRED# rows + Q# sampled rows)
|  +- rule   : candidates = open branches on stories with a new entry fact (yesterday or today)
|  |                       + open branches whose due date passed 3 days ago (GRACE_DAYS)
|  |           a moved story with no entry dated after the forecast's draw, and not yet past due + 3, is skipped (nothing to judge)
|  |           nothing else is checked; oldest due first; cap 60 per run, overflow logged
|  +- model  : no
|  +- output : list of (branch, trigger)
|
+- 3 GATHER      no model, no network                [newsPredictionResolver]   src/gather.js
|  +- inputs : candidate branch; record/facts days from the draw day + 1 to min(today, due + 3), read once each per run
|  +- rule   : the forecast's own story's `entry` facts dated AFTER the draw day and up to due + 3 days; nothing before the draw,
|  |           no other story, no web search. A facts day that fails to read means the question is not judged tonight
|  +- coverage: also reads record/runs/DAY.json for every day from the draw day + 1 to the due day (once each per run); a day
|  |           without a Run of status ok|partial AND inputs.archiveDay present (missing, thin, started, failed, no Run, or an
|  |           unreadable Run) is a coverage gap, logged by day
|  +- output : evidence bundle, oldest first: [{eventId, title, summary, date, url}] (+ complete flag: every day read, story known;
|  |           + coverageGaps [{day, why}])
|
+- 4 JUDGE       boxed model                         [newsPredictionResolver]   src/draft.js, src/lib.js
|  +- inputs : branch event text + evidence bundle (never p)
|  +- rule   : yes = verbatim quote >= 12 chars found by code in the title/summary of the entry it cites (eventId), then a 2nd
|  |           independent pass (bundle in reverse order) also yes
|  |           no = only after due + 3 days, only on a complete bundle, and only with NO coverage gap (else not_yet, reason
|  |           `coverage_gap`: our outage is not silence in the world); recorded with reason `not_reported_by_due`;
|  |           void = only a VOID_REASONS entry; else not_yet (stays open)
|  |           zero entries after the draw: not_yet before due + 3; after it a `no` made by rule, no model call
|  +- model  : yes, at most 2 calls per check
|
+- 5 RECORD      no model                            [newsPredictionResolver -> Q#/VERDICT -> newsStoryRecord -> verdict fact]
   +- rule   : put-once Q#<qid>/VERDICT for ANY judged question {verdict, decidedAt, decidedBy (model id), evidence {quote,url,title,date},
   |           reason, voidReason, sampled, draftSk}; corrections append VERDICT#n;
   |           the same verdict is appended as one line to S3 record/inbox/verdicts/YYYY-MM-DD.jsonl (shadow: record/shadow/inbox/verdicts/)
   |           for newsStoryRecord; the resolver never writes record/facts/
   +- output : the weekly sample (sampled:true) still feeds track_record.json unchanged
```

## Deployment
- Deployed name `newsPredictionResolver` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionResolver` `cron(30 10 * * ? *)` (UTC, ENABLED), input `{"action":"tick"}`
- Deploy: `scripts/lambda.sh newsPredictionResolver diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET`: reads `record/facts/<day>.jsonl` for the days between the oldest open draw and today, bounded to each question's due + 3 (entry facts) through `_shared/s3json.js`; read-only.
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): reads `PRED#` rows with `questionSchema`; writes `SEED#<week>`/`COMMIT|SECRET|REVEAL`, `SAMPLE#<week>`/`DRAW`, `Q#<qid>`/`SAMPLED|DRAFT#<iso>|VERDICT|VERDICT#<n>`, `SETTLE#<week>`/`TICK#<iso>`; reads the `Q#` rows. All writes are conditional put-once (immutable).
- External APIs: none for evidence (no web search); LLM chat completions through the shared client `src/_shared/llm.js` at `GROK_API_URL` (fallback `https://api.deepseek.com`)

## Models
- `DRAFT_MODEL` (default `deepseek-v4-pro`) with key `XAI_API_KEY` and URL `GROK_API_URL`; the GROK_*/XAI_* names hold the DeepSeek config. JSON mode, thinking disabled. Concurrency `LLM_CONCURRENCY` (3), candidate cap `MAX_RESOLVE_PER_RUN` (60).

## Gotchas
- A missing seed secret or a commit-hash mismatch blocks that week's draw; a new seed is never invented.
- A question is checked once a day at most; an age-only candidate waits 5 days; three counted unclear drafts make it void. The first correction of a settled question is `VERDICT#2` (the original `VERDICT` counts as 1).
- Settle rows carry no `methodologyVersion`, so legacy aggregators ignore them.
- ISO-week helpers are copied in `newsPredictionsSnapshot/src/weeks.js` and `newsSensitiveData/src/lib.js`; `test/weeksParity.test.js` guards drift.

## Source field contract

New `Q#/SAMPLED` rows copy `threadId` from their PRED row (null for older rows without it). `clusterKey` and sampling identity are unchanged; the sampled question still carries no probability.


## Choices (lane N, 2026-10-22; narrowest reading where the decision is silent)
- One path for all: the Monday-only draft pass is gone. `tick` runs WATCH -> RECORD every night; `draft` and `watch` (read-only) are the same pass on demand. A sampled question is just a flagged candidate (`sampled:true` on its verdict row); a SAMPLED row also feeds the pass when its PRED row is missing.
- Own-entry evidence (operator decision 2026-10-22): the only evidence is the forecast's own story's `entry` facts, dated after the draw day (the PRED issue day) and up to due + 3 days. No web search, no Brave, no page fetching, nothing before the draw, no other story. `BRAVE_SEARCH_API_KEY` is no longer read; it stays in the Lambda env until the build is accepted (rollback needs it), then is removed.
- Evidence also includes operator-assigned recovered `article` facts (threadId null, placed by `assignment` facts; latest `at` wins, ties operator > review > ingest, same rule as the views), entries moved by a reassignment, and the entries of stories merged into the question's story (`story_merged`, a later `story_split` cancels). Assignments and merges can sit on any later day, so GATHER reads every facts day from the earliest open window start to today (one GET per day). The judge sees a recovered article as `[recovered headline, no text]`; a `yes` quote may come from its title, and a recovered day still has no archive Run, so the coverage guard keeps a `no` impossible over it.
- A `no` is judged on a complete bundle only (every facts day in the window read, story identified by `threadId`); a sampled row without `threadId` can never be a `no`. A question with zero post-draw entries is `not_yet` until due + 3, then a `no` made by rule (`decidedBy: rule:no_entries_after_draw`, no model call). Choices of mine where the decision is silent: the draw day is the PRED issue day; the second pass shows the same bundle in reverse order; the judge cites an entry by `eventId`.
- Coverage guard (lane Q, 2026-10-22): a `no`, rule-made or by the model, is allowed only if every day from the draw day + 1 to the due day has `record/runs/DAY.json` with `status` ok or partial and `inputs.archiveDay` `present`. Otherwise the draft is `not_yet` with `reason: 'coverage_gap'` and `gapDays`, and the gap days are logged (`coverage_gap` line, `out.coverageGaps`). An unreadable Run (for example no IAM grant) counts as a gap, so nothing is lost by the missing grant but no `no` can be made until it exists. A `yes` is unaffected (it needs a verified quote). A `coverage_gap` draft is not an unclear draft: it never counts toward voiding a question. The window ends at the due day (not due + 3) by the lane brief.
- `issued_before_method` is not added to `VOID_REASONS`: the brief says "void only with VOID_REASONS" and nothing in the nightly path assigns it.
- Void after unclear drafts: only drafts made at or after due + 3 days, at least 5 days apart, count toward `MAX_UNCLEAR_DRAFTS` (3). Without this, a story that moves nightly would void a question in three days.
- A question is checked at most once per UTC day; an age-only candidate waits 5 days (`REDRAFT_AFTER_DAYS`) between checks, a moved one does not.
- `decidedBy` on the verdict row is the model id (was the word `resolver`); `confirmedBy: 'resolver'` is unchanged. `evidence` gains `title` and `date`. `correct` now accepts any question that has Q# rows (was: sampled only). Evidence is now `{eventId, quote, date}` (2026-10-22, own-entry evidence).
- Cap: `MAX_RESOLVE_PER_RUN` (env, default now 60) is the candidate cap per run; checks stop starting after 7 minutes.
- Inbox line (coordinator addition, operator decision): every final verdict and operator correction is also appended to `record/inbox/verdicts/<decision day UTC>.jsonl` via `_shared/s3json.js` appendLines: {schemaVersion:1, qid, threadId, forkId, branchId, result, voidReason, decidedAt, decidedBy, evidence, reason, revision, sourceKey `inbox:verdicts/DATE#n`}. forkId/branchId follow derive.js (`<PRED pk>/<issue day>[/<trigger id>]`). One nightly writer, so no cross-run If-Match protocol; within a run the appends are serialised and a repeated qid+revision is skipped. `shadow:true` in the event writes under `record/shadow/inbox/verdicts/` (Q# rows are still written); `dryRun` writes nothing. A failed append is reported in `errors`; the Q# row is stored and the line must be re-sent by hand.
- Sample window: `LEAD_MAX` is 90 (was 84, lane M request approved by the coordinator, decision 0038: due 7-90 days); `LEAD_MIN` stays 7. Weeks already drawn are unchanged.
- An unreadable `record/facts` is reported in `errors` and the pass continues on the age rule alone.

## Coordinator follow-ups (not done by this lane)
- IAM: the resolver role needs `s3:GetObject` on `arn:aws:s3:::globalperspective-world-280362093938/record/facts/*` (WATCH) and `s3:PutObject` (plus GetObject, used by the append) on `record/inbox/verdicts/*` and `record/shadow/inbox/verdicts/*`. Until the facts grant, the nightly pass reports "facts unreadable" and judges nothing (a bundle with a missing day is never judged).
- Env: the Lambda needs `WORLD_BUCKET` (the world bucket name). Check `MAX_RESOLVE_PER_RUN` (the live value, if set, becomes the nightly cap).
- Schedule: the existing `TriggerPredictionResolver` rule (`tick`, 10:30 UTC) runs the pass; a separate rule is needed only if the check should run at another hour. Timeout 600 s; no search calls remain, a check is at most 2 model calls, the 7-minute guard covers the rest.
- Alarms: verdicts per day, void share, two-pass disagreement (`needs_human` drafts), `settle errors` log lines, candidates `overflow` > 0 for several nights, candidates past due + 3 with no draft.
- Lane O: `newsStoryRecord` reads `record/inbox/verdicts/` (or widens its verdict reader to non-sampled questions) and uses `decidedBy`, `reason`, `evidence {eventId, quote, date}` (the entry's eventId resolves to its url in the facts).

- IAM (lane Q, needs the operator): `s3:GetObject` on `arn:aws:s3:::globalperspective-world-280362093938/record/runs/*` for the resolver role. Until then every Run is unreadable, so every `no` is held as `coverage_gap` (honest, but no `no` is made).

## Judge benchmark
Any change to the judge model, prompt or rules must pass the judge benchmark described in `project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md` (Verification, Judge benchmark) before deploy; the runner is planned under `bench/` and reuses this judge code unchanged.

## Tests
- `cd backend/predictions/newsPredictionResolver/src && npm test` (`node --test ../test/*.test.js`, offline; also loads `predictions/settle-correct.js`): 85 passed, 1 skipped (store-interface test skips without the AWS SDK on NODE_PATH), 2026-10-22.

Last verified: 2026-10-23 against code on main and live AWS: deployed (CodeSha256 UHqPWXy/...; `search.js` gone from the zip). Env gained `WORLD_BUCKET`, memory 512 MB, role gained inline `newsPredictionResolver-runs` (GetObject + ListBucket `record/runs/*`). `BRAVE_SEARCH_API_KEY` and `GROK_MODEL` remain, unused. First watch invoke (no writes): 5,006 question branches on 315 threads, 0 moved threads, 40 grace candidates of 138 past due+3, 98 overflow beyond the 60 cap. With DeepSeek unfunded (402) drafts are `needs_human`; rule-made `no` verdicts still land when coverage is complete. Shadow mode does not suppress DynamoDB writes, only moves the inbox line to `record/shadow/inbox/verdicts/`. Coverage guard read bug found 2026-10-24 on the first scheduled run (every Run read as "no run", so every candidate was `coverage_gap`): `gather.js` took `.obj` off `getJson`, which returns the plain object; fixed in lane AH, with a test over the real s3json.
