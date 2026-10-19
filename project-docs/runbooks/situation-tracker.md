# Situation tracker / world bundle (newsSituationTracker)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerSituationTracker`, `rate(30 minutes)`, no input. (The code comment says every 10 minutes; the live rule is 30.) Live env `DRY_RUN=false`.
Repo source: `backend/situations/newsSituationTracker/src/`.

## What it means
Sole writer of situation state and the map bundle: folds the GDACS inbox, `stories/index.json` and `threads/story-map.json` into `situations/state/`, `situations/index.json`, `situations/archive/`, `world/latest.json`, `world/latest.member.json` and timestamped `world/…` / `situations/history/…` snapshots. Emits `ChecksRun` and other metrics (`GlobalPerspective/Situations`, dimension `Mode`). No LLM.

## Check
- Schedule state: `aws events describe-rule --name TriggerSituationTracker --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSituationTracker --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSituationTracker --since 2d --region ap-northeast-1 --filter-pattern '"[tracker] {\"ok\":true"'`
- Known failures: `[tracker] metric failed`, `[tracker] archive failed`, `[tracker] inbox move failed` — `aws logs tail /aws/lambda/newsSituationTracker --since 2d --region ap-northeast-1 --filter-pattern '"[tracker] metric failed"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSituationTracker --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Each extra run advances cooling counts on situations missing from sources (they close after `CLOSE_AFTER_COOL_CHECKS`) and writes a new snapshot, so re-run once only after a missed run: payload `{}`.

## Escalate
- Alarm/alert: `situation-tracker-errors` (Errors ≥ 1 in 10 min) and `situation-tracker-stalled` (`ChecksRun` < 1 over two 30-min periods, missing data = breaching) → SNS `GlobalPerspectiveAlerts`; see `alarms.md`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
