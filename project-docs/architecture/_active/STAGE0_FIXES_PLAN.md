<!--
Executable plan for Stage 0 fixes. Source: PAGE_REVIEW_2026-09-24.md §4 (prioritized list) +
PAGE_STRUCTURE_PROPOSAL_2026-09-24.md §6 (Stage 0) + §8 (monitor adjudication). Operator
approved the fix-first list 2026-09-24. Task file (with the live tracker) is
TASK_2026-09-24_stage0_fixes.md next to this plan — update both together.
-->

# Stage 0 fixes — executable plan (2026-09-24)

## 0. Ground rules

- All frontend paths below are **current** (verified 2026-09-24 against the post-restructure
  tree: `global-perspectives-starter/frontend/src/{app,shared,features/<name>}`, per
  `TASK_2026-09-24_frontend_feature_folders.md`). Re-verify a path with `Read`/`Grep` before
  editing if this plan is executed more than a few days after being written — the tree moves.
- One commit per item, except tightly-coupled pairs called out below. Every commit: code +
  `CHANGES.md` entry + doc updates in the same commit (per root `CLAUDE.md` docs-as-code rule).
- **No deploy happens mid-plan.** Frontend changes accumulate on `main` un-deployed; one batched
  `./deploy.sh` run happens at the end, gated on a fresh explicit "yes" (per root `CLAUDE.md`
  deploy gate). The Worker change (item a) is a **separate**, more sensitive gate — production
  infra outside this repo's deploy script — and needs its own explicit "yes", independent of the
  frontend deploy.
- Verify ladder for every frontend commit: `cd global-perspectives-starter/frontend && npm run
  verify` (eslint + vitest, expect 184/184 passing, 0 lint errors) → `bash quality/verify_pages.sh`
  (expect 32/0) → `node scripts/auth-guard-check.mjs` if the commit touches auth-adjacent hooks →
  build + compare main-chunk size for anything touching `App.jsx`/imports → the item's own
  browser checklist (below) clicked through in a real browser, per
  `feedback_test_ui_in_browser` — build-passes is not feature-works.
- **Contradiction found while verifying scope (report this to the operator):** item (i) is
  **already partially fixed in the current code.** `src/features/daily/hooks/useDailyBrief.js`
  already falls back up to 7 days and returns `servedDateKey` (the real served date, not the
  requested one); `DailyPage.jsx` already shows an honest "Today's brief publishes at the end of
  the day — showing `<real date>`" note when `isToday && servedIsOlderThanRequest`. What is
  **not** fixed: `prevDateKey`/`nextDateKey` (`DailyPage.jsx` lines ~32-52) do naive `±1` calendar
  day with no awareness of which days actually have a brief, so the date arrows can walk into a
  run of empty days one click at a time, and the empty-state branch (lines ~222-236) only offers
  "← Previous day" (naive ±1) or (if not today) "Today's brief" — no forward path out of a gap.
  Scope for (i) is therefore narrower than the review implies: fix the arrows/empty-state to skip
  to the actual nearest available date, not build the fallback (it exists).

---

## (a) SEO 404 / bot pre-render / sitemap — Worker + static file

**Goal:** every real route returns HTTP 200 to browsers and crawlers (not just `/` today); the
`/daily` bot pre-render (which already has 7-day fallback logic) actually fires for the URL shapes
crawlers hit; `sitemap.xml` lists only real, live routes.

**Root cause (confirmed by reading the deployed Worker source,
`project-docs/distribution/WORKER_FULL_CODE.md`):** the Worker's `fetch` handler only intercepts
three cases — `/data/*`, `/rss`, and (for bot user agents only) `/`, `/weekly/thread/:id`,
`/weekly/country/:name`, `/daily(/:dateKey)`. The final line is `return fetch(request)` — **every
other path, for every visitor (human or bot), passes straight through to GitHub Pages.** GitHub
Pages has no route awareness; for any path other than a file that exists, it serves `docs/404.html`
**with HTTP status 404** (GitHub Pages behavior — the SPA-fallback trick makes the *content*
correct for humans via client-side routing after the 404 page's JS loads, but the *status code* a
crawler reads before executing JS is still 404). That is the X-3 bug: SEO-wise, every route except
`/` and the three bot-prerendered ones is invisible.

**Files:**
- `project-docs/distribution/WORKER_FULL_CODE.md` — canonical Worker source (edit here first,
  this is what actually gets pasted into the Cloudflare dashboard / `wrangler deploy`).
- `docs/sitemap.xml` — hand-maintained, **not** part of the Vite build (no `public/sitemap.xml`
  source, no generator script) — editable directly, independent of `./deploy.sh`.
- Read-only reference for the route list: `global-perspectives-starter/frontend/src/app/App.jsx`
  lines ~99-127 (`<Routes>`).

**Approach:**
1. **General SPA-aware fallback for non-bot-prerendered, non-bot, non-asset requests.** Add a
   final branch in the Worker's `fetch` handler, after the existing bot-pre-render block, before
   the `return fetch(request)` passthrough: for any request whose path doesn't look like a static
   asset (no `.` in the last path segment — matches the SPA-route convention already implicit in
   `docs/404.html`'s existence) and isn't already handled above, fetch `docs/index.html` from
   GitHub Pages and return it with **status 200** (not 404) and the same `Content-Type: text/html`.
   This covers every current and future client route (`/economy`, `/analyze`, `/membership`,
   `/track-record`, `/weekly-brief`, `/weekly-markets`, `/breaking`, `/breaking/:id`, `/weekly`,
   `/weekly/countries`, `/signin`, `/account`, `/whitepaper`, `/spider-demo`, etc.) without
   enumerating them, and survives future route additions. Keep a genuine 404 for anything that
   really doesn't exist within the SPA (the client router's own `*` → `NotFound` route already
   handles that once the shell loads) — this fallback isn't "fake 200 everywhpere," it's "let the
   SPA shell decide," matching what `docs/404.html` already does for humans today; the fix is
   purely the **status code**.
   - Verify this doesn't regress the `/data/*`, `/rss`, or existing bot-prerender branches — they
     stay first in the handler and return before this new branch is reached.
2. **Fix the `/daily` bot pre-render "reported broken."** Re-test against prod after (1) ships:
   the existing `renderDailyPage()` already has 7-day fallback logic (`WORKER_FULL_CODE.md` lines
   ~213-261) mirroring the client's `useDailyBrief`. If it's still failing after (1), the likely
   cause is the daily brief pipeline being empty for >7 days (operator-side, DeepSeek outage per
   `MEMORY.md`) rather than the Worker code — confirm which before changing Worker logic further;
   don't widen the lookback window speculatively.
3. **Regenerate `docs/sitemap.xml`:** drop `<url>` entries for `/pricing` and `/cli` (no such
   routes in `App.jsx`); add `<url>` entries for every real route currently missing:
   `/economy`, `/analyze`, `/membership`, `/track-record`, `/weekly-brief`, `/weekly-markets`,
   `/breaking`, `/daily`. Leave `/blog/*` entries alone (external content, out of scope) unless a
   quick check shows those pages 404 too — if so, flag to the operator rather than silently
   deleting (unknown whether `/blog` is served elsewhere).

**Verification:**
- `curl -sI https://globalperspective.net/<route>` for every route in `App.jsx`'s `<Routes>`,
  both with a default UA and `-A "Mozilla/5.0 (compatible; Googlebot/2.1)"` — expect `200` for
  all, `404` only for a genuinely bogus path (e.g. `/does-not-exist`).
- Re-run the three existing bot-prerender checks (`curl -A googlebot` on `/`,
  `/weekly/country/<real-name>`, `/weekly/thread/<real-id>`) — confirm `x-rendered-by:
  cf-worker-bot` still present, unregressed by the new fallback branch.
- `curl -A googlebot https://globalperspective.net/daily` and a specific recent `/daily/:dateKey`
  — confirm real brief HTML (not empty/generic), or confirm+report if the pipeline itself is the
  blocker (see step 2).
- Validate `docs/sitemap.xml` is well-formed XML (`xmllint --noout docs/sitemap.xml` or equivalent)
  and every `<loc>` 200s per the curl sweep above.
- `scripts/link-crawl.mjs` if available (referenced in the review's methodology) as a second check.

**Risk:** **High relative to other Stage-0 items** — this is a change to production edge infra
(`globalperspective-rss` Worker) that fronts 100% of site traffic, not just frontend code behind
the normal deploy gate. A bug in the new fallback branch could break the `/data/*` route (map data)
or the bot-prerender routes (social/AI-crawler previews) if branch ordering is wrong. **Operator-
gated: do not deploy the Worker without a fresh explicit "yes"**, separate from the frontend deploy
gate. Test the new Worker code path-by-path (curl matrix above) before considering it done, and
keep the previous Worker version's code saved (it's already versioned in
`project-docs/distribution/WORKER_FULL_CODE.md`'s git history) for a fast manual rollback via the
Cloudflare dashboard if needed.

**Effort:** L (per review). Deploy: **Worker deploy, operator-gated, separate from frontend
deploy.** `docs/sitemap.xml` needs no deploy step (already in `docs/`, live on next push) but
should land in the same commit as a related doc/CHANGES.md entry.

---

## (b) Freshness honesty — two bugs

**Goal:** every "LIVE" / "Updated hourly" / "today" claim in the UI reflects real data age, and the
fabricated timestamp in `WeeklyPage.jsx` is replaced with the real one the backend already returns.

**Bug 1 — fabricated timestamp.** `src/features/threads/WeeklyPage.jsx:920-926`:
```jsx
<StatusStrip
  label="LIVE"
  ...
  updatedAt={latestDate ? `${latestDate}T12:00:00` : null}
```
`latestDate` is the archive date string; the code bolts a hard-coded `T12:00:00` onto it — this is
never the real update time, confirmed dishonest by the monitor adjudication (PAGE_STRUCTURE
_PROPOSAL §8, verified fact #2). Trace what the archive response (`fetchTodayArchive` /
`fetchArchiveRange` in `src/shared/api/restProxy.js`, action `today`/`archive_range`) actually
returns for a real `updatedAt`/timestamp field — check the Lambda response shape used elsewhere
(e.g. `Home.jsx`'s genuine `updatedAt`, per the monitor's verified-fact #2 that Home's stamp is
real) and thread that real value into `WeeklyPage.jsx` instead of synthesizing one. If the backend
response for `WeeklyPage`'s data source genuinely has no per-record timestamp, use the batch/fetch
completion time client-side (`Date.now()` at successful fetch) rather than a fabricated per-date
string — that's honest ("data as of when we last successfully loaded it"), not a fabricated stamp
tied to unrelated content.

**Bug 2 — `StatusStrip` always renders `label="LIVE"` regardless of age.**
`src/shared/ui/StatusStrip.jsx:18` defaults `label = 'LIVE'` and every caller
(`Home.jsx:357`, `ThreadPage.jsx:462`, `WeeklyPage.jsx:920`, `CountryPage.jsx:620`,
`CountryListPage.jsx:360`) either passes `"LIVE"` explicitly or relies on the default — there is no
age check anywhere in the component. Add an age threshold (configurable constant, default suggest
N=6h per typical pipeline cadence — confirm against `ARCHITECTURE.md`'s cron chain, e.g. daily
06:30-10:00 UTC stages, before hard-coding) so `StatusStrip` shows `"LIVE"` only when
`Date.now() - updatedAt` is under the threshold, else falls back to a neutral label (e.g. drop the
`LIVE` chip entirely and just show `"Last updated Xh/Xd ago"` — `timeAgo()` already computes this).
Also fix the static "Updated hourly" strip in `src/app/layout/Layout.jsx:183-197` (per proposal §6
Stage 0 item 2: "remove the static 'LIVE · Updated hourly' strip") — same treatment, data-derived
or removed if no reliable global freshness signal exists yet.

**"Today" copy audit (grep sweep, not a single file):** search for and individually judge each hit
of `"today"`, `"tracked today"`, `"Today's driver"` in copy strings (not code identifiers/route
names like `/daily` or `DailyPage`) across `src/features/home/Home.jsx` (e.g. line ~125's `sources
across ${topics.length} stories tracked today`) and `src/features/economy/` (the "today's driver"
narrative — locate via `grep -rn "today" src/features/economy --include=*.jsx`). Each hit: either
(i) it's describing same-day-generated content and is true, or (ii) it's asserting freshness the
pipeline can't currently back up (stale for days) and should switch to the same age-derived
wording as StatusStrip, or be dropped. Do not blanket-replace "today" — some usages (e.g. "stories
tracked today" as a count label, not a freshness claim) may be fine; judge each on whether it
implies same-day freshness.

**Files:**
- `global-perspectives-starter/frontend/src/features/threads/WeeklyPage.jsx` (fabricated
  timestamp, ~line 920-926)
- `global-perspectives-starter/frontend/src/shared/ui/StatusStrip.jsx` (age-aware label)
- `global-perspectives-starter/frontend/src/app/layout/Layout.jsx` (static "Updated hourly" strip,
  ~lines 183-197)
- `global-perspectives-starter/frontend/src/features/home/Home.jsx` — audit "today" copy near
  trust-strip (~line 125) and masthead
- `global-perspectives-starter/frontend/src/features/economy/EconomyPage.jsx` (or wherever "Today's
  driver" narrative lives — locate via grep, not yet confirmed exact file/line)
- `global-perspectives-starter/frontend/src/features/countries/CountryPage.jsx`,
  `CountryListPage.jsx`, `src/features/threads/ThreadPage.jsx` — other `StatusStrip` callers,
  confirm they pass a real `updatedAt` (spot-check, most likely already correct per the monitor's
  verified fact #2 that only `WeeklyPage` fabricates).
- `project-docs/architecture/ARCHITECTURE.md` — cron-chain section, to pick a defensible staleness
  threshold rather than guessing.

**Verification:**
- `npm run verify`.
- Browser: load `/weekly`, `/`, `/weekly/country/<name>`, `/weekly/thread/<id>`,
  `/weekly/countries`, `/economy` — confirm each freshness stamp matches the actual data age (cross
  -check against `ARCHITECTURE.md`'s last-run times or the raw API response's own timestamp field);
  confirm `LIVE` only appears when genuinely fresh, and stale pages show an honest "Last updated
  X ago" instead.
- Confirm `/about` and `/whitepaper` no longer claim "hourly" (per proposal §6 Stage 0 item 2)
  if they currently do — grep to confirm scope before editing (not yet independently verified in
  this plan's research pass).

**Risk:** Low-medium — presentation-layer only, no data-shape changes; the main risk is picking too
aggressive/lax a staleness threshold. Ship with the threshold as a named constant so it's a
one-line follow-up to tune.

**Effort:** M. No deploy dependency beyond the batched frontend deploy at the end.

---

## (c) Parked-credits copy

**Goal:** hide "buy credits" surfaces while `POLAR_CREDIT_PACKS` is unconfigured, without deleting
the feature — it must reactivate correctly the moment the operator configures credit packs.

**Existing pattern to reuse:** `src/shared/api/restProxy.js` already exports `creditPacks()`
(returns `window.POLAR_CREDIT_PACKS || []`), and `MembershipPage.jsx:27,139` already gates on it
— `Credit packs are coming soon.` shown when `creditPacks().length === 0`. This is the confirmed-
correct pattern (also the reason the review's original credits finding was downgraded from bug to
copy-only in the `CHANGES.md` 2026-09-24 whole-site-review entry — "prod config has no credit
packs → honest 'coming soon'"). **The gap is that three other surfaces don't apply the same gate:**
1. `src/features/analysis-studio/AnalysisStudio.jsx:345` — `Don't want to manage an API key? Buy
   credits to run it on our compute — or a membership...` — shown whenever `!serverCapable &&
   billingAvailable`, regardless of whether credit packs exist. Wrap the "Buy credits to run it on
   our compute — or" clause in `creditPacks().length > 0 ? ... : null` (keep the membership half
   of the sentence, since membership is live); reads as "A membership adds a monthly allowance..."
   alone when credits are parked.
2. `src/features/account/Account.jsx:424-434` — the whole "Analysis credits" section (balance +
   "Buy credits" button) renders unconditionally. Gate the section (or at minimum the "Buy
   credits" `<Link>` at line 433) on `creditPacks().length > 0`; if credit balance can be nonzero
   from before packs existed, keep showing the balance number but drop the buy CTA when packs are
   empty — do not hide a nonzero balance, only hide the purchase path.
3. `src/app/layout/Layout.jsx:126-137` — the header `gp-credits-pill` (`● 0 credits`) renders
   whenever `billingAvailable && user signed in`, independent of `creditPacks()`. Since credits are
   parked and balances are effectively always 0 today, gate the pill on `creditBalance > 0 ||
   isMember` (members may want the pill as a membership-status indicator even at 0 credits — judge
   against what `is-member` styling communicates) so a non-member with 0 credits and no way to buy
   more doesn't see a permanent "0 credits" pill with no path forward.

**Files:**
- `global-perspectives-starter/frontend/src/features/analysis-studio/AnalysisStudio.jsx` (~line
  345)
- `global-perspectives-starter/frontend/src/features/account/Account.jsx` (~lines 424-434)
- `global-perspectives-starter/frontend/src/app/layout/Layout.jsx` (~lines 126-137)
- Reference (no change needed, already correct): `src/features/account/MembershipPage.jsx`,
  `src/shared/api/restProxy.js` (`creditPacks()`)

**Verification:**
- `npm run verify`.
- Browser, signed in as a member and as a non-member (if both are testable): `/analyze` (confirm
  the buy-credits clause is gone, membership clause remains), `/account` (confirm the Buy-credits
  CTA is hidden, balance still shows if nonzero), header pill on every page (confirm it's gone or
  changed per the chosen gate).
- Set `window.POLAR_CREDIT_PACKS` to a non-empty array in a local/dev build and re-check all three
  surfaces show the buy-credit path again — proves the gate is reversible, not a deletion.

**Risk:** Low — copy/conditional-render only, existing `creditPacks()` helper already proven in
`MembershipPage.jsx`.

**Effort:** S.

---

## (d) Onboarding tour: mobile hamburger block + `aria-allowed-attr`

**Goal:** the first-visit `SITE_WELCOME` tour (a centered, anchor-less popover, per
`tours.js:17-28`) does not block the mobile hamburger menu, and driver.js's dummy anchor element
passes the axe-core `aria-allowed-attr` rule.

**Root cause (confirmed by reading `src/app/onboarding/tours.js`, `useOnboarding.js`,
`tour-theme.css`, and `Layout.css`):**
- `SITE_WELCOME` has one step with no `element` — driver.js v1.4.0 (`package.json:27`) renders an
  anchor-less step by creating its own internal `#driver-dummy-element` to position the popover
  against, and applies ARIA attributes to it that axe-core flags as `aria-allowed-attr` (this is a
  known driver.js v1 pattern issue, not a mistake in this repo's config) — independently confirmed
  by two review methods (axe-core sweep + `smoke-test.mjs`).
- `tour-theme.css` only themes `.driver-popover.gp-tour` (colors/spacing) — it never sets a
  `z-index` or `pointer-events` rule for driver's full-viewport overlay. `Layout.css` gives the
  mobile hamburger `z-index: 100` (line 51) inside a header bar at `z-index: 9999` (line 13);
  driver.js's own overlay/stage defaults to a high z-index that, combined with its full-screen
  `pointer-events` capture during an active tour, intercepts taps meant for the hamburger — and
  because `SITE_WELCOME` has no element to stage/highlight, there is nothing for the user to
  intuitively click through; the whole viewport is inert until they find and hit the popover's own
  Done/close button, which is easy to miss on a small screen.

**Approach:**
1. **`aria-allowed-attr`:** driver.js's dummy element is generated at runtime, not in our markup,
   so it can't be fixed by editing our JSX. Options, in order of preference: (i) check for a
   driver.js version newer than 1.4.0 that fixes this upstream (quick changelog check before
   writing a workaround); (ii) if not fixed upstream, add a small post-render patch in
   `runTour()` (`useOnboarding.js`) — after `d.drive()`, query for `#driver-dummy-element` and
   strip/correct the offending ARIA attribute(s) axe flags (get the exact attribute from the
   review's axe-core report or a local axe run before writing the patch — don't guess which
   attribute); (iii) failing both, avoid the anchor-less step entirely by giving `SITE_WELCOME` a
   real anchor (`[data-tour="nav-brand"]`, already used by `SITE_INTRO`'s first step) so driver.js
   never creates the dummy element — this changes the visual (a positioned popover instead of a
   centered modal) so treat it as the last-resort option.
2. **Mobile hamburger block:** add an explicit CSS rule (in `tour-theme.css`, scoped so it doesn't
   leak outside tours) giving the hamburger a `z-index` above driver's overlay during an active
   tour, **or** configure driver.js's `overlayColor`/interaction options to not fully block, **or**
   (most robust) explicitly exclude the hamburger from the overlay's click-capture via driver.js's
   documented stage/exclude options if v1.4.0 supports it — check the driver.js docs for an
   "allow interaction outside stage" or exclusion-selector option before hand-rolling a z-index
   hack that could just as easily break the intended "block interaction until dismissed" behavior
   of a real (non-welcome) tour step.

**Files:**
- `global-perspectives-starter/frontend/src/app/onboarding/useOnboarding.js`
- `global-perspectives-starter/frontend/src/app/onboarding/tours.js` (only if the last-resort
  anchor change is needed)
- `global-perspectives-starter/frontend/src/app/onboarding/tour-theme.css`
- `global-perspectives-starter/frontend/package.json` (only if a driver.js version bump is the
  fix)

**Verification:**
- `npm run verify`.
- Local axe-core run (or the same method the review used) against a page with the tour open —
  confirm `aria-allowed-attr` no longer fires.
- Browser, mobile viewport (or DevTools device emulation), fresh localStorage (clear
  `gp_tour_v1_*` keys) on `/` and `/economy`: load the page, confirm the welcome popover appears,
  and confirm the hamburger is tappable **either** immediately **or** after the expected/intended
  dismiss action — the fix should make the block *intentional and escapable*, not eliminate all
  overlay blocking (a tour is supposed to hold focus until dismissed; the bug is that mobile users
  couldn't find a way out, not that blocking existed at all).
- Replay via the "?" button (`startTourForPath`) to confirm on-demand tours still work normally
  post-fix.

**Risk:** Low-medium — driver.js is a third-party library; the ARIA fix in particular may need
verifying against the exact upstream behavior rather than assumed. If no clean library-level fix
exists, the safe fallback (anchor the welcome step) is a visible behavior change worth flagging to
the operator rather than silently shipping.

**Effort:** S (per review), possibly M if the ARIA fix requires the library-version path.

---

## (e) Home member-perk link → `/membership`

**Goal:** the "Members follow countries for change-alerts + the full history" sentence links to
`/membership`, not `/track-record`.

**Root cause (confirmed):** `src/features/home/Home.jsx` builds `trustStats` cards (~lines 106-
128); the corrections-count card has `to: '/track-record'` (line 117) and a `hint` string (line
121) with the member-perk sentence. The render (~lines 396-411) wraps the **entire card**
(`n` + `label` + `hint`) in a single `<Link to={c.to}>` — so the member-perk hint inherits the
card's `/track-record` destination; there is no separate link for it today.

**Approach:** restructure so the hint has its own destination. A nested `<Link>` inside a `<Link>`
is invalid HTML, so either (i) keep the card's outer link on `/track-record` for the `n`+`label`
part and render `c.hint` as a **sibling**, not a child, of the `<Link>` — with its own small
`<Link to="/membership">` (e.g. append "→" or make the whole hint sentence itself a `/membership`
link rendered outside the card's anchor), or (ii) drop the card-level anchor and make `n`+`label`
and the hint two independently-clickable regions with `role`/`tabIndex` handling — prefer (i), it's
the smaller change and matches the pattern already used in `AnalysisStudio.jsx:345-347` (plain
text with an inline `<button>`/`<Link>` for the CTA half of a sentence).

**Files:**
- `global-perspectives-starter/frontend/src/features/home/Home.jsx` (data at ~line 121, render at
  ~lines 396-411)
- `global-perspectives-starter/frontend/src/features/home/Home.css` (or wherever
  `.home-trust-card`/`.home-trust-hint` styles live — confirm exact file before editing; not yet
  located in this plan's research pass) — likely needs a small style tweak for the hint's own link
  affordance (underline/color) now that it's independently clickable.

**Verification:**
- `npm run verify`.
- Browser: `/`, confirm the corrections trust-card's number+label still goes to `/track-record`
  and the member-perk sentence goes to `/membership`; confirm no nested-anchor console warning.

**Risk:** Low — small, isolated JSX/CSS change.

**Effort:** S.

---

## (f) De-dupe in-flight proxy requests

**Goal:** identical concurrent `proxyAction()` calls (same `action`+`payload`) collapse into one
network request instead of firing up to 9× per page load, cutting duplicate transfer and pressure
on the existing 4-slot concurrency limiter.

**Root cause:** `src/shared/api/restProxy.js`'s `limitedProxyFetch()`/`runLimited()` queues and
caps concurrency but does **not** dedupe — two callers requesting the same `action`+`payload`
simultaneously (e.g. `useGeminiTopics` mounted independently by `Home.jsx`, `AnalysisStudio.jsx`,
and `src/shared/ui/IntelligenceLoader.jsx`, per `grep -rln useGeminiTopics src`) each get their own
`fetch`.

**Approach:** add an in-flight request map keyed by a stable serialization of `action`+`payload`
(e.g. `JSON.stringify([action, payload])` — payload shapes here are simple plain objects/arrays of
strings, no functions/circular refs, so `JSON.stringify` is a safe key) inside
`limitedProxyFetch()` (or one layer up, in `proxyAction`/`proxyActionWithAuth`, since those are the
common call points): if a request with the same key is already in flight, return the same pending
`Promise` instead of starting a new `fetch`; clear the map entry when the promise settles
(success or failure) so the *next* call after completion re-fetches (this is de-dupe, not a
cache — per the item's own framing, "+ short cache if appropriate" is optional; add a short
(e.g. 5-10s) TTL cache only if a quick check shows genuinely-simultaneous-but-not-identical-tick
calls still slip through de-dupe due to timing, otherwise skip it to keep the change minimal).
Apply to both `proxyAction` (public, unauthenticated calls) and `proxyActionWithAuth` (needs the
auth token in the key too, or scope the dedupe map per-auth-state, since two different users'
identical-shaped requests must not share a response).

**Files:**
- `global-perspectives-starter/frontend/src/shared/api/restProxy.js`
- Read-only reference: `src/features/home/Home.jsx`, `src/features/analysis-studio/
  AnalysisStudio.jsx`, `src/shared/ui/IntelligenceLoader.jsx`, `src/shared/data/
  useGeminiTopics.js` (confirm all four call the same underlying action/payload shape before
  assuming de-dupe alone fixes it — if `useGeminiTopics` is called with different payloads per
  caller, de-dupe won't collapse them and the fix needs to move up to hoisting the hook into a
  shared provider/context instead, per the review's stated alternative).

**Verification:**
- `npm run verify`.
- Browser DevTools Network tab on `/`, `/economy`, `/weekly/country/:name` (the three pages the
  review names): count `POST` requests to the proxy endpoint with identical bodies before and
  after — confirm the duplicate count drops (review cites "up to 9×" as the current worst case).
- Confirm no regressions: a genuinely new request (different payload, or after the prior one
  settled) still fires normally; two different signed-in users (or signed-in vs anon) don't share
  a de-duped response for an authed action.

**Risk:** Low-medium — shared client-side infrastructure touching every page; the main risk is a
subtle auth-scoping bug (returning one user's cached in-flight response to another). Scope the
in-flight key to include the auth token (or a hash of it) for `proxyActionWithAuth` specifically to
avoid this.

**Effort:** S/M.

---

## (g) Route-level code splitting

**Goal:** convert `App.jsx`'s static route imports to `React.lazy` + `Suspense`, and fix
`CountryPage.jsx`'s static `WeeklyMap` import so `WeeklyPage`'s existing `lazy()` split actually
takes effect; measure the main bundle size before/after.

**Root cause (confirmed):** `App.jsx` statically imports 20 page components (lines 6-32) — none
lazy. Separately, `WeeklyPage.jsx:18` already correctly does
`const WeeklyMap = lazy(() => import('@/features/threads/components/WeeklyMap'))`, but
`CountryPage.jsx:20` does a **static** `import WeeklyMap from
'@/features/threads/components/WeeklyMap'` — since both files are reachable from the same bundle
graph and `CountryPage` pulls `WeeklyMap` in eagerly, bundlers resolve the shared module into the
main chunk regardless of `WeeklyPage`'s lazy wrapper, defeating that split. The working template
already exists: `SituationHome.jsx:9` does
`const SituationMap3D = lazy(() => import('@/features/map/components/SituationMap3D.jsx'))`
correctly, with no other eager importer of that same module — confirmed as the pattern to copy.

**Approach:**
1. **`CountryPage.jsx` fix (do first, it's the cheapest single win per D-2):** change line 20 to
   `const WeeklyMap = lazy(() => import('@/features/threads/components/WeeklyMap'))`, wrap its
   usage (line ~608) in `<Suspense>` with a reasonable fallback (spinner/skeleton — check what
   `WeeklyPage.jsx` uses around its own `<Suspense>` for `WeeklyMap` and match it for consistency).
2. **`App.jsx` route splitting:** convert each of the 20 static page imports (lines 6-32) to
   `React.lazy(() => import(...))`, wrap the `<Routes>` block in a single `<Suspense
   fallback={...}>` (or per-route if different fallbacks are wanted — prefer one shared fallback
   for simplicity unless a page needs special handling). Keep `Layout`, `ErrorProvider`,
   `ErrorBoundary`, `ErrorModal`, `AuthProvider` eager (they're shell chrome needed on every
   route, not page content). **Decide `/` (Home) eager-vs-lazy with evidence, not by default:**
   Home is the most-linked URL (per the Worker's `renderRootPage()` static bot copy) and likely the
   most common first paint — measure whether lazy-loading it meaningfully changes the main-chunk
   size before deciding; if Home's own code is small relative to its dependencies (already mostly
   lazy-loaded elsewhere, e.g. `useGeminiTopics`), eager may cost little and avoids an extra
   waterfall on the highest-traffic route. Record the decision and the measurement it was based on
   in this file's outcome notes when executed.
3. Leave `SpiderDemo`, `Boom` (`/__boom`) as candidates for lazy too (low-traffic/debug routes),
   but low priority relative to the main pages.

**Files:**
- `global-perspectives-starter/frontend/src/app/App.jsx`
- `global-perspectives-starter/frontend/src/features/countries/CountryPage.jsx` (line ~20, ~608)
- Reference (no change): `src/features/threads/WeeklyPage.jsx` (existing correct lazy pattern to
  match for `Suspense` fallback styling), `src/features/map/SituationHome.jsx` (existing correct
  pattern for `App.jsx`'s conversions).

**Verification:**
- `npm run verify`.
- `npm run build` before and after — capture the main chunk size both times (the restructure
  task's precedent baseline is 1,046.07 kB main / 295.60 kB CSS; expect the main chunk to shrink
  meaningfully once routes split, with new small per-route chunks appearing) and record both
  numbers in this plan's outcome / the task file's tracker.
- Browser: click through every route in `App.jsx` (at minimum: `/`, `/map`, `/economy`, `/analyze`,
  `/membership`, `/track-record`, `/weekly-brief`, `/weekly-markets`, `/breaking`,
  `/breaking/:id`, `/weekly`, `/weekly/thread/:id`, `/weekly/countries`,
  `/weekly/country/:name`, `/signin`, `/account`, `/whitepaper`, `/daily`, `/daily/:dateKey`,
  `/about`, `/privacy`, `/contact`, `/disclosures`) — confirm each renders (with a visible but
  brief loading state, not a blank flash) and the browser console stays clean. Specifically
  re-confirm `/weekly/country/:name`'s embedded map (the `WeeklyMap` fix target) still renders.

**Risk:** Medium — touches the app's top-level routing for every page; a `Suspense` boundary
misconfigured (e.g. wrapping too little) can cause a visible blank flash or an uncaught loading
state. Do this as its own commit, separate from other Stage-0 items, so a regression is easy to
bisect.

**Effort:** M.

---

## (h) Missing `document.title`

**Goal:** the ~8 pages the review names get a real, page-specific `document.title` — confirmed by
grep to have **zero** `document.title` occurrences today: `EconomyPage.jsx`,
`TrackRecordPage.jsx`, `AnalysisStudio.jsx`, `MembershipPage.jsx`, `BreakingFeedPage.jsx`,
`WeeklyBriefPage.jsx`, `Account.jsx`, `WhitepaperPage.jsx` (all under their respective
`src/features/<name>/` directories). Confirmed the review's file list matches current code exactly
— no scope drift here.

**Approach:** add a `useEffect(() => { document.title = '<Page Name> | Global Perspectives'; },
[...deps])` to each, matching the existing pattern already used correctly elsewhere (e.g.
`DailyPage.jsx:214-217` sets `document.title` from `brief?.displayDate`). For pages with dynamic
content worth reflecting in the title (e.g. `TrackRecordPage` could include the Brier score;
`BreakingFeedPage` could reflect an alert count), keep it simple for Stage 0 — a static, correct
title per page is the fix; dynamic titles are a nice-to-have, not required to close this item.

**Files (all under `global-perspectives-starter/frontend/src/features/`):**
- `economy/EconomyPage.jsx`
- `track-record/TrackRecordPage.jsx`
- `analysis-studio/AnalysisStudio.jsx`
- `account/MembershipPage.jsx`
- `breaking/BreakingFeedPage.jsx`
- `weekly-brief/WeeklyBriefPage.jsx`
- `account/Account.jsx`
- `static/WhitepaperPage.jsx`

**Verification:**
- `npm run verify`.
- Browser: visit each of the 8 routes, check the browser tab title updates correctly and
  distinctly per page (not all identical, not left over from the previous page on client-side
  nav — verify by navigating between two of them in sequence, not just direct-loading each).

**Risk:** Very low — additive, isolated per file.

**Effort:** S.

---

## (i) `/daily` dead end — arrows + empty-state gap only (see §0 contradiction note)

**Goal:** date-arrow navigation and the empty state never strand the user on a day with no brief
and no visible way to reach the nearest real one.

**What's already correct (do not re-build):** `useDailyBrief.js` (7-day-back fallback,
`servedDateKey`) and `DailyPage.jsx`'s honest fallback note (lines 275-282) for the `isToday` case.

**Remaining gap:**
- `prevDateKey`/`nextDateKey` (`DailyPage.jsx` ~lines 32-52) do naive `±1` day arithmetic with no
  knowledge of which dates actually have a brief.
- The empty-state branch (~lines 222-236) only offers "← Previous day" (still naive ±1, so it can
  walk into a further empty day) and, if not `isToday`, a "Today's brief" link — no way to jump
  directly to the nearest date that actually has content when both directions are empty near the
  requested date.

**Approach:** give the arrows/empty-state access to the same "nearest available" signal
`useDailyBrief` already computes internally (the loop that tries `dateKey`, `dateKey-1`, ...,
`dateKey-7`) rather than re-deriving it. Two viable shapes: (i) have `useDailyBrief` also return
the resolved `servedDateKey` for the **adjacent** query (i.e. call it again, or extend it to
optionally probe forward too) so `DailyPage` can point "Previous"/"Next" at real dates; or (ii)
simpler — since `servedDateKey` is already the real date being shown, compute `prev`/`next` **from
`servedDateKey`** instead of the raw `dateKey` param once a brief has loaded (so arrows always
step from the last known-good date, not the possibly-empty requested one), and only fall back to
naive `dateKey ± 1` before any brief has loaded (first render). This avoids a second network
round-trip per arrow click and reuses data already fetched. For the "stuck" empty-state case
specifically (no brief found within 7 days in either direction from the request), add a message
distinguishing "still not published" (today) from "no brief was published around this date" (a
real gap) — don't imply "check back soon" for a multi-week-old dead zone.

**Files:**
- `global-perspectives-starter/frontend/src/features/daily/DailyPage.jsx`
  (`prevDateKey`/`nextDateKey`, empty-state branch, date-nav topbar)
- `global-perspectives-starter/frontend/src/features/daily/hooks/useDailyBrief.js` (only if option
  (i) above is chosen over (ii))

**Verification:**
- `npm run verify`.
- Browser: navigate to `/daily`, then to a date known to have no brief (pick one from a known
  outage window per `MEMORY.md`'s DeepSeek-outage notes) directly via URL — confirm the page shows
  the nearest real brief (or an honest gap message) rather than a plain dead end; click the arrows
  repeatedly from a date near a gap and confirm they don't require many single-day clicks through
  empty days to reach content.
- Re-confirm the existing `isToday` fallback note still works unchanged (regression check on the
  part that's already correct).

**Risk:** Low — isolated to one feature's page component + hook; the `useDailyBrief` reuse
question (i vs ii above) is the only real design decision, and (ii) avoids adding load.

**Effort:** S (narrower than the review's estimate, since the fallback itself is already built).

---

## Commit grouping

| Commit | Items | Deploy dependency |
|---|---|---|
| 1 | (a) Worker fix + sitemap | **Worker deploy — operator-gated, separate from frontend deploy** (sitemap.xml itself needs no deploy step) |
| 2 | (b) Freshness honesty (both bugs + "today" copy audit) | frontend — batched deploy at end |
| 3 | (c) Parked-credits copy | frontend — batched deploy at end |
| 4 | (d) Onboarding tour (mobile block + aria-allowed-attr) | frontend — batched deploy at end |
| 5 | (e) Home member-perk link | frontend — batched deploy at end (small enough to fold into commit 2 or 3 if convenient at execution time — call is the executor's, keep it a separate `CHANGES.md` line either way) |
| 6 | (f) restProxy de-dupe | frontend — batched deploy at end |
| 7 | (g) Route-level code splitting | frontend — batched deploy at end (own commit, not folded with anything — see Risk note) |
| 8 | (h) Missing `document.title` | frontend — batched deploy at end (small enough to fold into commit 5's PR-equivalent if convenient) |
| 9 | (i) `/daily` dead end (arrows/empty-state) | frontend — batched deploy at end |
| 10 | Frontend deploy | `./deploy.sh` — **operator-gated, one "yes" covering all of commits 2-9's accumulated changes** |

Commit 1 (Worker) can land and deploy independently of the frontend batch, and per the proposal's
own sequencing rationale should go **first** — it's infra, not app code, and every later URL/route
decision in the broader page-structure work depends on the Worker already handling arbitrary
routes correctly.

## Open items for the operator (not blocking Stage 0 execution)

1. Whether `/blog/*` entries in `docs/sitemap.xml` are still live (out of scope for this plan;
   flag during (a) if the curl sweep shows them 404ing).
2. The staleness threshold for `StatusStrip`'s LIVE/non-LIVE cutoff (item b) — this plan suggests
   ~6h as a starting point pending a look at the real cron cadence in `ARCHITECTURE.md`, but the
   operator may have a different tolerance in mind.
3. Whether the header credits pill (item c) should disappear entirely for non-members or keep
   showing as a membership-status indicator at 0 — this plan defaults to
   `creditBalance > 0 || isMember`, adjustable.
