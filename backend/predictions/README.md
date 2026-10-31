# predictions

The forecast scoring group. Forecasts are written by the content pipeline; the two Lambdas here settle them under methodology v1
and publish the public track record. It serves readers of the track-record page and the operator who may correct a verdict.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → **3 Daily notes** → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 3: the forecast watch, gather, judge and record (newsPredictionResolver), forecast settling and the track-record snapshot. Timeline: writes no facts; the resolver appends verdict and draw lines to record/inbox/verdicts/ and record/inbox/draws/ for newsStoryRecord, and PRED# rows are still the source of forecast_drawn facts. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda (deployed name) | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsPredictionResolver | Commits weekly seeds, draws the sampled questions, and every night watches for open question branches to check (story moved or due + 3 days), judges them and writes the verdicts itself. | Rule `TriggerPredictionResolver`, cron(30 10 * * ? *) UTC, input action `tick`, ENABLED | PredictionLog `PRED#` rows, `Q#`/`VERDICT`; S3 `record/facts/` entry facts; DeepSeek endpoint | PredictionLog `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` rows, written once and never replaced; S3 `record/inbox/verdicts/` and `record/inbox/draws/` lines for newsStoryRecord | [link](newsPredictionResolver/README.md) |
| newsPredictionsSnapshot | Scans the log, computes the track record and question board, and saves one JSON file. | Rule `TriggerPredictionsSnapshot`, rate(30 minutes), ENABLED | PredictionLog `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` (seed secrets and `DRAFT#` rows filtered out) | S3 `predictions/track_record.json` | [link](newsPredictionsSnapshot/README.md) |

## Pipeline

Design of the forecast loop (draw, watch, gather, judge, record, review) and how it is verified: [ARCHITECTURE_FORECAST_LOOP.md](../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md) (decision 0038).

1. NewsProjectInvokeAgentLambda-dev (pipeline group) writes a `PRED#<topicId>` forecast row to GlobalPerspectivePredictionLog each cycle.
2. Each day at 10:30 UTC newsPredictionResolver runs `tick`: it commits seed hashes for upcoming weeks and draws a sample from every ended week.
3. The same run then does WATCH, GATHER, JUDGE and RECORD (tree below) for any open question, not only the sample, using only the story's own entry facts dated after the draw as evidence. The judge is not shown the question's probability.
4. A yes/no/void judgment is written at once as the `Q#`/`VERDICT` row (`decidedBy` the model id, `confirmedBy: 'resolver'`); unclear checks stay open and, once counted after due + 3 days and 5 days apart, become void after three. The operator disputes a verdict with `predictions/settle-correct.js --correct` (appends `VERDICT#<n>` with a reason). Decision 0034.
5. Every 30 minutes newsPredictionsSnapshot scans the log and writes `predictions/track_record.json` to the world bucket (the action's source and the view's legacy comparison; the page's fallback and, until `SETTLE_SOURCE=record`, the freshness monitor's source, decision 0052).
6. The `/track-record` page (hook `useTrackRecord`) reads the record view `record/views/track-record.json` first (decision 0044, built by newsStoryRecord) and asks the `prediction_track_record` action on `newsSensitiveData-dev` only when the view is missing. The action returns this Lambda's file and falls back to a live Scan if the file is missing.
7. The page shows it. The corrections feed on the same page comes from the `corrections_feed` action, which reads drift notes from the pipeline group.
8. Story pages read the latest forecast per topic through the `prediction_snapshot` action (`/weekly/thread/:threadId`).

The nightly stages (WATCH, GATHER, JUDGE, RECORD) and their rules are in [newsPredictionResolver/README.md](newsPredictionResolver/README.md).

## Shared code

- newsPredictionResolver uses `llm.js` and `s3json.js` from `backend/shared/src`.
- newsPredictionsSnapshot has no `_shared` link. It keeps its own copy of the ISO-week helpers in `weeks.js`; a parity test guards drift against the resolver and the proxy.

## Known limits

- A missing seed secret or a commit-hash mismatch blocks that week's draw. A new seed is never invented.
- The resolver writes verdicts itself from model drafts (decision 0034); the operator only corrects. The deployed zip matches the repo.
- Resolver rows are conditional put-once; nothing is overwritten.
- A question is checked at most once a day; an age-only candidate waits 5 days between checks.
- Live TTL on the PredictionLog table is DISABLED, so rows do not expire.
- If the question board fails, newsPredictionsSnapshot still writes the aggregate with `questions: null`, then errors.

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerPrediction --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/predictions/
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsPredictionResolver --query '[Runtime,Timeout,LastModified]'

Verdicts and the weekly seed commit and draw reach the record through the inboxes `record/inbox/verdicts/` and `record/inbox/draws/` (decisions 0034, 0043): the resolver writes them, `newsStoryRecord` turns them into facts. The `PRED#`, `SEED#`, `SAMPLE#` and `Q#` rows are PredictionLog commitment state; step 5 retires only the `PRED#` rows, not these (`project-docs/architecture/STEP5_AUDIT.md`).
