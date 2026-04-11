#!/usr/bin/env bash
#
# setup-dynamodb-gsi.sh
#
# Adds the SK-generatedAt-index GSI to the SummarizeAndPredict table.
# Safe to run: exits early if the GSI already exists.
#
# GSI design:
#   PK: SK  (values: SUMMARY, PREDICTION, TRACE_CAUSE, THREAD_ANALYSIS,
#                    COUNTRY_INTELLIGENCE, DAILY_BRIEF)
#   SK: generatedAt  (ISO 8601 string, e.g. "2026-04-10T07:00:00.000Z")
#
# Example queries:
#   - All daily briefs newest first:
#       KeyConditionExpression: "SK = :sk"
#       ExpressionAttributeValues: {":sk": {"S": "DAILY_BRIEF"}}
#       ScanIndexForward: false
#       IndexName: "SK-generatedAt-index"
#
#   - Daily briefs from the last 7 days:
#       KeyConditionExpression: "SK = :sk AND generatedAt >= :since"
#       ExpressionAttributeValues: {":sk": {"S": "DAILY_BRIEF"}, ":since": {"S": "2026-04-03T00:00:00.000Z"}}
#       IndexName: "SK-generatedAt-index"
#
# Note: only items that have a generatedAt attribute appear in the GSI.
# All Lambda writes already include generatedAt, so coverage is complete
# for new items. Older items without generatedAt are simply absent from
# GSI results, which is fine — they're stale/expired anyway.

set -euo pipefail

REGION="ap-northeast-1"
TABLE="SummarizeAndPredict"
INDEX="SK-generatedAt-index"

log() { printf "\033[1;34m[gsi]\033[0m %s\n" "$*"; }

# Check if GSI already exists
EXISTING=$(aws dynamodb describe-table \
  --table-name "$TABLE" \
  --region "$REGION" \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='$INDEX'].IndexName" \
  --output text 2>/dev/null || true)

if [[ -n "$EXISTING" ]]; then
  STATUS=$(aws dynamodb describe-table \
    --table-name "$TABLE" \
    --region "$REGION" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='$INDEX'].IndexStatus" \
    --output text)
  log "GSI $INDEX already exists (status: $STATUS). Nothing to do."
  exit 0
fi

log "Adding GSI $INDEX to $TABLE..."
aws dynamodb update-table \
  --table-name "$TABLE" \
  --region "$REGION" \
  --attribute-definitions \
    AttributeName=SK,AttributeType=S \
    AttributeName=generatedAt,AttributeType=S \
  --global-secondary-index-updates "[{
    \"Create\": {
      \"IndexName\": \"$INDEX\",
      \"KeySchema\": [
        {\"AttributeName\": \"SK\", \"KeyType\": \"HASH\"},
        {\"AttributeName\": \"generatedAt\", \"KeyType\": \"RANGE\"}
      ],
      \"Projection\": {\"ProjectionType\": \"ALL\"}
    }
  }]" > /dev/null

log "GSI creation started. Checking status..."
for i in {1..12}; do
  STATUS=$(aws dynamodb describe-table \
    --table-name "$TABLE" \
    --region "$REGION" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='$INDEX'].IndexStatus" \
    --output text)
  log "  [$i/12] $STATUS"
  [[ "$STATUS" == "ACTIVE" ]] && { log "GSI is ACTIVE."; exit 0; }
  sleep 10
done

log "GSI still building — this is normal for large tables. Check status with:"
log "  aws dynamodb describe-table --table-name $TABLE --region $REGION --query 'Table.GlobalSecondaryIndexes[0].IndexStatus'"
