# newsPredictionsSnapshot

RETIRED from service (2026-11-01). The Lambda still exists, but its schedule is off and nothing reads what it wrote. It used to precompute the forecast track record so `/track-record` did not Scan PredictionLog on every load: one full Scan of the log (excluding seed `SECRET` rows and operator-only `DRAFT#` rows), then `computeTrackRecord` (methodology-v1 era, from 2026-07-04) plus `buildQuestionBoard` (weekly sampled-question view: commits, draws, reveals, verdicts, health alarms; Brier scoring stays null below 150 resolved questions), written as one JSON object to S3. Each `recent[]` item carried `qid` and `clusterKey` (threadId, else topicId, else the PRED key: the same rule as the resolver's `Q#` SAMPLED row).

Why it is retired: the record now holds everything it computed (decision 0052). `newsStoryRecord` builds the public `record/views/track-record.json` (question scheme, draw pools, `settleHealth`) and `record/views/forecasts/<threadId>.json` from the facts, and the resolver writes the settle heartbeat. Every former reader moved to those views, and the proxy actions `prediction_snapshot` and `prediction_track_record` were removed. Do not re-enable the rule.

## Deployment
- Deployed name `newsPredictionsSnapshot` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionsSnapshot` `rate(30 minutes)` (DISABLED since 2026-11-01)
- Deploy: `scripts/lambda.sh newsPredictionsSnapshot diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes (while it ran)
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): Scan of `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` families (projected attributes only)
- S3 `WORLD_BUCKET`: wrote `TRACK_RECORD_KEY` (default `predictions/track_record.json`) as `{ builtAt, data }`. The file is no longer refreshed and has no reader; it stays in S3 until the midweek deletes.

## Gotchas
- `weeks.js` is a copy of the settle Lambda's ISO-week helpers; `newsPredictionResolver/test/weeksParity.test.js` guards drift (it still expects the proxy's `isoWeekOfDay`, which was removed, so it fails until that line is dropped).
- If the question board threw, the legacy aggregate was still written with `questions: null`, then the Lambda errored so the failure was visible.
- Scoring used a fixed-seed cluster bootstrap so the published interval did not change every 30 minutes.

## Tests
- `cd backend/predictions/newsPredictionsSnapshot/src && npm test` (three `node *.test.mjs` scripts, offline).
