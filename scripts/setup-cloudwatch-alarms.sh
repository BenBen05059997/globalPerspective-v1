#!/usr/bin/env bash
#
# setup-cloudwatch-alarms.sh
#
# Creates CloudWatch alarms for the Global Perspectives Lambda pipeline.
# Safe to run repeatedly — put-metric-alarm is idempotent (overwrites by name).
#
# Usage:
#   ./scripts/setup-cloudwatch-alarms.sh
#   ./scripts/setup-cloudwatch-alarms.sh --email you@example.com   # wire up email alerts
#   ./scripts/setup-cloudwatch-alarms.sh --sns-arn arn:aws:sns:...  # existing SNS topic
#
# Alarms created:
#   - Lambda Errors > 0 (5-min window) for every pipeline function
#   - Lambda Throttles > 0 for newsSensitiveData-dev (serves frontend)
#   - Lambda Duration > 20s for newsSensitiveData-dev (timeout is 25s)
#   - DynamoDB ReadThrottleEvents + WriteThrottleEvents for SummarizeAndPredict + NewsCache

set -euo pipefail

REGION="ap-northeast-1"
SNS_ARN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      EMAIL="${2:-}"; [[ -n "$EMAIL" ]] || { echo "ERROR: --email requires an address" >&2; exit 1; }; shift 2 ;;
    --sns-arn)
      SNS_ARN="${2:-}"; [[ -n "$SNS_ARN" ]] || { echo "ERROR: --sns-arn requires an ARN" >&2; exit 1; }; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

log() { printf "\033[1;34m[alarms]\033[0m %s\n" "$*"; }

# Create SNS topic + subscription if --email supplied and no ARN given
if [[ -n "$EMAIL" && -z "$SNS_ARN" ]]; then
  log "Creating SNS topic GlobalPerspectivesAlerts..."
  SNS_ARN=$(aws sns create-topic \
    --name GlobalPerspectivesAlerts \
    --region "$REGION" \
    --query TopicArn --output text)
  log "Subscribing $EMAIL to $SNS_ARN"
  aws sns subscribe \
    --topic-arn "$SNS_ARN" \
    --protocol email \
    --notification-endpoint "$EMAIL" \
    --region "$REGION" > /dev/null
  log "Subscription pending — check your inbox to confirm."
fi

ALARM_ACTIONS=""
if [[ -n "$SNS_ARN" ]]; then
  ALARM_ACTIONS="--alarm-actions $SNS_ARN --ok-actions $SNS_ARN"
fi

put_lambda_errors() {
  local fn="$1"
  local name="lambda-errors-${fn}"
  log "Alarm: $name"
  # shellcheck disable=SC2086
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-description "Lambda function $fn threw errors" \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value="$fn" \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    $ALARM_ACTIONS
}

put_lambda_throttles() {
  local fn="$1"
  local name="lambda-throttles-${fn}"
  log "Alarm: $name"
  # shellcheck disable=SC2086
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-description "Lambda function $fn is being throttled" \
    --namespace AWS/Lambda \
    --metric-name Throttles \
    --dimensions Name=FunctionName,Value="$fn" \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    $ALARM_ACTIONS
}

put_lambda_duration() {
  local fn="$1"
  local threshold_ms="$2"
  local name="lambda-duration-${fn}"
  log "Alarm: $name (>${threshold_ms}ms)"
  # shellcheck disable=SC2086
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-description "Lambda $fn p99 duration exceeding ${threshold_ms}ms" \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value="$fn" \
    --extended-statistic p99 \
    --period 300 \
    --evaluation-periods 2 \
    --threshold "$threshold_ms" \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    $ALARM_ACTIONS
}

put_dynamodb_throttles() {
  local table="$1"
  local operation="$2"  # ReadThrottleEvents or WriteThrottleEvents
  local name="dynamodb-$(echo "$operation" | tr '[:upper:]' '[:lower:]')-${table}"
  log "Alarm: $name"
  # shellcheck disable=SC2086
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-description "DynamoDB $table $operation throttling" \
    --namespace AWS/DynamoDB \
    --metric-name "$operation" \
    --dimensions Name=TableName,Value="$table" \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    $ALARM_ACTIONS
}

log "Region: $REGION"
[[ -n "$SNS_ARN" ]] && log "Alarm actions → $SNS_ARN" || log "No SNS topic — alarms will appear in console only. Use --email to add notifications."

# Pipeline Lambda error alarms (all functions)
PIPELINE_FUNCTIONS=(
  "newsInvokeGemini-dev"
  "NewsProjectInvokeAgentLambda-dev"
  "newsThreadAnalysis"
  "newsCountryIntelligence"
  "newsPostDevTo"
  "newsSensitiveData-dev"
  "newsPostLinkedin"
  "newsStripeWebhook"
)

log "--- Lambda error alarms ---"
for fn in "${PIPELINE_FUNCTIONS[@]}"; do
  put_lambda_errors "$fn"
done

log "--- Lambda throttle alarms (frontend proxy) ---"
put_lambda_throttles "newsSensitiveData-dev"

log "--- Lambda duration alarms ---"
# newsSensitiveData timeout = 25s → alert if p99 > 20s (80%)
put_lambda_duration "newsSensitiveData-dev" 20000

log "--- DynamoDB throttle alarms ---"
put_dynamodb_throttles "SummarizeAndPredict" "ReadThrottleEvents"
put_dynamodb_throttles "SummarizeAndPredict" "WriteThrottleEvents"
put_dynamodb_throttles "NewsCache" "ReadThrottleEvents"
put_dynamodb_throttles "NewsCache" "WriteThrottleEvents"

log "Done. View alarms at: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#alarmsV2:"
