# Redesign master plan: everything decided, and how we build it (2026-09-26)

**Status: DRAFT for operator review.** Nothing here is built. After the operator reviews it, each stage below gets a task file and is handed to agents.

This file **summarises** decisions; the linked docs hold the detail and win on detail. Where this file and an older doc disagree, the newer decision (dated here) wins; see §5.

Design canvas (all boards): https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW. Sources are in `redesign-ux/_reference/wireframe-2026-09-24/`.

---

## 1. Why (the philosophy)
- **What the product is:** an analyst's intelligence tool for people who form theses from world news. It is not a news feed. The value is *seeing where things are, how they connect, and how sure anyone can be*.
- **Every screen answers four questions the same way:**
  - **where** (map, places);
  - **how sure** (solid = reported, dashed = judged link, words for confidence);
  - **how fresh** (brightness + a date on every section);
  - **whose claim** (our stored data vs a reader's AI run).
  - The design system (DS1) gives each question one look, so readers learn it once and an honesty fix applies everywhere.
- **Honesty rules** (from memory + CLAUDE.md, binding on every stage):
  - never invent facts, dates or prices;
  - model output is labelled "model judgment";
  - "judged to feed into", never "caused";
  - no placeholder or "something went wrong" UI: fail empty and report to the error sink;
  - stale content looks stale;
  - public data hooks never gate on sign-in.
- **Game-like, not gamified:** borrow game UIs for *readability*: XCOM's map-as-home, Knight Lab slides, Obra Dinn's board of cases, chess.com's review, GitHub's contribution graph. No points or badges.
- **One pattern everywhere:** map + slide card + time bar on desktop; READ / MAP / TIMELINE tabs on phone. A reader who learns story mode already knows briefings, the country card, the track record and the Studio.
- **Design is not build:** decisions are recorded first. Code starts only on the operator's explicit "build".

## 2. Constraints today (verified 2026-09-25/26)
- **AI pipeline paused since 12 Sep.** DeepSeek returns 402 "Insufficient Balance". The last daily brief was 2026-09-12T14:01Z. No new stories since 13 Sep. `newsCountryIntelligence` still fires daily and fails 20/20. **GDACS alerts are still live.**
- **Per-story AI text exists for only the 17 current stories** (`SUMMARY` / `PREDICTION` / `TRACE_CAUSE`, 13 Sep). Older stories keep headline + regions + snippets. **210 `THREAD_ANALYSIS`**, **96 `THREAD_HISTORY`**, **227 `DRIFT` / 201 `DRIFTLOG`** and the forecast log persist.
- **Hosting:** GitHub Pages SPA + a Cloudflare Worker. No real HTTP 301s today. The Worker's SPA fallback and sitemap are prepared but **not deployed** (Y4).
- **Deploy queue:** 3 finished frontend changes are waiting for `./deploy.sh` (Y3): the root-cause fix, the Causal Web tab removal, the economy soft-hide.
- **Traffic is low** (~30-day server requests: home ~428, story ~354, daily ~328, country ~90, track record ~54).
- **Frontend:** feature folders (`src/app`, `src/shared`, `src/features/<name>`); the map is deck.gl, already lazy-loaded per route; `tokens.css` holds only the light palette.

## 3. Frontend design: what was decided, page by page

### 3.1 Site shell: APPROVED
- **Navigation (N1):**
  - Menu: **Map · Stories · Briefings · Studio · Track record** (plain words, flat); account at right; the credits badge stays hidden (billing parked).
  - **Same URLs** (story links are built in 8 places outside the frontend). The only new route is `/briefings`.
  - Retired routes:
    - `/breaking(/:id)` → the story if the id resolves, else `/`;
    - `/weekly-markets` → `/briefings` with a paused note;
    - `/spider-demo` stays unlisted until the story WEB view exists;
    - `/economy` is direct URL only.
- **Status line:** "New stories and analysis paused since 12 Sep". It is **computed from the newest `generatedAt`**, never typed, and says GDACS is still live.
- **Phone (P1):** 5-item bottom tab bar. On each page, **one** tab switch:
  - READ is the default, except the Map page, which opens on the radar;
  - a MAP tab (the WebGL map loads only then; the slide card becomes a bottom sheet: peek / half / full);
  - a third tab: TIMELINE / EDITIONS / LOG.
  - No popovers, no static map thumbnails, 44px tap targets, reduced motion = instant cuts.
- **Design system (DS1):** 13 token families (colours, crisis hues, map symbols, line styles, freshness, ours-vs-run, motion budget, type, fixed words, states, shared parts, space, page defaults).
  - Where old and new designs conflict, **the new design wins**:
    - risk shown as number + tier word + ring weight, not traffic-light colours;
    - 44px targets;
    - the reader's run gets its own sand hatching; amber = warnings only.
  - **No light Reading mode** for now; long story pages keep the console style.
- **Footer:** About, Membership, Privacy, Disclosures, Contact. The **white paper is hidden for now** (soft hide: links removed, URL kept). The code change awaits a go.

### 3.2 Map home (console): APPROVED (A1–A5)
Docs: `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md` rounds 2–3, `CONSOLE_WIREFRAME_TECHNIQUE.md`, `STORY_DOSSIER_BOARD_DESIGN_BRIEF.md` (card + StoryPeek).
- **Map:** GLOBE on desktop (spins; stops and turns on touch/select), RADAR on phone (sweep lights what it crosses, with no focus theft). A stop control; reduced motion = still.
- **HUD:** situation brief, threat board, **sensor status** (freshness per source), intel feed (the story list, the map's accessible twin), alert stack (replaces `/breaking`), layer switches.
- **Click an event → the story card:**
  - WHAT IS HAPPENING → WHAT IT MEANS → WHY (2–3 cause steps, fact / inference);
  - in-text links to events and other stories;
  - "Open full story".
- **StoryPeek:** one hover/focus preview wherever a story is named. Built once.
- **Legend = the default map tokens** (L1–L4 approved):
  - shape = kind; hue = crisis type; size + double ring = HIGH; brightness = freshness;
  - dashed = judged link, grey dots = shared actors;
  - motion budget = 3 movers, max 8 pulses;
  - GDACS level shown as a text badge.
- **H1 APPROVED:** a one-line orientation banner replaces the guided tour + hero callout.
- **H2 APPROVED:** a story with no exact place **shades its country** (crisis hue, count, StoryPeek on hover) instead of a made-up pin. Exact situations keep pins; broad regions ("Middle East") appear only in the list.

### 3.3 Story page: APPROVED (B1–B3)
Docs: `STORY_WEB_RETHINK_PLAN.md` §5, §7.
- **Story mode is the default:**
  - map + **horizontal slides** (BRIEF → CH1–CH4 → FED INTO → WATCH) + a bottom time scrubber (news per day, chapters, ⚑ turning point, TODAY, ◆ deadlines);
  - drawers WHY / WHO / VIEW FROM / SOURCES.
- **"Read in full"** is the long, printable, accessible page with the **news-based web**:
  - Timeline chapters + "Show linked news";
  - Why = cause chain + the news it's judged to feed into (cited dated headlines, per-analysis confidence, verbatim mechanisms) + shared actors.
- **Register S1–S11:** S1 default = story mode; S5 amber after 7 days / hide after 30; S6 skip FED INTO when there are no links; S7 approx. places; S8 home dashed lines to linked stories; S9 board keeps MAP + WEB; S11 Studio country lens picks a country directly.
  - S2 (phone) is superseded by P1.
  - S10 (light mode) is superseded by "no Reading mode for now".
- **Country page has no web** (removed 25 Sep); country web = a Studio lens.

### 3.4 Threads board: APPROVED (B4)
- BOARD / TABLE / MAP / WEB views.
- WEB = **story graph**: the union of all webs, stories as nodes, dashed confidence links, with a list twin.
- `/spider-demo` retires into it.

### 3.5 Country: APPROVED (C1)
Doc: `COUNTRY_VIEW_DISCUSSION.md`.
- **Country card on the map:**
  - one screen: state line → verified facts → one-sentence summary → RISK + DIRECTION → 4 risk bars (WHY on click) → latest change (only with a cited event) → ≤3 stories → ≤2 future dated triggers → FX + Studio button.
- **Direction rule:** medians of 3 readings, |Δ| ≥ 10, "at top of scale", "not enough readings".
- **Watch flag:** GDACS / origin situations.
- **Facts only if verified** (Wikidata leaders with a date; macro ≥ current year − 3; no FX row if the currency isn't in the ECB feed).
- **States:** briefed (≤7d / 7–30d amber), too old (>30d: scores hidden), never briefed (stories + "Generate in Studio"), quiet (inline).
- **Countries list** = a map layer + a tab in Stories. `/weekly/country/:name` stays a public page with the card content.

### 3.6 Briefings: APPROVED (D1)
- **BRIEFING MODE**, the same pattern as story mode, at the new `/briefings`.
- DAILY opens on "The day" → 8 top stories → country to watch. WEEKLY: the week → 6 signals (fact, then "so what") → next week.
- Editions strip: solid = published, dashed = no edition (AI paused), never a dead end. READ AS TEXT for email / print / search.
- No markets line while economy is parked.

### 3.7 Track record: APPROVED (E2; E1 = text version)
Doc: `TRACK_RECORD_AND_STUDIO_RULING.md` ("What we score", "Track record page design").
- **Service record on one screen:**
  - status line by stage;
  - accuracy locked until 150 resolved, always beside a base-rate guess;
  - the weekly seed hash;
  - forecast board: **MAP (default, counts per place, never per-country accuracy) | BOARD**;
  - settling log (missed weeks in red);
  - ledger of changed reads.
- **Scoring method:**
  - standalone binary questions with their **own p** and a named source, frozen at issue;
  - a pre-registered hashed weekly sample of ~20–25, max 1 per story cluster;
  - human-confirmed, cited resolution blind to p; VOIDs published;
  - Brier skill vs base rate with a cluster bootstrap; stage wording 0–3.
  - The 122 July items are archived as a flawed pilot. Market-call scoring is parked with economy.
- **Weekly settling:** an agent drafts, the operator confirms (~1 h/week).

### 3.8 Analysis Studio: APPROVED (F1 base + F2 stacking + F3 board toggle)
Doc: `TRACK_RECORD_AND_STUDIO_RULING.md` (Studio sections).
- **Layout:** deck (map + slide card + time bar), one picture per lens; **"+ Add analysis"** runs another lens on the same frozen sources; **DECK | BOARD** toggle (case board of one run; off on phones).
- **Lenses at launch:**
  - Scenario (forward: bands from today to dated triggers);
  - Compare (sideways: lanes, shared places, judged link, cited grid);
  - **What changed** (back: risk chart with gaps + change log; flags explanations that fail the direction check);
  - Free-form (evidence: a sentence lights its sources).
  - **Economic ripple is parked.**
  - Later, freshness-gated: country deep-dive, explain-web, bilateral, generate-briefing (labelled reader-generated).
- **Our data vs this run:** legend tokens vs sand hatching. A place is drawn only if the run names it **and** a source lists it.
- **Reader pays** (their own key):
  - **quote before** the run: what's sent, the model, the output cap, per-story RICH / THIN;
  - **receipt after** the run: provider usage, checks; failed checks → "your provider still charged";
  - money only from a verified, dated price table.
- **Signed out:** the same screen with one real shared example.
- **Share:** a frozen read-only link (`/analyze/s/:id`), noindex, owner delete.
- **Parked:** member path / credits, saved-case library, doc upload, PDF.

### 3.9 Parked / retired
- **Economy parked:** soft-hidden (code done, undeployed); `TriggerWeeklyMarkets` disabled; E1–E8 wait for its return.
- **Retire:** `/breaking` (alert stack), `/spider-demo` (board WEB + Studio), `/weekly-markets`.
- **Hide:** white paper.

## 4. Backend / data work the designs need
| # | Work | For | Needs |
|---|---|---|---|
| D1 | **Freshness read:** newest `generatedAt` across daily brief / topics / country intel, cached at the edge | Status line, sensor status | small proxy action or Worker read |
| D2 | **Studio feed:** add archive snippets, `thread_analysis`, `THREAD_HISTORY` / `DRIFTLOG`, `prediction_snapshot` to `buildAnalysisContext`; typed sources `[n]` with `generatedAt` | Studio (every story analysable, not only the 17) | frontend + existing public actions |
| D3 | **Studio fixes:** Perplexity `[n]` collision → web sources `[W#]`; failed checks = hidden + not shareable; remove the live credits copy (`AnalysisStudio.jsx:185, 202`); read provider `usage` for the receipt | Studio | frontend (`llm.js`, validator) |
| D4 | **gp-struct schema add:** scenarios get `places[]` + a `by` date, checked against prose + source regions | Studio pictures | frontend prompt + `analysisStruct.js` |
| D5 | **`newsSharedAnalysis` Lambda:** JWT, server re-fetches + freezes sources, re-runs checks, http(s)-only, 32 KB cap, 20/user/day, `SHARE#` DynamoDB row, public GET + owner delete, CORS in code | Share links + signed-out example | **new Lambda + IAM: operator yes** |
| D6 | **Scoring pipeline M2–M4:** P1 one-pass schema (`p` + `resolution_source` on triggers in `NewsProjectInvokeAgentLambda`), gates, weekly seed + sampling + deterministic resolvers + VOIDs script, retire the legacy resolver, dead-man's alarm | Track record | M2 needs DeepSeek (Y1) |
| D7 | **Country data:** `country_facts`, `country_rank` (+ `COUNTRY_RANK#<date>`), slim `country_history`; widen the Wikidata job (+ capital / population / currency); fix the World Bank `mrv=5` fetch; C9 event-driven picks | Country card | C9 after Y1 |
| D8 | **Story web stage 2:** `web_index` action; the systems prompt spreads ~10 dated entries; per-story `THREAD#id / WEB` record; measure coverage | Story mode FED INTO, board WEB | Y1 |
| D9 | **Drift-note direction check:** 6 of 14 Iran explanations explain a lower risk with something worse. Add a check/prompt fix in the drift writer | What changed lens, country "latest change", ledger | Y1 |
| D10 | **Worker:** deploy SPA fallback + sitemap (Y4); add `/briefings` to pre-render; skip pre-render for `/analyze/s/*`; optional real 301s later | SEO, briefings, shares | Worker deploy yes |
| D11 | **Home swap gate (S6):** needs news situations again (classification fails on 402), then ~7 days at ≥5 open situations across ≥2 types | Map becomes `/` | Y1 |

## 5. Older decisions this plan supersedes
- **C6 "`/story/:id` rename with 301s"** (ACTION_CHECKLIST) is superseded by N1: same URLs.
- **S2 phone story mode** (map 40% + sheet) is superseded by P1 (READ first + MAP tab sheet).
- **S10 / theme-scope "light Reading mode for long reads"** is superseded: no Reading mode for now.
- **"Light editorial is the site's visual system"** (home brief, round 1) is superseded by the console design system.
- **Studio "JSON on S3" for shares** is superseded by a DynamoDB `SHARE#` row via a new Lambda (DATA_STRATEGY sorting test).
- **Home "trust strip (forecast score + corrections)"** must use the track-record stage wording. There is no score to show yet.

## 6. Still open (operator)
| # | Question | Recommendation |
|---|---|---|
| H3 | ✅ **DECIDED 26 Sep:** build the map console at `/map` first, **locally for review, no deploy** (operator: "first build it in local and let me see") | — |
| H4 | ✅ **DECIDED 26 Sep:** the main globe uses **B, NASA night lights (Black Marble)** (operator: "B is better"; options page https://claude.ai/artifact/QpC85emw93DTtzoPxGabGp). **Radar mode stays** (phone default + desktop mode switch). Corner globe on the radar (option E): not chosen yet | — |
| PH | ✅ **DECIDED 26 Sep: horizontal slides on phone**, like desktop (READ shows one slide at a time; swipe or ◀ ▶) | — |
| S5–S10 | Studio: failed runs hidden + not shareable; shares per reader in DynamoDB; share Lambda (IAM); signed-out example; parked list | Yes to all |
| WP | Go-ahead to soft-hide the white paper in code now | Your call |
| Y1 | DeepSeek top-up (country briefings all pass 30 days around **11–12 Oct**) | Blocks D6, D7-C9, D8, D9, D11 |
| Y2 | Gemini paid tier (thread analysis exceeds the free 20/day) | Decision |
| Y3 / Y4 | `./deploy.sh` for the 3 waiting changes; the Worker deploy | Yes when ready |

## 7. Implementation plan by stage
**How agents work** (per stage):
- A task file from `playbooks/TASK_TEMPLATE.md` with a live tracker; one phase per commit.
- A Sonnet agent executes. The monitor (Opus) re-verifies: `npm run verify`, tests, bundle size, **browser click-through of every touched control**, and a data-honesty check. Then it pushes.
- **No deploys** without the operator's "yes".
- **Lambda rules:**
  - diff the deployed zip before editing;
  - `newsAnalyze` is a patched zip: never deploy the repo file over it;
  - follow the CORS rule;
  - a new Lambda or IAM change needs a yes.

Sizes are shown only where an earlier estimate exists; the rest are sized in each stage's task file.

| Stage | Goal | Work (FE = frontend, BE = backend) | Depends on | Operator gates | Size (known) |
|---|---|---|---|---|---|
| **0 · Ship what's built** | Get the finished work live | deploy the 3 waiting changes; Worker fallback + sitemap; white-paper soft hide (+ its test/guard) | — | Y3, Y4, WP | — |
| **1 · Foundations** | One look + one shell before any page | FE: DS1 tokens → `tokens.css` (console section, crisis hues, freshness, motion, 44px); app shell N1 (menu, footer, phone tab bar, tour targets → `data-tour`); status line + **D1**; shared parts (StoryPeek + `usePeek` + `peekData`, status vocabulary ▲●◆▼, slide card / bottom sheet, time bar, states, "model judgment" label); one map component (real Earth per H4) | — | H4 for the globe texture | — |
| **2 · Story mode** (C11 stage 1) | The default story page | FE: story mode (slides, scrubber, drawers), "Read in full" with the news-based web (`useStoryLinks`), board WEB story graph, phone per P1 / PH | Stage 1 | PH | ~600–800 lines (C11 estimate) |
| **3 · Briefings** | `/briefings` in briefing mode | FE: daily / weekly slides, editions strip, READ AS TEXT; old URLs kept; `/weekly-markets` → `/briefings`; BE: **D10** pre-render `/briefings` | Stage 2 parts | Worker deploy | — |
| **4 · Country card** | Map card + countries layer | BE: **D7** (facts / rank / slim history, Wikidata widen, World Bank fix); FE: card v2 with 5 states, direction rule, watch flag, countries layer + Stories tab | Stage 1 | — | — |
| **5 · Studio** | The approved Studio | Five steps:<br>5a (~1 d): **D3** fixes.<br>5b: **D2** stored-data feed + the quote / receipt.<br>5c: deck layout + 4 lenses + "+ Add analysis" + board toggle + **D4**.<br>5d (~3–4 d): **D5** share Lambda + share page + signed-out example.<br>5e: later lenses, freshness-gated. | Stages 1–2 | S5–S10; D5 IAM yes | 5a ~1 d; 5d ~3–4 d |
| **6 · Track record** | Service record + honest scoring | FE: E2 page (stage-0 wording now; map / board / log / ledger), E1 text version; BE: **D6** M3 script + alarm + legacy resolver retired now; M2 (p per question) when DeepSeek is back; M4 UI (own % on WATCH / card / briefings) | Stage 1 | Y1 for M2 | active path ~3.5 d (M2–M4 + alarm) |
| **7 · Home console swap** | Map becomes `/` | FE: console (globe / radar, HUD, card, alert stack, orientation banner, country shading, legend) behind `/map` first; then the S6 swap | Stages 1–2, **D11** | H3; Y1 + S6 gate | — |
| **8 · After the AI returns** | Refill and deepen | BE: **D8** story web stage 2, **D9** drift direction check, C7 severity fix (Phase 4), C9 event-driven country picks; Studio later lenses; economy E1–E8 revisit | — | Y1 (+ Y2) | — |
| **9 · Clean-up** | Retire and harden | retire `/breaking`, `/spider-demo`, `/weekly-markets`; C9 accessibility pass; smoke-test re-baseline; docs / INDEX / ARCHITECTURE | Stages 2–7 | — | — |

**Can run in parallel:**
- Stage 1's token + shell work alongside stage 4's backend D7.
- Stage 5a (Studio fixes) at any time after stage 0.
- Stage 6's M3 script + alarm at any time.

**Critical path:** 1 → 2 → (3, 5c) → 7.

## 8. Review checklist for the operator
1. Is §3 right? Anything missing or misremembered?
2. Answer §6 (H3, H4, PH, S5–S10, WP).
3. Approve the stage order in §7 (or reorder it).
4. Then say "build stage N". Each stage starts with its task file for you to see.
