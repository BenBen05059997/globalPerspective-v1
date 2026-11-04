# Alarms and the client-error CORS config

The operator does not want pipeline alarms (no per-stage, per-Lambda, 402 or record alarms). Do not create any without a fresh request.

What exists live (CloudWatch, read 2026-11-04):
- No Global Perspectives alarms. The last two, `situation-tracker-errors` and `situation-tracker-stalled`, were deleted 2026-11-04 (operator); the hourly `newsHealth` view (`record/views/health.json`, ARCHITECTURE_OPS.md) covers them.
- The SNS topic `GlobalPerspectiveAlerts` stays for the monitor Lambdas (`newsModelGuard`, `newsErrorDigest`, `newsFreshnessMonitor`, `newsSourceAudit`, env `SNS_TOPIC_ARN`).

Removed 2026-11-02: the native `lambda-errors-*`, `lambda-duration-*` and `lambda-throttles-*` alarms, the DynamoDB throttle alarms, `Lambda-Errors-Spike`, the unused topic `GlobalPerspectivesAlerts`, the alarm proposal `spec.json` (and its test), and `scripts/setup-cloudwatch-alarms.sh`. Git history keeps them.

## Client-error CORS

`client-errors-cors.json` is the Function URL CORS config of `newsClientErrors`. It matches the live config: methods POST, header content-type, max age 3600, origins `https://globalperspective.net`, `https://www.globalperspective.net`, `https://benben05059997.github.io` and the localhost / 127.0.0.1 development ports 5173 and 5174. The handler emits no `Access-Control-Allow-Origin`, so the Function URL stays the only CORS owner; do not add CORS headers to the handler while the URL emits them. Apply a change with `aws lambda update-function-url-config --function-name newsClientErrors --cors file://backend/monitoring/alarms/client-errors-cors.json --region ap-northeast-1` after re-reading the live config (operator go-ahead).

Offline check: `node --test backend/monitoring/alarms/client-errors-cors.test.mjs`.
