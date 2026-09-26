## Remaining redesign topics (design only) — 2026-09-26 — active

**Goal:** finish the design of everything that still has none, so the build can start from a complete, approved set.
- Topics: site navigation, phone layouts, a design-system board, the home-page leftovers, the small pages, and a build order.
- **Design only:** records decisions and canvas boards. No product code is touched without an explicit "build" (operator rule, 2026-09-25).

**Reads / references:**
- `project-docs/ACTION_CHECKLIST.md` (page redesign roadmap + design canvas map)
- `redesign-ux/_active/STORY_WEB_RETHINK_PLAN.md` §7–9 (story mode, legend, tokens T1–T9)
- `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md`, `COUNTRY_VIEW_DISCUSSION.md`, `TRACK_RECORD_AND_STUDIO_RULING.md`
- Current shell: `global-perspectives-starter/frontend/src/app/App.jsx` (27 routes) and `src/app/layout/Layout.jsx` (nav groups brief / intel / markets / acct, footer)
- Design canvas: https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW (sources in `redesign-ux/_reference/wireframe-2026-09-24/`)

**Changes (design artifacts, not code):**
- This file
- `ACTION_CHECKLIST.md` (roadmap + canvas map rows)
- `INDEX.md` row
- One decision section per phase, in this file or the page's own doc
- New canvas boards under `redesign-ux/_reference/wireframe-2026-09-24/` (+ `canvas.json`)

**Docs to update on completion:**
- `ACTION_CHECKLIST.md` roadmap statuses
- `INDEX.md`
- Memory `project_map_home_situation.md`, if the home decisions change

### Live tracker
Each phase runs: research + debate (agents) → canvas board with real data → critic check → operator decision → recorded here. A phase is ✅ only after the operator decides.

| Phase | What gets decided | Status | Commit | Monitor ✓ |
|---|---|---|---|---|
| N · Site navigation | Top menu; how countries, sign-in/account and the retired pages (`/breaking`, `/spider-demo`, `/economy`, `/weekly-markets`) are reached; "AI paused" status line; footer | ✅ **APPROVED 26 Sep** ("ok that is good"), canvas N1 | see git log | 3 advocates + 2 critics; pause date verified 12 Sep |
| P · Phone layouts | One shared phone pattern for map + slides + time bar (story mode, country card, briefings, track record, Studio) | ✅ **APPROVED 26 Sep** ("Okay, that is good"), canvas P1 | see git log | 3 advocates + 1 critic; lazy map load verified in code |
| DS · Design-system board | T1–T9 tokens + shared pieces (StoryPeek, slide card, time bar, solid/dashed/hatched layers, freshness, "model judgment" label, quote/receipt) | ✅ **APPROVED 26 Sep**: where old and new designs conflict, the new design wins (canvas DS1) | see git log | tokens checked against `tokens.css` (light palette only; traffic-light risk scale) |
| H · Home leftovers | Banner vs tour; country shading vs pins; build behind `/map` first; "real Earth on top right" | **Now** · questions put to operator | — | — |
| SP · Small pages | About, whitepaper, privacy, disclosures, contact; membership / account / sign-in, including the signed-out `/account` | queued | — | — |
| B · Build order | The sequence from design to build, with dependencies (C11 story mode first) and operator gates | queued | — | — |

Also open, outside these phases: Studio decisions S5–S10 (`TRACK_RECORD_AND_STUDIO_RULING.md`).

**Completion checklist:**
- [ ] every phase ✅ with an operator decision recorded
- [ ] ACTION_CHECKLIST roadmap + canvas map updated each phase
- [ ] INDEX row
- [ ] status header flipped to `done`
- No code, so no CHANGES.md entry and no verify step.

## Phase N: navigation, APPROVED (operator, 2026-09-26: "ok that is good")
Debate: A five doors / B game HUD / C by job, then a reader critic and an engineering critic. Canvas board **N1** (`Navigation.dc.html`).

- **Menu:** Map · Stories · Briefings · Studio · Track record. Plain nouns, flat, no dropdowns. The old names "Console", "Topics" and "Threads" were jargon. Account at right; the parked credits badge stays hidden (existing gate, `Layout.jsx:127`).
- **Countries:** a map layer + a tab in Stories (`/weekly/countries` kept); not a menu item.
- **Briefings:** one new route, `/briefings` (Daily | Weekly). `/daily`, `/daily/:date` and `/weekly-brief` keep working as they are (the Worker pre-renders `/daily` for bots).
- **URLs:** new labels, same URLs. Reasons:
  - GitHub Pages + the Worker send no real 301s today;
  - story and country URLs are built in **8 places outside the frontend**: `newsPostLinkedIn:460`, `newsBreakingAlert:189`, `newsRecommend:317`, `newsSensitiveData:2114` (RSS), `newsSituationTracker:111`, `renderDriftEmail.js:91`, and the Worker root page + pre-render regexes.
  - The frontend has one helper, `src/shared/lib/threadPath.js` (14 call sites).
- **Retired routes:**
  - `/breaking(/:id)` → client redirect to the story if the id resolves, else `/`.
  - `/weekly-markets` → `/briefings` with a paused note (not `/economy`, which is itself parked).
  - `/spider-demo` stays unlisted, later → story WEB view.
  - `/economy` is direct URL only.
- **Status line:**
  - "New stories and analysis paused since 12 Sep". **12 Sep is verified** (last daily brief 2026-09-12T14:01Z; 13–26 Sep return nothing).
  - It must be **computed** from the newest `generatedAt`, never typed. That needs a new small read, since `gp-strip` today shows only a topic count and tagline (`Layout.jsx:181–197`).
  - GDACS alerts are still live.
- **Maps** live inside each page. No always-on map under every page: a live WebGL map under reading pages costs battery and memory.
- **Phone:** bottom tab bar with the same 5 items; the footer stays at the end of each page.
- **Search:** later. No search index exists yet (the ⌘K comment is at `Layout.jsx:38–46`).
- **Footer:** About, White paper, Membership, Privacy, Disclosures, Contact.
- **Build notes:** the onboarding tour targets use `data-tour="nav-${to}"` (`Layout.jsx:101`), so they must follow the new labels. The only nav guard is `verify_pages.sh:51` (economy absent).

## Phase P: phone pattern, APPROVED (operator, 2026-09-26: "Okay, that is good")
Debate: A map + bottom sheet / B swipe cards / C read first, map on demand, then a critic (reader + engineering). Canvas board **P1** (`PhonePattern.dc.html`).

- **Frame:** header + the computed "paused since" line (~60px), **one** tab switch (44px), content, the 5-item tab bar (58px).
- **Default tab = READ** (the slides as one scroll) on every page, except the **Map page, which opens on the radar map** (approved A2).
- **MAP is a tab.**
  - The WebGL map loads only when that tab opens. Today it is already lazy-loaded per route: `SituationHome.jsx` `lazy(() => import(SituationMap3D))`.
  - On the MAP tab the slide card becomes a **bottom sheet** (peek / half / full) with a drag handle **and** buttons. It is `role=dialog` only at full.
- **Third tab:** TIMELINE (story, country, Studio), EDITIONS (briefings), LOG (track record). Track record swaps READ for BOARD, and the ledger folds into it.
- **Rules:**
  - one switch per screen (Daily | Weekly lives inside READ);
  - no popovers (the quiet country state is inline);
  - no static map thumbnails (they go stale);
  - every tap area ≥ 44px, time-bar ticks included;
  - reduced motion = instant cuts;
  - every swipe has ◀ ▶ buttons.
- **Studio on phone:**
  - READ puts the **quote first**, then the analysis, then the **receipt**. The example shows all 4 sources as THIN, which is true for August stories.
  - The board view is off under 768px.
  - No paywall language: two advocates invented an "unlock" / "£" bar, and it is rejected.
- **Rejected:**
  - swipe cards: a 290px map per card can't show compare lanes or fork bands, and re-rendering the map per card is wasted work;
  - C's fixed 212px block with a static thumbnail.

## Phase DS: design-system board, APPROVED (operator, 2026-09-26: "use the new design")
Canvas **DS1** (`DesignSystem.dc.html`, 1440×1600). It gathers the approved decisions into one look per idea: **where · how sure · how fresh · whose claim**.

**Panels:**
- T1 console colours
- T2 meaning colours (crisis type only)
- T3 map symbols
- T4 lines = how sure
- T5 freshness = brightness
- T6 ours vs this run
- T7 motion budget
- T8 type
- T9 fixed words
- T10 states
- T11 shared parts
- T12 space + 44px targets
- T13 page defaults

Each panel states WHY it exists.

**Open questions for the operator:**
1. Amber means both "older / paused" and "this run" (Studio hatching). Recommend a separate sand hatching for this run.
2. The live risk scale is a traffic light (`tokens.css --risk-*`), and the country card shows HIGH in red. That conflicts with the legend rule "severity is never colour". Recommend number + tier word + ring weight.
3. Tap size: 40px (25 Sep proposal) vs 44px (phone). Recommend 44.
4. A light Reading mode for long reads? Recommend yes (same names, light values).
5. Tokens go into `tokens.css` at build time; this board is the reference until then.
6. Parked pages (economy) are restyled only when they return.

**Operator decisions on the open questions (2026-09-26):**
- **Where the old design competes with the new one, use the new design.** So:
  - the traffic-light risk scale is replaced by number + tier word + ring weight (Q2);
  - tap targets are 44px (Q3);
  - THIS RUN gets its own sand hatching, and amber stays for warnings (Q1, the recommendation, following "use the new design");
  - tokens go into `tokens.css` at build time (Q5);
  - parked pages are restyled only when they return (Q6).
- **No light Reading mode for now.** Long story pages ("Read in full") keep the console style (Q4).
- **White paper: hide it for now** ("we don't need it right now"). It is linked only from the footer (`Layout.jsx:211`); the route is `/whitepaper` (`App.jsx:134`).
  - The proposal is a soft hide like economy: drop the footer link, keep the URL live.
  - The code change waits for an explicit go.
- **Story mode is confirmed** as horizontal slides on desktop (map + slides + time scrubber, approved 25 Sep); "Read in full" is the secondary long page. The phone question is raised with the operator.
