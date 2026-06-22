# PRODUCT_IMPROVEMENT_PLAN.md — UI · Philosophy · Linkage · Bloomberg differentiation

**Generated:** 2026-06-22, from a 13-agent multi-perspective debate (6 grounded readers over every page + backend + docs → 6 debate personas → 1 synthesizing architect). Reference competitor = **Bloomberg terminal**. All findings are grounded in real `file:line` evidence; where a claim was unverifiable the agents said so (see Risks).

**Decision (2026-06-22):** build **everything below (P0 → P2)** across focused worktree sessions, sequenced as written. This doc is the source of truth for that work; check items off as they ship.

---

## North star

> **Global Perspectives is the anti-Bloomberg:** a free, source-honest *"why-engine"* that connects every headline to its multi-day **narrative arc**, its **cited causal mechanism**, and its **public forecast track record**. The moat is already built in the backend (threading, decorrelated economic judge, calibration, causal graphs) — the work is to **surface and link it, never to fake terminal density.**

## How we differ from Bloomberg (deliberately)

1. **Leads with its doubt.** A source-robustness pill downgrades single-source "high significance" stories inline (`ANALYSIS_SOURCE_TRUTH_PLAN.md` L1) — the opposite of a terminal where every print reads equally authoritative. Raw data already computed at `Home.jsx:414-426` (`sourceCount`/`outletCount`/`countries`).
2. **Publishes its own calibration with an honest empty state** (`TrackRecordPage.jsx:142-159` "Scoring begins…") instead of fabricating a Brier number — a posture Bloomberg structurally cannot adopt.
3. **Refuses to fake the number.** Economic disruption is qualitative direction/magnitude against a closed instrument allowlist with real historical-analog moves, "severity is never a percentage" (`Disclosures.jsx:72-74`), and a cross-family LLM judge (Gemini judging DeepSeek).
4. **Narrative threading (`threadId`) gives the *arc*, not the tape** — `continues_topic` + Jaccard linkage is connective substrate Bloomberg has no concept of (`ARCHITECTURE.md` §narrative threading).
5. **Cited, lag-aware causal graphs** (`systems_analysis` `nodes[]`/`edges[]` with `mechanism`/`lagDays`/`confidence`, uncited edges dropped) explain *why* a region moves — a reasoning asset, not a data row.
6. **Fully free and public, no tier gating on content.** Membership (Polar) buys analysis *compute*, not access — directly contra Bloomberg's $25k paywall.

## Debate resolution (what won, what was vetoed)

Six positions clustered into two camps: **(A)** skeptic / linkage / philosophy — *"the moat is built but the front door leaks; fix coherence + linkage, don't ship new assets"*; **(B)** bloomberg / differentiation / UX — *"surface the stranded reasoning assets (systems graph, pairs) and unify the shell."*

The **philosophy guardian cast the binding vetoes**, which set priority:
- 🚫 **VETO** filling sparse pages with placeholder density — `/track-record`'s empty state and Home's `totalTopics===0` guard must stay **fail-empty**.
- 🚫 **VETO** dumbing-down dense pages — analyst-depth readers self-select.
- ✅ The money incoherence must be fixed **toward honesty** (content stays free; membership buys compute), **loudly**, across all four legal/marketing pages — not quietly.

With those honored, the **skeptic's sequencing wins P0**: highest-ROI, lowest-risk, philosophy-pure work is closing the **trust → content loop** (link the two dead-end accountability pages back into the `threadId` graph) and surfacing the already-computed source-robustness signal. The **flagship moat asks (systems graph as first-class, pair-intel revival) are demoted to P1/P2** — they're new UI + QA on assets nobody can currently reach because the funnel/linkage are broken first. The **three-shells refactor is correct but deferred (P2)** — large, regression-prone, moves no trust/conversion metric now. Dead ⌘K and dead `/weekly/pair` arcs: **neutralize now** (cheap, removes the "unfinished" signal), build the real versions later — do not let a broken affordance ship.

---

## Workstreams (priority-ordered)

### P0 · S — Wire the two accountability dead-ends back into the thread graph
- **Why:** `TrackRecordPage` and `WeeklyBriefPage` are the strongest "why trust us" pages and import **zero** router primitives (verified) — they strand the reader exactly when trust is being earned. The `threadId` join key already exists in the data; only the `<Link>` is missing.
- **Changes:** Add `Link`/`useNavigate` to both. WeeklyBrief: each `SignalCard` deep-links to `/weekly/thread/${signal.threadId}`, external outlet link demoted to secondary. TrackRecord: each scored prediction row links to its originating thread; honest empty state preserved.
- **Files:** `components/WeeklyBriefPage.jsx`, `components/TrackRecordPage.jsx`
- **Philosophy check:** Adds only real, `threadId`-keyed links over existing data; touches nothing in the fail-empty path. Makes honesty *verifiable* (claim → forecast → source).
- **WeeklyBrief — SHIPPED ✅ (2026-06-22):** lede + a "Full story arc →" link deep-link to `/weekly/thread/${s.threadId}` (conditional/fail-empty); outlets demoted to a secondary "Sources:" label. `threadId` verified present.
- **TrackRecord — ⚠️ BLOCKED on a backend capture change (verified):** `prediction_track_record` projects only `title, category, generatedAt, scenarios` and pushes `recent[]` with **no `topicId`/`threadId`** (`newsSensitiveData/src/index.js:548,586-596`); the snapshot stores `topicId` but not `threadId` (`NewsProjectInvokeAgentLambda:703-716`), and `threadId` is assigned (lines 110-124) **after** `logPredictionSnapshot` runs inside the generation loop. No `/weekly/topic/:id` route exists, so `topicId` alone can't link. Wiring needs: reorder the pipeline (or patch PRED# rows from `threadIdById`) → add `threadId` to the snapshot → project it in the proxy → conditional frontend `<Link>`. Deploy-only + future-records-only. **Deliberately deferred** — not reordering the core daily pipeline blind, not shipping a `/weekly/thread/undefined` dead link.
- [x] WeeklyBrief shipped · [ ] TrackRecord (backend follow-up)

### P0 · M — Ship the L1 source-robustness pill on Home topic cards + ThreadPage
- **Why:** The flagship principle ("faithfulness ≠ truth"; single-source stories must visibly downgrade confidence — `ANALYSIS_SOURCE_TRUTH_PLAN.md:161-164`) has **zero user-facing UI outside the BYOK Studio**. Cleanest anti-Bloomberg differentiator; data already computed.
- **Changes:** New `atoms/SourceRobustness.jsx` pill rendered from existing `sourceCount`/`outletCount`/`countries` (`Home.jsx:414-426`): "Single-source — confidence reduced" vs "Corroborated — N outlets, M regions". Render in the Home topic-card sources block and in ThreadPage's StatusStrip (`ThreadPage.jsx:410-419`). Optionally fold in the `newsSourceAudit` drift signal if present in the payload.
- **Files:** `components/Home.jsx`, `components/ThreadPage.jsx`, new `components/atoms/SourceRobustness.jsx`
- **Philosophy check:** Pure presentation over data already in the payload; downgrades confidence rather than inventing it. A thin, corroborated story shows fewer flags (the truthful signal) — no fabricated density. **Empty `sources[]` → render nothing**, never a default "corroborated" badge.
- **SHIPPED ✅ (2026-06-22):** `atoms/SourceRobustness.jsx` (returns null on no data; amber "⚠ Single-source" vs green "✓ Corroborated · N outlets · M regions"). Rendered in the Home topic-card meta block (reusing the existing `outletCount`/`sourceCount`/`countries`) and in the ThreadPage header kicker (from `thread.allSources.length` + `thread.regions`). Styles in `atoms.css`. Build + lint clean.
- [x] Done

### P1 · M — Make the money story coherent + unbreak the conversion funnel
- **Why:** Live `/membership` ($15/$150 Polar) directly contradicts `Disclosures.jsx:119`, `PrivacyTerms.jsx:14`, `SignIn.jsx:136`, `WhitepaperPage.jsx:282` which all still swear "no paid plans" (all verified) — a trust failure on a site whose whole ethos is honesty. And `SignIn`/`AuthCallback` hard-redirect to `/weekly`, dropping the buyer.
- **Changes:** Rewrite the four pages to one reconciled line: *"Content is free and public; membership buys analysis compute, not access."* Add `?returnTo=` handling to `SignIn` (lines 24, 43) and `AuthCallback` (line 17). Add `/membership` to footer; add a "support the accountability work" CTA to `/track-record` and `/economy`.
- **Files:** `components/Disclosures.jsx`, `components/PrivacyTerms.jsx`, `components/SignIn.jsx`, `components/WhitepaperPage.jsx`, `components/AuthCallback.jsx`, `components/Layout.jsx`, `components/EconomyPage.jsx`, `components/TrackRecordPage.jsx`
- **Philosophy check:** Resolves the incoherence **toward** the free-and-public promise; membership is framed as funding accountability work, never gating content.
- **⚠️ Load-bearing:** the reconciled copy must match what Polar **actually** bills — verify against `POLAR_BILLING_PLAN.md` / live Polar config before editing legal pages. Do not assert a billing model that isn't live.
- [ ] Done

### P1 · S — Neutralize the dead affordances (⌘K + map pair arcs)
- **Why:** A pro hits ⌘K reflexively and gets nothing (`Layout.jsx:28` only `preventDefault`s); every map connection-arc click lands on `NotFound` (`/weekly/pair` has no route — verified). Both scream "unfinished" to the exact audience the product wants.
- **Changes:** Either remove the `gp-search` button or make ⌘K open a minimal jump-to (country/thread) modal firing existing proxy actions. Repoint `WorldMapV2.jsx:650` and `:1206` arc navigation to `/weekly/country/:name` until a real PairPage ships.
- **Files:** `components/Layout.jsx`, `components/WorldMapV2.jsx`
- **Philosophy check:** Removes broken/misleading affordances (a control that lies about working). Repointing to a real route is additive and reversible; nothing is faked.
- [ ] Done

### P2 · L — Surface the systems causal graph as a first-class view
- **Why:** The single most conceptually differentiated asset (cited, lag-aware causal edges) renders as `edges.slice(0,4)` (`CountryPage.jsx:603` — verified) and is gated to `SYSTEMS_TEST_COUNTRIES=Argentina,Iran`. The why-engine, shown four list-items deep.
- **Changes:** Build a `SystemsGraph` component rendering full `{nodes, edges}` with `mechanism`/`lagDays`/`confidence` labels + citation links, mounted as a CountryPage tab or `/systems` route. Remove the slice. **Re-verify and widen** the `SYSTEMS_TEST_COUNTRIES` gate against live AWS before relying on coverage.
- **Files:** `components/CountryPage.jsx`, new `components/SystemsGraph.jsx`, `App.jsx`
- **Philosophy check:** Surfaces an existing cited, validation-gated asset (uncited edges already dropped backend-side); shows only real edges with confidence labels — no fabricated nodes.
- [ ] Done

### P2 · L — Promote EditorialShell to one shell with density variants + shared tokens
- **Why:** Three 3-col shells (`EditorialShell`, `ep-shell`, `mv2-body`) and four risk-color sources destroy the positional/color consistency that earns terminal-grade trust.
- **Changes:** Add `density='compact|comfortable'` to `EditorialShell`; fold `ep-shell` and `mv2-body` in as variants; migrate bespoke status bars to the `StatusStrip` atom; centralize risk/category color into one `tokens.js` and delete the `WeeklyPage`/`DailyPage` import / `WeeklyBrief` `RISK_COLOR` / map-hardcoded duplicates.
- **Files:** `components/EditorialShell.jsx`, `components/EconomyPage.jsx`, `components/WorldMapV2.jsx`, `components/WeeklyPage.jsx`, `components/DailyPage.jsx`, `components/WeeklyBriefPage.jsx`, new `src/tokens.js`
- **Philosophy check:** Pure presentation refactor; preserves analyst-grade density (hierarchy, not subtraction) so `crossThreadInsight`/`rootCauseChain` are never stripped.
- [ ] Done

---

## Linkage fixes ("is everything linked?")

1. **WeeklyBrief signals → threads:** add `<Link to={\`/weekly/thread/${signal.threadId}\`}>` to every `SignalCard`; demote the external outlet `<a>` to a secondary "source" link. (`WeeklyBriefPage.jsx`)
2. **TrackRecord forecasts → threads:** wrap each scored prediction row / citation in a `<Link>` to its originating `/weekly/thread/:id`; keep the empty state untouched. (`TrackRecordPage.jsx`)
3. **Dead map arcs:** repoint `navigate('/weekly/pair/${fl.slug}')` at `WorldMapV2.jsx:650` and `:1206` to `/weekly/country/:name`; TODO real PairPage later. (`WorldMapV2.jsx`)
4. **Membership discoverability:** add `/membership` to the footer (it's in neither nav nor footer); add a contextual "support the accountability work" CTA to `/track-record` and `/economy`, framed as funding the work, not gating content. (`Layout.jsx`, `TrackRecordPage.jsx`, `EconomyPage.jsx`)
5. **Auth funnel:** honor a `?returnTo=` param so post-auth lands back at checkout instead of hard-coding `/weekly`. (`SignIn.jsx:24,43`, `AuthCallback.jsx:17`)
6. **Dead ⌘K:** remove the `gp-search` button (`Layout.jsx:105`) or make the `metaKey+k` handler (`Layout.jsx:28`) actually open something — do not ship a button that only `preventDefault`s.

---

## Risks / guards (carry into every session)

- **`threadId` presence:** links on TrackRecord/WeeklyBrief assume `threadId` is reliably on each record — if some lack it, **conditionally render** the link (fail-empty) rather than producing `/weekly/thread/undefined`. Verify payload shape first.
- **Pill must not become fake density:** a corroborated 6-outlet story and a single-source story must look *visibly different*; a missing/empty `sources[]` renders **nothing**, not a default "corroborated" badge.
- **Repointed map arcs** silently change a user-facing interaction — ensure the target country has intelligence or the click lands on CountryListPage's honest "not enough coverage" bucket, not a blank page.
- **Money-coherence copy is legally load-bearing** — must match what Polar actually bills; confirm against `POLAR_BILLING_PLAN.md` / live Polar before editing legal pages.
- **Systems graph (P2)** depends on widening `SYSTEMS_TEST_COUNTRIES`; memory flags ARCHITECTURE provider/scope as possibly stale — **re-verify against live AWS** before promising coverage, or the new view 404s for most countries.
- **Deploy ritual** (frontend changes): `npm run build` → copy `dist/` → `docs/` → `rm docs/assets/*.map` → `cp docs/index.html docs/404.html` (skipping the 404 resync has bitten twice → blank deep-link refreshes) → **never touch `docs/config.js`**. Canonical script: `./deploy.sh`.

---

## Execution order

1. **Worktree session 1 — "close the trust loop" (P0 + dead-arc neutralization):** linkage fixes 1–3 + the source-robustness pill. Additive, reversible, no legal/billing copy. *(Highest leverage; start here.)*
2. **Session 2 — money coherence + funnel (P1):** the four-page copy reconciliation + `?returnTo=` + footer/CTA (linkage fixes 4–5). Verify billing copy first.
3. **Session 3 — dead ⌘K + remaining affordances (P1):** linkage fix 6.
4. **Session 4 — systems causal graph (P2):** re-verify AWS gate first.
5. **Session 5 — shell unification + tokens (P2):** largest, last.
