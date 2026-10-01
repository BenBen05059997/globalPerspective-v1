## Dark site on one shared token set + Stories A + C — 2026-10-01 — active

**Goal:** the whole site uses ONE colour/token set (the console look) instead of a light default with a per-component dark scope, every page sits in the same dark frame with the same loader, the light pages are converted by moving them onto shared building blocks (not by recolouring 1,926 literals one by one), and `/weekly` becomes the approved A + C (intel-feed list + 30-day timeline). Operator 2026-10-01: "a plus c is better"; "we need share token for this part … this is a good chance we simplify things"; "you can do it with the sonnet once you have the plan".

**Ground rules (operator rules, binding on every phase):**
- **Nothing is removed without an operator yes.** Retirement candidates (`/breaking`, `/spider-demo`, `/weekly-markets`, the 12 topic colours as a filter, the old Stories "Map" view, "Rising this week", Board/WEB views) are kept working and only restyled; each is listed under "Open" for a decision. Removing dead CODE after its last use moves (e.g. the old loader component) is fine.
- No placeholder UI; fail empty and honest; public data hooks never gate on sign-in; never invent facts.
- No deploy, no `docs/` edits, no AWS/Cloudflare changes. Each phase is committed by the monitor after verification; deploy needs a fresh operator yes.
- UI work is done only after every touched control is exercised in a browser (Playwright, Chrome for Testing, 1440 and 390).

**Measured starting point (2026-10-01):**
- `shared/styles/tokens.css`: light `:root` palette (74 custom properties) + a console block (48) applied only under `.gp-console`. `shared/styles/tokens.js` (14 importers) holds risk + 12 category colours in JS.
- 1,926 hard-coded colour literals across 84 files (`threads/WeeklyPage.css` 544, `threads/components/WeeklyMap.css` 144, `map/SituationHome.css` 130, `account/Account.css` 78, …).
- Live page backgrounds: only desktop `/` is dark end to end. Story page, `/briefings`, `/account` are dark panels inside the light nav/body/footer. Fully light: `/weekly`, `/weekly/countries`, `/weekly/country/:name`, `/daily`, `/weekly-brief`, `/analyze` (signed out), `/track-record`, `/today`, `/pricing`, `/about`, `/privacy`, `/disclosures`, `/breaking`.
- Loading: the new `BootLoader` covers only the pre-JS boot and the route `Suspense` fallback (light compact variant off `/`). Page data loading still uses `shared/ui/IntelligenceLoader` (daily, ThreadPage, WeeklyPage, TrackRecordPage/Text, CountryPage, AuthCallback), plain "Loading…" text (WeeklyPage, Account), and `app/layout/LoadingBar` (+ `AIToast`).

**Reads / references:** `REDESIGN_MASTER_PLAN.md` §3 (DS1 tokens, shell N1, legend, risk = number + tier word + ring weight, freshness, 44px), §3.4 decision note of 2026-10-01; options canvas https://claude.ai/artifact/D6jnNHFsJFRRvGnAJAAJp5 (A desktop + phone, C timeline); `features/map/` (HudIntelFeed, legend.js — the row / glyph / tier vocabulary to share); `shared/ui/boot/`; `TASK_2026-10-01_boot_loader.md`; `ARCHITECTURE.md` Frontend section; `quality/verify_pages.sh`; `quality/boot_tokens_guard.mjs`.

### Phases

**P1 · One token set + dark frame + ratchet guard**
- `tokens.css`: one `:root` palette with role names (background, panel, panel-2, hairline, text, text-head, text-dim, accent, crisis hues ×4, freshness ×4, tier outlines, warning amber, focus ring, radii, spacing, type, 44px tap). Console values are the defaults. Old light names and the `--c-*` names stay as ALIASES to the new values for the migration (so nothing breaks); `.gp-console` becomes a harmless no-op class.
- `tokens.js` exports the same values (read from one shared constant; a test asserts JS == CSS).
- Shell: body, nav, footer, phone tab bar dark on every page (the console bar everywhere, not only `/`). Keep the desktop `/` full-bleed behaviour.
- `index.html` pre-JS boot + Suspense fallback: dark on every path (compact variant off `/`); update `boot_tokens_guard.mjs`.
- Guard (ratchet): `quality/color_literals_baseline.json` records today's literal count per file; `verify_pages.sh` fails if any file's count goes UP or a new file adds literals. Counts may only fall.
- Expect light pages to look wrong after P1 alone (light cards on a dark frame) — P1 and P2/P3 are committed separately but deployed together.

**P2 · Shared building blocks + one loader**
- `shared/ui/`: `StoryRow` (crisis-hue bar · tier chip · status glyph · title · place · last change · freshness amber · StoryPeek on hover/focus · whole row is the link), `TierChip` (tier word + ring weight, number when known, "not scored" state), `StatusGlyph` (▲●◆▼ from the map legend), `PageFrame`/section header, `FilterGroup`. Move shared vocab from `features/map/lib/legend.js` into `shared/` where `shared` must own it (dependency rule: shared never imports features).
- Map's `HudIntelFeed` uses `StoryRow` (no visual change on the map beyond alignment).
- `BootLoader` inline variant replaces `IntelligenceLoader`, the "Loading…" texts and `LoadingBar` everywhere; delete `IntelligenceLoader`/`LoadingBar` code once unused (keep `AIToast` behaviour, restyled).

**P3 · Convert the light pages (onto tokens + building blocks)**
- In this order, before/after screenshots at 1440 and 390 for each: `/weekly/countries`, `/weekly/country/:name`, `/daily`, `/weekly-brief`, `/track-record`, `/analyze` (signed out + signed in states reachable), `/today`, `/pricing`, `/about`, `/privacy`, `/disclosures`, `/breaking` (restyle only), plus a re-check of story page, `/briefings`, `/account` in the new frame.
- Replace literals with tokens; lists become `StoryRow`; risk pills become `TierChip`.

**P4 · Stories `/weekly` = A + C**
- A: header (Stories | Countries tabs, open count by tier, sensor freshness line), left filters (crisis type ×4, tier, window 24h/7d/30d, region, search, **sort kept**: most covered / most recent / rising first), groups Moving now / This week / Older 7–30 d (amber) with "show more", >30 d behind an Archive control, right rail "Changed since your last visit" (signed-out: hidden or Moving now only — no fake data).
- C: a Timeline view toggle (List | Timeline | Map — the existing Map view is KEPT): one line per story across the window, a dot per REAL coverage day from the archive data; no invented dates.
- Phone: READ / MAP / CHANGES tabs, filter chips ≥44px.
- Keep every current capability reachable (search, period, sort, region, map view, Countries tab, earlier-this-month list, show more). "Rising this week" survives as the "Rising first" sort unless the operator says otherwise.

**P5 · Sweep + docs**
- Playwright sweep of every route at 1440 + 390: background, no light frame, no old loader, no overflow, no console errors, every touched control clicked. `ARCHITECTURE.md` (Frontend tokens + shared UI), `REDESIGN_MASTER_PLAN.md` build status, `CHANGES.md` per phase, `INDEX.md` row, status → done.

### Changes (code) — updated per phase
- **P1 (done 2026-10-01, not committed/deployed):**
  - `shared/styles/tokens.css`: one `:root` role palette (surfaces `--bg/--panel/--panel-2/--panel-3/--strip/--hairline(-strong,-3)`, text `--text-head/-body/-muted/-dim`, `--accent(-strong,-wash)`, `--on-accent`, `--warn/--ok/--error`, `--hue-*` x4, `--tier-*` x4 (+ `-wash`), `--fresh-*` x4, `--motion-*`, `--tap-min`, `--r-xs`, hud label vars); old light names and every `--c-*` name are aliases; `.gp-console` is an empty no-op rule; heavier shadows; `.btn-gp.primary/.accent` text colours fixed for dark. `app/index.css`: dropped the `--text-muted` alias (now a role token; it would have been circular).
  - `shared/styles/tokens.js`: new `TOKENS` mirror (27 values), `RISK_SOLID` = tier tokens, `riskScoreToVar/riskTierToVar` read `--tier-*` / `--text-head`; exports unchanged. New tests `tokensParity.test.js` (JS == CSS, aliases are `var()`), `colorLiteralsGuard.test.js`; `consoleTokens.test.js` rewritten for the one palette.
  - Shell: `app/layout/Layout.css` rewritten (the console bar is the base `.gp-nav` on every page; dark body, strip, footer, tab bar; `.gp-nav-console` and the dead `.gp-search/.gp-kbd/.gp-nav-div` rules removed; `--nav-h` 52px), `app/layout/Layout.jsx` (nav class `gp-nav gp-console` always; comments), `app/__tests__/layout.test.jsx` (every route shares the nav/footer; Layout.css reads role tokens). Shell pieces that were light: `features/breaking/components/NotificationBell.css` (bell + panel on tokens), `app/errors/ErrorModal.jsx` (white card -> panel tokens; its title was invisible).
  - Boot: `shared/ui/boot/BootLoader.css` (`--light` variant removed, role-token fallbacks, `html` background), `BootLoader.jsx` (always dark; `tone` ignored), `app/App.jsx` (RouteFallback inline = dark), `frontend/index.html` (inline CSS regenerated, compact cover is dark), tests `bootLoader.test.jsx`, `indexHtmlBoot.test.js`; `quality/boot_tokens_guard.mjs` (role names, no light variant, no `--c-*` in the boot CSS).
  - Ratchet: NEW `quality/check_color_literals.mjs` (`--write`, `--lower`), NEW `quality/color_literals_baseline.json` (1,832 literals in 84 files, measured after these edits), `quality/verify_pages.sh` (+4 checks: 97 pass).
  - Docs: `ARCHITECTURE.md` (Frontend tokens paragraph, BootLoader row), `CHANGES.md`.
- **P2 files (to be filled before P2 starts):** `shared/ui/` StoryRow, TierChip, StatusGlyph, PageFrame/section header, FilterGroup (+ tests); `features/map/lib/legend.js` vocab moved to `shared/`; `features/map/components/HudIntelFeed*` onto StoryRow; `shared/ui/boot/` inline variant adopted by every `IntelligenceLoader` / "Loading..." / `LoadingBar` use (daily, ThreadPage, WeeklyPage, TrackRecordPage/Text, CountryPage, AuthCallback, Account); `app/layout/LoadingBar.jsx`, `AIToast.jsx`, `LoadingIndicators.css`; baseline lowered.
- P3-P4: to be filled by each phase before it starts.

### Docs to update on completion
`ARCHITECTURE.md` (Frontend: tokens, shared UI, loaders, `/weekly`), `REDESIGN_MASTER_PLAN.md` (§3.4 + build status), `CHANGES.md` (one entry per phase), `INDEX.md` row, `DATA_STRATEGY.md` only if a data read changes (not expected).

### Open (operator decisions — nothing below is done without a yes)
1. Retire `/breaking`, `/spider-demo`, `/weekly-markets`? (Plan §7 stage 9 lists them; kept + restyled for now.)
2. Stories: keep B4's BOARD and WEB views as further toggles, or drop?
3. Drop the 12 topic colours entirely (crisis type ×4 replaces them as the colour) — topics may stay as text tags.
4. "Rising this week" rail → only the "Rising first" sort?

### ▶ LIVE TRACKER
| Phase | What | Status |
|---|---|---|
| P0 | Plan + measurements | ✅ 2026-10-01 |
| P1 | One token set, dark frame, dark boot everywhere, literal ratchet | ✅ 2026-10-01 (verify 125 files / 929 tests; verify_pages 97 pass; baseline 1,832 literals / 84 files; 17 routes x 1440+390 measured dark, 0 overflow, 0 page errors; uncommitted, monitor commits) |
| P2 | Shared building blocks + one loader | — |
| P3 | Light pages converted | — |
| P4 | Stories A + C | — |
| P5 | Sweep + docs | — |

**Completion checklist:**
- [ ] code (P1–P4)
- [ ] docs updated (same commits)
- [ ] CHANGES.md entries
- [ ] verify + page guards green each phase; browser checks with screenshots
- [ ] no deploy — waits for operator yes
- [ ] status header flipped to `done`
