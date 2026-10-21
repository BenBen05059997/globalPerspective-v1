# predictions

The forecast scoring group. Forecasts are written by the content pipeline; the two Lambdas here settle them under methodology v1
and publish the public track record. It serves readers of the track-record page and the operator who writes the verdicts.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → **3 Daily notes** → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 3: forecast settling and the track-record snapshot. Timeline: writes no facts; PRED# and Q# verdicts are the source of forecast_drawn and verdict facts. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda (deployed name) | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsPredictionResolver | Commits weekly seeds, draws the sampled questions, and on Mondays drafts verdicts and writes them itself. | Rule `TriggerPredictionResolver`, cron(30 10 * * ? *) UTC, input action `tick`, ENABLED | PredictionLog `PRED#` rows, `Q#`/`VERDICT`; Brave Search API; DeepSeek endpoint | PredictionLog `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` rows, written once and never replaced | [link](newsPredictionResolver/README.md) |
| newsPredictionsSnapshot | Scans the log, computes the track record and question board, and saves one JSON file. | Rule `TriggerPredictionsSnapshot`, rate(30 minutes), ENABLED | PredictionLog `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` (seed secrets and `DRAFT#` rows filtered out) | S3 `predictions/track_record.json` | [link](newsPredictionsSnapshot/README.md) |

## Pipeline

1. NewsProjectInvokeAgentLambda-dev (pipeline group) writes a `PRED#<topicId>` forecast row to GlobalPerspectivePredictionLog each cycle.
2. Each day at 10:30 UTC newsPredictionResolver runs `tick`: it commits seed hashes for upcoming weeks and draws a sample from every ended week.
3. On Mondays the same run drafts verdicts using Brave Search evidence. The drafter is not shown the question's probability.
4. A yes/no/void draft is written at once as the `Q#`/`VERDICT` row (`confirmedBy: 'resolver'`); unclear drafts are re-drafted after 5 days and become void after three. The operator disputes a verdict with `predictions/settle-correct.js --correct` (appends `VERDICT#<n>` with a reason). Decision 0034.
5. Every 30 minutes newsPredictionsSnapshot scans the log and writes `predictions/track_record.json` to the world bucket.
6. The browser calls the `prediction_track_record` action on `newsSensitiveData-dev`, which returns that file and falls back to a live Scan if it is missing.
7. The `/track-record` page shows it (hook `useTrackRecord`). The corrections feed on the same page comes from the `corrections_feed` action, which reads drift notes from the pipeline group.
8. Story pages read the latest forecast per topic through the `prediction_snapshot` action (`/weekly/thread/:threadId`, `/analyze`).

## Shared code

- newsPredictionResolver uses `llm.js` from `backend/shared/src`.
- newsPredictionsSnapshot has no `_shared` link. It keeps its own copy of the ISO-week helpers in `weeks.js`; a parity test guards drift against the resolver and the proxy.

## Known limits

- A missing seed secret or a commit-hash mismatch blocks that week's draw. A new seed is never invented.
- Verdicts are written by the operator, not by a Lambda. The drafts are model-written.
- Resolver rows are conditional put-once; nothing is overwritten.
- A question is re-drafted only after 5 days without a verdict.
- Live TTL on the PredictionLog table is DISABLED, so rows do not expire.
- If the question board fails, newsPredictionsSnapshot still writes the aggregate with `questions: null`, then errors.

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerPrediction --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/predictions/
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsPredictionResolver --query '[Runtime,Timeout,LastModified]'

Last verified: 2026-10-20 against code @14dd450d and live AWS.
