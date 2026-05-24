#!/usr/bin/env bash
# verify_proxy.sh — Layer 4 REST proxy contract checks.
# See ECONOMIC_VERIFICATION_PLAN.md §6.
#
# Usage:
#   bash quality/verify_proxy.sh [--endpoint=https://...]
#
# Exit 0 if all required checks pass, 1 otherwise.

set -u

ENDPOINT="${ENDPOINT:-https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy}"
for arg in "$@"; do
  case $arg in --endpoint=*) ENDPOINT="${arg#*=}";; esac
done

PASS=0
FAIL=0
FAILED_CHECKS=()

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }
gray()  { printf '\033[90m%s\033[0m' "$*"; }

check() {
  local id="$1"; local label="$2"; local cond="$3"; local detail="$4"
  if [ "$cond" = "true" ]; then
    PASS=$((PASS + 1))
    echo "  $(green PASS) $id $label"
  else
    FAIL=$((FAIL + 1))
    FAILED_CHECKS+=("$id $label — $detail")
    echo "  $(red FAIL) $id $label  $(gray "$detail")"
  fi
}

# Retry once on known-transient errors. Returns body to stdout.
# Treats blank body, HTTP 5xx in body, or "Internal Server Error" / "rate limit" /
# "throttl" / "timeout" / "ECONNRESET" markers as transient.
post() {
  local payload="$1"
  local body
  body=$(curl -s --max-time 15 -X POST "$ENDPOINT" -H 'Content-Type: application/json' -d "$payload" 2>/dev/null || echo '')
  if [ -z "$body" ] || echo "$body" | grep -qiE 'internal server error|rate.?limit|throttl|timeout|econnreset|503 |502 |504 '; then
    sleep 2
    body=$(curl -s --max-time 30 -X POST "$ENDPOINT" -H 'Content-Type: application/json' -d "$payload" 2>/dev/null || echo '')
  fi
  echo "$body"
}

echo "==> Endpoint: $ENDPOINT"
echo

# ─── Discover a known-good and a known-tombstone threadId ───
echo "==> Discovering test thread IDs from DDB..."
KNOWN_GOOD=$(aws dynamodb scan --table-name SummarizeAndPredict --region ap-northeast-1 \
  --filter-expression "begins_with(PK, :p) AND SK = :sk AND hasImpact = :hi" \
  --expression-attribute-values '{":p":{"S":"ECON#THREAD#"},":sk":{"S":"ECONOMIC_IMPACT"},":hi":{"BOOL":true}}' \
  --projection-expression "PK" --max-items 1 --output json 2>/dev/null \
  | python3 -c "import json,sys;d=json.load(sys.stdin);items=d['Items'];print(items[0]['PK']['S'].replace('ECON#THREAD#','')) if items else print('')" 2>/dev/null)

KNOWN_TOMB=$(aws dynamodb scan --table-name SummarizeAndPredict --region ap-northeast-1 \
  --filter-expression "begins_with(PK, :p) AND SK = :sk AND hasImpact = :hi" \
  --expression-attribute-values '{":p":{"S":"ECON#THREAD#"},":sk":{"S":"ECONOMIC_IMPACT"},":hi":{"BOOL":false}}' \
  --projection-expression "PK" --max-items 1 --output json 2>/dev/null \
  | python3 -c "import json,sys;d=json.load(sys.stdin);items=d['Items'];print(items[0]['PK']['S'].replace('ECON#THREAD#','')) if items else print('')" 2>/dev/null)

if [ -z "$KNOWN_GOOD" ]; then
  echo "$(red 'No hasImpact=true record found in DDB — aborting')"
  exit 1
fi
echo "  good:     $KNOWN_GOOD"
echo "  tomb:     ${KNOWN_TOMB:-(none — skipping tomb check)}"
echo

# ─── L4.01 — economic_impact happy path ───
RES=$(post "{\"action\":\"economic_impact\",\"payload\":{\"threadId\":\"$KNOWN_GOOD\"}}")
HAS_FIELDS=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and d.get('data') and d['data'].get('hasImpact') is True
  print('true' if ok else 'false')
except: print('false')
")
check "L4.01" "economic_impact returns hasImpact:true for known good" "$HAS_FIELDS" "$(echo $RES | head -c 200)"

# Field-shape check: pull data and verify required keys
REQ_FIELDS_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)['data']
  required = ['scopeId','threadId','hasImpact','severity','severityScore','confidence','horizon','instruments','mechanism','citedTopicIds','generatedAt']
  miss = [k for k in required if k not in d]
  print('true' if not miss else 'false:'+','.join(miss))
except Exception as e: print(f'false:{e}')
")
check "L4.01b" "economic_impact data contract has required fields" "${REQ_FIELDS_OK%%:*}" "${REQ_FIELDS_OK#*:}"

# ─── L4.02 — tombstone path ───
if [ -n "$KNOWN_TOMB" ]; then
  RES=$(post "{\"action\":\"economic_impact\",\"payload\":{\"threadId\":\"$KNOWN_TOMB\"}}")
  TOMB_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and d.get('data') and d['data'].get('hasImpact') is False
  print('true' if ok else 'false')
except: print('false')
")
  check "L4.02" "economic_impact returns hasImpact:false for known tombstone" "$TOMB_OK" "$(echo $RES | head -c 200)"
fi

# ─── L4.03 — bogus threadId graceful ───
RES=$(post "{\"action\":\"economic_impact\",\"payload\":{\"threadId\":\"bogus-thread-never-existed-deadbeef\"}}")
NON_500=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  # Accept either success:false or success:true with data=null
  ok = ('success' in d) and (d.get('success') is False or d.get('data') in (None, {}))
  print('true' if ok else 'false')
except: print('false')
")
check "L4.03" "bogus threadId returns graceful response (no 500)" "$NON_500" "$(echo $RES | head -c 200)"

# ─── L4.04 — economic_impact_list happy path ───
RES=$(post '{"action":"economic_impact_list","payload":{"limit":5}}')
LIST_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and isinstance(d.get('data'), list) and len(d['data']) <= 5
  if ok and d['data']:
    for it in d['data']:
      for k in ['scopeId','severity','severityScore','instruments']:
        if k not in it: ok = False; break
  print('true' if ok else 'false')
except Exception as e: print('false')
")
check "L4.04" "economic_impact_list returns list ≤5 with required item fields" "$LIST_OK" "$(echo $RES | head -c 200)"

# ─── L4.05 — economic_impact_list filtered by country ───
RES=$(post '{"action":"economic_impact_list","payload":{"country":"Iran","limit":10}}')
COUNTRY_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and isinstance(d.get('data'), list)
  print('true' if ok else 'false')
except: print('false')
")
check "L4.05" "economic_impact_list accepts country filter without error" "$COUNTRY_OK" "$(echo $RES | head -c 200)"

# ─── L4.06 — minSeverity filter ───
RES=$(post '{"action":"economic_impact_list","payload":{"minSeverity":"severe","limit":50}}')
SEV_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and isinstance(d.get('data'), list)
  if ok:
    for it in d['data']:
      if it.get('severity') != 'severe': ok = False; break
  print('true' if ok else 'false')
except: print('false')
")
check "L4.06" "minSeverity=severe filter returns only severe records" "$SEV_OK" "$(echo $RES | head -c 200)"

# ─── L4.07 — economic_top_movers ───
RES=$(post '{"action":"economic_top_movers","payload":{"limit":5}}')
MOV_OK=$(echo "$RES" | python3 -c "
import json,sys
try:
  d = json.load(sys.stdin)
  ok = d.get('success') and isinstance(d.get('data'), list)
  if ok and d['data']:
    for it in d['data']:
      if 'instrumentId' not in it or 'citations' not in it: ok = False; break
  print('true' if ok else 'false')
except: print('false')
")
check "L4.07" "economic_top_movers returns list of {instrumentId,citations}" "$MOV_OK" "$(echo $RES | head -c 200)"

# ─── L4.10 — deep §2 contract validation ───
# Pull a real list and validate every record obeys the full §2 contract.
RES=$(post '{"action":"economic_impact_list","payload":{"limit":50}}')
DEEP_OK=$(echo "$RES" | python3 -c "
import json,sys
VALID_SEVERITIES = {'minor','moderate','severe'}
VALID_CONFIDENCES = {'low','medium','high'}
VALID_HORIZONS = {'immediate','days','weeks','months'}
VALID_DIRECTIONS = {'up','down','mixed'}
VALID_MAGNITUDES = {'small','moderate','large'}
VALID_ENT_TYPES = {'country','sector','company'}
BAND = {'minor':(0,40), 'moderate':(41,69), 'severe':(70,100)}
try:
  d = json.load(sys.stdin)
  items = d.get('data',[]) if d.get('success') else []
  errs = []
  for it in items:
    if it.get('hasImpact') is False: continue
    # Required scalars
    for k in ('scopeId','threadId','severity','severityScore','confidence','horizon','instruments','mechanism','citedTopicIds','generatedAt'):
      if k not in it: errs.append(f\"missing {k} on {it.get('scopeId','?')}\")
    # Enum legality
    if it.get('severity') not in VALID_SEVERITIES: errs.append(f\"bad severity={it.get('severity')}\")
    if it.get('confidence') not in VALID_CONFIDENCES: errs.append(f\"bad conf={it.get('confidence')}\")
    if it.get('horizon') not in VALID_HORIZONS: errs.append(f\"bad horizon={it.get('horizon')}\")
    s = it.get('severityScore')
    if not isinstance(s, int) or not (0 <= s <= 100): errs.append(f\"bad severityScore={s}\")
    # Band coherence
    b = BAND.get(it.get('severity'),(0,100))
    if isinstance(s,int) and (s < b[0] or s > b[1]): errs.append(f\"severityScore {s} outside band {b} for {it.get('severity')}\")
    # Per-instrument
    for inst in it.get('instruments',[]):
      if inst.get('direction') not in VALID_DIRECTIONS: errs.append(f\"bad direction={inst.get('direction')}\")
      if inst.get('magnitude') not in VALID_MAGNITUDES: errs.append(f\"bad magnitude={inst.get('magnitude')}\")
      if not inst.get('citedTopicIds'): errs.append(f\"instrument {inst.get('instrumentId')} has no citedTopicIds\")
    # Winners/losers types
    for w in it.get('winners',[]) + it.get('losers',[]):
      if w.get('type') not in VALID_ENT_TYPES: errs.append(f\"bad ent type={w.get('type')}\")
  if errs:
    print('false:' + ';'.join(errs[:6]))
  else:
    print(f'true:{len(items)} records validated')
except Exception as e:
  print(f'false:exception {e}')
")
check "L4.10" "every list item passes full §2 contract" "${DEEP_OK%%:*}" "${DEEP_OK#*:}"

# ─── L4.09 — latency (informational) ───
START=$(python3 -c 'import time; print(int(time.time()*1000))')
post '{"action":"economic_impact_list","payload":{"limit":50}}' > /dev/null
END=$(python3 -c 'import time; print(int(time.time()*1000))')
LAT=$((END - START))
echo
echo "  $(gray "L4.09 latency for list-50 (warm): ${LAT}ms")"

# ─── Summary ───
echo
echo "==> Summary: $(green "$PASS pass") / $(red "$FAIL fail")"
if [ $FAIL -gt 0 ]; then
  echo
  echo "Failed checks:"
  for f in "${FAILED_CHECKS[@]}"; do
    echo "  - $f"
  done
  exit 1
fi
exit 0
