# Page Structure Proposal — what each page is for, and what it should show (2026-09-24)

**Type:** discussion document for the operator. **Nothing here is built or approved.** No code changed.
**Author role:** page-structure designer, working from the 2026-09-24 whole-site review.
**Evidence base (cite these, not this doc, for facts):**
- Five reviewer reports from the 2026-09-24 review, with screenshots:
  `A_ia_nav` (IA/nav), `B_content` (honesty/empty states), `C_visual_a11y`, `D_perf_seo`,
  `E_product_funnel`. They live in the review session scratchpad. The consolidated record is
  `PAGE_REVIEW_2026-09-24.md`.
- Monitor-verified facts from the same day: every route except `/` returns HTTP 404 to a normal
  visitor (the GitHub Pages SPA fallback still renders the page). Home shows "LIVE · Updated
  hourly" next to "updated 11d ago". Credits are PARKED but the copy still advertises them. `/map`
  works and is honest about freshness ("updated 58 min ago · next in 26 min"). A DeepSeek balance
  outage since ~09-13 is starving the daily brief, summaries and fresh analyses. That outage is
  temporary.
- Strategy and plans: `.agents/product-marketing-context.md`, `strategy/ANALYST_TOOL_DIRECTION.md`,
  `redesign-ux/_active/MAP_HOME_SITUATION_PLAN.md` + `_LEDGER.md` (S6 home swap, approved but not
  built), `redesign-ux/_shipped/SITE_ORIENTATION_PLAN.md`, `billing/_shipped/MEMBER_GATING_PLAN.md`,
  `architecture/WORLD_MODEL.md`, `architecture/PAGES_GUIDE.md`,
  `redesign-ux/_reference/COUNTRY_INTEL_VS_STUDIO_2026-09-24.md`.
- Route table: `global-perspectives-starter/frontend/src/app/App.jsx:100-126`. Nav:
  `app/layout/Layout.jsx:62-70`.

**Where I land, in one paragraph.** For the next build cycle the front door should be a **composed
"Today" briefing page**, not the map. The map is honest and well built, but today it shows **one**
situation (a GDACS cyclone). Its own footer says "Conflict, political and economic situations
arrive with the news layer". The map plan itself records that "the map will feel thin until S3
exists" (`MAP_HOME_SITUATION_PLAN.md` §12). So keep S6 approved but put a **measurable gate** on it
(§5 Q2). Around that front door, collapse nine nav items into six reader jobs. Give the unit of
news one public name, **story**, with clean URLs. Promote the two pages that already do analyst
work, the **Story** page and the **Country** page, to the core of the site. And weave the track
record into them instead of leaving it in a side room.

---

## §1 Reader jobs, and who each one serves

The monitor's framing lists five jobs: now, the week, go deep, markets, trust/analyze. It is close.
The reviews correct it in four places.

| # | Reader job | Pages that serve it today | Primary audience | What the reviews say |
|---|---|---|---|---|
| J1 | **"What's happening now, and how bad?"** | `/` topics feed, `/map`, `/breaking`, `/daily` | Everyone. It is the entry job | **Four front doors, four data sources, four freshness stories.** Home says "LIVE" but "updated 11d ago" (B-1). `/daily` is empty two days running, and its first link is DEAD (A3). `/breaking` is honestly empty (B ii). `/map` has 1 situation versus 211 arcs on `/weekly` (A4). |
| J2 | **"Catch me up on the week"** | `/weekly-brief`, `/weekly` (river) | Engaged reader, busy executive | The `/weekly-brief` "latest" is dated Sep 6 against Sep 24, with no stale flag (A1/A4). Its signals don't link to their stories (`PAGES_GUIDE.md`, weekly-brief known issue). |
| J3 | **"Explain this story or country to me: history, cause, where it goes"** | Story page (`/weekly/thread/:id`), Country page (`/weekly/country/:name`), `/weekly/countries` | **Analyst / thesis-producer.** This is the buyer job | These are the strongest pages on the site (screenshots: living forecast, 4-axis risk profile, "What changed", What to watch). They are also the worst built: 516–572px mobile overflow (C-10), CLS 0.3–0.87 (C-19), 9 duplicate fetches (D-4), pre-token palette (C-7). They sit under a legacy `/weekly/` prefix. |
| J4 | **"What is this repricing?"** | `/economy` (+ `?view=week`, `/weekly-markets`) | Fund / macro analyst, executive | #2 content page by usage (`PAGES_GUIDE.md`). But the "Today's driver" cites a story updated 103 days ago (B-2), and 60 of 223 crawled links degrade to aged-out stories (A3). |
| J5 | **"Can I trust this?"** | `/track-record`, `/disclosures`, "What changed" bands | **Analyst, and the B2B evaluator** | The differentiator. It is findable (nav + footer, B4). But the Home stat strip is its only on-ramp from the reading flow, and one member sentence routes there by mistake (E1-c). |
| J6 | **"Let me interrogate it myself"** | `/analyze` (Studio) | Analyst | Strong discoverability with 5 entry points (E2). The copy sells parked credits (E2-a, P1). |
| J7 | **"Tell me when it changes"** (the monitor's framing omits this job) | Bell → `/breaking`, newsletter `SubscribeCard`, Follow (member), drift email (cron disabled) | Returning reader, member | There is no site-wide "since you were last here". The retention loop depends on email alone (E4). |

**Corrections to the monitor's framing:**
1. **J1 does not need four doors; it needs one door with four modules.** A (A4) argues for keeping
   the Home/Daily/Weekly-Brief split on editorial grounds. I agree the *formats* differ. I
   disagree that they need to be *peer nav destinations*. Two of the three are the least reliable
   pipelines, and the front door should not depend on them (A4's own recommendation).
2. **Tracking (J7) is a job of its own**, and the product sells it: membership buys "change-alerts on
   followed countries" (`MEMBER_GATING_PLAN.md` §1). It needs a home. It has none.
3. **Markets is not a peer of the news jobs for the stated buyer. It is a lens on J3.** Funds want the
   "why is Brent moving → which story" bridge, which is `/economy`'s best feature. Keep the page,
   but its job is the story↔instrument bridge, not a second front door.
4. **The main problem is not that the deep pages are buried. It is that they are brittle.** They
   are reachable from everywhere (A3: the Home → Thread → Country spine is 73% healthy). What
   hurts them is load cost, mobile breakage, URL naming, and a "not found" state for stories
   older than 30 days.

---

## §2 Target sitemap (recommended)

```
/                      Today            (composed briefing: lede · ranked stories · live situations module · trust strip)
/stories               Stories          (index of every story, the river; was /weekly)
/story/:id             Story            (the analyst unit; was /weekly/thread/:id; archived state instead of not-found)
/world                 World            (situations map + country risk index; absorbs /map and /weekly/countries)
/country/:name         Country          (was /weekly/country/:name)
/markets               Markets          (was /economy; ?view=week absorbs /weekly-markets)
/briefings             Briefings        (latest Daily + latest Weekly, honestly dated; archive)
  /briefings/daily/:date                (was /daily/:date)
  /briefings/weekly                     (was /weekly-brief)
/alerts                Alerts           (was /breaking; bell destination, not in top nav)
  /alerts/:id                           (was /breaking/:id)
/track-record          Track Record     (accountability hub; unchanged URL)
/analyze               Studio           (unchanged URL; nav label "Studio")
/membership · /signin · /auth/callback · /account
/about (absorbs /contact) · /methodology (was /disclosures) · /privacy · /whitepaper
/spider-demo (unlisted, noindex) · /__boom (dev) · * (404)
```

**Top nav: 6 items + tools.** `Today · Stories · World · Markets · Briefings · Track Record`, then
on the right: `Studio` (button) · `Membership` (quiet pill for non-members) · bell · Sign in.
Today's nav has 9 items in 4 unlabeled groups, with no Membership and no Breaking (A2, E1-a).

### Route disposition — every current route

| Current route | Disposition | Target | Reason (evidence) |
|---|---|---|---|
| `/` (Home topics feed) | **Keep, rebuild** | `/` Today | The only route returning 200 + bot pre-render (D-6). The deterministic lede (`composeTopicsLede`, no LLM) survives LLM outages. Needs an H1 (C-16), the 596px overflow fixed (C-10), and the 5× duplicate `topics` fetch fixed (D-4). |
| `/map` | **Merge into** | `/world` (hero layer) + a module on `/` | 1 situation today (A4 + screenshot). There are two maps on the site (this one and `CountryOverviewMap` on `/weekly/countries`). One World page gives the map the density it lacks (§3.4). Redirect `/map` → `/world`. |
| `/weekly` | **Rename + redirect** | `/stories` | Nav says "Threads", the page says "Story Arcs" (B-5). The URL says "weekly" but it is a 30-day river. |
| `/weekly/thread/:id` | **Rename + redirect** | `/story/:id` | The core analyst page. LinkedIn, email and the Worker pre-render deep-link here, so the redirect must be a permanent edge 301 (§7). |
| `/weekly/countries` | **Merge into** | `/world` (index section) | Same entity as the map (countries). Its hero is already a map. It has 66 countries / 15 briefings, which gives the map real content. |
| `/weekly/country/:name` | **Rename + redirect** | `/country/:name` | Analyst watchlist unit (`ANALYST_TOOL_DIRECTION.md`: "watchlist unit = regions"). |
| `/economy` | **Rename + redirect** (optional) | `/markets` | "Markets" matches the job (J4) and the nav label buyers expect. Low priority. Keeping `/economy` is acceptable. |
| `/economy?view=week`, `/weekly-markets` | **Retire alias** | `/markets?view=week` | Byte-identical duplicate (A4). Keep one canonical URL and redirect the alias. |
| `/daily`, `/daily/:date` | **Merge into** | `/briefings` + `/briefings/daily/:date` | Empty two days running with a DEAD first link (A3). Returns 404 even to Googlebot (D-6). Inside Briefings it falls back honestly to the latest available edition. |
| `/weekly-brief` | **Merge into** | `/briefings/weekly` | 18 days stale with no flag (A4). Same job family as Daily. Its SubscribeCard becomes the Briefings page CTA. |
| `/breaking`, `/breaking/:id` | **Rename + keep** (out of top nav) | `/alerts`, `/alerts/:id` | Email alerts deep-link to `:id`, so keep the route. "Quiet is the normal state" is good copy (B). As a top-nav peer it would be empty most days. Surface it as a band on Today when something is active, plus the bell. |
| `/track-record` | **Keep** | same | The differentiator. It also feeds per-story/per-country accountability modules (§4.4). |
| `/analyze` | **Keep** (nav label → "Studio") | same | The operator decided today that the Studio is the home for on-demand analysis (pairs → "Bilateral relationship" lens; "Country deep-dive" lens reads the country cron). |
| `/membership` | **Keep, surface** | same | Footer-only today (E1-a). Add a quiet nav pill. |
| `/signin`, `/auth/callback`, `/account` | **Keep** | same | They work and fail closed (E3). `/account` signed-out should say what's waiting for you (E3, P3). |
| `/about` + `/contact` | **Merge** | `/about` (contact section at bottom) | `/contact` is three cards. It doesn't earn a route. Redirect `/contact` → `/about#contact`. |
| `/disclosures` | **Rename + redirect** | `/methodology` | B calls it "the site's strongest honesty surface" and says few visitors read it. "Methodology" is the word an analyst clicks. Keep the legal content. |
| `/privacy`, `/whitepaper` | **Keep** | same | Static. They pass (C grade A−). |
| `/spider-demo` | **Keep unlisted, noindex** | later absorbed as the Country/Story "Causal Web" tab | Prototype. The Country page already has a Causal Web tab (screenshot). Retire the route once that tab ships. |
| `/__boom`, `*` | **Keep** | same | Diagnostic / 404 work (A5). Exclude `__boom` from the sitemap. |
| `sitemap.xml` `/pricing`, `/cli` | **Remove** | — | Both 404, and neither is in `App.jsx` (D-7). |

---

## §3 Page-by-page target structure (surviving pages)

Each page gets a **job**, an **audience**, **sections in order**, **next links**, **data and
staleness handling**, and a **remove list**. "Fold" means the first 900px of a desktop viewport.

### 3.1 `/` Today

- **One job:** in 60 seconds, tell me what matters in the world right now, how sure you are, and
  where to go deeper.
- **Audience:** everyone arriving cold, including the analyst evaluating us. Written in the analyst's
  register.
- **Sections (priority order):**
  1. **Header line (above the fold):** H1 "Today" + the date + **one freshness stamp** derived from
     the data: "Stories updated 7h ago · next run ~HH:MM". It replaces the static "LIVE · Updated
     hourly" strip everywhere (B-1).
  2. **Lede band (above the fold):** the existing deterministic `composeTopicsLede` sentence. It
     survives LLM outages, which is why it leads and the LLM-written Daily essay does not.
  3. **Lead stories (above the fold):** the top 3–5 *stories*, ranked by the canonical tier
     (`WORLD_MODEL.md` D2: one importance scale; D1: EVENTS lead). Each card shows the tier chip,
     place, "day N of this story", the corroboration chip (outlets/regions), the latest forecast line
     if one exists, and a **"Read the story →"** link to `/story/:id`. The Summary/Predict/Trace
     button trio moves off the cards. It lives on the Story page.
  4. **Live situations module:** a compact, light-framed card that embeds the map's ranked situation
     list ("1 situation being watched · India — tropical cyclone · Elevated") with a small static map
     thumbnail and **"Open the World view →"**. When there are zero or few situations it says so in
     words (the map's own honesty copy).
  5. **Alerts band:** renders only when an alert fired in the last 7 days (reuses `BreakingStrip`).
  6. **By region:** the rest of today's stories, grouped by region, one condensed row each. (This is
     the current Home body, demoted and denser.)
  7. **Developments band:** placeless science/tech/society items, clearly secondary, no pins
     (`WORLD_MODEL.md` D1).
  8. **Trust strip:** Brier score + resolved count + corrections logged, each linking to
     `/track-record`. It renders only from real data (`SITE_ORIENTATION_PLAN` P1 honesty rule).
  9. **Briefings CTA:** "Get the Weekly Signals Brief (free)", one form. Use the verb "Get", not
     "Subscribe" (E1-b).
- **Next links:** `/story/:id` (primary), `/world`, `/briefings`, `/track-record`, `/analyze?stories=`.
- **Data:** topics/`latest` + archive threadIds (for "day N" and tiers), `world/latest.json` (situations
  module), track-record summary. **Staleness:** if topics are more than 9h old (the
  `newsFreshnessMonitor` threshold), the header stamp turns amber: "Delayed — last update 11d ago".
  Cards keep their own age. Never show "LIVE".
- **Remove:** "Buy me a coffee" (E product read; `SITE_ORIENTATION_PLAN` P1.3 already proposed moving
  it), the static LIVE strip, the per-card AI button trio, the Home member sentence that links to
  `/track-record` (E1-c; the membership line goes to `/membership` or is dropped), and the first-visit
  tour overlay as a blocking modal (A5: it blocks the mobile hamburger).

### 3.2 `/stories` Stories (was `/weekly`)

- **One job:** browse every story we're tracking, filter by what I care about.
- **Audience:** analyst in "lookup" mode, returning reader.
- **Sections:** H1 "Stories" + count + freshness → the LEAD + DEVELOPING hierarchy (keep; `RISK_TIERS_PLAN`)
  → category chips → the time-banded river (This week / Earlier this month / Archived) → the left-rail
  filters (region, country, period).
- **Next:** `/story/:id`, `/country/:name`.
- **Staleness:** each row shows its age. Arcs older than 30 days are "Archived", not hidden (see 3.3).
- **Remove:** the "What are Story Arcs?" explainer box (one line under the H1 replaces it), the in-page
  "Map" view toggle (the World page owns maps; this also removes the D-2 lazy-split defeat), and the
  blank dark hero during load (B-3). Replace it with a skeleton.

### 3.3 `/story/:id` Story (was `/weekly/thread/:id`)

- **One job:** everything an analyst needs to form a view on one story: what happened, why, where
  it goes, how sure we are, and what changed.
- **Audience:** analyst / thesis-producer. **The single most important page for the stated buyer.**
- **Sections (above the fold first):**
  1. Breadcrumb (wraps on mobile; C-10) → H1 → dek → a **status line**: tier · day N · events ·
     outlets/regions corroboration · "analysis as of Sep 13" · actions (Analyze in Studio, Share,
     Copy briefing, Follow).
  2. **Bottom line** (existing) + **Living forecast** (existing right-rail block, promoted into the main
     column on mobile): scenarios with probabilities and dated triggers, plus one line: "Our forecasts
     overall: Brier 0.154 across 122 resolved triggers →".
  3. **What changed** (drift note; the latest is free, the history is for members, per `MEMBER_GATING_PLAN`).
  4. Tabs: **Timeline · Root cause · Actors · Sources · Markets** (the Economy tab, renamed) · later
     **Causal web**.
  5. Right rail: risk profile (4 axes), what to watch, related stories, countries involved.
- **Next:** `/country/:name`, related `/story/:id`, `/analyze?stories=…`, `/markets` instrument rows,
  `/track-record#methodology`.
- **Staleness:** the "as of" date on every AI block (already done well: "LIVING FORECAST · AS OF SEP 13", B ii).
  **Stories older than the 30-day archive window render an "Archived story" state** (last known
  analysis + timeline, read-only) instead of the current "not found" adjacent message. This fixes the
  60 degraded `/economy` links (A3) at the destination.
- **Remove:** the duplicate `topics` fetch via `IntelligenceLoader` (D-4), and the pre-token palette (C-7).
  "Summary / Predict / Trace Cause" buttons from Home land here as the tabs above, not as buttons.

### 3.4 `/world` World (absorbs `/map` + `/weekly/countries`)

- **One job:** where in the world is risk concentrated, and what is actively being watched.
- **Audience:** analyst scanning regions; executive "where is the exposure" read.
- **Sections:**
  1. **Map panel (dark instrument panel inside the light page, above the fold)** with two layers and
     a toggle: **Situations** (the current SituationHome: hue = axis, tier glow, escalating marker,
     freshness "updated X · next Y") and **Country risk** (canonical tier from country intelligence
     for the ~15–20 briefed countries). Default layer: Situations when at least 3 are open, otherwise
     Country risk, and the page says which and why.
  2. **Situations list** (ranked, plain-language states; the existing S4.5 work).
  3. **Country index:** risk-tier bands (High cards → Elevated/Moderate/Low rows), filtered to briefings
     updated within 14 days. Everything older goes under **"Not updated recently"** with its age
     (fixes B-4: Indonesia 121d showing "Escalating" by default).
  4. "How we read the world" methodology strip (existing, from `/map`).
- **Next:** `/country/:name`, `/story/:id` (situations with a thread), GDACS report links.
- **Data:** `world/latest.json`, `country_intelligence` list. **Staleness:** the map's grey-out state
  (plan WS4 honesty states) plus per-country age.
- **Remove:** the "Elsewhere on Global Perspectives" card rail (nav does that job), the separate
  `CountryOverviewMap` hero (one map per site), and the Google Maps embed on country pages (D: 27
  tile requests) in favour of the shared map.
- **Why merge instead of making the map the home:** see §5 Q2. The map's two data sources (GDACS
  situations; country tiers) together fill a page. Either one alone is thin today.

### 3.5 `/country/:name` Country (was `/weekly/country/:name`)

- **One job:** a standing, forwardable country briefing: current read, risk by axis, what changed,
  what to watch.
- **Audience:** analyst, consultant (the "client briefing" persona; E product read: "closest thing on
  the site to a briefing a policy/consultancy buyer would actually forward").
- **Sections:** header (name · tier · updated N ago · Follow (member) · Copy briefing · "Deep-dive in
  Studio →" (the future Country lens, per today's operator decision)) → **Bottom line** → **Risk
  profile** (4 axes with the one-line why) → **What changed** (free latest + member history, as
  today) → **What to watch** (dated) → tabs: Stories · Timeline · Causal web · Coverage → right rail:
  key actors, economic disruption, macro/FX.
- **Staleness:** if the briefing is more than 14 days old, a banner above the bottom line reads
  "This briefing was last updated N days ago. Recent stories are listed below." The Stories tab stays
  live from the archive.
- **Remove:** the embedded `WeeklyMap`/Google Maps hero (C-10 overflow, D-2 static import, D
  request count). Replace it with a small static locator. Also drop the 9× duplicate fetch (D-4).

### 3.6 `/markets` Markets (was `/economy`)

- **One job:** which instruments are moving, and which stories are moving them.
- **Audience:** fund / macro analyst, executive.
- **Sections:** "Today in markets" briefing band (existing deterministic composer, **restricted to
  inputs updated within 72h**, so "Today's driver" can never cite a 103-day-old story; B-2) →
  "Repricing today" leaderboard → by-story bridge → watchlist rail → `?view=week` weekly wrap.
- **Next:** `/story/:id?tab=markets`, `/country/:name`.
- **Staleness:** every disruption row carries its age. Rows older than 30 days collapse into "Older
  disruptions".
- **Remove:** the `/weekly-markets` alias. Fix the sidebar label truncation (C-11) and CLS 1.195 (C-19),
  the worst on the site.

### 3.7 `/briefings` Briefings (absorbs `/daily` + `/weekly-brief`)

- **One job:** the synthesized read: one daily essay, one weekly signals digest, each honestly dated.
- **Audience:** engaged reader, executive, newsletter subscriber.
- **Sections:** two cards side by side: **Latest daily brief** (date + "generated N ago") and **Latest
  weekly signals** (week-of + "published N ago") → the selected edition below → edition archive by date.
- **Staleness and empty states:** if today's daily is missing, show the **most recent available** edition
  with "Today's brief is delayed — showing Sep 12" and a link to Today (E4). Never step into an empty
  previous day (A3 DEAD link): date arrows skip to dates that have content. If the weekly is more than
  8 days old, flag it "Behind schedule".
- **Next:** weekly signals link **into `/story/:id`** (fixes the `PAGES_GUIDE` known issue: signals link
  only external sources), and so do daily country chips (`/country/:name`).
- **Remove:** two separate nav items. The formats stay distinct; only the door merges.

### 3.8 `/alerts` Alerts (was `/breaking`)

- **One job:** the archive of significance-bar alerts, plus the email preference.
- **Audience:** alert subscribers arriving from the bell or email.
- **Sections:** "Quiet is the normal state" copy (keep, B) → alert list → alert email opt-in.
- **Next:** `/story/:id`, `/world?focus=`. Not in the top nav.

### 3.9 `/track-record` Track Record

- **One job:** prove, or disprove, that our forecasts deserve trust.
- **Audience:** analyst, B2B evaluator.
- **Sections:** Brier + verdict with the **resolved-count caveat stated plainly** (122 resolved of 20,744
  dated triggers; `ONE_TRUTH`/ledger backlog policy "lapsed unscored" disclosure) → calibration table →
  recently resolved (wins and misses; B praises this) → corrections ledger (capped for non-members) →
  methodology.
- **Fix:** counters that don't sum (B-8; show the third bucket), 549px mobile overflow (C-10), 52
  contrast hits (C-13).
- **Next:** links from each resolved item to its `/story/:id`. Today citations are plain text (`PAGES_GUIDE`).

### 3.10 `/analyze` Studio

- **One job:** run my own cited analysis over stories (later: a country, a bilateral pair, my own doc).
- **Audience:** signed-in analyst.
- **Sections:** gate (anon) that states the paths honestly: "Free with your own API key · members run on
  our compute" (E2-b) → Step 1: pick subject. Today that means stories. The operator-decided lenses add
  **Country deep-dive** (reads the country cron) and **Bilateral relationship** (replaces pairs).
  → Step 2: lens → Run → report + validator banner.
- **Remove now:** every "buy credits / top up with credits" line (`AnalysisStudio.jsx:345`,
  `MembershipPage.jsx:16`, Buy-credits buttons at `MembershipPage.jsx:133`, `Account.jsx:433`) until
  `PROD_CREDITS_NEXT_STEPS.md` is executed (E2-a, P1).

### 3.11 Account cluster: `/membership`, `/signin`, `/account`, `/auth/callback`

- `/membership`: keep the page as is (E3: honest, correct prices). Its benefits list must match what is
  live (no credits). Reached from the nav pill and the lock affordances.
- `/account` signed-out: "Sign in to see your saved stories, followed countries and alerts" (E3).
- `/signin`: keep. `PAGES_GUIDE` notes a hardcoded redirect to `/weekly`. The `returnTo` param
  appears in the E crawl, so verify it, and point the default at `/`.

### 3.12 Static: `/about` (+contact), `/methodology` (was `/disclosures`), `/privacy`, `/whitepaper`, 404

- `/about`: rewrite "Who we are" out of the hobbyist register (E product read). Remove the "refreshed
  hourly" claims (B-6). Contact section at the bottom.
- `/methodology`: today's disclosures content (AI-generated vs computed, models, judge) plus links to the
  track-record methodology. This is where "What does the tier mean" lives.
- `/whitepaper`: remove "Hourly AI analysis" (B-6).

---

## §4 Cross-cutting design principles

### 4.1 Freshness is data, never decoration
- **One claim per page, derived from the data it shows,** in the form `Updated <age> · next ~<time>`.
  This is already locked in the map plan (§6: "No LIVE badge — batch cadence is shown as Updated ·
  next"). Apply it to the whole site and **delete the static "LIVE · Updated hourly" strip** (B-1).
- **Three visual states:** current (neutral) / delayed (amber, over 9h per `newsFreshnessMonitor`) /
  stale (grey with an explicit age). The same age thresholds apply everywhere: story, country, markets row.
- **The word "today" must be earned.** Any composer that says "today" must filter its inputs to the
  window it claims (B-2).
- **Defaults never land on stale content** (B-4). Stale content is grouped, dated and demoted, but never
  hidden (no-misinformation rule; `feedback_no_misinformation_fallback`).
- **Content never 404s because it aged.** Archived state instead (A3).

### 4.2 One unit of news: the story
- Public noun **"story"** everywhere: nav, H1s, chips, URLs (§5 Q4). **"Topic"** leaves the UI; it
  stays an internal/pipeline term. **"Thread"** and **"arc"** are internal/data terms
  (`threadId`); "story arc" can survive only as the name of the Timeline tab.
- **"Situation"** stays, but only as a **status of a story or event on the World map** ("being watched").
  This follows `WORLD_MODEL.md` §1: situation and thread are "two lifecycle aspects of the same event,"
  not two entities. Copy: "A situation is an event we're actively monitoring. Open its story →". A
  GDACS-only situation without a story says "No written analysis for this alert level" (plan §3.1 Option A).

### 4.3 Membership placement
- **Public reading stays free; the receipts stay public** (`MEMBER_GATING_PLAN` non-negotiables).
- Membership appears in three places only: (a) a quiet nav pill, (b) honest lock affordances where
  there is genuinely more (correction history, Follow, full ledger), (c) the Studio compute path. It
  never appears as a blurred teaser.
- **Separate the verbs:** "Get the brief (free)" for the newsletter, "Join" for membership (E1-b).
- The copy only promises what is live. Credits come out until they ship (E2-a).
- Remove the coffee ask from reading surfaces. It undercuts the B2B register (E product read). The
  footer is acceptable if the operator wants to keep it.

### 4.4 Accountability woven in, not a side room
- Every forecast block (Story living forecast, Today lead cards, Country watch list) carries a
  one-line calibration footnote linking to `/track-record` ("Our forecasts overall: Brier X across N
  resolved →").
- Every "What changed" band links to the corrections ledger.
- Track Record items link back to their stories. That closes the loop both ways.
- **Honesty guard:** state N resolved next to the score. 122 resolved versus 20,744 dated triggers is
  thin. Quietly overselling it would contradict the differentiator.

### 4.5 Visual system: light editorial, with the map as a contained dark instrument
- **Decision recommended:** the site is **light editorial** (`tokens.css`: warm paper, rust accent),
  which the newest, cleanest pages already use (C: daily, track-record, analyze at A−). The map
  keeps its dark "war room" treatment **as a framed panel inside a light page** (on `/world`, and as
  a small module on `/`), not as a full dark page.
- This resolves C-6's "different product" jolt without discarding the well-built dark map.
- **It conflicts with the map plan's locked "dark theme for the front door"** (§6). That decision was
  made on the premise that the map *is* the front door. If Q2 goes to map-as-home, the dark front
  door stands. If it goes to my recommendation, the dark treatment moves inside the frame.
- The pre-token pages (Threads, Country, Account, parts of Home; C-7) get migrated as part of their
  rebuild in §6, not as a separate paint job.

### 4.6 Every page: one H1, one freshness stamp, one primary next action
C-16 found 9 pages with no H1. D-9 found 8 pages with no `document.title`. Each surviving page gets a
title, an H1, a stamp and a primary "next" link. This is also the SEO baseline.

---

## §5 The four open operator questions

### Q1 — Primary audience: analyst/B2B vs general reader

| Option | Implies |
|---|---|
| **A. Analyst / thesis-producer first; general reader welcome** *(recommended)* | Pages are ordered for J3/J5 (Story, Country, Track Record are core). Analyst register (no coffee ask, "Methodology", dated triggers up front). Reading stays free and SEO-able, and the free reader is the funnel. Consistent with `ANALYST_TOOL_DIRECTION.md` ("RESOLVED: enterprise — thesis-producers") and the member-gating model. |
| B. General "engaged citizen" first | Home becomes a consumer news product (a feed, breaking prominent, simpler words). Competes with Ground News/Apple News, a space the marketing context itself calls "consumer news dead" (memory `reference_market_competitive_research`). Contradicts the recorded strategy. |
| C. Dual track (separate analyst area) | Two IAs to maintain for a solo operator on low traffic. Not justified by the usage data (`reference_observability_usage`: traffic low). |

**Recommendation: A.** Consequence: the general reader still gets a clean Today page and free
briefings, but every design tie-break goes to the analyst. The cost: the site will read slightly
denser to casual visitors.

### Q2 — The one front door

| Option | For | Against (evidence) |
|---|---|---|
| A. **Map-as-home (S6 as planned)** | Approved 2026-09-08. Answers "where and how bad" in 3 seconds. Visually distinctive. | Today it shows **1** situation, GDACS only. The news layer isn't producing map situations yet (map footer copy; plan §12: "thin until S3 exists"). A cold visitor lands on an almost empty world. Dark front door vs light site (C-6). `/` is the only route with a working 200 + bot pre-render (D-6), so the Worker pre-render must be rebuilt from `world/latest.json` (S6 scope). For the analyst buyer, the map answers "where", not "why / what next" (J3). |
| B. **Topics feed (status quo)** | Exists and has content. Deterministic lede. | A list of 13 LLM-picked topics with button trios. It reads as an "aggregator" (`SITE_ORIENTATION_PLAN` diagnosis #1). Freshness is contradictory (B-1). |
| C. **Composed "Today" briefing** *(recommended)* | Reuses existing parts: lede band, `BreakingStrip`, trust strip, the topic list demoted, the situations list. It survives LLM outages because it leads with deterministic parts. It puts stories (J3's unit) and trust (J5) above the fold. The map appears as a module, so its honesty and craft still show. | It is not the bold visual statement S6 promised. It still depends on the topics pipeline for the story cards. |

**Recommendation: C now, with S6 kept behind a measurable gate.** Proposed gate for promoting the map to the
hero of `/`: **the news layer (S3/S7) is live, and over 14 consecutive days the map has a median of at least 5
open situations spanning at least 2 axes.** Until then, the map lives on `/world` as a panel and as a module on
`/`. Consequences: S6·T1 changes from "swap `/`" to "add the situations module to Today and the `/map` →
`/world` redirect". The rest of S6 (pair route, legacy deletes, Worker pre-render) is unaffected. The
"dark front door" decision becomes conditional (§4.5). **This disagrees with a recorded decision. The
operator should explicitly confirm or overrule it.**

### Q3 — Acceptable merges

| Merge | Options | Recommendation + consequence |
|---|---|---|
| `/daily` + `/weekly-brief` → **Briefings** | (a) merge the door, keep both formats · (b) keep separate · (c) retire Daily | **(a).** It keeps A's editorial distinction and removes two unreliable pages from the nav. Consequence: one route family, one SubscribeCard, date-skip logic. Daily's LLM dependency stays, but its failure stops being a dead front door. |
| `/breaking` → Today | (a) band on Today + bell + `/alerts` archive · (b) top-nav item · (c) retire the page | **(a).** Email deep links need `/alerts/:id`. As a nav peer it would be empty most weeks by design. |
| `/weekly/countries` + `/map` → **World** | (a) merge into `/world` · (b) countries list into the map only · (c) keep both | **(a).** Two maps and one entity. The merge also gives the map density now. Consequence: the World page has a layer toggle. The country list's `CountryOverviewMap` is deleted. |
| `/weekly-markets` alias | retire | Yes (A4 duplicate URL). |
| `/contact` → `/about` | merge | Yes. It is low stakes. |
| `/spider-demo` → Causal Web tab | absorb later | Yes, once the tab covers more than the gated countries (`ANALYST_TOOL_DIRECTION`: systems graph gated to Argentina/Iran). |
| **Not merged:** Stories index vs Today | — | Different jobs (browse everything vs what matters now). Keep both. |
| **Not merged:** Country pages into the Studio | — | Per `COUNTRY_INTEL_VS_STUDIO_2026-09-24.md`: 7 live consumers, and the public page must stay free. The Studio *reads* it (Country lens). |

### Q4 — One name for the unit of news

| Option | Implies |
|---|---|
| **A. "Story" public; `thread`/`topic` internal; "situation" = map monitoring status** *(recommended)* | Plain word, matches Home copy ("any story below") and the marketing glossary ("story arc"). URLs `/stories`, `/story/:id`. The copy rewrite touches nav, H1s, chips and tooltips (B-5: S/M effort). |
| B. "Thread" everywhere | Distinctive and already in the nav. But the page content calls them "Story Arcs" (B-5), and "thread" is jargon to a cold visitor. It also collides with social-media "threads". |
| C. "Situation" everywhere | Aligns with the map pipeline. Wrong for editorial stories that aren't monitored situations (developments, elections). It would imply monitoring that doesn't happen. |

**Recommendation: A.** Consequence: one-time URL migration with permanent redirects (see §7 risk 2).
Pipeline and DDB names stay (`threadId`, `THREAD#`). Only the UI and URLs change.

---

## §6 Sequencing

### Stage 0 — ship before any restructure (cheap, P1, independent of every decision above)
1. **SEO 404:** make the Cloudflare Worker return **200** with the SPA shell for every known route
   pattern. Today every route except `/` is a 404 to visitors and non-matched crawlers. Also fix the
   `/daily` bot pre-render that falls through (D-6) and `sitemap.xml` (drop `/pricing`, `/cli`, add real
   routes; D-7). This comes first because every later URL change also lives in the Worker.
2. **Freshness badge:** remove the static "LIVE · Updated hourly" strip and replace it with a data-derived
   stamp (B-1). Remove "hourly" from `/about` and `/whitepaper` (B-6).
3. **Parked-credit copy:** remove the credits language and buttons listed in §3.10 (E2-a).
4. **Small honesty/funnel fixes:** the Home member sentence goes to `/membership` (E1-c), `/daily` falls
   back to the latest edition plus a Home link (A3/E4), the onboarding tour stops blocking the mobile
   hamburger (A5), `document.title` on the 8 pages missing it (D-9), and the `/economy` "today" window
   filter (B-2).
5. **Performance hygiene that every later page benefits from:** in-flight de-dupe in `restProxy.js`
   (D-4, a few lines), route-level `React.lazy` in `App.jsx` (D-1).

### Stage 1 — naming and nav (copy-level, reversible)
Nav reorganized to 6 items + Studio/Membership. "Story" vocabulary in the UI (Q4). Methodology
label. No URL changes yet.

### Stage 2 — URL migration (structural, once)
`/stories`, `/story/:id`, `/country/:name`, `/world`, `/briefings/*`, `/alerts/*`, `/markets`,
`/methodology`. **Permanent 301s at the Worker edge** for all old paths, including query strings
(`?tab=economy` → `?tab=markets`). Update the outbound generators that hardcode old paths: LinkedIn
poster (`weekly/thread/…`), email sender, RSS, BreakingDetail "See on the map", Worker bot
pre-render matchers. Traffic is low (`reference_observability_usage`), so **the SEO cost of moving is
lowest now.** That is an argument for doing it before growth work, not after.

### Stage 3 — the analyst spine (the biggest value)
Rebuild the **Story** and **Country** pages on tokens: fix mobile overflow and CLS, archived-state
stories, accountability footnotes, no Google-Maps hero. This is where the buyer lives. It also clears
the worst C/D debt (C-7, C-10, C-19, D-2, D-4).

### Stage 4 — Today (the composed home)
Build `/` per §3.1 with the situations module.

### Stage 5 — consolidations
Build `/world` (map + country index) and `/briefings` (daily + weekly). Retire `/map`,
`/weekly/countries`, `/daily`, `/weekly-brief` as redirects.

### Stage 6 — conditional
Promote the map to the hero of `/` if and when the Q2 gate is met (this is S6 as originally written).
Add the Studio Country and Bilateral lenses as the country quality workstream (Phase 4) lands
(`COUNTRY_INTEL_VS_STUDIO` recommends B after C).

**Cheap-and-now vs structural.** Stage 0 and Stage 1 are cheap, reversible and decision-independent.
Stages 2–5 depend on the answers to Q1–Q4. Stage 3 is worth doing whatever the Q2 answer is.

---

## §7 Risks, and what I'm least sure about

1. **I am recommending against an approved decision (S6 map-as-home).** The evidence is today's
   thinness plus the plan's own §12 note. If the news layer lands soon and fills the map, the case
   for S6 strengthens quickly. That is why I propose a gate instead of a reversal. The operator's
   aesthetic and brand intent for a dark map front door is a legitimate reason I cannot weigh from
   reviews.
2. **URL migration breaks inbound links if the redirects are incomplete.** GitHub Pages cannot issue
   301s. It depends entirely on the Worker, which already intercepts routes and is live
   (`ARCHITECTURE.md` §Cloudflare Workers). LinkedIn posts and past emails deep-link
   `/weekly/thread/` and `/weekly/country/` (memory `reference_linkedin_token_refresh`). Treat the
   redirect map as permanent. Test it with `scripts/link-crawl.mjs` before and after.
3. **The analyst audience is asserted, not validated.** There is no design partner yet
   (`ANALYST_TOOL_DIRECTION.md` GTM), and GA4 isn't API-readable (`reference_observability_usage`).
   I don't know which page analysts actually enter on. If most arrive on Story/Country pages from
   search or LinkedIn, **the home page matters less than this doc's attention to it implies**, and
   Stage 3 should go first (which is how I sequenced it). This is my biggest uncertainty.
4. **The composed Today still depends on the topics pipeline.** During an LLM outage the story cards
   age. The deterministic lede and honest stamps mitigate it but do not solve it. I have not verified
   whether the "updated 11d ago" on Home is the topics feed or the summary cache. `/weekly` showed
   "updated 7h ago" in the same session, so the stamps disagree on what they measure. That needs a
   source check before the Stage 0 freshness fix is designed.
5. **Merging `/daily` and `/weekly-brief` may hide the Daily if its pipeline stays unreliable.** That
   could be the right outcome, but it should be a conscious "Daily is best-effort" position, not
   something that happens by accident.
6. **The World page's country-risk layer is a second encoding on one map** (hue = axis for situations,
   tier for countries). It needs a clear toggle, not overlay, or it recreates the old map's "30–40
   countries lit at once" problem (`MAP_HOME_SITUATION_PLAN.md` §1).
7. **The calibration footnote everywhere amplifies a thin record** (122 resolved; a backlog that doesn't
   converge per the ledger). If the numbers move badly, the footnote becomes a liability. The honest
   N must always show next to the score.
8. **Effort estimates are not given.** The reviews rate individual fixes (mostly S/M). Stage 3 and
   Stage 5 are multi-session builds, and I have not sized them.

---

## §8 Challenge + monitor adjudication (2026-09-24)

A Sonnet challenger argued the opposing case (full text: `PAGE_STRUCTURE_CHALLENGE_2026-09-24.md`). The monitor verified the load-bearing facts before ruling.

**Verified facts that change this proposal:**
1. **The premise for rejecting S6 is wrong.** The news layer shipped: `MAP_HOME_SITUATION_LEDGER.md:102` records news ingest ✅ LIVE hourly (295 articles → stories across 4 axes, 2026-09-10). Live today, `/data/world/latest.json` shows `sources.news` fresh (09:50Z) yet only 1 situation. News classification is failing on DeepSeek `402 Insufficient Balance` (CloudWatch). The map is thin because of a billing outage on shipped code, not a missing build stage.
2. **Two freshness bugs, not one.** Home's "updated 11d ago" is TRUE (`StatusStrip` fed the real `updatedAt`). `/weekly`'s "updated Nh ago" is FABRICATED: `features/threads/WeeklyPage.jsx` passes `updatedAt={`${latestDate}T12:00:00`}` (a hard-coded noon on the archive date), ignoring the real `updatedAt` the backend already returns. The fabricated one is a new P1 (a dishonest trust signal).

**Rulings:**
- **Front door (Q2):** challenger wins. Keep the approved **S6 map-as-home**. Do NOT build a new composed "Today" page (a large new build that competes for the same time). Gate S6 on content flowing: DeepSeek funded → the map repopulates → ship S6 after ~7 days at ≥5 open situations across ≥2 axes (the designer's gate, now cheap to meet). Keep the designer's valid requirements for the map home: frame the dark map as a panel within the light site, and carry the lede band, trust strip and subscribe card over.
- **Merges:** `/briefings` (daily + weekly-brief) AGREE. **`/world` (map + countries) REJECTED**: it risks undoing the map's legibility work, and the countries index is its own reader job. `/contact` → `/about` and `/disclosures` → `/methodology` AGREE (cheap).
- **Renames:** `/story/:id` AGREE (cheap: centralized in `threadPath()`). `/country/:name` DEFERRED (19 inline call sites + a hard-coded share URL in `CopyBriefing.jsx`). Do renames only bundled with the Stage-0 Worker change (the same Worker that must fix the SEO 404s, which also has bot-route matchers to rewrite, with redirects ordered before matching). Search traffic is near zero today, so URL churn is cheapest now.
- **Naming (Q4):** "story" as the public unit, AGREE. **Masthead name "Today" REJECTED** (conflicts with the analyst register and the brand's words-to-avoid); keep the current nav names until S6.
- **Audience (Q1):** both agree the analyst / thesis-producer is primary, with free reading as the funnel.
- **Sequencing:** **Stage 0 = funding DeepSeek (operator) + SEO-404 Worker fix + freshness honesty (both bugs + remove "LIVE / Updated hourly" / "today" copy when stale) + parked-credits copy + onboarding-tour mobile block + request de-dupe + route lazy-loading.** Then S6. Then fix story/country pages INCREMENTALLY via the review's P1s (mobile overflow, CLS, tokens, archived-story state) — not a big-bang rebuild.
