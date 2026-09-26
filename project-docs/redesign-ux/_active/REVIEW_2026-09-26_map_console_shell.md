# Full review: map console + site shell + account (branch `map-console`) — 2026-09-26

**Scope:** `git diff main...map-console -- global-perspectives-starter/frontend` (93 files, ~7,000 lines): map console M1–M7, site shell A1–A2, account A3–A4 + A6.

**Method:** four independent read-only reviewers, each finding then spot-checked in code by the monitor:
- ① code correctness;
- ② honesty / product rules;
- ③ accessibility + phone (Playwright: 390×844 touch, reduced motion, 200% zoom);
- ④ performance (production builds of branch vs main) + design fidelity vs the approved boards.

Raw notes: scratchpad `review/`, `hr/`, `rv3_*`, `rv4_*`.

**What passed:**
- all 391 tests; lint clean; the `shared` ↛ `features` rule;
- reduced motion (globe / radar still, no sweep);
- no horizontal overflow at 390;
- landmarks; all localStorage in try/catch; fetch cancellation; animation cleanup;
- no "something went wrong" UI; public data never gated;
- main bundle only +1.2 KB gz.

## Fix batch F1: must fix before this branch can ship (correctness · honesty · performance)
| # | Finding (verified) | Where | Fix |
|---|---|---|---|
| F1.1 | **Daily-brief lookback fan-out:** 40 proxy calls on a cold `/map`, 20 on every other page, and 31 / 62 on **every** load after ~12 Oct, because "nothing found" is never cached (`if (!data) return`). It also fills the 4-slot proxy queue ahead of page data | `useDailyBrief.js:79`, Layout + SituationHome both mount it | One shared module-level promise; cache the empty result; start from the last known date. **Better:** a single `latest_daily_brief` value (proxy action or a field in `world/latest.json`) — a small backend change (see decisions) |
| F1.2 | **Animation saturates weak GPUs:** spin + pulse call React `setState` every frame, so deck.gl rebuilds its layers each frame (76 long tasks / 20 s). The night texture then never loads (`requestIdleCallback` has no timeout) | `SituationMap3D.jsx:257, 338, 148` | Drive spin / pulse through refs + `deck.setProps`, or throttle to ~24 fps; pause when hidden / off-screen; idle callback `timeout: 2000`; a ~250 KB WebP texture |
| F1.3 | **Desk hides same-day changes forever:** `asOf` is a date key (00:00 UTC), compared with a last-visit timestamp | `desk.js:75–81, 163–169` | Compare date keys |
| F1.4 | **Account Alerts contradicts itself:** new header "nothing claims to be on when paused", then the old panel says "Email delivery is live", offers breaking alerts (cron off) and country-change emails (cron off) | `Account.jsx:335, 340, 396, 442` | A real state per channel (live / paused / not sending) |
| F1.5 | **Studio section promises "shared analyses · receipts"**, which don't exist | `Account.jsx:443` | "your key" |
| F1.6 | **Nav tooltips + tour claim** "today's coverage / live topics", "every forecast publicly scored", "or ours as a member", "what mattered today" | `Layout.jsx` titles, `tours.js:47` | Plain true wording |
| F1.7 | **Story card relabels the category as a crisis type** (Kenya "climate" → "HUMANITARIAN"); the peek says "ENERGY" for the same story | `StoryCard.jsx` header | Show `topic.category`; keep the crisis mapping for hue only |
| F1.8 | **Phone footer hidden under the tab bar on every page** (padding is on `main`, the footer comes after it) | `Layout.css:302` | Pad the wrapper / footer |
| F1.9 | **Guided tour stuck in radar / phone:** no tour bar outside the globe callout (regression vs main) | `SituationHome.jsx:422, 309`; `SituationMap3D.jsx:447` | A tour bar in SituationHome for any mode; hide the button when `focus` is set |
| F1.10 | **/account now loads the 60 KB-gz map chunk** (deskMap imports `land` from SituationMap + `d3` whole) | `deskMap.js` | Move `land` / `FRAME` into a small lib; import `d3-geo` only |

## Fix batch F2: should fix (bugs + accessibility)
| # | Finding | Fix |
|---|---|---|
| F2.1 | "Resume spin" does nothing after a drag (`userMoved` never reset) | Reset it on resume |
| F2.2 | Radar zoom snaps back on every redraw (5-min poll, selection, resize) | Re-apply `d3.zoomTransform`, or split the static draw |
| F2.3 | Phone: an empty bottom sheet for a stale `?story=` link | Open it only when a selection resolves |
| F2.4 | A slightly future timestamp → all stories "hidden, older than 30 days" | Clamp negative ages to 0 |
| F2.5 | At exactly 900px there's no navigation (min / max 900 overlap) | `max-width: 899.98px` everywhere |
| F2.6 | Desk marks changes seen even if they never loaded | Write last-visit only after rows render |
| F2.7 | Selected story never highlighted (`threadId‖topicId` vs `topicId‖threadId`) | One id rule |
| F2.8 | The story card flashes the previous story's content | `key` the card by id |
| F2.9 | Phone MAP / LIST / ALERTS tabs unreachable by keyboard (roving tabindex, no arrow keys) | Arrow / Home / End keys |
| F2.10 | Radar `svg role="img"` hides its focusable countries / markers from screen readers | `role="group"` |
| F2.11 | The full sheet says `aria-modal` but focus escapes (36 / 40 Tabs) | Focus trap or `inert` background |
| F2.12 | The whole rail is `aria-live` (reads ~1,400 chars on each selection) | One-line hidden live region |
| F2.13 | Contrast: 3.4:1 and 2.66:1 labels (opacity-dimmed), 9px chips ~4:1 | Tokens instead of opacity; ≥11px chips |
| F2.14 | Esc doesn't close the Key legend; no `aria-controls`; `aria-label` on role-less divs | Esc handler, `role=region`, `aria-controls` |
| F2.15 | No focus ring on the globe canvas / radar markers | `:focus-visible` outline |
| F2.16 | Phone tap targets under 44px: Globe / Radar 40, Key 42, sheet handle 22, back 40, help 32, sign-in 36 | `min-height: var(--c-tap-min)` |
| F2.17 | Sheet header see-through | Opaque background |
| F2.18 | Labels: "MODEL EXPLANATION (STORED)" vs plan "model judgment"; the AI summary lacks its date; the card's "updated" is the feed time; the card body vanishes if one of two fetches fails; the Desk says "analysis paused" without checking | Align the wording; date the summary; keep what loaded |
| F2.19 | Status line: "paused since Sep 12" (brief) vs stories from Sep 13; missing "GDACS still live"; inconsistent casing / spacing | "Analysis paused since Sep 12 · last stories Sep 13 · disaster alerts live" |
| F2.20 | Flaky tests: dynamic import inside the test under the 5 s timeout; the theme test doesn't mock `useDailyBrief` / `useGeminiTopics` | Static import + mocks |
| F2.21 | Dead code from removing flat mode (default `SituationMap`, `SituationMap3D` flat branches); `innerHTML` for `verb_label` in RadarMap (copied); a SavedPanel filter dead-end | Remove / escape / fix |

## F3: design gaps vs the approved boards (need the operator's call)
1. **The console isn't full-bleed.** It's a dark box inside the light shell. The banner, paused line and HUD row push the globe to y≈400 (half below the fold); on phones the radar starts at y≈520 of 844. Approved intent: the map *is* the page.
2. **The legend means something different:**
   - the build uses brightness + size = how serious;
   - approved: brightness = freshness, size + double ring = HIGH, shape = kind;
   - shape is not used; dashed / dotted link lines are absent (no links are drawn on `/map` yet).
3. **No desktop alert stack and no layer switches** (SITUATIONS / COUNTRY RISK).
4. **Threat board folded into tier counts;** the brief lost its lead story + "open story →"; no forecast-ledger sensor row.
5. **The story card lacks** in-text links, TIMELINE / OUTLOOK jumps, "most likely", and the fact / inference marks.
6. **Nav keeps the old light style,** not the board's dark console header; the old light welcome tour still pops on `/account`.
7. **Feed labels are topic categories,** not the 4 crisis types + tier; "The map is quiet" appears 4× while 13 stories are listed.

## F4: pre-existing honesty bugs on the LIVE site (not from this branch)
- `/weekly` "NEW EVENTS TODAY · updated today" (the archive re-writes 13-Sep stories with the current date: backend).
- `/map` "The map is quiet — no situations open", while the news layer is paused.
- `/map` teasers "summarised each morning"; "re-scored on a fixed cycle".
- `/daily` "Today's Brief" heading on a 14-day-old brief; "publishes at the end of the day"; the "analyst-reviewed" badge (confirm a human review exists).
- `/about` "hundreds of articles daily / every hour / every 4 hours".
- `/track-record` "20,607 awaiting their deadline" (many deadlines passed) + "STRONG" Brier on the one-week pilot; 549px phone overflow.
