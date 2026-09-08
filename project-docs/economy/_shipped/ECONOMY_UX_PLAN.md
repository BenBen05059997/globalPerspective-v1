# /economy — UX Optimization Plan

STATUS: SHIPPED 2026-05-30 — all 3 phases built, browser-verified, copied to `docs/`
(awaiting push). Execution log at the bottom (§7). This doc inventories the
UX problems on `/economy`, proposes a fix for each, and sequences them into shippable
phases.

Scope: the `/economy` page only (`EconomyPage.jsx` + `EconomyPage.css`). The briefing
band, leaderboard, by-story bridge, and both rails. Backend/Lambda unchanged — every
fix below is frontend-only and reuses data the page already loads
(`useTopMovers`, `useDisruptionsList`, `useMarketsGlobal`).

---

## 0. Design philosophy — conform on conventions, differentiate on the linkage

Every serious markets surface (Bloomberg, TradingView, Koyfin, Trading Economics) shares
the same table-stakes vocabulary: filter chips, sortable columns, a "last updated" stamp,
skeleton loads, a mobile filter sheet. **Jakob's Law** — users spend most of their time on
*those* sites, so they expect ours to behave identically. Conforming here is not
unoriginal; it removes friction, because nobody has to relearn the basics.

So the rule for this work:
- **Table-stakes UX → copy the proven convention exactly.** Spend zero novelty budget on
  the leaderboard chrome, filters, sort, loaders, mobile sheet. Boring and familiar wins.
- **Our differentiator → spend the design budget there.** The thing no stock dashboard can
  show is the **news→economy linkage**: the deterministic "Today's driver" briefing, the
  per-instrument *"What's priced in"* synthesis, the trace-cause + closest-analog realized
  move. These should be visually *louder* than a normal dashboard would make them, while
  the leaderboard/filters recede into quiet, familiar chrome.

Net: the filtering/sort/loading/mobile work below is deliberately the *unremarkable*
version of each pattern. The originality lives in the briefing and synthesis, which this
plan intentionally does not "fix" — it protects their prominence.

## 0.5. How to read this page (the user's mental model)

`/economy` is the only major content page whose primary job is **lookup-first**: a
reader arrives with a question ("what's repricing oil today?") rather than wanting to
be narrated to. The UX must therefore optimize for **scan → filter → drill → share**,
not for a guided story. Every problem below is graded against that loop.

The page has three zones:
- **Left rail** — filters (Severity / Horizon / Country). Now drag-resizable + searchable.
- **Center** — the briefing band, the instrument leaderboard ("Repricing today"), the
  dormant drawer, and the by-story "Active disruptions" bridge.
- **Right rail** — live Market Context (drag-resizable).

---

## 1. Problem inventory

Each problem is graded **Impact** (how often / how badly it hurts the scan→filter→drill→share
loop) and **Effort** (rough build cost).

### P1 — Filter state is invisible and unshareable  ·  Impact: HIGH  ·  Effort: MED
The filter set (`severity`, `horizon`, `instrument`, `country`) lives only in React
`useState` (`EconomyPage.jsx:267-273`). Consequences from the user's seat:
- Refresh or deep-link → the view resets to "everything." A user who filtered to
  `BRENT` can't bookmark or share that view.
- The browser back button doesn't undo a filter — it leaves the page entirely.
- No way to land another user directly on a useful slice (e.g. a Slack link to
  "Iran-cited disruptions").

**Fix:** sync the filter state to URL query params (`/economy?instrument=BRENT&country=Iran&sev=severe`).
Read params on mount to seed `filters`; write them (via `useSearchParams`, replace-mode)
whenever filters change. This makes every filtered view a real, shareable address and
makes back/forward behave.

### P2 — No feedback loop when a filter is active  ·  Impact: HIGH  ·  Effort: LOW
Clicking an instrument name (`EconomyPage.jsx:623-629`, `setSingle('instrument', …)`)
silently filters the **by-story bridge** below — but:
- "Clear filters" only exists at the bottom of the **left rail** (`:560-564`), often
  below the fold; the user who filtered from a leaderboard row never sees it.
- There is no single place that says "you are looking at a filtered subset," so a
  shrunken story list reads as "there's barely any news" rather than "you filtered."

**Fix:** an **active-filter chip bar** pinned at the top of the center column (above the
leaderboard header). Renders one dismissible chip per active filter
(`Instrument: BRENT ✕`, `Country: Iran ✕`, `Severity: Severe ✕`) plus a "Clear all".
Each ✕ clears just that facet. This closes the loop where the user's attention already is.

### P3 — Leaderboard isn't sortable  ·  Impact: MED-HIGH  ·  Effort: MED
The leaderboard renders `topMovers` in server order (citation count desc). The column
labels (`EconomyPage.jsx:592-601`) are static `aria-hidden` text. A lookup-first user
frequently wants a different lens:
- "biggest realized mover today" → sort by `series[id].change`
- "where is consensus strongest" → sort by `consensusStrength`
- "most contested" → sort by direction split (mixed share)

**Fix:** make the column headers (Instrument / Chg / Stories) clickable sort toggles
with an asc/desc caret; default stays citations-desc. Pure client-side `useMemo` sort
over the existing rows — no new data. Sort key can ride in the URL too (P1 synergy).

### P4 — Two click targets per row are undiscoverable  ·  Impact: MED  ·  Effort: LOW
Each leaderboard row has two behaviors: clicking the **name** filters the story list;
clicking **anywhere else** expands the drawer (`:622-645`). There's a `title` tooltip on
the name, but nothing visible distinguishes the two zones, so users learn it by accident
(or filter when they meant to expand, and vice-versa).

**Fix:** give the name button a visible affordance — a small funnel/filter glyph that
appears on row hover, plus a hover background on just the name cell — so "this part
filters, the rest opens" is legible without reading a tooltip. (Low risk; pure CSS +
one icon.)

### P5 — Text-only loading states feel slow  ·  Impact: MED  ·  Effort: LOW
"Loading repriced instruments…" / "Loading active disruptions…" (`:580-582`, `:693-695`)
are plain text. On a cold visit (no localStorage cache) the page looks empty then snaps
to full. Skeleton rows that match the final row geometry make the wait feel shorter and
prevent layout shift.

**Fix:** replace the text loaders with 6–8 shimmer skeleton rows sized to `.ep-row-l1`,
and a couple of skeleton blocks in the right rail. Pure presentational.

### P6 — Data freshness is too quiet  ·  Impact: MED  ·  Effort: LOW
The page's honesty contract leans on `asOf`, but it currently surfaces only as a small
timestamp in the right-rail header (`marketsTime`, `:455`, `:706`). The leaderboard
prices and change pills carry no visible age. A user can't tell at a glance whether
they're looking at live or hours-old data.

**Fix:** a freshness pill near the "Repricing today" header — "Markets as of 14:30 ·
2h ago" — computed from `marketsAsOf`, turning amber past a staleness threshold (e.g.
> 3h). Reinforces the contract instead of hiding it. (No fabricated data; purely labels
the timestamp we already have.)

### P7 — Mobile: filters bury the content  ·  Impact: MED (mobile)  ·  Effort: MED
At ≤1024px the shell collapses to one column and the rails go `position: static`
(`EconomyPage.css:848-851`). The filters rail then renders as a tall block **above** the
leaderboard, so a phone user scrolls past all of Severity/Horizon/Country (now a longer,
searchable list!) before reaching a single instrument.

**Fix:** on mobile, collapse the left rail into a single "Filters" disclosure
(`<details>`-style, closed by default) showing an active-count badge ("Filters · 2").
Desktop layout untouched. Note: the drag handle should be hidden on mobile (resize is
meaningless in single-column) — verify the `--ep-lrail-w` var is overridden, which it
already is by the `grid-template-columns: 1fr` media query.

### P8 — Keyboard / screen-reader gaps  ·  Impact: MED (a11y)  ·  Effort: MED
Several interactive elements aren't real controls:
- Country facets are `<label onClick>` (`:550-554`) — not focusable/operable by keyboard.
- The row expand toggle is a `<div onClick>` (`:622`) — not a button, no `aria-expanded`.
- The dormant drawer trigger is a `<span onClick>` (`EconomyPage.jsx:669`).

**Fix:** convert these to `<button>`s (or add `role`/`tabIndex`/`onKeyDown` + `aria-expanded`
where a button would break layout). Keyboard users can then filter, expand, and toggle.
Improves SEO/accessibility audits too.

### P9 — No deep-link into a specific instrument drawer  ·  Impact: LOW-MED  ·  Effort: LOW
`openMover` (which row is expanded) is local state. You can't link someone to
"the BRENT analysis open." The briefing band links out to a thread, but can't point back
into the leaderboard.

**Fix:** fold `openMover` into the URL (`?open=BRENT`) alongside P1. Lets the briefing
(and future surfaces) deep-link to an expanded instrument. Cheap once P1's URL plumbing
exists.

### P10 — Long leaderboard has no quick return  ·  Impact: LOW  ·  Effort: LOW
With 20 movers + expanded drawers + the by-story bridge, the center column gets long.
There's no "back to top" / sticky sub-nav once the user scrolls deep into a drawer.

**Fix (optional):** a small floating "↑ top" button after the user scrolls past ~1.5
viewports. Low priority; revisit only if the page tests as too long.

---

## 2. Cross-cutting theme

P1, P2, P3, P9 are one story: **make filtering legible, reversible, and shareable.**
They share the URL-state plumbing, so building P1 first makes P2/P3/P9 cheap. That
cluster removes the most real friction for the lookup-first user and should lead.

P5, P6 are **perceived-quality** polish (fast + trustworthy). P4 is discoverability.
P7, P8 are **reach** (mobile + a11y) — important but lower frequency for the current
desktop-leaning audience (per `reference_observability_usage` /economy is the #2 page
but overall traffic is low).

---

## 3. Proposed phasing

**Phase 1 — Filtering legibility (the headline win)**
- P1 URL-synced filters (`useSearchParams`, seed-on-mount, replace-on-change).
- P2 active-filter chip bar at top of center column.
- P3 sortable leaderboard headers (sort key in URL).
- P9 `?open=` deep-link (free rider on P1).
Acceptance: deep-link `/economy?instrument=BRENT&sort=chg&open=BRENT` reproduces the
exact view; back button undoes one filter at a time; chips clear individual facets.

**Phase 2 — Perceived quality**
- P5 skeleton loaders.
- P6 freshness pill (amber when stale).
- P4 name-cell filter affordance.
Acceptance: cold load shows skeletons (no layout shift); stale data visibly flagged;
hovering a row makes the filter vs expand zones obvious.

**Phase 3 — Reach**
- P7 mobile filters drawer.
- P8 keyboard/a11y conversions.
Acceptance: phone user reaches the first instrument without scrolling through all
filters; every interactive element is keyboard-operable with correct `aria-expanded`.

**Optional / defer**
- P10 back-to-top, pending a "page feels too long" signal.

---

## 4. Constraints & non-negotiables (carry-over from this page's contract)

- **No new endpoints, no new fetches.** Everything above reuses already-loaded data.
- **Honesty contract intact.** P6 only *labels* the existing `asOf`; it must never imply
  freshness the data doesn't have. No fabricated numbers anywhere.
- **Deploy workflow.** Each phase: `npm run build` → copy `dist/assets` + `index.html`
  into `docs/` → never touch `docs/config.js` → browser-verify (Playwright, real
  interactions) → update `CHANGES.md` → commit src+docs → push only when asked.
- **Don't silently drop features** (per `feedback_no_unauthorized_removal`): every fix
  is additive or a like-for-like upgrade of an existing control.
- **Browser-verify before claiming done** (per `feedback_test_ui_in_browser`): build
  passing ≠ feature working.

---

## 5. Open questions for the operator

1. **Phase 1 sort default** — keep citations-desc as the default, or default to biggest
   realized %-move? (Recommend: keep citations-desc; it's the page's editorial thesis.)
2. **Freshness threshold (P6)** — what age turns the pill amber? (Recommend: > 3h, red
   > 12h, matching the hourly markets ingest cadence.)
3. **Chip bar placement (P2)** — above the "Repricing today" header (affects both
   leaderboard and bridge), or only above the by-story bridge it actually filters?
   (Recommend: above "Repricing today" — it's the page-level filter state.)
4. **Scope confirm** — build all three phases, or ship Phase 1, review, then continue?

Operator answers (2026-05-30): take the recommended defaults — citations-desc sort,
amber > 3h / red > 12h freshness, chips above "Repricing today", build all three phases.

---

## 6. Industry standards (researched 2026-05-30) + refinements applied

The patterns below are not bespoke — they're the documented conventions. Sources at the
end. Each maps to the problem it backs, with the refinement folded into the build.

- **Filtering model (P1/P2).** NN/g splits *interactive* filtering (results + facet counts
  update per selection — for explorers) from *batch* filtering (commit via "Apply" — for
  users with criteria in mind). `/economy` is interactive and already shows facet counts;
  keep it. → No change to model.
- **Active-filter chips (P2).** NN/g + GitLab Pajamas + Material agree: show applied
  filters as chips **above the results**, with **both individual ✕ and a "Clear all"**, and
  a **count** of active filters. **Refinement:** chip bar gets a count and per-facet ✕, not
  just a clear-all. Placed above "Repricing today" (page-level state).
- **URL-synced state (P1/P9).** Bidirectional sync so refresh survives, links reproduce the
  view, bookmarks persist. Use **flat query params** (`?instrument=BRENT&country=Iran`), no
  secrets, mind the ~2000-char cap (non-issue for a few short facets).
- **Sorting (P3).** Standard framing: filtering hides rows, sorting reorders them — keep
  them distinct controls (don't merge). Default stays citations-desc (the editorial thesis).
- **Loading (P5).** Skeleton screens beat spinners on *perceived* speed at identical load
  times (Wroblewski; Facebook ~300ms; NN/g lower bounce). → Skeleton rows.
- **Freshness (P6).** Dashboard standard: always show an explicit "Last updated" stamp and
  make **stale data look stale** (color-coded). **Refinement:** amber > 3h, red > 12h,
  matching the hourly ingest; optional manual-refresh affordance deferred.
- **Mobile (P7).** NN/g's current recommendation is a **tray / bottom-sheet** over a
  separate filter screen, and the **Apply/Clear actions must stay sticky / always in view**.
  **Refinement:** mobile uses a bottom-sheet-style disclosure with a sticky action row, not
  a plain `<details>`.
- **Accessibility (P3/P8).** WAI-ARIA APG sortable-table: header text in a `<button>`,
  **`aria-sort`** only on the active column (omit elsewhere, don't use `="none"`), announce
  via **`aria-live`**. Expandable rows need a real button with **`aria-expanded`**. Guiding
  principle: *"No ARIA is better than Bad ARIA"* — prefer semantic `<button>` over
  `<div onClick>` + roles. → Convert country labels, row toggle, dormant trigger to buttons.

Sources:
- NN/g — Filters vs. Facets; User Intent Affects Filter Design; Mobile Faceted Search with a Tray; Bottom Sheets; Skeleton Screens 101; Skeleton vs Progress vs Spinners.
- GitLab Pajamas — Filtering pattern. Material/Bootcamp — Designing Filter & Sort.
- LogRocket — URL state management in React. Smashing — UX Strategies for Real-Time Dashboards.
- W3C WAI-ARIA APG — Sortable Table; Adrian Roselli — Sortable Table Columns.

---

## 7. Execution log

**2026-05-30 — all three phases SHIPPED to `docs/` (build copied; awaiting push).**

**Phase 1 — URL state + chips + sortable headers** (`EconomyPage.jsx`, `EconomyPage.css`):
- `useSearchParams` round-trips `sev`/`hor`/`instrument`/`country`/`sort`/`dir`/`open`. Module-level `parseFiltersFromParams` / `parseSortFromParams` / `buildParams`; only non-default params are written. Loop-safe via a shared `lastWritten` ref compared in both the write-effect and read-effect (back/forward reseeds state). Replace-mode writes keep history clean.
- `.ep-chipbar` (count badge + per-facet chip with `.ep-chip-x` + `.ep-chip-clearall`) above "Repricing today".
- Sortable headers: `role="columnheader"` cells wrapping `.ep-sortbtn` `<button>`s for Instrument/Chg/Stories; `aria-sort` only on the active column; `.ep-sr-only` `aria-live="polite"` announces sort changes. `sortedMovers` useMemo sorts a copy (chg pulls from `markets.series[id].change`, nulls-last regardless of dir). Default = cites-desc.

**Phase 2 — skeletons + freshness + row affordance**:
- `.ep-skel-list` (7 rows) / `.ep-skel-bridge` (4 cards) shimmer skeletons replace the spinners; `@keyframes ep-shimmer` + `prefers-reduced-motion` guard.
- Freshness pill in `.ep-lhd-meta`: `freshness` = live ≤3h / aging >3h / stale >12h from `marketsAsOf`; `.ep-fresh-{live,aging,stale}` dot + time-ago.
- `.ep-row-l1` is `role="button"` + `tabIndex=0` + `aria-expanded` + Enter/Space handler + focus-visible outline; `.ep-name-fi` funnel glyph reveals on hover/focus.

**Phase 3 — mobile sheet + a11y conversions**:
- `.ep-mobile-filter-btn` (with `.ep-mfb-n` count) shown only ≤1024px; opens `.ep-rail-left.sheet-open` as a fixed bottom sheet with `.ep-sheet-backdrop`, sticky `.ep-sheet-head` (× close) + `.ep-sheet-foot` (Clear all / Show results). Drag handle + rail hidden on mobile.
- Country facet → `<button aria-pressed>` + `.ep-fcountry-box` CSS checkbox; dormant trigger → `<button aria-expanded>`.

**Verification** — standalone Playwright (`/tmp/ep-phase23.mjs`) with live proxy data preseeded into localStorage (CORS blocks localhost direct fetch). Note for future runs: vite `base` is `./` and the router basename is undefined on localhost, so the preview URL is `http://localhost:4321/economy` (NOT `/globalPerspective-v1/economy`), and the app registers a service worker — launch Playwright contexts with `serviceWorkers: 'block'` and restart `vite preview` after each rebuild (sirv caches the asset map). Results: chipbar count+×+clear-all, exactly one `aria-sort` active, Enter expands a row, sort+filter both sync to URL, amber pill @5h / red @14h, mobile sheet open→country `aria-pressed` toggle→close. 0 component console errors. Lint clean, build OK.

**Operator defaults applied** (§5): sort default citations-desc; freshness amber >3h / red >12h; chip bar above "Repricing today"; all three phases built.
