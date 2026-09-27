## Remaining pages, local build (story mode · briefings · country card · Studio · track record) — 2026-09-27 — active

**Goal:** build the remaining approved page designs (REDESIGN_MASTER_PLAN §3.3–3.8, stages 2–6 of §7) on branch `map-console`, **locally for review, no deploy**. This follows the map console (TASK_2026-09-26_map_console_local) and the shell + account (TASK_2026-09-26_shell_account_local), after the full review (REVIEW_2026-09-26_map_console_shell, rounds R1–R4 ✅).

**Operator go:** 2026-09-27, "ok you can do it with sonnet agent and also make sure to update the doc according to our plan too", after "lets get all the things first" (26 Sep). Membership (A5) stays deferred.

**Why this order:** story mode is on the critical path (§7: 1 → 2 → (3, 5c) → 7). Its slide card, time bar and drawers are reused by briefings mode and by the Studio deck. The country card and track record depend only on stage 1 (done).

### Rules for every phase
- **Frontend only.** No Lambda, Worker, IAM or DynamoDB changes. Where a design needs backend work (D5, D6, D7, D8, D9, D10), build the frontend against the data that exists today and **fail empty and honest** where it doesn't; log the gap in this file.
- **Never invent facts or dates.** Every date comes from a real timestamp. No placeholder UI.
- **Shared parts first.** Reuse `@/shared/ui/StoryPeek`, `usePeek`, `freshness.js`, `crisisHue.js`, the DS1 `.gp-console` tokens, `BottomSheet`, the map components and the legend tokens. Don't fork them.
- **Phone = P1 + PH.** READ first, with **horizontal slides** (one at a time, swipe or ◀ ▶), a MAP tab (the WebGL map loads only then) and a third tab. 44px targets; reduced motion = instant cuts.
- **Same URLs** (N1). `/weekly/thread/:threadId` stays the story URL. The only new route is `/briefings`.
- **Each phase:** a Sonnet agent builds it (uncommitted) → the monitor re-verifies (`npm run verify`, page guards, browser click-through of every touched control on desktop + 390px phone, the data-honesty check, and that the /map globe still spins) → commit on the branch with a CHANGES.md entry + this tracker row. **No push to main, no deploy.**

### ▶ LIVE TRACKER
| Phase | What | Status | Commit / evidence |
|---|---|---|---|
| S2.1 | **Story mode, desktop:** map + horizontal slides (BRIEF → CH1–CH4 → FED INTO → WATCH), bottom time scrubber (news per day, chapters, ⚑ turning point, TODAY, ◆ deadlines), drawers WHY / WHO / VIEW FROM / SOURCES; S5 amber after 7 d / hide after 30; S6 skip FED INTO without links; S7 approximate places | **Now** | |
| S2.2 | **Story mode, phone + "Read in full":** P1 tabs READ / MAP / TIMELINE; the long, accessible page (timeline chapters + "Show linked news"; Why = cause chain + the news it's judged to feed into, with shared actors); story-card extras deferred from R4 (in-text links, TIMELINE / OUTLOOK jumps, most likely, fact / inference marks) | Queued | |
| S3 | **Briefings mode at `/briefings`:** DAILY (the day → 8 top stories → country to watch) and WEEKLY (the week → 6 signals → next week); editions strip (solid = published, dashed = no edition); READ AS TEXT; the menu's Briefings item points here; `/daily`, `/daily/:dateKey`, `/weekly-brief` kept; `/weekly-markets` → `/briefings` with a paused note | Queued | |
| S4 | **Country card v2 + countries layer:** one-screen card on the map (state line → facts only if verified → summary → RISK + DIRECTION → 4 risk bars → latest change with a cited event → ≤3 stories → ≤2 dated triggers → Studio button); the 5 states; the direction rule; the watch flag; Countries tab in Stories; `/weekly/country/:name` shows the card content | Queued | |
| S5a | **Studio fixes (D3):** web sources `[W#]` (no Perplexity `[n]` collision); failed checks → hidden + not shareable; remove the live credits copy; read the provider `usage` for the receipt | Queued | |
| S5b | **Studio stored-data feed (D2) + quote / receipt:** archive snippets, thread analysis, history / drift log, prediction snapshot into `buildAnalysisContext`; typed sources `[n]` with `generatedAt`; quote before the run, receipt after | Queued | |
| S5c | **Studio deck (F1 + F2 + F3) + D4:** map + slide card + time bar; the 4 lenses (Scenario / Compare / What changed / Free-form), one picture each; "+ Add analysis" on the same frozen sources; DECK \| BOARD toggle (off on phones); `places[]` + `by` date in gp-struct; our data vs this run (sand hatching) | Queued | |
| S6 | **Track record E2 (+ E1 text version):** stage-0 wording now; accuracy locked until 150 resolved; forecast board MAP \| BOARD; settling log; ledger; fix the 549px phone overflow | Queued | |

### Gaps that need backend work (not in this build; each needs an operator yes)
- **D5** share Lambda (Studio share links + the signed-out example): new Lambda + IAM.
- **D6** scoring pipeline M2–M4 (track record): M2 needs DeepSeek (Y1).
- **D7** country facts / rank / slim history (country card): proxy actions + Wikidata job.
- **D8** story web stage 2 (story mode FED INTO coverage): needs Y1.
- **D10** Worker pre-render for `/briefings`: Worker deploy.
- From the review: the `/weekly` archive re-dating, the "Not yet checked" backend count, the `country_intelligence` 15-name cap.

**Reads / references:** `REDESIGN_MASTER_PLAN.md` §3.3–3.8, §4, §7; `STORY_WEB_RETHINK_PLAN.md` §5, §7, §8; `TRACK_RECORD_AND_STUDIO_RULING.md`; `COUNTRY_VIEW_DISCUSSION.md`; `TASK_2026-09-26_remaining_design.md` (N1, P1, DS1); `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md`; canvas boards in `project-docs/redesign-ux/_reference/wireframe-2026-09-24/`; `project-docs/architecture/ARCHITECTURE.md` (Frontend Path map).

**Changes (code):** under `global-perspectives-starter/frontend/src/`. Each phase lists its exact files in its tracker row when it lands.
- S2: `features/threads/` (ThreadPage + new story-mode components / hooks / lib + tests), `shared/ui/` (slide card, time bar, drawer if shared).
- S3: new `features/briefings/`, `app/App.jsx`, `app/layout/Layout.jsx`, `features/daily/`, `features/weekly-brief/`.
- S4: `features/countries/`, `features/map/` (country card, countries layer).
- S5: `features/analysis-studio/`.
- S6: `features/track-record/`.
- Page guards in `quality/verify_pages.sh` where a route or heading changes.

**Docs to update on completion:** this tracker (every phase); `CHANGES.md` (every phase); `REDESIGN_MASTER_PLAN.md` §7 stage status; `project-docs/INDEX.md` row; `ACTION_CHECKLIST.md` rows; `ARCHITECTURE.md` Frontend Path map (new `features/briefings/`) at S3.

**Completion checklist:**
- [ ] S2.1 · [ ] S2.2 · [ ] S3 · [ ] S4 · [ ] S5a · [ ] S5b · [ ] S5c · [ ] S6
- [ ] docs updated in the same commit as each phase
- [ ] CHANGES.md entry per phase
- [ ] verify + page guards pass every phase
- [ ] no deploy (deferred to the operator's review + deploy yes)
- [ ] status header flipped to `done`
