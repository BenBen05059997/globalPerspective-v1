# Accessibility audit, frontend (2026-11-02)

Scope: `global-perspectives-starter/frontend/src` and `index.html`, at commit `db3d7d96` (origin/main).
Method: static review of the source, plus a real run: `npm ci`, `npm run build -- --outDir /tmp/fe-a11y`,
`vite preview`, Playwright/Chromium with axe-core 4.11.4 (default rule set, WCAG 2.x A/AA plus best-practice)
on every route in `src/app/App.jsx`, and a Tab-key walk. Report only: no code was changed, nothing deployed, no AWS.
All paths below are relative to `global-perspectives-starter/frontend/src/` unless they start with `index.html`.

Caveat that applies to every runtime result: `/config.js` was stubbed with unreachable endpoints, so the
pages rendered their **empty/error states** (no stories, no briefs, no archive, signed out). The one exception is
`/`, which was also run with `fixtures/world.json` served as the world bundle. Findings marked "static" are
from reading the code and were not exercised at runtime (member-only pages, data-dependent branches).

## Summary

32 findings: **6 high, 16 medium, 10 low** (severity key: high = fails a Level A/AA criterion with no keyboard or
screen-reader workaround; medium = fails or risks A/AA with a workaround or narrow reach; low = best practice,
robustness or AAA).

axe-core, 27 page loads (21 routes desktop, 6 phone): 3 critical and 20 moderate rule hits (rule x page load; axe
"impact" scale), 0 serious,
0 `color-contrast` violations (some contrast checks came back "incomplete", see axe section).

| axe impact | rule | pages |
|---|---|---|
| critical | aria-valid-attr-value | phone `/weekly` (1) |
| critical | aria-required-children, aria-required-parent | bell menu open (any page) |
| moderate | page-has-heading-one | 10 loads: `/briefings` (d+p), `/board`, `/weekly` (d+p), `/weekly/thread/:id`, `/weekly/countries`, `/weekly/country/:name`, `/auth/callback`, 404 |
| moderate | landmark-no-duplicate-main, landmark-main-is-top-level, landmark-unique | `/today` (d+p), `/weekly/countries` |
| moderate | heading-order | phone `/` |

Colour tokens: the app ships **one theme (dark)**; there is no light theme (no `prefers-color-scheme` or
`data-theme` anywhere in `src/` or `index.html`; `indexHtmlBoot.test.js` asserts it for the boot copy). Every text/surface pair that CSS
actually uses passes AA (lowest 4.50:1). The only contrast failures are text dimmed again with `opacity`
(2 findings). Focus rings are present and visible on every control reached by Tab (accent, 10.7 to 11.5:1).

What is already good (checked, no action): `html lang="en"`; viewport allows zoom; one shared 2px focus ring
(`primitives.css`); 44px touch targets; `Tabs` has roving tabindex and arrow/Home/End keys; `BottomSheet`
focuses in, traps Tab at the full stop, restores focus, closes on Escape; `RadarMap` markers are
`role=button` with `tabindex=0` and Enter/Space; `usePeek` closes on Escape (WCAG 1.4.13); `BootLoader` is
`role=status` with a label; reduced-motion handled in tokens, boot, radar, sheet and most feature CSS; the
Intel feed is a full keyboard alternative to the pointer-only globe; no colour literals on text; risk is
never colour-only (number + tier word + ring weight).

## Findings, ranked

Severity, then reach. "WCAG" is the success criterion. Fix = smallest change that works.

| # | Sev | WCAG | Page / component | File:line | What | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | High | 4.1.2, 2.1.1, 2.4.3 | Notification bell, every page where `USER_PREFS_ENDPOINT` is set | `features/breaking/components/NotificationBell.jsx:54,66,80,92` | Panel is `role="menu"` with `role="menuitem"` links but is not a menu: axe reports aria-required-children + aria-required-parent (critical) because `ul/li` sit between; ArrowDown does nothing; focus stays on the bell on open; Escape (`:30`) closes the panel and, with focus in the list (after Tab), drops focus to `<body>` (verified in browser). | Drop `aria-haspopup`, `role="menu"` and both `role="menuitem"`; keep `aria-expanded` (disclosure pattern); on Escape call `bellBtnRef.current.focus()`. |
| 2 | High | 2.4.3, 4.1.2 | `/today` archive modal | `features/home/components/ArchiveTopicModal.jsx:48-49` | `role="dialog" aria-modal="true"` but nothing moves focus into it, nothing traps Tab, nothing restores focus; background stays tabbable. Escape works (`:19`). | On mount focus the close button (ref); restore the opener on unmount; trap Tab as `BottomSheet.jsx:56-84` does (extract that effect into a hook and use it in both) or set `inert` on `#root` while open. |
| 3 | High | 2.1.1, 4.1.2 | Country page coverage list (static) | `features/countries/CountryPage.jsx:155` | `<div className="cp-coverage-row" onClick=...>` is the only control that expands an item (sources, "View full story", AI tabs). No role, tabindex or key handler: keyboard and screen-reader users cannot open any coverage item. | Make it `<button type="button" className="cp-coverage-row" aria-expanded={isExpanded}>` (a button can hold the existing spans). |
| 4 | High | 2.1.1, 4.1.2 | Stories map view `/weekly?view=map` (static) | `features/threads/components/WeeklyMap.jsx:629` | `<div className="wmap-thread-info" onClick=...>` selects a thread; not focusable. Keyboard users cannot open a thread from the panel. | Same: render as `<button type="button">`; keep the sibling play button. |
| 5 | High | 4.1.2, 1.3.1, 3.3.2 | Unnamed `<select>`s (static; axe `select-name` would flag) | `features/account/Account.jsx:232-233` (digest Frequency); `features/threads/components/WeeklyMap.jsx:520` (region filter) | Visible text is a sibling `<span>` not tied to the control; WeeklyMap select has no text at all. | Account: `<label className="acct-row__label" htmlFor="acct-cadence">` + `id` on select. WeeklyMap: `aria-label="Filter threads by region"`. |
| 6 | High | 2.4.3, 2.4.7 | Map `/` boot overlay in its failure state | `features/map/SituationHome.jsx:317-322`, `shared/ui/boot/BootLoader.jsx` | While the full-screen overlay is open (any sensor failed: RETRY / OPEN ANYWAY shown) the page behind stays tabbable. Walk on `/` with the news sensor failing: 16 of 21 Tab stops landed on controls covered by `.gp-boot` (focus ring invisible to the user). The same overlay is shown while sensors are still loading (same code path, not measured separately). | While `bootOpen`, set `inert` on `#root` (the overlay is portalled to `body`, so it stays live), remove in the `onDone`/unmount cleanup. |
| 7 | Med | 4.1.2 | Phone `/weekly` tabs | `shared/ui/Tabs.jsx:51`; `features/threads/components/StoriesHeader.jsx:68-72` | Selected tab has `aria-controls="sf-tab-panel-read"`; no element has that id (axe critical aria-valid-attr-value, phone `/weekly`). `Tabs` always emits `aria-controls`. | In `Tabs`, emit `aria-controls` only when `document.getElementById(ids.panel)` exists, or give `EditorialShell`'s centre column `{...tabPanelProps('sf-tab', active)}` for that page. |
| 8 | Med | 1.3.1, 4.1.1 (landmarks) | `/today`, `/weekly/countries`, Stories/Country/Thread pages with data | `shared/ui/EditorialShell.jsx:19` inside `app/layout/Layout.jsx:189` | `EditorialShell` renders `<main>` inside the shell's `<main class="gp-main">`: 2 mains, nested; axe landmark-no-duplicate-main / main-is-top-level / unique on 3 loads. Used by Home, WeeklyPage, ThreadPage, CountryPage, CountryListPage. | `EditorialShell`: `<main>` to `<div className="es-center">` (Layout already supplies `<main>`). Check `.es-center` CSS selectors are class-based (they are). |
| 9 | Med | 2.4.1 | Whole site | `app/layout/Layout.jsx:117-189` | No skip link. Tab reaches content only after 8 stops (brand, 4 nav, help, bell, sign-in) on every page (walk). `<main>` exists as a landmark, which is only a partial mechanism. | Add first child of `.gp-app`: `<a className="gp-skip" href="#main">Skip to content</a>`, `id="main"` + `tabIndex={-1}` on `<main>`, a `:focus-visible` reveal rule. |
| 10 | Med | 2.4.2 | Missing / duplicate titles | `features/static/PrivacyTerms.jsx`, `Disclosures.jsx`, `Contact.jsx`, `features/board/BoardPage.jsx`, `features/account/AuthCallback.jsx`, `NotFound` at `app/App.jsx:52`; `/` and `/today` share one title (`SituationHome.jsx:208`, `Home.jsx:166`) | These routes never set `document.title`. Direct load gives the generic index.html title; client-side navigation leaves the **previous page's title** (e.g. "Story Intelligence" on `/privacy`). | One `useDocumentTitle(title)` hook in `shared/hooks`, called by each of these pages (most feature pages already set a title in a `useEffect`). Give `/today` its own title. |
| 11 | Med | 4.1.3, 2.4.3 | SPA route changes | `app/layout/Layout.jsx` (no `useLocation` effect), `app/App.jsx` | After a client-side navigation nothing is announced and focus is not moved (focus stays on the clicked link or falls to `<body>` when the link unmounts). Scroll position is not reset either. | In `Layout`, on `location.pathname` change focus `#main` (`tabIndex=-1`, `preventScroll` off) and update a visually-hidden `role="status"` with `document.title`. |
| 12 | Med | 1.3.1, 2.4.6 | Routed pages with no `<h1>` | `/weekly` all states (`features/threads/components/StoriesHeader.jsx` has no heading; first heading is the h3 empty state `WeeklyPage.jsx:149`); `/weekly/countries` (`CountryListPage.jsx` uses only `SectionHeader` h2); 404 `app/App.jsx:55-56` (h2); `/auth/callback` error `AuthCallback.jsx:36` (h2); `/weekly/thread/:id` not-found `ThreadPage.jsx:305` (h3); `/weekly/country/:name` not-found `CountryPage.jsx:589` (h3, fallback h2); `/briefings` error state (`BriefingError.jsx`, no heading); `/board` when unavailable (`BoardPage.jsx:176`) | axe page-has-heading-one on 10 loads. `/weekly` and `/weekly/countries` have no h1 even with data. Briefings and Board have an h1 only once data / sign-in state exists. | Add a visually-hidden h1 (reuse the `.sh-sr-only` pattern, move it to `shared/styles`) to StoriesHeader ("Stories") and CountryListPage; promote the h2/h3 in 404, auth callback and not-found states to h1; give `BriefingError` / board-unavailable an h1. |
| 13 | Med | 4.1.3 | Async status not announced | `app/layout/AIToast.jsx:41`; `features/account/Account.jsx:261`; `features/account/MembershipPage.jsx:104`; `shared/ui/SubscribeCard.jsx:80`; `features/analysis-studio/SharedAnalysisPage.jsx:82`; `features/home/components/TodayArchiveSidebar.jsx:89`, `WeeklyMap.jsx:586` (result counts); `shared/ui/CopyBriefing.jsx:19`, `ShareButtons.jsx:85` (copied state); `features/account/SignIn.jsx:78-96` (form replaced by "Check your inbox", no focus move) | The "Generating..." toast, error blocks, "no matches" lines and copy confirmations change without `role=status` / `role=alert`. (Many other states are correct: briefings, weekly, sign-in error, board.) | Add `role="status"` (toast, copied, empty-result lines) and `role="alert"` (the four error blocks) on the existing elements; focus the `<h1>` in the SignIn "sent" branch. |
| 14 | Med | 1.3.1, 3.3.2, 1.3.5 | Search / email inputs with placeholder only | `features/account/SignIn.jsx:128` (email: no label, no `autocomplete="email"`); `features/threads/components/WeeklyMap.jsx:575` ("Search threads...") | Name comes from the placeholder only (axe accepts it, WCAG 3.3.2 does not) and disappears on input. The email field collects the user's own address, so 1.3.5 (AA) wants `autocomplete="email"`. | Add `aria-label="Email address"` + `autoComplete="email"`; `aria-label="Search threads"`. (Other inputs checked and labelled: FilterGroup, AddPinPanel, VerdictCard, DivergencePanel, WeekScrubber, CountrySheet, CountryListPage, TodayArchiveSidebar, StoriesFilters.) |
| 15 | Med | 4.1.2, 2.1.1 | Saved panel card (signed-in, static) | `features/account/components/SavedPanel.jsx:87` inside `Card as={Link}`/`EntityLink` at `:99-112` | A `<button>` (Remove from saved) is nested inside an `<a>`: invalid, unreliable in screen readers, and the click may also navigate. | Make the card a non-link container; put the link on the title only and keep the button as its sibling. |
| 16 | Med | 4.1.2 | Globe focus stop on `/` (desktop) | `shared/map/SituationMap3D.jsx:607-624`; `app/index.css:101`; `shared/map/mapKit.css:9` | deck.gl's `.deck-events-root` (tabindex 0) is the 13th Tab stop on `/`: no role, no name, no hint. The canvas has no label. Pins/countries are pointer-only (comment `SituationMap3D.jsx:256-258`); the Intel feed beside the map is the keyboard route (good). | Name the stop: set `aria-label="Globe. Arrow keys rotate. Situations are listed in the Intel feed."` and `role="group"` on `.deck-events-root` after mount (ref on DeckGL), or `tabIndex=-1` it since the feed covers keyboard users. |
| 17 | Med | 2.2.2 | Breaking strip on `/today` | `features/breaking/components/BreakingStrip.css:34-36` | `bk-pulse` runs `infinite`, auto-starts, no pause, not covered by a reduced-motion rule. | `@media (prefers-reduced-motion: reduce) { .bk-strip-dot { animation: none; } }` (and consider dropping the pulse). |
| 18 | Med | 1.4.3 | Risk scorecard "no data" axis | `shared/ui/risk/RiskScorecard.css:120,127-131` | `.riskcard-axis.is-null { opacity: .55 }` makes `--text-dim` text about **2.4:1** on `--panel-2` (body label about 4.5:1). Text is informational, not a disabled control. | Remove the row opacity; keep italic + `--text-dim` (5.2:1). |
| 19 | Med | 1.4.3, 1.4.11 | Briefings editions strip, "not yet checked" marks | `features/briefings/components/EditionsStrip.css:27` | `.bm-edition-unknown { color: var(--text-dim); opacity: .6 }` gives about **2.7:1** (`?` glyph and date label) on an enabled, clickable button. | Drop the `opacity`; use `--text-dim` (5.6:1) and distinguish by the `?` glyph and dashed border. |
| 20 | Med | 1.4.11 | Text-field boundaries | `.sf-search` `features/threads/Stories.css:36`; `.clp-search` `countries/CountryListPage.css:16`; `.archive-rail-search` `home/components/TodayArchiveSidebar.css:23`; `.wmap-search-input` `threads/components/WeeklyMap.css:88`; `.cs-input` `countries/components/CountrySheet.css:16` (all `--hairline`, **1.44 to 1.51:1**); `.acct-signin-input` `account/SignIn.css:88`, `.board-input` `board/board.css:117`, `.acct-select` `account/Account.css:171` (`--hairline-strong`, **2.0 to 2.1:1**) | The field fill is within 1.07:1 of the page, so the 1px border is the only cue that a field exists and it is under 3:1. | Use `--hairline-3` (3.12 to 3.14:1) for field borders, or add a token `--field-border` and point the eight rules at it. |
| 21 | Med | 1.3.1 | Heading order | `features/map/components/MapAbout.jsx:30,34-36` (h2 then h4 x3, phone `/`, axe heading-order); `features/home/components/ArchiveTopicModal.jsx:52,122` (h3, h4 with no h1/h2 in the dialog) | Skipped levels. | `MapAbout`: h4 to h3 (the later "Elsewhere" h3 is then correct). Modal: h2/h3. |
| 22 | Med | 1.1.1 | Stories map (static) | `features/threads/components/WeeklyMap.jsx:350` | The evolution map `<svg>` has no `role`/label and no title; it is the whole view when `?view=map` is selected. Thread list in the panel is the alternative (see #4). | `role="img"` + `aria-label="Map of story threads by region; the thread list is in the side panel"` or `aria-hidden` if the panel is always present. |
| 23 | Low | 4.1.2 | Desktop top nav | `app/layout/Layout.jsx:129-137` | Active link gets class `active` only; the phone tab bar sets `aria-current="page"` (`:221`) but the desktop nav does not. | Add `aria-current={isActive(to, exact) ? 'page' : undefined}` to the desktop `Link`. |
| 24 | Low | 2.3.3 (AAA) / 2.2.2 | Other animations and smooth scroll | `features/home/components/TodayArchiveSidebar.css:63`; `features/threads/WeeklyPage.css:80,125`; `features/countries/CountryCoverage.css:29`; `scrollIntoView({behavior:'smooth'})` at `features/track-record/components/ForecastBoard.jsx:61`, `features/home/components/AiResultCard.jsx:21`, `features/home/components/TopicNav.jsx:62`, `features/countries/CountryPage.jsx:722` | Short fade-ins/flash (200ms to 2s) and four smooth scrolls ignore `prefers-reduced-motion` (there is no global guard). | One global rule in `tokens.css`: `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important} }`; use `behavior: reduced ? 'auto' : 'smooth'` in the four calls. |
| 25 | Low | 1.4.4 | Root font size | `shared/styles/tokens.css:205-206` | `html { font-size: 15px }` and px type tokens: browser zoom works, but the user's default-font-size preference is ignored. | `html { font-size: 93.75% }`; convert `--text-*` to rem over time. |
| 26 | Low | 1.1.1 | 26 inline `<svg>` without `aria-hidden` | `app/layout/Layout.jsx:16,24,31,40,152`; `shared/ui/ShareButtons.jsx:6-33`; `shared/ui/SaveButton.jsx:45,49`; `features/home/Home.jsx:33-43`; `features/account/components/SavedPanel.jsx:58` and others | All sit inside controls that already have a name, so they are harmless in Chromium; Safari/VoiceOver can announce "image". | Add `aria-hidden="true" focusable="false"` to each. |
| 27 | Low | 4.1.2 | `aria-label` on a paragraph | `features/threads/components/StoriesHeader.jsx:55` | `<p aria-label>`: naming a paragraph is prohibited (ARIA 1.2), content is read anyway. | Remove the attribute (the text is already descriptive). |
| 28 | Low | 4.1.2 | Icon controls named by `title` only | `shared/ui/ShareButtons.jsx:85-97` | Copy / Share / X / LinkedIn buttons have `title` and no `aria-label` (title is a weak fallback, absent on touch). | `aria-label` equal to the existing `title`. |
| 29 | Low | 2.4.7 | Focus shown only as border colour | `home/components/TodayArchiveSidebar.css:29,33`; `threads/components/WeeklyMap.css:90,95`; `features/map/SituationHome.css:339` | `outline: none` with a 1px border colour change (hairline to accent, passes 3:1) instead of the shared ring. `.wmap-search-input:focus` has no `-visible`. | Delete the `outline: none` lines so the global ring applies. |
| 30 | Low | 3.2.x | Window-level Escape handlers | `shared/ui/BottomSheet.jsx:47`; `features/home/components/ArchiveTopicModal.jsx:18` | Escape closes the sheet/modal even when pressed inside a native select popup or the bell menu above it. | Handle `keydown` on the dialog node, or ignore events with `e.defaultPrevented`. |
| 31 | Low | 2.1.1 | Board string hit-areas | `features/board/components/BoardMap.jsx:106`; `features/board/components/BoardGraph.jsx:150` | Clickable SVG paths with no key handler. A "strings" list with real buttons (`BoardPage.jsx:359`) is the keyboard route, so this is informational. Board is member-only and was not run. | None, or `tabIndex={0}` + `role="button"` + label on the hit path. |
| 32 | Low | 1.4.3 (open) | Globe attribution text | `shared/map/mapKit.css:15` | `--text-dim` 10px over the NASA night texture; axe returns "incomplete" (31 nodes). Passes only where the texture is darker than about `#232323`. | Give `.sm-attrib` a `background: var(--strip)` pill. |


## Token contrast (WCAG 2.1, computed)

Single theme. Light = not applicable (no light theme exists). Dark ratios; AA normal needs 4.5, AA large needs 3
(large = 18.66px bold or 24px, so no text token here is "large" in practice: the type scale tops out at 64px for
display only). Alpha surfaces are composited over `--bg` (`--panel`, `--strip`) or the stated base.
Method: sRGB relative luminance, `(L1+0.05)/(L2+0.05)`. Pairs are the ones CSS places together in one rule
(co-usage scan of 70 CSS files) plus text-only rules assumed to sit on `--bg`/`--panel-2` (the card ladder).

| Text token | on `--bg` | on `--panel` | on `--panel-2` | on `--panel-3` | on `--strip` | AA normal | AA large | Used with (rule count) |
|---|---|---|---|---|---|---|---|---|
| `--text-head` #eef5f9 | 17.69 | 17.81 | 16.55 | 15.30 | 18.21 | pass | pass | bg 3, panel 1, panel-2 16, panel-3 10; 224 text-only uses |
| `--text-body` #c9d6df | 13.15 | 13.24 | 12.30 | 11.37 | 13.53 | pass | pass | bg 10, panel 4, panel-2 13, panel-3 9, strip 2 |
| `--text-muted` #b9c7d1 | 11.28 | 11.35 | 10.55 | 9.76 | 11.61 | pass | pass | panel 1, panel-2 7, panel-3 4; 227 text-only |
| `--text-dim` #7d8b96 | 5.57 | 5.61 | 5.21 | **4.82** | 5.74 | pass | pass | panel-2 1, panel-3 1, strip 1; 191 text-only (the lowest-margin text token) |
| `--accent` #5fd4ff | 11.46 | 11.54 | 10.72 | 9.91 | 11.80 | pass | pass | links, selected, 95 uses; on accent-wash 9.25 |
| `--accent-strong` #8fe1ff | 13.35 | 13.44 | 12.48 | 11.55 | 13.74 | pass | pass | hover |
| `--warn` #ffb347 | 10.94 | 11.02 | 10.23 | 9.47 | 11.26 | pass | pass | on warn-wash 8.62 (`HudStatusLine`, `Home.css:165`) |
| `--ok` #6fd29a | 10.54 | 10.61 | 9.86 | 9.12 | 10.85 | pass | pass | on ok-wash 8.22 (`atoms.css:201`) |
| `--error` #f2689a | 6.70 | 6.75 | 6.27 | 5.80 | 6.90 | pass | pass | on error-wash 5.69 (`Account.css:142`, `SignIn.css:103`) |
| `--run-hatch` #e8d5a8 | 13.47 | 13.56 | 12.60 | 11.65 | 13.87 | pass | pass | reserved |
| `--hue-conflict` #ee7754 | 6.87 | 6.92 | 6.42 | 5.94 | 7.07 | pass | pass | kickers, dots (type hue) |
| `--hue-political` #9b8cf8 | 6.96 | 7.01 | 6.51 | 6.02 | 7.17 | pass | pass | same |
| `--hue-economic` #8fd46a | 10.95 | 11.02 | 10.24 | 9.47 | 11.27 | pass | pass | same |
| `--hue-humanitarian` #d987e0 | 7.88 | 7.93 | 7.37 | 6.82 | 8.11 | pass | pass | same |
| `--tier-low` #7d8b96 | 5.57 | 5.61 | 5.21 | 4.82 | 5.74 | pass | pass | `.rdp-dn` on tier-low-wash 4.72 |
| `--tier-moderate` #9fb0bc | 8.73 | 8.79 | 8.17 | 7.55 | 8.99 | pass | pass | |
| `--tier-elevated` #c9d6df | 13.15 | 13.24 | 12.30 | 11.37 | 13.53 | pass | pass | |
| `--tier-high` #eef5f9 | 17.69 | 17.81 | 16.55 | 15.30 | 18.21 | pass | pass | `.rdp-up` on tier-high-wash 11.36 |
| `--on-accent` #06131c | on `--accent` 11.05 | | | | | pass | pass | primary button; on accent-strong 12.87 |

Lowest passing pairs: `--text-dim` on `--accent-wash` over `--bg` **4.507** (hover/active nav backgrounds;
borderline, 0.007 of margin), on `--panel-3` 4.82, on `--map-land` 4.72; `--tier-low` on its wash 4.72.
Not used together (so not failures, listed for the next token edit): `--text-dim` on ok-wash 4.35 / warn-wash 4.39;
`--error` on tier-high-wash 4.31.

**AA failures (effective colour after `opacity`, not token failures):**

| Pair | Ratio | Normal | Large | Where |
|---|---|---|---|---|
| `--text-dim` at opacity .55 on `--panel-2` | 2.43 | fail | fail | `RiskScorecard.css:120` (finding 18) |
| `--text-dim` at opacity .6 on `--bg` | 2.72 (2.45 on panel-2) | fail | fail | `EditionsStrip.css:27` (finding 19) |
| `--text-body` at opacity .55 | 4.51 to 4.58 | pass (barely) | pass | same scorecard row label |

Non-text contrast (1.4.11, needs 3:1): focus ring `--accent` 10.7 to 11.5 (pass); `--hairline` 1.44 bg / 1.48
panel-2 (fail as a field boundary, finding 20); `--hairline-strong` 2.01 / 2.06 (fail as a field boundary;
buttons are identified by their text so exempt); `--hairline-3` 3.12 / 3.14 (pass); map: `--map-land` vs `--bg`
1.18, `--map-land-line` vs land 1.28, `--map-land-line-dim` vs land 2.97. Country outlines are not the only
carrier of information (feed lists them), so only noted.

## axe-core results per page

Empty/error states, stubbed endpoints, 1280x800 desktop unless "p" (390x844 phone). "Inc." = axe "incomplete"
(could not be decided, mostly colour over images/alpha). h1 = count of `<h1>`.

| Route | h1 | Violations (rule, impact, nodes, sample selector) | Inc. |
|---|---|---|---|
| `/` | 1 | none | color-contrast x12 `.sm-attrib` |
| `/` with `fixtures/world.json` | 1 | none | color-contrast x31 `.sm-attrib` |
| `/` p | 1 | heading-order, moderate, 1, `div:nth-child(1) > h4` | color-contrast x9 `#sh-mode-tab-globe` |
| `/` p with fixture | 1 | heading-order, moderate, 1 | color-contrast x10 `.sh-hud-compact-caret` |
| `/today` | 1 | landmark-no-duplicate-main, landmark-main-is-top-level, landmark-unique x2 (all moderate; `.gp-main`, `.es-center`) | |
| `/today` p | 1 | same three | |
| `/privacy` `/about` `/disclosures` `/contact` | 1 | none | |
| `/analyze/s/:id` | 1 | none | |
| `/membership` | 1 | none | color-contrast x4 `.mp-check` |
| `/track-record`, `/track-record/text` (+p) | 1 | none | |
| `/briefings` (+p) | 0 | page-has-heading-one, moderate, 1, `html` | |
| `/board` | 0 | page-has-heading-one, moderate, 1 (board endpoint not configured: "The board is not available yet.") | |
| `/weekly` | 0 | page-has-heading-one, moderate, 1 | |
| `/weekly` p | 0 | **aria-valid-attr-value, critical, 1, `#sf-tab-tab-read`** (`aria-controls="sf-tab-panel-read"`); page-has-heading-one | |
| `/weekly/thread/:id` | 0 | page-has-heading-one (h3 "Story arc not found") | |
| `/weekly/countries` | 0 | landmark x3 (as `/today`), page-has-heading-one | |
| `/weekly/country/:name` | 0 | page-has-heading-one (h2 + h3 empty state) | color-contrast x4 `a[href$="countries"]` |
| `/signin` (+p) | 1 | none | |
| `/auth/callback` | 0 | page-has-heading-one (h2 "Sign-in failed") | |
| `/account` (signed out) | 1 | none | |
| `/whitepaper` | 1 | none | |
| 404 | 0 | page-has-heading-one (h2) | |
| Bell panel open (`/privacy`, alerts stubbed) | | **aria-required-children critical x1, aria-required-parent critical x2** | |

Landmarks per page: every route has one `nav` + one `main` (two on `/today`, `/weekly/countries`) + `footer`
(not on desktop `/`, by design). No `<header>`/banner landmark on most pages; the top bar is a bare `<nav>`.
Phone adds a second `nav` ("Primary, phone"), labelled, so unique. No `skip` link anywhere.

Live regions found at runtime: `/` has two `status` regions (map announcements and the boot loader);
`/today` "Couldn't load today's topics" is `status`; `/weekly` "Failed to fetch" is `alert`; `/briefings` is
`alert`. Pages with no live region in their error/empty path: `/board`, `/track-record` ("scoreboard is
temporarily unavailable", `TrackRecordPage.jsx:120`), `/weekly/countries`, `/weekly/country/:name`.

Expected differences with live data: `/weekly`, `/weekly/countries`, `/weekly/country/:name`, `/weekly/thread/:id`
and `/briefings` get their h1 (or not, see finding 12) from real content; `/today`, Stories and Country pages
add `EditorialShell` asides and a duplicate `main` on more states; list pages add many links/buttons that
axe did not see (findings 3, 4, 15 are only visible with data or sign-in); contrast results on cards with
real stories (pills, chips, tier washes) were not exercised.

## Keyboard walk (Tab, Chromium, 40-step cap)

Focus visibility: **every** focused element showed a 2px accent outline (computed `outline-style: solid`),
including the `deck.gl` root, tabs, radios, footer links and the phone tab bar. No element lost its ring.

| Page | Stops | Order observed | Notes |
|---|---|---|---|
| `/today` | 19 | brand, Map, Stories, Briefings, Track record, help `?`, bell, Sign in, Buy Me a Coffee, breaking strip, 2 inline links, Subscribe, Retry, footer x5 | Reaches nav, bell, sign-in. No skip link. |
| `/weekly` | 15 | nav x8, Countries link, view switch (one radio stop, arrows move inside), footer x5 | Good: segmented control is one tab stop. |
| `/briefings` | 15 | nav x8, Daily/Weekly radio group, "Try again", footer | Briefing controls (slides, editions, map) did not render in the error state. |
| `/track-record` | 13 | nav x8, footer x5 | Content has no interactive stops in the error state. |
| `/signin` | 19 | nav x8, Google, email (no visible label), magic link, guest, 2 legal links, footer | Logical order. |
| `/` (fixture) | 21 | brand, 4 nav, help, bell, Sign in, **globe root** (unnamed), spin pause, dismiss note, Globe/Radar radios, Situations/Country-risk radios, Key, About this map | The boot overlay was in its failure state (news sensor not stubbed) so 16 of 21 stops were behind `.gp-boot` (finding 6). |
| `/` phone (fixture) | 29 | help, bell, Sign in, dismiss note, MAP/LIST/ALERTS tabs, HUD toggle, Radar/Situations/Key, Scan again, links, footer, bottom tab bar x4 | Controls precede the map by design; same overlay problem. |
| `/weekly` phone | 16 | brand, help, bell, Sign in, Countries, READ tab, List/Board/Web group, footer, tab bar x4 | |

Bell (opened with Enter on `/privacy`): focus stays on the button; ArrowDown does nothing; Tab goes to the first
link; Escape closes and focus lands on `<body>` (finding 1). Tab order is DOM order everywhere; no positive
`tabindex` values exist (grep). Nav stops before content: 8 (finding 9).

Focus traps: `BottomSheet` full stop traps and restores correctly (read, not exercised: needs a selected
situation on a phone). `ArchiveTopicModal` has none (finding 2).

## Not checked

- Anything behind data or sign-in: board graph/map pins, account tabs, Saved panel, Desk, member-only
  controls, country/thread/briefing pages with real content, slides (`BriefingMode`, `StoryMode`),
  `BottomSheet` in use, `ArchiveTopicModal` open. Findings 3, 4, 15, 30, 31 are from reading code.
- Real screen readers (NVDA, JAWS, VoiceOver); only the accessibility tree via axe and keyboard behaviour.
- Colour contrast over images and gradients (globe texture, map overlays, `.sm-attrib`, `.mp-check`, boot
  radar): axe "incomplete", token maths only.
- Google Maps (`@googlemaps/react-wrapper`, `CountryOverviewMap`): key not available in the stub, never loaded.
  No alt/keyboard assessment; `CountryOverviewMap.jsx:150` loading placeholder is `aria-hidden`.
- Webfonts and external scripts (Google Fonts, GA, deck.gl textures) were blocked; fallback fonts were used,
  which does not change colour ratios but can change text size/wrapping (reflow at 320px, 200% zoom, 1.4.10,
  text spacing 1.4.12 were not tested).
- Native control theming (`<select>`, `<input type=date>` popups): `color-scheme: dark` is only set on one
  rule (`shared/ui/blocks.css:60`), so popups may render light-on-light in some browsers; not verified.
- Touch gestures, voice control, forced-colors / high-contrast mode, print.
- The pre-JS boot screen in `index.html` (static copy of `BootLoader`) beyond reading its markup: it has
  `role="status"` and a label, and removes itself on first React commit.
- Email templates and Lambda-rendered HTML.

Artifacts used (not committed): `/tmp/fe-a11y` (build), scratch scripts under the session scratchpad
(`axe-run.js`, `kbd-run.js`, `contrast.js`).
