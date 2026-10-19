# newsPredictionsSnapshot

Precomputes the forecast track record so `/track-record` does not Scan PredictionLog on every load. One full Scan of the log (excluding seed `SECRET` rows and operator-only `DRAFT#` rows), then `computeTrackRecord` (methodology-v1 era, from 2026-07-04) plus `buildQuestionBoard` (weekly sampled-question view: commits, draws, reveals, verdicts, health alarms; Brier scoring stays null below 150 resolved questions), written as one JSON object to S3. Each `recent[]` item carries `qid` (the forecast's question, when it has one) and `clusterKey` (threadId, else topicId, else the PRED key: the same rule as the resolver's `Q#` SAMPLED row), so a result links to its story.

## Deployment
- Deployed name `newsPredictionsSnapshot` · runtime `nodejs22.x` · group `predictions` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerPredictionsSnapshot` `rate(30 minutes)` (ENABLED)
- Deploy: `scripts/lambda.sh newsPredictionsSnapshot diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): Scan of `PRED#`, `SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` families (projected attributes only)
- S3 `WORLD_BUCKET`: writes `TRACK_RECORD_KEY` (default `predictions/track_record.json`) as `{ builtAt, data }`
- Consumer: the newsSensitiveData proxy reads that object and falls back to a live Scan when it is missing

## Gotchas
- `trackRecord.js` must stay in sync with the fallback `prediction_track_record` in `newsSensitiveData/src/index.js`.
- `weeks.js` is a copy of the settle Lambda's ISO-week helpers; `newsPredictionResolver/test/weeksParity.test.js` guards drift.
- If the question board throws, the legacy aggregate is still written with `questions: null`, then the Lambda errors so the failure is visible.
- Scoring uses a fixed-seed cluster bootstrap so the published interval does not change every 30 minutes.

## Tests
- `cd backend/predictions/newsPredictionsSnapshot/src && npm test` (three `node *.test.mjs` scripts, offline): 13 + 10 + 16 passed 2026-10-19.

Last verified: 2026-10-19
