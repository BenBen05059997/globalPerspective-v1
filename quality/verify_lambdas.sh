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

# Check that the role attached to a Lambda has all expected policies attached.
# Required policies are the absolute minimum: log writing, DynamoDB R/W.
check_role_policies() {
  local fn="$1"; shift
  local required=("$@")
  echo
  echo "==> IAM policies for $fn's execution role"

  local role
  role=$(aws lambda get-function-configuration --function-name "$fn" --region "$REGION" --output json 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);r=d.get('Role','');print(r.split('/')[-1] if r else '')")
  if [ -z "$role" ]; then
    check "iam.role" "$fn has an execution role" "false" "(could not resolve role)"
    return
  fi

  local attached
  attached=$(aws iam list-attached-role-policies --role-name "$role" --output json 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(','.join(p['PolicyName'] for p in d.get('AttachedPolicies',[])))")

  for pol in "${required[@]}"; do
    if echo ",$attached," | grep -q ",$pol,"; then
      PASS=$((PASS + 1)); echo "  $(green PASS) iam.attached  $pol attached to $role"
    elif echo "$attached" | grep -q "$pol"; then
      # Pattern match (e.g., AWSLambdaBasicExecutionRole-*)
      PASS=$((PASS + 1)); echo "  $(green PASS) iam.attached  $pol-style policy attached to $role"
    else
      FAIL=$((FAIL + 1)); FAILED+=("iam.attached $pol missing from $role")
      echo "  $(red FAIL) iam.attached  $pol missing from $role"
    fi
  done
}

# Compare the deployed Lambda's index.js to the committed source. Catches
# "deployed code ≠ source on main" — would have caught my deploy mishap yesterday
# where I had to redeploy after the diagnostic finally landed.
check_code_drift() {
  local fn="$1"; local src_path="$2"
  echo
  echo "==> Code drift: $fn"

  local tmp
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" RETURN

  local url
  url=$(aws lambda get-function --function-name "$fn" --region "$REGION" --output json 2>/dev/null \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('Code',{}).get('Location',''))")
  if [ -z "$url" ]; then
    check "drift.fetch" "fetched deployed package URL" "false" "(API returned no Location)"
    return
  fi

  curl -sL "$url" -o "$tmp/lambda.zip" || { check "drift.fetch" "downloaded deployed package" "false"; return; }
  unzip -q "$tmp/lambda.zip" -d "$tmp/unzip" 2>/dev/null || { check "drift.unzip" "unzipped package" "false"; return; }

  if [ ! -f "$tmp/unzip/index.js" ]; then
    check "drift.has_index" "deployed package has index.js" "false"
    return
  fi
  if [ ! -f "$src_path" ]; then
    check "drift.has_src" "source $src_path exists locally" "false"
    return
  fi

  local deployed_sha local_sha
  deployed_sha=$(shasum -a 256 "$tmp/unzip/index.js" | awk '{print $1}')
  local_sha=$(shasum -a 256 "$src_path" | awk '{print $1}')

  if [ "$deployed_sha" = "$local_sha" ]; then
    PASS=$((PASS + 1)); echo "  $(green PASS) drift.index_js  deployed index.js matches source ($deployed_sha)"
  else
    FAIL=$((FAIL + 1)); FAILED+=("drift.index_js $fn: deployed != source")
    echo "  $(red FAIL) drift.index_js  deployed=$deployed_sha != source=$local_sha"
    echo "       Source may have committed code newer than what's deployed (run an update-function-code)."
  fi
}

check_lambda newsEconomicImpact \
  SUMMARIZE_PREDICT_TABLE TOPICS_DDB_TABLE MARKETS_DDB_TABLE XAI_API_KEY GROK_MODEL

check_lambda newsEconomicQuality \
  SUMMARIZE_PREDICT_TABLE XAI_API_KEY GROK_MODEL GROK_API_URL

check_cron TriggerNewsEconomicImpact 'cron(30 7 * * ? *)'
check_cron TriggerNewsEconomicQuality 'cron(0 8 * * ? *)'

# Both Lambdas share the newsCountryIntelligence role — these policies are
# the minimum: log writing, broader CloudWatch (for filter logs), DDB R/W.
check_role_policies newsEconomicImpact \
  AWSLambdaBasicExecutionRole CloudWatchFullAccess AmazonDynamoDBFullAccess

check_code_drift newsEconomicImpact  amplify/backend/function/newsEconomicImpact/src/index.js
check_code_drift newsEconomicQuality amplify/backend/function/newsEconomicQuality/src/index.js

echo
echo "==> Summary: $(green "$PASS pass") / $(red "$FAIL fail")"
if [ $FAIL -gt 0 ]; then
  echo; echo "Failures:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
