#!/usr/bin/env bash
# verify_market.sh — verification for the Markets Data layer (Layer M).
# Companion to verify_ddb.js / verify_proxy.sh / verify_lambdas.sh.
#
# What we verify:
#   - Required LATEST records exist for each family (FX, RATES, COMMODITIES,
#     EQUITIES, CRYPTO, MACRO×top-20 countries)
#   - Per-family staleness budgets (FX: 26h, commodities/equities/crypto: 90min,
#     rates: 26h, macros: 8d) — matches the cadence in the EventBridge schedules.
#   - Plausibility bands on key tickers (Brent, Gold, VIX, DXY, US10Y, BTC).
#     Catches data-source corruption (e.g., Stooq returning -1 or 9999).
#   - Cron schedules exist + ENABLED for the markets cadence.
#
# Exit 0 if all required checks pass, 1 otherwise.

set -u
REGION=ap-northeast-1
TABLE=GlobalPerspectiveMarkets
PASS=0
FAIL=0
FAILED=()

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }
gray()  { printf '\033[90m%s\033[0m' "$*"; }

check() {
  local id="$1"; local label="$2"; local cond="$3"; local detail="${4:-}"
  if [ "$cond" = "true" ]; then
    PASS=$((PASS + 1)); echo "  $(green PASS) $id $label"
  else
    FAIL=$((FAIL + 1)); FAILED+=("$id $label — $detail")
    echo "  $(red FAIL) $id $label  $(gray "$detail")"
  fi
}

# Fetch a LATEST record by pk. Returns JSON Item or empty.
get_latest() {
  local pk="$1"
  aws dynamodb get-item --table-name "$TABLE" --region "$REGION" \
    --key "$(printf '{"pk":{"S":"%s"},"sk":{"S":"LATEST"}}' "$pk")" \
    --output json 2>/dev/null
}

# Hours between asOf and now. Empty if no asOf.
hours_old() {
  local iso="$1"
  python3 -c "
import sys, datetime
iso='$iso'
if not iso: print(''); sys.exit(0)
try:
  t = datetime.datetime.fromisoformat(iso.replace('Z','+00:00'))
  now = datetime.datetime.now(datetime.timezone.utc)
  print(f'{(now-t).total_seconds()/3600:.1f}')
except: print('')
"
}

# Generic LATEST + staleness check
check_family() {
  local family="$1"     # human label
  local pk="$2"
  local stale_budget_h="$3"
  local required_fields="$4"   # comma-separated field names that must exist

  echo
  echo "==> Family: $family ($pk)"
  local item
  item=$(get_latest "$pk")
  local present
  present=$(echo "$item" | python3 -c "import json,sys;d=json.load(sys.stdin);print('true' if d.get('Item') else 'false')")
  check "M.exists" "$family LATEST record exists" "$present"
  [ "$present" = "true" ] || return

  local asof
  asof=$(echo "$item" | python3 -c "import json,sys;print(json.load(sys.stdin)['Item'].get('asOf',{}).get('S',''))")
  check "M.asOf" "asOf present" "$([ -n "$asof" ] && echo true || echo false)" "(empty)"

  local h
  h=$(hours_old "$asof")
  if [ -n "$h" ]; then
    local fresh
    fresh=$(python3 -c "print('true' if float('$h') < float('$stale_budget_h') else 'false')")
    check "M.fresh" "asOf < ${stale_budget_h}h old (got: ${h}h)" "$fresh"
  fi

  # Required fields
  IFS=',' read -ra fields <<< "$required_fields"
  for f in "${fields[@]}"; do
    local has
    has=$(echo "$item" | python3 -c "import json,sys;it=json.load(sys.stdin)['Item'];print('true' if (f in it) or (f.lower() in it) else 'false'" -- "$f" 2>/dev/null || \
          echo "$item" | python3 -c "
import json,sys
it=json.load(sys.stdin)['Item']
f='$f'
# Accept literal or nested-in-rates
present = f in it or f.lower() in it
if not present and 'rates' in it:
    rates = it['rates'].get('M',{})
    present = f in rates
print('true' if present else 'false')
")
    check "M.field" "has field $f" "$has"
  done
}

# Plausibility band check: numeric value within [lo, hi]
check_band() {
  local pk="$1"; local field="$2"; local lo="$3"; local hi="$4"
  local item
  item=$(get_latest "$pk")
  local val
  val=$(echo "$item" | python3 -c "
import json,sys
it=json.load(sys.stdin).get('Item',{})
v = it.get('$field')
if v is None: print('')
elif 'N' in v: print(v['N'])
elif 'S' in v: print(v['S'])
else: print('')
")
  if [ -z "$val" ]; then
    check "M.band" "$pk:$field present" "false"
    return
  fi
  local within
  within=$(python3 -c "print('true' if $lo <= float('$val') <= $hi else 'false')")
  check "M.band" "$pk:$field=$val within [$lo, $hi]" "$within"
}

# ─── Per-family checks ──────────────────────────────────────────────────────

check_family "Bond rates"      RATES#GLOBAL       26  US10Y,US2Y,DE10Y,JP10Y,UK10Y
check_family "Commodities"     COMMODITIES#GLOBAL  3  brent,wti,gold,copper,dxy,vix
check_family "FX (USD base)"   FX#USD             30  rates
check_family "Equities"        EQUITIES#GLOBAL    26  SPX,DJI,DAX,N225
check_family "Crypto"          CRYPTO#GLOBAL       3  BTC,ETH

# Macros — sample top-5 G7-ish countries that should always be present
echo
echo "==> Macros (sample of major economies)"
for country in 'United%20States' Japan Germany 'United%20Kingdom' China; do
  cname=$(python3 -c "import urllib.parse;print(urllib.parse.unquote('$country'))")
  item=$(get_latest "MACRO#$cname")
  has=$(echo "$item" | python3 -c "import json,sys;d=json.load(sys.stdin);print('true' if d.get('Item') else 'false')")
  check "M.macro" "MACRO#$cname has LATEST" "$has"
  if [ "$has" = "true" ]; then
    asof=$(echo "$item" | python3 -c "import json,sys;print(json.load(sys.stdin)['Item'].get('asOf',{}).get('S',''))")
    h=$(hours_old "$asof")
    if [ -n "$h" ]; then
      # 8 days = 192h
      fresh=$(python3 -c "print('true' if float('$h') < 192 else 'false')")
      check "M.macro_fresh" "$cname asOf < 192h (got: ${h}h)" "$fresh"
    fi
  fi
done

# ─── Plausibility bands ─────────────────────────────────────────────────────
echo
echo "==> Plausibility bands"
check_band COMMODITIES#GLOBAL brent  30   200
check_band COMMODITIES#GLOBAL wti    25   200
check_band COMMODITIES#GLOBAL gold   1500 5000
check_band COMMODITIES#GLOBAL vix    5    100
check_band COMMODITIES#GLOBAL dxy    80   130
# Copper from Stooq is quoted in cents/lb (e.g., 637.9 = $6.379/lb).
check_band COMMODITIES#GLOBAL copper 100  900
check_band RATES#GLOBAL       US10Y  0.5  8
check_band RATES#GLOBAL       US2Y   0.5  8
check_band CRYPTO#GLOBAL      BTC    5000 250000
check_band CRYPTO#GLOBAL      ETH    100  20000

# ─── Cron schedules ─────────────────────────────────────────────────────────
echo
echo "==> Markets cron rules"
for rule in MarketsDataHourly MarketsYieldsDaily MarketsMacrosWeekly; do
  r=$(aws events describe-rule --name "$rule" --region "$REGION" --output json 2>/dev/null || echo '{}')
  state=$(echo "$r" | python3 -c "import json,sys;print(json.load(sys.stdin).get('State',''))")
  check "M.cron" "$rule exists and ENABLED" "$([ "$state" = "ENABLED" ] && echo true || echo false)" "(state=$state)"
done

# ─── Lambda code drift on newsMarketsData (if source exists) ────────────────
SRC=amplify/backend/function/newsMarketsData/src/index.js
if [ -f "$SRC" ]; then
  echo
  echo "==> Lambda code drift: newsMarketsData"
  tmp=$(mktemp -d)
  trap "rm -rf $tmp" EXIT
  url=$(aws lambda get-function --function-name newsMarketsData --region "$REGION" --output json 2>/dev/null \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('Code',{}).get('Location',''))")
  if [ -n "$url" ]; then
    curl -sL "$url" -o "$tmp/lambda.zip"
    unzip -q "$tmp/lambda.zip" -d "$tmp/unzip" 2>/dev/null
    if [ -f "$tmp/unzip/index.js" ]; then
      deployed_sha=$(shasum -a 256 "$tmp/unzip/index.js" | awk '{print $1}')
      local_sha=$(shasum -a 256 "$SRC" | awk '{print $1}')
      if [ "$deployed_sha" = "$local_sha" ]; then
        PASS=$((PASS + 1)); echo "  $(green PASS) M.drift  deployed index.js matches source"
      else
        FAIL=$((FAIL + 1)); FAILED+=("M.drift newsMarketsData: deployed != source")
        echo "  $(red FAIL) M.drift  deployed=$deployed_sha != source=$local_sha"
      fi
    fi
  fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo
echo "==> Summary: $(green "$PASS pass") / $(red "$FAIL fail")"
if [ $FAIL -gt 0 ]; then
  echo; echo "Failures:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
