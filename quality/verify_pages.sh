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

# ─── Globe badges / alert diamonds / selection brackets: pixel-space icons (2026-10-01) ───
GLOBE3D="$SRC/features/map/components/SituationMap3D.jsx"
must_not_have "$GLOBE3D" "degPerPx|pxPolygon|bracketPaths|lonScale" "no lon/lat polygon geometry for badges / diamonds / brackets (grew, skewed, detached when zoomed)"
must_not_have "$GLOBE3D" "SolidPolygonLayer" "badges and diamonds are not SolidPolygonLayer patches of the sphere"
must_have "$GLOBE3D" "IconLayer" "badges, diamonds and brackets are IconLayer billboards"
must_have "$GLOBE3D" "sizeUnits: 'pixels'" "icon layers are sized in screen pixels"
must_have "$GLOBE3D" "cullMode: 'none'" "IconLayer sprites are not back-face culled on GlobeView (y-flip reverses winding)"
must_have "$GLOBE3D" "getPixelOffset: \(m\) => badgeOffset" "badge sits at a fixed pixel offset from its mark"
must_have "$GLOBE3D" "extensions: GLOBE_HORIZON" "sprites hide with their anchor on the far side (no limb leak)"
must_have "$SRC/features/map/lib/globeHorizon.js" "project\.cameraPosition" "horizon rule is a shader test on the camera, not a per-frame rebuild"
must_not_have "$SRC/features/map/lib/globeIcons.js" "degPerPx|2 \*\* |Math\.pow\(2" "sprite sizes are fixed pixels, never scaled by the zoom"

# ─── One token set (2026-10-01): hard-coded colour literals may only go DOWN ───
# quality/color_literals_baseline.json holds today's per-file count; a rise (or a new file with
# literals) fails. Use the role tokens in shared/styles/tokens.css instead of a hex/rgb literal.
must_have "$SRC/shared/styles/tokens.css" "^ +--bg: +#070d15" "tokens.css carries the one palette (role tokens)"
must_not_have "$SRC/app/layout/Layout.css" "gp-nav-console" "the console bar is the one nav on every page"
if node quality/check_color_literals.mjs >/tmp/color_literals_guard.out 2>&1; then
  PASS=$((PASS + 1)); echo "  $(green PASS) $(head -1 /tmp/color_literals_guard.out)"
else
  FAIL=$((FAIL + 1)); FAILED+=("colour literals rose above the baseline"); echo "  $(red FAIL) colour literals: $(cat /tmp/color_literals_guard.out)"
fi

# ─── P2 (2026-10-01): shared building blocks + one loader ───
BLOCKS="$SRC/shared/ui"
must_have "$BLOCKS/StoryRow.jsx" "StoryPeek" "StoryRow carries the StoryPeek hook"
must_have "$BLOCKS/StoryRow.jsx" "createElement" "StoryRow renders one wrapper + one control"
must_not_have "$BLOCKS/TierChip.css" "background" "TierChip has no fill colours per tier (ring weight + word only)"
must_not_have "$BLOCKS/TierChip.css" "#[0-9a-fA-F]{3,8}|rgba?\\(" "TierChip.css uses tokens, no colour literals"
must_not_have "$BLOCKS/blocks.css" "#[0-9a-fA-F]{3,8}|rgba?\\(" "shared blocks CSS uses tokens, no colour literals"
must_have "$SRC/features/map/lib/legend.js" "from '@/shared/lib/statusGlyph.js'" "map legend re-exports the glyph vocabulary from shared"
must_have "$SRC/features/map/components/HudIntelFeed.jsx" "StoryRow" "map intel feed rows are the shared StoryRow"
must_have "$SRC/app/layout/Layout.jsx" "LoadTopBar" "request-activity bar comes from the shared loader module"
if [ ! -e "$SRC/shared/ui/IntelligenceLoader.jsx" ] && [ ! -e "$SRC/app/layout/LoadingBar.jsx" ]; then
  PASS=$((PASS + 1)); echo "  $(green PASS) IntelligenceLoader / LoadingBar are deleted"
else
  FAIL=$((FAIL + 1)); FAILED+=("IntelligenceLoader or LoadingBar came back"); echo "  $(red FAIL) IntelligenceLoader / LoadingBar exist again"
fi
if ! grep -rlE "from '[^']*(IntelligenceLoader|LoadingBar)'" "$SRC" >/tmp/old_loader_imports.out 2>/dev/null || [ ! -s /tmp/old_loader_imports.out ]; then
  PASS=$((PASS + 1)); echo "  $(green PASS) nothing imports IntelligenceLoader / LoadingBar"
else
  FAIL=$((FAIL + 1)); FAILED+=("old loader imported: $(cat /tmp/old_loader_imports.out)"); echo "  $(red FAIL) old loader imported in: $(cat /tmp/old_loader_imports.out)"
fi
if ! grep -rnE ">[[:space:]]*Loading(\.\.\.|…)[^<]*<|'Loading(\.\.\.|…)'" "$SRC/features" --include='*.jsx' >/tmp/bare_loading.out 2>/dev/null || [ ! -s /tmp/bare_loading.out ]; then
  PASS=$((PASS + 1)); echo "  $(green PASS) no bare \"Loading…\" text fallbacks in features/"
else
  FAIL=$((FAIL + 1)); FAILED+=("bare Loading text in features: $(head -3 /tmp/bare_loading.out)"); echo "  $(red FAIL) bare Loading text: $(head -3 /tmp/bare_loading.out)"
fi

# ─── P3a (2026-10-01): countries list/page, daily, weekly brief, track record on the dark tokens ───
LIGHT_BG="background(-color)?:[^;]*(#f[0-9a-fA-F]{2,7}\\b|#fff\\b|\\bwhite\\b|rgba?\\(\\s*2[0-9]{2})"
for css in features/countries/CountryListPage.css features/countries/CountryPage.css features/countries/CountryCoverage.css \
           features/countries/components/CountryCardV2.css features/countries/components/CountryWhatChanged.css \
           features/daily/DailyPage.css features/weekly-brief/WeeklyBriefPage.css \
           features/track-record/TrackRecordPage.css features/track-record/TrackRecordText.css \
           features/track-record/components/ForecastBoard.css features/track-record/components/SettlingLog.css \
           shared/ui/ShareButtons.css; do
  must_not_have "$SRC/$css" "$LIGHT_BG" "$css has no light background literals"
done
must_not_have "$SRC/shared/ui/atoms.css" "\\.ss-strip \\{[^}]*background: var\\(--(ink|text-head)\\)" "StatusStrip is a dark strip, not an inverted light bar"
must_not_have "$SRC/features/daily/DailyPage.jsx" "authLoading|useAuth" "DailyPage does not gate public data on auth"
must_not_have "$SRC/features/countries/CountryPage.jsx" "authLoading" "CountryPage does not gate public data on auth"
must_not_have "$SRC/features/daily/DailyPage.jsx" "RISK_COLORS|CATEGORY_BADGE_COLORS" "DailyPage has no pastel risk/category fills"
must_not_have "$SRC/features/countries/CountryPage.jsx" "RISK_COLORS|CATEGORY_BADGE_COLORS" "CountryPage has no pastel risk/category fills"
must_not_have "$SRC/features/countries/CountryListPage.jsx" "RiskScoreBadge|CATEGORY_BADGE_COLORS" "country list uses TierChip/CategoryTag, not the old badges"
must_have "$SRC/features/countries/CountryListPage.jsx" "TierChip" "country list risk is a TierChip"
must_have "$SRC/features/weekly-brief/WeeklyBriefPage.jsx" "TierChip" "weekly brief risk is a TierChip"
must_have "$SRC/features/daily/DailyPage.jsx" "SectionHeader" "daily sections use the shared SectionHeader"
must_have "$SRC/features/track-record/TrackRecordPage.jsx" "SectionHeader" "track record sections use the shared SectionHeader"
must_not_have "$SRC/features/threads/WeeklyPage.css" "^\\.(bgt|cp)-|^\\.(share-btn|copy-briefing-btn)" "country/share rules live with their owners, not in WeeklyPage.css"

# ─── P3b (2026-10-01): analyze, today, membership, static pages, breaking, account on the dark tokens ───
for css in features/analysis-studio/AnalysisStudio.css features/analysis-studio/components/StudioDeck.css \
           features/analysis-studio/components/StudioPictures.css features/analysis-studio/components/ProviderModal.css \
           features/analysis-studio/components/AnalysisVisuals.css \
           features/home/Home.css features/home/AIComponents.css features/home/components/TodayArchiveSidebar.css \
           features/home/components/TopicNav.css features/home/components/LedeBand.css \
           features/account/MembershipPage.css features/account/Account.css features/account/SignIn.css \
           features/account/components/SubscribeCard.css features/account/components/Desk.css \
           features/breaking/BreakingPage.css features/breaking/components/BreakingStrip.css \
           features/breaking/components/NotificationBell.css app/onboarding/tour-theme.css; do
  must_not_have "$SRC/$css" "$LIGHT_BG" "$css has no light background literals"
done
must_not_have "$SRC/features/home/Home.jsx" "showError\\(|useError\\(|ErrorContext" "Home.jsx no longer opens the generic error modal"
must_have "$SRC/features/home/Home.jsx" "reportFetchError" "Home reports a failed topics load to the error sink"
must_have "$SRC/features/home/Home.jsx" "today-unavailable" "Home shows an inline honest state when topics fail to load"
for d in Summary Prediction TraceCause; do
  must_have "$SRC/features/home/components/${d}Display.jsx" "AiUnavailable" "${d}Display fails inline (AiUnavailable), not in a modal"
done
if [ ! -e "$SRC/app/errors/ErrorModal.jsx" ] && [ ! -e "$SRC/shared/contexts/ErrorContext.jsx" ]; then
  PASS=$((PASS + 1)); echo "  $(green PASS) the generic ErrorModal / ErrorContext are gone"
else
  FAIL=$((FAIL + 1)); FAILED+=("ErrorModal or ErrorContext came back"); echo "  $(red FAIL) ErrorModal / ErrorContext exist again"
fi
if ! grep -rn "Something went wrong" "$SRC" --include='*.jsx' --include='*.js' --exclude-dir=__tests__ --exclude-dir=test >/tmp/swr.out 2>/dev/null || [ ! -s /tmp/swr.out ]; then
  PASS=$((PASS + 1)); echo "  $(green PASS) no page renders the text \"Something went wrong\""
else
  FAIL=$((FAIL + 1)); FAILED+=("Something went wrong rendered: $(head -3 /tmp/swr.out)"); echo "  $(red FAIL) Something went wrong: $(head -3 /tmp/swr.out)"
fi
for jsx in features/static/Contact.jsx features/static/AboutContact.jsx features/static/WhitepaperPage.jsx features/static/PrivacyTerms.jsx features/static/Disclosures.jsx \
           features/home/components/SummaryDisplay.jsx features/home/components/PredictionDisplay.jsx features/home/components/TraceCauseDisplay.jsx app/App.jsx; do
  must_not_have "$SRC/$jsx" "#[0-9a-fA-F]{3,8}\\b|rgba?\\(" "$jsx has no colour literals (tokens only)"
done
must_have "$SRC/app/index.css" "^a \\{ color: var\\(--accent\\)" "bare links read the accent, not the browser blue"
must_not_have "$SRC/shared/ui/atoms.css" "\\.(sev|rsb)-(high|elevated|moderate|low) *\\{[^}]*background" "SeverityBadge / RiskScoreBadge are outlines, not fills"

# ─── P4 (2026-10-01): Stories /weekly = A (list) + C (timeline) ───
T="$SRC/features/threads"
for f in WeeklyPage.jsx components/StoriesHeader.jsx components/StoriesFeed.jsx components/StoriesTimeline.jsx components/StoriesChanged.jsx components/StoriesFilters.jsx components/StoryLine.jsx; do
  must_not_have "$T/$f" "What are Story Arcs|Read arc|STORY ARC|Story Arc" "$f has no arc explainer / 'Read arc' / STORY ARC label"
done
must_have "$T/components/StoryLine.jsx" "StoryRow" "the Stories list rows are the shared StoryRow"
must_have "$T/components/StoriesFeed.jsx" "StoryLine" "the feed renders StoryLine (StoryRow) rows"
must_have "$T/components/StoriesTimeline.jsx" "timelineLayout" "timeline dots come from timelineLayout (real day keys)"
must_not_have "$T/components/StoriesTimeline.jsx" "Math\\.random" "timeline has no Math.random"
must_not_have "$T/lib/storyGroups.js" "Math\\.random" "storyGroups has no Math.random"
must_not_have "$T/lib/storyGroups.js" "Array\\.from\\(\\{ *length" "storyGroups does not synthesise date ranges"
must_not_have "$T/components/WeeklyMap.css" "#[0-9a-fA-F]{3,8}\\b|rgba?\\(" "WeeklyMap.css has no colour literals (no light backgrounds)"
must_not_have "$T/Stories.css" "#[0-9a-fA-F]{3,8}\\b|rgba?\\(" "Stories.css is tokens only"
must_not_have "$T/WeeklyPage.jsx" "return null" "WeeklyPage never null-gates"

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
