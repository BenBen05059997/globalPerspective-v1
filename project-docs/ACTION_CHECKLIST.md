# Action Checklist — what to do next

_Living document. Last updated 2026-09-24. One place for everything open: who does it, what it's
waiting on, and where the details live. Tick items as they close; move finished ones to the
"Done" section at the bottom with the date._

Legend: 👤 **you** (operator) · 🤖 **Claude** (Sonnet executes, Claude verifies) · ⏳ waiting on
something · ▶ in progress · ✅ done

---

## 1. Your actions (only you can do these)

| # | Action | Unblocks | Status |
|---|---|---|---|
| Y1 | **Top up the DeepSeek account** (one key shared by all ~17 DeepSeek Lambdas) | The whole content pipeline: daily brief, story summaries, fresh country/thread analyses, the map's news situations (the map shows 1 situation today because news classification fails on `402 Insufficient Balance`), Phase 4 severity fix, the R3 matcher clock | ⏳ you said "a few days" |
| Y2 | **Decide the Gemini paid tier** (thread analysis's daily batch exceeds the free 20 requests/day) | Thread-analysis freshness; the thread half of Phase 4 | ⏳ decision |
| Y3 | **Say "yes" to deploy #1: the site** (`./deploy.sh`) | Takes live: the feature-folder restructure, the dead-code cleanup, and the Stage-0 fixes | ⏳ after Claude's verification (C1) |
| Y4 | **Say "yes" to deploy #2: the Cloudflare Worker + sitemap** | Google can see every page (today every route except `/` returns HTTP 404) | ⏳ after Claude's verification (C1) |
| Y5 | **Meeting: review the home/map/briefings design + clickable wireframe**, and decide the 3 open questions on its orange sticky (tour removal, country fallback, build behind `/map` while stale) | The home-page and briefings builds (C4, C5) | ⏳ ready for you |
| Y6 | Next session: run `/memory` once to confirm only this project's CLAUDE.md loads | Confirms the context cleanup works | ⏳ next session |
| Y7 | _Optional:_ move the notetrail files (`~/Downloads/CLAUDE.md`, `SPEC.md`, `DATA-MODEL.md`) into the notetrail project folder | Other projects under `~/Downloads` stop inheriting them (GP already excludes them) | optional |
| Y8 | _Optional:_ move the Firebase admin-SDK key out of the repo folder (it's gitignored, not leaked) | Hygiene | optional |

## 2. Claude: in progress now

| # | Work | Details | Status |
|---|---|---|---|
| C1 | **Stage-0 fixes**: SEO Worker fallback (prepared, not deployed), honest freshness labels, parked-credits copy, onboarding tour blocking the phone menu, member link, request de-duplication, route code-splitting (main bundle 1,046 → 425 kB), page titles, `/daily` fallback window | `project-docs/architecture/_active/STAGE0_FIXES_PLAN.md` · tracker: `TASK_2026-09-24_stage0_fixes.md` | ✅ built + verified (185 tests; browser-checked) → **waiting on you: Y3 + Y4** |
| C2 | **Frontend design debate**: Opus design → 2 Sonnet critics (reader/accessibility, engineering/cost) → Claude rules | `project-docs/redesign-ux/_active/HOME_MAP_BRIEFINGS_FRONTEND_DESIGN.md` (§12 = rulings) | ✅ done |
| C3 | **Clickable wireframe for the meeting** (desktop home, phone, briefings) | https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW (private — share it from the page's Share menu before the meeting) | ✅ done |

## 3. Claude: next, once unblocked

| # | Work | Waiting on | Details |
|---|---|---|---|
| C4 | **Home = map + story list** (side by side, expand-to-full, linked selection, game-style map, story cards, first-visit banner) | Y5 (design approved). The *switch* to map-first waits on the S6 gate: Y1 done → ~7 days at ≥5 open situations across ≥2 types | Design brief + spec |
| C5 | **`/briefings`** (Daily + Weekly editions, "show on map", corrections + scorecard in weekly) | Y5 | Design brief + spec |
| C6 | **`/story/:id` rename** with 301 redirects, bundled with the Worker change | Y4 path proven | `PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` §8 |
| C7 | **Phase 4 severity-score fix** (country half first, then thread): offline eval against the gold set → deploy the prompt → re-run the live flag audit as proof | Y1 (country half), Y2 (thread half) | `ONE_TRUTH_EXECUTION_PLAN.md` Phase 4 |
| C8 | **Story + country pages, incremental fixes** from the review: mobile overflow, layout shift, old colour palette → tokens, an "archived story" state (fixes economy's broken story links) | C1 deployed | `PAGE_REVIEW_2026-09-24.md` §4 |
| C11 | **Story page = STORY MODE (one screen: map + slides + time scrubber; approved 2026-09-25) + "Read in full" long page with the news-based story web** (`STORY_WEB_RETHINK_PLAN.md` §5): Timeline chapters + "Show linked news" toggle; Why section = cause chain + news it feeds into (cited dated headlines, per-analysis confidence, verbatim mechanisms) + shared actors; board WEB = story graph; `/spider-demo` retires after. Stage 1 frontend-only (~600–800 lines) | C6 route rename; stage 2 (web_index action, prompt spread fix, per-story WEB record) needs Y1 DeepSeek top-up | `STORY_WEB_RETHINK_PLAN.md` + wireframe row v4 |
| C12 | **Studio "Country deep-dive" lens** with the country systems web as on-demand context (country web removed from the public country page 2026-09-25) | After Phase 4 severity work (C7), per `COUNTRY_INTEL_VS_STUDIO_2026-09-24.md` | That doc, §5 B + §7 |
| C13 | **Economy parked** (2026-09-25): soft-hidden from nav (code done, ships with next deploy); `TriggerWeeklyMarkets` paused (live). Revisit E1–E8 of `ECONOMY_CONSOLE_DISCUSSION.md` after the DeepSeek top-up; re-enable the rule then | Y1 | `redesign-ux/_active/ECONOMY_CONSOLE_DISCUSSION.md` |
| C9 | **Site-wide accessibility pass**: contrast tokens, focus outlines, tap targets, icon-button labels, reduced motion | C1 deployed | `PAGE_REVIEW_2026-09-24.md` X-8 |
| C10 | After content flows again: regenerate `quality/dashboard.md` + `calibration/latest.md`; delete the ~263 zero-byte corpus files; re-measure the R3 matcher after ~1 week | Y1 | `CLEANUP_AUDIT_2026-09-24.md` Tier C |

## 4. Later / backlog (decided direction, not scheduled)

- Freshness residuals: Home masthead shows today's date + "tracked today" over 11-day-old stories; `/daily` masthead reads "Today's Brief" for an older edition.
- Worker bot pre-render for `/daily` has the same 7-day cap the page had (fix with the Worker deploy).

- Analysis Studio lenses: **"Bilateral relationship"** (pairs' future home) and **"Country deep-dive"** (reads country intelligence; only after C7). Both recorded, not built.
- Review P2/P3 leftovers: terminology ("story" everywhere public), `/breaking` + `/weekly-markets` nav gap (solved by C4's alert stack), sitemap coverage, remaining document titles.
- `/country/:name` rename (19 call sites + a hard-coded share URL): deferred.
- Needs repro before fixing: Home "Summary shows nothing" (seen once while signed in; not reproducible anonymously).
- Tooling: re-baseline `scripts/smoke-test.mjs` selectors (they produced false "blank page" reports).
- Small UX: an "unavailable" message when a story's summary doesn't exist yet.

## 5. Done today (2026-09-24)

- ✅ Cleanup audit + execution (~2,800 lines of dead frontend code, 2 retired Lambda dirs, broken one-offs, 2 unused deps, S3 residue)
- ✅ Legacy map removed; pair cron disabled; pair + country-intelligence futures recorded
- ✅ Docs staleness sweep; task-file convention + pre-commit doc-guard hook
- ✅ Context hygiene: CLAUDE.md 237→77 lines, memory 82→55 files, foreign CLAUDE.md files excluded, autoMode rescoped
- ✅ Frontend feature-folder restructure P0–P12 (byte-identical bundles throughout)
- ✅ `test-disruption-gate.mjs` fixed (Node 22 JSON import)
- ✅ Whole-site page review (10 P1 / ~14 P2 / ~14 P3) + page-structure proposal and challenge, adjudicated

## Page redesign roadmap (status 2026-09-25; design stage, nothing built unless noted)
| Page | Status | Next |
|---|---|---|
| Home `/` + `/map` | ✅ designed: operations console (globe/radar), story card, StoryPeek, legend | build after the S6 gate |
| Story page `/weekly/thread/:id` | ✅ designed: STORY MODE + "Read in full" | build = C11 |
| Threads board `/weekly` | ✅ designed: Intel board (columns / table / map / WEB story graph) | build with C11 |
| Briefings (`/daily` + `/weekly-brief` → `/briefings`) | ◐ designed as editions, but in the old light style | console restyle pass |
| Economy `/economy` | ⏸ parked, soft-hidden | after the DeepSeek top-up |
| Country page `/weekly/country/:name` | ✅ designed (25 Sep): **country card on the map** (5 states, honesty rules) + deep-dive in the Studio; the URL stays public with the card content | build later (needs `country_facts`, slim history, rank) |
| Countries list `/weekly/countries` | ✅ direction: map "countries" layer + ranked list with freshness on every row | with the country card |
| Track record `/track-record` | ☐ to redo: B (worst contrast on the site, mobile overflow, counters don't sum); key trust page | after country |
| Analysis Studio `/analyze` | ☐ extend: new lenses (country deep-dive with web, bilateral, explain-the-web); credits copy | after track record |
| `/breaking` | retire into the home alert stack | with the home build |
| `/spider-demo` | retire into story mode, the board WEB view and the Studio lens | with C11 |
| Membership / account / sign-in | light touch: nav presence; signed-out `/account` framing | small fixes |
| About / whitepaper / privacy / disclosures / contact | light touch: stale "hourly" claims | small fixes |

## Design canvas map (https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW, cleaned 2026-09-25)
Only approved designs remain. Sources are in `project-docs/redesign-ux/_reference/wireframe-2026-09-24/`; the removed boards' sources are kept there as history.
| Board | What it is |
|---|---|
| A1 Console · A2 ConsoleRadar | Home console: globe (desktop) / radar (phone) |
| A3 ConsoleCard · A4 StoryPeek | Story card on the home map · shared hover preview |
| A5 Legend | Map symbols = default map tokens |
| B1 StoryMode | Story page default: map + slides + time scrubber |
| B2 StoryWeb · B3 StoryMobile | "Read in full" long page (desktop / phone) |
| B4 Board | Threads board: board / table / map / web (story graph) |
| C1 CountryCard | Country card on the map, 5 real states |
| D1 Briefings | Briefings editions, old light style (needs the console restyle) |
Removed as superseded: Main (v1 light home), Mobile (v1 phone home), Dossier (v3 story dossier with the lane web).
