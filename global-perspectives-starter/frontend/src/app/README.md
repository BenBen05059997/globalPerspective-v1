# app

The application shell. It owns what every page shares and nothing about any single page's content:
the route table, the layout (top bar, nav, footer), the error boundary, auth wiring and the redirects for
retired addresses. Every page itself lives in a folder under `features/`.

## What it does
- `main.jsx` (one level up) loads `index.css`, runs `bootstrapProxy.js`, installs the error sink, then renders `App`.
- `bootstrapProxy.js` reads `window.SENSITIVE_PROXY_ENDPOINT` (set by the runtime `config.js`) and calls `configureProxy`,
  so `shared/api/restProxy.js` knows the one backend door. It also adds a console test hook, `window.testProxyGeocode`.
- `App.jsx` wraps everything in `AuthProvider` and a router, then `Layout`, `ErrorBoundary`, `Suspense` and the `Routes`.
  `AuthBridge` hands Firebase's `getIdToken` to `restProxy` so gated requests carry the token.
- Lazy pages: every page except Today (`features/home`, eager) is `lazy(import(...))`, a chunk fetched on first visit.
  While a chunk loads, `RouteFallback` shows the shared `BootLoader` (full-screen sensor list on `/`, inline elsewhere).
  `removeStaticBoot()` hands off from the pre-JS boot screen in `index.html`.
- `layout/Layout.jsx` - top nav (Map, Stories, Briefings, Track record), a "?" link to the map's About, the bell from
  `features/breaking`, a Board link (signed-in non-guest users, only when `boardAvailable()`), Account or Sign in; the
  paused-analysis status line (not on `/`), the footer (About, Membership, Privacy, Disclosures, Contact; hidden on the
  desktop map console) and a phone tab bar with the four main items. `layout/AIToast.jsx` shows a toast while a generation runs.
- `errors/ErrorHandling.jsx` - `ErrorBoundary` renders nothing on a crash on purpose (no "something went wrong" card)
  and reports the crash to `shared/api/errorSink.js`. The nav and footer sit outside it and survive. `/__boom` is the
  deliberate crash used by the smoke test.
- Base path: `resolveBasename()` adds a path prefix only when `BASE_URL` is set or the host is `github.io`.

## Routes
| Address | Feature folder | Page or action |
|---|---|---|
| `/` | `map` | `SituationHome`, the map console |
| `/today` | `home` | `Home` (eager import) |
| `/weekly` | `threads` | `WeeklyPage` (`?section=countries` redirects to `/weekly/countries`) |
| `/weekly/thread/:threadId` | `threads` | `ThreadPage` |
| `/weekly/countries`, `/weekly/country/:countryName` | `countries` | `CountryListPage`, `CountryPage` |
| `/briefings` | `briefings` | `BriefingsPage` (modes read, weekly, present) |
| `/track-record`, `/track-record/text` | `track-record` | `TrackRecordPage`, `TrackRecordText` |
| `/board`, `/board/:boardId` | `board` | `BoardPage` (members' personal board) |
| `/analyze/s/:id` | `analysis-studio` | `SharedAnalysisPage` (read-only shared run) |
| `/signin`, `/auth/callback`, `/account`, `/membership` | `account` | `SignIn`, `AuthCallback`, `Account`, `MembershipPage` |
| `/about`, `/contact`, `/disclosures`, `/privacy`, `/whitepaper` | `static` | `AboutContact`, `Contact`, `Disclosures`, `PrivacyTerms`, `WhitepaperPage` |
| `/__boom` | app | deliberate render crash for the smoke test (not linked) |
| `*` | app | `NotFound` (links to the map and Stories) |

## Legacy redirects (client fallback; the Cloudflare Worker sends real 301s)
`/map` -> `/` (keeps the query, `MapRedirect.jsx`); `/daily`, `/daily/:dateKey`, `/weekly-brief` -> `/briefings` modes;
`/spider-demo` -> `/weekly?view=web`; `/breaking` -> `/`;
`/breaking/:id` -> the alert's story or `/`; `/analyze?stories=<id,...>` -> the first id's story page when it is a thread id (`thread-...`), else `/weekly/countries` (`AnalyzeRedirect`). All in `LegacyRedirects.jsx`.

## Import direction
- One way: `app` -> `features` -> `shared`. `features/` and `shared/` must not import `app/`; `shared/` must not import `features/`.
- A feature is reached through its `index.js` (`@/features/<name>`), never a file inside it. Only `app/App.jsx` deep-imports
  route pages, so each stays its own chunk.
- Enforced by `no-restricted-imports` in `global-perspectives-starter/frontend/eslint.config.js` and by
  `quality/check_feature_cycles.mjs` (fails on a feature-to-feature cycle or any shared-to-features import).

## How to check it
- Everything: `cd global-perspectives-starter/frontend && npm run verify`
- Shell tests: `cd global-perspectives-starter/frontend && npx vitest run src/app`
- Import rules: `node quality/check_feature_cycles.mjs` (from the repo root)
