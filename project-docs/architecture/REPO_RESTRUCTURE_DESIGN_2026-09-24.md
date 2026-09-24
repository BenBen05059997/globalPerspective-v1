# Repo Restructure Design: feature folders (2026-09-24)

**Status:** EXECUTED 2026-09-24 (P0 through P12, full scope, via
`project-docs/architecture/_active/FRONTEND_RESTRUCTURE_EXECUTION_PLAN.md`; see that plan's §5
ledger and `ARCHITECTURE.md`'s "Frontend layout (final tree)" section for the outcome). This
document's file-mapping table (§2.3) is the historical old→new record; trust `ARCHITECTURE.md`
over it on drift.
**Operator request (verbatim):** "design a clean repo here too by grouping different files into a clean folder and have feature for different part like feature folder right"
**Scope of evidence:** every claim below was checked against the tree at `a6407d3` (2026-09-24): `App.jsx` routes, a generated import graph of all 193 files in `frontend/src/`, `deploy.sh`, `.githooks/*`, `quality/verify_pages.sh`, `scripts/*.mjs`, `quality/analysis|briefing/*.mjs`, and a grep of `project-docs/`, skills, and memory.

> Paths in this doc are relative to `global-perspectives-starter/frontend/src/` unless they start with a repo-root directory.

---

## 1. Current state

### 1.1 Repo root

| Dir / file | What it is | Tracked activity |
|---|---|---|
| `global-perspectives-starter/frontend/` | **The live React app** (Vite). `src/`, `e2e/`, `tests/fixtures/`, `scripts/` (2 Node helpers), `public/` | active |
| `global-perspectives-starter/{agent,backend,global-perspectives-batch,tests}` + `requirements.txt`, `test_gemini.py` | Legacy Python prototype. **No live doc references it.** | last touched 2025-10 / 2026-03 |
| `amplify/backend/function/<name>/src/` | 36 Lambda dirs, deployed by hand with the AWS CLI (plus `_sandbox/`, `deploy-credits-prod.sh`). "amplify" is a historical name. | active |
| `docs/` | GitHub Pages **build output** plus `config.js`. **Cannot move.** | deploy target |
| `project-docs/` | All documentation (INDEX.md, architecture/, per-domain `_active/_shipped/_reference/_proposed`) | active |
| `quality/` | Verify gates (`verify_*.sh`, `verify_ddb.js`), eval harnesses (`analysis/`, `briefing/`, `calibration/`, severity evals), dashboards | active |
| `scripts/` | Ops/bug-fighting tools (`smoke-test`, `link-crawl`, `contract-check`, `auth-guard-check`, `check-shared-sync`, `errors.mjs`, hook installer, AWS setup) | active |
| `breaking/`, `weekly/`, `weekly-markets/`, `predictions/` | **Four root dirs, each holding one operator review CLI** (`review.js`). `predictions/` also has resolve-v1 scripts and a runbook. | active, low churn |
| `agent-kit/` | Autonomy/verify/deploy playbooks and `ralph-loop.sh` | stable |
| `internal-docs/` | Marketing/legal/private notes | stable |
| `cli/` | The published `gp` npm CLI (terminal client for the proxy) | 2026-03 |
| `archive/` | Design mockups and kickstarter leftovers | 2026-09-08 |
| `.githooks/` | `pre-commit` (doc guard) and `pre-push` (economic-layer verifier trigger) | active |
| `deploy.sh`, `CLAUDE.md`, `README.md`, `CHANGES.md` | Load-bearing root files | active |

### 1.2 Frontend `src/`: 193 files, about 41.5k lines

| Dir | Files | Notes |
|---|---:|---|
| `components/` (flat) | 84 (57 `.jsx` + 27 `.css`) | Every page, every page-private sub-component, and app chrome sit side by side |
| `components/atoms/` | 25 (19 `.jsx` + 6 `.css`) | Mixes truly shared atoms (StatusStrip, EditorialShell) with single-consumer, feature-specific widgets (LedeBand is used only by Home, Sparkline only by Economy, AnalysisVisuals only by Studio) |
| `hooks/` | 28 | Page-specific data hooks (`useDailyBrief`) mixed with cross-cutting ones (`useWeeklyArchive`, used by 5 pages) |
| `utils/` | 19 | Generic helpers (`dateUtils`) next to feature logic (`analysisPrompt`, `composeEconomyBriefing`, `situationLabels`) |
| `services/` | 4 | `restProxy` (30+ importers), `llm` (Studio BYOK), `worldData` (map only), `errorSink` |
| `contexts/` | 2 | AuthContext, ErrorContext |
| `test/` | 17 | All tests in one dir, far from the code they test |
| `onboarding/`, `data/`, `assets/`, `styles/` | 3 / 2 / 2 / 1 | |
| root | 6 | `main.jsx`, `App.jsx`, `App.css`, `index.css`, `bootstrapProxy.js`, `tokens.js` |

### 1.3 The concrete pain

1. **A feature is spread across five directories.** Example, the Economy page: `components/EconomyPage.jsx` + `.css`, `components/WeeklyMarketsView.jsx` + `.css`, `components/WeeklyMarketsPage.jsx`, 5 atoms in `components/atoms/`, 7 hooks in `hooks/`, 2 utils, `data/economicAnalogs.*`, and 3 tests in `test/`. Nothing in the tree says these files belong together. You have to rebuild the grouping from imports every time.
2. **"Shared" and "private" look the same.** `atoms/` holds real shared atoms and single-consumer widgets side by side, and `hooks/`/`utils/` do the same. From the tree alone you cannot tell whether an edit hits one page or six.
3. **Dead code hides in flat folders.** After the 2026-09-24 legacy-map removal, the import graph shows 4 orphans nobody noticed (§2.6). In a feature folder, an orphan stands out.
4. **Hidden cross-page style coupling.** `components/WeeklyPage.css` (3,074 lines) is imported by **6** components: WeeklyPage, WeeklyMap, CountryPage, CountryListPage, SignIn, and AuthCallback. `AIComponents.css` is imported by Home's widgets and by WeeklyPage. The folder layout hides both couplings.
5. **Root clutter.** Four single-file review-CLI dirs, a dead Python prototype inside the frontend's parent dir, and `amplify/` as the historical name for "Lambdas". A newcomer cannot tell what is live.

---

## 2. Target layout

### 2.1 Frontend shape

```
src/
  main.jsx                 ← stays (index.html:181 hard-codes /src/main.jsx)
  app/                     ← routing, chrome, providers wiring, error boundary, onboarding
  shared/                  ← only code used by ≥2 features AND free of feature knowledge
    api/  contexts/  data/  hooks/  lib/  styles/  ui/  ui/risk/
  features/
    home/  map/  threads/  countries/  economy/  daily/  weekly-brief/
    track-record/  breaking/  account/  analysis-studio/  static/  spider-demo/
  test/                    ← setup.js (vite.config.js setupFiles) + cross-feature integration tests only
```

**Layout inside a feature** (same shape everywhere, subdirs created only when used):
`<Feature>Page.jsx` + `.css` at the top · `components/` · `hooks/` · `lib/` (pure logic) · `__tests__/`.

**Dependency direction (the one rule):** `app → features → shared`. `shared/` never imports from `features/` or `app/`. A feature *may* import another feature's file by direct path (`@/features/economy/hooks/useDisruptionsList`). The known cross-feature edges are listed in §2.5. **No `index.js` barrels in this programme.** Barrels add circular-import risk (threads↔countries) and a second thing to keep in sync. Revisit only after the moves settle.

**Invariant: relocate, never rename.** Every file keeps its basename. Most doc, CHANGES.md, and memory references use bare filenames (`EconomyPage.jsx`, `useWeeklyArchive`), so they stay valid, and `grep -r <basename>` keeps working. Basenames are unique across `src/` today, and that stays true.

### 2.2 Features, derived from routes and the import graph

| Feature | Routes | Owns |
|---|---|---|
| `home` | `/` | Topics feed page, archive sidebar/modal, AI summary/prediction/trace widgets, lede band |
| `map` | `/map` | Situation map (2D + deck.gl 3D), world-store fetch, situation labels |
| `threads` | `/weekly`, `/weekly/thread/:threadId` | Weekly threads list, thread page, the big WeeklyMap, timelines, forecast, weekly-archive + thread-analysis data hooks |
| `countries` | `/weekly/countries`, `/weekly/country/:countryName` | Country list/page, overview map, systems graph, what-changed, country data hooks |
| `economy` | `/economy`, `/weekly-markets` | Economy page, weekly markets view, **the economic-disruption widget kit** (MechanismCard, InstrumentChip, QualityFlag…), markets/disruption hooks, briefing composer, display gate, analog catalog |
| `daily` | `/daily`, `/daily/:dateKey` | Daily brief page + hook |
| `weekly-brief` | `/weekly-brief` | Weekly brief page + hook |
| `track-record` | `/track-record` | Track-record page, track-record + corrections hooks |
| `breaking` | `/breaking`, `/breaking/:id` | Feed/detail pages, NotificationBell, BreakingStrip, alert hooks |
| `account` | `/signin`, `/auth/callback`, `/account`, `/membership` | Auth pages, account, membership (Polar), save/follow/subscribe widgets, membership/prefs/saved hooks |
| `analysis-studio` | `/analyze` | Studio, provider modal, BYOK, LLM client, prompt/validator/struct, analysis visuals |
| `static` | `/about`, `/contact`, `/privacy`, `/disclosures`, `/whitepaper` | Static info pages |
| `spider-demo` | `/spider-demo` | Unlisted prototype (SpiderDemo, SpiderWorld) |

I did not create `membership/` and `billing/` as separate features. The billing UI is one page (`MembershipPage`) plus one hook (`useMembership`), and splitting them from account would add cross-feature edges for no gain. Daily and weekly-brief share no code, so they stay separate. A `briefs/` umbrella would be a folder with no shared contents.

### 2.3 Full file mapping (all 193 files)

Legend: **Δ** = ambiguous home (reason in §2.4). **DEL?** = orphan: propose deletion before moving (§2.6). **N** = imported by Node tooling outside `src/`, so it must keep **relative** imports (§4, risk R3).

#### app/ (entry, routing, chrome)

| Current | Destination |
|---|---|
| `main.jsx` | `main.jsx` (unchanged) |
| `App.jsx` | `app/App.jsx` |
| `App.css` | `app/App.css` |
| `index.css` | `app/index.css` |
| `bootstrapProxy.js` | `app/bootstrapProxy.js` |
| `components/Layout.jsx` | `app/layout/Layout.jsx` |
| `components/Layout.css` | `app/layout/Layout.css` |
| `components/AIToast.jsx` | `app/layout/AIToast.jsx` |
| `components/LoadingBar.jsx` | `app/layout/LoadingBar.jsx` |
| `components/LoadingIndicators.css` | `app/layout/LoadingIndicators.css` |
| `components/ErrorHandling.jsx` | `app/errors/ErrorHandling.jsx` |
| `components/ErrorModal.jsx` | `app/errors/ErrorModal.jsx` |
| `onboarding/useOnboarding.js` | `app/onboarding/useOnboarding.js` |
| `onboarding/tours.js` | `app/onboarding/tours.js` |
| `onboarding/tour-theme.css` | `app/onboarding/tour-theme.css` |
| `test/routes.test.jsx` | `app/__tests__/routes.test.jsx` |

#### shared/

| Current | Destination | Consumers (why shared) |
|---|---|---|
| `services/restProxy.js` | `shared/api/restProxy.js` | 30+ files |
| `services/errorSink.js` | `shared/api/errorSink.js` | main.jsx, ErrorHandling |
| `contexts/AuthContext.jsx` | `shared/contexts/AuthContext.jsx` | 17 files across 8 features |
| `contexts/ErrorContext.jsx` | `shared/contexts/ErrorContext.jsx` | App, ErrorModal, Home |
| `hooks/useGeminiTopics.js` Δ | `shared/data/useGeminiTopics.js` | Home, AnalysisStudio, IntelligenceLoader |
| `utils/contentService.js` Δ | `shared/data/contentService.js` | Home, useGeminiTopics, useTodayArchive |
| `hooks/useIsMobile.js` | `shared/hooks/useIsMobile.js` | generic (WeeklyMap today) |
| `utils/threadPath.js` | `shared/lib/threadPath.js` | 15 files |
| `utils/riskTiers.js` | `shared/lib/riskTiers.js` | 9 files + backend comments (R6) |
| `utils/countryMapping.js` | `shared/lib/countryMapping.js` | 8 files |
| `utils/dateUtils.js` | `shared/lib/dateUtils.js` | 7 files |
| `test/riskTiers.test.js` | `shared/lib/__tests__/riskTiers.test.js` | |
| `test/utils.test.js` | `shared/lib/__tests__/utils.test.js` | tests countryMapping + dateUtils |
| `styles/tokens.css` | `shared/styles/tokens.css` | via index.css |
| `tokens.js` | `shared/styles/tokens.js` | 10 files |
| `components/atoms/atoms.css` Δ | `shared/ui/atoms.css` | global atom stylesheet (App imports it) |
| `components/atoms/EditorialShell.jsx` | `shared/ui/EditorialShell.jsx` | 5 pages |
| `components/atoms/StatusStrip.jsx` | `shared/ui/StatusStrip.jsx` | 5 pages |
| `components/atoms/SeverityBadge.jsx` | `shared/ui/SeverityBadge.jsx` | Home, Daily, CountryList, Country, econ kit |
| `components/atoms/DirectionArrow.jsx` | `shared/ui/DirectionArrow.jsx` | CountryPage + econ kit |
| `components/atoms/SourceRobustness.jsx` Δ | `shared/ui/SourceRobustness.jsx` | Breaking×2, Home, Thread |
| `components/Markdown.jsx` | `shared/ui/Markdown.jsx` | Studio, BreakingDetail, WeeklyBrief |
| `components/IntelligenceLoader.jsx` | `shared/ui/IntelligenceLoader.jsx` | 6 pages |
| `components/IntelligenceLoader.css` | `shared/ui/IntelligenceLoader.css` | |
| `components/CopyBriefing.jsx` | `shared/ui/CopyBriefing.jsx` | Country, Daily, Thread |
| `components/ShareButtons.jsx` | `shared/ui/ShareButtons.jsx` | Country, Daily, Thread |
| `components/atoms/RiskScorecard.jsx` | `shared/ui/risk/RiskScorecard.jsx` | Country, Thread |
| `components/atoms/RiskScorecard.css` | `shared/ui/risk/RiskScorecard.css` | |
| `components/atoms/RiskScoreBadge.jsx` | `shared/ui/risk/RiskScoreBadge.jsx` | CountryList (risk family) |
| `components/atoms/RiskDeltaPill.jsx` | `shared/ui/risk/RiskDeltaPill.jsx` | CountryWhatChanged (risk family) |
| `test/riskScorecard.test.jsx` | `shared/ui/risk/__tests__/riskScorecard.test.jsx` | |

#### features/home/

| Current | Destination |
|---|---|
| `components/Home.jsx` | `features/home/Home.jsx` |
| `components/Home.css` | `features/home/Home.css` |
| `components/AIComponents.css` Δ | `features/home/AIComponents.css` |
| `components/TopicNav.jsx` / `.css` | `features/home/components/TopicNav.jsx` / `.css` |
| `components/TodayArchiveSidebar.jsx` / `.css` | `features/home/components/TodayArchiveSidebar.jsx` / `.css` |
| `components/ArchiveTopicModal.jsx` | `features/home/components/ArchiveTopicModal.jsx` |
| `components/PredictionDisplay.jsx` | `features/home/components/PredictionDisplay.jsx` |
| `components/SummaryDisplay.jsx` | `features/home/components/SummaryDisplay.jsx` |
| `components/TraceCauseDisplay.jsx` | `features/home/components/TraceCauseDisplay.jsx` |
| `components/atoms/LedeBand.jsx` / `.css` | `features/home/components/LedeBand.jsx` / `.css` |
| `hooks/useTodayArchive.js` | `features/home/hooks/useTodayArchive.js` |
| `utils/composeTopicsLede.js` **N** | `features/home/lib/composeTopicsLede.js` |

#### features/map/

| Current | Destination |
|---|---|
| `components/SituationHome.jsx` / `.css` | `features/map/SituationHome.jsx` / `.css` |
| `components/SituationMap.jsx` | `features/map/components/SituationMap.jsx` |
| `components/SituationMap3D.jsx` | `features/map/components/SituationMap3D.jsx` |
| `hooks/useWorld.js` | `features/map/hooks/useWorld.js` |
| `services/worldData.js` | `features/map/api/worldData.js` |
| `utils/countryGeo.js` | `features/map/lib/countryGeo.js` |
| `utils/situationLabels.js` | `features/map/lib/situationLabels.js` |
| `assets/countries-110m.json` | `features/map/assets/countries-110m.json` |

#### features/threads/

| Current | Destination |
|---|---|
| `components/WeeklyPage.jsx` | `features/threads/WeeklyPage.jsx` |
| `components/WeeklyPage.css` Δ | `features/threads/WeeklyPage.css` |
| `components/ThreadPage.jsx` / `.css` | `features/threads/ThreadPage.jsx` / `.css` |
| `components/WeeklyMap.jsx` / `.css` | `features/threads/components/WeeklyMap.jsx` / `.css` |
| `components/CompactTimeline.jsx` | `features/threads/components/CompactTimeline.jsx` |
| `components/StoryEntryCard.jsx` | `features/threads/components/StoryEntryCard.jsx` |
| `components/ThreadIntelligence.jsx` | `features/threads/components/ThreadIntelligence.jsx` |
| `components/ThreadForecast.jsx` | `features/threads/components/ThreadForecast.jsx` |
| `components/TrendBadge.jsx` | `features/threads/components/TrendBadge.jsx` |
| `hooks/useWeeklyArchive.js` | `features/threads/hooks/useWeeklyArchive.js` |
| `hooks/useThreadAnalyses.js` | `features/threads/hooks/useThreadAnalyses.js` |
| `hooks/useNarrativeThread.js` | `features/threads/hooks/useNarrativeThread.js` |
| `hooks/useThreadForecast.js` | `features/threads/hooks/useThreadForecast.js` |
| `utils/mapConstants.js` | `features/threads/lib/mapConstants.js` |

#### features/countries/

| Current | Destination |
|---|---|
| `components/CountryListPage.jsx` / `.css` | `features/countries/CountryListPage.jsx` / `.css` |
| `components/CountryPage.jsx` / `.css` | `features/countries/CountryPage.jsx` / `.css` |
| `components/CountryOverviewMap.jsx` | `features/countries/components/CountryOverviewMap.jsx` |
| `components/BackgroundTimeline.jsx` | `features/countries/components/BackgroundTimeline.jsx` |
| `components/SystemsGraph.jsx` / `.css` | `features/countries/components/SystemsGraph.jsx` / `.css` |
| `components/atoms/CountryWhatChanged.jsx` / `.css` | `features/countries/components/CountryWhatChanged.jsx` / `.css` |
| `hooks/useCountryIntelligence.js` | `features/countries/hooks/useCountryIntelligence.js` |
| `hooks/useCountryHistory.js` | `features/countries/hooks/useCountryHistory.js` |
| `hooks/useSystemsAnalysis.js` | `features/countries/hooks/useSystemsAnalysis.js` |
| `utils/countryDrift.js` | `features/countries/lib/countryDrift.js` |
| `test/countryDrift.test.js` | `features/countries/__tests__/countryDrift.test.js` |
| `test/countryWhatChanged.test.jsx` | `features/countries/__tests__/countryWhatChanged.test.jsx` |
| `test/useSystemsAnalysis.test.js` | `features/countries/__tests__/useSystemsAnalysis.test.js` |
| `test/causalGraph.test.jsx` Δ | `features/countries/__tests__/causalGraph.test.jsx` |
| `test/macroValues.test.js` Δ | `features/countries/__tests__/macroValues.test.js` |

#### features/economy/

| Current | Destination |
|---|---|
| `components/EconomyPage.jsx` / `.css` | `features/economy/EconomyPage.jsx` / `.css` |
| `components/WeeklyMarketsPage.jsx` | `features/economy/WeeklyMarketsPage.jsx` |
| `components/WeeklyMarketsView.jsx` / `.css` | `features/economy/components/WeeklyMarketsView.jsx` / `.css` |
| `components/atoms/MechanismCard.jsx` | `features/economy/components/MechanismCard.jsx` |
| `components/atoms/InstrumentChip.jsx` | `features/economy/components/InstrumentChip.jsx` |
| `components/atoms/QualityFlag.jsx` | `features/economy/components/QualityFlag.jsx` |
| `components/atoms/DisruptionRow.jsx` Δ | `features/economy/components/DisruptionRow.jsx` |
| `components/atoms/DisruptionPreview.jsx` Δ | `features/economy/components/DisruptionPreview.jsx` |
| `components/atoms/Sparkline.jsx` | `features/economy/components/Sparkline.jsx` |
| `hooks/useDisruptionsList.js` | `features/economy/hooks/useDisruptionsList.js` |
| `hooks/useEconomicImpact.js` | `features/economy/hooks/useEconomicImpact.js` |
| `hooks/useTopMovers.js` | `features/economy/hooks/useTopMovers.js` |
| `hooks/useMarketsGlobal.js` | `features/economy/hooks/useMarketsGlobal.js` |
| `hooks/useMarketsHistory.js` | `features/economy/hooks/useMarketsHistory.js` |
| `hooks/useMarketsCountry.js` Δ | `features/economy/hooks/useMarketsCountry.js` |
| `hooks/useWeeklyMarkets.js` | `features/economy/hooks/useWeeklyMarkets.js` |
| `utils/composeEconomyBriefing.js` **N** | `features/economy/lib/composeEconomyBriefing.js` |
| `utils/disruptionGate.js` **N** | `features/economy/lib/disruptionGate.js` |
| `data/economicAnalogs.js` **N** | `features/economy/data/economicAnalogs.js` |
| `data/economicAnalogs.json` | `features/economy/data/economicAnalogs.json` |
| `test/economyPage.test.jsx` | `features/economy/__tests__/economyPage.test.jsx` |
| `test/atoms_economic.test.jsx` | `features/economy/__tests__/atoms_economic.test.jsx` |
| `test/useEconomicImpact.test.js` | `features/economy/__tests__/useEconomicImpact.test.js` |

#### features/daily/, features/weekly-brief/, features/track-record/

| Current | Destination |
|---|---|
| `components/DailyPage.jsx` / `.css` | `features/daily/DailyPage.jsx` / `.css` |
| `hooks/useDailyBrief.js` | `features/daily/hooks/useDailyBrief.js` |
| `components/WeeklyBriefPage.jsx` / `.css` | `features/weekly-brief/WeeklyBriefPage.jsx` / `.css` |
| `hooks/useWeeklyBrief.js` | `features/weekly-brief/hooks/useWeeklyBrief.js` |
| `components/TrackRecordPage.jsx` / `.css` | `features/track-record/TrackRecordPage.jsx` / `.css` |
| `hooks/useTrackRecord.js` | `features/track-record/hooks/useTrackRecord.js` |
| `hooks/useCorrectionsFeed.js` | `features/track-record/hooks/useCorrectionsFeed.js` |

#### features/breaking/

| Current | Destination |
|---|---|
| `components/BreakingFeedPage.jsx` | `features/breaking/BreakingFeedPage.jsx` |
| `components/BreakingDetailPage.jsx` | `features/breaking/BreakingDetailPage.jsx` |
| `components/BreakingPage.css` | `features/breaking/BreakingPage.css` |
| `components/NotificationBell.jsx` / `.css` | `features/breaking/components/NotificationBell.jsx` / `.css` |
| `components/atoms/BreakingStrip.jsx` / `.css` | `features/breaking/components/BreakingStrip.jsx` / `.css` |
| `hooks/useNotifications.js` | `features/breaking/hooks/useNotifications.js` |
| `hooks/useBreakingAlert.js` | `features/breaking/hooks/useBreakingAlert.js` |

#### features/account/

| Current | Destination |
|---|---|
| `components/Account.jsx` / `.css` | `features/account/Account.jsx` / `.css` |
| `components/SignIn.jsx` | `features/account/SignIn.jsx` |
| `components/AuthCallback.jsx` | `features/account/AuthCallback.jsx` |
| `components/MembershipPage.jsx` / `.css` | `features/account/MembershipPage.jsx` / `.css` |
| `components/SaveButton.jsx` | `features/account/components/SaveButton.jsx` |
| `components/FollowButton.jsx` | `features/account/components/FollowButton.jsx` |
| `components/SubscribeCard.jsx` / `.css` | `features/account/components/SubscribeCard.jsx` / `.css` |
| `hooks/useMembership.js` | `features/account/hooks/useMembership.js` |
| `hooks/usePreferences.js` | `features/account/hooks/usePreferences.js` |
| `hooks/useSavedItems.js` | `features/account/hooks/useSavedItems.js` |

#### features/analysis-studio/

| Current | Destination |
|---|---|
| `components/AnalysisStudio.jsx` / `.css` | `features/analysis-studio/AnalysisStudio.jsx` / `.css` |
| `components/ProviderModal.jsx` / `.css` | `features/analysis-studio/components/ProviderModal.jsx` / `.css` |
| `components/atoms/AnalysisVisuals.jsx` / `.css` | `features/analysis-studio/components/AnalysisVisuals.jsx` / `.css` |
| `services/llm.js` **N** | `features/analysis-studio/lib/llm.js` |
| `utils/analysis.js` | `features/analysis-studio/lib/analysis.js` |
| `utils/analysisPrompt.js` **N** | `features/analysis-studio/lib/analysisPrompt.js` |
| `utils/analysisValidator.js` **N** | `features/analysis-studio/lib/analysisValidator.js` |
| `utils/analysisStruct.js` **N** | `features/analysis-studio/lib/analysisStruct.js` |
| `utils/byok.js` | `features/analysis-studio/lib/byok.js` |
| `utils/sourceRobustness.js` Δ | `features/analysis-studio/lib/sourceRobustness.js` |
| `test/analysisStruct.test.js` | `features/analysis-studio/__tests__/analysisStruct.test.js` |
| `test/analysisVisuals.test.jsx` | `features/analysis-studio/__tests__/analysisVisuals.test.jsx` |

#### features/static/, features/spider-demo/

| Current | Destination |
|---|---|
| `components/AboutContact.jsx` | `features/static/AboutContact.jsx` |
| `components/Contact.jsx` | `features/static/Contact.jsx` |
| `components/PrivacyTerms.jsx` | `features/static/PrivacyTerms.jsx` |
| `components/Disclosures.jsx` | `features/static/Disclosures.jsx` |
| `components/WhitepaperPage.jsx` | `features/static/WhitepaperPage.jsx` |
| `components/SpiderDemo.jsx` / `.css` | `features/spider-demo/SpiderDemo.jsx` / `.css` |
| `components/SpiderWorld.jsx` | `features/spider-demo/SpiderWorld.jsx` |

#### test/ (what stays)

| Current | Destination |
|---|---|
| `test/setup.js` | `test/setup.js` (unchanged; `vite.config.js` `setupFiles`) |
| `test/redesign.test.jsx` Δ | `test/integration/redesign.test.jsx` |

#### Orphans: delete before moving (DEL?)

| Current | Evidence |
|---|---|
| `utils/topicMatch.js` | 0 importers anywhere (its consumer, WorldMapV2, was removed today) |
| `hooks/useCountrySignal.js` | 0 importers. Its only consumer was WorldMapV2. |
| `test/useCountrySignal.test.js` | Self-contained: it re-implements the logic inline and imports nothing from `src/`. Delete it with the hook, or keep it only if the logic comes back. |
| `components/atoms/MacroChip.jsx` | 0 importers (only referenced by a comment/rule in `atoms.css`) |
| `assets/react.svg` | Vite scaffold, 0 references |

Coverage check (scripted against the live tree): the tables above name **all 193 files in `src/`, each exactly once**, with no extra paths. Paired `Foo.jsx` / `.css` rows count as 2 files.

### 2.4 Ambiguous homes (Δ): my call and why

| File | Call | Why it's ambiguous and the alternative |
|---|---|---|
| `useGeminiTopics.js`, `contentService.js` | `shared/data/` | This is the topics feed. It's home's data, but AnalysisStudio and the shared `IntelligenceLoader` also consume it. If it stayed in home, `shared/ui/IntelligenceLoader` would have to import a feature, which breaks the one rule. |
| `WeeklyPage.css` (3,074 lines) | `features/threads/` | It's de facto a global editorial stylesheet: countries and account (SignIn, AuthCallback) import it. The honest fix is to extract the shared selectors into `shared/styles/editorial.css`, but that's a CSS refactor with cascade-order risk. **Not part of the move.** Record it as a follow-up and let the cross-feature imports show the coupling. |
| `AIComponents.css` | `features/home/` | WeeklyPage imports it too. It has the same follow-up as WeeklyPage.css. |
| `atoms.css` (737 lines) | `shared/ui/atoms.css` | It has rules for atoms that move into features (LedeBand has its own css, but QualityFlag/Mechanism rules may live here). Splitting it per atom is a refactor, not a move. Keep it whole and global. |
| `DisruptionRow.jsx`, `DisruptionPreview.jsx` | `features/economy/` | **No production importer.** Only `atoms_economic.test.jsx` and the `verify_pages.sh` guards (which assert they wire QualityFlag) reference them. They look like dead UI kept alive by tests. Operator decision: delete them together with their guard rows, or keep them as a parked kit. The move is fine either way. |
| `useMarketsCountry.js` | `features/economy/hooks/` | Its only consumer is CountryPage, but it's part of the markets hook family (same proxy actions as useMarketsGlobal/History). Alternative: `features/countries/hooks/`. |
| `SourceRobustness.jsx` (atom) vs `utils/sourceRobustness.js` | `shared/ui/` vs `features/analysis-studio/lib/` | The names differ only by case, and the atom does **not** import the util. On case-insensitive macOS they **must never share a directory**. The split destinations keep them apart. |
| `causalGraph.test.jsx`, `macroValues.test.js` | `features/countries/__tests__/` | Self-contained regression tests: each inlines a copy of the logic and imports nothing. They guard CountryPage/SystemsGraph behaviour, so they go to countries. |
| `redesign.test.jsx` | `test/integration/` | It exercises WeeklyPage, CountryListPage, and 3 risk atoms, so it's a cross-feature integration test. It also imports `../../tests/fixtures/*.json` by relative path, so switch those to an alias (see P1). |

### 2.5 Cross-feature edges this layout makes visible (all real imports today)

- countries → threads: WeeklyMap, useWeeklyArchive, useThreadAnalyses, mapConstants, WeeklyPage.css
- home, daily, countries, threads → economy: useDisruptionsList, MechanismCard, InstrumentChip, useEconomicImpact
- countries, daily, threads, home, breaking, weekly-brief, track-record → account: SaveButton, FollowButton, SubscribeCard
- app/layout → account (useMembership), breaking (NotificationBell)
- home → breaking (BreakingStrip), track-record (useTrackRecord, useCorrectionsFeed)
- account → analysis-studio: llm, byok, ProviderModal (Account's BYOK settings panel)
- account (SignIn, AuthCallback) → threads (WeeklyPage.css), threads (WeeklyPage) → home (AIComponents.css)
- spider-demo → threads (CompactTimeline, useNarrativeThread), countries (useSystemsAnalysis)

Each edge is intentional. The layout doesn't hide them: every one shows up as an `@/features/<other>/…` import line, so `grep -rn "@/features/economy" src/features --include=*.jsx | grep -v features/economy/` answers "who depends on economy".

### 2.6 Backend (`amplify/backend/function/*`): **do not move. Add a feature→Lambda index.**

Grouping Lambdas into feature subfolders (for example `lambdas/economy/newsEconomicImpact/`) was evaluated and **rejected**:

- **Cost is high and spread across many places.** 214 path references in 40 `project-docs` files, 18 memory files, 2 in CLAUDE.md, plus executable references: the `.githooks/pre-commit` `CODE_RE`, `quality/verify_all.sh`, `verify_market.sh`, `verify_lambdas.sh`, `verify_ddb.js`, `dashboard.js`, `severity_prompt_eval.js`, `scripts/check-shared-sync.mjs` (hard-codes the 4 shared-module pairs), `scripts/test_pre_commit_hook.sh`, and `breaking/send*.js` (which `require` `../amplify/backend/function/newsBreakingAlert/src/...`). The per-function deploy recipes in ARCHITECTURE.md (`cd amplify/backend/function/X/src && zip …`) and the deploy classifier allowlist are also muscle memory.
- **The benefit is close to zero.** Each Lambda is already a self-contained, feature-sized unit: one directory, one deploy, one name. The findability problem is "which Lambdas serve the economy page?", and an index answers that as well as a folder does, without moving a byte.
- **Deployed bytes already drift from the repo** (ARCHITECTURE.md "Deploy model"). A move adds a path-history discontinuity exactly where "diff repo vs deployed zip" matters most.

**Instead:** add a **Feature → Lambda index** section to ARCHITECTURE.md (one table, same commit as P2). Draft grouping from the 37 inventory sections:

| Feature | Lambdas |
|---|---|
| home (topics ingest) | newsInvokeGemini, NewsProjectInvokeAgentLambda, newsSourceAudit |
| map (situations) | newsGdacsIngest, newsGdeltConflict, newsSituationIngest, newsSituationTracker, newsImpactAudit |
| threads | newsThreadAnalysis, newsDriftCorrector |
| countries | newsCountryIntelligence, newsCountryFactsUpdater, newsSystemsAnalysis, newsPairIntelligence (dormant, cron DISABLED) |
| economy | newsMarketsData, newsEconomicImpact, newsEconomicQuality, newsWeeklyMarkets |
| weekly-brief | newsWeeklyBrief |
| track-record | newsPredictionResolver, newsPredictionsSnapshot |
| breaking | newsBreakingAlert |
| account | newsSavedItems, newsRecommend (prefs + alerts list), newsPolarBilling |
| analysis-studio | newsAnalyze |
| distribution | newsPostLinkedIn, newsPostDevTo, newsEmailSender, newsSignals |
| platform / observability | newsSensitiveData (shared proxy for most pages), newsClientErrors, newsErrorDigest, newsFreshnessMonitor, newsModelGuard |
| **flag** | `newsStripeWebhook/` dir still exists, but ARCHITECTURE §12 says the function was REMOVED 2026-06-01. Archive-or-delete is a separate cleanup decision. `_sandbox/`, `deploy-credits-prod.sh` are tooling. |

### 2.7 Repo root: minimal changes

| Candidate | Decision | Reason |
|---|---|---|
| Rename `global-perspectives-starter/frontend` → `frontend/` | **No** (not in this programme) | This is the biggest clarity win, but it touches `deploy.sh` (`FRONTEND_DIR`), pre-commit `CODE_RE`, `verify_pages.sh` `SRC`, `auth-guard-check`, `contract-check` (resolves `zod` from `frontend/node_modules`), 7 `quality/analysis|briefing` imports, `agent-kit/PROJECT.md` (verify cmd, worktree recipe), the deploy-frontend skill, CLAUDE.md, the `settings.local.json` allowlist, and memory. Revisit as its own one-commit change once the src/ moves settle. |
| `breaking/ weekly/ weekly-markets/ predictions/` → `tools/review/<name>/` | **Optional, deferred** | This reduces root clutter by 3 dirs. But `breaking/send*.js` build `__dirname/..` paths into amplify (they'd need to become `../../..`), 10 docs and 7 memory files cite `node breaking/review.js` etc., and the operator runs these by hand. It's low value per unit of risk. If done, do it in one commit with a grep sweep. |
| Legacy Python (`global-perspectives-starter/{agent,backend,global-perspectives-batch,tests}`, `requirements.txt`, `test_gemini.py`) | **Flag to operator: archive or delete** (a separate cleanup decision, same class as CLEANUP_AUDIT A2) | Zero live references. It's the single most confusing thing sitting next to the real frontend. |
| `quality/`, `scripts/`, `agent-kit/`, `project-docs/`, `internal-docs/`, `cli/`, `archive/` | **Leave** | Each is coherent and heavily referenced. A `tools/` umbrella over `quality/`+`scripts/` would break ~20 executable paths plus the pre-commit regex for no findability gain. Adding a "where things live" table to README.md solves the discoverability problem at zero risk. |

---

## 3. Migration plan

Every phase is **one commit**, independently shippable, and reversible with `git revert <sha>` (moves use `git mv`, so history follows: `git log --follow`, and whole-file `git blame` still resolves). Do not deploy between phases unless you want to. Every phase leaves `main` deployable.

### Per-phase checklist (run for every phase from P1 on)

1. `git worktree list` shows no other worktree/branch with in-flight frontend edits (today: none. All 4 side branches are 0 commits ahead of main).
2. Move with the helper (P1) → `git mv`, then rewrite `@/old/path` → `@/new/path` specifiers in `src/`, **including `vi.mock('…')` and dynamic `import('…')` strings**.
3. `cd global-perspectives-starter/frontend && npm run verify` (eslint + vitest; expect 16 files / 193 tests before P0 deletions).
4. `npm run build`, then **compare the bundle hash** with the pre-phase build (`ls dist/assets/index-*.js`). A pure move doesn't change emitted code, so the hash should be identical. If it differs, diff the prettified bundles: any non-ordering difference is a bug.
5. `bash quality/verify_pages.sh` (after P0's hardening, a missing file fails loudly) and `node scripts/auth-guard-check.mjs`.
6. For **N** files moved: run their Node consumers (`node quality/briefing/verify_compose.mjs`, `verify_lede.mjs`, `verify_instrument_why.mjs`, `node scripts/test-disruption-gate.mjs` with a scan file or at least an import smoke, and `node -e "import('./quality/analysis/check.mjs')"`-style import checks). These are on-demand tools, so nothing else will notice if they break.
7. `npm run dev` and click through **every route the moved feature serves** plus the pages that import it cross-feature (feedback_test_ui_in_browser).
8. The same commit includes: a `CHANGES.md` entry (the pre-commit doc guard **blocks** without it, because `frontend/src/**` matches `CODE_RE`), the **old→new path table** appended to ARCHITECTURE.md §Frontend "Path map", and fixes for every *live* doc/tool that references a moved path (list per phase below). Historical docs (`_shipped/`, `_legacy/`, dated `*_2026-*` audits, CHANGES.md) are **not rewritten**. The ARCHITECTURE path map keeps their old paths resolvable.

### Phases

| # | Phase | What | Path refs to update in the same commit (grep-derived) | Effort |
|---|---|---|---|---|
| **P0** | Pre-flight: delete orphans + harden guards | Operator-approved `git rm` of §2.6 orphans (+ MacroChip rules in atoms.css). **Harden:** `verify_pages.sh` `must_not_have` must FAIL when the file doesn't exist (today a missing file silently PASSes the WeeklyPage negative guard). Change `.githooks/pre-push` trigger regex from path fragments (`atoms/(Mechanism\|Disruption\|Severity\|Quality)`) to basenames only (`(MechanismCard\|Disruption(Row\|Preview)\|SeverityBadge\|QualityFlag)`). Make `auth-guard-check.mjs` resolve hooks by basename search under `src/` instead of a fixed `src/hooks/` dir. | CHANGES.md; ARCHITECTURE (remove orphan rows if listed); `project-docs/playbooks/BUG_PLAYBOOK.md` if it describes the guard mechanics | 1–1.5 h |
| **P1** | Tooling: alias + absolute imports, no moves | Add `resolve.alias: { '@': path.resolve(__dirname, 'src') }` to `vite.config.js` (vitest shares it, so `vi.mock('@/…')` works). Add `jsconfig.json` with `paths: {"@/*": ["src/*"]}` for editor/cclsp go-to-definition. Codemod every relative import in `src/` to `@/…` **except** in the **N** files and their intra-feature imports (`disruptionGate.js → ../data/economicAnalogs.js`), which must stay relative. Also switch `redesign.test.jsx`'s `../../tests/fixtures` to a `@fixtures` alias. Add `scripts/move-module.mjs <old> <new>`: `git mv`, rewrite `@/` specifiers, then print a grep of remaining references in `project-docs/` (live only), `quality/`, `scripts/`, `.githooks/`, `.claude/skills/`, `agent-kit/`. After this phase, a later move only rewrites the moved file's own specifier string. Nothing else breaks. | CHANGES.md; ARCHITECTURE §Frontend (import convention + layout rule); CLAUDE.md "Project Structure" (one line on `@/`) | 2 h |
| **P2** | `app/` + `shared/` | Move everything in §2.3 app/ and shared/. Create the directories. | `quality/verify_pages.sh` (Layout.jsx path; `App.jsx` path moves to `app/App.jsx`); `quality/dashboard.js:155-156` (no change: those are economy atoms, moved in P7); `.githooks/pre-push` (`Layout\.jsx` basename still matches ✓); live docs: PAGES_GUIDE, SYSTEM_WIRING, BUG_PLAYBOOK:314 (`components/ErrorHandling.jsx`), AGENT_REVIEW_METHOD:168 (`src/components/` grep example → `src/`); ARCHITECTURE Feature→Lambda index added here. **Backend comments** citing `src/utils/riskTiers.js` (newsCountryIntelligence + newsThreadAnalysis `riskDimensions.js`, byte-identical pair guarded by `check-shared-sync`; newsEmailSender `renderDriftEmail.js`): **leave them.** Editing them creates repo-vs-deployed drift for a comment. Update both copies together at the next real deploy of those Lambdas. | 2–3 h |
| **P3** | `static` + `spider-demo` | Leaf features, no inbound edges. This is the shakedown run for the helper. | verify_pages (Disclosures.jsx ×2 rows); live docs by basename only (no change) | 30 min |
| **P4** | `weekly-brief`, `daily`, `track-record` | Small, few inbound edges (home → track-record hooks). | verify_pages (DailyPage ×3 rows); `auth-guard-check` allowlist includes useDailyBrief (basename lookup after P0 ✓) | 45 min |
| **P5** | `map` | Situation map. | live docs: MAP_HOME_SITUATION_PLAN.md, MAP_HOME_SITUATION_LEDGER.md, MAP_UI_FIX_QUEUE.md (`_active`) | 45 min |
| **P6** | `breaking` + `account` | Many inbound edges (layout, 6 pages → account widgets). | verify_pages: none; POLAR_BILLING_PLAN.md (`_active`, 1 ref) | 1 h |
| **P7** | `analysis-studio` | **N**-heavy: `llm.js`, `analysisPrompt/Validator/Struct.js`. | `quality/analysis/{compare,judge,run,check,source_check}.mjs` (13 import lines) + `quality/analysis/README.md`; QWEN_AND_VISUAL_BLOCK_PLAN.md (`_active`) | 1 h |
| **P8** | `economy` | The widget kit + **N** files (`composeEconomyBriefing`, `disruptionGate`, `economicAnalogs`). | `quality/verify_pages.sh` (6 atom rows + EconomyPage ×4); `quality/dashboard.js:155-156`; `quality/briefing/verify_compose.mjs`, `verify_instrument_why.mjs`, `assertions.js` (comment); `frontend/scripts/test-disruption-gate.mjs` (`../src/utils/disruptionGate.js`); `e2e/economic.spec.js` (routes only ✓); ECONOMY_BRIEFING_PLAN.md (`_proposed`) | 1.5 h |
| **P9** | `home` | Topics page + lede composer (**N**). | `quality/briefing/verify_lede.mjs`; verify_pages (Home.jsx ×4) | 1 h |
| **P10** | `countries` | Cross-imports threads (still at old path, fine: absolute imports). | verify_pages (CountryPage ×3, CountryListPage ×3) | 1 h |
| **P11** | `threads` | Most inbound edges, so it goes last. After P11, `components/`, `hooks/`, `utils/`, `services/`, `contexts/`, `onboarding/`, `data/`, `assets/`, `styles/` must be **empty**. Delete them and add an eslint `no-restricted-imports` rule banning `@/components/*`, `@/hooks/*`, `@/utils/*`, and any `shared/**` → `@/features/**` import (the one rule, now enforced at `npm run verify`). | verify_pages (ThreadPage ×3, WeeklyPage negative guard); `auth-guard-check` allowlist (useWeeklyArchive, useThreadAnalyses by basename ✓); PAIR_ARCS_RELOCATION_PLAN.md (`_active`); PAGES_GUIDE final pass; ARCHITECTURE Key Components/Hooks tables get a "Path" column | 1.5 h |
| **P12** | Wrap-up (docs only) | README "where things live" table; memory note (operator's auto-memory has 13 files citing frontend paths. Since filenames didn't change, only path-qualified mentions matter. Update the one-line index entries lazily). Record the WeeklyPage.css/AIComponents.css extraction and the restProxy split (5 backends in one file, per FRONTEND_STRUCTURE_AUDIT §5.3) as proposed follow-ups, **not** part of this programme. | README.md, INDEX.md row for this doc | 30 min |

**Total: about 14–17 focused hours over 12 commits.** P3–P11 are mechanical once P1's helper exists. The dominant cost is click-through verification, not moving files.

**Order rationale:** P0 first so the guards fail loudly instead of passing silently. P1 converts to absolute imports, which is behaviour-neutral and provable by bundle hash, so every later move is a one-string rewrite. P2 lays down `shared/` before any feature needs it. Features then go from fewest to most inbound edges, so each phase touches the fewest foreign files.

---

## 4. Risks and where each phase catches them

| # | Risk | Where it bites | Caught by |
|---|---|---|---|
| **R1** | **Silent guard bypass.** `verify_pages.sh` `must_not_have` returns PASS when the file doesn't exist (`grep` on a missing file → non-match → "not present"), so the WeeklyPage negative guard goes quietly green after a move. The pre-push trigger regex matches `atoms/(…)` path fragments, so after a move the economic verifier **stops being triggered at all**. | P8, P11 | **P0 hardening** (missing file → FAIL; basename-only trigger regex). After that, every stale path in `verify_pages.sh` is a loud red FAIL on step 5. |
| **R2** | **Import breakage**, including strings a normal import scan misses: `vi.mock('../hooks/…')` (economyPage, redesign, useEconomicImpact, useSystemsAnalysis tests), dynamic `await import('../components/…')` in tests, CSS `@import`, and JSON imports. | every move | P1 makes all specifiers absolute, and the helper rewrites every `@/old` occurrence, mocks included. Then `npm run verify` (vitest fails on a bad mock path because the real module loads and hits the network or undefined) → `npm run build` (Rollup fails on an unresolved import) → bundle-hash compare (catches anything that resolved to the *wrong* file). |
| **R3** | **Node tooling imports frontend source by relative path and can't use `@/`.** `quality/analysis/*.mjs` (5 files, 13 imports) import `llm.js` and the `analysis*` utils. `quality/briefing/*.mjs` import `composeEconomyBriefing.js`/`composeTopicsLede.js`. `frontend/scripts/test-disruption-gate.mjs` imports `disruptionGate.js`, which imports `../data/economicAnalogs.js`. Two failure modes: (a) the script path goes stale, (b) someone "helpfully" converts an **N** file to `@/` imports and Node can't resolve it. These scripts are on-demand only, so either failure stays invisible for weeks. | P7, P8, P9 | The **N** marker in the map. P1 excludes N files from the codemod. Phase checklist step 6 runs each Node consumer. Add a one-line header comment to each N file ("imported by Node tooling — relative imports only"). |
| **R4** | **Stale path references in docs/scripts/skills.** 18 live docs reference frontend paths (PAGES_GUIDE 19, MAP_HOME_SITUATION_PLAN 14, ARCHITECTURE 14, PAIR_ARCS_RELOCATION_PLAN 11, …). Historical docs and CHANGES.md (273 refs) are deliberately left. | every phase | **Relocate-never-rename**: most references are bare basenames and stay valid. The helper prints remaining path-qualified hits per move. The ARCHITECTURE path map resolves historical references. The pre-commit guard forces a CHANGES.md entry. The on-demand AGENT_REVIEW_METHOD sweep catches leftovers. |
| **R5** | **Merge conflicts with parallel work** (worktrees / ralph-loop / other agents editing frontend files). A branch that edits `components/X.jsx` while main moves it will usually rename-merge fine, but import-line edits will collide. | any phase | Checklist step 1. Today there are **0** side branches ahead of main, so this is a clean window. Keep each phase to a single short session and don't leave a phase half-done overnight. |
| **R6** | **Backend comments and shared-module pairs.** `riskDimensions.js` exists as a byte-identical pair checked by `check-shared-sync.mjs`. Editing its `src/utils/riskTiers.js` comment in only one copy fails the guard, and editing both creates repo≠deployed drift. | P2 | Decision in P2: don't touch backend comments during the move. The ARCHITECTURE path map resolves `src/utils/riskTiers.js`. |
| **R7** | **deploy.sh assumptions** | none | Verified: `deploy.sh` only knows `global-perspectives-starter/frontend`, `dist/`, and `docs/`. Nothing inside `src/` moves those. `index.html` → `/src/main.jsx`: `main.jsx` stays. `docs/config.js` untouched. Vite `base:'/'` unaffected. **This is why the frontend-dir rename (§2.7) is excluded.** |
| **R8** | **CSS cascade order.** Moving a CSS file doesn't change its import order, but if a later "cleanup" reorders imports (for example, alphabetising import blocks in the codemod), cascade winners change. | P1, all | The codemod rewrites specifiers in place and never reorders lines. The bundle-hash check catches CSS reordering because the CSS bundle hash changes too. |
| **R9** | **Test discovery.** Vitest's default include (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) finds co-located `__tests__/` files, and the eslint test-globals block matches `**/*.test.{js,jsx}` ✓. `e2e/` stays excluded ✓. Risk: a test gets silently dropped from the run. | every move | Step 3: the test **count** must equal the pre-phase count (193, minus the useCountrySignal test's cases if P0 deletes it). A smaller number means a test was lost. |
| **R10** | **Memory and skills drift** | P12 | Operator memory: 13 files mention frontend paths, mostly by basename. Skills: `deploy-frontend` only cites `frontend/src/` generically ✓, and `onboard` points at ARCHITECTURE ✓. P12 does a lazy memory pass. |

---

## 5. Recommendation

**Do the frontend feature restructure fully (P0–P12) in one short programme. Leave backend Lambda paths alone and add the Feature→Lambda index. Make no root moves beyond flagging the dead Python prototype.**

Honest cost/benefit for a solo dev who works mostly through agents:

- **Benefit, real:** "all of Economy" becomes one folder, not five. Agents working on one feature read one directory instead of reconstructing ownership from imports every session. That's a context-hygiene win that pays off in every future session. Dead code becomes visible (this design found 4 orphans plus 2 test-only components). Shared-vs-private becomes explicit, so the blast radius of an edit is readable from the path.
- **Benefit, less than it looks:** grep by basename already works today, and the code runs the same either way. This is organisation, not features, so users see nothing.
- **Cost:** about 14–17 hours. One-time churn in `git log`: `--follow` handles it, and whole-file blame survives `git mv`. There's a lasting rule to keep ("new files go in a feature, shared only if ≥2 features"), and P11's eslint rule enforces it for free inside the existing `npm run verify` gate.
- **Why not "incrementally, when touching a feature":** it sounds cheap, but it leaves the tree in **two conventions for months**: half `components/`, half `features/`. That's worse than either end state and is exactly the confusion the operator is trying to remove. The phases above are already incremental (each one ships alone). The recommendation is to *finish* them in a bounded window, not spread them over organic edits.
- **Why not also the backend:** §2.6. The index gives about 90% of the findability for about 2% of the risk.
- **Minimum viable version** if 15 hours is too much right now: **P0 + P1 only (about 3 hours).** The hardened guards and absolute imports are independently valuable, and they make every later move a 30-minute mechanical step whenever it gets picked up.

**Operator decisions needed before P0:** (1) approve deleting the 5 orphans; (2) keep or delete DisruptionRow/DisruptionPreview (test-only); (3) archive or delete the legacy Python prototype (separate cleanup); (4) whether `tools/review/` consolidation is wanted at all.
