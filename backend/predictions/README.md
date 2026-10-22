# predictions

The forecast scoring group. Forecasts are written by the content pipeline; the two Lambdas here settle them under methodology v1
and publish the public track record. It serves readers of the track-record page and the operator who may correct a verdict.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → **3 Daily notes** → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 3: forecast settling and the track-record snapshot. Timeline: writes no facts; PRED# and Q# verdicts are the source of forecast_drawn and verdict facts. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda (deployed name) | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsPredictionResolver | Commits weekly seeds, draws the sampled questions, and every night watches for open question branches to check (story moved or due + 3 days), judges them and writes the verdicts itself. | Rule `TriggerPredictionResolver`, cron(30 10 * * ? *) UTC, input action `tick`, ENABLED | PredictionLog `PRED#` rows, `Q#`/`VERDICT`; S3 `record/facts/` entry facts; Brave Search API; DeepSeek endpoint | PredictionLog `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` rows, written once and never replaced | [link](newsPredictionResolver/README.md) |
| newsPredictionsSnapshot | Scans the log, computes the track record and question board, and saves one JSON file. | Rule `TriggerPredictionsSnapshot`, rate(30 minutes), ENABLED | PredictionLog `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` (seed secrets and `DRAFT#` rows filtered out) | S3 `predictions/track_record.json` | [link](newsPredictionsSnapshot/README.md) |

## Pipeline

Design of the forecast loop (draw, watch, gather, judge, record, review) and how it is verified: [ARCHITECTURE_FORECAST_LOOP.md](../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md) (decision 0038).

1. NewsProjectInvokeAgentLambda-dev (pipeline group) writes a `PRED#<topicId>` forecast row to GlobalPerspectivePredictionLog each cycle.
2. Each day at 10:30 UTC newsPredictionResolver runs `tick`: it commits seed hashes for upcoming weeks and draws a sample from every ended week.
3. The same run then does WATCH, GATHER, JUDGE and RECORD (tree below) for any open question, not only the sample, using entry facts and Brave Search evidence. The judge is not shown the question's probability.
4. A yes/no/void judgment is written at once as the `Q#`/`VERDICT` row (`decidedBy` the model id, `confirmedBy: 'resolver'`); unclear checks stay open and, once counted after due + 3 days and 5 days apart, become void after three. The operator disputes a verdict with `predictions/settle-correct.js --correct` (appends `VERDICT#<n>` with a reason). Decision 0034.
5. Every 30 minutes newsPredictionsSnapshot scans the log and writes `predictions/track_record.json` to the world bucket.
6. The browser calls the `prediction_track_record` action on `newsSensitiveData-dev`, which returns that file and falls back to a live Scan if it is missing.
7. The `/track-record` page shows it (hook `useTrackRecord`). The corrections feed on the same page comes from the `corrections_feed` action, which reads drift notes from the pipeline group.
8. Story pages read the latest forecast per topic through the `prediction_snapshot` action (`/weekly/thread/:threadId`, `/analyze`).

## Nightly stages (decision 0038)

```text
FORECAST LOOP  (nightly stages of newsPredictionResolver; draw and review live elsewhere)
|
+- 2 WATCH       nightly, no model                   [newsPredictionResolver]   src/watch.js
|  +- inputs : record/facts (yesterday's and today's entry facts), open question branches (PRED# rows + Q# sampled rows)
|  +- rule   : candidates = open branches on stories with a new entry fact (yesterday or today)
|  |                       + open branches whose due date passed 3 days ago (GRACE_DAYS)
|  |           nothing else is checked; oldest due first; cap 60 per run, overflow logged
|  +- model  : no
|  +- output : list of (branch, trigger)
|
+- 3 GATHER      no model                            [newsPredictionResolver]   src/draft.js, src/search.js
|  +- inputs : candidate branch; the new entry's title/summary
|  +- rule   : news search for the branch event text with the branch's source named; results dated after due are dropped
|  +- output : evidence bundle (entry facts first, then results with title, snippet, url, date)
|
+- 4 JUDGE       boxed model                         [newsPredictionResolver]   src/draft.js, src/lib.js
|  +- inputs : branch event text + evidence bundle (never p)
|  +- rule   : yes = verbatim quote >= 12 chars found by code in a shown title/snippet, then a 2nd independent pass also yes
|  |           no = only after due + 3 days; void = only a VOID_REASONS entry; else not_yet (stays open)
|  +- model  : yes, at most 2 calls per check
|
+- 5 RECORD      no model                            [newsPredictionResolver -> Q#/VERDICT -> newsStoryRecord -> verdict fact]
   +- rule   : put-once Q#<qid>/VERDICT for ANY judged question {verdict, decidedAt, decidedBy (model id), evidence {quote,url,title,date},
   |           reason, voidReason, sampled, draftSk}; corrections append VERDICT#n;
   |           the same verdict is appended as one line to S3 record/inbox/verdicts/YYYY-MM-DD.jsonl (shadow: record/shadow/inbox/verdicts/)
   |           for newsStoryRecord; the resolver never writes record/facts/
   +- output : the weekly sample (sampled:true) still feeds track_record.json unchanged
```

## Shared code

- newsPredictionResolver uses `llm.js` and `s3json.js` from `backend/shared/src`.
- newsPredictionsSnapshot has no `_shared` link. It keeps its own copy of the ISO-week helpers in `weeks.js`; a parity test guards drift against the resolver and the proxy.

## Known limits

- A missing seed secret or a commit-hash mismatch blocks that week's draw. A new seed is never invented.
- The resolver writes verdicts itself from model drafts (decision 0034, deployed 2026-10-20); the operator only corrects. No verdict row had been written as of 2026-10-22 (zero in `GlobalPerspectivePredictionLog`).
- Resolver rows are conditional put-once; nothing is overwritten.
- A question is checked at most once a day; an age-only candidate waits 5 days between checks.
- Live TTL on the PredictionLog table is DISABLED, so rows do not expire.
- If the question board fails, newsPredictionsSnapshot still writes the aggregate with `questions: null`, then errors.

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerPrediction --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/predictions/
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsPredictionResolver --query '[Runtime,Timeout,LastModified]'

Last verified: 2026-10-20 against code @14dd450d and live AWS.

## Choices (lane N, 2026-10-22; narrowest reading where the decision is silent)
- One path for all: the Monday-only draft pass is gone. `tick` runs WATCH -> RECORD every night; `draft` and `watch` (read-only) are the same pass on demand. A sampled question is just a flagged candidate (`sampled:true` on its verdict row); a SAMPLED row also feeds the pass when its PRED row is missing.
- Results "dated before due" is read as date <= due day on results that carry a date (Brave `page_age`); undated results are kept. Consequence to confirm: a `no` is judged only on reporting up to the due day, and late reporting of an on-time event is not shown to the judge.
- Entry facts (title + summary, first cited url) are shown to the judge as results, so a quote can be verified in them by the same code rule.
- `issued_before_method` is not added to `VOID_REASONS`: the brief says "void only with VOID_REASONS" and nothing in the nightly path assigns it.
- Void after unclear drafts: only drafts made at or after due + 3 days, at least 5 days apart, count toward `MAX_UNCLEAR_DRAFTS` (3). Without this, a story that moves nightly would void a question in three days.
- A question is checked at most once per UTC day; an age-only candidate waits 5 days (`REDRAFT_AFTER_DAYS`) between checks, a moved one does not.
- `decidedBy` on the verdict row is the model id (was the word `resolver`); `confirmedBy: 'resolver'` is unchanged. `evidence` gains `title` and `date`. `correct` now accepts any question that has Q# rows (was: sampled only).
- Cap: `MAX_RESOLVE_PER_RUN` (env, default now 60) is the candidate cap per run; checks stop starting after 7 minutes.
- Inbox line (coordinator addition, operator decision): every final verdict and operator correction is also appended to `record/inbox/verdicts/<decision day UTC>.jsonl` via `_shared/s3json.js` appendLines: {schemaVersion:1, qid, threadId, forkId, branchId, result, voidReason, decidedAt, decidedBy, evidence, reason, revision, sourceKey `inbox:verdicts/DATE#n`}. forkId/branchId follow derive.js (`<PRED pk>/<issue day>[/<trigger id>]`). One nightly writer, so no cross-run If-Match protocol; within a run the appends are serialised and a repeated qid+revision is skipped. `shadow:true` in the event writes under `record/shadow/inbox/verdicts/` (Q# rows are still written); `dryRun` writes nothing. A failed append is reported in `errors`; the Q# row is stored and the line must be re-sent by hand.
- An unreadable `record/facts` is reported in `errors` and the pass continues on the age rule alone.

## Coordinator follow-ups (not done by this lane)
- IAM: the resolver role needs `s3:GetObject` on `arn:aws:s3:::globalperspective-world-280362093938/record/facts/*` (WATCH) and `s3:PutObject` (plus GetObject, used by the append) on `record/inbox/verdicts/*` and `record/shadow/inbox/verdicts/*`. Until the facts grant, the nightly pass reports "facts unreadable" and runs the age rule only.
- Env: the Lambda needs `WORLD_BUCKET` (the world bucket name). Check `MAX_RESOLVE_PER_RUN` (the live value, if set, becomes the nightly cap).
- Schedule: the existing `TriggerPredictionResolver` rule (`tick`, 10:30 UTC) runs the pass; a separate rule is needed only if the check should run at another hour. Timeout 600 s; 60 candidates at ~2-3 searches each (1.1 s gap) fit, the 7-minute guard covers the rest.
- Alarms: verdicts per day, void share, two-pass disagreement (`needs_human` drafts), `settle errors` log lines, candidates `overflow` > 0 for several nights, candidates past due + 3 with no draft.
- Lane O: `newsStoryRecord` reads `record/inbox/verdicts/` (or widens its verdict reader to non-sampled questions) and uses `decidedBy`, `reason`, `evidence {quote,url,title,date}`.
