# monitoring

This group watches the site and the pipeline and tells the operator when something is wrong. (The impact audit, newsImpactAudit, was removed 2026-11-01.) It serves only the operator:
publishers use the SNS topic `GlobalPerspectiveAlerts`. None of these Lambdas changes site content, and a quiet
run sends nothing. CloudWatch alarm proposals and the client-error CORS config are in [alarms/README.md](alarms/README.md).

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → **10 Watch**
This folder is stage 10: model guard, freshness monitor, error digest, audits. Timeline: writes no facts or readings; Run objects are the record's own signal and the operator does not want pipeline alarms (2026-10-31). See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsErrorDigest | Folds browser error rows into fingerprints and alerts on new or spiking ones. | EventBridge `TriggerErrorDigest`, minute 15 every 6 hours UTC, ENABLED | DynamoDB GlobalPerspectiveClientErrors (full scan) | Its own baseline row `DIGEST#STATE` in the same table; SNS | [README](newsErrorDigest/README.md) |
| newsFreshnessMonitor | Alerts when the topics feed is stale or the proxy fails; once a day also checks the prediction-settling flow. | EventBridge `TriggerFreshnessMonitor`, minute 30 every 2 hours UTC, ENABLED | Public proxy action `topics`; the record's public view files (`track-record.json`, `manifest.json`, `health/settle-tick.json`); S3 dedupe marker `monitoring/freshness/state.json` | SNS; the marker | [README](newsFreshnessMonitor/README.md) |
| newsModelGuard | Checks the DeepSeek balance and flags retired or unknown model ids in other Lambdas' env. | EventBridge `TriggerModelGuard`, 12:00 UTC, ENABLED | `lambda:ListFunctions` env; `api.deepseek.com` `/models` and `/user/balance` | SNS | [README](newsModelGuard/README.md) |
| newsSourceAudit | Compares the top live summaries against their source articles and counts drift. | EventBridge `newsSourceAuditDaily`, Mon, Wed, Fri 11:30 UTC, ENABLED | Public proxy actions `topics`, `summary`; source article pages; DeepSeek | SNS when drift reaches the threshold | [README](newsSourceAudit/README.md) |

## Pipeline

1. Readers' browsers post uncaught errors to newsClientErrors (read-api group), which counts them per day and fingerprint.
2. Every 6 hours newsErrorDigest compares those counts with its last run and alerts on new or growing fingerprints. Its first run only stores a baseline.
3. Every 2 hours newsFreshnessMonitor calls the public topics action and alerts once on an unhealthy transition and once on recovery (dedupe kept in the S3 marker) when it fails or is older than `STALE_HOURS`. The 12:30 UTC run also sends the settle alert if the weekly prediction flow is behind (read from the record's track-record view, manifest and the resolver's heartbeat, `SETTLE_SOURCE=record`, decision 0052; the old snapshot-file source through the removed `prediction_track_record` action no longer works).
4. At 12:00 UTC newsModelGuard checks the DeepSeek balance and the model ids set on every Lambda.
5. On Monday, Wednesday and Friday newsSourceAudit audits the top live topics against their sources.

## Shared code

- newsFreshnessMonitor: `links`. newsSourceAudit: `llm`.
- newsErrorDigest and newsModelGuard use no shared module.
- See the [shared README](../shared/README.md).

## Known limits

- newsErrorDigest scans the whole errors table on every run.
- newsModelGuard's "days left" line uses a fixed burn rate in code, not real spend.
- newsFreshnessMonitor needs its S3 marker (see its README); live `STALE_HOURS` is 9, the code default too.
- newsSourceAudit's rule name says Daily but runs three days a week.

## How to check it

```
aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`ErrorDigest`)||contains(Name,`Freshness`)||contains(Name,`ModelGuard`)||contains(Name,`SourceAudit`)].[Name,State,ScheduleExpression]' --output text
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:ap-northeast-1:280362093938:GlobalPerspectiveAlerts --region ap-northeast-1 --query 'Subscriptions[].Protocol' --output text
```
