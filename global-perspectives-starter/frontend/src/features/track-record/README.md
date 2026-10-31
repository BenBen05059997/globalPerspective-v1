# track-record

The public accountability page (`/track-record`). Readers use it to see how the site's forecasts perform: the status stage, locked
accuracy, this week's pre-registered question draw, a forecast board with a radar map, a settling log, and a ledger of changed
reads (corrections). A plain-text twin at `/track-record/text` shows the same facts for print and screen readers.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the track record page. Timeline: reads views/track-record.json (the question scheme from facts, decision 0044; pilot stats a constant); the corrections ledger stays on the gated action. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public. Accuracy stays locked until 150 post-pilot questions are resolved (`ACCURACY_UNLOCK_AT` in `lib/accuracyLock.js`):
  no Brier score and no skill word before then. The July pilot is excluded from every headline number.
- The server caps the corrections ledger by tier (anonymous: newest 5 notes plus an honest `total` and `gated`). `useCorrectionsFeed`
  sends the auth header when signed in (`restProxy.js` `proxyActionWithAuth`), so members see the full ledger.

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
- Imports from other features: none. Shared: `FollowButton`, `EntityLink`, `RadarMap`, `@/shared/lib/links.js`, `questionStates.js` (state words: happened / not reported / could not be checked / awaiting check; void reasons come from `branchWording.js`),
  `trFormatDate.js`, `driftNote.js`

## Backend
- Group guides: [predictions](../../../../../backend/predictions/README.md); the forecasts and drift notes come from [pipeline](../../../../../backend/pipeline/README.md)
- `NewsProjectInvokeAgentLambda-dev` (Scheduler `InvokeNewsAgent`, 3x a day) logs a forecast per topic to `GlobalPerspectivePredictionLog`.
- `newsPredictionResolver` (rule `TriggerPredictionResolver`, 10:30 UTC daily, input `tick`): commits seeds for upcoming weeks, draws the
  sample for each ended week, drafts verdicts on Mondays and writes them itself (decision 0034; none written as of 2026-10-22). The operator only corrects.
- `newsPredictionsSnapshot` (rule `TriggerPredictionsSnapshot`, every 30 min) writes `predictions/track_record.json`;
  `newsSensitiveData-dev` serves it and the corrections feed.

## Data
- `useTrackRecord()` -> the record view `views/track-record.json` (`fetchTrackRecordView`, `/data/record/views/`, decision 0044) via
  `lib/trackRecordFromView.js`; when the view is missing (404) or cannot be read (reported to the error sink) it falls back to
  `prediction_track_record` (the S3 file, with a live Scan fallback). localStorage `gp_track_record`, 30 min. Same data shape either way:
  `questions` plus the pilot-era fields the page reads (`eraCutFrom`, `totalDatedTriggers`, `resolvedTriggers`, `legacyPredictionsExcluded`, `recent`).
  In the view `questions` is built from facts (`newsStoryRecord/src/trackRecord.js`) and the pilot-era fields are a frozen constant
  (`src/trackRecordLegacy.json`, copied 2026-10-31; `legacyPredictionsExcluded` is 2418, the action's 2546 also counted the question scheme's rows).
  The view has no `settleHealth` (the freshness monitor reads it from the action file), no week `reviewed`, and no week `draw.pool`:
  "Verify this draw" fetches the week's draw from the action when pressed (`lib/drawPool.js`).
- `useCorrectionsFeed(limit)` -> `corrections_feed`; localStorage `gp_corrections_feed`, 30 min; returns `{ notes, total, gated }`.
  The cache key ignores `limit`: Home asks 100, these pages 40; the first fetch wins.
- Neither hook needs sign-in.

## Pipeline
1. `NewsProjectInvokeAgentLambda-dev` writes a `PRED#<topicId>` forecast row to `GlobalPerspectivePredictionLog` each cycle.
2. `newsPredictionResolver` (daily `tick`) commits seeds, draws each ended week's sample, and on Mondays drafts verdicts
   (Brave Search evidence) and writes them itself; the operator disputes one with `predictions/settle-correct.js`.
3. `newsPredictionsSnapshot` (every 30 min) scans the log -> S3 `predictions/track_record.json` (fallback, the draw pools and `settleHealth`). `newsStoryRecord` builds `record/views/track-record.json` from the facts in every views run.
4. `newsDriftCorrector` (05:30 UTC) writes `DRIFT#` notes that become the corrections ledger.
5. `newsSensitiveData-dev` actions `prediction_track_record` (fallback) and `corrections_feed` (gated, stays on the action).
6. Hooks `useTrackRecord` (view first) and `useCorrectionsFeed` -> `buildTrackRecordView` -> `TrackRecordPage` (`/track-record`) and `TrackRecordText`.

## Docs
- Decisions: [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md) (lean and sampled),
  [0027](../../../../../project-docs/decisions/0027-forecast-resolver-unparked-as-weekly-settle.md) (resolver as weekly settle)
- Design: [ARCHITECTURE_FORECAST_LOOP.md](../../../../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/track-record`; parity: `node scripts/check-shared-sync.mjs`
- View served: `curl -s https://globalperspective.net/data/record/views/track-record.json | head -c 300`; the action (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"prediction_track_record"}' | head -c 300`
- Settle ran: `aws logs tail /aws/lambda/newsPredictionResolver --since 3d --region ap-northeast-1 --filter-pattern '"settle"' --format short`
- Schedules: `aws events describe-rule --name TriggerPredictionResolver --region ap-northeast-1 --query State`
  (and `TriggerPredictionsSnapshot`)

Last verified: 2026-10-31
