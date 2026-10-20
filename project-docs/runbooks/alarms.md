# CloudWatch alarms (Global Perspectives)

Last verified: 2026-10-20 (`aws cloudwatch describe-alarms`, `describe-alarm-history`, `aws sns list-topics` / `list-subscriptions-by-topic`, `aws budgets`, us-east-1 billing alarms; read-only). The `PPA*` / `ppa-*` alarms in the same account belong to another project and are not covered here.

Two SNS topics are in use, with near-identical names: `GlobalPerspectivesAlerts` (1 https subscription to AWS Chatbot + 1 email) and `GlobalPerspectiveAlerts` (1 email). The alarm list below says which one each alarm notifies. The monitor Lambdas (freshness, error digest, model guard, source audit) publish to `GlobalPerspectiveAlerts`.

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

## Everything that can alert the operator (inventory, 2026-10-20)
| Source | Kind | Goes to | When | Last 24 h |
|---|---|---|---|---|
| 13 alarms above (Lambda errors on 7 functions, proxy throttles/p99, DynamoDB throttles, account error spike) | CloudWatch | `GlobalPerspectivesAlerts` (email + chat) | on breach | 14 messages, all from `lambda-errors-newsPostLinkedin` flapping 7× |
| `situation-tracker-errors`, `situation-tracker-stalled` | CloudWatch | `GlobalPerspectiveAlerts` (email) | on breach | 0 |
| `newsModelGuard` (DeepSeek balance < $3 or unavailable; retired model ids in env) | monitor Lambda, `TriggerModelGuard` 12:00Z | `GlobalPerspectiveAlerts` | daily | balance alert ($0.14 on 10-19, $0 on 10-20); repeats two PPA model findings daily |
| `newsFreshnessMonitor` (topics older than 9 h; daily settle check at 12:30Z) | monitor Lambda, `TriggerFreshnessMonitor` | `GlobalPerspectiveAlerts` | every 2 h | **paused 2026-10-20** (re-sent "stale" every 2 h in the outage) |
| `newsErrorDigest` (new or spiking browser errors) | monitor Lambda, `TriggerErrorDigest` | `GlobalPerspectiveAlerts` | every 6 h | 2 digests |
| `newsSourceAudit` (LLM drift check on 6 topics) | monitor Lambda, `newsSourceAuditDaily` (Mon/Wed/Fri 11:30Z) | `GlobalPerspectiveAlerts` | 3× a week | flagged 5/6 as drift on 10-19 (threshold 2; likely false positives) |
| `newsBreakingAlert` (a story crosses the significance bar) | Lambda, Resend email from onboarding@resend.dev | the operator's address | 04:35/12:35/20:35Z | 0 |
| `newsImpactAudit`; `newsEmailSender` breaking and drift modes | — | — | rules DISABLED | — |
| `AWS-Bill-Over-5-Dollars` (us-east-1) and budget `Monthly-AWS-Budget` ($20; 25%, 100%, forecast 100%) | billing | `AWSCostAlerts` (email) / budget email | on breach | 0 |
`ppa-*` budgets and the `ppa-alerts` topic belong to the other project.

**Noise found 2026-10-20:** `newsPostLinkedin` fails every 3 h with LinkedIn `429 share limit` (it retries the same stale topics
while DeepSeek is down), so its alarm fires and clears 7 times a day to email and chat. Not changed yet (operator: discuss first).

## Open questions (for a separate review session; nothing decided)
1. Which alerts do we need at all, and who acts on each? (A solo operator: every alert should name the action it asks for.)
2. One topic or two? Today `GlobalPerspectivesAlerts` (email + chat) carries the Lambda alarms and `GlobalPerspectiveAlerts`
   (email only) carries the monitors and the tracker alarms.
3. Alert on causes, not only effects: no alarm watches `LLM 402` / `Insufficient Balance`, and stages swallow LLM errors
   (Lambda `Errors` stays 0). Lane G is writing an alarm spec (`backend/monitoring/alarms/`).
4. Dedupe: one email when something breaks and one when it recovers (freshness monitor, flapping alarms).
5. Expected refusals are not errors: LinkedIn `429 share limit`, "no new topics" should be skips, not Lambda errors.
6. Social posting during an outage: post stale topics, or pause automatically when the topics are older than N hours?
7. Are the monitors worth their cost and noise: source audit (5/6 flagged), model guard repeating PPA findings daily?
8. Daily digest instead of instant mail for non-urgent alerts?
Session prompt: `/Users/benlai/Downloads/gp-mailbox/prompts/review-alerts.md` (outside the repo; the questions above are the brief).

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
