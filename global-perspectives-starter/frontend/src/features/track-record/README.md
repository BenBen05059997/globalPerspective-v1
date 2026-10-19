# track-record

The public accountability page: forecast record from the weekly pre-registered question sample
(status stage, locked accuracy, this week's draw, forecast board map, settling log) plus the ledger
of changed reads (corrections). A plain text twin renders the same facts for print/screen readers.

## Routes
- `/track-record` -> `TrackRecordPage` (E2 "service record")
- `/track-record/text` -> `TrackRecordText` (E1 text version, linked "Read as text")

## Entry files
- `TrackRecordPage.jsx` - page; local `CorrectionsLedger`; phone tabs Read / Map / Log
- `TrackRecordText.jsx` - same view model, semantic headings, no map
- `components/ForecastBoard.jsx` (radar map, lazy), `DrawRow.jsx`, `SettlingLog.jsx`
- `lib/trackRecordView.js` - pure view model for both pages (pilotExclusion, stageWording, accuracyLock, notReadyCopy...)
- `lib/sampleRule.js` - browser re-check of the weekly draw (`verifyDraw`, WebCrypto sha256)

## Data
- `useTrackRecord()` -> restProxy `prediction_track_record`; localStorage `gp_track_record`, 30 min.
- `useCorrectionsFeed(limit)` -> restProxy `corrections_feed`; localStorage `gp_corrections_feed`,
  30 min; returns `{ notes, total, gated }`.

## Shared blocks used
- `SectionHeader`, `PhoneTabs`, `boot/BootLoader`; `useIsPhone`; `safeWhy`/`safeTriggerEvent` (`@/shared/lib/driftNote`)

## Imports from other features
- `@/shared/ui/FollowButton` -> follow a country from the ledger
- `@/shared/map/RadarMap.jsx` -> forecast board map
- `@/shared/lib/situationLabels.js` -> `ISO3_NAME` for placing questions on countries

## Gotchas
- July pilot (122 triggers, one 2026-07-24 confirmedAt) is excluded from every headline number.
- Accuracy stays locked until 150 post-pilot resolved (`ACCURACY_UNLOCK_AT`): no Brier, no skill word.
- Ledger is member-gated server-side: anon gets capped `notes` plus honest `total`/`gated`.
- `gp_corrections_feed` cache key ignores `limit`: Home asks 100, these pages 40; first fetch wins.
- `sampleRule.js` mirrors `newsPredictionResolver/src/lib.js`; parity via `sampleRuleGolden.json`
  (guarded by `scripts/check-shared-sync.mjs`).
- Hooks are reused by `features/home` (trust strip); libs by `threads` and `analysis-studio`.

Last verified: 2026-10-19
