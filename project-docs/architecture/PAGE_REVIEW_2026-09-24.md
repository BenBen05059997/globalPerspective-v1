# Page Review — 2026-09-24

_Whole-site review of every page "in every aspect", right after the feature-folder restructure.
Diagnose only — this doc is findings + a prioritized list; nothing is changed by the review.
Method: monitor-written checklist → parallel Sonnet reviewers (live site
https://globalperspective.net + code) → monitor visual walk-through (desktop + mobile width) →
consolidated, prioritized findings. Every finding needs evidence: URL + screenshot/observation,
or `file:line`._

**Context the reviewers must hold (so they don't mis-file known conditions as bugs):**
- DeepSeek balance outage since ~2026-09-13 starves several pipelines: today's `/daily` brief, story
  summaries, the map's situation list, fresh country/thread analyses. Content *staleness* from this
  is a known condition — but how each page **presents** missing data (honest empty state vs blank
  vs misleading) IS in scope.
- Production currently runs the pre-restructure build (not yet deployed); the restructure was a
  pure move with byte-identical bundles, so prod behavior = current code behavior.
- Standing product rules: no fake/placeholder fallback UI (fail empty + honest); public content is
  free and never auth-gated; analyst-depth writing; never invented facts; member perks are depth,
  not access.

## Routes in scope (26)
`/` · `/map` · `/weekly` · `/weekly/thread/:id` · `/weekly/countries` · `/weekly/country/:name` ·
`/economy` (+ `?view=week`, `/weekly-markets` redirect) · `/daily` + `/daily/:date` ·
`/weekly-brief` · `/breaking` + `/breaking/:id` · `/track-record` · `/analyze` · `/membership` ·
`/signin` · `/auth/callback` · `/account` · `/about` · `/contact` · `/privacy` · `/disclosures` ·
`/whitepaper` · `/spider-demo` (unlisted) · `/__boom` (diagnostic) · `*` (404)

## Checklist by dimension

### A. Purpose, IA & navigation (reviewer 1)
- A1. For each page: can a first-time visitor tell in 5 seconds what it is and why it matters?
- A2. Nav: grouping, labels, active state, what's missing/redundant; mobile nav.
- A3. Cross-links and dead ends: every page leads somewhere useful next; broken/orphan links
  (`scripts/link-crawl.mjs` against prod).
- A4. Overlap/duplication between pages (e.g. Home vs /weekly vs /map vs /daily — do they compete
  for the same job?). Which pages earn their place; which could merge or retire.
- A5. Deep-link robustness: refresh on every route (404.html SPA fallback), shareable URLs, back
  button, query-state (filters/tabs) round-trips.

### B. Content, honesty & empty states (reviewer 2)
- B1. What each page shows when its data is missing/stale — honest empty state vs silent blank vs
  misleading "0"/placeholder (known example: Summary button renders nothing).
- B2. Freshness signals: does each page say how current its data is? Any page presenting stale
  data as current?
- B3. Copy quality/consistency: analyst depth, tone, terminology (risk tiers, axes, "situation" vs
  "thread" vs "story"), typos, stale claims (pricing, features, dates).
- B4. Trust/accountability surfaces: track-record, corrections, sources, methodology — are they
  findable and coherent?

### C. Visual design, responsive & accessibility (reviewer 3 + monitor's browser pass)
- C1. Visual consistency across pages (typography, spacing, color tokens, component reuse) —
  which pages look like a different product?
- C2. Mobile (~390px): layout breaks, horizontal scroll, tap targets, hidden controls.
- C3. Accessibility: headings order, landmarks, labels on icon buttons, focus visibility/keyboard
  paths, color contrast, alt text, reduced motion.
- C4. Loading states: skeletons vs spinners vs layout shift; perceived speed.

### D. Performance & technical SEO (reviewer 4)
- D1. Bundle: main chunk is ~1.05 MB (337 kB gzip) — which routes are eagerly imported that could
  be lazy? Largest dependencies? (`vite build` output, App.jsx imports.)
- D2. Per-route data fetching: waterfalls, duplicate calls, cache use, the restProxy concurrency cap.
- D3. SEO: titles/meta/OG per route, canonical, sitemap/robots, the Cloudflare Worker bot
  pre-render coverage (which routes crawlers actually see), structured data correctness.
- D4. Errors in the wild: `node scripts/errors.mjs` recent client errors; `scripts/smoke-test.mjs`,
  `contract-check.mjs` against prod.

### E. Product, funnel & membership (reviewer 5)
- E1. The visitor → subscriber → member journey: where are the asks (SubscribeCard, membership
  CTAs, Studio upsell), are they coherent, over/under-placed, honest about what membership buys?
- E2. Studio (/analyze): discoverability from other pages, first-run clarity (BYOK vs member path),
  what a non-member experiences.
- E3. Account/membership/sign-in flows: clarity, dead ends, error handling.
- E4. What a returning reader does daily — is there a reason to come back, and is it surfaced?

## Deliverable (filled after review)
§1 Executive summary · §2 Findings by page (table) · §3 Findings by dimension · §4 Prioritized list
(P1 must-fix / P2 should / P3 nice) with effort estimates · §5 Things that are working well (keep).

---

# Consolidated findings — 2026-09-24

Inputs: reviewer reports A (IA/nav), B (content/honesty), C (visual/a11y), D (perf/SEO), E
(product/funnel), all against live prod + source, plus a monitor browser walk-through. IDs below
prefixed `A`/`B`/`C`/`D`/`E` are a single reviewer's own numbering (unchanged); IDs prefixed `X-`
are this consolidation's merges of overlapping findings from ≥2 reviewers. **Three corrections
below are monitor-verified and override the cited reviewer claims** — see inline notes at X-3,
X-11, and the B1-repro note.

## §1 Executive summary

Overall health: the product is editorially sound and mostly honest where it matters (empty
states, member-gating, track-record) — but the site is carrying a decade's worth of pre-token
CSS debt on its highest-traffic pages, its most prominent trust signal (the "LIVE · Updated
hourly" badge) is false almost everywhere, and it is functionally invisible to search engines on
every route except the homepage. None of these are one-line fixes, but each has a single root
cause, so the fix surface is smaller than the finding count suggests.

**Systemic root causes (5):**
1. **Freshness state never reaches the header/marketing layer.** The "LIVE · Updated hourly"
   badge, `/about`, `/whitepaper`, and `/economy`'s "today's driver" narrative are all static
   strings independent of actual pipeline age (data observed 11–126 days stale) — one data path
   would fix the badge, the two marketing pages, and reduce the "today's driver" mislabeling
   together (X-2).
2. **Legacy pre-token CSS on exactly the pages that predate the design system** — Home, Threads
   (`/weekly` + `/weekly/thread/:id`), Countries, Account, and parts of `/map` carry off-token
   Tailwind-gray/blue hex and are also the six worst pages for cumulative layout shift (0.29–1.20,
   "poor" by Core Web Vitals) — the newer token-driven pages (Daily, Weekly Brief, Breaking,
   Track Record, Analyze) are clean and near-zero-CLS, proving the team already knows how to build
   it right; the debt is concentrated, not systemic-by-default (X-4).
3. **Zero route-level code splitting + uncoalesced duplicate data fetches.** Every route ships the
   full ~1.05 MB/337 kB-gzip main chunk (including Firebase Auth for anonymous readers and d3-geo
   for pages that never touch the map), and a loading-indicator component alone re-fetches a
   ~500 kB "topics" payload independently on 6+ pages with no de-dupe or shared cache (X-6, X-7).
4. **The site is HTTP-404 to search engines on every route except `/`.** Monitor-verified via curl
   with both a browser UA and Googlebot UA: `/daily`, `/weekly`, `/economy`, `/track-record`,
   `/map`, `/analyze`, `/membership`, `/about` all return 404 to both; only
   `/weekly/country/<name>` returns 200 to Googlebot via the Cloudflare Worker pre-render. This is
   broader than D's original report (which named only `/daily`/`/weekly`) and reconciles with A's
   "100% of routes deep-link/refresh cleanly" claim: that's true for humans (GitHub Pages'
   404.html SPA fallback renders the right page visually) but false at the HTTP level search
   engines see (X-3).
5. **Copy still advertises features that are parked or scope-narrowed without saying so** — the
   "buy credits" language on `/analyze` and `/membership` describes a feature with no live prod
   config (downgraded from a broken-checkout claim — see X-11), and several primary-nav pages
   (`/daily`, `/weekly-brief`) currently deliver materially less value than their nav billing
   promises without demoting themselves.

Overall: no structural/IA redesign is warranted (A's page-overlap analysis finds each "competing"
cluster is editorially legitimate) — the fixes are presentation, propagation, and plumbing, not
new pages or a new sitemap.

## §2 Findings by page

| Page | Top issues (IDs) | Grade |
|---|---|---|
| `/` (Home) | X-2 (false LIVE badge), X-5 (596px mobile overflow), X-4/C-19 (CLS 0.32), X-14 (empty left column), X-3 (404 to crawlers) | C+ |
| `/map` | C-6 (dark-UI jolt, no nav cue), X-3 (404 to crawlers) — otherwise strong: works on prod, near-zero CLS, freshness line is a best-practice model | B |
| `/weekly` (Threads) | X-4/C-7 (heaviest palette drift, 631 hex), X-4/C-19 (worst CLS 0.78), B-3 (blank hero 5–10s), X-3 (404 to crawlers) | C |
| `/weekly/thread/:id` | X-4/C-7 (palette drift), X-5/C-10 (worst mobile overflow, 572px, broken header) | C− |
| `/weekly/countries` | X-4 (milder token drift), C-19 (CLS 0.29) | C+ |
| `/weekly/country/:name` | X-5/C-10 (516px overflow), C-19 (CLS 0.87), X-15/B-4 (121d-stale default styled as fresh), X-3 (404 to crawlers except this route type) | C− |
| `/economy` | X-9/A3 (60 degraded driving-story links, 27% of crawl), C-19 (worst CLS, 1.19), X-2/B-2 ("today's driver" cites a 103d-stale story as "today's"), C-11 (sidebar truncation), X-3 (404 to crawlers) | B− |
| `/daily` + `/daily/:date` | X-10/A3 (dead "Previous day" arrow, 2 consecutive empty days, no fallback), X-3 (404 to crawlers) — otherwise honest empty state | A− (content) / P1 on nav+SEO |
| `/weekly-brief` | X-2 (18-day-old "latest" presented with no staleness flag) — otherwise token-clean, near-zero CLS | A− |
| `/breaking` | X-23/A2 (no nav/footer entry) — otherwise honest empty state, token-clean, near-zero CLS; best-practice empty-state model | B+ |
| `/track-record` | X-8/C-13 (worst color-contrast count of any page, 52), X-5/C-10 (549px mobile overflow), X-21/B-8 (counters don't quite sum) | B |
| `/analyze` | X-11 (credits copy vs. parked backend) — otherwise clean, honest anon gate, best entry-point coverage on the site | A− |
| `/membership` | X-11 (credits copy), X-12/E1-a (no nav presence, footer-only) — otherwise honest pricing, no dead ends | A− |
| `/signin`, `/account`, `/auth/callback` | E3 (`/account` signed-out is byte-identical to `/signin`, no account-specific framing) — otherwise clean fail-closed handling | A− |
| `/about`, `/contact`, `/privacy`, `/disclosures`, `/whitepaper` | X-2/B-6 (`/about`, `/whitepaper` carry stale "hourly" marketing claims) | A− |
| `/spider-demo` | C-15 (no reduced-motion guard despite being animation-heavy) | B |
| 404 (`*`) | none material | A− |

## §3 Findings by dimension

### A — IA & navigation
- **A2 nav gaps [P2, S]** — `/breaking` and `/weekly-markets` are live, CTA-carrying routes absent
  from both primary nav and footer; their only inbound paths are in-content. (X-23)
- **A2 nav group labels [P3, S]** — 4 nav clusters divided by dividers with no visible label; desktop
  disambiguation lives in hover-only `title` tooltips, lost entirely on mobile tap. (X-22)
- **A3 `/economy` degraded links [P1, M]** — 60/223 crawled destinations (27%), all originating from
  `/economy`, point to threads that have aged out of the 30-day archive window — a contract gap
  between economic-disruption records (retained longer) and the thread archive (hard 30-day cutoff).
  (X-9)
- **A3 `/daily` dead end [P1, S]** — the very first click from an already-empty `/daily` ("← Previous
  day") lands on another dead end (`/daily/2026-09-23`: "No brief available"); no confirmed path to
  real content within a reasonable number of clicks. (X-10, merged with E4)
- **A4 page overlap** — Home/`/daily`/`/weekly-brief` and `/weekly`/`/weekly/countries`/`/map` are
  each editorially legitimate 3-way splits, not redundant; the finding is presentation of
  staleness/scope, not structure (see X-2 for the freshness half). **Monitor correction:** `/map`
  itself works correctly on prod (1 elevated situation, live "updated 56 min ago · next in 27 min"
  freshness line) — an earlier report of an empty local map was a local-config artifact, not a
  site bug; `/map`'s freshness line is the site's best-practice model for X-2's fix. The "Map runs
  out on the third click" framing is a legitimate scope difference worth one line of on-page
  context, not a defect.
- **A5 onboarding tour blocks mobile hamburger [P1 mobile / P2 desktop, S]** — full-viewport
  overlay intercepts pointer events on fresh sessions on `/` and `/economy`; merged with C-1's
  ARIA violation into X-1 below.
- **A5 Home mobile overflow [P1, S–M]** — `scrollWidth` 596px at 390px viewport; merged into X-5.
- **A5 deep-link/refresh integrity is clean visually for all 26 routes** — but see X-3: visual
  correctness (404.html SPA fallback) is not the same as HTTP correctness for crawlers.

### B — Content, honesty & empty states
- **B-1 false "LIVE · Updated hourly" badge [P1, M]** — merged into X-2.
- **B-2 `/economy` "today's driver" cites a 103d-stale story as "today's" [P2, S]** — merged into
  X-2 (shared root cause) but page-specific enough to track separately: the copy actively asserts
  currency, not just discloses staleness.
- **B-3 `/weekly` blank hero for 5–10s, no loading affordance [P3, S]** — cross-ref C4/loading
  states.
- **B-4 `/weekly/countries` defaults to a 121d-stale country styled identically to fresh entries,
  tagged "Escalating" [P3, S]** — (X-15)
- **B-5 terminology drift: "Threads" (nav) / "Story Arcs" (page) / "situations" (Map) / "stories"–
  "topics" (Home) [P2, S]** — copy-only but touches many components. (X-13)
- **B-6 `/about`, `/whitepaper` carry stale "hourly" marketing claims [P2, S]** — merged into X-2.
- **B-8 Track Record counters don't quite sum (20744 vs 122+20607=20729, gap of 15) [P3, S]** —
  (X-21)
- **B1 repro note (monitor correction):** the "Summary renders nothing" bug cited in the review
  brief as a known example was **not reproduced** by reviewer B in 5 tries on Home; the monitor
  saw it once while signed in. Status: **needs repro (signed-in path?), not a confirmed bug** —
  do not list as P1 without a repeatable case.
- Working well: honest empty states on `/daily` and `/breaking`, dated thread forecasts
  ("LIVING FORECAST · AS OF SEP 13"), consistent risk-tier/axis vocabulary, a genuinely rigorous
  `/disclosures` page, matching trigger counts between Home and Track Record.

### C — Visual, responsive & accessibility
- **C-1 onboarding-tour ARIA violation on all 23 pages [P1, S]** — merged with A5 into X-1.
- **C-2 duplicate/misplaced landmarks on all 23 pages [P1, M]** — two "main" regions on 6
  content-heavy pages, duplicate `contentinfo`; fix once in `Layout.jsx` + page wrappers. (X-8)
- **C-3 header tap targets <40px on every page [P2, S]** — grouped into X-8 site-wide a11y fix.
- **C-4 no global `:focus-visible` baseline [P2, S]** — grouped into X-8.
- **C-6 `/map` fully separate dark UI, no nav cue [P2, M]** — internally coherent, plausible
  intentional "war room" exception per monitor's confirmation `/map` works well; recommend a
  one-line visual cue in the nav rather than treating as a defect.
- **C-7 `/weekly` + `/weekly/thread/*` run a different, cooler color system than `tokens.css`
  (631 hex occurrences, ~0 `var()` usage) [P2, M]** — merged into X-4, same pattern smaller-scale
  in Account, Home, Countries.
- **C-8/C-9 token-value duplication + inline hex in JSX [P3, S]** — merged into X-4.
- **C-10 real horizontal overflow on 4/23 routes (thread 572px, country 516px, track-record 549px,
  Home 596px) [P1, M]** — merged with A5's Home finding into X-5.
- **C-11 sidebar numeric truncation on `/economy` desktop [P2, S]**.
- **C-13 color-contrast is the largest violation class, worst on content-dense pages including the
  newer token-clean ones (weekly 79, countries 72, country 71, track-record 52, economy 41) [P1,
  L]** — likely `--ink-dim`/`--ink-faint` vs `--paper`/`--card` token pairing failing WCAG AA;
  fixing the token variable fixes it everywhere. Grouped into X-8.
- **C-14 icon-only controls with no accessible name, incl. one non-keyboard-operable `<div
  onClick>` [P2, S]** — grouped into X-8.
- **C-15 `prefers-reduced-motion` handled in only 4/~40 feature CSS files [P3, S]** — the loading
  toast/spinner (every async action, every page) and `/spider-demo`'s globe animation lack guards.
- **C-19 six pages (economy, country, weekly, home, thread, countries) have poor-to-very-poor CLS
  (0.29–1.20), the other 17 near-zero [P1, M]** — same divide as C-7; no skeleton placeholders
  anywhere in the codebase, only a top progress bar. Merged into X-4.
- Working well: single shared `Layout.jsx` header/footer, `tokens.css` itself is well-structured
  (adoption is the gap, not the system), newer pages prove the team can build clean/low-CLS pages,
  no blank-white first paint anywhere, `SituationMap3D.jsx` already handles reduced-motion.

### D — Performance & technical SEO
- **D-1 zero route-level code splitting, 1.05 MB/337 kB-gzip main chunk on every route [P1, M]** —
  (X-7)
- **D-2 `WeeklyMap`'s lazy split defeated by a duplicate static import in `CountryPage.jsx` [P2,
  S]** — (X-7)
- **D-4 uncoalesced duplicate proxy POSTs — up to 9× identical calls per page, ~1–2 MB wasted
  transfer on `/`, `/economy`, `/weekly/country/:name` [P1, S/M]** — (X-6)
- **D-6/D-3 SEO pre-render gap [P1, M — see monitor correction below]** — (X-3)
  > **Monitor correction (overrides D-6's scope):** curl-verified with both a browser UA and a
  > Googlebot UA — **every route except `/` returns HTTP 404** to both, including `/daily`,
  > `/weekly`, `/economy`, `/track-record`, `/map`, `/analyze`, `/membership`, `/about`. Only
  > `/weekly/country/<name>` returns 200 to Googlebot (Cloudflare Worker pre-render). D's original
  > report named only `/daily`/`/weekly` as broken — the actual gap is sitewide except for one
  > route type. Pages render fine for humans via GitHub Pages' 404.html SPA fallback, but search
  > engines are told almost the entire site doesn't exist. This is the single most impactful
  > technical-SEO finding.
- **D-7 sitemap.xml lists dead routes (`/pricing`, `/cli` both 404) and omits most real routes
  [P2, S]**.
- **D-8 no canonical `<link>` for non-bot visitors; two disagreeing titles for `/` depending on
  visitor type [P3, S]**.
- **D-9 ~8 pages never set `document.title` [P2, S]** — Economy, Track Record, Analysis Studio,
  Membership, Breaking (both), Weekly Brief, Account, Whitepaper.
- **D-10 `narrative_thread` proxy action fails its own contract (empty array) [P2, S]** — possibly
  tied to the DeepSeek outage; frontend caller should be checked for an honest empty state.
- **D-13 `aria-allowed-attr` fires on every route per `smoke-test.mjs` [P1, S]** — same
  `#driver-dummy-element` violation C-1 found via axe-core; one shared finding, merged into X-1.
- **D-14 `/economy` → thread deep links mostly resolve to a "timeline aged out" fallback (18/20
  sampled) [P2, M]** — same underlying 30-day archive-window contract gap as A3's 60-degraded-link
  finding; merged into X-9.
  > **Monitor corrections on D's `smoke-test.mjs`-derived addenda (D-11, D-12): both are false
  > positives, do not list as bugs.**
  > - **D-11** claimed `/map` and `/daily` fail to re-render on direct reload/deep-link. **False**
  >   — the monitor navigated directly to `https://globalperspective.net/map` in a real browser and
  >   it rendered fully; reviewer A independently verified all 26 routes deep-link/refresh cleanly.
  >   The only real issue in this area is the HTTP-404 *status code* to crawlers (X-3) — an SEO
  >   problem, not a rendering failure. Likely cause: `smoke-test.mjs`'s own refresh-detection
  >   heuristic, not the app.
  > - **D-12** claimed 10 pages render blank. **False** — these are stale CSS selectors in
  >   `scripts/smoke-test.mjs` (e.g. `.home-shell`, `.clp-card`) left over from before the
  >   feature-folder restructure; not caused by the restructure itself (prod still runs the
  >   pre-restructure build, which never had these class names change). Downgraded to a **P3
  >   tooling item**: re-baseline `smoke-test.mjs`'s content selectors against the current DOM so
  >   its blank-render guard is trustworthy again.
- Working well: `SituationMap3D` is the one correctly-split route chunk (template for D-1),
  `MAX_PROXY_CONCURRENCY` limiter is a deliberate, documented cold-start fix, robots.txt +
  global JSON-LD are present and well-formed, client-error volume in the wild is very low
  (3 events/14 days) with a working error-boundary→sink pipeline, 7/8 proxy actions pass contract
  checks.

### E — Product, funnel & membership
- **E1-a Membership has no nav presence (desktop or mobile), footer-only [P3, S]** — (X-12)
- **E1-c Home's one perk-forward member mention links to `/track-record`, not `/membership` — a
  funnel leak [P2, S]** — (X-20)
- **E2-a credits copy vs. backend state [downgraded to P2, S–M — see monitor correction]**
  > **Monitor correction (overrides E's P1 framing):** this is **not** a live broken checkout.
  > Prod `docs/config.js` has no `POLAR_CREDIT_PACKS` configured, so `/membership` correctly shows
  > "Credit packs are coming soon" rather than a dead payment flow. The remaining issue is narrower
  > than E reported: **copy in three places advertises a parked feature as if live** —
  > `AnalysisStudio.jsx:345` ("Buy credits to run it on our compute"), `Account.jsx:433` ("Buy
  > credits"), and the header's "● 0 credits" pill shown to every signed-in user. Fix: remove or
  > conditionally hide this copy until `PROD_CREDITS_NEXT_STEPS.md`'s checklist actually ships.
  > (X-11)
- **E2-b member-vs-BYOK distinction not explained until signed in [P3, S]**.
- **E3 `/account` signed-out is byte-identical to `/signin`, no account-specific framing [P3, S]**.
- **E4 `/daily` empty on the habit-anchor page with no fallback link [P2, S]** — merged with A3
  into X-10.
- Product-level read: `/economy`, `/track-record`, CountryPage, and `/analyze` best serve the
  analyst/B2B buyer; `/breaking`'s newsletter CTA and Home's "Buy me a coffee" banner read as
  consumer/indie-blogger register, sitting directly beside the analyst-facing "RUN A CITED,
  FABRICATION-CHECKED AI DEEP-DIVE" CTA — a register mismatch for a product priced against
  Stratfor/Oxford Analytica comparables. Corroborated by the monitor's visual pass: Home's left
  column is empty except for the "Buy me a coffee" button (X-14).
- Working well: CountryPage/`/track-record` lock affordances are honest (real content + count +
  `/membership` link, no fake teasers), `/analyze`'s anonymous gate is unambiguous, `/membership`
  itself has no premature payment fields, Analysis Studio has 5 non-redundant entry points with
  pre-filled query-param context, `/auth/callback` and `/account` fail closed without crashing.

### Monitor visual-pass additions (not in any reviewer report)
- Home simultaneously says "LIVE", "Updated hourly", stamps today's masthead date, and states
  "sources across 13 stories tracked today" — while the same strip elsewhere says "updated 11d
  ago." Corroborates B-1/X-2 directly from a human browsing pass, not just automated capture.
- Header "● 0 credits" pill shown to every signed-in user — ties to X-11 (parked-feature copy).
- Home's left column is empty except a "Buy me a coffee" button — wasted space and a
  consumer-framing signal that undercuts the analyst/B2B positioning (corroborates E's
  product-level read; X-14).

## §4 Prioritized list

**P1 — must fix**
1. **X-3 — Fix SEO pre-render/404 gap so every route (not just `/` and `/weekly/country/:name`)
   returns 200 to crawlers.** Effort L. Root cause: Cloudflare Worker bot pre-render only covers 2
   of 26+ route shapes; everything else falls through to GitHub Pages' bare 404. Diff the deployed
   Worker against `WORKER_FULL_CODE.md`, extend pre-render coverage or add a general SPA-aware
   fallback (200 + app shell) for crawler UAs.
2. **X-2 — Propagate real pipeline-freshness state into the header badge, `/about`, `/whitepaper`,
   and `/economy`'s "today's driver" narrative.** Effort M. One data path (last-successful-run
   timestamp → derived "Updated Xh/Xd ago" or degraded-mode indicator) fixes B-1, B-2's framing,
   and B-6 together. Root cause: freshness never left the per-page "updated Nd ago" chips.
3. **X-4 — Site-wide visual-debt fix: migrate Home/Threads/Countries/Account/`/map`(2D) off
   pre-token hex to `tokens.css`, and add reserved-space/skeleton placeholders on the 6 worst-CLS
   pages (economy 1.19, country 0.87, weekly 0.78, home 0.32, thread 0.32, countries 0.29).**
   Effort L. Root cause: these pages predate the token system and were never migrated; no
   skeleton pattern exists in the codebase to reserve layout space during async fetch.
4. **X-5 — Fix mobile horizontal overflow on `/`, `/weekly/thread/:id`, `/weekly/country/:name`,
   `/track-record`.** Effort M. Root cause: a fixed-width element per page (mono breadcrumb/action
   row on thread, a table/pill row elsewhere) — page-specific, not a global layout bug.
5. **X-6 — De-dupe identical in-flight proxy requests (`restProxy.js`) or hoist `useGeminiTopics`
   into a single provider.** Effort S/M. Cuts 1–2 MB of duplicate transfer per load on `/`,
   `/economy`, `/weekly/country/:name`; also unblocks the 4-slot concurrency limiter for the calls
   that actually matter on that page.
6. **X-7 — Route-level code splitting: convert `App.jsx`'s 24 static route imports to
   `React.lazy`+`Suspense`, and fix `CountryPage.jsx`'s static `WeeklyMap` import so `WeeklyPage`'s
   existing `lazy()` actually takes effect.** Effort M. Mechanical, no logic changes; template
   already exists in `SituationMap3D`'s correct split.
7. **X-8 — Site-wide a11y pass: fix duplicate/misplaced landmarks (`Layout.jsx` + page wrappers),
   the color-contrast token pairing (`--ink-dim`/`--ink-faint` vs `--paper`/`--card`), header tap
   targets (<40px), missing `:focus-visible` baseline, and unlabeled icon-only controls (one
   non-keyboard-operable `<div onClick>`).** Effort L (contrast token fix is the long pole; the
   rest are S each). Group as one changeset — each fix in shared code (`Layout.jsx`,
   `tokens.css`) propagates to all 23 pages at once.
8. **X-1 — Onboarding tour: constrain overlay pointer-events so it doesn't block the mobile
   hamburger, and fix the `aria-allowed-attr` violation on `#driver-dummy-element`.** Effort S.
   Blocks all nav on mobile for first-time sessions on `/` and `/economy`; the ARIA violation was
   independently confirmed by two methods (C's axe-core sweep, D's `smoke-test.mjs` run) — single
   library touchpoint (`tours.js`/`useOnboarding.js`).
9. **X-9 — `/economy`'s degraded driving-story links: expire/hide links to threads aged out of the
   30-day archive window, or serve them read-only "archived" instead of not-found-adjacent.**
   Effort M. Contract gap between economic-disruption record retention and the thread archive's
   hard 30-day cutoff — confirmed by two independent methods: A's link-crawl (60/223 destinations,
   27%, all from `/economy`) and D's `smoke-test.mjs` sampling (18/20 sampled disruptions fall
   back to "timeline aged out").
10. **X-10 — `/daily` dead end: disable/gray the "Previous day" arrow when the target date has no
    brief, and/or add a "see today's topics on Home instead →" fallback (same pattern as
    `/breaking`).** Effort S. The habit-anchor page currently dead-ends on its very first available
    click, two days running.

**P2 — should fix**
- X-13 — Standardize terminology: Threads/Story Arcs/situations/stories → one vocabulary per
  concept across nav + page headers. Effort S/M (copy-only, many touchpoints).
- X-11 — Remove/hide "buy credits" copy in `AnalysisStudio.jsx:345`, `Account.jsx:433`, and the
  header's "0 credits" pill until the parked credits feature actually ships. Effort S.
- D-2 — Fix `CountryPage.jsx`'s static `WeeklyMap` import (part of X-7, called out separately as
  the cheapest single win). Effort S.
- D-9 — Add `document.title` to the ~8 pages missing it (Economy, Track Record, Analysis Studio,
  Membership, Breaking, Weekly Brief, Account, Whitepaper). Effort S.
- D-7 — Regenerate sitemap.xml: drop dead `/pricing`/`/cli` entries, add the missing real routes.
  Effort S.
- D-10 — Triage `narrative_thread` proxy contract failure (empty array) — confirm honest empty
  state vs. broken render. Effort S.
- A2 — Add `/breaking` and `/weekly-markets` to primary nav or footer. Effort S.
- E1-c — Fix Home's "Members follow countries…" link to point at `/membership`, not
  `/track-record`. Effort S.
- C-11 — Widen or truncate-gracefully the `/economy` Market Context sidebar column at desktop
  width. Effort S.

**P3 — nice to have**
- B-4/X-15 — Visually distinguish stale/inactive default entries (e.g. `/weekly/countries`'
  121d-stale "Escalating" Indonesia default) from genuinely current ones.
- B-8/X-21 — Explain or surface the gap between Track Record's headline trigger count and its
  resolved+awaiting sum (20744 vs 20729).
- A2 — Label the 4 nav dividers/groups, or make the disambiguating tooltip text visible beyond
  desktop hover.
- C-6 — Add a one-line visual cue in the nav before `/map`'s dark UI (confirmed intentional and
  working, just an unsignaled tone shift).
- C-15 — Add `prefers-reduced-motion` guards to the loading toast/spinner and `/spider-demo`'s
  globe animation.
- D-8 — Add a canonical `<link>` to `index.html`; sync the static vs. Worker-rendered title text
  for `/`.
- E1-a/X-12 — Give `/membership` a light nav/header presence beyond the footer.
- E2-b — Add one sentence to the `/analyze` anon gate clarifying member-vs-BYOK before sign-in.
- E3 — Give `/account` (signed-out) its own framing instead of reusing `/signin` byte-for-byte.
- A4 — Add a one-line framing note on `/map` that situations are a smaller, higher-bar category
  than story arcs (scope difference, not a bug).
- D-12 — Re-baseline `scripts/smoke-test.mjs`'s content selectors (e.g. `.home-shell`, `.clp-card`)
  against the current DOM — tooling debt, not a production bug (monitor-verified false positive;
  see D dimension notes). Effort S to verify, M to fix all selectors.
- B5 — no action needed; risk-tier/axis vocabulary already confirmed consistent.

**Needs repro, not yet a bug:** the "Summary renders nothing" case from the review brief —
unreproduced in 5 tries on Home; retest signed-in and on Thread/Country pages before filing.

## §5 Working well (keep)

- SPA deep-link/refresh integrity is clean across all 26 routes for human visitors (404.html
  fallback renders the correct page every time) — genuinely solid given the repo's history of
  404.html drift bugs.
- Honest empty/error states at the presentation layer: `/daily` ("hasn't been generated yet" vs.
  "No brief found for X"), `/breaking` ("Quiet is the normal state"), `/breaking/:id`, the 404
  page, `/analyze`'s anonymous gate, member-gated lock affordances (real content + honest count +
  `/membership` link, never a fake teaser).
- `tokens.css` itself is well-structured; the problem across the site is adoption, not design —
  newer pages (Daily, Weekly Brief, Breaking, Track Record, Analyze, Membership/Account/static)
  are consistently token-driven, low-hex, and near-zero-CLS, proving the pattern works.
- `/map` works correctly on prod (monitor-verified: 1 elevated situation, live "updated 56 min
  ago · next in 27 min"), is internally coherent as its own dark "war room" system, and its
  freshness line is the best-practice model the rest of the site should copy for X-2.
- `SituationMap3D` (deck.gl, the heaviest single dependency) is already correctly isolated into
  its own lazy-loaded chunk — the template for fixing X-7 everywhere else.
- Risk-tier and four-axis vocabulary (low/moderate/elevated/high; Conflict/Political/Economic/
  Humanitarian) is used consistently across Map, Country, and Thread pages.
- `/disclosures` is unusually rigorous about AI-vs-computed provenance, model names, and
  staleness caveats — a genuine differentiator if its honesty propagated up to the header badge.
- Analysis Studio has 5 non-redundant, correctly pre-filled entry points — the strongest
  discoverability of any single feature on the site.
- Client-error volume in production is very low (3 events/14 days), and the error-boundary→sink
  pipeline and `ErrorBoundary` (contains the deliberate `/__boom` crash without white-screening
  the app) both work end-to-end.
- Nav active-state logic is correct across every route; mobile hamburger has zero link-set drift
  from desktop.

## §6 Inputs for the page-structure discussion (facts only)

- **A4's overlap facts:** two clusters share a "job" without being redundant by design —
  (1) temporal: Home (live raw feed) / `/daily` (synthesized daily essay) / `/weekly-brief`
  (Sunday signals digest); (2) entity-axis: `/weekly` (chronological story-arc river) /
  `/weekly/countries` (geographic roll-up) / `/map` (spatial situation view). `PAGES_GUIDE.md`
  documents both splits as deliberate. Right now 2 of 3 temporal pages under-deliver relative to
  Home (`/daily` empty 2 days running, `/weekly-brief` 18 days stale) — that's a freshness-display
  problem (X-2), not evidence the split should collapse.
- **Entity-axis siblings' current scale:** Threads = 211 arcs / 507 articles; Countries = 66
  countries / 15 briefings; Map = 1 active situation. Map's narrower count is a deliberate,
  higher-bar category (situations ⊂ story arcs), confirmed working correctly on prod by the
  monitor — not a data gap.
- **Legacy-debt carriers (pre-token CSS + worst CLS), from C's file-level grep:** Threads
  (`WeeklyPage.css` 3073 lines, ~631 hex, ~0 `var()`), Home, Countries, Account, and `/map`'s 2D
  fallback path. Token-clean, low-CLS pages: Daily, Weekly Brief, Breaking, Track Record, Analyze,
  Membership, Account (static), About/Contact/Privacy/Disclosures/Whitepaper.
- **Pages that best serve the analyst/B2B buyer, per E's product-level read:** `/economy`
  (instrument-first, story-cited), `/track-record` (the calibration/Brier-score differentiator),
  CountryPage (risk-axis breakdown + "what changed" + watch triggers), `/analyze` (the actual
  workbench). Pages reading more consumer/retention than analyst-tool in register: `/breaking`'s
  newsletter CTA and Home's "Buy me a coffee" banner, which sit directly beside the analyst-facing
  Studio CTA on the same page (X-14).
- **SEO reality (monitor-verified):** crawlers currently see a working, content-bearing page only
  at `/` and `/weekly/country/<name>`; every other route — including every page listed above as an
  analyst-buyer or legacy-debt page — is a 404 to Googlebot regardless of its IA role. Any
  page-structure decision should treat "crawler-visible" as a separate axis from "well-designed
  IA," since right now they're almost entirely disjoint.
