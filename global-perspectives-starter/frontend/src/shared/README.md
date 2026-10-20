# shared

The bottom layer of the frontend: code that two or more features use, or that the shell needs. It is the only
place a page address, a country name, a claim label, a freshness line or a backend call is defined. Features
import from here; here imports from no feature and not from `app/`.

## Subfolders
- `api/` - the single door to the backend, the error reporter, and `useCachedQuery` (the one cached-fetch hook every data hook builds on).
- `contexts/` - app-wide React context: `AuthContext.jsx` (Firebase sign-in, `useAuth`, `getIdToken`).
- `data/` - story-list loading (`contentService.js`, `useGeminiTopics.js`) and the one country table, `iso3Names.json`.
- `hooks/` - hooks used by more than one feature: membership, saved items, preferences, daily brief, disruptions list, peek, viewport (`useIsMobile`, `useIsPhone`), `useNoIndex`.
- `lib/` - pure helpers with no UI: links, countries, risk tiers, dates and freshness, LLM provider catalog (used by the eval client only), economy flag.
- `map/` - the shared map kit: `RadarMap`, `SituationMap3D` (deck.gl globe), `StoryMap`, country geometry and coordinates, legend and pulse helpers.
- `styles/` - `tokens.css` (the one token set) and `tokens.js` (the same colors for canvas and JS).
- `ui/` - shared building blocks (Button, Card, Chip, Tabs, SectionHeader, TierChip, PhoneTabs, StoryRow, ...), their CSS (`primitives.css`, `blocks.css`, `atoms.css`), `boot/` (loader) and `risk/` (risk badges).

## Single-source modules: reuse, do not copy
- Page addresses: `lib/links.js` (`ROUTE`, `storyHref`, `countryHref`, `briefingHref`, `mapHref`, `breakingHref`, `entityHref`). Never type a route string elsewhere.
  Its rules block is kept identical to `backend/shared/src/links.js` (emails) by `scripts/check-shared-sync.mjs`.
- Countries: `data/iso3Names.json` (copy of `backend/shared/src/iso3Names.json`) read through `lib/countries.js` (`COUNTRIES`, `resolveCountry`, `isCountry`, `normKey`, `parentCountry`). `lib/countryMapping.js` only groups countries by region.
- Claim kind: `ui/ClaimTag.jsx` (FACT, INFERENCE, MODEL JUDGMENT). Entity links: `ui/EntityLink.jsx` (story or country link with a hover peek).
- Freshness: `ui/AsOf.jsx` ("as of 5h ago") built on `lib/age.js`; `lib/freshness.js` (`pausedSince`) for the analysis-paused note.
- Risk: `lib/riskTiers.js` (score to tier), `ui/TierChip.jsx`, `ui/risk/`; colors from `styles/tokens.js`.
- Colors, type scale, radii, spacing: `styles/tokens.css`. Use `var(--token)`; JS and canvas read `styles/tokens.js`.
- The backend door: `api/restProxy.js` (every fetch of our data, the Firebase token via `setAuthProvider`, a cap of 4 requests in flight, identical concurrent calls collapsed). Endpoints come from `window.*_ENDPOINT` set in `config.js`.
- Error sink: `api/errorSink.js` (`installErrorSink`, `reportBoundaryError`, `reportFetchError`). It posts to `window.CLIENT_ERRORS_ENDPOINT` (the `newsClientErrors` Lambda); read the log with `node scripts/errors.mjs`.
- LLM providers: `lib/llmProviders.js` (pure data for `analysis-studio/lib/llm.js` and the eval harness; no page uses it).
- Economy switch: `lib/economyFlag.js` (`ECONOMY_PARKED`).

## Rules
- Shared never imports `features/` or `app/` (eslint and `quality/check_feature_cycles.mjs`).
- Reuse the shared block; never re-style one locally. A new block used by two features goes here.
- Fail empty and honest: no placeholder text, no guessed dates; report the failure to the error sink.
- Public data hooks never gate on sign-in; membership limits are enforced by the server.
- Ratchets (run by the pre-commit hook; each count may only go down, baselines in `quality/*_baseline.json`):
  - `quality/check_links.mjs` - hand-typed route strings outside `links.js`
  - `quality/check_color_literals.mjs` - hard-coded colors outside the token files
  - `quality/check_style_px.mjs` - raw px font sizes, radii and spacing where tokens exist
  - `quality/check_shared_blocks.mjs` - local copies of the tier chip, tab switch and section header

## How to check it
- Everything: `cd global-perspectives-starter/frontend && npm run verify`
- Ratchets and import rules (repo root): `for c in quality/check_*.mjs; do node $c; done`
- Frontend/backend copies in sync (repo root): `node scripts/check-shared-sync.mjs`
- Shared tests: `cd global-perspectives-starter/frontend && npx vitest run src/shared`

Last verified: 2026-10-20
