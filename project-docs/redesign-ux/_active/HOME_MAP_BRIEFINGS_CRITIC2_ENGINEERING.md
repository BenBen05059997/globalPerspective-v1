# CRITIC 2 — Engineering feasibility, cost, performance, data truth
Reviewing: HOME_MAP_BRIEFINGS_FRONTEND_DESIGN.md (Opus design) against HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md
(binding), STAGE0_FIXES_PLAN.md (in-flight), live prod, and current source. Verified 2026-09-24.

## 1. Live-data claims

| Claim | Finding | Verdict |
|---|---|---|
| `world/latest.json`: 1 situation, GDACS India cyclone, `threadId: null`, has `generated_at/next_expected_at/sources/stale/situations/lede/ranked` | Live curl confirms exactly — same event id `gdacs#TC#1001326`, `threadId: null`, all named fields present. | AGREE |
| Topics: 17 topics, `updatedAt` 2026-09-13, every topic has `threadId` | Live proxy call confirms: `count 17`, `updatedAt 2026-09-13T00:00:46.696Z`, `17/17` have non-null `threadId`. Field list also matches (`regions, sources, title, ..., threadId, ...`). | AGREE |
| `narrative_thread` (Houthi) = 13 entries, ~90 kB | Confirmed: 13 entries, 90,909 bytes. | AGREE |
| `prediction_track_record`: Brier 0.154, 122 resolved, 20,744 total dated triggers | Confirmed exactly. | AGREE |
| `daily_brief` for 2026-09-12 has real content (headline/summary/topStories, no threadId); today and 09-13 are null | **Not reproducible now.** Live calls for 09-12, 09-11, 09-10, 09-09, 09-08, 09-05 **all return `data: null`** as of this check (same day, later). Either the design author's snapshot was taken earlier today and the pipeline/cache regressed since, or the design checked a different environment. This matters: H4 ("ship now") assumes a real 09-12 edition to render against. If nothing is currently non-null, the daily edition ships permanently empty until DeepSeek is refunded and a fresh brief generates — the design's "interim daily anatomy" table has nothing to interim-render today. | **CORRECTION — flag to operator before scoping H4** |
| `weekly_brief` (weekOf 2026-09-06): has `signals[]`, `watch[]`, `threadIds[]`, no paragraph/corrections/scorecard | Confirmed. Data keys: `model, asOf, watch, signals, threadIds, status, weekOf, generatedAt, format`. No `week_summary`, no corrections, no scorecard field. | AGREE |
| Main chunk 1.30 MB / 422 kB gzip; deck.gl chunk 942 kB (uncompressed) / 261 kB gzip; 2D `SituationMap.jsx` imports all of d3 | `docs/assets/index-OjfpxU-5.js` = 1,304,495 bytes raw, gzip 421,865 bytes (411.9 kB / ~422 kB decimal — matches). `SituationMap3D-B6lNoOyg.js` = 941,559 bytes raw, gzip 261,252 bytes — matches exactly. `SituationMap.jsx:2` is `import * as d3 from 'd3'` — confirmed, full-library import. | AGREE |
| `restProxy.js` has a concurrency limiter (cap 4) but no in-flight de-dupe | Confirmed by reading the file: `runLimited`/`limitedProxyFetch` queue and cap concurrency at `MAX_PROXY_CONCURRENCY = 4`; no dedupe map, no memoization anywhere in the file. | AGREE |
| `/map` = `SituationHome.jsx`, `?focus=` (replace), manual tour, flat/globe toggle in `gp_map_view`, "since you last looked" in `gp_map_last_seen` | Confirmed: `useSearchParams`, `localStorage gp_map_last_seen`, `gp_map_view`, `tourIdx`/`tourOn` state present. | AGREE |

**One correction, one gap to add to the design's own verified-facts table:**
- Stage-0 items (f) restProxy de-dupe and (g) route-level lazy splitting, which H0 explicitly lists as
  "these are Stage-0 items" it will build on, are **not yet done**. The task tracker
  (`TASK_2026-09-24_stage0_fixes.md`) shows only (a)-(d) committed; (e)-(i) are "⬜ not started" — including
  the two H0 depends on most (f, g). `App.jsx` has zero `lazy(` calls today (grep returned nothing). This
  doesn't invalidate H0, but it means H0 is not "mostly done already" — it still owes ~2 of Stage-0's larger
  items (g is rated Effort M with its own regression risk) before Home work can build on a genuinely
  code-split, de-duped base.

## 2. Client-built story view-model vs. the backend "story" model

The `StoryItem` view-model (join by `threadId`, monitoring-only items for unmatched situations, a
`developments` bucket for placeless topics) is a reasonable **interim**, and it is honest about being
one (§4.8's B1-B4 table is the right instinct — naming exactly what's frontend-patched vs.
backend-owed). But it will fight the backend model in three concrete ways:

1. **The join key is degenerate today.** 0 of 1 situations have a `threadId`; 17/17 topics do. So in
   practice `buildStoryIndex` will produce **zero** "watched∩news" joins right now — every situation is
   `monitoring`, every topic is `news`/`developments`. The whole "Being watched" group, its sort rule, its
   card variant, and its "joined item" UI states are effectively **untestable against real data** until
   either GDACS starts tagging `threadId` on news/breaking situations, or a news-axis situation with a
   thread appears. That's a correctness risk the design doesn't call out strongly enough: H1-H2 ship code
   paths that can't be manually verified end-to-end pre-launch, only unit-tested against fixtures.
2. **`threads/story-map.json` (B2) is a second, competing join.** The design correctly notes it's already
   written by the matcher but 404s at the edge. The smallest backend change that meaningfully simplifies
   the frontend is **exposing that one static file** (no new Lambda, no schema design — it's already
   produced) — this should be H0/H1, not deferred to H6. It turns "35% matched" into whatever the matcher's
   real coverage is without any frontend join-order complexity (§4.1 rule 1's "second pass" becomes the
   only pass).
3. **Two independent rank orders on one page** (tier desc for "watched", outlets desc for "news") is
   flagged by the design itself (§11.3) as a real risk. Agreed — this isn't a client-model problem per se,
   it's that `thread_analysis` returning `{}` (B4) means there's no canonical cross-group ranking signal at
   all yet. Cheapest backend lever: even a coarse `significance`→ordinal bucket published per-topic (not a
   full 4-axis score) would let "In the news" sort by something more defensible than raw outlet count
   without waiting for full scoring.

**Verdict: MODIFY.** Ship B2 (expose `story-map.json`) in H0/H1, not H6 — it's a static-file exposure, not
new backend logic, and it's the one B-item that actually changes join *coverage* (the others are payload
shape/size). Everything else in §4.8 (B1, B3, B4) is correctly sequenced as later.

## 3. URL-as-only-selection-state + origin context

- **react-router 6.30.1** is in `package.json`; `useSearchParams` is already the pattern used by
  `SituationHome.jsx` today (`?focus=`, replace-only). The design's push/replace split (`select()` pushes,
  `clear()`/filters/view replace) is achievable — `setSearchParams(next, {replace: true})` vs. default
  (push) — but it is **not free**: every one of the ~7 URL setters (`select`, `clear`, `setView`,
  `setFilters`, canonicalization) has to remember which one it is, and a bug here silently changes back-
  button behavior rather than throwing. This needs an explicit unit/e2e test matrix (list→map→list→back,
  filter→select→back, mobile toggle→back), not just code review, because history-stack bugs are invisible
  in a quick click-through.
- **Failure modes not fully addressed in the design:**
  - *Fly-to on history (back) navigation.* §5.7/§3.8 describe fly-to for **selection**, but going back
    through history also changes `story=`, and nothing in §5 distinguishes "user clicked back" from "user
    clicked a new item" for animation purposes — a rapid back/forward sequence (common after opening
    several stories) will re-trigger the 800ms fly-to animation on every step, which reads as janky/spammy
    rather than "keeps it." Recommend: detect `popstate`/`navigation.type === 'traverse'` (or the simpler
    react-router `useNavigationType() === 'POP'`) and use the "deep link" (jump, no animation) treatment
    for POP navigations, not just for the very first mount.
  - *Stale ids after data refresh.* §5.3 covers this reasonably (stub item, prefix-based fallback) for the
    5-minute poll case. Not covered: a **topics refresh mid-session** could silently move a `threadId` out
    of the 17-item window (once B1's slim list ships) while the user has it selected — same fallback
    should apply, worth stating explicitly rather than leaving it implied by the general rule.
  - *Deep links to aged-out stories* — covered (§5.3 row 1). Reasonable.
  - *Canonicalization loops.* `story=` holding a situationId that resolves to a threadId triggers a
    `replace`; if the resolution itself flaps (e.g., B2's story-map updates between requests) this could
    in theory replace-loop. Low risk given `replace()` doesn't create new history entries, but worth a
    "canonicalize once per mount, not on every render" guard note (React effect dependency array bug is
    the classic way this goes wrong).
- **Verdict: AGREE** the URL-as-truth approach is sound and the right call for this app (shareable,
  survives refresh, matches existing `/map?focus=` precedent). MODIFY: add the POP-navigation fly-to
  suppression explicitly to §5.2/§3.8 before H1, since it's a one-line fix now vs. a "why does the map
  jerk around when I hit back twice" bug report later.

## 4. Lightweight SVG 2D map vs. deck.gl-flat

- Current `SituationMap.jsx` is **128 lines** — a thin renderer, not close to parity. `SituationMap3D.jsx`
  (deck.gl) is 291 lines and carries the ledger's accumulated fixes (projection, callout re-projection,
  clustering/legibility, far-side cull, click-vs-animation conflicts noted in the design's own Civ-VI
  aside about animated layers eating clicks).
- Re-implementing all of §3.2's marker system (hue/shape/glow/pulse/selection/fallback fill),
  §3.6's callout placement (`placeCallout` algorithm), §3.8's fly/zoom/frame logic, and keyboard pan/step
  in **d3 + raw SVG** from a 128-line base is realistically a **multi-week effort for one developer**, not
  the "H3, ships after H1" pace implied by the phase table — especially the glow/pulse halo layering and
  callout re-projection on zoom/pan, which is exactly the class of bug the map programme's ledger says was
  hard-won (MAP_HOME_SITUATION_LEDGER, referenced but not re-read here in full — the design cites it as the
  source of "hard-won" fixes, which is itself evidence this is nontrivial re-implementation risk, not
  boilerplate).
- The design's own fallback (§3.8, §11.10) — ship on lazy deck.gl-flat if H3 slips, pay 261 kB gzip after
  first paint — is the right engineering call and should be the **default plan**, not a contingency. Given
  the SPA already has deck.gl in the bundle graph and lazy-loading it (never in the first-paint chunk) is
  a small, low-risk change (React.lazy + Suspense, same pattern already used correctly at
  `SituationHome.jsx:9` for `SituationMap3D`), the marginal engineering cost of "flat also lazy, loaded
  right after list paint" is much lower than a from-scratch SVG renderer, and it ships H1-H3 content weeks
  sooner.
- **Verdict: OPPOSE the SVG rewrite as an H3 commitment; MODIFY to make lazy-deck.gl-flat the committed
  H1-H5 renderer**, with the SVG rewrite explicitly demoted to H6+ "nice to have, do it if there's spare
  cycles and only after the linked-selection/list/briefings work has shipped and been used against real
  (post-DeepSeek) data." Shipping the harder rewrite before the join/data problems (§1, §2) are even
  resolved risks burning the multi-week budget on a renderer for content that's mostly empty groups.

## 5. Phasing H0-H6 — effort, overlap, what ships before DeepSeek

- **H0 overlap:** confirmed real (see §1). H0 = Stage-0 items (f) restProxy de-dupe, (g) lazy routes, plus
  new work (freshness lib, map/axis tokens, Skeleton, `useReducedMotion`, `homeStoryPath`, stopping
  driver.js auto-start). Stage-0 (f)/(g) are **not yet done** by the concurrent executor as of this check —
  they're tracked but unstarted. So H0 for the Home/Briefings work and Stage-0 (f)/(g) are the **same
  work**, and whichever finishes first should hand the other credit, not redo it. Recommend: do NOT start
  a separate H0 branch for (f)/(g) — let Stage-0 land them, and H0 for Home only adds the genuinely new
  bits (freshness lib, tokens, Skeleton, `useReducedMotion`, `homeStoryPath`, tour auto-start guard).
  Realistic effort for H0's *net-new* slice: 2-3 days for one developer + agents, not counting (f)/(g)
  which Stage-0 already owns.
- **H1 (split+list+linked selection) effort:** the design rates this "Yes, ship now" with thin/stale
  content as acceptable. Given `buildStoryIndex`, `useHomeState`, the split/⤢/mobile-toggle layout, filters,
  and lazy deck.gl-flat wiring, this is genuinely large — 1.5-2 weeks realistic for one developer, not a
  few days, mostly because of the URL-state edge cases in §3 above plus building against near-zero real
  joins (§2.1) which makes manual QA slow (nothing to click).
- **H2 (story card):** 3-5 days — mostly wiring existing hooks (`useNarrativeThread`, `useThreadForecast`,
  `useTrackRecord`) into a new card shell; lower risk since the data calls already exist and are verified
  live.
- **H3 (map parity or lazy-deck.gl + alert stack + banner):** if scoped as "lazy deck.gl-flat is the
  shipped renderer" per §4 above, this shrinks to alert stack + banner + keyboard pan/step (deck.gl already
  supports most of the rest) — 4-6 days. If scoped as the full SVG rewrite, 3+ weeks, high risk of
  reintroducing the ledger's bugs.
- **H4 (/briefings):** correctly independent of the S6 gate. But given the daily_brief `null` finding in
  §1, the "interim daily anatomy" table has nothing to render for *any* recent date right now — worth
  operator-confirming there's a live date with real daily_brief content before committing to H4's daily-tab
  scope; otherwise H4 should ship weekly-only first (weekly_brief *is* populated) and daily as a stub
  ("no recent editions") until the pipeline produces one.
- **Risk of building H1-H3 on 11-day-stale data:** real but the design handles it about as well as
  possible — honesty states, dated ledes, stale banner variant are the correct mitigation, not a reason to
  block. Agreed with the design's own framing in §11.1.
- **What can ship before DeepSeek is funded:** H0 (net-new slice), H3's alert-stack/banner/keyboard pieces,
  H4's weekly tab, GDACS monitoring items — all confirmed buildable against currently-live, non-null data
  (`world/latest.json`, `weekly_brief`, `prediction_track_record`). H1's "In the news" group and H2's card
  content are buildable but will visibly show 11-day-old content until funded — acceptable per the design's
  own honesty framing.

## 6. Performance: first-paint JS, layout shift

- **Current baseline confirmed:** main chunk 422 kB gzip *today*, before Stage-0 (g) lands. Once (g) lands
  (route-level lazy for 20 pages), the Home route's own first-paint bundle should drop substantially, but
  the design's target of "≤200 kB gzip to paint `/`" is optimistic to verify pre-emptively: today's 422 kB
  main chunk almost certainly contains Firebase Auth, React Router, all shared UI, and page code for every
  route including Home's own current logic — code-splitting Home's *route* out won't remove Firebase Auth
  or shared chrome from the "main" chunk unless those are also separately deferred (the design does note
  Firebase Auth should init after first paint in §8 point 1, which is correct and necessary, not
  automatic — it requires `AuthProvider`'s init to be explicitly deferred, not just route-split).
  Recommend the design's Stage-0 (g) land and get measured (its own verification step asks for
  before/after main-chunk numbers) **before** committing to the ≤200 kB target number in a plan — right now
  it's an estimate, not a verified target, and should be labeled as such until (g) ships and is measured.
- **CLS target (<0.05 from today's 0.32):** the fixed-height reservations described (§8: lede 64px, bar
  40px, stage height formula, list/map skeletons) are the right mechanism and match patterns already used
  elsewhere in the codebase (skeleton-based loading is new per the design's own note, "the first skeleton
  primitive in the codebase" — meaning this is genuinely new infrastructure, budget a day for `Skeleton`
  itself plus per-surface adoption, not zero).
- **Split/card-expansion layout-shift risks not fully covered:** the card's "grows once to its final height,
  triggered by the user, so it does not count as CLS" claim (§4.6) is correct per the CWG's operational
  definition (user-initiated expansion within 500ms of input is excluded from CLS), but only if the click
  handler and DOM mutation happen synchronously/close together — if the lazy `narrative_thread` fetch (§4.6
  table) resolves and reflows content **after** the initial synchronous expand-with-skeleton, that *second*
  reflow (skeleton→real content height changing) can still count against CLS if it happens outside the
  same input-attributed window, especially on a slow connection. The design's fixed-height skeleton bars
  mitigate this only if skeleton height ≈ final content height; worth a note to keep skeleton row-count/height
  close to typical real content height (3 lines for "what's happening" is reasonable; timeline "3 rows"
  vs. real single-event stories collapsing to 1 row is a likely mismatch — flagged in §4.6 itself as "a
  single event shows the one row only," which will shift height when content is shorter than skeleton).

## 7. What the design under-states needing from backend

- **B2 (`story-map.json` at the edge)** should be pulled forward from H6 to H0/H1 — see §2 above. This is
  the single highest-leverage backend ask because it's already generated, just not served.
- **Daily-brief pipeline health** (§1 finding) needs an operator answer before H4 daily-tab scope is
  finalized — the design assumes a populated recent date exists; that's not currently true against a live
  check.
- **`thread_analysis` returning `{}` (B4)** is correctly flagged as blocking the severity/axis-score row,
  but the design doesn't flag that it *also* blocks any credible single sort order across "watched" vs.
  "news" groups (§11.3) — a coarser interim ranking signal (even ordinal significance buckets) would help
  more than the full 4-axis score and could ship sooner.

---

## Leaner build order (my recommendation)

1. **H0-net-new only** (freshness lib, tokens, Skeleton, `useReducedMotion`, `homeStoryPath`, stop tour
   auto-start) — let Stage-0 (f)/(g) land separately, don't duplicate. ~2-3 days.
2. **Expose `threads/story-map.json` at the edge (pulled-forward B2)** — static file, no new Lambda. Do
   this before or alongside H1; it's the cheapest change that most changes what H1 actually has to join.
3. **H1 with lazy-deck.gl-flat as the committed renderer** (not the SVG rewrite) — split+list+linked
   selection, built and QA'd against real live data (which, per §2, means very few "watched" joins until
   step 2 lands or a news-axis situation gets a threadId — budget for that reality in QA, don't expect rich
   demo data).
4. **H4-weekly-only first** (weekly_brief is populated; daily_brief is currently null site-wide per §1) —
   ship the weekly tab, stub the daily tab honestly ("no recent daily editions") until the pipeline
   confirms a real date.
5. **H2 (story card)** — cheap relative to H1 since it's mostly wiring already-verified live endpoints.
6. **H3 as alert-stack + banner + keyboard-step only** (deck.gl already carries projection/callout/zoom) —
   demote the SVG-parity rewrite to H6+, gated on it actually being needed (i.e., only if deck.gl's 261 kB
   post-paint cost proves to matter in real usage metrics, not pre-emptively).
7. **H5 (S6 swap)** stays gated as designed.

## Top 5 engineering changes ranked by risk reduction

1. **Don't rewrite the map renderer in H3 — keep deck.gl-flat, lazy-loaded.** Removes the single biggest
   effort/risk item (multi-week rewrite of hard-won projection/callout/pulse/click logic) from the
   critical path, for a bundle-size cost the design's own principle 5 ("first paint") already handles by
   deferring it past paint.
2. **Expose `story-map.json` before H1, not at H6.** Fixes the "0 real joins to test against" problem
   cheaply (no new backend logic) instead of shipping H1-H2 against structurally-empty demo data.
3. **Verify daily_brief has *any* live non-null date before committing H4's daily-tab scope**, and default
   to weekly-only if not — avoids shipping a "ready" daily tab that's permanently empty.
4. **Confirm Stage-0 (f)/(g) ownership boundary explicitly** (who lands restProxy de-dupe and route
   splitting) before H0 starts, to avoid two people/agents editing `restProxy.js` and `App.jsx`
   concurrently — both are currently un-started per the tracker, and both files are named in both plans.
5. **Add explicit POP-navigation (back/forward) handling to the fly-to logic** before H1 ships — a one-line
   `useNavigationType()` check now vs. a "the map jerks on back-button" bug discovered after users start
   using linked selection.
