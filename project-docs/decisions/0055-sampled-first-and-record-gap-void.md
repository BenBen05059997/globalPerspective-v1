# 0055. The nightly watch checks the sampled questions first, and a question held open only by our own record gap settles void "record gap"

Date: 2026-11-04. Status: accepted (operator decision 2026-11-04); follows 0034, 0038, 0044. Deployed 2026-11-04 about 20:00 JST (`newsPredictionResolver`, `newsStoryRecord`).

## Context
The public track record scores only the pre-registered weekly sample (0011). The 3 and 4 November resolver logs and `record/runs/` showed two things:
- The sample was not being checked. 88 sampled questions had been drawn and none had resolved. 7 of the 9 sampled questions already past due had never been checked, because the nightly cap on checks was filled by older questions outside the sample (on 4 Nov: 400 due, 40 checked, 34 of those blocked by a coverage gap).
- Our own record had holes: 13 and 14 October, and 21 to 24 October. For 21 to 24 October the ingest raw was present but the agent wrote no archive; the cause is not known (the logs had expired). A `no` needs a complete record from the draw to the due day (0038 coverage guard), so a question whose window crosses a hole could never get a `no` or a clean `not_yet`, and stayed open for ever.

## Decision
1. **Sampled first.** Every due or moved candidate of the sample is checked first and is never cut by the per-run cap. The cap applies to the other questions only. The watch log carries `sampled`, `others` and `overflow`.
2. **Record-gap void.** A draft blocked only by our own record gap (reason `coverage_gap`: the bundle is complete, no `yes`, a hole in `record/runs` inside the window) made at or after due + 3 days settles the question void, with `voidReason` and reason "record gap" and the gap days (`gapDays`) on the verdict. The first such draft is enough; there is no waiting period. A gap is never turned into a `no`. All other rules are unchanged.
3. **Shown, not hidden.** The verdict fact carries `gapDays` (additive, `schemaVersion` stays 1). The track-record view has `counts.voidRecordGap` (a subset of `void`) and per-question `gapDays`, and the page shows "Void - gap in our record" with the gap days and a methodology line.

## Consequences
- The sample is checked every night it has something due, so the scored set can resolve.
- Questions stuck on a record gap leave the open pool as void. They are visible as their own count, so a hole in our record is reported, not buried in the void total or counted as a miss.
- Voids are final at once like every verdict (0034); the operator can still append a correction.
- Not changed: the draw, the sample size, the eligibility window (0045), the coverage guard for `no`.
- Design and code: `ARCHITECTURE_FORECAST_LOOP.md` section 2, `backend/predictions/newsPredictionResolver/README.md`.
