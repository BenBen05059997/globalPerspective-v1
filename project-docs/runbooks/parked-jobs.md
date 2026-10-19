# Parked (disabled) scheduled jobs

Last verified: 2026-10-19 (`aws events list-rules` / `list-targets-by-rule`, read-only).

## Trigger
These EventBridge rules exist and are `DISABLED`, except the one marked "to be disabled":

| Rule | Schedule (UTC) | Target and input | Why off |
|---|---|---|---|
| `TriggerNewsEconomicImpact` | `cron(30 7 * * ? *)` | `newsEconomicImpact` | economy parked (decisions/0009, 0015) |
| `TriggerNewsEconomicQuality` | `cron(0 8 * * ? *)` | `newsEconomicQuality` | economy parked |
| `TriggerWeeklyMarkets` | `cron(30 8 ? * SUN *)` | `newsWeeklyMarkets` | economy parked |
| `TriggerImpactAudit` | `cron(0 9 * * ? *)` | `newsImpactAudit` | parked 2026-09-28 (decisions/0015) |
| `TriggerPairIntelligenceWeekly` | `cron(0 8 ? * MON *)` | `newsPairIntelligence`, input `{}` | pair intelligence has no consumer (decisions/0007) |
| `TriggerBreakingEmailSend` | `rate(15 minutes)` | `newsEmailSender`, input `{"mode":"breaking"}` | subscriber breaking emails are off |
| `TriggerDriftEmailSend` | `cron(40 7 * * ? *)` | `newsEmailSender`, input `{"mode":"drift_alert"}` | drift emails wait for the first follower ([drift-email](drift-email.md)) |
| `TriggerSignalsBuild` | `cron(0 10 * * ? *)` | `newsSignals`, input `{"action":"build"}` | Signals API parked (decisions/0032). **To be disabled**: still ENABLED on 2026-10-19 until the coordinator runs `disable-rule` with an operator yes |

## What it means
Nothing runs; the code stays in the repo. A disabled rule is the intended state, not a fault.

## Check
`aws events describe-rule --name <rule> --region ap-northeast-1` (expect `"State": "DISABLED"`).

## Fix
Re-enabling is a product decision, not a fix. Enabling a user-facing send (the two email rules) needs a fresh operator yes (CLAUDE.md, Authorization). When asked: `aws events enable-rule --name <rule> --region ap-northeast-1`, then `describe-rule` to confirm.

## Escalate
Operator.
