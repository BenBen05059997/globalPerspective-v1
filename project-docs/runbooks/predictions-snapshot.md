# Track-record snapshot (newsPredictionsSnapshot)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerPredictionsSnapshot`, `rate(30 minutes)`, no input.
Repo source: `backend/predictions/newsPredictionsSnapshot/src/`.

## What it means
Scans `PREDICTION_LOG_TABLE` and writes the track-record aggregate and question board to S3 `predictions/track_record.json` (`TRACK_RECORD_KEY`). No LLM.

## Check
- Schedule state: `aws events describe-rule --name TriggerPredictionsSnapshot --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsPredictionsSnapshot --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsPredictionsSnapshot --since 2d --region ap-northeast-1 --filter-pattern '"[predictions-snapshot] scanned"'`
- Known failures: `question board failed` — `aws logs tail /aws/lambda/newsPredictionsSnapshot --since 2d --region ap-northeast-1 --filter-pattern '"question board failed"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsPredictionsSnapshot --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Overwrites one key; safe to re-run with payload `{}`. If the board fails the file is still written and the run then errors.

## Escalate
- Alarm/alert: Freshness monitor settle check flags a board older than 6 h.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
