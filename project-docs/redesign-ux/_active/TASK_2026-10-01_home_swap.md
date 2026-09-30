## S6 home swap: the map console becomes `/` — 2026-10-01 — done

**Goal:** `/` renders the map console (`SituationHome`) with the same full-bleed dark console behaviour, top bar, no auto-tour and page title `/map` has today; `/map` redirects to `/` (query kept); the old home (today's topics, archive, lede, subscribe card) stays reachable and unchanged at `/today`. Operator, 2026-10-01: "yes we can do the map to home page right now" (ahead of the ~7-Oct D11 gate, which the operator waived). No deploy, commit or push in this task; the monitor verifies, commits and deploys.

**Decisions:**
- **`/map` → redirect to `/`** (client `<Navigate replace>`, `search` + `hash` kept, so `?layer= ?country= ?story= ?focus=` survive). One canonical URL, one sitemap entry, no duplicate content, and every pathname check needs only `/`. Rendering the same component at both would leave two indexable copies and two states to keep in sync. GitHub Pages and the Worker send no real 301s, so this is a client redirect (the Worker already answers `/map` with the SPA shell).
- **Old home → `/today`**, indexable (it is real, different content: today's topics by region with on-demand summary / forecast / cause). Linked from the footer, the map's "About this map" drawer and the breaking page's back link.
- **Worker `/` bot pre-render stays a static positioning + directory page** (no Lambda call), which still fits a map home. Repo copy edited only: the "Today's Topics" entry now points to `/today`, and the "World Map" entry describes the home itself.
- The nav "Map" item points to `/` (`exact`), so it is active on `/` only (not on `/today`, `/weekly`, etc.).

**Reads / references:**
- `CLAUDE.md`; `REDESIGN_MASTER_PLAN.md` §3.2, §4 D11, §7 stage 7; `MAP_HOME_SITUATION_PLAN.md` (WS5, S6); `TASK_2026-09-26_map_console_local.md`; N1 in `TASK_2026-09-26_remaining_design.md`.
- `src/app/App.jsx`, `src/app/layout/Layout.jsx` + `.css`, `src/app/onboarding/useOnboarding.js` + `tours.js`, `src/features/map/SituationHome.jsx`, `src/features/home/Home.jsx`.
- `quality/verify_pages.sh`; `project-docs/distribution/WORKER_FULL_CODE.md` (`renderRootPage`); `docs/sitemap.xml`.
- Memory rules: a mockup / design is not permission to drop a feature (old home kept); `404.html == index.html` (deploy.sh does it).

**Changes (code):** (all under `global-perspectives-starter/frontend/src/` unless noted)
- `app/App.jsx`: `/` → `SituationHome`; `/today` → `Home`; `/map` → `<Navigate to={{pathname:'/', search, hash}} replace />` (`MapRedirect.jsx`); NotFound copy no longer says "today's topics". comment on the eager `Home` import updated.
- `app/layout/Layout.jsx`: nav item `{ to: '/', exact: true, label: 'Map' }`; `consoleShell` / status-strip hide / phone tab `isActive` keyed on `pathname === '/'`; tab bar uses exact for `/`; footer gets a "Today's topics" link to `/today`; comments updated.
- `app/onboarding/useOnboarding.js`: no auto-tour on `/` (and `/map`, which only redirects).
- `app/onboarding/tours.js`: the site-intro step targets `nav-/`.
- `features/map/SituationHome.jsx`: set `document.title` (the indexed home title) on mount; comments mention `/`.
- `features/map/components/MapAbout.jsx`: teasers list gets "Today's topics" → `/today`.
- `features/breaking/BreakingDetailPage.jsx`: "See on the map" → `/`; `BreakingFeedPage.jsx`: "Back to today's briefing" → `/today`.
- `app/MapRedirect.jsx` (new): the `/map` redirect. `features/home/Home.jsx` untouched.
- `app/__tests__/layout.test.jsx` (+ any test touching `/map`): Map href `/`, console shell / no-duplicate-status / phone cases run on `/`; add `/today` keeps the light shell.
- New `app/__tests__/mapRedirect.test.jsx`.
- `quality/verify_pages.sh`: guards for `/today`, `/map` redirect, nav Map → `/`, `SituationHome` at `/`, Home kept.
- `project-docs/distribution/WORKER_FULL_CODE.md`: `renderRootPage` entries (repo copy only; monitor deploys the Worker).
- `docs/sitemap.xml` (the one allowed `docs/` edit): drop `/map` (now a redirect), add `/today`, keep `/` once.

**Old home feature → new location:**
| Old home (`/`) feature | Now |
|---|---|
| Today's topics by region, on-demand Summary / Predict / Trace cause, Analyze per story, severity badges | `/today` (component unchanged) |
| Lede band (`LedeBand`) | `/today`; the console has its own deterministic lede + HUD brief |
| Breaking strip | `/today`, `/breaking`; console alert stack |
| Live status strip | `/today`; console honesty status line (top bar) |
| Trust cards (track record, corrections), Markets / Studio links | `/today`; Track record + Studio in the main nav; Studio/Track record teasers in the map's About drawer |
| Today archive sidebar, topic nav rail | `/today` |
| Subscribe card | `/today`, `/weekly-brief`, `/breaking` |
| Daily / weekly briefing links | `/briefings` (nav), map About drawer teasers |
| Story list | Stories (`/weekly`), console intel feed |

**Docs to update on completion:**
- `project-docs/architecture/ARCHITECTURE.md` routes table (`/` = SituationHome, `/today` = Home, `/map` redirect; Worker root note).
- `project-docs/redesign-ux/_active/REDESIGN_MASTER_PLAN.md` §7 (stage 7 status) and the 2026-10-01 line.
- `project-docs/redesign-ux/_active/MAP_HOME_SITUATION_PLAN.md` S6 row (done).
- `CHANGES.md` entry; `project-docs/INDEX.md` row for this task file.
- `project-docs/distribution/WORKER_FULL_CODE.md` (edited above).
- Monitor's job: the `project_map_home_situation` memory note.

**Completion checklist:**
- [x] code
- [x] docs updated (same commit)
- [x] CHANGES.md entry
- [x] verify (`npm run verify`, `bash quality/verify_pages.sh`, Playwright at 1440 + 390)
- [x] status header flipped to `done`
- [ ] no deploy: monitor verifies, commits, deploys the frontend, and deploys the Worker repo-copy change

### ▶ LIVE TRACKER
| Step | Status |
|---|---|
| 1 Task file written | done |
| 2 Routes + Layout + onboarding + links | done |
| 3 Tests + verify_pages guards | done |
| 4 Worker repo copy + sitemap | done |
| 5 `npm run verify` + `verify_pages.sh` | done |
| 6 Playwright 1440 / 390 + screenshots | done |
| 7 Docs (ARCHITECTURE, MASTER_PLAN, MAP_HOME plan, CHANGES, INDEX) | done |
