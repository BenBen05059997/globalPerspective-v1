# monitoring

This group watches the site and the pipeline and tells the operator when something is wrong. It serves only the operator:
publishers use their configured SNS topic. The audit found two topics; [alarms/README.md](alarms/README.md) proposes
consolidation on `GlobalPerspectivesAlerts` (email + chat). None of these Lambdas changes site content, and a quiet
run sends nothing.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → **10 Watch**
This folder is stage 10: model guard, freshness monitor, error digest, audits. Timeline: writes no facts or readings; Run objects are the record's own signal and the operator does not want pipeline alarms (2026-10-31). See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsErrorDigest | Folds browser error rows into fingerprints and alerts on new or spiking ones. | EventBridge `TriggerErrorDigest`, minute 15 every 6 hours UTC, ENABLED | DynamoDB GlobalPerspectiveClientErrors (full scan) | Its own baseline row `DIGEST#STATE` in the same table; SNS | [README](newsErrorDigest/README.md) |
| newsFreshnessMonitor | Alerts when the topics feed is stale or the proxy fails; once a day also checks the prediction-settling flow. | EventBridge `TriggerFreshnessMonitor`, minute 30 every 2 hours UTC, DISABLED (operator pause 2026-10-20) | Public proxy actions `topics` and `prediction_track_record`; proposed private dedupe marker | SNS; dedupe marker | [README](newsFreshnessMonitor/README.md) |
| newsImpactAudit | Asks an LLM which high-impact events the topic selector missed, plus disaster and conflict coverage gaps. | EventBridge `TriggerImpactAudit`, 09:00 UTC, DISABLED | S3 world bucket `audit/ingest-capture/latest.json`, `corpus/gdacs/latest.json`, `corpus/gdelt/<day>.json`; DeepSeek | S3 `audit/impact/<date>.json` and `latest.json`; SNS | [README](newsImpactAudit/README.md) |
| newsModelGuard | Checks the DeepSeek balance and flags retired or unknown model ids in other Lambdas' env. | EventBridge `TriggerModelGuard`, 12:00 UTC, ENABLED | `lambda:ListFunctions` env; `api.deepseek.com` `/models` and `/user/balance` | SNS | [README](newsModelGuard/README.md) |
| newsSourceAudit | Compares the top live summaries against their source articles and counts drift. | EventBridge `newsSourceAuditDaily`, Mon, Wed, Fri 11:30 UTC, ENABLED | Public proxy actions `topics`, `summary`; source article pages; DeepSeek | SNS when drift reaches the threshold | [README](newsSourceAudit/README.md) |

## Pipeline

1. Readers' browsers post uncaught errors to newsClientErrors (read-api group), which counts them per day and fingerprint.
2. Every 6 hours newsErrorDigest compares those counts with its last run and alerts on new or growing fingerprints. Its first run only stores a baseline.
3. Every 2 hours newsFreshnessMonitor calls the public topics action and alerts once on an unhealthy transition and once on recovery, with persisted dedupe, when it fails or is older than `STALE_HOURS`. The 12:30 UTC run also sends the settle alert if the weekly prediction flow is behind.
4. At 12:00 UTC newsModelGuard checks the DeepSeek balance and the model ids set on every Lambda.
5. On Monday, Wednesday and Friday newsSourceAudit audits the top live topics against their sources.
6. newsImpactAudit would run daily at 09:00 UTC but its schedule is DISABLED, so it runs only when invoked by hand.
7. Notification topic migration and the alarm configuration are proposals in alarms/; existing delivery routing is unchanged.

## Shared code

- newsFreshnessMonitor: `links`. newsImpactAudit and newsSourceAudit: `llm`.
- newsErrorDigest and newsModelGuard use no shared module.
- See the [shared README](../shared/README.md).

## Known limits

- newsImpactAudit is dormant until its rule is enabled.
- newsErrorDigest scans the whole errors table on every run.
- newsModelGuard's "days left" line uses a fixed burn rate in code, not real spend.
- Live `STALE_HOURS` on newsFreshnessMonitor is 9; the proposed code default is also 9.
- newsImpactAudit's live env still names two dropped DynamoDB tables; the code reads S3 only.
- newsSourceAudit's rule name says Daily but runs three days a week.

## How to check it

```
aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`ErrorDigest`)||contains(Name,`Freshness`)||contains(Name,`ModelGuard`)||contains(Name,`ImpactAudit`)||contains(Name,`SourceAudit`)].[Name,State,ScheduleExpression]' --output text
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:ap-northeast-1:280362093938:GlobalPerspectiveAlerts --region ap-northeast-1 --query 'Subscriptions[].Protocol' --output text
aws s3 ls s3://globalperspective-world-280362093938/audit/impact/
```

Last verified: 2026-10-20 against code @14dd450d and live AWS.
