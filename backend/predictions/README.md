# predictions

The forecast scoring group. Forecasts are written by the content pipeline; the resolver here settles them under methodology v1.
The public track record is a record view built by newsStoryRecord; the snapshot Lambda that once wrote the old track-record file was removed from AWS and the repo on 2026-11-01. The group serves readers of the track-record page and the operator who may correct a verdict.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → **3 Daily notes** → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 3: the forecast watch, gather, judge and record (newsPredictionResolver), and forecast settling (the track-record snapshot job is retired; the record's track-record view replaces it). Timeline: writes no facts; the resolver appends verdict and draw lines to record/inbox/verdicts/ and record/inbox/draws/ for newsStoryRecord, and forecast_drawn facts come from the forecasts inbox when FORECASTS_SOURCE is inbox, otherwise from the PRED# rows (the resolver reads its own questions from the PRED# rows or the facts, QUESTIONS_SOURCE). See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda (deployed name) | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsPredictionResolver | Commits weekly seeds, draws the sampled questions, and every night watches for open question branches to check (story moved or due + 3 days), judges them and writes the verdicts itself. | Rule `TriggerPredictionResolver`, cron(30 10 * * ? *) UTC, input action `tick`, ENABLED | PredictionLog `PRED#` rows, `Q#`/`VERDICT`; S3 `record/facts/` entry facts; DeepSeek endpoint | PredictionLog `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` rows, written once and never replaced; S3 `record/inbox/verdicts/` and `record/inbox/draws/` lines for newsStoryRecord | [link](newsPredictionResolver/README.md) |

## Pipeline

Design of the forecast loop (draw, watch, gather, judge, record, review) and how it is verified: [ARCHITECTURE_FORECAST_LOOP.md](../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md) (decision 0038).

1. NewsProjectInvokeAgentLambda-dev (pipeline group) writes a `PRED#<topicId>` forecast row to GlobalPerspectivePredictionLog each cycle, and a line to `record/inbox/forecasts/` (decision 0052).
2. Each day at 10:30 UTC newsPredictionResolver runs `tick`: it commits seed hashes for upcoming weeks and draws a sample from every ended week.
3. The same run then does WATCH, GATHER, JUDGE and RECORD (tree below) for any open question, not only the sample, using only the story's own entry facts dated after the draw as evidence. The judge is not shown the question's probability.
4. A yes/no/void judgment is written at once as the `Q#`/`VERDICT` row (`decidedBy` the model id, `confirmedBy: 'resolver'`); unclear checks stay open and, once counted after due + 3 days and 5 days apart, become void after three. The operator disputes a verdict with `predictions/settle-correct.js --correct` (appends `VERDICT#<n>` with a reason). Decision 0034.
5. The resolver writes a tick heartbeat to `record/views/health/settle-tick.json`; newsFreshnessMonitor (`SETTLE_SOURCE=record`) reads it with the track-record view and the manifest (decision 0052). The old snapshot job and its `predictions/track_record.json` were deleted 2026-11-01.
6. The `/track-record` page (hook `useTrackRecord`) and "Verify this draw" read the record view `record/views/track-record.json` only (decisions 0044, 0052; built by newsStoryRecord, with the draw pools and `settleHealth`); there is no fallback, and a missing view shows the empty state.
7. The page shows it. The corrections feed on the same page comes from the `corrections_feed` action, which reads drift notes from the pipeline group.
8. Story pages, the briefing's next question, the country card and `newsSharedAnalysis` read forecasts from the record's `forecasts/<threadId>.json` views (decision 0052). The `prediction_snapshot` and `prediction_track_record` actions were removed from the read API on 2026-11-01.

The nightly stages (WATCH, GATHER, JUDGE, RECORD) and their rules are in [newsPredictionResolver/README.md](newsPredictionResolver/README.md).

## Shared code

- newsPredictionResolver uses `llm.js` and `s3json.js` from `backend/shared/src`.
- The resolver's ISO-week helpers come from shared modules: `weekStart` from `questionPool.js` (with `rankKey` and `draw`, shared with the record's track-record view) and `isoWeekOfDay` (as `weekOf`) from `questionState.js`; `src/lib.js` re-exports them. The snapshot and proxy copies are gone.

## Known limits

- A missing seed secret or a commit-hash mismatch blocks that week's draw. A new seed is never invented.
- The resolver writes verdicts itself from model drafts (decision 0034); the operator only corrects. The deployed zip matches the repo.
- Resolver rows are conditional put-once; nothing is overwritten.
- A question is checked at most once a day; an age-only candidate waits 5 days between checks.
- Live TTL on the PredictionLog table is DISABLED, so rows do not expire.

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerPrediction --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/predictions/
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsPredictionResolver --query '[Runtime,Timeout,LastModified]'

Verdicts and the weekly seed commit and draw reach the record through the inboxes `record/inbox/verdicts/` and `record/inbox/draws/` (decisions 0034, 0043): the resolver writes them, `newsStoryRecord` turns them into facts. The `PRED#`, `SEED#`, `SAMPLE#` and `Q#` rows are PredictionLog commitment state; step 5 retires only the `PRED#` rows, not these (`project-docs/architecture/STEP5_AUDIT.md`).
