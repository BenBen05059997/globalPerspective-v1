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
  if [ ! -f "$file" ]; then
    FAIL=$((FAIL + 1)); FAILED+=("$file: target file does not exist"); echo "  $(red FAIL) $file: target file does not exist"
    return
  fi
  if ! grep -qE "$pat" "$file" 2>/dev/null; then
    PASS=$((PASS + 1)); echo "  $(green PASS) $file: $label (not present)"
  else
    FAIL=$((FAIL + 1)); FAILED+=("$file: forbidden $label found"); echo "  $(red FAIL) $file: should not contain $(gray "$pat")"
  fi
}

echo "==> Per-page grep guards"
echo

# ─── App-level ───
# Stage-0 item (g) (STAGE0_FIXES_PLAN.md) converted App.jsx's page imports to React.lazy(); match
# both the old static form and the new `const EconomyPage = lazy(() => import(...))` form.
must_have "$SRC/app/App.jsx" "import EconomyPage|EconomyPage = lazy" "imports EconomyPage"
must_have "$SRC/app/App.jsx" "/economy" "wires /economy route"
must_not_have "$SRC/app/layout/Layout.jsx" "to=.{1,3}/economy" "economy soft-hidden from nav (2026-09-25; route stays live)"

# ─── N1 site shell (2026-09-26): five plain, flat menu items ───
must_have "$SRC/app/layout/Layout.jsx" "label: 'Map'" "menu has Map"
must_have "$SRC/app/layout/Layout.jsx" "label: 'Stories'" "menu has Stories"
must_have "$SRC/app/layout/Layout.jsx" "label: 'Briefings'" "menu has Briefings"
must_have "$SRC/app/layout/Layout.jsx" "label: 'Studio'" "menu has Studio"
must_have "$SRC/app/layout/Layout.jsx" "label: 'Track record'" "menu has Track record"
must_not_have "$SRC/app/layout/Layout.jsx" "to=.{1,3}/whitepaper" "white paper soft-hidden from nav (A1, 2026-09-26; route stays live)"

# ─── S6 home swap (2026-10-01): `/` is the map console, the old home lives at /today ───
must_have "$SRC/app/App.jsx" 'path="/" element=\{<SituationHome' "/ renders the map console"
must_have "$SRC/app/App.jsx" 'path="/today" element=\{<Home' "old home kept reachable at /today"
must_have "$SRC/app/App.jsx" 'path="/map" element=\{<MapRedirect' "/map redirects to /"
must_have "$SRC/app/MapRedirect.jsx" "search, hash" "the /map redirect keeps the query params"
must_have "$SRC/app/layout/Layout.jsx" "to: '/', exact: true, label: 'Map'" "menu Map item points at / (exact)"
must_have "$SRC/app/layout/Layout.jsx" "location.pathname === '/' && !isPhone" "desktop console shell keyed on /"
must_have "$SRC/app/layout/Layout.jsx" "to=\"/today\"" "footer links the old home (/today)"
must_have "$SRC/app/onboarding/useOnboarding.js" "pathname === '/'" "no auto-tour on the map home"
must_not_have "$SRC/app/layout/Layout.jsx" "pathname (===|!==) '/map'" "no stale /map pathname checks"

# ─── BriefingsPage (S3, /briefings) ───
must_have "$SRC/app/App.jsx" "import BriefingsPage|BriefingsPage = lazy" "imports BriefingsPage"
must_have "$SRC/app/App.jsx" "/briefings" "wires /briefings route"
must_have "$SRC/app/layout/Layout.jsx" "to: '/briefings'" "menu Briefings item points at /briefings"
must_have "$SRC/features/briefings/BriefingsPage.jsx" "useDailyBrief" "uses useDailyBrief"
must_have "$SRC/features/briefings/BriefingsPage.jsx" "useWeeklyBrief" "uses useWeeklyBrief"
must_have "$SRC/features/briefings/BriefingsPage.jsx" "useDailyEditionsIndex" "wires the editions strip index"
must_have "$SRC/features/economy/WeeklyMarketsPage.jsx" "/briefings" "weekly-markets retires to /briefings"

# ─── EconomyPage ───
must_have "$SRC/features/economy/EconomyPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/features/economy/EconomyPage.jsx" "useTopMovers" "uses useTopMovers"
must_have "$SRC/features/economy/EconomyPage.jsx" "useMarketsGlobal" "renders Market Context rail"
must_have "$SRC/features/economy/EconomyPage.jsx" "tab.{1,4}economy" "deep-links stories to thread economy tab"

# ─── Home ───
must_have "$SRC/features/home/Home.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/features/home/Home.jsx" "disruptionByThread" "builds per-thread map"
must_have "$SRC/features/home/Home.jsx" "tab.{1,4}economy" "deep-links to economy tab"
must_have "$SRC/features/home/Home.jsx" "SeverityBadge" "renders SeverityBadge"

# ─── DailyPage ───
must_have "$SRC/features/daily/DailyPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/features/daily/DailyPage.jsx" "tab.{1,4}economy" "deep-links to economy tab"
must_have "$SRC/features/daily/DailyPage.jsx" "SeverityBadge" "renders SeverityBadge"

# ─── ThreadPage ───
must_have "$SRC/features/threads/ThreadPage.jsx" "useEconomicImpact" "uses useEconomicImpact"
must_have "$SRC/features/threads/ThreadPage.jsx" "MechanismCard" "renders MechanismCard"
# DisruptionPreview removed 2026-06-29 — economy now lives in the center Economy
# tab (MechanismCard) after the rail was de-duplicated; preview atom no longer used here.
must_have "$SRC/features/threads/ThreadPage.jsx" "hasEconomy" "computes hasEconomy gate"

# ─── CountryPage ───
must_have "$SRC/features/countries/CountryPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/features/countries/CountryPage.jsx" "country:" "passes country filter"
must_have "$SRC/features/countries/CountryPage.jsx" "tab.{1,4}economy" "deep-links to economy tab"

# ─── CountryListPage ───
must_have "$SRC/features/countries/CountryListPage.jsx" "useDisruptionsList" "uses useDisruptionsList"
must_have "$SRC/features/countries/CountryListPage.jsx" "maxSeverityByCountry" "builds per-country max"
must_have "$SRC/features/countries/CountryListPage.jsx" "Disruption" "exposes Disruption sort"

# ─── WorldMapV2: REMOVED 2026-09-24 (legacy map deleted; /map = SituationHome) ───
# Its four guards are gone with it. Disruption data keeps its surfaces on Home,
# CountryPage, CountryListPage, EconomyPage, DailyPage — guarded above/below.

# ─── Disclosures ───
must_have "$SRC/features/static/Disclosures.jsx" "Economic Disruption" "has Economic Disruption section"
must_have "$SRC/features/static/Disclosures.jsx" "[Aa]uto" "mentions automated quality judge"

# ─── QualityFlag propagation contract (ECONOMIC_DISRUPTION.md §"Quality flag propagation") ───
# Phase B's verdict flag must surface in all 3 atoms that render economic content.
# One backend deploy → flag visible everywhere, only because each atom imports
# QualityFlag itself. Remove any of these imports → flag goes dark on that surface.
must_have "$SRC/features/economy/components/MechanismCard.jsx"     "import QualityFlag" "QualityFlag wired into MechanismCard"
must_have "$SRC/features/economy/components/DisruptionRow.jsx"     "import QualityFlag" "QualityFlag wired into DisruptionRow"
must_have "$SRC/features/economy/components/DisruptionPreview.jsx" "import QualityFlag" "QualityFlag wired into DisruptionPreview"
must_have "$SRC/features/economy/components/MechanismCard.jsx"     "<QualityFlag" "QualityFlag rendered in MechanismCard"
must_have "$SRC/features/economy/components/DisruptionRow.jsx"     "<QualityFlag" "QualityFlag rendered in DisruptionRow"
must_have "$SRC/features/economy/components/DisruptionPreview.jsx" "<QualityFlag" "QualityFlag rendered in DisruptionPreview"

# ─── §9.11 negative guards — pages that intentionally do NOT carry economic UI ───
must_not_have "$SRC/features/threads/WeeklyPage.jsx" "useDisruptionsList|useEconomicImpact|useTopMovers|MechanismCard|DisruptionRow|DisruptionPreview" "no economic hooks/atoms"

# ─── S6: track record E2 (service record) + E1 text version ───
# The July pilot (122 triggers, all confirmed 2026-07-24) is archived and must never be blended
# into the headline accuracy figure or shown as "awaiting" once a deadline has passed.
must_have "$SRC/app/App.jsx" "TrackRecordText" "wires the E1 text version"
must_have "$SRC/app/App.jsx" "/track-record/text" "wires the /track-record/text route"
must_have "$SRC/features/track-record/TrackRecordPage.jsx" "buildTrackRecordView" "headline numbers come from the questions view-model (pilot archived)"
must_have "$SRC/features/track-record/lib/trackRecordView.js" "splitPilot" "excludes the July pilot from headline numbers"
must_have "$SRC/features/track-record/lib/trackRecordView.js" "isAccuracyLocked|accuracyProgress" "locks accuracy until 150 resolved"
must_have "$SRC/features/track-record/components/ForecastBoard.jsx" "forecastPlaceCounts" "forecast board plots real places, not per-country accuracy"
must_not_have "$SRC/features/track-record/TrackRecordPage.jsx" "[Aa]waiting their deadline" "never claims a passed deadline is still awaiting"
must_have "$SRC/features/threads/hooks/useStoryLinks.js" "useWebIndex" "story links read the story-web index (one shared call)"
must_have "$SRC/features/threads/lib/linkStates.js" "No linked stories found yet for this story" "an empty story web says why, honestly"
must_have "$SRC/features/map/lib/storyLinkArcs.js" "strong.*medium|DRAWN" "map lines are strong + medium only"
must_have "$SRC/features/analysis-studio/components/ShareControl.jsx" "shareableSections" "the share button exists only for runs that passed their checks"
must_have "$SRC/features/analysis-studio/components/ShareControl.jsx" "shareConfigured" "sharing is hidden while the share endpoint is unset"
must_have "$SRC/features/analysis-studio/SharedAnalysisPage.jsx" "useNoIndex" "the shared page is noindex"
must_have "$SRC/features/analysis-studio/components/SignedOutExample.jsx" "not ready yet" "the signed-out example says so until a real share exists"
must_have "$SRC/features/track-record/components/SettlingLog.jsx" "buildWeeklySquares" "settling log computed from the server's real weekly records"

# ─── Boot loader (2026-10-01): shared BootLoader, honest ticks, pre-JS boot, token-only colours ───
BOOT="$SRC/shared/ui/boot"
must_have "$SRC/app/App.jsx" "Suspense fallback=\{<RouteFallback />\}" "Suspense fallback is the shared boot loader"
must_not_have "$SRC/app/App.jsx" "Loading…|Loading\.\.\." "no bare 'Loading…' Suspense fallback"
must_have "$SRC/app/App.jsx" "removeStaticBoot" "App hands off from the pre-JS boot on the first commit"
must_not_have "$SRC/features/map/SituationHome.jsx" "Loading map…" "the globe chunk fallback is the boot loader, not bare text"
must_have "$SRC/features/map/SituationHome.jsx" "deriveBootSensors" "map home sensors come from the real load signals"
must_have "$BOOT/BootLoader.jsx" "s\.state" "sensor state is read from props"
must_not_have "$BOOT/BootLoader.jsx" "setInterval|requestAnimationFrame" "no timer-driven ticks in the BootLoader"
must_not_have "$BOOT/BootLoader.jsx" "useState\(\(?\)? ?=?>? ?['\"](ok|fail|wait)['\"]" "BootLoader never owns a sensor state"
must_have "$BOOT/BootLoader.jsx" "removeStaticBoot" "BootLoader removes the pre-JS boot node on mount"
must_have "$BOOT/BootLoader.css" "prefers-reduced-motion: reduce" "reduced-motion rule present"
must_have "$BOOT/BootLoader.css" "animation: none" "reduced motion stops the sweep and blink"
must_not_have "$BOOT/BootLoader.css" "prefers-color-scheme" "no new dark/light mode handling"
must_have "global-perspectives-starter/frontend/index.html" "id=\"gp-boot\"" "index.html builds the pre-JS boot node"
must_have "global-perspectives-starter/frontend/index.html" "gp-boot-css" "index.html carries the inline boot CSS"
must_have "global-perspectives-starter/frontend/index.html" "gpBootFail" "index.html has an honest failure path if the app script cannot load"
if node quality/boot_tokens_guard.mjs . >/tmp/boot_tokens_guard.out 2>&1; then
  PASS=$((PASS + 1)); echo "  $(green PASS) boot colours match tokens.css ($(cat /tmp/boot_tokens_guard.out))"
else
  FAIL=$((FAIL + 1)); FAILED+=("boot colours drifted from tokens.css"); echo "  $(red FAIL) boot tokens: $(cat /tmp/boot_tokens_guard.out)"
fi

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
