# newsPredictionsSnapshot

Precomputes the forecast track record so `/track-record` does not Scan PredictionLog on every load. One full Scan of the log (excluding seed `SECRET` rows and operator-only `DRAFT#` rows), then `computeTrackRecord` (methodology-v1 era, from 2026-07-04) plus `buildQuestionBoard` (weekly sampled-question view: commits, draws, reveals, verdicts, health alarms; Brier scoring stays null below 150 resolved questions), written as one JSON object to S3. Each `recent[]` item carries `qid` (the forecast's question, when it has one) and `clusterKey` (threadId, else topicId, else the PRED key: the same rule as the resolver's `Q#` SAMPLED row), so a result links to its story.

## Deployment
- Deployed name `newsPredictionsSnapshot` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionsSnapshot` `rate(30 minutes)` (ENABLED)
- Deploy: `scripts/lambda.sh newsPredictionsSnapshot diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): Scan of `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` families (projected attributes only)
- S3 `WORLD_BUCKET`: writes `TRACK_RECORD_KEY` (default `predictions/track_record.json`) as `{ builtAt, data }`
- Consumer: the newsSensitiveData proxy (`prediction_track_record`) reads that object and falls back to a live Scan when it is missing. The `/track-record` page itself reads the record view `views/track-record.json` first (decision 0044) and uses this action only as its fallback (the view carries the draw pools and `settleHealth` since decision 0052). Readers left on 2026-10-31: that page fallback (`useTrackRecord`, and "Verify this draw" for a week the view has no `draw` for), `newsFreshnessMonitor` until `SETTLE_SOURCE=record`, and `predictions/verify-draw.mjs --public`. When those are gone this job and the `prediction_track_record` action can retire (one yes each).

## Gotchas
- `trackRecord.js` must stay in sync with the fallback `prediction_track_record` in `newsSensitiveData/src/index.js`.
- `weeks.js` is a copy of the settle Lambda's ISO-week helpers; `newsPredictionResolver/test/weeksParity.test.js` guards drift.
- If the question board throws, the legacy aggregate is still written with `questions: null`, then the Lambda errors so the failure is visible.
- Scoring uses a fixed-seed cluster bootstrap so the published interval does not change every 30 minutes.

## Tests
- `cd backend/predictions/newsPredictionsSnapshot/src && npm test` (three `node *.test.mjs` scripts, offline).
