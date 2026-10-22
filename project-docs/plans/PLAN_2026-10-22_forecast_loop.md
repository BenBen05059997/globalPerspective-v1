# Forecast loop (draw, watch, gather, judge, record, review)

Status: proposed (2026-10-22): design agreed by the operator; lanes not opened

Design: [ARCHITECTURE_FORECAST_LOOP.md](../architecture/ARCHITECTURE_FORECAST_LOOP.md). Rules: [decision 0038](../decisions/0038-forecast-loop.md).
Replaces `TASK_2026-10-17_grounded_forecast_and_cost.md` (deleted; `git show 4c1c9ad7:project-docs/plans/TASK_2026-10-17_grounded_forecast_and_cost.md` has its P0-P7 detail, the P7 impact map and the Jev backtest steps). Foundation step 2b ([PLAN_2026-10-21_foundation.md](PLAN_2026-10-21_foundation.md)) records the forecast row this plan answers.

## Goal
Close the loop: few resolvable outcomes drawn per story per week, a cheap nightly watch, a boxed judge, verdict facts, a weekly review. Pages stop promising checks that never come.

## Checklist
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Decision 0038 written | coordinator | no | ☐ | `decisions/0038-forecast-loop.md` (written with this plan, uncommitted until the commit lands) |
| Generator: at most 3 outcomes/story/week, event text as `branch.text`, gates (lead 7-90, near-duplicate of open branch), draw only when the story moved | draw lane (`NewsProjectInvokeAgentLambda`) | Lambda deploy under standing authorization | ☐ | |
| Draw quality: no invented calendar facts (grounded-date gate), no templated probabilities, drop example numbers from the schema; the 5-precedent prompt v2b awaits an operator yes | draw lane | yes for prompt v2b | ☐ | older plan P1/P2; A/B harness `predictions/forecast-ab/` |
| Resolver: watch triggers from `record/facts` (new entry that day, due + 3 days) | resolver lane (`newsPredictionResolver`) | no | ☐ | |
| Resolver: gather (search for the event text, results dated before due) and judge (existing lib.js rules, `issued_before_method` reason) | resolver lane | no | ☐ | |
| Verdict inbox `record/inbox/verdicts/` (0038 amendment): resolver writes, facts writer reads 7 days | lanes N + O | IAM: yes (resolver PutObject inbox, GetObject record/facts) | ◐ | lanes building |
| Legacy void job: the 2,451 branches without a question id voided once with `issued_before_method` | resolver lane | yes (one-time bulk write) | ☐ | |
| Page wording: board StoryTree and BoardWeekly, thread ThreadForecast, track-record copy ("open · due DATE", "happened · DATE", "did not happen", "could not be checked · reason"; no "not checked yet") | frontend lane | yes (frontend release) | ☐ | |
| `counts.branchesDue` counts resolvable branches only | record lane (`newsStoryRecord`) | no | ☐ | |
| Verification 1: unit/golden tests (fixed branch + fixture; non-verbatim quote, no before due + 3, invalid void reason rejected) | resolver lane | no | ☐ | |
| Verification 2: dry-run replay over the 44 sampled questions and 20 branches with a known outcome; agreement reported | resolver lane | no | ☐ | |
| Verification 3: shadow fortnight to `record/shadow/`, agreement on the shared 22 | resolver lane | no | ☐ | |
| Verification 4: operator spot-check, 10 random verdicts a week, at least 90% agreement over two weeks before "did not happen" goes live | operator | yes | ☐ | |
| Verification 5: metrics and alarms (verdicts/day, void share, two-pass disagreement, branches past due + 3 unchecked, model errors) | monitoring lane | yes (alarms) | ☐ | |
| Weekly review writes readings citing verdicts (foundation step 3) | review lane (`newsRecordReview`) | review model open in foundation plan | ☐ | |
| Carried over, selection: P7c shadow week (`newsSelectionShadow`, from 2026-10-18 20:20 run to about 10-25) then P7d switch to the layered selector; P6 blind review | selection lane | yes (P7d switch) | ◐ | `runbooks/selection-shadow.md` |
| Carried over, cost: P4 measured token counts replace estimates in `runbooks/DEEPSEEK_COST_ESTIMATE.md`; P5 low-balance alert in `newsModelGuard` | cost lane | no | ◐ | task rows said deployed 2026-10-17; recheck live |

## Open questions
- Brave quota and price are not in the repo; the watch's volume (a few dozen checks a night expected) must be measured in the shadow fortnight.

## Log
- 2026-10-22: design agreed by the operator after the forecast-loop research brief; this plan replaces the 2026-10-17 grounded-forecast task.
- 2026-10-22: verdict hand-off decided by the operator: an S3 inbox (`record/inbox/verdicts/`), not a DynamoDB lookup (about 4,989 queries a night) and not a resolver write to `record/facts/`; 0038 amendment; IAM yes still needed.
