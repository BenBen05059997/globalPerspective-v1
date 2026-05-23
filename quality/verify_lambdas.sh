#!/usr/bin/env bash
# verify_lambdas.sh — Lambda + cron health for the economic disruption stack.
# Checks both producer (newsEconomicImpact) and judge (newsEconomicQuality):
#   - Lambda function exists and runtime is recent
#   - Required env vars are wired
#   - EventBridge cron rule exists, is ENABLED, has the expected schedule
#   - Most recent invocation finished within freshness window
#
# Exit 0 if all required checks pass, 1 otherwise.

set -u
REGION=ap-northeast-1
PASS=0
FAIL=0
FAILED=()

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }

check() {
  local id="$1"; local label="$2"; local cond="$3"; local detail="${4:-}"
  if [ "$cond" = "true" ]; then
    PASS=$((PASS + 1)); echo "  $(green PASS) $id $label"
  else
    FAIL=$((FAIL + 1)); FAILED+=("$id $label — $detail"); echo "  $(red FAIL) $id $label  $detail"
  fi
}

check_lambda() {
  local fn="$1"; shift
  local required_env=("$@")
  echo
  echo "==> Lambda: $fn"

  local cfg
  cfg=$(aws lambda get-function-configuration --function-name "$fn" --region "$REGION" --output json 2>/dev/null || echo '{}')
  local exists
  exists=$(echo "$cfg" | python3 -c "import json,sys;d=json.load(sys.stdin);print('true' if d.get('FunctionName') else 'false')")
  check "lambda.exists" "$fn exists" "$exists" "$(echo "$cfg" | head -c 100)"
  [ "$exists" = "true" ] || return

  local runtime
  runtime=$(echo "$cfg" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('Runtime',''))")
  check "lambda.runtime" "runtime is nodejs (got: $runtime)" "$(echo "$runtime" | grep -q nodejs && echo true || echo false)"

  # Required env vars
  for var in "${required_env[@]}"; do
    local present
    present=$(echo "$cfg" | python3 -c "
import json,sys
d = json.load(sys.stdin)
env = d.get('Environment',{}).get('Variables',{})
print('true' if env.get('$var') else 'false')
")
    check "env.$var" "env var $var set" "$present"
  done

  # Find most recent invocation log line
  local recent
  recent=$(aws logs filter-log-events --log-group-name "/aws/lambda/$fn" --region "$REGION" \
    --start-time $(python3 -c "import time;print(int((time.time()-30*3600)*1000))") \
    --filter-pattern 'REPORT' --max-items 1 --output json 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);ev=d.get('events',[]);print('true' if ev else 'false')")
  check "lambda.fresh" "invoked within last 30h" "$recent" "(check CloudWatch /aws/lambda/$fn)"
}

check_cron() {
  local rule="$1"; local expected="$2"
  echo
  echo "==> Cron rule: $rule"
  local r
  r=$(aws events describe-rule --name "$rule" --region "$REGION" --output json 2>/dev/null || echo '{}')
  local state schedule
  state=$(echo "$r" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('State',''))")
  schedule=$(echo "$r" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('ScheduleExpression',''))")
  check "cron.exists" "$rule exists" "$([ -n "$state" ] && echo true || echo false)"
  check "cron.enabled" "$rule is ENABLED (got: $state)" "$([ "$state" = "ENABLED" ] && echo true || echo false)"
  check "cron.schedule" "schedule is $expected (got: $schedule)" "$([ "$schedule" = "$expected" ] && echo true || echo false)"
}

check_lambda newsEconomicImpact \
  SUMMARIZE_PREDICT_TABLE TOPICS_DDB_TABLE MARKETS_DDB_TABLE XAI_API_KEY GROK_MODEL

check_lambda newsEconomicQuality \
  SUMMARIZE_PREDICT_TABLE XAI_API_KEY GROK_MODEL GROK_API_URL

check_cron TriggerNewsEconomicImpact 'cron(30 7 * * ? *)'
check_cron TriggerNewsEconomicQuality 'cron(0 8 * * ? *)'

echo
echo "==> Summary: $(green "$PASS pass") / $(red "$FAIL fail")"
if [ $FAIL -gt 0 ]; then
  echo; echo "Failures:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
