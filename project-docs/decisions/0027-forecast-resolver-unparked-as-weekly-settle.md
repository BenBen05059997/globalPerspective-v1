# 27. The forecast resolver is unparked as the weekly settle job

Status: accepted (supersedes the forecast-resolver part of 0015)
Date: 2026-09-30 (recorded 2026-10-19)

## Context
Decision 0015 parked `newsPredictionResolver` on 2026-09-28: its verdict proposals needed a human
confirm that had not happened since July, and the new forecast-scoring method was to replace it.
That method shipped on 2026-09-30 (commits 56b13fa, 8c54fd4): a committed weekly random seed, a
sampled question set, a blind LLM drafter that never sees the forecast probability, and an operator
confirm step (`predictions/settle-review.js`).

## Decision
We run `newsPredictionResolver` again, as the job behind the new method rather than the old
propose-everything resolver. It was re-enabled on 2026-09-30 (commit 925250f) with a daily tick:
`aws events describe-rule --name TriggerPredictionResolver` returns `cron(30 10 * * ? *)`, `ENABLED`
(checked 2026-10-19). The tick commits seeds and draws each ended week's sample; verdict drafts run on
Mondays, and nothing is final until the operator confirms it.

## Consequences
- The other parts of 0015 stand: economic impact, its quality judge and the impact audit stay parked.
- The freshness monitor alerts when a draw, a commit or the tick is missed (`settleCheck.js`).
- How to check and re-run it: `project-docs/runbooks/prediction-resolver.md`.

Source: live `aws events describe-rule --name TriggerPredictionResolver --region ap-northeast-1`
(2026-10-19); git log 925250f, 56b13fa, 8c54fd4.
