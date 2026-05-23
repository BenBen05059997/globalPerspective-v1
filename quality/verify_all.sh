#!/usr/bin/env bash
# verify_all.sh — orchestrator for the full Economic Disruption verification stack.
# See ECONOMIC_VERIFICATION_PLAN.md §12.
#
# Runs every layer in order, captures pass/fail, exits 0 only if all REQUIRED
# checks pass. Run this before every deploy that touches the economic layer.
#
# Usage:
#   bash quality/verify_all.sh           # full run
#   bash quality/verify_all.sh --fast    # skip the live REST + DDB scans (unit + grep only)

set -u
cd "$(dirname "$0")/.."

FAST=0
WITH_E2E=0
for arg in "$@"; do
  [ "$arg" = "--fast" ] && FAST=1
  [ "$arg" = "--with-e2e" ] && WITH_E2E=1
done

PASS=0
FAIL=0
FAILED_LAYERS=()

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }
bold()  { printf '\033[1m%s\033[0m'  "$*"; }

run_layer() {
  local label="$1"; shift
  echo
  echo "$(bold "==> $label")"
  if "$@"; then
    PASS=$((PASS + 1)); echo "$(green '✓ PASS:') $label"
  else
    FAIL=$((FAIL + 1)); FAILED_LAYERS+=("$label"); echo "$(red '✗ FAIL:') $label"
  fi
}

# ─── L2 — Producer unit tests ───
run_layer "L2  Producer validator unit tests" \
  node amplify/backend/function/newsEconomicImpact/test/validator.test.js

# ─── L3 — Judge unit tests ───
run_layer "L3  Judge unit tests" \
  node amplify/backend/function/newsEconomicQuality/test/judge.test.js

# ─── L5/L6 — Frontend vitest (hooks + atoms) ───
run_layer "L5/L6  Frontend vitest (hooks + atoms)" \
  bash -c "cd global-perspectives-starter/frontend && npx vitest run src/test/useEconomicImpact.test.js src/test/atoms_economic.test.jsx"

# ─── L7 — Per-page grep guards ───
run_layer "L7  Per-page grep guards" \
  bash quality/verify_pages.sh

if [ "$FAST" -eq 1 ]; then
  echo
  echo "$(bold "Fast mode — skipping live AWS checks (L1, L4)")"
else
  # ─── L1 — DDB integrity ───
  run_layer "L1  DDB integrity (verify_ddb.js)" \
    node quality/verify_ddb.js --window=21d --strict

  # ─── L4 — REST proxy contract ───
  run_layer "L4  REST proxy contract (verify_proxy.sh)" \
    bash quality/verify_proxy.sh

  # ─── L2.5 — Lambda + cron health ───
  run_layer "L2.5 Lambda + cron health (verify_lambdas.sh)" \
    bash quality/verify_lambdas.sh
fi

# ─── L8 — Browser E2E (opt-in; needs `npm run e2e:install` once per clone) ───
if [ "$WITH_E2E" -eq 1 ]; then
  run_layer "L8  Playwright E2E click-through" \
    bash -c "cd global-perspectives-starter/frontend && npx playwright test"
fi

# ─── Summary ───
echo
echo "$(bold '═══════════════════════════════════════')"
echo "Layers passed: $(green "$PASS")  ·  failed: $(red "$FAIL")"
if [ $FAIL -gt 0 ]; then
  echo
  echo "Failed layers:"
  for f in "${FAILED_LAYERS[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "$(green 'All layers green.')"
exit 0
