#!/usr/bin/env bash
# verify_pages.sh — Layer 7 per-page grep guards.
# See ECONOMIC_VERIFICATION_PLAN.md §9.
#
# For each page: assert the imports / hooks / wiring that MUST be present
# (positive) or MUST NOT be present (negative). Greps are deliberately strict
# — they catch silent removals and accidental re-additions across the codebase.
#
# Exit 0 if all required positives/negatives match; 1 otherwise.

set -u
SRC="global-perspectives-starter/frontend/src"
PASS=0
FAIL=0
FAILED=()

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }
gray()  { printf '\033[90m%s\033[0m' "$*"; }

must_have() {
  local file="$1"; local pat="$2"; local label="$3"
  if grep -qE "$pat" "$file" 2>/dev/null; then
    PASS=$((PASS + 1)); echo "  $(green PASS) $file: $label"
  else
    FAIL=$((FAIL + 1)); FAILED+=("$file: MISSING $label"); echo "  $(red FAIL) $file: missing $(gray "$pat")"
  fi
}

must_not_have() {
  local file="$1"; local pat="$2"; local label="$3"
  if ! grep -qE "$pat" "$file" 2>/dev/null; then
    PASS=$((PASS + 1)); echo "  $(green PASS) $file: $label (not present)"
  else
    FAIL=$((FAIL + 1)); FAILED+=("$file: forbidden $label found"); echo "  $(red FAIL) $file: should not contain $(gray "$pat")"
  fi
}

echo "==> Per-page grep guards"
echo

# ─── App-level ───
must_have "$SRC/App.jsx" "import EconomyPage" "imports EconomyPage"
must_have "$SRC/App.jsx" "/economy" "wires /economy route"
must_have "$SRC/components/Layout.jsx" "to=.{1,3}/economy" "nav link to /economy"

# ─── EconomyPage ───
must_have "$SRC/components/EconomyPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/EconomyPage.jsx" "useTopMovers" "uses useTopMovers"
must_have "$SRC/components/EconomyPage.jsx" "useMarketsGlobal" "renders Market Context rail"
must_have "$SRC/components/EconomyPage.jsx" "tab.{1,4}economy" "deep-links stories to thread economy tab"

# ─── Home ───
must_have "$SRC/components/Home.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/Home.jsx" "disruptionByThread" "builds per-thread map"
must_have "$SRC/components/Home.jsx" "tab.{1,4}economy" "deep-links to economy tab"
must_have "$SRC/components/Home.jsx" "SeverityBadge" "renders SeverityBadge"

# ─── DailyPage ───
must_have "$SRC/components/DailyPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/DailyPage.jsx" "tab.{1,4}economy" "deep-links to economy tab"
must_have "$SRC/components/DailyPage.jsx" "SeverityBadge" "renders SeverityBadge"

# ─── ThreadPage ───
must_have "$SRC/components/ThreadPage.jsx" "useEconomicImpact" "uses useEconomicImpact"
must_have "$SRC/components/ThreadPage.jsx" "MechanismCard" "renders MechanismCard"
must_have "$SRC/components/ThreadPage.jsx" "DisruptionPreview" "renders DisruptionPreview"
must_have "$SRC/components/ThreadPage.jsx" "hasEconomy" "computes hasEconomy gate"

# ─── CountryPage ───
must_have "$SRC/components/CountryPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/CountryPage.jsx" "country:" "passes country filter"
must_have "$SRC/components/CountryPage.jsx" "tab.{1,4}economy" "deep-links to economy tab"

# ─── CountryListPage ───
must_have "$SRC/components/CountryListPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/CountryListPage.jsx" "maxSeverityByCountry" "builds per-country max"
must_have "$SRC/components/CountryListPage.jsx" "Disruption" "exposes Disruption sort"

# ─── WorldMapV2 ───
must_have "$SRC/components/WorldMapV2.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/components/WorldMapV2.jsx" "selectedCountryDisruptions" "builds selected-country slice"
must_have "$SRC/components/WorldMapV2.jsx" "economy" "exposes economy lens"

# ─── Disclosures ───
must_have "$SRC/components/Disclosures.jsx" "Economic Disruption" "has Economic Disruption section"
must_have "$SRC/components/Disclosures.jsx" "[Aa]uto" "mentions automated quality judge"

# ─── QualityFlag propagation contract (ECONOMIC_DISRUPTION.md §"Quality flag propagation") ───
# Phase B's verdict flag must surface in all 3 atoms that render economic content.
# One backend deploy → flag visible everywhere, only because each atom imports
# QualityFlag itself. Remove any of these imports → flag goes dark on that surface.
must_have "$SRC/components/atoms/MechanismCard.jsx"     "import QualityFlag" "QualityFlag wired into MechanismCard"
must_have "$SRC/components/atoms/DisruptionRow.jsx"     "import QualityFlag" "QualityFlag wired into DisruptionRow"
must_have "$SRC/components/atoms/DisruptionPreview.jsx" "import QualityFlag" "QualityFlag wired into DisruptionPreview"
must_have "$SRC/components/atoms/MechanismCard.jsx"     "<QualityFlag" "QualityFlag rendered in MechanismCard"
must_have "$SRC/components/atoms/DisruptionRow.jsx"     "<QualityFlag" "QualityFlag rendered in DisruptionRow"
must_have "$SRC/components/atoms/DisruptionPreview.jsx" "<QualityFlag" "QualityFlag rendered in DisruptionPreview"

# ─── §9.11 negative guards — pages that intentionally do NOT carry economic UI ───
must_not_have "$SRC/components/WeeklyPage.jsx" "useDisruptionsList|useEconomicImpact|useTopMovers|MechanismCard|DisruptionRow|DisruptionPreview" "no economic hooks/atoms"

# ─── Summary ───
echo
echo "==> Summary: $(green "$PASS pass") / $(red "$FAIL fail")"
if [ $FAIL -gt 0 ]; then
  echo
  echo "Failures:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
