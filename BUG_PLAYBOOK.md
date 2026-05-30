# Bug-Fighting Playbook

How we find bugs *before* users do. This project has no CI gate by choice — these
are **on-demand playbooks** you run by hand (typically before/after a deploy), not
automated pipelines. Grounded in standard industry practice (testing trophy, SPA
link-integrity crawling, synthetic monitoring) but tuned for a static SPA + Lambda
backend maintained by one developer.

## The bug classes we actually keep hitting

These are the failure modes that have bitten this site. Every check below maps to one.

1. **Dangling references** — an aggregate page (e.g. `/economy`, `/daily`) links to a
   detail entity (a story-arc thread) that has aged out of a rolling data window, or
   links with a malformed id → dead-end "not found" page.
   *Seen:* `/economy` story arcs (threads older than the 30-day archive); `/daily`
   "Rising Thread" linking by **title** instead of `threadId`.
2. **Auth-guard regressions** — a leftover `if (!user) return` blocks anonymous
   visitors from fully-public content. *Seen:* `useDailyBrief`, and the
   `useWeeklyArchive` family before that.
3. **SPA deep-link blank page** — `docs/404.html` drifts from `docs/index.html`, or
   the Vite asset `base` is wrong, so a nested-route refresh serves a stale/relative
   bundle → blank.
4. **API contract drift** — the frontend reads a field the backend renamed, removed,
   or never populated → `NaN` / `undefined` / blank render.
5. **a11y regressions** — an axe **critical** violation ships (unlabeled control,
   nested interactive, orphaned ARIA role).
6. **Empty-state mishandling** — a daily batch job (thread analysis, country intel,
   brief) hasn't run yet and the page renders blank/garbage instead of an empty state.

## The two automated checks (run these)

Both are standalone Playwright scripts under `scripts/`. They target production
(`globalperspective.net`) by default; override with `SMOKE_BASE`. They block service
workers and judge health from the **rendered DOM**, not the HTTP status (every SPA
route returns the 200/404.html fallback, so status codes are useless for "is this
page actually broken").

### 1. Page health-check — `scripts/smoke-test.mjs`
```bash
node scripts/smoke-test.mjs                 # desktop + mobile, all routes
SMOKE_VIEWPORTS=desktop node scripts/smoke-test.mjs
SMOKE_STORY_CAP=100 node scripts/smoke-test.mjs   # full /economy story-link sweep
```
For every route × {desktop, mobile}: loads + console-clean, **deep-link refresh**
(the 404.html SPA-fallback path — class 3), real-data **content render** (class 6),
network 4xx/5xx (404 on script/stylesheet = critical; document-404 is the *expected*
GH Pages fallback, **not** a failure), **axe-core a11y** (gates on `critical` only;
`serious`/color-contrast = non-blocking debt — class 5), and a **garbage-content
guard** (NaN/undefined/Invalid Date/[object Object] — class 4). Also runs an
**ECONOMY STORY-LINK INTEGRITY** check that opens every `/economy` disruption's
story link and asserts the full thread page renders (class 1). Writes a screenshot
per route+viewport. Exit code non-zero on any failure.

### 2. Site-wide link-integrity crawl — `scripts/link-crawl.mjs`
```bash
node scripts/link-crawl.mjs
```
This is the **generalized defense against class 1**. It loads every *hub* page
(`/`, `/economy`, `/weekly`, `/weekly/countries`, `/daily`, `/map`, + static pages),
collects **every internal link they render today**, then visits each unique
destination and classifies it from the DOM:
- **HEALTHY** — root mounted, real content, none of the dead/empty patterns.
- **DEGRADED** — renders but primary content unavailable (e.g. a thread aged past the
  90-day window → analysis-only fallback). Surfaced, not failed.
- **DEAD** — our own "Page not found / Story arc not found / No brief available /
  Something went wrong" empty-state rendered, or a blank/near-empty body, or a nav
  error. Exit code non-zero.

This is what catches a dangling reference on *any* page, not just the one route the
smoke-test happens to sample. **It is how we found the `/daily` Rising-Thread bug.**

## The bug-fighting playbook (ordered, run on demand)

Steps 1–6 are automatable into a pre-deploy run; 7 is inherently manual.

1. **Lint + build** — `cd global-perspectives-starter/frontend && npm run lint && npm run build`.
   Catches class 4 (and the `if (!user) return` class 2 if you grep for it). 0 errors required.
2. **404 fallback parity** — after copying the build to `docs/`, `cp docs/index.html
   docs/404.html` then `diff docs/index.html docs/404.html` must be empty (class 3).
3. **Unit/integration tests** — `npm run test` (Vitest). Cover data-shaping and
   **empty-state branches** (mock "batch job hasn't run" → expect empty state, not
   blank/NaN — classes 4, 6).
4. **Page health-check** — `node scripts/smoke-test.mjs` (classes 1, 3, 4, 5, 6).
5. **Link-integrity crawl** — `node scripts/link-crawl.mjs` (class 1, site-wide).
6. **Deploy**, then re-run steps 4–5 against production to confirm green.
7. **5-minute exploratory pass** — click each nav route, refresh one nested route,
   open one aged-out detail link, sign in/out once. Humans catch the unscripted.

## Highest-ROI techniques for this project (why these and not others)

- **Static analysis (lint/build)** — free, instant, catches contract + guard classes
  at edit time. *Highest ROI.*
- **The two Playwright playbooks above** — our synthetic-monitoring + E2E + a11y +
  link-integrity layer. Extending them beats adding new frameworks.
- **Boundary schema validation** — validating each proxy action's response shape in
  `restProxy.js` (e.g. with Zod) is the single best defense against class 4 (API
  drift). *Not yet implemented — top candidate for next investment.*
- **Error monitoring (Sentry-style)** — a passive net for what slips past manual
  runs. High ROI for a no-QA team. *Not yet implemented.*

Deliberately skipped: consumer-driven contract testing (Pact) — overkill for a single
internal consumer; boundary schema validation gives ~80% of the value. Canary/chaos —
no release/traffic infra to justify it. Visual regression — maintenance-heavy for one
dev; if added, limit to 2–3 stable hero routes.
