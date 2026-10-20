# 0034. The resolver writes verdicts itself; no human gate

Status: accepted (supersedes the "operator confirms verdicts" part of 0011; refines 0027)
Date: 2026-10-20

## Context
Decision 0011 (T3) scored a random sample with "a weekly operator/agent run", and Batch 4 built it as an agent draft
that the operator confirmed one by one (`predictions/settle-review.js`). Decision 0027 unparked the daily resolver on
that basis. In three weeks of a daily resolver there were 0 verdicts, because the confirm step never ran. The operator's
ruling: a wrong verdict is a bug in the algorithm; report it and fix the algorithm. A manual gate that is not run is
worse than none, since the public record then never moves.

## Decision
We will let `newsPredictionResolver` write the verdict itself.
- A `yes`, `no` or `void` draft is written at once as `Q#<qid>/VERDICT` (put-once, `confirmedBy: 'resolver'`,
  `draftSk` pointing at the `DRAFT#` row, evidence url and quote). The daily tick also settles any draft already waiting.
- An unclear draft (`not_yet`, or `needs_human` on evidence) is not written. It is re-drafted after 5 days, and the third
  unclear draft writes `void` with reason "unclear after 3 drafts". An LLM outage (`needs_human` with an `llm error` note)
  is not a judgment and never counts toward that three.
- The operator disputes a verdict with a reason: the Lambda action `correct` (CLI `predictions/settle-correct.js
  --correct <qid> <yes|no|void> "<reason>"`) appends `Q#<qid>/VERDICT#<n>` with `confirmedBy: 'operator'`.
- The drafter's rules stay: blind to `p`, a quoted passage for `yes`, no `no` before deadline + 3 days, two agreeing
  passes for `yes`.

## Consequences
- The public score counts resolver-confirmed verdicts; the record says who confirmed each one.
- Corrections are appended rows with a reason, never edits. The original `VERDICT` counts as number 1, so the first
  correction is `VERDICT#2`. The snapshot's "highest n wins" rule (`questionBoard.js`) is the reader of truth.
- A wrong verdict is fixed in the algorithm (drafter, validation, search), then corrected once for the record.
- `settle-review.js` is deleted (git history keeps it). The track record's null-below-150 rule and the scoring math
  are unchanged.
- The weekly operator review of 0011 T3 no longer exists; the freshness monitor still alarms when settling stalls.
