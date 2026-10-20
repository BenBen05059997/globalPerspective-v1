# track-record

The public accountability page (`/track-record`). Readers use it to see how the site's forecasts perform: the status stage, locked
accuracy, this week's pre-registered question draw, a forecast board with a radar map, a settling log, and a ledger of changed
reads (corrections). A plain-text twin at `/track-record/text` shows the same facts for print and screen readers.

## Status
- Live, public. Accuracy stays locked until 150 post-pilot questions are resolved (`ACCURACY_UNLOCK_AT` in `lib/accuracyLock.js`):
  no Brier score and no skill word before then. The July pilot is excluded from every headline number.
- The server caps the corrections ledger by tier (anonymous: newest 5 notes plus an honest `total` and `gated`). `useCorrectionsFeed`
  sends no auth header (`restProxy.js` `proxyAction`), so every reader of this page gets the anonymous view.

## Routes
- `/track-record` -> `TrackRecordPage`; `/track-record/text` -> `TrackRecordText` ("Read as text")
- `/track-record?q=<qid>` (`forecastHref`): the board opens on BOARD, scrolls to that question (DOM id `forecastAnchorId(qid)` =
  `q-<qid>`) and highlights it; the phone opens on the MAP tab. A qid not among the sampled questions gets one honest line.
- No redirects point here.

## Frontend
- `TrackRecordPage.jsx` - the page; local `CorrectionsLedger`; phone tabs Read / Map / Log (`PhoneTabs`)
- `TrackRecordText.jsx` - same view model, semantic headings, no map
- `components/ForecastBoard.jsx` (radar map via `@/shared/map/RadarMap.jsx`), `DrawRow.jsx` (a week's draw and its check),
  `SettlingLog.jsx`, `ForecastLinks.jsx` (a question's story, only when `clusterKey` is a real `thread-` id, and the countries its text names)
- `lib/trackRecordView.js` - pure view model for both pages; `stageWording`, `accuracyLock`, `accuracyEstimate`, `notReadyCopy`,
  `pilotExclusion`, `settlingLog`, `forecastPlaces` support it
- `lib/sampleRule.js` - browser re-check of the weekly draw (`verifyDraw`, WebCrypto sha256); mirrors
  `backend/predictions/newsPredictionResolver/src/lib.js`; parity through `sampleRuleGolden.json`, guarded by `scripts/check-shared-sync.mjs`
- Public API (`index.js`): `useTrackRecord`, `useCorrectionsFeed` (used by `home` for the trust strip)
- Imports from other features: none. Shared: `FollowButton`, `EntityLink`, `RadarMap`, `@/shared/lib/links.js`, `questionStates.js`,
  `trFormatDate.js`, `driftNote.js`

## Backend
- Generated row: [reference/features.md#track-record](../../../../../project-docs/reference/features.md#track-record)
- Group guides: [predictions](../../../../../backend/predictions/README.md); the forecasts and drift notes come from [pipeline](../../../../../backend/pipeline/README.md)
- `NewsProjectInvokeAgentLambda-dev` (Scheduler `InvokeNewsAgent`, 3x a day) logs a forecast per topic to `GlobalPerspectivePredictionLog`.
- `newsPredictionResolver` (rule `TriggerPredictionResolver`, 10:30 UTC daily, input `tick`): commits seeds for upcoming weeks, draws the
  sample for each ended week, drafts verdicts on Mondays. The operator writes the verdicts.
- `newsPredictionsSnapshot` (rule `TriggerPredictionsSnapshot`, every 30 min) writes `predictions/track_record.json`;
  `newsSensitiveData-dev` serves it and the corrections feed.

## Data
- `useTrackRecord()` -> `prediction_track_record` (the S3 file, with a live Scan fallback if it is missing); localStorage
  `gp_track_record`, 30 min. The payload carries the legacy pilot fields plus `questions`.
- `useCorrectionsFeed(limit)` -> `corrections_feed`; localStorage `gp_corrections_feed`, 30 min; returns `{ notes, total, gated }`.
  The cache key ignores `limit`: Home asks 100, these pages 40; the first fetch wins.
- Neither hook needs sign-in.

## Pipeline
1. `NewsProjectInvokeAgentLambda-dev` writes a `PRED#<topicId>` forecast row to `GlobalPerspectivePredictionLog` each cycle.
2. `newsPredictionResolver` (daily `tick`) commits seeds, draws each ended week's sample, and on Mondays drafts proposed verdicts
   (Brave Search evidence); the operator confirms them with `predictions/settle-review.js`.
3. `newsPredictionsSnapshot` (every 30 min) scans the log -> S3 `predictions/track_record.json`.
4. `newsDriftCorrector` (05:30 UTC) writes `DRIFT#` notes that become the corrections ledger.
5. `newsSensitiveData-dev` actions `prediction_track_record` and `corrections_feed`.
6. Hooks `useTrackRecord` and `useCorrectionsFeed` -> `buildTrackRecordView` -> `TrackRecordPage` (`/track-record`) and `TrackRecordText`.

## Docs
- Decisions: [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md) (lean and sampled),
  [0027](../../../../../project-docs/decisions/0027-forecast-resolver-unparked-as-weekly-settle.md) (resolver as weekly settle)
- Live plan: [TASK_2026-10-17_grounded_forecast_and_cost.md](../../../../../project-docs/plans/TASK_2026-10-17_grounded_forecast_and_cost.md)
- Runbooks: [prediction-resolver.md](../../../../../project-docs/runbooks/prediction-resolver.md),
  [predictions-snapshot.md](../../../../../project-docs/runbooks/predictions-snapshot.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/track-record`; parity: `node scripts/check-shared-sync.mjs`
- Record served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"prediction_track_record"}' | head -c 300`
- Settle ran: `aws logs tail /aws/lambda/newsPredictionResolver --since 3d --region ap-northeast-1 --filter-pattern '"settle"' --format short`
- Schedules: `aws events describe-rule --name TriggerPredictionResolver --region ap-northeast-1 --query State`
  (and `TriggerPredictionsSnapshot`)

Last verified: 2026-10-20
