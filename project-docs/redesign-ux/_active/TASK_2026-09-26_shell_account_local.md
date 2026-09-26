## Site shell + account desk + membership, built locally for review — 2026-09-26 — active

### Goal
Build the approved **site shell** (navigation N1 + the phone tab bar P1) and the **account desk** (K1) on branch `map-console`, next to the map console, so the operator can review the whole shell on `localhost`.
- Then the **membership page** (K2), once the operator picks its option and gives the billing "yes".
- **Out of scope:** deploy, merging to `main`, backend / Lambda changes, and new email jobs. v1 uses only data and endpoints that exist today.

**Design sources (approved 2026-09-26, operator: "ok that looks good"):**
- Canvas boards: N1 `Navigation.dc.html`, P1 `PhonePattern.dc.html`, DS1 `DesignSystem.dc.html`, K1 `AccountDesk.dc.html`, K2 `Membership.dc.html`: https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW (section G–H).
- `TASK_2026-09-26_remaining_design.md` (N, P, DS decisions), `REDESIGN_MASTER_PLAN.md` §3.1.

**Why (philosophy):**
- **The shell:** one plain menu, the same URLs, and one honest "paused since" line everywhere. A reader should never have to relearn the site from page to page.
- **The account:** an analyst's desk that answers "what am I following, what changed since I last looked, what did I save, what will I be told". Settings come last.
- **Membership:** sells only what works today.

### Decisions still open (operator)
| # | Question | Blocks | Recommendation |
|---|---|---|---|
| K-a | Membership: **(a)** honest now, **(b)** pause sign-ups, or **(c)** the new-design goal | Phase A5 (copy + structure) | (a) now, (c) as the goal after the DeepSeek top-up |
| K-b | Can readers **follow stories** too, or only countries? | Story rows on the desk (a later backend addition) | Countries only in v1 |
| K-c | Keep **Saved** (0 of 13 accounts use it today)? | Desk layout | Keep; it's cheap and exists |
| K-d | White paper: soft-hide it in code now? | Footer in phase A1 | Operator said "hide it first"; do it in A1 unless told otherwise |
| Billing yes | Any edit to the membership page or Polar checkout code | A5 | CLAUDE.md: Polar / billing code needs a fresh "yes" each time |

### Facts this plan relies on (verified 2026-09-26)
- **Accounts:** 13 users, 1 member (`GlobalPerspectiveUserTable`); 0 accounts with saved items or follows.
- **Follows already exist:** `usePreferences` (`followedCountries`, `driftOptIn`) via the user-prefs endpoint; `FollowButton`, `SaveButton`, `useSavedItems`, `useMembership` in `features/account/`.
- **The change log is readable:** proxy `country_history` → `driftNotes` (members get the full chain; anonymous users are capped server-side).
- **Current `/account`:** 702 lines with 5 tabs (profile · membership · saved · notifications · analysis key). `/membership`: 154 lines, $15 / $150 plans, a credits section (parked) and a benefit claiming "Studio on our compute" (broken).
- **Menu:** `Layout.jsx` groups at lines 61–70; `gp-strip` 181–197; tour targets `data-tour="nav-${to}"` (line 101). The only nav guard is `quality/verify_pages.sh:51`.

### Files this task touches (update as scope shifts)
| Phase | Create / edit |
|---|---|
| A1 · Site shell | `src/app/layout/Layout.jsx` + `Layout.css` (N1 menu: Map · Stories · Briefings · Studio · Track record; account at right; credits badge stays gated off; footer: About, Membership, Privacy, Disclosures, Contact, white paper removed per K-d); the site-wide computed status line (reuse `shared/lib/freshness.js` + `useDailyBrief`); `src/app/onboarding/tours.js` targets; `quality/verify_pages.sh` (new menu assertions); tests. **No route renames** (N1: same URLs). "Briefings" links to `/daily` until `/briefings` exists |
| A2 · Phone tab bar | `Layout.jsx` / `.css`: a 5-item bottom tab bar under 900px replaces the hamburger for the main items; the account icon stays in the top bar; 44px; safe-area padding; `/map`'s own MAP / LIST / ALERTS tabs sit below the header, not in the tab bar |
| A3 · Account shell | `src/features/account/Account.jsx` (+ `.css`): console style, left-rail sections **Desk · Alerts & email · Studio · Plan · Profile** (`?tab=` values kept compatible: `saved` → desk, `notifications` → alerts, `analysis` → studio, `membership` → plan, `profile` → profile) |
| A4 · Desk | new `src/features/account/components/Desk*.jsx`: **Since your last visit** (followed countries' `driftNotes` newer than the last visit; computed moves; model explanations labelled; direction-check flag reusing the What-changed rule), **Following** (small map + chips; reuse the map components or a light SVG), **Saved** (`useSavedItems`). Last visit = a per-browser timestamp in localStorage (try/catch) for v1, with no backend. Honest empty states ("You don't follow any country yet · Follow from a country card") |
| A5 · Membership (**gated**) | `src/features/account/MembershipPage.jsx` (+ `.css`): K2 per the operator's option: comparison table with ✓ / ⏸ / ✗ / ◇ states, only true benefits, the parked credits section removed. **Needs a fresh billing "yes" + K-a** |
| A6 · Sign-in | `src/features/account/SignIn.jsx`: a calm console-style screen that says what an account gives (desk, follows, Studio). No auth logic changes (Firebase auth config needs a yes; not touched) |

**Not touched:** Firebase auth config, `newsPolarBilling`, `newsAnalyze`, the user-prefs / saved-items Lambdas, `docs/`, `config.js`, `.env*`.

### Docs to update, per phase, in the same commit
- [ ] this file's tracker row (status, commit, monitor evidence)
- [ ] `CHANGES.md` entry (the hook requires it)
- [ ] `ARCHITECTURE.md` (menu, account sections, new shared parts)
- [ ] `quality/verify_pages.sh` when the menu changes (A1)
- [ ] `REDESIGN_MASTER_PLAN.md` §6 / §7 statuses
- [ ] memory `project_billing_polar.md` when membership copy changes (A5)

### Live tracker
- **How each phase runs:**
  - a Sonnet agent executes it on branch `map-console`;
  - the monitor re-verifies: `npm run verify`, a browser click-through of every touched control (desktop), a Playwright 390×844 phone check (no horizontal overflow, 44px targets), and an honesty check (no feature claimed that doesn't work; dates computed);
  - then it commits on the branch and pushes the branch only.
- **Sizes:** each phase is sized when it starts.

| Phase | Goal | Needs | Status | Commit | Monitor ✓ |
|---|---|---|---|---|---|
| A1 · Site shell | N1 menu, footer, site-wide computed "paused" line, tour targets, page guard | K-d (default: hide the white paper) | ✅ | see git log (branch) | verify 39 files / 338 tests; verify_pages 38/0; browser: 5-item menu, "paused since Sep 12" line on /weekly (agent: also /daily /analyze /track-record /about; not duplicated on /map), Countries → / Weekly brief → work, /whitepaper still loads. Not checked: the phone hamburger (A2 replaces it). **Found (pre-existing, backend):** Stories shows "NEW EVENTS TODAY · updated today" because the archive re-writes 13-Sep stories under today's date. Needs a backend fix + an operator yes |
| A2 · Phone tab bar | P1 bottom tab bar under 900px | A1 | ✅ | see git log (branch) | verify 341 tests; Playwright 390×844: no overflow on 5 pages, content clears the bar (~103px), map sheet ends at the bar top; desktop unchanged. Monitor fixed the tour wording ("today's coverage", "scores our predictions"). Pre-existing: /track-record overflows to 549px (tr-item-cite), logged. Notification bell + credits pill kept in the phone top bar (not in the old hamburger) |
| A3 · Account shell | K1 sections in console style, old `?tab=` links still work | A1 | ✅ | see git log (branch) | verify 40 files / 354 tests; browser (signed in): all 5 rail items, `?tab=membership` → Plan; Playwright 390×844 signed out: no overflow, clears the tab bar. Monitor fixed: "following" listed as a free benefit (it's member-only); restored a badge style the clean-up removed. **For A5:** the moved Plan panel still says membership includes "a monthly allowance of custom analyses" (untrue; shown only when billing is configured) |
| A4 · Desk | Since your last visit · Following · Saved, with honest empty states | A3, K-b, K-c | **Next** (v1: countries only, Saved kept = the recommendations, pending the operator) | — | — |
| A5 · Membership | K2 with only true benefits; credits UI removed | **K-a + billing "yes"** | blocked | — | — |
| A6 · Sign-in | Calm console sign-in screen | A1 | queued | — | — |
| Review | Operator reviews the shell + account + map on localhost | A1–A4, A6 | queued | — | — |

### Completion checklist
- [ ] A1–A4, A6 ✅ on branch `map-console` with monitor evidence
- [ ] A5 done after K-a + the billing "yes" (or explicitly deferred)
- [ ] `npm run verify` green; the Playwright phone check passes
- [ ] operator reviewed on localhost
- [ ] docs updated in the same commits; CHANGES.md entries
- [ ] no deploy and no merge without a fresh operator "yes"
- [ ] status header flipped to `done`
