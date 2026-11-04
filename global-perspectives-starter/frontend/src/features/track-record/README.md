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
- Read live 2026-11-04: 88 questions locked in samples, none resolved yet (79 open, 9 awaiting check); no sampled question has a verdict.
  The happened / not reported / could not be checked wording is therefore covered by tests only, not yet visible on the live page.
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
- Both pages print a question's state with `lib/questionLine.js` (the design words: "open · due 27 Jan", "happened · 3 Nov", "not reported by 27 Jan",
  "could not be checked · reason", and for a passed deadline with no verdict the shared state word "awaiting check · due DATE") and a ledger note with
  `lib/ledgerLine.js`; a failed read renders `components/Unavailable.jsx` (what could not be read, plus Retry)
- `components/ForecastBoard.jsx` (radar map via `@/shared/map/RadarMap.jsx`), `DrawRow.jsx` (a week's draw and its check),
  `SettlingLog.jsx`, `Unavailable.jsx`, `ForecastLinks.jsx` (a question's story, only when `clusterKey` is a real `thread-` id, and the countries its text names)
- `lib/trackRecordView.js` - pure view model for both pages; `stageWording`, `accuracyLock`, `accuracyEstimate`, `notReadyCopy`,
  `pilotExclusion`, `settlingLog`, `forecastPlaces` support it
- `lib/sampleRule.js` - browser re-check of the weekly draw (`verifyDraw`, WebCrypto sha256); mirrors
  `backend/shared/src/questionPool.js` (`rankKey`, `draw`); parity through `sampleRuleGolden.json`, guarded by `scripts/check-shared-sync.mjs`
- Public API (`index.js`): `useTrackRecord`, `useCorrectionsFeed` (used by `home` for the trust strip)
- Imports from other features: none. Shared: `FollowButton`, `EntityLink`, `RadarMap`, `@/shared/lib/links.js`, `questionStates.js` (state words: happened / not reported / could not be checked / awaiting check; void reasons come from `branchWording.js`),
  `branchWording.js`, `trFormatDate.js`, `driftNote.js`, `Button`

## Backend
- Group guides: [predictions](../../../../../backend/predictions/README.md); the forecasts and drift notes come from [pipeline](../../../../../backend/pipeline/README.md)
- `newsAgent` (Scheduler `InvokeNewsAgent`, 3x a day) logs a forecast per topic to `GlobalPerspectivePredictionLog`.
- `newsPredictionResolver` (rule `TriggerPredictionResolver`, 10:30 UTC daily, input `tick`): commits seeds for upcoming weeks, draws the
  sample for each ended week, drafts verdicts on Mondays and writes them itself (decision 0034). The operator only corrects.
- `newsReadApi` (repo dir `backend/read-api/newsSensitiveData`, API Gateway `/proxy`) serves the corrections feed (gated).

## Data
- `useTrackRecord()` -> the record view `views/track-record.json` (`fetchTrackRecordView`, `/data/record/views/`, decision 0044) via
  `lib/trackRecordFromView.js`, the only source: when the view is missing, unreadable or of another shape the hook returns no data (the page's
  honest empty state) and reports once to the error sink. localStorage `gp_track_record`, 30 min. Data shape:
  `questions` plus the pilot-era fields the page reads (`eraCutFrom`, `totalDatedTriggers`, `resolvedTriggers`, `legacyPredictionsExcluded`, `recent`).
  In the view `questions` is built from facts (`newsStoryRecord/src/trackRecord.js`) and the pilot-era fields are a frozen constant
  (`src/trackRecordLegacy.json`, copied 2026-10-31; `legacyPredictionsExcluded` is 2418).
  The view carries `settleHealth` (the freshness monitor's inputs, not shown on the page) and, on each of the last four drawn weeks the forecast facts reproduce,
  a `draw` ({K, pool, picked}, decision 0052) that "Verify this draw" uses; it has no week `reviewed`. A week without a `draw` has no verify control.
- `useCorrectionsFeed(limit)` -> `corrections_feed`; localStorage `gp_corrections_feed:<limit>:<uid or anon>`, 30 min; returns
  `{ notes, total, gated, loading, error, refetch }`. The server's cap follows the sign-in, so the key carries the uid (a member's full ledger is never
  served to the next reader). A failed read is `error` (reported to the error sink as `corrections-feed`; `notes` stays `[]`), and the pages say the ledger could not be loaded.
  A note carries `threadId` and the cause (`triggerEvent`) but no story title, so a story row reads "A story", linked when the id is a real `thread-` id.
- Neither hook needs sign-in. `useTrackRecord` also returns `refetch` (the pages' Retry). The method numbers in "How this works" (`K`, lead days, grace days) come from the view's `questions.method`.

## Pipeline
1. `newsAgent` writes a `PRED#<topicId>` forecast row to `GlobalPerspectivePredictionLog` each cycle.
2. `newsPredictionResolver` (daily `tick`) commits seeds, draws each ended week's sample, and on Mondays drafts verdicts
   (Brave Search evidence) and writes them itself; the operator disputes one with `predictions/settle-correct.js`.
3. `newsStoryRecord` builds `record/views/track-record.json` (with the draw pools and `settleHealth`) from the facts in every views run.
4. `newsDriftCorrector` (05:30 UTC) writes `DRIFT#` notes that become the corrections ledger.
5. `newsReadApi` action `corrections_feed` (gated, stays on the action).
6. Hooks `useTrackRecord` (view only) and `useCorrectionsFeed` -> `buildTrackRecordView` -> `TrackRecordPage` (`/track-record`) and `TrackRecordText`.

## Docs
- Decisions: [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md) (lean and sampled),
  [0027](../../../../../project-docs/decisions/0027-forecast-resolver-unparked-as-weekly-settle.md) (resolver as weekly settle)
- Design: [ARCHITECTURE_FORECAST_LOOP.md](../../../../../project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/track-record`; parity: `node scripts/check-shared-sync.mjs`
- View served: `curl -s https://globalperspective.net/data/record/views/track-record.json | head -c 300`; the draw check: `node predictions/verify-draw.mjs --public`
- Settle ran: `aws logs tail /aws/lambda/newsPredictionResolver --since 3d --region ap-northeast-1 --filter-pattern '"settle"' --format short`
- Schedules: `aws events describe-rule --name TriggerPredictionResolver --region ap-northeast-1 --query State`

Last verified: 2026-11-04
