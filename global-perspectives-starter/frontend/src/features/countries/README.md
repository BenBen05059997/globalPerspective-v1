# countries

Country views. The URLs sit under `/weekly/...` for historical reasons (the Stories page is `/weekly`). This folder holds the country list with an overview map (`/weekly/countries`), the per-country page (`/weekly/country/:countryName`: Situation, Story Arcs and Coverage tabs) and `CountryCardV2`, the one-screen country card the map console also mounts. Readers use them to see a country's risk, what changed, and which stories touch it. Nothing is generated on view; every page reads stored data. The country page doubles as the country "sheet": each section carries its `ClaimTag` mark, plus a computed "What we don't know", Copy as text, Print and a private "Your view".

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the country pages. Timeline: reads the country views (briefing, what changed) and the country index; member drift depth, facts and the cross-country ledger stay on the actions. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public (signed-out reads work).
- No economy blocks: the disruption sort and rail, the macro baseline, the FX box and the card's macro and FX facts are gone (decision 0049).

## Routes
- `/weekly/countries` -> `CountryListPage` (`/weekly?section=countries` redirects here, `app/LegacyRedirects.jsx`)
- `/weekly/country/:countryName` -> `CountryPage`. `useParams()` already decodes the name; decoding again throws on `%`.
  Aliases and ISO3 codes (`USA`, `ARE`, `West Bank`) redirect to the canonical name (`countryHref`) and data is read under it only;
  a non-country keeps coverage but gets no map, follow, save or share.
- Links come from `@/shared/lib/links.js` (Show on map `mapHref`, `storyHref`; card forecasts -> `?q=<qid>`).

## Frontend
- `CountryListPage.jsx` - list with search, region filter and sort (risk, coverage, A-Z); its coverage counts read `useWeeklyArchive({ source: 'action' })`, the `archive_range` action, not the record (decision 0046)
- `CountryPage.jsx` - hero, map band, `CountryCardV2`, the three tabs, rails; phone gets Read / Map tabs
- `components/CountryCardV2.jsx` - facts, summary, risk, change, stories, triggers; the name links out
- `components/CountrySheet.jsx` (+css, print) - How it connects, What we don't know, Your view (localStorage only), Copy as text, Print
- `components/CountryWhatChanged.jsx`, `BackgroundTimeline.jsx`, `CountryOverviewMap.jsx` (Google Maps; "Map unavailable" without
  `window.GOOGLE_MAPS_API_KEY`)
- `hooks/` - `useCountryIntelligence`, `useCountryHistory`, `useCountryFacts`, `useCountryStories`
- `lib/` - pure helpers: `countryDirection`, `countryDrift`, `viewDrift` (country view -> drift notes), `viewIntelligence` (country view -> briefing), `countryFacts`, `countryMatch`,
  `countryTier`, `countryTriggers`, `countryWatch`; sheet: `countryUnknowns`, `countryConnections` (story-web links, "judged to feed
  into", negative lag = "order unclear"), `countryChange`, `countryText` (plain-text sheet, numbered absolute footnotes), `countryYourView`
- Public API (`index.js`): `CountryCardV2` (used by `map`)
- Imports from other features: `@/features/threads` -> `useWeeklyArchive`, `useThreadAnalyses`, `useWebIndex`, `deriveFromIndex`, plus a lazy
  `import()` of `threads/components/WeeklyMap` (a static import pulled it into the main chunk).
- Shared: `@/shared/lib/deadlines.js` (`buildDeadlines`), `useArchiveDayMap`, `@/shared/map/countryRiskLayer.js`, `countryCoordinates.js`, `@/shared/ui/risk/*`

## Backend
- Group guides: [pipeline](../../../../../backend/pipeline/README.md)
- `newsCountryIntelligence` (Scheduler `countryIntelliegence`, 05:15 UTC daily) writes `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE`
  and `HISTORY#<date>`; `newsCountryFactsUpdater` (Scheduler `Fact`, Mondays 05:00 Asia/Tokyo) writes `FACTS#<name>`;
  `newsDriftCorrector` (rule `TriggerDriftCorrector`, 05:30 UTC) writes `DRIFT#` notes; `newsSystemsAnalysis` (05:00 UTC) the story web;
  `newsSensitiveData-dev` serves all.

## Data
- `useCountryIntelligence` (several countries: the list page) -> the record's countries index (`/data/record/views/index/countries.json`, one request for every briefed country; `@/shared/api/countryBriefingsIndex.js`: the fields the list and the risk layer read, only the first risk signal, no drift), falling back when the index is missing or unreadable (reported) to `country_intelligence`, chunked to the backend's 15-name cap (`@/shared/map/countryRiskLayer.js`);
  localStorage `gp_country_intel_v1`, 30 min. The auth header is sent when signed in; the action is not tier-gated.
  One country (page, `CountryCardV2`) reads the view's `intelligence` first (0042 step 4, `lib/viewIntelligence.js`; equal to the action's item
  for all 48 views), falling back to the action on a missing view or failed fetch (reported); the list page and the map layer read the countries index (compared field by field with the action for 40 live briefings, 2026-10-31: no difference).
- `useCountryHistory` -> `country_history` (localStorage `gp_country_history_<name>`, 1 h). Drift-note depth is capped by tier on the
  server; the call sends the auth header when signed in, so members get full depth (anonymous: latest note plus a count).
  The drift notes are read from the record's country view (`/data/record/views/countries/<ISO3>.json`, decision 0042 step 4: notes only, as
  `newsDriftCorrector` stored them) when it holds at least as many as the action returned, cut to that many (`lib/viewDrift.js`); a 404, a
  failed view fetch or a shorter view keeps the action's notes. Snapshots, the total and the gate always come from `country_history`.
  The Desk (`account` `useDeskChanges`) and the corrections ledger (`track-record` `useCorrectionsFeed`, `corrections_feed`) stay on actions.
- `useCountryFacts` -> `country_facts` (memory, 30 min); `useCountryStories` -> `useArchiveDayMap` (the record's weekly index, `archive_range` for the newest days; decision 0046) + `prediction_snapshot`.
- `useWebIndex` -> the record's web view (`index/web.json`), `web_index` as fallback (memory, 30 min): How it connects and the story-web coverage line.
- `useWeeklyArchive` -> the record's weekly index, `archive_range` for the newest days and as fallback (decision 0046); `useThreadAnalyses` (`light`) -> the record's analyses index, `thread_analysis` as fallback.

## Pipeline
1. `newsInvokeGemini-dev` / `NewsProjectInvokeAgentLambda-dev` (3x a day) write topics with `regions` into NewsCache `archive#<date>`.
2. `newsThreadAnalysis` (04:40 UTC) writes `THREAD_ANALYSIS`; `newsCountryFactsUpdater` (weekly) pulls Wikidata into `FACTS#`.
3. `newsCountryIntelligence` (05:15 UTC) reads the archives, thread analyses and facts -> `COUNTRY#<name>` briefing and risk read.
4. `newsDriftCorrector` (05:30 UTC) compares days -> `DRIFT#<date>` notes.
5. `newsSensitiveData-dev` actions `country_intelligence`, `country_facts`, `country_history`, `archive_range`.
6. Hooks above -> `CountryCardV2`, `CountryPage` (`/weekly/country/:countryName`) and `CountryListPage` (`/weekly/countries`).
7. In the browser, no model: `CountryPage` builds the sheet blocks and the copied text from what it read; "built only from our archive"
   is said only when the analysis has no `groundingSources`.

## Docs
- Decisions: [0010](../../../../../project-docs/decisions/0010-country-view-split.md) (country view split by job),
  [0005](../../../../../project-docs/decisions/0005-one-importance-scale.md), [0049](../../../../../project-docs/decisions/0049-retire-economy.md)
- Rules: [SEVERITY_CODEBOOK.md](../../../../../quality/SEVERITY_CODEBOOK.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/countries`
- One country served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"country_intelligence","payload":{"countryNames":["Japan"]}}' | head -c 300`
- Facts: same command with `-d '{"action":"country_facts","payload":{"countryNames":["Japan"]}}'`
- Daily job: `aws scheduler get-schedule --name countryIntelliegence --region ap-northeast-1 --query State`

Last verified: 2026-10-31
