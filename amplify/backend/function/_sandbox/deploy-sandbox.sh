#!/usr/bin/env bash
#
# deploy-sandbox.sh — stand up ISOLATED sandbox copies of the billing Lambdas so the credit
# flow can be tested against Polar's Sandbox (test cards) WITHOUT touching production billing.
#
# What it creates (idempotent — create if missing, else update code + config):
#   • newsPolarBilling-sandbox   (Function URL, public — Polar Sandbox webhook posts here)
#   • newsAnalyze-sandbox        (Function URL, public — the member/credit run path)
# Both point at https://sandbox-api.polar.sh and reuse the EXISTING prod IAM roles (so no new
# IAM is needed). They read/write the SAME users table by default — test purchases use a test
# Firebase account, so they only ever create a throwaway test-uid row (delete it when done).
# For full table isolation instead, set USERS_DDB_TABLE to a separate table AND grant that
# table to the reused role first (see NOTE at the bottom).
#
# This script NEVER touches the production newsPolarBilling / newsAnalyze functions or config.
#
# ── Usage ─────────────────────────────────────────────────────────────────────────────────
#   1. In Polar SANDBOX (sandbox.polar.sh): create subscription products + one-time credit-pack
#      products; create an Organization Access Token; create a webhook (you'll point it at the
#      printed Function URL after first run) and copy its signing secret.
#   2. export the vars below, then run this script.
#   3. Put the printed newsPolarBilling-sandbox URL into the Polar Sandbox webhook endpoint.
#   4. Test: test-card checkout (subscription + a credit pack) → webhook → balance/tier update.
#
# Required env (no secret is ever echoed):
#   AWS_REGION (default ap-northeast-1)
#   FIREBASE_PROJECT_ID
#   USERS_DDB_TABLE                     # default GlobalPerspectiveUserTable (shared w/ prod)
#   POLAR_ACCESS_TOKEN_SANDBOX          # sandbox org access token
#   POLAR_WEBHOOK_SECRET_SANDBOX        # sandbox webhook signing secret
#   POLAR_PRODUCT_MONTHLY_SANDBOX       # sandbox subscription product ids
#   POLAR_PRODUCT_YEARLY_SANDBOX
#   POLAR_CREDIT_PACKS_SANDBOX          # JSON: {"small":{"productId":"...","credits":50}, ...}
#   MEMBER_MONTHLY_ALLOWANCE            # member free runs/month (e.g. 20)
#   ANALYZE_LLM_KEY                     # DeepSeek key for newsAnalyze (the XAI_API_KEY value)
#   ANALYZE_LLM_URL (default https://api.deepseek.com)
#   ANALYZE_LLM_MODEL (default deepseek-chat)
#
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FN_DIR="$(cd "$HERE/.." && pwd)"   # amplify/backend/function
USERS_TABLE="${USERS_DDB_TABLE:-GlobalPerspectiveUserTable}"
ANALYZE_LLM_URL="${ANALYZE_LLM_URL:-https://api.deepseek.com}"
ANALYZE_LLM_MODEL="${ANALYZE_LLM_MODEL:-deepseek-chat}"
SANDBOX_API_BASE="https://sandbox-api.polar.sh"

require() { # name
  if [ -z "${!1:-}" ]; then echo "✗ missing required env: $1" >&2; MISSING=1; fi
}
MISSING=0
for v in FIREBASE_PROJECT_ID POLAR_ACCESS_TOKEN_SANDBOX POLAR_WEBHOOK_SECRET_SANDBOX \
         POLAR_PRODUCT_MONTHLY_SANDBOX POLAR_PRODUCT_YEARLY_SANDBOX POLAR_CREDIT_PACKS_SANDBOX \
         MEMBER_MONTHLY_ALLOWANCE ANALYZE_LLM_KEY; do require "$v"; done
[ "$MISSING" = 1 ] && { echo "Set the missing vars and re-run." >&2; exit 1; }

# Reuse the existing prod exec roles (already scoped to the users table) for the sandbox twins.
role_of() { aws lambda get-function-configuration --function-name "$1" --region "$REGION" --query Role --output text; }
BILLING_ROLE="$(role_of newsPolarBilling)"
ANALYZE_ROLE="$(role_of newsAnalyze)"
echo "Reusing roles:"; echo "  billing → $BILLING_ROLE"; echo "  analyze → $ANALYZE_ROLE"

zip_src() { # src_dir out_zip
  ( cd "$1" && zip -qr "$2" . -x '*/node_modules/*' ) # runtime provides @aws-sdk; lib.js IS included
}

ensure_fn() { # name src_dir role env_file
  local name="$1" src="$2" role="$3" envf="$4" zip
  zip="$(mktemp -t "${name}.XXXX").zip"
  zip_src "$src" "$zip"
  if aws lambda get-function --function-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "↻ updating $name" >&2
    aws lambda update-function-code --function-name "$name" --zip-file "fileb://$zip" --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"
    aws lambda update-function-configuration --function-name "$name" --region "$REGION" \
      --environment "file://$envf" >/dev/null
  else
    echo "✚ creating $name" >&2
    aws lambda create-function --function-name "$name" --region "$REGION" \
      --runtime nodejs20.x --handler index.handler --timeout 30 --memory-size 256 \
      --role "$role" --zip-file "fileb://$zip" --environment "file://$envf" >/dev/null
    aws lambda wait function-active --function-name "$name" --region "$REGION"
    # No Function-URL CORS config on purpose: the Lambda code owns CORS (corsHeaders + the
    # OPTIONS 204 handler). Setting CORS here too makes AWS *and* the code each emit an
    # Access-Control-Allow-Origin on POST responses → duplicate header → browsers reject with
    # "Failed to fetch". Let the code be the single source of CORS truth.
    aws lambda create-function-url-config --function-name "$name" --region "$REGION" \
      --auth-type NONE >/dev/null
    aws lambda add-permission --function-name "$name" --region "$REGION" \
      --action lambda:InvokeFunctionUrl --principal '*' \
      --function-url-auth-type NONE --statement-id fnurl >/dev/null
  fi
  rm -f "$zip"
  aws lambda get-function-url-config --function-name "$name" --region "$REGION" --query FunctionUrl --output text
}

# Env files (temp; contain secrets → never committed, removed on exit).
BILL_ENV="$(mktemp)"; ANALYZE_ENV="$(mktemp)"
trap 'rm -f "$BILL_ENV" "$ANALYZE_ENV"' EXIT

cat > "$BILL_ENV" <<JSON
{"Variables":{
  "USERS_DDB_TABLE":"$USERS_TABLE",
  "FIREBASE_PROJECT_ID":"$FIREBASE_PROJECT_ID",
  "POLAR_API_BASE":"$SANDBOX_API_BASE",
  "POLAR_ACCESS_TOKEN":"$POLAR_ACCESS_TOKEN_SANDBOX",
  "POLAR_WEBHOOK_SECRET":"$POLAR_WEBHOOK_SECRET_SANDBOX",
  "POLAR_PRODUCT_MONTHLY":"$POLAR_PRODUCT_MONTHLY_SANDBOX",
  "POLAR_PRODUCT_YEARLY":"$POLAR_PRODUCT_YEARLY_SANDBOX",
  "POLAR_CREDIT_PACKS":$(printf '%s' "$POLAR_CREDIT_PACKS_SANDBOX" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8")))'),
  "SITE_URL":"http://localhost:5173"
}}
JSON

cat > "$ANALYZE_ENV" <<JSON
{"Variables":{
  "USERS_DDB_TABLE":"$USERS_TABLE",
  "FIREBASE_PROJECT_ID":"$FIREBASE_PROJECT_ID",
  "MEMBER_MONTHLY_ALLOWANCE":"$MEMBER_MONTHLY_ALLOWANCE",
  "XAI_API_KEY":"$ANALYZE_LLM_KEY",
  "GROK_API_URL":"$ANALYZE_LLM_URL",
  "GROK_MODEL":"$ANALYZE_LLM_MODEL"
}}
JSON

echo; echo "Deploying sandbox twins…"
BILLING_URL="$(ensure_fn newsPolarBilling-sandbox "$FN_DIR/newsPolarBilling/src" "$BILLING_ROLE" "$BILL_ENV")"
ANALYZE_URL="$(ensure_fn newsAnalyze-sandbox "$FN_DIR/newsAnalyze/src" "$ANALYZE_ROLE" "$ANALYZE_ENV")"

echo; echo "✓ Done."
echo "  newsPolarBilling-sandbox → $BILLING_URL"
echo "  newsAnalyze-sandbox      → $ANALYZE_URL"
echo
echo "Next:"
echo "  1. Point the Polar SANDBOX webhook endpoint at: $BILLING_URL"
echo "     (Raw format; events: subscription.created/updated/active/canceled/revoked, order.paid)"
echo "  2. To exercise the UI against sandbox, set in docs/config.js (or a local override):"
echo "       window.POLAR_BILLING_ENDPOINT = '$BILLING_URL';"
echo "       window.NEWS_ANALYZE_ENDPOINT  = '$ANALYZE_URL';"
echo "       window.POLAR_CREDIT_PACKS     = [ {key:'small', credits:50, price:'\$5'}, ... ]; // keys must match POLAR_CREDIT_PACKS_SANDBOX"
echo "  3. Buy with a Polar test card → confirm tier flips / creditBalance increments."
echo
echo "NOTE: this reuses the prod IAM roles + (by default) the prod users table. Test with a"
echo "      throwaway Firebase account; delete its uid row afterwards. For a fully separate"
echo "      table, set USERS_DDB_TABLE and add dynamodb Get/UpdateItem on that table ARN to"
echo "      both reused roles first, else writes will be AccessDenied."
