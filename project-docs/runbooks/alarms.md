# CloudWatch alarms (Global Perspectives)

Last verified: 2026-10-19 (`aws cloudwatch describe-alarms` and `aws sns list-topics` / `list-subscriptions-by-topic`, read-only). The `PPA*` / `ppa-*` alarms in the same account belong to another project and are not covered here.

Two SNS topics are in use, with near-identical names: `GlobalPerspectivesAlerts` (1 https subscription) and `GlobalPerspectiveAlerts` (2 email subscriptions). The alarm list below says which one each alarm notifies. The monitor Lambdas (freshness, error digest, model guard, source audit) publish to `GlobalPerspectiveAlerts`.

## Trigger
| Alarm | Fires when | Topic |
|---|---|---|
| `Lambda-Errors-Spike` | account-wide Lambda `Errors` Sum ≥ 10 in 1 h | GlobalPerspectivesAlerts |
| `lambda-errors-<fn>` for `newsInvokeGemini-dev`, `NewsProjectInvokeAgentLambda-dev`, `newsThreadAnalysis`, `newsCountryIntelligence`, `newsPostDevTo`, `newsPostLinkedin`, `newsSensitiveData-dev` | that function's `Errors` Sum ≥ 1 in 5 min | GlobalPerspectivesAlerts |
| `lambda-throttles-newsSensitiveData-dev` | proxy `Throttles` Sum ≥ 1 in 5 min | GlobalPerspectivesAlerts |
| `lambda-duration-newsSensitiveData-dev` | proxy `Duration` p99 > 20,000 ms for 2 × 5 min | GlobalPerspectivesAlerts |
| `dynamodb-{read,write}throttleevents-{NewsCache,SummarizeAndPredict}` | throttle events ≥ 1 in 5 min | GlobalPerspectivesAlerts |
| `situation-tracker-errors` | `newsSituationTracker` `Errors` ≥ 1 in 10 min | GlobalPerspectiveAlerts |
| `situation-tracker-stalled` | `GlobalPerspective/Situations` `ChecksRun` (Mode=live) < 1 over 2 × 30 min; missing data counts as breaching | GlobalPerspectiveAlerts |

## What it means
- A scheduled job's errors: open that job's runbook (see `README.md` in this folder).
- `newsSensitiveData-dev` is the public read proxy behind the site; errors, throttles or slow p99 mean pages load empty or slowly.
- DynamoDB throttles on `NewsCache` (topics) or `SummarizeAndPredict` (analyses) mean reads or writes were rejected.
- `situation-tracker-stalled` means the map bundle `world/latest.json` stopped updating.

## Check
- Current state: `aws cloudwatch describe-alarms --state-value ALARM --region ap-northeast-1 --query 'MetricAlarms[].[AlarmName,StateReason]' --output text`
- History of one alarm: `aws cloudwatch describe-alarm-history --alarm-name <name> --history-item-type StateUpdate --max-records 10 --region ap-northeast-1`
- Proxy logs: `aws logs tail /aws/lambda/newsSensitiveData-dev --since 1h --region ap-northeast-1`
- Tracker runs: `aws logs tail /aws/lambda/newsSituationTracker --since 2h --region ap-northeast-1 --filter-pattern '"[tracker]"'`
- Tracker schedule: `aws events describe-rule --name TriggerSituationTracker --region ap-northeast-1`

## Fix
- Job errors: follow the job's runbook.
- Tracker stalled: confirm the rule is `ENABLED` and the last run's error in the logs; the tracker has no LLM, so a failure is a code, permission or S3 problem. One manual run: `aws lambda invoke --function-name newsSituationTracker --cli-binary-format raw-in-base64-out --payload '{}' --region ap-northeast-1 /tmp/out.json`.
- DynamoDB throttles: check which job ran at the alarm time (`describe-alarm-history`, then that job's logs) before changing table capacity.

## Escalate
Capacity, IAM or code changes are operator-asked work (CLAUDE.md, Authorization); IAM needs a fresh yes.
