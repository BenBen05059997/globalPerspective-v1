# /map UI fix queue + patch-design round (S5.5 follow-up)

Status: slice 1 + 2a DONE (branch `map-patch-port`, source only, not deployed) · written 2026-09-09 after the operator's second in-person review of the deployed design port.
Sources: operator report ("dots are unclickable"), an independent Sonnet code audit of the ported files, and a live headless click test. Owner rows reference the ledger (`MAP_HOME_SITUATION_LEDGER.md` S5.5).

---

## 0 · The click bug (operator-reported) — TWO causes

1. **Pick target ≪ visible target.** The visible pin is the glow halo (up to ~24px) but only the 3.4–5.3px core dot was pickable, and deck.gl's click tolerance (`pickingRadius`) defaults to 0. → **Fixed in source** (commit `7d6d152`): `pickingRadius={16}` + pointer cursor on hover. Hover picking verified working.
2. **Suspected: the 60fps breathing-halo `setPhase` loop** re-renders the map every frame (and the 5-min poll swaps array identities), interfering with deck.gl's click gesture recognition — headless clicks still failed after fix 1. Matches audit items #5/#9 below. → Fix by moving the pulse out of React state (skip the loop when nothing is escalating; throttle to ~10fps; longer-term a shader/native animation) and stabilising effect deps. **Not yet fixed; not deployed.**

## 1 · Audit — top fixes  [slice 1+2a: #1,2 restructured away by manual tour · #3,4,6,7,8,10,11,12 DONE · #5 (fly-to poll) DONE via focusCentroid memo · #9 (60fps loop) DONE — animation removed]

1. **Tour shows no content.** `tourId` only moves the camera; the rail keeps showing the old list, tooltips need a mouse. The tour is pure motion with zero label/severity per stop (mobile: nothing at all). Fix: render the detail panel (or a compact stop card) off `tourId` without writing the URL + a "1 of 6" indicator. `SituationHome.jsx:79-91`. **medium**
2. **Tour resets every 5 min.** Effect depends on the `ranked` array reference, which the poll replaces → interval teardown, snap back to stop 1 mid-tour. Fix: depend on a memoised top-6-ids string. `SituationHome.jsx:81-87`. **small**
3. **Mobile map height is hardcoded 620px** (inline style beats CSS); only the loading skeleton is 60vh → layout jump + rail pushed below fold on phones. Fix: responsive height from the measured wrapper / `clamp(360px, 60vh, 620px)`. `SituationHome.jsx:127`, `SituationMap3D.jsx:132`, `SituationHome.css:174-178`. **small–medium**
4. **Hero callout detaches from its pin near map edges** (clamped up to ~290px away, no leader line; assumed 130px card height clips "Open →" on wrapped titles). Fix: flip anchor side near edges + measure real card height (or leader line — design question, see §3). `SituationMap3D.jsx:142-156`. **medium**
5. **Fly-to re-fires on every poll** while something is selected (deps include the raw `situations` array) → camera hiccup every 5 min. Fix: stable memoised lookup. `SituationMap3D.jsx:64-71`. **small**
6. **"Refreshed/Rechecked every 30 minutes" is hardcoded in 2–3 places** while `next_expected_at` is the real source → will silently lie if the cron changes. Fix: derive the cadence phrase from the bundle. `SituationHome.jsx:111,233`. **small**
7. **Fetch error leaves the header on "Loading the world…" forever** (no error branch on the lede line). `SituationHome.jsx:110`. **small**
8. **Expired/closed `?focus=` deep link degrades silently**; a still-present closed situation renders as live; `STATE_LABEL` (incl. "Ended") is defined but never rendered anywhere. Fix: "no longer tracked" state + render the state word in the detail head. `SituationHome.jsx:100,19`. **small–medium**
9. **Breathing rAF loop runs at 60fps even with zero escalating situations** — rebuilds all 4 layers per frame, pure battery burn (and see §0.2). `SituationMap3D.jsx:44-51`. **small (throttle) / larger (native)**
10. **`--sh-dim` #6b7688 on #0d1017 ≈ 4.14:1 — fails WCAG AA** for the body-size text it's used on (timestamps, source domains, index metadata). Fix: lighten to ~#7c879a. `SituationHome.css:8`. **small**
11. **List↔detail swap loses keyboard focus** (focus falls to body; orphaned heading levels). Fix: focus the back button on swap; make the detail heading an h2. `SituationHome.jsx:174-270`. **small**
12. **Tap targets below ~44px on mobile**: `.sh-ctl` (~28px), `.sh-back` (~30px), `.sh-idx-link` (~18px, zero padding, long adjacent list). `SituationHome.css:53,109,170`. **small**

## 2 · Audit — minor polish

- `m.outlets || 'few'` renders a genuine 0 as "few" — use `??` semantics. `SituationHome.jsx:233`.
- Unstyled default scrollbar on the dark capped rail (`scrollbar-width: thin; scrollbar-color`).
- Legend / controls / callout / quiet-chip are all absolutely positioned with no collision logic — can overlap on small maps (legend behind a toggle on mobile?).
- `aria-live="polite"` wraps the whole rail → poll refreshes re-announce big chunks; narrow it to a status string.
- Three unreconciled height constants: 620 (3D), 60vh (skeleton), 520 (D3 fallback default).
- Two extra "every 30 minutes" copies in `sh-consolidating`/`sh-note` (same drift as #6).

## 3 · Out-of-boundary — what this page should GAIN (not just fix)

Design-relevant (candidates for the patch-design round below):
- **The hero question: globe vs flat.** The plan locked "2.5D tilted hero + globe fly-to"; the static mock went flat for mock-honesty reasons; the port followed. Nobody ever *designed* the globe. Candidates: (A) globe hero (deck.gl `_GlobeView`, experimental but fine for our GeoJSON+dots), (B) flat + re-added gentle tilt/atmosphere, (C) flat overview with globe as the click/tour fly-to transition (the original plan's idea). Decide visually via patch boards.
- **Spread arcs.** `spread_arcs` exists in the feed (currently empty; tracker computes spreading) — origin→spread-country arcs would show the *system*, not just points. Plan WS4 wanted this.
- **Affected-country fill.** On select, tint the affected countries' polygons (we already have iso3 + the topojson) instead of only chips — the map itself should answer "affected where?"
- **"Since you last looked."** localStorage last-visit stamp → badge situations that are new/raised since then. The analyst's first question after the 3-second question.
- **Tour stop card** (fix #1 above is really a design surface, not just a bug).
- **24h replay / scrubber.** The HHMM history snapshots already land in S3 — a timeline strip replaying the day is pure frontend over existing data (deferred from S5·T2).

Not design — backend/product (tracked elsewhere, listed for completeness):
- **Feed-quality gate (ledger S5.5·T3, HIGH VALUE):** stop over-tiering single-outlet stories to "high"; drop stale "Closed — inactive" rows. The map stays noisy until this lands, whatever the design does.
- **S3·T2 thread depth:** "Open →" / situation pages need somewhere to go (`threadId` is null on everything).
- **Watchlist:** follow a situation → email on tier change (newsEmailSender infra exists).
- **Worker pre-render for `/map`** (SEO), like /weekly pages.

## 4a · Patch-design round — ANSWERED 2026-09-09 (boards in `MAP_HOME_DESIGN_TARGET_PATCH.html`, in-repo)

The designer returned all six boards. Decisions they force (adopt unless the operator objects):
1. **Hero = variant C (RECOMMENDED by designer, seconded):** flat overview (all pins visible) → user-initiated **globe fly-to** for detail/tour. Quantified argument: at any globe orientation ~9/17 mock situations (incl. 2 of 3 high) sit behind the horizon — "a busy Middle-East day faced at the Americas reads as a calm planet — a false lede." deck.gl shares layers between MapView and GlobeView, so C is also the cheap path to the globe payoff. Variant B (flat + gentle tilt) is the fallback if GlobeView misbehaves.
2. **Tour = manual stepper, NO autoplay timer** ("a timed mode, if ever, is opt-in per run"). Desktop: hero-callout + tour bar (n of 6, ←/→, Stop, progress ticks; Esc/tap-outside stops; rail row highlights in sync). Mobile: the peek sheet becomes the stop card with a big "Next situation →". This structurally deletes audit bugs #1 and #2 (no interval to reset, content always shown).
3. **Callout edge rule (implementable as written):** try 4 anchor quadrants around the pin (NE, NW, SE, SW preference), place in the first that fits fully with 8px margin — flip-anchor primary (stub leader stays short); only a literal-corner pin clamps + grows a straight leader ≤180px from the card's nearest corner, never crossing the card; fixed card width, two-line min-height, leader terminates at the card edge nearest the pin.
4. **Mobile:** ~60vh map; legend collapses to a "Key" chip (4 hue dots) → full legend bottom sheet on tap; **every pin gets an invisible 44px hit area**; bottom-sheet verdict: **build the fixed peek row now** (top-ranked situation, tap → full-screen detail — "the mobile lede and hero in one element, ~90% of the value"), **defer drag physics** until usage justifies.
5. **Arcs + affected fill = a selection state, not a base layer** (zero arcs/fill unselected — the spaghetti answer). On select: affected polygons tint ~8–10% fill / ~35% 1px border in axis hue under the pins; static arcs origin→destination fading toward the target (direction without arrowheads); destinations get a **hollow ring** so a spread target is never misread as its own situation; all other pins dim ~40%. Motion stays exclusive to escalation.
6. **"Since you last looked":** lede clause ("· 2 new since Tuesday") + rail markers (◇ diamond = new, outline chevron = tier changed, with "was moderate") + small pin markers; honesty line "Markers use your last visit, kept in this browser"; invisible on first visit; never a banner. Fields: `last_seen` = localStorage; "new" test = our `opened_at` ✓; "changed" test needs **`tier_changed_at`** which the world bundle does NOT carry — designer explicitly flagged it ("if it does not exist… we ship 'new' only"). → Either the tracker emits `tier_changed_at` (small, it already tracks history) or v1 ships new-only.

Backend additions this round asks for (fold into the tracker structured-fields pass): `tier_changed_at`, `coverage_ratio` (already queued), and verify whether GDACS population-exposed exists for the disaster panel's third cell.

## 4b · Original patch-design ask (for the record)

Scope: a PATCH, not a redesign — same palette/encoding/layout system as `MAP_HOME_DESIGN_TARGET.html`. Boards wanted:
1. **Hero variant A/B(/C):** globe hero vs flat+tilt atmosphere (vs flat with globe fly-to transition), same mock data, so the choice is made visually.
2. **Tour stop card:** what the viewer sees at each stop (compact card? the rail panel? position, "n of 6", next/prev, mobile).
3. **Callout edge behaviour:** flip-anchor vs leader-line when the pin is near an edge; wrapped-title height.
4. **Mobile pass:** real height strategy, legend collapse/toggle, tap-target sizes, whether the bottom-sheet from the original mock is worth building now.
5. **Spread arcs + affected-country fill** treatments (selected vs unselected states).
6. **"Since you last looked"** badge/treatment in rail + map.

Execution order — OPERATOR-CONFIRMED 2026-09-10:
1. Deploy slice 1+2a to unlisted /map (per-deploy yes) so the click fix is verifiable in person.
2. Slice 5 — feed-quality gate (backend; highest value).
3. Slice 4 — tracker structured fields (tier_changed_at, coverage_ratio).
4. Slice 2b — spread arcs + affected fill (build the iso3→centroid/polygon join).
5. Slice 3 — globe fly-to spike → variant C (tilt fallback).
6. S7 — Brave out of newsInvokeGemini (operator: "after the frontend").
7. S6 — home swap LAST (operator: "should be the last since that changes our prod view"); own explicit yes.
S3·T2 (thread depth) slots alongside/after S6 planning — pins need somewhere to go before or with the swap.
