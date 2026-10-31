# 0044. The track record page reads a record view (`views/track-record.json`)

Status: accepted (operator, 2026-10-31; follows 0035, 0037 and 0043)
Date: 2026-10-31

## Context
`/track-record` read `predictions/track_record.json`, a scan of the PredictionLog written every 30 minutes by `newsPredictionsSnapshot`
and served through the `prediction_track_record` action. Its `questions` part (the weekly sampled-question scheme) is a function of
`forecast_drawn`, `verdict`, `question_commit` and `question_draw` facts, all on the record since 0043. Its legacy part describes the
closed pilot era.

## Decision
- `newsStoryRecord/src/trackRecord.js` (pure) builds `record/views/track-record.json` from facts in the same views run, written after
  `index/all.json` and before the manifest. The state rules are `shared/src/questionState.js`; scoring is `shared/src/questionScoring.js`
  (a copy of the snapshot's `scoring.js`, same answers, pinned by a test, until the snapshot's question board is retired).
- `questions` has the shape the page already reads. Left out because the record does not hold them and no reader uses them:
  `settleHealth` (the freshness monitor still reads it from the old file), a week's `reviewed`, and a week's `draw.pool`
  (the eligible pool stays in the PredictionLog; the page fetches it from the old action only when a reader presses "Verify this draw").
- `legacy` is a constant (`src/trackRecordLegacy.json`) copied once on 2026-10-31: the pilot era is closed (all 122 resolved triggers were
  confirmed in one run on 2026-07-24; the last non-question forecast was drawn on 2026-10-19; the old resolver no longer settles them).
  `legacyPredictionsExcluded` is 2418, the count of PredictionLog `PRED#` rows without `methodologyVersion`; the old file's 2546 also
  counted the question scheme's own rows (`Q#`, `SEED#`, `SAMPLE#`, `SETTLE#`) and grew with them.
- The corrections ledger (`corrections_feed`) stays on the action: it is tier-capped on the server (anonymous: newest 5 notes, a total, a
  gate) and deeper notes must not be in a public view.

## Consequences
- Fields read from the story: the sampled list takes the story title from the forecast's `topicId` (the title plus a `-<n>` suffix, no fact
  carries the title) and the story from the forecast fact's thread.
- `issued` counts forecasts the record holds; two `PRED#` rows of 2026-10-10 (17 questions) have no `forecast_drawn` fact (the facts run
  finds forecasts through the day's entries' topic ids), and the newest day lags until the next facts run.
- The states (awaiting / past deadline) are as of the last views run (`asOf`), not the last 30 minutes.
