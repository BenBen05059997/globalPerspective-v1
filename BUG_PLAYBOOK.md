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
7. **Silent empty render (mis-keyed / over-aggressive client filter)** — a data-backed,
   toggleable view (a map layer, a filtered list) renders **zero items** even though the
   data is present, because a client-side filter predicate either reads a *per-item* field
   the payload doesn't carry, or drops data that should still show. No error, no `NaN`, the
   *page* looks healthy — only the *view* is empty, so classes 4/6 and the page-level health
   checks all pass. *Seen:* `/map` **Pulse** filtered topics on a per-item `t.timestamp` the
   topics payload never carries (only a batch-level `updatedAt` exists) → every topic failed
   the predicate → no rings; `/map` **Connections** hard-dropped every pair outside the time
   window → near-empty layer.

## The four automated checks (run these)

All four are standalone scripts under `scripts/`, runnable by hand. The two Playwright
ones target production (`globalperspective.net`) by default (override with `SMOKE_BASE`),
block service workers, and judge health from the **rendered DOM**, not the HTTP status
(every SPA route returns the 200/404.html fallback, so status codes are useless for "is
this page actually broken"). The other two are a static grep (no browser) and a live-API
schema probe.

Quick map: `smoke-test.mjs` (classes 1,3,5,6,7,8) · `link-crawl.mjs` (class 1, site-wide) ·
`auth-guard-check.mjs` (class 2) · `contract-check.mjs` (class 4). The per-class
*detect/green/if-red* contracts are in **The loop contract** section below.

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
story link and asserts the full thread page renders (class 1), and a **MAP LAYER
RENDER** check that toggles `/map`'s data-backed layers and asserts each draws >0
SVG elements — Pulse `.today-ring` + Connections `.flow` (class 7). Finally a
**VISUAL PAINT** check (the *general* class-7 guard): grid-samples each route's key
content region and asserts a minimum fraction of points land on real rendered
content (text/img/svg/colored bg) vs bare background, so any region that silently
collapses to blank is caught — not just the two hard-coded map layers. It's robust
to news churn (different headlines → similar ink) and uses no baseline image, so
unlike pixel-diff visual regression it can't rot on a live-data site. Threshold
`PAINT_MIN=0.06`, calibrated against prod (healthy regions paint 19–96%; an empty
region ~0). `/weekly` opts out (`skipPaint` — its empty-state is a legit class-6
condition). Writes a screenshot per route+viewport. Exit code non-zero on any failure.

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

### 3. Auth-guard regression tripwire — `scripts/auth-guard-check.mjs`
```bash
node scripts/auth-guard-check.mjs
```
Static grep (no browser, instant). Asserts an allowlist of public-content hooks never
gains an `if (!user) return` early-bail (class 2). `useSavedItems` is deliberately *off*
the allowlist — saving genuinely needs auth. Exit non-zero if a guard crept in.

### 4. API contract-drift check — `scripts/contract-check.mjs`
```bash
node scripts/contract-check.mjs
```
Calls each key proxy action against the live backend and validates the response against
a Zod schema encoding only the fields the frontend reads (class 4). Catches a field that
was renamed/removed or changed type (e.g. a number arriving as a string → NaN% in the
UI). `zod` is a script-only devDependency, never bundled. Exit non-zero on drift.

## The bug-fighting playbook (ordered, run on demand)

Steps 1–8 are automatable into a pre-deploy run; 9 is inherently manual.

1. **Lint + build** — `cd global-perspectives-starter/frontend && npm run lint && npm run build`.
   Catches class 4 garbage at edit time. 0 errors required.
2. **Auth-guard tripwire** — `node scripts/auth-guard-check.mjs` (class 2).
3. **404 fallback parity** — after copying the build to `docs/`, `cp docs/index.html
   docs/404.html` then `diff docs/index.html docs/404.html` must be empty (class 3).
4. **Unit/integration tests** — `npm run test` (Vitest). Cover data-shaping and
   **empty-state branches** (mock "batch job hasn't run" → expect empty state, not
   blank/NaN — classes 4, 6). Exit code must be 0 (watch for unhandled rejections, not
   just failed assertions).
5. **Contract-drift check** — `node scripts/contract-check.mjs` (class 4, live API).
6. **Page health-check** — `node scripts/smoke-test.mjs` (classes 1, 3, 4, 5, 6).
7. **Link-integrity crawl** — `node scripts/link-crawl.mjs` (class 1, site-wide).
8. **Deploy**, then re-run steps 5–7 against production to confirm green.
9. **5-minute exploratory pass** — click each nav route, refresh one nested route,
   open one aged-out detail link, sign in/out once, and **toggle every layer/filter on a
   data-backed view (`/map`) with live data loaded, confirming each renders >0 items**
   (class 7). Humans catch the unscripted.

## Highest-ROI techniques for this project (why these and not others)

- **Static analysis (lint/build)** — free, instant, catches contract + guard classes
  at edit time. *Highest ROI.*
- **The two Playwright playbooks above** — our synthetic-monitoring + E2E + a11y +
  link-integrity layer. Extending them beats adding new frameworks.
- **Boundary schema validation** — validating each proxy action's response shape with
  Zod is the single best defense against class 4 (API drift). *Implemented as the
  on-demand `scripts/contract-check.mjs` (schemas live in the script, validated against
  the live backend; zod is a script-only devDependency, never bundled). A future step
  could import the same schemas into `restProxy.js` for soft runtime logging.*
- **Error monitoring (Sentry-style)** — a passive net for what slips past manual
  runs. High ROI for a no-QA team. *Implemented 2026-05-30 as a roll-your-own sink:*
  `src/services/errorSink.js` (window `error`+`unhandledrejection` → fire-and-forget
  POST) → `newsClientErrors` Lambda + Function URL → `GlobalPerspectiveClientErrors`
  DynamoDB table (counter rows keyed by `day#fingerprint`, TTL 30d). Read back with
  `node scripts/errors.mjs` (de-minifies via the private `dist/` source map). This is
  the **passive** complement to the six active contracts below: a contract only exists
  once a bug has shipped, so a novel uncaught error lands in the sink first.

Deliberately skipped: consumer-driven contract testing (Pact) — overkill for a single
internal consumer; boundary schema validation gives ~80% of the value. Canary/chaos —
no release/traffic infra to justify it. Visual regression — maintenance-heavy for one
dev; if added, limit to 2–3 stable hero routes.

## The loop contract (machine-checkable spec, one per class)

This is the part a **fix-until-green loop** consumes. Each class below is a closed
contract: a *detect* command, the *green* criterion that ends the loop for that class,
the *if-red* action, and the *scope* (what is deliberately out of bounds, so the loop
doesn't chase non-bugs). The loop runs every contract, fixes what's red, re-runs, and
stops when **all seven are green**. It is a convergence engine, not a detector — these
contracts are what tell it "broken" from "done."

Why these six and not others: every contract maps to a failure mode this repo has
**actually shipped** (commit refs are the receipts), not a hypothetical. New bug class →
add a seventh contract; don't widen an existing one past its evidence.

### 1 — Dangling references  *(receipts: ecf54e4, 74510da, b0f84bc)*
- **Detect:** `node scripts/link-crawl.mjs` then `SMOKE_STORY_CAP=100 node scripts/smoke-test.mjs`
- **Green:** crawl exits 0 (DEAD 0); every `/economy` story link renders `.tp-content-tabs`.
- **If red:** the link is built from a non-durable field. Fix at the source (use the real
  `threadId`/`scopeId`, or guard the link with a fallback). Frontend guard for live bad
  records *and* backend root fix so new ones aren't written — both, as with `/daily`.
- **Scope:** DEGRADED (aged-out-of-window thread) is surfaced, not failed. Don't "fix" it.

### 2 — Auth-guard regressions  *(receipts: 94e9b29, e3e2875, b430159)*
- **Detect:** `node scripts/auth-guard-check.mjs` (greps the public-hook allowlist).
- **Green:** these hooks contain **zero** `!user` early-returns —
  `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence`, `useDailyBrief`,
  `useGeminiTopics`, `useMarketsGlobal`, `useMarketsCountry`.
- **If red:** delete the guard. The backend for these actions is fully public (gates
  removed 2026-04-22); a `!user` return blocks anonymous + incognito visitors.
- **Scope:** `useSavedItems` *must keep* its `!user` guard — saving genuinely needs auth.
  This is a **regression tripwire on an allowlist**, not a blanket "no guards" rule.

### 3 — SPA deep-link blank  *(receipts: 32e0735, 34643b7, ed59e50)*
- **Detect:** `diff docs/index.html docs/404.html` + smoke-test deep-link-refresh leg.
- **Green:** diff is empty; refreshing every nested route renders content, not blank.
- **If red:** resync `cp docs/index.html docs/404.html` (the postbuild should already do
  this — if it drifted, the postbuild hook is the real fix). Re-check Vite `base`.
- **Scope:** document-level 404 is the *expected* GH Pages fallback — not a failure.

### 4 — API contract drift  *(receipts: b0f84bc — threadId strings + NaN% confidence)*
- **Detect:** `node scripts/contract-check.mjs` (Zod schemas per proxy action, validated
  against the live backend) + the smoke-test garbage-guard (NaN/undefined/Invalid
  Date/[object Object]) as the rendered-DOM backstop.
- **Green:** every probed action matches the fields the frontend reads (schema parses);
  no garbage tokens in any rendered route.
- **If red:** the frontend reads a field the backend renamed/removed. Align the reader to
  the live shape; never silently coerce `undefined`.
- **Scope:** validate at the proxy boundary only — don't add per-component runtime checks.

### 5 — a11y critical  *(continuous — axe gates only on `critical`)*
- **Detect:** smoke-test axe-core leg.
- **Green:** `critical` violations = 0 across all routes × {desktop, mobile}.
- **If red:** fix the unlabeled control / nested-interactive / orphaned ARIA role.
- **Scope:** `serious` + color-contrast are **non-blocking debt** — log, don't loop on them.

### 6 — Empty-state mishandling  *(batch job hasn't run → blank/garbage instead of empty state)*
- **Detect:** `npm run test` (Vitest empty-state branches) + smoke-test content-render leg.
- **Green:** mocking "batch job hasn't run" renders an explicit empty state, never blank/NaN.
- **If red:** add the empty-state branch to the component; cover it with a Vitest case.
- **Scope:** real empty data is a valid state to render — distinguish it from a fetch error.

### 7 — Silent empty render (mis-keyed / over-aggressive client filter)  *(receipts: d9b26ae, 8dd1d76 — /map Pulse, Connections, urgency-halo)*
- **Detect:** two complementary smoke-test legs. (a) **MAP LAYER RENDER** — loads `/map`,
  toggles each data-backed layer on, and asserts it draws >0 SVG elements (`.today-ring`
  for Pulse, `.flow` for Connections; topics + pairs are reliably present on prod). This
  is the *specific* guard for the two known map layers. (b) **VISUAL PAINT** — the
  *general* guard: grid-samples each route's key content region and asserts ≥`PAINT_MIN`
  (0.06) of points land on real rendered content, so ANY region collapsing to blank is
  caught even on pages with no per-item child selector to count. Robust to news churn,
  no baseline image (can't rot). Backstops: a
  static smell-grep for a client `.filter(...)`/window-cutoff/`continue` keyed on a
  **per-item** time field (`.timestamp`, `.generatedAt`, `.date`) where the payload only
  carries that field at the **envelope** level (e.g. `useGeminiTopics` topics have no
  per-item `timestamp` — only batch `updatedAt`); plus the manual layer-toggle in step 9.
- **Green:** smoke-test MAP LAYER RENDER passes (every asserted layer > 0) AND VISUAL
  PAINT passes (every sampled region paints ≥ 6%); no filter predicate references a
  per-item field absent from that action's contract.
- **If red:** fall back to the envelope-level field (Pulse: batch `updatedAt`), or stop
  hard-dropping and render the out-of-window data with a degraded treatment (Connections:
  faded + dashed + a "stale" tag) instead of silently removing it.
- **Scope:** a genuinely empty source array is a valid empty state (that's class 6) — this
  class is specifically *data present, view empty*. The smoke-test leg deliberately asserts
  **only** Pulse + Connections (data always present on prod); Economy/Editorial layers can
  legitimately be empty (no active disruptions / no elevated-signal picks) so they're not
  asserted. Adding a new asserted layer requires its backing data to be reliably non-empty.

### 8 — Render crash (uncaught component throw white-screens the app)
- **Detect:** the smoke-test **ERROR BOUNDARY** leg. It navigates to `/__boom` (a route
  whose only job is to throw during render), then asserts (a) the persistent nav/chrome
  (`.gp-nav`) is still visible — proving the crash was *contained* to the routed content
  area, not a full-tree unmount — and (b) on a base where the client-error sink endpoint
  is configured, that a report POST fired (intercepted + aborted so the test never writes
  to DynamoDB). The real boundary is the class component in `components/ErrorHandling.jsx`
  mounted around `<Routes>` in `App.jsx`; it reports via `reportBoundaryError` in
  `services/errorSink.js` (a working boundary swallows the throw, so `componentDidCatch`
  is the ONLY place a render crash reaches the sink).
- **NO FALLBACK UI — by design.** The boundary renders `null` on a caught crash; it does
  **not** show a "something went wrong" card. On an intelligence site a generic fallback
  reads as real content/state — a reader can't tell a *broken* render from an
  *intentionally-empty* one, so a friendly card is **misinformation**. The boundary's only
  two jobs are: stop one crash from white-screening the whole app, and report it. The
  crashed region simply renders nothing; nav/chrome outside the boundary survives.
- **Green:** `/__boom` keeps the nav mounted (crash contained) AND, on prod, a sink POST
  fired containing the crash message.
- **If red:** if the whole app white-screens, the boundary is not a class component
  (function components can't catch) or isn't mounted around the routes; if contained but
  not reported, `componentDidCatch` → `reportBoundaryError` → `window.CLIENT_ERRORS_ENDPOINT`
  is broken. Read captured crashes back with `node scripts/errors.mjs --days N`.

### Loop guardrails (non-negotiable, same as the standing project rules)
- **No deploy / commit / push without explicit confirmation.** The loop fixes source and
  re-runs checks; shipping is a separate, human-gated step.
- **Never** overwrite `docs/config.js`; **never** `git add -A`/`.`.
- Deploy Lambdas only via manual `aws lambda update-function-code` — never inside the loop.
- Stop and ask if a "fix" would remove a user-facing feature (layout-intent ≠ feature-list).
- **Stopping condition:** all six contracts green on a clean re-run, *or* a contract is red
  for a reason outside these scopes (then surface it, don't thrash).
