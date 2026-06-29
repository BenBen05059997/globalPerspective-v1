#!/usr/bin/env bash
#
# deploy-credits-prod.sh — ship the credit-buying code to the PRODUCTION billing Lambdas.
#
# Updates the *code* of the live newsAnalyze + newsPolarBilling functions to the version in
# this repo (the credit logic). It does NOT change env vars, products, or CORS — those are
# separate, ordered steps in the checklist printed at the end.
#
# ⚠️ BEHAVIOR CHANGE on deploy: prod newsAnalyze currently gates on tier=member + a 50/DAY cap.
#    The new code removes that gate and meters by MEMBER_MONTHLY_ALLOWANCE (default 100/month if
#    the env var is unset) + per-run credits. Set MEMBER_MONTHLY_ALLOWANCE intentionally BEFORE
#    or right after deploy so members don't silently jump to the 100 default.
#
# ⚠️ ORDERING for credit packs (so a paid pack is never mis-granted as membership):
#    1) create LIVE one-time credit-pack products in Polar, 2) set POLAR_CREDIT_PACKS env on
#    prod newsPolarBilling (the {packKey:{productId,credits}} map), 3) THEN run this deploy,
#    4) add window.POLAR_CREDIT_PACKS to docs/config.js, 5) enable selling.
#    (If POLAR_CREDIT_PACKS is unset, packCreditsForOrder()→0 → an order.paid would be treated
#    as a subscription and grant tier=member. Set it before any live pack can be bought.)
#
# Run from anywhere; uses repo-relative paths. Requires AWS creds with lambda:UpdateFunctionCode.
#
set -euo pipefail
REGION="${AWS_REGION:-ap-northeast-1}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # amplify/backend/function

confirm() {
  read -r -p "Deploy credit code to PROD newsAnalyze + newsPolarBilling in $REGION? [y/N] " a
  [ "$a" = "y" ] || [ "$a" = "Y" ] || { echo "aborted."; exit 1; }
}

zip_and_update() { # fnName srcDir
  local fn="$1" src="$2" zip
  [ -f "$src/lib.js" ] || { echo "✗ $src/lib.js missing — the new code requires it; aborting."; exit 1; }
  zip="$(mktemp -t "$fn.XXXX").zip"
  ( cd "$src" && zip -qr "$zip" . -x '*/node_modules/*' )
  echo "↻ updating $fn code…"
  aws lambda update-function-code --function-name "$fn" --region "$REGION" \
    --zip-file "fileb://$zip" >/dev/null
  aws lambda wait function-updated --function-name "$fn" --region "$REGION"
  rm -f "$zip"
  echo "  ✓ $fn updated"
}

confirm
zip_and_update newsAnalyze       "$HERE/newsAnalyze/src"
zip_and_update newsPolarBilling  "$HERE/newsPolarBilling/src"

echo
echo "✓ Code deployed. Post-deploy checklist:"
echo "  1. Set prod env (secrets via a temp file, not inline):"
echo "       newsAnalyze:      MEMBER_MONTHLY_ALLOWANCE=<N>"
echo "       newsPolarBilling: POLAR_CREDIT_PACKS='{\"small\":{\"productId\":\"<LIVE>\",\"credits\":50}, ...}'"
echo "     aws lambda update-function-configuration --function-name <fn> --environment file://env.json"
echo "     (update-function-configuration REPLACES Variables — merge onto the existing map, don't drop vars.)"
echo "  2. docs/config.js → window.POLAR_CREDIT_PACKS = [{key,credits,price}, …] (keys match the env map)."
echo "  3. CORS: confirm a single ACAO header on each (should already be fixed):"
echo "       for fn in newsAnalyze newsPolarBilling; do url=\$(aws lambda get-function-url-config --function-name \$fn --query FunctionUrl --output text); curl -sS -i -X POST \"\$url\" -H 'Origin: https://globalperspective.net' -H 'Content-Type: application/json' -d '{\"action\":\"get_membership\"}' | grep -ci access-control-allow-origin; done   # each → 1"
echo "  4. Smoke: get_membership now returns creditBalance; a non-member run with 0 credits → 402 out_of_credits."
echo "  5. Browser-confirm a live test purchase → balance increments → a run spends a credit."
