<!--
Task file per project-docs/playbooks/TASK_TEMPLATE.md (+ TASK_WORKFLOW.md). Executor: update
the LIVE TRACKER + this file's other sections in the SAME commit as each item's code, per the
operator-requested pattern used in TASK_2026-09-24_frontend_feature_folders.md.
-->

## Stage 0 fixes (page-review follow-up) — 2026-09-24 — active

### ▶ LIVE TRACKER (update + clear at the end of EVERY item's commit)

**Operator decision 2026-09-24:** fix-first list approved from `PAGE_REVIEW_2026-09-24.md` §4
(P1 items) + `PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` §6 Stage 0 + §8 monitor adjudication. Full
per-item plan → `STAGE0_FIXES_PLAN.md` (this directory). No deploy until the batched end (frontend)
plus a **separately gated** Worker deploy for item (a) — both need a fresh explicit "yes".

**Now:** item (a) prepared, items (b)-(i) not started.

| Item | What / files | Status | Commit |
|---|---|---|---|
| (a) | SEO 404 + bot pre-render + sitemap — `project-docs/distribution/WORKER_FULL_CODE.md` (SPA fallback branch, prepared, not deployed), `project-docs/architecture/_active/STAGE0_sitemap_proposed.xml` (corrected sitemap content, NOT written to `docs/sitemap.xml` — that's deferred to the operator-gated deploy step per hard rules) | 🟡 prepared — awaiting operator deploy yes | see CHANGES |
| (b) | Freshness honesty (2 bugs) — `features/threads/WeeklyPage.jsx` (fabricated `updatedAt`), `shared/ui/StatusStrip.jsx` (always-LIVE label), `app/layout/Layout.jsx` (static "Updated hourly"), "today" copy audit (Home, Economy) | ✅ done | see CHANGES |
| (c) | Parked-credits copy — `features/analysis-studio/AnalysisStudio.jsx:345`, `features/account/Account.jsx:433`, `app/layout/Layout.jsx` credits pill (gate on `creditPacks().length`, pattern already correct in `MembershipPage.jsx`) | ✅ done | see CHANGES |
| (d) | Onboarding tour mobile-hamburger block + `aria-allowed-attr` — `app/onboarding/useOnboarding.js`, `tour-theme.css` (no `tours.js` change needed — anchor-less welcome step kept) | ✅ done | see CHANGES |
| (e) | Home member-perk sentence → `/membership` not `/track-record` — `features/home/Home.jsx`, `features/home/Home.css` | ✅ done | see CHANGES |
| (f) | De-dupe in-flight proxy requests — `shared/api/restProxy.js` (`useGeminiTopics` called from Home, AnalysisStudio, IntelligenceLoader) | ✅ done | see CHANGES |
| (g) | Route-level code splitting — `app/App.jsx` (`React.lazy` for 20 routes), `features/countries/CountryPage.jsx` (fix static `WeeklyMap` import defeating `WeeklyPage`'s existing lazy split) | ⬜ not started | — |
| (h) | Missing `document.title` (8 pages) — `EconomyPage.jsx`, `TrackRecordPage.jsx`, `AnalysisStudio.jsx`, `MembershipPage.jsx`, `BreakingFeedPage.jsx`, `WeeklyBriefPage.jsx`, `Account.jsx`, `WhitepaperPage.jsx` | ⬜ not started | — |
| (i) | `/daily` dead end — arrows/empty-state only (fallback-to-latest-edition already exists in `useDailyBrief.js`/`DailyPage.jsx` — see plan §0 contradiction note) — `features/daily/DailyPage.jsx` | ⬜ not started | — |
| Deploy | Frontend batch (`./deploy.sh`) for (b)-(i); Worker deploy for (a) is separate | ⬜ not started | — |

**End-of-item ritual (executor, in the item's commit):** flip the row to ✅ with the commit sha,
advance **Now:**, tick the matching row in "Completion checklist" below, update
`CHANGES.md`. The plan's own "Commit grouping" table (STAGE0_FIXES_PLAN.md, near the end) is the
source of truth for which items share a commit.

**Goal:** Ship the 9 operator-approved Stage-0 fixes from the whole-site page review + page-
structure adjudication — cheap, reversible, decision-independent fixes that unblock everything
downstream (SEO visibility, honest freshness signals, parked-feature copy, an accessibility/mobile-
nav bug, a broken funnel link, duplicate network traffic, bundle size, missing page titles, and a
dead-end page) — before any of the larger, decision-dependent restructure stages (naming/nav, URL
migration, page rebuilds) begin.

**Reads / references:**
- `project-docs/architecture/PAGE_REVIEW_2026-09-24.md` §4 (prioritized list) — the source
  findings (10 P1s + 2 P2s make up this task's 9 items; X-2 covers both `updatedAt` bugs in the
  proposal's §8, X-7/D-2 are combined in item (g), X-11 = item (c), X-1 = item (d), A3/E4 = item
  (i), D-9 = item (h), E1-c = item (e), X-6/D-4 = item (f)).
- `project-docs/architecture/PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` §6 (Stage 0 sequencing) + §8
  (challenge + monitor adjudication — the authoritative Stage-0 scope after the operator's
  approved fix-first list, including the fabricated-`updatedAt` bug the challenger found that
  isn't in the original review).
- `project-docs/architecture/_active/STAGE0_FIXES_PLAN.md` — this task's actual per-item
  instructions (goal/files/approach/verification/risk/effort + commit grouping + deploy gating).
- `project-docs/distribution/WORKER_FULL_CODE.md` — canonical Cloudflare Worker source for item
  (a); editing this file is how the Worker actually gets updated (paste into dashboard /
  `wrangler deploy`), separate from the frontend `./deploy.sh` path.
- `project-docs/playbooks/TASK_TEMPLATE.md`, `project-docs/playbooks/TASK_WORKFLOW.md` — task-file
  convention this file follows.
- `CLAUDE.md` (repo root) — verify gate (`npm run verify`), browser click-through rule
  (`feedback_test_ui_in_browser`), frontend deploy workflow + gate (`./deploy.sh`, fresh "yes"
  every time), `docs/config.js`/`docs/sitemap.xml` handling.
- `project-docs/architecture/_active/TASK_2026-09-24_frontend_feature_folders.md` — precedent for
  this task file's live-tracker format and the current (post-restructure) `src/` path layout every
  item's file list depends on.
- `quality/verify_pages.sh`, `scripts/auth-guard-check.mjs` — Layer-7/auth-guard checks to re-run
  per the plan's verify ladder.

**Changes (code):**
- `project-docs/distribution/WORKER_FULL_CODE.md` (item a — Worker source; the live Worker itself
  is deployed out-of-repo via the Cloudflare dashboard/`wrangler`, gated separately)
- `docs/sitemap.xml` (item a)
- `global-perspectives-starter/frontend/src/features/threads/WeeklyPage.jsx` (item b)
- `global-perspectives-starter/frontend/src/shared/ui/StatusStrip.jsx` (item b)
- `global-perspectives-starter/frontend/src/app/layout/Layout.jsx` (items b, c)
- `global-perspectives-starter/frontend/src/features/home/Home.jsx` (items b, e)
- `global-perspectives-starter/frontend/src/features/economy/EconomyPage.jsx` (items b, h — exact
  "today's driver" location to be confirmed by grep at execution time)
- `global-perspectives-starter/frontend/src/features/analysis-studio/AnalysisStudio.jsx` (items c,
  h)
- `global-perspectives-starter/frontend/src/features/account/Account.jsx` (items c, h)
- `global-perspectives-starter/frontend/src/features/account/MembershipPage.jsx` (item h; item c
  is reference-only here, already correct)
- `global-perspectives-starter/frontend/src/app/onboarding/useOnboarding.js` (item d)
- `global-perspectives-starter/frontend/src/app/onboarding/tours.js` (item d, only if last-resort
  anchor change needed)
- `global-perspectives-starter/frontend/src/app/onboarding/tour-theme.css` (item d)
- `global-perspectives-starter/frontend/package.json` (item d, only if a driver.js version bump is
  the fix)
- `global-perspectives-starter/frontend/src/shared/api/restProxy.js` (item f)
- `global-perspectives-starter/frontend/src/app/App.jsx` (item g)
- `global-perspectives-starter/frontend/src/features/countries/CountryPage.jsx` (item g)
- `global-perspectives-starter/frontend/src/features/track-record/TrackRecordPage.jsx`,
  `src/features/breaking/BreakingFeedPage.jsx`,
  `src/features/weekly-brief/WeeklyBriefPage.jsx`,
  `src/features/static/WhitepaperPage.jsx` (item h)
- `global-perspectives-starter/frontend/src/features/daily/DailyPage.jsx` (item i)
- `global-perspectives-starter/frontend/src/features/daily/hooks/useDailyBrief.js` (item i, only
  if the "extend the hook" option is chosen over "derive from `servedDateKey`")

**Docs to update on completion:**
- `CHANGES.md` — one dated entry per commit (pre-commit hook blocks a `frontend/src/**` commit
  without one); the Worker commit (item a) also needs an entry even though it's not under
  `frontend/src`, since it's a production-behavior change.
- `project-docs/architecture/ARCHITECTURE.md` — Cloudflare Workers section (~line 1094 onward):
  update the "Everything else" row in the Worker behavior table once item (a) ships (it currently
  says "Passed through to GitHub Pages unchanged" — that becomes "SPA shell, 200" for non-asset
  paths). Also worth a one-line note if the `StatusStrip` staleness threshold (item b) becomes a
  named, documented constant.
- `project-docs/INDEX.md` — this task file + `STAGE0_FIXES_PLAN.md` aren't yet listed; add a row
  near the existing `PAGE_REVIEW_2026-09-24.md` / `PAGE_STRUCTURE_PROPOSAL_2026-09-24.md` rows
  once Stage 0 is complete (or in progress, if it becomes a multi-session task tracked over time
  like the restructure task was).
- This task file's own header (`active` → `done`) once all 9 items + the batched deploy(s) land,
  per the same rule the restructure task used.

**Completion checklist:**
- [x] (a) SEO 404 fix + sitemap regen — code PREPARED in `WORKER_FULL_CODE.md` + corrected sitemap
      content written to `STAGE0_sitemap_proposed.xml` (not `docs/sitemap.xml` — deferred). Worker
      deploy **operator-gated** (separate "yes" from frontend deploy) — NOT yet requested/run.
- [x] (b) Freshness honesty — both `updatedAt` bugs fixed, "today" copy audited
- [x] (c) Parked-credits copy gated on `creditPacks().length` in all 3 remaining surfaces
- [x] (d) Onboarding tour — mobile hamburger unblocked, `aria-allowed-attr` clean
- [x] (e) Home member-perk sentence → `/membership`
- [x] (f) restProxy in-flight de-dupe shipped (DevTools verification deferred to the monitor —
      executor does not browser-test per this task's hard rules)
- [ ] (g) Route-level code splitting — `App.jsx` lazy routes + `CountryPage.jsx` `WeeklyMap` fix,
      main-chunk size measured before/after
- [ ] (h) `document.title` added to all 8 named pages
- [ ] (i) `/daily` date arrows + empty-state fixed (fallback-to-latest-edition already existed —
      confirmed in plan §0, not rebuilt)
- [ ] Every item: `npm run verify` green, `quality/verify_pages.sh` 32/0, browser click-through
      done per the plan's per-item verification section, `CHANGES.md` entry present
- [ ] Frontend batched deploy (`./deploy.sh`) — fresh explicit "yes", covers items (b)-(i)
- [ ] Worker deploy for item (a) — fresh explicit "yes", separate gate, tested via the curl matrix
      in the plan before being considered done
- [ ] Status header flipped to `done`
