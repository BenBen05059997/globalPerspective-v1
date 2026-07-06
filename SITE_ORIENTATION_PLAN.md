# Site Orientation Plan — make `/` land, make the pages legible

**Status:** PROPOSED (2026-07-06) · **Owner:** solo operator + agent
**Principle:** the site has no feature gap — it has a feature-surplus with an orientation gap. Nothing here adds a page or a backend. Everything is additive, reversible, frontend-only (except P4's Worker edit).

## Diagnosis (verified in code 2026-07-06)

1. `/` (Home.jsx) greets a cold visitor as a generic aggregator: masthead reads
   *"Trending topics from around the world, organised by region…"* — zero words about
   the actual differentiators (public forecast scoring, corrections ledger,
   self-correcting analysis). Left rail leads with a Buy-Me-a-Coffee button.
2. Top nav = 8 flat items (Daily · Weekly Brief · Map · Threads · Countries ·
   Economy · Analyze · Track Record). Four of them are overlapping "news briefing"
   products with no stated hierarchy; nothing explains Daily vs Weekly Brief vs
   Threads vs Breaking. `/membership` (how you pay for Analyze) is footer-only.
3. The trust chain (today's story → arc → scored forecast → corrections) exists as
   pages but the cross-links between them are thin.
4. The Cloudflare Worker pre-renders bot HTML for `/weekly/country/*`,
   `/weekly/thread/*`, `/daily` — but NOT `/`. AI crawlers see an empty SPA shell
   at the most-linked URL.
5. Dead weight: `pair_analysis` / `pair_analyses_list` proxy actions are served but
   no UI consumes them.

Strategy fit: the newsletter funnel is live (SubscribeCard + newsEmailSender,
2026-07-04) and the recorded direction is analyst/B2B trust-driven
(`ANALYST_TOOL_DIRECTION.md`, signal-API pivot). Conversion needs a *reason* on `/`.

---

## Phase 1 — Home masthead repositioning + trust strip (highest leverage)

**Files:** `src/components/Home.jsx`, `Home.css`

1. Replace the masthead sub-line with the value prop:
   > "AI-driven global intelligence that shows its work — every forecast publicly
   > scored, every revised conclusion logged."
   with inline links → `/track-record` (scorecard) and `/track-record` methodology
   section.
2. Add a compact **trust strip** (3 small stat-cards) under the masthead, directly
   above `SubscribeCard` (it is the subscribe motivation):
   - Corrections logged — count from `useCorrectionsFeed` (already cached 30min)
   - Forecasts under public scoring — from `useTrackRecord` totals
   - Sources / outlets today — from already-loaded topics
   **Honesty rule:** each card renders only from real returned data; absent data →
   card omitted (never a placeholder number). Reuse the existing honest-empty
   pattern (`LedeBand` renders nothing on no lede).
3. Move the Buy-Me-a-Coffee block from the left rail to the footer (Layout.jsx).
   *(Operator can veto — flagged as a positioning signal, not a functional need.)*

**Verify:** browser click-through (feedback_test_ui_in_browser) — cold load, cards
render real numbers, links work; kill the two hooks' cache and confirm cards omit
cleanly. `npm run verify` before commit.

## Phase 2 — Nav grouping + page-purpose descriptions

**Files:** `src/components/Layout.jsx` (+ its CSS)

1. Add `title=` tooltips to every nav link using the agreed one-liners
   (see "Page descriptions" below) — 5-minute change, zero layout risk.
2. Reorder/group the nav so temporal products sit together:
   **Daily · Weekly Brief · Breaking?** | **Threads · Countries · Map** |
   **Economy** | **Analyze** | **Track Record**
   (Breaking stays bell-only if adding it crowds the bar — decide in browser.)
3. Surface **Membership** next to Analyze in the funnel path: keep footer link, add
   a small "Membership" affordance on `/analyze` itself if not already present
   (check first — additive only).
4. Audit each page's masthead sub-line vs the agreed descriptions; fix only
   generic/missing ones. ONE tab/tone system per page (feedback_narrative_page_layout).

**Verify:** browser pass over every nav item, mobile hamburger included.

## Phase 3 — Wire the trust chain (cross-links)

**Files:** `ThreadForecast` (ThreadPage), `TrackRecordPage.jsx`, `CountryWhatChanged`

1. Forecast board (ThreadPage) → footer link "How these are scored → /track-record".
2. Track Record corrections ledger rows → link each note to its source
   country/thread page (data already carries `scope`+`name`).
3. Track Record scorecard → link "See live forecast boards" → `/weekly` (threads
   with forecasts).
4. CountryPage "What changed" band → small "All corrections → /track-record" link.

**Rule:** links only, no content duplication across pages (no center↔rail dup rule
generalizes: no page↔page dup).

**Verify:** click every new link both directions; `scripts/contract-check.mjs` if a
query-param contract is introduced (prefer plain paths — none planned).

## Phase 4 — Root-URL bot pre-render (SEO / AI-citation)

**Files:** Cloudflare Worker (`WORKER_FULL_CODE.md` is the source of record) — and/or
`frontend/index.html` static meta.

1. Minimum: enrich `index.html` `<meta name="description">` + OG tags with the
   Phase-1 value prop (build + deploy required; NEVER touch `docs/config.js`).
2. Better: add a `/` bot branch to the Worker (same 24 BOT_PATTERNS) returning
   pre-rendered HTML: value prop + the page directory (descriptions below) + link
   list. No Lambda call needed — static copy is fine and cannot go stale-wrong.

**Verify:** `curl -A "Twitterbot" https://globalperspective.net/` returns the
pre-render; normal UA returns the SPA.

**Status 2026-07-06:** (1) DONE — `index.html` meta/OG/Twitter descriptions now carry the
accountability value prop; noscript gained the Public Accountability bullet + link row fixed
(the old row linked `/pricing`, a deleted route → now `/track-record` + `/membership`); FAQ
schema gained an accountability Q&A; WebApplication featureList gained the track-record +
corrections-ledger entries. (2) CODE READY — `WORKER_FULL_CODE.md` updated with
`renderRootPage()` (static, no Lambda, 24h edge cache, og:type website) + the `/` bot branch;
JS syntax-checked + render smoke-tested. **OPERATOR ACTION: paste the updated
`WORKER_FULL_CODE.md` code block into the Cloudflare Worker editor and Deploy** (note: the doc
may lag any hand-edits made directly in the CF editor since 2026-04 — diff before replacing),
then run the curl check above.

## Phase 5 — Pairs decision (cleanup, independent) — ✅ RESOLVED 2026-07-06: premise was FALSE

The "unconsumed" claim (from ARCHITECTURE.md Lambda #8) was **stale**. Verified in code:
- `pair_analyses_list` is **live-consumed by `/map`** — `WorldMapV2.jsx` → `usePairAnalyses`
  renders the cross-country arc overlays (links, 7d/30d time-window filters, legend counts,
  selected-country link list). Removing it would have broken the map. **KEEP.**
- `pair_analysis` (single) is genuinely dead (`fetchPairAnalysis` in restProxy has no callers),
  but removing one read-only action isn't worth a redeploy of the highest-traffic Lambda.
  **KEEP, documented.**

Outcome: no backend change; ARCHITECTURE.md Lambda #8 corrected. Lesson: verify "unconsumed"
against code, not docs, before deleting.

---

## Page descriptions (canonical copy for tooltips / sub-lines / bot directory)

**Briefings (time-based)**
- **Home `/`** — Today's global stories, organized by region — with on-demand AI
  summary, forecast, and root-cause for any story.
- **Daily `/daily`** — The end-of-day intelligence brief: one synthesized read of
  what mattered today, published once daily.
- **Weekly Brief `/weekly-brief`** — Sunday signals digest: the week's discrete
  signals with fact and judgment kept separate — also delivered by email.
- **Breaking `/breaking`** — Rare, human-confirmed alerts for genuinely significant
  events. Quiet is the normal state.

**Intelligence (entity-based)**
- **Threads `/weekly`** — Ongoing story arcs ranked by risk: what's leading, what's
  developing, and how each story has evolved over weeks.
- **Thread detail** — One story's full arc: timeline, actors, economic impact —
  plus its living forecast board, scored in public as deadlines pass.
- **Countries `/weekly/countries`** — Every covered country ranked by risk tier,
  with a standing intelligence briefing per country.
- **Country detail** — A country's situation read: risk, story arcs, causal web,
  and "what changed" — the analysis corrects itself as news arrives.
- **Map `/map`** — Today's coverage on a world map: spatial view of the same live
  topics, with layer lenses.

**Markets & analysis**
- **Economy `/economy`** — The markets home: live instrument dashboard + which
  stories are repricing markets today; toggle to "This week" for the weekly wrap.
- **Analyze `/analyze`** — The Analysis Studio: run your own cited AI deep-dive
  across up to 4 stories — bring your own key, or run on ours as a member.
- **Membership `/membership`** — Reading is free forever. Membership buys analysis
  compute — running the Studio on our infrastructure.

**Accountability**
- **Track Record `/track-record`** — The accountability hub: every forecast
  publicly scored, every revised conclusion logged, methodology published —
  including which of our own predictions we excluded and why.

---

## Sequencing & ship discipline

- P1 → P2 → P3 are independent commits, each browser-verified before build
  (feedback_test_ui_in_browser), each deployable alone via `./deploy.sh`
  (404.html resync + map-strip handled by the script). CHANGES.md entry per ship.
- P4 needs the frontend deploy (for index.html) + a manual Worker edit (operator
  pastes / approves — Worker isn't in this repo's deploy path).
- P5 is backend-only (Lambda redeploy) and can happen anytime.
- Explicit non-goals: no standalone `/landing`, no hero art, no pricing-marketing
  pages, no new backend features, no removal of any existing feature
  (feedback_no_unauthorized_removal).
