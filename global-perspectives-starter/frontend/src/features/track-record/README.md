# track-record

The public accountability page: the forecast record from the weekly pre-registered question sample
(status stage, locked accuracy, this week's draw, forecast board map, settling log) plus the ledger of
changed reads (corrections). A plain text twin renders the same facts for print / screen readers.

## Status
- Live, public. Accuracy stays locked until 150 post-pilot resolved (`ACCURACY_UNLOCK_AT` in
  `lib/accuracyLock.js`): no Brier, no skill word. The July pilot is excluded from every headline number.
- Ledger is member-gated server-side: anon gets capped `notes` plus honest `total` / `gated`.

## Routes
- `/track-record` -> `TrackRecordPage` ("service record"); `/track-record/text` -> `TrackRecordText` ("Read as text")
- `/track-record?q=<qid>` (`forecastHref`): the board opens on BOARD, scrolls to that question (DOM id
  `forecastAnchorId(qid)` = `q-<qid>`) and highlights it; the phone opens on the MAP tab. A qid that is not among
  the sampled questions on the board gets one honest line, never a guessed match.

## Frontend
- `TrackRecordPage.jsx` - page; local `CorrectionsLedger`; phone tabs Read / Map / Log
- `TrackRecordText.jsx` - same view model, semantic headings, no map
- `components/ForecastBoard.jsx` (radar map via `@/shared/map/RadarMap.jsx`, lazy), `DrawRow.jsx`, `SettlingLog.jsx`
- `components/ForecastLinks.jsx` - each question's story (only when `clusterKey` is a real `thread-…` id; a topic-id
  key stays plain text) and the countries its text names (`lib/forecastPlaces.js` `itemPlaces`, `itemStoryId`)
- `lib/trackRecordView.js` - pure view model for both pages (pilotExclusion, stageWording, accuracyLock, notReadyCopy...)
- `lib/sampleRule.js` - browser re-check of the weekly draw (`verifyDraw`, WebCrypto sha256); mirrors
  `backend/predictions/newsPredictionResolver/src/lib.js`, parity via `sampleRuleGolden.json` (guarded by
  `scripts/check-shared-sync.mjs`)
- Public API (`index.js`): `useTrackRecord`, `useCorrectionsFeed` — used by `home` (trust strip)
- Imports from other features: none. Shared: `FollowButton`, `EntityLink`, `@/shared/map/RadarMap.jsx`,
  `@/shared/lib/links.js`, `countries.js`, `questionStates.js`, `trFormatDate.js`, `driftNote.js`

## Backend
- Generated row: [reference/features.md#track-record](../../../../../project-docs/reference/features.md#track-record)
- `newsPredictionResolver` (daily 10:30 UTC `tick`: commits seeds two weeks ahead, draws each ended week's
  sample, drafts verdicts on Mondays; the operator confirms them); `newsPredictionsSnapshot` (every 30 min) writes `predictions/track_record.json`;
  `NewsProjectInvokeAgentLambda-dev` logs forecasts to `GlobalPerspectivePredictionLog`; `newsSensitiveData-dev` serves both actions.

## Data
- `useTrackRecord()` -> restProxy `prediction_track_record`; localStorage `gp_track_record`, 30 min.
- `useCorrectionsFeed(limit)` -> restProxy `corrections_feed`; localStorage `gp_corrections_feed`, 30 min;
  returns `{ notes, total, gated }`. The cache key ignores `limit`: Home asks 100, these pages 40; first fetch wins.

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

Last verified: 2026-10-19
