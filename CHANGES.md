# Global Perspectives — Change Log

## 2026-06-26 (feat: dedicated breaking-alert web surface — fixes the bell → thread mismatch)

The notification bell linked breaking alerts to `/weekly/thread/:id`, but a breaking story is a point-in-time snapshot, not a narrative thread — and the linked id was often a *topic* id (the `t.threadId || t.topicId || t.id` fallback in `newsBreakingAlert/index.js`) or a brand-new single-entry thread with no `THREAD_ANALYSIS`. Result: the rich content lived only in the email, while the bell sent readers to a thin "1 event / 1 source" page or a "Story arc not found" shell. Built breaking alerts their own home.

- **New surface (Feed + detail):** `/breaking` (`BreakingFeedPage`) lists confirmed alerts grouped by Today/Yesterday/date with category·regions, market pill, source-robustness, and an honest empty state; `/breaking/:id` (`BreakingDetailPage`) is a native on-brand page — *What happened · How we got here · Our read · Market impact · Sources*, region chips → country/map, and the story-arc link **only when a real multi-entry thread exists** (`hasArc`).
- **`BreakingStrip` atom** atop Home + Map — pulsing slim entry point, shown only when a confirmed alert is **<24h old** (renders nothing otherwise — honest, no stale banner).
- **Bell rewired** to `/breaking/:id` + a "See all breaking alerts →" footer.
- **Backend:** `newsRecommend` — enriched `list_alerts` (id/category/regions/economic/source counts + `/breaking/` urls) + new public `get_alert` action (returns the structured story; **falls back to the saved email text for legacy records**, so existing alerts render with no detector rerun). `newsBreakingAlert` — `writeProposal` now persists the structured story + `hasArc`/real `threadId`/`leadTopicId`; the arc link is gated on a real thread arc (root-cause fix).
- **Deployed:** `newsRecommend` Lambda live (ap-northeast-1) — `list_alerts`/`get_alert` smoke-tested against the Function URL (existing EU/Ukraine alert returns the email-text fallback, `hasArc:false`). `npm run verify` green (0 ESLint errors, 178 tests); frontend built + shipped via `./deploy.sh`. `newsBreakingAlert` redeploy NOT required for the fix (legacy records use the fallback); deploying it later upgrades future alerts to the richer native layout.

Files: `…/src/components/{BreakingFeedPage,BreakingDetailPage,NotificationBell}.jsx`, `…/src/components/BreakingPage.css`, `…/src/components/atoms/{BreakingStrip.jsx,BreakingStrip.css}`, `…/src/hooks/useBreakingAlert.js`, `…/src/services/restProxy.js`, `…/src/App.jsx`, `…/src/components/{Home,WorldMapV2}.jsx`, `…/src/components/NotificationBell.css`, `amplify/backend/function/{newsRecommend,newsBreakingAlert}/src/index.js`, `docs/assets`, `docs/index.html`, `docs/404.html`.

## 2026-06-24 (deploy: ship P2a color-tokens + threadPath centralization to production)

Rebuilt `docs/` to push the accumulated `main` work live: the **P2a `src/tokens.js`** single-color-source consolidation (see entry below) and the completed **`threadPath` centralization**. Verify gate green on the merged tree (0 ESLint errors, 178 tests). Deployed via `./deploy.sh`; production bundle confirmed updated.

Files: `docs/assets`, `docs/index.html`, `docs/404.html` (build output only — source already on `main`).

## 2026-06-24 (refactor: finish the threadPath centralization across the app)

Completes the `threadPath` migration. Every remaining hand-built `/weekly/thread/:id` link across the frontend now routes through `utils/threadPath.js`, so the URL convention + `encodeURIComponent` + query-param assembly live in exactly one place.

- **13 files migrated:** `ThreadPage`, `CountryPage`, `WeeklyPage`, `DailyPage`, `WeeklyBriefPage`, `Home`, `NotificationBell`, `SystemsGraph`, `EconomyPage`, `Account`, `ShareButtons`, `CopyBriefing`, and `atoms/LedeBand`. The `?tab=economy`, `?from=country&country=…` query shapes and the `/^thread-/` guard (DailyPage) are all preserved.
- **Removed `LedeBand`'s dead `threadHrefBase` prop** — no caller ever passed it; it only duplicated the convention. Now uses `threadPath(lede.threadId)`.
- **Equivalence confirmed:** real threadIds (`thread-{slug}-{hash}`) contain no special chars, so the now-uniform `encodeURIComponent` is a no-op on live data; `country=` spaces serialize as `+` (URLSearchParams) vs the old `%20` but both decode identically via `useSearchParams`. Independently reviewed by an Explore agent (completeness / equivalence / imports — all clean). `npm run verify` green (0 ESLint errors, 178 tests).

Files: `…/src/components/{ThreadPage,CountryPage,WeeklyPage,DailyPage,WeeklyBriefPage,Home,NotificationBell,SystemsGraph,EconomyPage,Account,ShareButtons,CopyBriefing}.jsx`, `…/src/components/atoms/LedeBand.jsx`. (Source only — not yet built into `docs/`; deploy is gated.)

## 2026-06-24 (P2a color tokens shipped to main; P2 shell-merge skipped by design)

Continuation of the anti-Bloomberg `PRODUCT_IMPROVEMENT_PLAN.md` work. After confirming P0/P1 + the P2 systems-graph were live (see the 2026-06-23 deploy entry below), tackled the remaining P2 "shared tokens + one shell" workstream — landing the safe half and consciously dropping the risky half.

- **P2a — `src/tokens.js`, the single source for risk + category colors (commit `e1b0337`, on `main`/`origin`).** Consolidated four divergent risk representations (pastel `{bg,color}` badge, solid editorial hex, canvas RGB arrays, `riskScore`→CSS-var) and three category maps that were copy-pasted across the app, repointing 11 components: `WeeklyPage`, `CountryPage`, `CountryListPage`, `DailyPage`, `ThreadPage`, `StoryEntryCard`, `WeeklyMap`, `BriefingCard`, `WeeklyBriefPage`, `MapSidePanel`, `WorldMap`. Hex values unchanged (visuals identical); the one intentional improvement is `MapSidePanel` now drawing real climate/science/business/society/energy dot colors instead of falling back to grey. Net −59 lines.
- **P2b — shell unification SKIPPED by design.** Investigation found the three 3-col shells are **behaviorally distinct, not density variants**: `ep-shell` (Economy) has drag-resizable rails + full-bleed masthead + mobile bottom-sheet; `mv2-body` (Map) has three collapsible-rail grid states for the layer controls; `EditorialShell` is static 3-col. A `density` prop can't express resize/collapse/full-bleed, so a merge would either regress those behaviors or pollute a shared shell with page-specific logic — low value (the visible inconsistency was color, fixed by P2a) for real regression risk. Documented in `PRODUCT_IMPROVEMENT_PLAN.md`.
- **Verified:** `npm run verify` green (0 ESLint errors, 178 vitest tests) on the merged `main`; browser click-through of 9 pages (Home/Weekly/Thread/Country/WeeklyBrief/Map/Economy/Daily/chrome) — every button exercised, **0 console errors**, colors + source-robustness pills render correctly.
- **Housekeeping:** updated `PRODUCT_IMPROVEMENT_PLAN.md` (P2a shipped, P2b skipped, top status banner); removed the spent `finish-product-plan` worktree + branch.

Files: `global-perspectives-starter/frontend/src/tokens.js` (new) + the 11 components above; `PRODUCT_IMPROVEMENT_PLAN.md`. (Source only — `tokens.js` is on `main`/`origin` but **not yet built into `docs/`**; deploy is gated.)

## 2026-06-23 (refactor: extract topicMatch + threadPath utils, kill duplicated map logic)

Follow-up to the leaderboard fix below. The "find the topic for a country" predicate was pasted verbatim at three sites inside `WorldMapV2.jsx`, and thread-link URLs were hand-built across the app with inconsistent encoding (the map encoded its economic-disruption row but not its editorial/leaderboard nav).

- **New `utils/topicMatch.js`** — `countryNameEq(a,b)` (case-insensitive country-name compare) + `findTopicForCountry(topics, name)`. Replaces the three inline predicates in `WorldMapV2.jsx` (editorial picks, leaderboard, detail-panel coverage filter).
- **New `utils/threadPath.js`** — `threadPath(threadId, {tab, from, country})`, the single owner of the `/weekly/thread/:id` convention + `encodeURIComponent` + query-param assembly. Migrated all 6 WorldMapV2 thread links and the shared `atoms/DisruptionRow.jsx` (the economy-tab link used by `/economy`, `/daily`, country pages) onto it.
- **Reviewed by a 3-agent adversarial pass** (completeness / encoding-regression / behavior-parity). Confirmed: refactors are semantically identical to the originals; `ThreadPage` reads `threadId` via `useParams` (auto-decoded) so the centralized `encodeURIComponent` round-trips correctly; real threadIds (`thread-{slug}-{hash}`) contain no special chars, so encoding is a no-op on live data (zero behavioral change). No regression — the ~15 other hand-built thread links across the app are unchanged and queued as a clean follow-up.

Files: `global-perspectives-starter/frontend/src/utils/{topicMatch,threadPath}.js` (new), `…/components/WorldMapV2.jsx`, `…/components/atoms/DisruptionRow.jsx`. (Source only — not yet built into `docs/`; deploy is gated.)

## 2026-06-23 (/map: right-panel leaderboard headlines now link to their story arc)

The right-panel "Top signal this week" leaderboard (`WorldMapV2.jsx`) computed the matching `topic` for each country and displayed its headline, but the row's only click target was `handleCountryClick(iso)` — it never used the `topic.threadId` it had in scope, so the headline was a dead end (no way to reach the corresponding thread). The left-rail Editorial list already did the right thing (`threadId ? navigate(thread) : selectCountry`); the leaderboard had simply drifted out of sync.

- **Fix:** the leaderboard headline is now a thread link when `topic.threadId` exists — `onClick` with `e.stopPropagation()` so the rest of the row still selects the country (dotted-underline affordance). Verified against live data: `archive_range`/`latest` carry `threadId` on every entry, so this was a pure wiring gap, not a data problem.

Files: `global-perspectives-starter/frontend/src/components/WorldMapV2.jsx`. (Source only — not yet built into `docs/`; deploy is gated.)

## 2026-06-23 (deploy: ship the product-improvements P0/P1/P2 work to production)

The anti-Bloomberg trust-loop work merged to `main` (`aca1812`) had never been built into `docs/` — production kept serving the pre-merge bundle (`index-xrY7_h4h.js`). Caught by comparing the live bundle hash against `docs/index.html`. Rebuilt `docs/` via `./deploy.sh` to make it live (now unblocked by the repo being public).

- **Shipped to production** (`docs/` rebuild, no source change): the P0 trust-loop (source-robustness pill on Home/ThreadPage, WeeklyBrief/TrackRecord → thread links, repointed dead map arcs), P1 money-coherence copy + `?returnTo=` funnel + `/membership` in footer + dead-⌘K removal, and the P2 systems causal-graph view (CountryPage tab).
- **Pre-deploy verification:** `npm run verify` green (0 ESLint errors, 178 vitest tests); browser-smoke of the build confirmed Home/Disclosures render with the new copy (the smoke script's "blank region" flags were false negatives from the onboarding modal overlay on a data-less preview).

Files: `docs/assets`, `docs/index.html`, `docs/404.html`.

## 2026-06-23 (repo made PUBLIC + downgraded GitHub Pro → Free)

Completed the public-repo prep from the 2026-06-22 entry below.

- **Repo `BenBen05059997/globalPerspective-v1` made PUBLIC** (`gh repo edit --visibility public`). Live site unaffected — home `200`, deep-links served via the `404.html` SPA fallback (bundle `index-xrY7_h4h.js`), relocated internal docs `404` as intended.
- **Downgraded GitHub Pro → Free.** Pages is free on public repos; verified **0 of the 10 other private repos use Pages** (the only paid-gated feature that would have taken a live site down). No GitHub Actions anywhere; Packages/Codespaces unused. Reversible — re-subscribe if a private-repo Pages site is ever needed.

## 2026-06-22 (build/deploy/security: unblock build, harden deploy.sh, restrict Maps key, declutter web root — public-repo prep)

A session focused on making the deploy reliable and the project safe to open-source.

- **Unblocked the frontend build.** `npm run build` was failing at the `prebuild` ESLint step for three compounding reasons, all fixed: (1) the `--rule 'react-hooks/rules-of-hooks: error'` CLI flag crashes on ESLint 9.37 — removed (the flat config already enforces that rule via `recommended-latest`); (2) `__APP_VERSION__`/`__BUILD_DATE__` (Vite `define` globals) flagged `no-undef` — declared as globals in `eslint.config.js`; (3) 22 lint warnings exceeded `--max-warnings 20` — cleared the 18 `no-unused-vars` (optional-catch-binding + dead-code removal, no behavior change), leaving 4 `exhaustive-deps`.
- **Hardened `deploy.sh` into the single source of truth.** Added: strip `docs/assets/*.map` (sourcemaps are `hidden`, must not be served), resync `docs/404.html` byte-identical to `index.html` with a `diff` guard, and an opt-in `--push` (requires `--commit`). Pointed `CLAUDE.md` + the `deploy-frontend` skill + `DEPLOYMENT_NOTES.md` at it.
- **Repo public-readiness secret scan.** No real secrets in tree or git history (no AWS keys, private keys, LLM keys, `.env`). Only client-side Google keys (already public on the live site by design).
- **Restricted the Google Maps key.** It was found **unrestricted** (proved via Geocoding + Static Maps referrer probes). Added HTTP-referrer restrictions (`globalperspective.net`, `www`, `benben05059997.github.io`, `localhost:5173`) via `gcloud` to the "Maps Platform API Key" in project `globalnews-473509`; enforcement confirmed live. Safe because backend geocoding uses Mapbox, so the key is browser-only.
- **Decluttered the public web root.** Moved internal docs out of `docs/` (served live + crawlable) to `internal-docs/`: `WEEKLY_KNOWN_ISSUES.md`, `LEGAL_NOTES.md`, `CLAUDE-MARKETING-PLAYBOOK.md`, `ENTERPRISE_WEEKLY_ANALYSIS.md`, `STALE_CACHE_PLAN.md`, `MAP_UPGRADE_FEATURES.md`, `marketing/*`. `WHITEPAPER.md` kept (real public content). Live-confirmed the moved URLs now 404. Removed stale `.gh-pages_backup/`.

Files: `global-perspectives-starter/frontend/{eslint.config.js,package.json,src/**,e2e/economic.spec.js}`, `deploy.sh`, `CLAUDE.md`, `.claude/skills/deploy-frontend/SKILL.md`, `DEPLOYMENT_NOTES.md`, `docs/* → internal-docs/*`, removed `.gh-pages_backup/`. (Maps key change applied directly in Google Cloud, no source change.)

## 2026-06-22 (fix: LinkedIn auto-posting restored — expired OAuth token refreshed)

LinkedIn auto-posting had been silently dead since **2026-06-11**: both `newsPostLinkedin` (every 3h) and `linkedInAutoPost` (07:30/19:30 UTC) failed every run with `401 EXPIRED_ACCESS_TOKEN` (serviceErrorCode 65602). The Lambdas ran fine on schedule and Bluesky kept posting in the same runs — the failure was purely the expired LinkedIn `LINKEDIN_ACCESS_TOKEN` (60-day expiry). Diagnosed via CloudWatch; no successful LinkedIn post in 60 days of logs.

- **Fix:** generated a fresh `w_member_social` access token via the LinkedIn token-generator UI (app **globalP** / Client ID `8644gn6c9ruje9`), merged it into both Lambdas' env vars (all other vars preserved), `LastUpdateStatus=Successful`. Next refresh due ~**2026-08-21**.
- **Dead end documented:** the manual auth-code → `oauth/v2/accessToken` curl flow no longer works — the old client secret `WPL_AP1...==` is stale (`invalid_client`); LinkedIn's `/tools/oauth/redirect` page consumes the code (`authorization code not found`). The token-generator UI (no secret) is the working path.
- **Auto-refresh:** investigated — only possible if the app issues 365-day refresh tokens (generator UI doesn't return one; needs auth-code flow + valid client secret), and still requires annual manual re-auth. Not built; chose manual refresh.
- **Docs:** added a full "LinkedIn token refresh runbook" to `BACKEND_GUIDE.md` (Lambda 6 section) and cleared the stale "⚠️ LinkedIn token expired" flag in its Lambda inventory.

Files: `BACKEND_GUIDE.md` (docs only; token change applied directly to AWS Lambda env, no source change).

## 2026-06-22 (chore: adopt agent-kit operating discipline + add verify gate + green the test suite)

Dropped in the portable **agent-kit** (solo-dev autonomy / verify / git / worktree / deploy discipline) and made the local gate actually green.

- **Added `agent-kit/`** — the project-agnostic bundle (`CLAUDE.template.md`, `MEMORY_SYSTEM.md`, `README.md`, `playbooks/{VERIFY,COMMIT_PUSH,WORKTREE_CONCURRENCY,AUTOMATION_LOOP}.md`) + a filled **`agent-kit/PROJECT.md`** binding every `<PLACEHOLDER>` to this repo + **`agent-kit/ralph-loop.sh`** (queue-driven autonomous loop wrapper; never deploys, local commits only). Added an "Agent Operating Rules" pointer section to `CLAUDE.md`.
- **Added `npm run verify`** (`eslint . && vitest run`) to the frontend `package.json` — the single pre-commit gate the kit hangs off.
- **Greened the suite:** fixed a stale assertion in `src/test/economyPage.test.jsx` (it asserted `.ep-dr-mech`/`.ep-dr-analog`, which were intentionally demoted to the thread Economy tab in the `/economy` rebuild) — this had been failing `vitest`. Now 178/178 pass.
- **Dead-code sweep:** removed the now-orphaned `.ep-dr-mech` / `.ep-dr-analog` / `.ep-aname` / `.ep-aout` / `.ep-amove` rules from `EconomyPage.css` (verified zero JSX references remain).

Tooling/docs + a test fix + dead-CSS removal — no shipped-behavior change, no deploy required.

## 2026-06-22 (redesign: Daily Brief → sectioned block layout)

Rebuilt the `/daily` page from a text-heavy column into a scannable, block-based intelligence brief — keeping the newspaper-broadsheet identity (Fraunces serif, ink-on-paper, rust accent, functional risk colors), so it stays consistent with the rest of the site rather than turning into a generic dashboard. Motivated by the page leading with a 350–400 word italic `summary` whose paragraphs collapsed into one run-on wall of text (`BoldText` never preserved the `\n\n` breaks the generator emits).

- **Seven numbered sections:** ① The Big Picture (verdict box = headline + a *trimmed 2-sentence* lead, a **Key Takeaways** callout, stat cards) · ② Top Stories (cards with category/region tags + prediction asides) · ③ The Story to Watch (rising thread as a dark highlight box with a trajectory badge) · ④ Country to Watch (colored risk card) · ⑤ Economic Footprint (existing `InstrumentChip`s, restyled) · ⑥ Shape of the Day (`categoryBreakdown` as a horizontal bar chart) · ⑦ Full Analysis (the long summary, **split into real paragraphs** with a drop cap, folded behind a `<details>` toggle so the fast read leads).
- **Key Takeaways** prefer a server `keyPoints[]` field if present, else derive *honestly* from existing structured fields (rising thread, country watch, top story titles) — no fabricated content; every number shown is a real count or risk level. **Frontend-only — works on every brief already in DynamoDB**, no backend/API change.
- **Verified:** `eslint` clean, `vite build` ✓, and a Playwright pass on the built bundle (desktop + mobile + the `/daily` today→fallback path) rendered every block with real data and **0 console errors**.
- Design study artifact (not shipped): `daily-brief-template.html` (repo root) — the standalone style mockup this was ported from.

Files: `global-perspectives-starter/frontend/src/components/{DailyPage.jsx,DailyPage.css}`.

## 2026-06-22 (docs: PAGES_GUIDE.md — added the 4 new pages + fixed stale references)

Brought `PAGES_GUIDE.md` back in sync with `App.jsx`. The page-by-page reference predated four shipped routes and still cited deleted code.

- **Added full entries** (purpose · user job · data sources · auth · inbound/outbound links · key UI · states · smoke-test · known issues) for `/analyze` (AnalysisStudio — BYOK + member our-compute path, registered-only gate), `/weekly-brief` (WeeklyBriefPage — published signals digest), `/track-record` (TrackRecordPage — Brier scoreboard, honest empty state), and `/membership` (MembershipPage — Polar checkout, dormant until billing is wired). Also noted the dev-only `/__boom` error-boundary route.
- **Re-pointed cross-references:** site-map nav corrected from the old 5 links to the real 9, footer updated, new "Standalone / nav-only pages" graph block + membership flow in the auth graph; Account entry now shows its 4 tabs and `→ /analyze` link; orphan table + hook×page matrix extended.
- **Fixed stale parts (all verified false against current source):** removed `useUserProfile`/`fetchUserProfile`/`user_profile` (deleted in the 2026-06-01 billing teardown) from the Weekly/Thread/Account entries; rewrote the Account entry (no tier badge / billing-portal stub / quick-access); cleared the "PrivacyTerms still mentions Stripe" note; marked cross-cutting findings #1–5 resolved (the dead `Pricing`/`PairPage`/`PairListPage`/`Gate` imports and the `/weekly-map`,`/intelligence-map`,`/cli`,`/test/briefing-card` orphans were all removed).

Docs-only — no frontend build/deploy required.

Files: `PAGES_GUIDE.md`.

## 2026-06-15 (swept the other AI generators for the summarizer's bug — not replicated)

Checked whether the "fabricate from the headline" flaw lived in the other content generators. **It didn't** — the summarizer was the only title-only offender:
- `trace_cause`/`research` (NewsProjectInvokeAgentLambda) use the article snippets; `newsThreadAnalysis` uses thread entries + live web refs; `newsCountryIntelligence` uses tracked coverage; `newsEconomicImpact` builds on threads+summaries+market context and already says "cite every claim". None summarize from the title alone.
- **Hardened `trace_cause` for consistency:** added a grounding rule — the proximate event and any specific name/figure/date must come from the snippets (no inventing, no hedge-stripping); structural/contributing fields may reason from background but must not fabricate specifics. Deployed; regenerated trace_cause verified still valid JSON.
- **"Automate all" coverage:** the daily `newsSourceAudit` correctly targets the **summary** — the strictly source-bound factual field that the analyst and the rest of the site build on. The other fields are analytical (`trace_cause`, country, systems — use background by design) or forecasts (`prediction` — speculative by design); auditing them for source-faithfulness would false-positive, so they're not bolted onto the audit. Catching summary drift catches fabrication at its root for the whole chain.

Files: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`.

## 2026-06-15 (AUTOMATED: scheduled source-truth audit Lambda — summarizer dead-man's-switch)

Automated the source-truth audit so summarizer regressions are caught without running it by hand (the freshness-monitor pattern, not CI).

- **New `newsSourceAudit` Lambda** (nodejs22, self-contained port of `quality/analysis/source_check.mjs`): daily it pulls the top live topics, computes L1 source robustness, fetches the full article(s) from up to 3 cited outlets, and asks the DeepSeek auditor whether OUR cached summary drifted (hedge-strip / invented result / added framing). If confirmed-drift ≥ `DRIFT_ALERT_THRESHOLD` (default 2) it **SNS-emails an alert**; always logs to CloudWatch.
- **Infra:** IAM role `newsSourceAudit-role` (basic-exec + `sns:Publish`); env DeepSeek key copied from `newsEconomicImpact` (never exposed); reuses the existing **`GlobalPerspectiveAlerts`** SNS topic (operator email already confirmed). EventBridge `newsSourceAuditDaily` `cron(30 8 ? * * *)`.
- **First run (test invoke):** checked 6, flagged 2 summary-drift + 1 single-source → alert fired to email. Works end-to-end. (Threshold/cadence/model tunable via env; raise `DRIFT_ALERT_THRESHOLD` if it proves noisy.)

Files: `amplify/backend/function/newsSourceAudit/src/index.js` (new).

## 2026-06-15 (Analysis Studio: live source-robustness banner (L1) + multi-source check refinement)

Surfaced the source-truth L1 signal to readers and tightened the offline check.

- **Live "Source basis" banner in `/analyze`:** new pure `utils/sourceRobustness.js` (`assessSelection`) scores the selected stories' `sources[]` (count, distinct outlets, tier) client-side — no model call. The result now shows, above the analysis, either "All N selected stories are corroborated by multiple outlets" (green) or an amber "**N of M selected stories rest on a single or low-credibility outlet — treat those as unverified**." So a single-source premise visibly downgrades the analysis for the reader. Mirrors `quality/analysis/source_check.mjs` so live + offline agree.
- **`source_check.mjs` refined:** L1.5 now fetches the full article from **up to 3 cited outlets** and concatenates them (was: first source only), so a summary claim correctly drawn from a *second* outlet is no longer mis-flagged as unsupported (the last residual false-flag from the 2026-06-14 run).

Files: `global-perspectives-starter/frontend/src/{utils/sourceRobustness.js,components/AnalysisStudio.jsx,components/AnalysisStudio.css}` + `docs/` build; `quality/analysis/source_check.mjs`.

## 2026-06-14 (ROOT-CAUSE FIX: summarizer was fabricating — grounded it in the sources)

The source-truth check (`quality/analysis/source_check.mjs`) traced the site's confident-but-false summaries to the **summarizer prompt** in `NewsProjectInvokeAgentLambda` (`buildSummaryPrompt`): it summarized from the **title only — never the article snippets** — and was told it was "summarizing news from {date}", so it confabulated (e.g. asserting a Swiss referendum was "rejected by a wide margin" before the vote happened) and stapled the run-date into summaries. Site-wide, since every page uses these summaries.

- **Fix:** feed the prompt the actual `topic.sources[].snippet` material, and add strict rules — summarize ONLY what the snippets report; preserve hedges ("could" ≠ "is"); never assert an unreported outcome/result/figure; never invent a date; say "pending/unresolved" when thin.
- **Deployed** (NewsProjectInvokeAgentLambda-dev, nodejs22) and **all 13 live summaries regenerated**.
- **Verified before→after on the same stories:** Switzerland's invented "rejected by a wide margin" → gone; AI-resurrect "chatbots" (was deepfake photos) → OK; Norway invented verdict date → OK; Adichie hedge-strip → OK. From ~5/6 stories with real drift to **0 fabrications**; 2 residual soft flags (a hedge nuance; a claim attributed to a 2nd outlet the check didn't fetch). Plan: `ANALYSIS_SOURCE_TRUTH_PLAN.md`.

Files: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`, `ANALYSIS_SOURCE_TRUTH_PLAN.md`.

## 2026-06-13 (Analysis Studio: reviewer-driven scenario + citation fixes; source-truth gap planned)

Acted on external-reviewer feedback on the samples.

- **Scenario design (the reviewer's #1 design flaw): fixed.** Scenarios now fork on **distinct outcomes** (holds / stalls / collapses), **must include a downside tail**, and probabilities **partition (~100%)** — verified: a re-sample produced "Fragile Limbo / Breakthrough / Collapse" with midpoints summing to 97.5% (vs the old success-biased tempo-forks that summed to ~102%).
- **Citation laundering: fixed.** `SYSTEM_PROMPT` now forbids stapling `[n]` to dates/figures from our *Prediction/Background* fields or to **external world-knowledge** (mark "(our forecast)" / present as uncited analyst context) — `[n]` is reserved strictly for claims the story actually reported.
- **Economic lens: earn magnitudes + cut padding** — justify why small/moderate/large; include only ripples with a real non-trivial mechanism (drop noise like "rare earths → up → small"); 3–5 high-conviction over an exhaustive checklist.
- **Source-truth gap PLANNED** (`ANALYSIS_SOURCE_TRUTH_PLAN.md`): the reviewer's most important point — both our checks verify *faithfulness to the source*, nothing verifies the source is *true/correctly characterized* (a rumor/thin/satirical source → confident, well-cited, fabrication-free reasoning on a rotten premise). This is also the original "review agent to review if it is true or not" ask. Layered plan: L1 source-robustness from `sources[]` metadata (buildable now), L2 surface the auditor flag in the live Studio, L3 claim-truth via deep-research/operator fact layer, L4 characterization completeness. **Not built yet** — proposed L1 first.

Files: `global-perspectives-starter/frontend/src/utils/analysisPrompt.js` + `docs/` build; `ANALYSIS_SOURCE_TRUTH_PLAN.md` (new).

## 2026-06-13 (Analysis Studio: prompt fixes to close the professional-quality gaps)

Applied the `ANALYSIS_QUALITY_COMPARISON_PLAN.md` fixes to `analysisPrompt.js`: (1) `SYSTEM_PROMPT` opens with a **"Bottom line" view** (only where supported, never manufactured) + **favor structural drivers over personalities**; (2) **economic lens** enforces direction → magnitude → mechanism (no bare "mixed"/"positive"; "mechanism unclear" if not derivable) — fixes the textbook "weak linkage" flaw; (3) **scenario lens** requires meaningfully-different probabilities (no clustering).

**Caught + fixed a self-inflicted regression via the verify loop:** the first pass at sharpening induced fabrication — a 1-story scenario cited phantom `[1][3][4][5]`, plus invented investor names (Fidelity/BlackRock) and a date (July 4). Added a hard counterweight to `SYSTEM_PROMPT`: "cite ONLY numbers that exist (one story → only [1])" + "sharpness must never become fabrication — don't invent names/orgs/dates/figures; stay general rather than fabricate." Re-sampled clean: correct citations (`[1]`/`[1-3]`/`[1]`), Bottom line present, differentiated probabilities (60-70/20-30/10-15), economic linkage with honest "mechanism unclear." Saved `quality/analysis/samples/2026-06-13-improved.html`.

Files: `global-perspectives-starter/frontend/src/utils/analysisPrompt.js` + `docs/` build; `quality/analysis/samples/2026-06-13-improved.html`, `ANALYSIS_QUALITY_COMPARISON_PLAN.md`.

## 2026-06-13 (saved analysis samples + professional-quality comparison study)

Persisted the generated analyses and started a standalone study of how our output compares to professional analysis (separate from the no-fabrication verify system; this asks "is it professional-grade?").

- **Saved samples:** `quality/analysis/samples/2026-06-13.md` (the 3 live examples + their automated checks). Regenerate via `check.mjs --out`.
- **`ANALYSIS_QUALITY_COMPARISON_PLAN.md`** (new): synthesizes 3 professional traditions — intelligence (ICD-203's 9 analytic standards), equity research (thesis-that-names-what-the-market-misses + the documented #1 flaw "weak linkage"), geopolitics (Stratfor: structural constraints over personality) — into a 9-point rubric, then compares our samples against it. **Match:** analysis-of-alternatives, fact-vs-judgment, calibrated uncertainty, so-what/limits, citations. **Gaps:** (1) guided lenses rarely lead with a non-consensus *thesis* (only the deep lens does); (5) **weak linkage** — economic lens gives directional labels ("likely mixed") not tied to magnitude/mechanism (the textbook equity-research weakness, also caught by the auditor); (6) leans on events over structural drivers; flat probability differentiation. Recommended prompt fixes listed (test via check.mjs + human vibe, no score). Quality has no ground truth → rubric-and-compare, not a benchmark.

Files: `quality/analysis/samples/2026-06-13.md`, `ANALYSIS_QUALITY_COMPARISON_PLAN.md` (new).

## 2026-06-13 (verify system reframed: a CHECK, not a benchmark + emailed samples)

Caught a conceptual error: analysis has **no ground truth**, so scoring it against a gold answer is a category error (proven — the panel pass-rate swung 40–80% on identical configs; it wasn't measuring a stable quantity). Reframed the verify system to a **check**, not a benchmark.

- **`quality/analysis/check.mjs`** (the keeper): generates a few real analyses from live stories, runs the deterministic **validator** (objective: did it fabricate? phantom cite / invented figure / invented date) + a one-line auditor **faithfulness flag** (does any claim contradict the sources?), and optionally renders them to HTML (`--out`) or emails them (`--email`, Resend). No 1–5 scores, no pass-rate — **quality/sharpness stays a human vibe-check**.
- **`ANALYSIS_STUDIO_BENCHMARK_PLAN.md` marked SUPERSEDED** — the scorecard/pass-rate/panel machinery is kept for reference but its numeric scores are no longer treated as a metric.
- Generated 3 live samples (Iran-deal scenario, Iran/EU/Venezuela compare, SpaceX-IPO economic) and delivered them to the operator (Gmail draft) for the human vibe-check. The check caught real issues: an `invented_figure` to verify, and subtle auditor faithfulness flags ("extracted under pressure", "core valuation component" not in sources).

Files: `quality/analysis/check.mjs` (new), `ANALYSIS_STUDIO_BENCHMARK_PLAN.md`.

## 2026-06-13 (benchmark: panel default + targeted human review + one-command automation)

After the panel experiment proved single-pass auditing flips verdicts ~67%, baked the panel in and automated the whole flow.

- **`run.mjs` now runs a 3-pass auditor panel by default** (`AUDIT_PASSES`/`AUDIT_TEMP` tunable): averages the 6 rubric scores, takes a **majority pass/flag verdict**, and flags **panel-split** cases (per-pass verdicts disagree) as the human-review queue. Scorecard + `DASHBOARD.md` gained `panel` and `splits` columns.
- **`review.mjs`** — targeted human review: surfaces ONLY panel-split + flagged cases (not every run), records good/bad + notes to `scorecard-<date>.human.json`. Auto-audit handles volume; the human judges the genuinely-ambiguous ones.
- **`bench.sh`** — one command: pulls the DeepSeek key from the Lambda (operator never handles it) → panel benchmark → scorecard/dashboard → points at the review queue. `--capture` refreshes frozen cases; `--pro` swaps the analyst to v4-pro. On-demand, no CI ([[feedback-no-ci-solo-dev]]).
- **Paneled baseline (2026-06-13):** 80% majority-pass, 1 hard-fail, 4 panel-splits; means faithfulness 3.8 / overreach 4.3 / calibration 3.9 / differentiation 3.9 / citations 4.3 / insight 3.7. (High split rate at temp 0.5 confirms many cases are genuinely borderline — exactly what the human queue is for; tune via `AUDIT_TEMP`.)

Files: `quality/analysis/benchmark/{run.mjs,review.mjs,bench.sh,DASHBOARD.md,scorecard-2026-06-13.json}`.

## 2026-06-13 (benchmark: auditor-panel experiment — single pass is too noisy)

Tested whether a single auditor pass is reliable or needs a panel. Extracted the rubric to a shared `auditor.mjs` (single source of truth for `run.mjs` + the new `panel.mjs`). `panel.mjs` generates the analysis once then audits it N×3 at temp 0.5, reporting per-pass scores, per-dimension range, and verdict flips.

**Finding:** on 3 cases the pass/flag verdict **flipped on 2 of 3 (67%)** with a worst per-dimension swing of **3 points** (overreach 2→5 on the same output). A single `v4-pro` pass is unreliable → a **3-pass panel (average + majority verdict)** is justified. Next: make the panel the default in `run.mjs`, and target human review at cases where the panel disagrees internally.

Files: `quality/analysis/benchmark/{auditor.mjs,panel.mjs,run.mjs}`.

## 2026-06-13 (Analysis Studio: reproducible benchmark + cross-model auditor)

Built the test+benchmark from `ANALYSIS_STUDIO_BENCHMARK_PLAN.md` so analysis quality is *measured*, not vibe-checked, and graded by a **different agent than the analyst** (self-grading is biased).

- `quality/analysis/benchmark/capture.mjs` — freezes real live story-sets (topics + cached summary/prediction/trace) into committed `cases/*.json` so runs are reproducible (live stories change daily). Seeded 5 cases from today's stories (Iran deal, EU–Ukraine, Venezuela, SpaceX IPO, free-form).
- `quality/analysis/benchmark/run.mjs` — for each case: analyst model generates → deterministic validator (hard guardrails) → **cross-model auditor** (`v4-pro` grading `v4-flash`) scores faithfulness / overreach / calibration / **differentiation** (new) / citations / insight (1–5), plus a deterministic probability-spread metric. Writes `scorecard-<date>.json` + appends `DASHBOARD.md` (quality trend in git). PASS = no hard error ∧ faithfulness≥4 ∧ overreach≥4 ∧ calibration≥3.5 ∧ no dim <2.
- **First baseline (2026-06-13):** 60% pass, 0 hard-fails; means faithfulness 3.8 / overreach 4.2 / calibration 4.2 / differentiation 4.0 / citations 4.2 / insight 4.0. The auditor caught real issues the regex validator can't: a multi-story scenario collapsing to a flat ~60–70% (differentiation 2, spread 0) and an economic run inventing an unsupported ticker/elaboration.
- On-demand, no CI ([[feedback-no-ci-solo-dev]]).

Files: `quality/analysis/benchmark/{capture.mjs,run.mjs,cases/*.json,scorecard-2026-06-13.json,DASHBOARD.md}`, `ANALYSIS_STUDIO_BENCHMARK_PLAN.md`.

## 2026-06-12 (Analysis Studio: force DeepSeek non-thinking mode for V4)

Follow-up to the V4 picker: DeepSeek's V4 models **default to thinking mode** (emit `reasoning_content`, burn the token budget, can truncate the answer) — different from the old `deepseek-chat` non-thinking behavior the Studio expects. Added a per-provider `extraBody: { thinking: { type: 'disabled' } }` to the DeepSeek entry, spread into the OpenAI-compat request body only for DeepSeek (OpenAI/Gemini/OpenRouter unaffected; Anthropic uses its own path). Verified all four DeepSeek model IDs accept the param and return clean non-thinking content; eval 20/20 on `deepseek-v4-flash`. So the picker keeps the visible V4 versions AND behaves like the known-good non-thinking model.

(Separately: the backend content Lambdas were left on `deepseek-chat` — a config-only V4 swap regressed them via the same thinking-mode issue and was reverted; correct backend migration needs the same code change + redeploy before 2026-07-24, see `BACKEND_DEEPSEEK_V4_MIGRATION_PLAN.md`.)

Files: `global-perspectives-starter/frontend/src/services/llm.js` + `docs/` build.

## 2026-06-12 (Analysis Studio: show the actual DeepSeek model VERSION)

The model picker showed opaque aliases (`deepseek-chat`/`deepseek-reasoner`) — no way to tell if you were on V3 or V4. Verified against the live DeepSeek `/models` endpoint: the only current IDs are **`deepseek-v4-flash`** and **`deepseek-v4-pro`** (both smoke-tested OK through our OpenAI-compat path; the API echoes the version in the response `model` field). The old aliases are now just legacy pointers to V4-Flash and **retire 2026-07-24**.

- Picker now offers the explicit V4 IDs first (`deepseek-v4-flash` default, `deepseek-v4-pro` = strongest, best for analysis), with friendly `modelLabels` so the version is visible; the legacy aliases are kept but clearly labelled with their retirement date.
- ProviderModal renders `modelLabels[id] || id`.
- ⚠️ Note (backend, not fixed here): the content-pipeline Lambdas still call `deepseek-chat` via env vars — that alias retires 2026-07-24 and should be migrated to `deepseek-v4-flash`/`-pro` before then.

Files: `global-perspectives-starter/frontend/src/{services/llm.js,components/ProviderModal.jsx}` + `docs/` build.

## 2026-06-12 (fix: footer version was clipped, not missing)

The build-version stamp added earlier WAS deploying correctly (verified in the live bundle) but wasn't visible: the footer was a fixed-height single row with `overflow: hidden` + `white-space: nowrap`, so on narrower windows the version span on the far right got clipped off. Fixed by letting the footer wrap (`flex-wrap: wrap`, `min-height` instead of `height`, removed the overflow clip), so the version always shows (it drops to a second line when the row is crowded). It lives at the bottom of every page.

Files: `global-perspectives-starter/frontend/src/components/Layout.css` + `docs/` build.

## 2026-06-12 (Analysis Studio: registered-only gate + API-key management)

Two fixes from prod use: no way to reset a wrong API key, and the feature was usable without an account.

- **Registered-only gate:** `/analyze` now requires a signed-in (non-anonymous) account. Non-registered visitors get a blocking "Sign in to analyze" modal (Sign in → `/signin`, or Back to home). Scoped to this BYOK feature only — it does NOT touch the public data hooks (those stay anonymous-accessible).
- **API-key management in Account:** new **"Analysis key"** tab on `/account` shows the stored provider/model + masked key, with **Change key** (re-opens the provider modal) and **Remove key** (clears it from the browser). Fixes "entered the wrong key, nowhere to reset it."
- **Wrong-key affordance in the Studio:** when a run fails with an auth-style error (401/403/invalid key), the error now shows a one-click **"Change API key"** link that re-opens the modal — instead of leaving the user stuck.

Files: `global-perspectives-starter/frontend/src/components/{AnalysisStudio.jsx,AnalysisStudio.css,Account.jsx,Account.css}` + `docs/` build.

## 2026-06-12 (build version stamp in footer)

Added a visible build version so prod deploys can be confirmed at a glance (e.g. on `/analyze` after a deploy). Vite `define` injects the git short SHA + build date at build time (`__APP_VERSION__` / `__BUILD_DATE__`); the global footer shows `v<sha> · <date>`. To keep the stamp pointing at the exact deployed commit (not its parent), the source is committed first, then the build is made against that commit, then `docs/` is committed.

Files: `global-perspectives-starter/frontend/{vite.config.js,src/components/Layout.jsx,src/components/Layout.css}` + `docs/` build.

## 2026-06-11 (Analysis Studio: Scenario-lens date discipline — Phase 6)

Fixed the overreach the LLM-judge caught: the Scenario lens invented calendar dates ("June 15") for triggers when the material had none.

- **Lens wording tightened:** "attach a date to a trigger ONLY if that date appears in the material; otherwise 'timing unclear' or a relative horizon — never invent a specific calendar date."
- **New `invented_date` validator check (warn):** explicit Month+Day / ISO dates normalized to M-D and flagged when absent from the source material; relative horizons ("within weeks") are never flagged; gated on context so deep/web mode is exempt. Golden cases added (invented_date / date_in_context_ok / relative_horizon_ok); validator suite 16/16.
- **Verified live:** the judge that previously flagged "June 15" now scores the Scenario lens 5/5. Also improved the judge harness to receive the analyst's REQUEST, so it stops mis-flagging a user-posed hypothetical ("what would a failure of the talks mean?") as overreach — judge now 4/4 pass.

Files: `global-perspectives-starter/frontend/src/{utils/analysisPrompt.js,utils/analysisValidator.js}` + `docs/` build; `quality/analysis/{fixtures.mjs,judge.mjs}`; `ANALYSIS_STUDIO_TESTING_PLAN.md`.

## 2026-06-11 (Analysis Studio: thin-input overreach guard + LLM-as-judge eval)

Closed the one real quality gap the audit found — the guided Scenario lens manufacturing false-precision scenarios on bare-headline stories — and added a semantic-quality eval layer. Plan: `ANALYSIS_STUDIO_TESTING_PLAN.md` (Phases 2–4, 6).

- **Thin-input guard (Phase 2):** `assessRichness()` (pure) scores source material per story (combined summary/prediction/background; bar = 240 chars on the richest story). When thin, `buildUserMessage` appends an anti-overreach instruction ("don't manufacture scenarios/figures; state what can and can't be concluded under Limits"), and the validator emits a `thin_input` *info* signal (banner caveat). Skipped in deep mode (the web supplies fresh material). **Verified live:** the thin-rumor Scenario output dropped ~3000→~1600 chars and now LEADS with "Limits of this analysis" instead of fabricating three scenarios.
- **LLM-as-judge (Phase 3, `quality/analysis/judge.mjs`):** grades live closed-book output on faithfulness/overreach/calibration/citations/insight (1–5); catches semantic drift the regex validator can't. On first run it independently scored the thin case faithfulness 5/overreach 5 (confirming the Phase 2 fix) and **flagged the Scenario lens for inventing a date-stamped trigger ("June 15")** — logged as Phase 6 (tighten the lens's "dated where possible" wording).
- **Eval expansion (Phase 4):** added a `thin_input` golden case + `RICHNESS_CASES` (new Layer A2 in `run.mjs`); `run.mjs`/`compare.mjs` now thread the `thin` flag. **17/17 pass** (Layer A + A2 + B, DeepSeek).
- **Held with reasons (not built):** OpenAI Responses / Gemini grounding deep paths (can't verify without those keys — won't ship blind); Polar usage logging (billing, Phase 5).

Files: `global-perspectives-starter/frontend/src/{utils/analysisPrompt.js,utils/analysisValidator.js,components/AnalysisStudio.jsx}` + `docs/` build; `quality/analysis/{run.mjs,compare.mjs,judge.mjs,fixtures.mjs,README.md}`; `ANALYSIS_STUDIO_TESTING_PLAN.md`.

## 2026-06-11 (Analysis Studio: deep-research prompt upgraded to elite analyst bar)

Raised `DEEP_SYSTEM_PROMPT` from "competent desk summary" to "analyst you'd subscribe to," after an honest craft critique (it had structure + calibration but no view, soft numbers, no base rates, no non-obvious insight). The deep-research path already retrieves real sources, so we can demand rigor without loosening honesty. Plan: `ANALYSIS_STUDIO_DEEP_RESEARCH_PLAN.md`.

- New required sections: **Bottom line** (a directional, ideally non-consensus *thesis* + confidence — a view, not a summary); **What happened** (dense with *hard numbers pulled from sources*, attributed — "a large share" is a failure); **Why** (concrete transmission mechanism); **What might happen next** (scenarios each with a *historical analog/base rate* justifying the probability + a *dated, falsifiable trigger*); **What the consensus is missing** (one genuinely non-obvious insight); **Who is affected**.
- Honesty kept intact: distinguish fact from judgment, give ranges + which source you trust on conflict, confident "we can't call this yet" over false precision. Validated by running the assistant as the engine on a live story (US–Iran/Hormuz + Broadcom): v2 produced a non-consensus thesis, sourced numbers (~20m b/d, +143% AI rev, $16B vs $17.2B), the 2019 Abqaiq analog (+19.5%→round-tripped ~2wks), and a China-leverage read — guardrail check `ok:true`, 0 warnings.

Files: `global-perspectives-starter/frontend/src/utils/analysisPrompt.js` + `docs/` build; `ANALYSIS_STUDIO_DEEP_RESEARCH_PLAN.md` (new).

## 2026-06-11 (Analysis Studio: "Deep research (web)" mode + Perplexity provider)

Answered "shouldn't the free-form prompt say *search the internet and find as many resources as you can*?" the industry-standard way. A plain chat API **cannot** search — prompting it to would make the model fake having searched (fabricated sources, our worst failure). Deep-research products (Perplexity, OpenAI/Gemini deep research) all wire a **real retrieval tool** into the call; we now do the same, gated to providers whose API genuinely searches.

- **Perplexity joins the BYOK chooser** (`sonar-pro`, `sonar`, `sonar-reasoning-pro`, `sonar-deep-research` — OpenAI-compatible at `api.perplexity.ai`; every run searches natively and returns `citations`/`search_results`). Anthropic gains its official `web_search_20250305` server tool, attached only in deep mode. Verified against both providers' docs.
- **Third mode: "Deep research 🔎web"** alongside Guided/Free-form: our stories seed a real web search; `DEEP_SYSTEM_PROMPT` instructs gather-as-many-reputable-sources-as-you-can → structured deep analysis (What happened / Why / What might happen next / Who is affected), seed stories cited `[n]`, web claims only from retrieved sources, conflicts flagged, thin search = honest "Limits" instead of padding.
- **Honest gating, never silent degradation:** the mode is disabled (with the reason in the tooltip) for DeepSeek/OpenAI/Gemini whose APIs can't search via our path; `runChat` also hard-refuses `webResearch` on a no-search provider. Switching to a no-search provider drops you out of deep mode. The provider modal labels search-capable choices.
- **Web sources rendered + validator adapted:** model-retrieved sources listed under the analysis ("Web sources (model-retrieved)"), disclaimer notes they're not pipeline-verified; phantom-`[n]`-citation check still enforced in deep mode, the invented-figure check is skipped there (the web legitimately introduces new figures). `runChat` now returns `{ text, webSources }` (eval scripts updated; 12/12 still pass).

Files: `global-perspectives-starter/frontend/src/{services/llm.js,utils/analysisPrompt.js,utils/analysis.js,components/AnalysisStudio.jsx,components/AnalysisStudio.css,components/ProviderModal.jsx,components/ProviderModal.css}` + `docs/` build; `quality/analysis/{run.mjs,compare.mjs}`.

## 2026-06-11 (Analysis Studio: output guardrail validator + banner + eval harness)

Made the Analysis Studio (`/analyze`) honest *in fact*, not just in instruction. Its guardrails — cite real sources, never invent figures, refuse on thin data — previously lived only as system-prompt text, with nothing verifying the model obeyed them. On an intelligence product an analysis that cites a non-existent source or invents a percentage is misinformation, so the output now gets checked. Plan: `ANALYSIS_STUDIO_TESTING_PLAN.md`.

- **Shared guardrail validator** (`utils/analysisValidator.js`, pure/dependency-free): flags `phantom_citation` (cites `[n]` for a story that wasn't provided — **error**), `no_citations` (long answer anchoring nothing — warn), `invented_figure` (a `%` stated as a sourced fact but absent from the material — warn), `unused_source` (info). **Precision rules** keep the banner from crying wolf: scenario probabilities (`~60%`, `(15%)`) and roundings (`about 12%`) are excluded as analyst judgment, not fabrication; code is stripped before checking.
- **Live banner in the Studio** (`AnalysisStudio.{jsx,css}`): every generated analysis is validated and shown a green-pass / amber-verify / red-flag banner above the output, using the site `--risk-*` tokens.
- **Refactor for test-parity:** the pure prompt layer (system prompt, lenses, context assembler, user-message builder) was extracted to `utils/analysisPrompt.js` (no browser-only imports) so the eval imports **exactly what ships**; `utils/analysis.js` keeps `buildAnalysisContext()` and re-exports the pieces (no change for existing importers).
- **Offline eval harness** (`quality/analysis/`): `run.mjs` Layer A (validator regression vs frozen golden fixtures, no key) + Layer B (real prompt → provider → validate live output, with a key); `compare.mjs` A/Bs free-form vs grounded-lens on the same stories with full text + verdict; `fixtures.mjs`, `README.md`. **12/12 pass** (8 golden + 4 live, DeepSeek).
- **Audit finding** (recorded in the plan): both modes stayed honest and self-flagged limits; the guided lens is more decision-grade (probabilities + falsification criteria), but **overreaches on thin inputs** (manufactured scenarios on a single unconfirmed rumor where free-form correctly refused) — the validator catches *fabrication*, not *overreach* → Phase 2 thin-input guard.

Files: `global-perspectives-starter/frontend/src/{utils/analysisValidator.js,utils/analysisPrompt.js,utils/analysis.js,components/AnalysisStudio.jsx,components/AnalysisStudio.css}` + `docs/` build; `quality/analysis/{run.mjs,compare.mjs,fixtures.mjs,README.md}`; `ANALYSIS_STUDIO_TESTING_PLAN.md` (new).

## 2026-06-10 (weekly brief → SIGNALS format + /weekly-brief signals page + weekly schedule)

Pivoted the weekly brief from a synthesized "deep analysis" essay to a **signals digest** — after research into how rigorous weeklies actually work (Economist "world this week", ISW assessments, Semafor "Semaform"): they surface discrete signals and keep fact separate from judgment, never melting a grand thesis into the stream. An automated synthesizer overreaches when forced to connect (it led with the dramatic read + invented specifics — the failure the user's audit caught). The signals model fixes all three failure modes.

- **`newsWeeklyBrief` reworked to emit signals** (`format:'signals'`): per-signal `{ lede, fact, soWhat }` written by the LLM under strict epistemic rules (verb-mark claims, calibrated so-what only, no grand thesis, no forced cross-links, no invented specifics), joined with **deterministic** `{ riskLevel, riskScore, region, asOf, sources }` (risk + real article links + dates are our data, never the LLM's). Plus a `watch` list. Sorted by risk. Deployed + generated (6 signals, real source links, disciplined Xi/NK read).
- **`/weekly-brief` rebuilt as the signals layout** (`WeeklyBriefPage`): KPI row (mono stat-cards) → color-coded signal cards (lede + risk chip + region/as-of + fact + "So what" + real source links) → "What to watch" → honesty footer. Matches site tokens (Fraunces/Inter/JetBrains Mono, rust, `--risk-*`). Mirrors the design-agent mock the user approved.
- **Weekly schedule:** EventBridge `TriggerWeeklyBrief` `cron(0 6 ? * SUN *)` generates a **draft** each Sunday; the human publishes via `weekly/review.js` (gate kept — generation is scheduled, publishing stays manual). `review.js` updated for the signals shape.

Files: `amplify/backend/function/newsWeeklyBrief/src/index.js`, `weekly/review.js`, `global-perspectives-starter/frontend/src/components/{WeeklyBriefPage.jsx,WeeklyBriefPage.css}` + `docs/` build, `WEEKLY_DIGEST_PLAN.md`.

## 2026-06-10 (Analysis Studio: BYOK self-serve analysis at /analyze)

Shipped the first version of **"analyze it yourself"** — a new `/analyze` page where a reader picks real stories from our data and gets a cited deep-dive, run on **their own LLM API key** (BYOK). Build-first: the feature exists before any billing; later the free BYOK run becomes a Polar credit. Plans: `ANALYSIS_STUDIO_PLAN.md` (feature) + `POLAR_BILLING_PLAN.md` (the subscription/credits direction it feeds).

- **Two input modes, one engine + the same honesty guardrails under both** (the experiment is input style, not safety): **Guided lens** (5 fixed templates — Scenario forecast / Winners & losers / Economic ripple / Root-cause chain / Compare) and **Free-form** (ask anything about the selected stories). Both cite sources with `[n]`, refuse on insufficient data, never fabricate figures, and stay locked to the user's selected stories.
- **BYOK, no cap, key never leaves the browser.** A provider/model chooser modal (OpenAI · DeepSeek · Gemini · OpenRouter via one OpenAI-compatible path + **Anthropic** via its own adapter with the direct-browser-access header). Key + choice stored in `localStorage` only; the analysis call goes browser → provider directly — our servers never see it. So no new backend for this phase.
- **Synthesizes our own intelligence, cited.** The context builder pulls each selected topic's cached `SUMMARY` / `PREDICTION` / `TRACE_CAUSE` from the public proxy and assembles a numbered, citable block; the report renders via `Markdown.jsx` with a Sources list + an analyst-input disclaimer.
- Wired `/analyze` route + nav entry. ⚠️ First live runs will reveal each provider's browser-CORS support (CORS-blocked providers get a no-store pass-through fallback later); Anthropic model IDs use current session values.

Files: `global-perspectives-starter/frontend/src/{services/llm.js,utils/byok.js,utils/analysis.js,components/AnalysisStudio.jsx,components/AnalysisStudio.css,components/ProviderModal.jsx,components/ProviderModal.css,App.jsx,components/Layout.jsx}` + `docs/` build. Docs: `ANALYSIS_STUDIO_PLAN.md`, `POLAR_BILLING_PLAN.md` (new); deprecation banners + cross-links in `TIERS.md`, `PADDLE_SETUP.md`, `ARCHITECTURE.md`, `SYSTEM_WIRING.md`.

## 2026-06-10 (weekly brief: free-form tradecraft prompt + /weekly-brief serif long-read page)

Finished the weekly brief's analysis quality + made it viewable on-site.

- **Free-form, tradecraft-grounded prompt** (replaced the rigid JSON field schema, which produced formulaic output). Encodes IC analytic tradecraft (ICD 203), Sherman Kent's estimative-probability ladder, Heuer's bias traps, and BLUF/nut-graf/Economist-leader composition. Output `{ headline, dek, brief(Markdown) }`. **Free generation is the default** (richer; model may add context), with the mandatory `weekly/review.js` human approve as the grounding safety net before publish; `{mode:'grounded'}` forces strict.
- **`/weekly-brief` page — serif long-read.** New `WeeklyBriefPage` + `useWeeklyBrief` + a dependency-free `Markdown.jsx` renderer (## / lists / **bold**, XSS-safe). Georgia serif body 19px/1.7 in a 680px reading column (Economist/NYT/Stratechery reading experience), rust section headings, dek, reading time. Honest empty state until a brief is published. Linked in nav.
- **Backend serving:** public `weekly_brief` action on `newsSensitiveData` (latest *published* brief) — deployed to `newsSensitiveData-dev`, curl-verified.
- The page shows the empty state until the operator publishes a draft via `weekly/review.js` — auto-publishing is intentionally not done (the human gate is the safety net; the AWS guard also blocks it).

Files: `amplify/backend/function/newsWeeklyBrief/src/index.js`, `amplify/backend/function/newsSensitiveData/src/index.js`, `global-perspectives-starter/frontend/src/{components/WeeklyBriefPage.jsx,components/WeeklyBriefPage.css,components/Markdown.jsx,hooks/useWeeklyBrief.js,services/restProxy.js,components/Layout.jsx,App.jsx}` + `docs/` build, `WEEKLY_DIGEST_PLAN.md`.

## 2026-06-10 (weekly intelligence brief: professional analyst-grade synthesis engine)

The second email type — a **weekly intelligence brief** (distinct from the daily brief): a professional, analyst-grade 7-day synthesis, not a link roundup. Plan: `WEEKLY_DIGEST_PLAN.md`. Decided: on-site `/weekly-brief` page + email, one-click human approve, Sunday send, broadcast v1.

- **New `newsWeeklyBrief` Lambda — DEPLOYED + verified.** Grounded LLM synthesis (**DeepSeek V4**): gathers the week's `THREAD_ANALYSIS` / `COUNTRY_INTELLIGENCE` / `ECONOMIC_IMPACT`, selects the top threads/countries by significance, and synthesizes a brief — **BLUF, ranked key developments (what/why/trajectory), cross-currents (systems view), markets read, watch-next**. Critical grounding rule: connects/elevates already-cited analysis, never mints new facts; fails empty on a thin week. Writes `WEEKLY_BRIEF#{weekKey}` / `WEEKLY_BRIEF`, `status:'draft'`. Created the Lambda + `newsWeeklyBrief-role` (read NewsCache, R/W SummarizeAndPredict) + DeepSeek env via CLI (secret passed via temp file, never in the command). **No schedule yet** (manual-invoke until quality is trusted). First real draft (week of 2026-06-10) verified — analyst-grade output grounded in the live week.
- **New `weekly/review.js`** — one-click human approval (AWS CLI, no deps): list drafts, preview, publish (`status → published`) / hold / reject. Mirrors `breaking/review.js`.
- **Next (not built):** public `weekly_brief` serving action + `/weekly-brief` page + nav/bell link; forecast-scorecard section from `prediction_track_record`; email render + Sunday EventBridge schedule.

Files: `amplify/backend/function/newsWeeklyBrief/src/{index.js,package.json}` (new), `weekly/review.js` (new), `WEEKLY_DIGEST_PLAN.md` (new).

## 2026-06-10 (in-app notification bell: nav bell + global alerts feed)

Added a persistent **notification bell** to the nav so users can pull up missed breaking alerts on-site — the reliable fallback when email lands in spam, and (zero email-compliance burden) the first live delivery channel ahead of email. Spec in `BREAKING_ALERTS_PLAN.md` (Component 5); rationale in `NOTIFICATION_GAP_ANALYSIS.md`.

- **Cheap by design — reuses the broadcast model, not a per-user fanout.** Backend: a **public** `list_alerts` action on `newsRecommend` (co-located with prefs) scans `GlobalPerspectiveBreakingAlerts` for `status ∈ {confirmed,sent}`, newest-first; returns `[]` honestly if empty/absent. Deployed via CLI; **created the `GlobalPerspectiveBreakingAlerts` table** (PAY_PER_REQUEST + TTL on `ttl`) + IAM Scan for `newsRecommend-role`. Curl-verified: `{ok:true, alerts:[]}`.
- **Read-state is client-side** — a `localStorage` "last read" timestamp drives the unread badge (no per-user backend write in v1; cross-device sync deferred).
- Frontend: `hooks/useNotifications.js` (5-min poll), `components/NotificationBell.jsx` + `.css` (badge + dropdown + honest "You're all caught up" empty state; renders for everyone since the feed is public; hides if the endpoint isn't configured), wired into `Layout.jsx` nav.
- **Currently empty by design** — the feed populates once the breaking detector is deployed and alerts are confirmed via `breaking/review.js`. Build compiles (`vite build`); preview served HTTP 200. Deployed to `docs/`.

Files: `amplify/backend/function/newsRecommend/src/index.js`, `global-perspectives-starter/frontend/src/{hooks/useNotifications.js,components/NotificationBell.jsx,components/NotificationBell.css,components/Layout.jsx,services/restProxy.js}` + `docs/` build, `BREAKING_ALERTS_PLAN.md`.

## 2026-06-10 (notification settings menu: Account → Notifications tab + prefs API on newsRecommend)

User-facing email-notification preferences — the foundation for who the breaking-alert/digest senders target. Spec in `SETTINGS_MENU_PLAN.md`; design rationale in `NOTIFICATION_GAP_ANALYSIS.md`.

- **Backend — DEPLOYED & verified.** Added `get_prefs` / `set_prefs` actions to `newsRecommend` (it already owns `GlobalPerspectiveUserPrefs` + the Firebase-JWT helper). Both require a JWT (`uid` from the token); `set_prefs` writes `breakingOptIn`/`digestOptIn`/`digestCadence` (defaults OFF, opt-in/GDPR) and reserves the compliance fields (`email`, `consentAt`, `unsubToken`, `*Verified`) for when delivery goes live; never clobbers `interestProfile`. Created a **Lambda Function URL** (auth NONE, CORS to the site origins) + public-invoke permission via AWS CLI. IAM already had Get/Update on the prefs table. Curl-verified: no-token → 401 `sign_in_required`; default `recommend` path still 200 (backward compatible).
- **Frontend — built, staged in `docs/`, pending a signed-in browser pass.** New `hooks/usePreferences.js` (optimistic save, revert-on-error, no fake success), `services/restProxy.js` `fetchPrefs`/`savePrefs` (→ `window.USER_PREFS_ENDPOINT`), and an Account → **Notifications** tab (`components/Account.jsx`): Breaking-alerts toggle, Weekly-digest toggle + daily/weekly cadence, unsubscribe-from-all, and an honest "email delivery is being set up" banner (degrades gracefully if the endpoint isn't configured — [[feedback-no-misinformation-fallback]]).
- `docs/config.js` — added `window.USER_PREFS_ENDPOINT` (surgical edit, all existing endpoints preserved).
- **Not committed/pushed** — awaiting a signed-in click-through (sign in → Account → Notifications → toggle → reload → persists) per [[feedback-test-ui-in-browser]].

Files: `amplify/backend/function/newsRecommend/src/index.js`, `global-perspectives-starter/frontend/src/{hooks/usePreferences.js,services/restProxy.js,components/Account.jsx}`, `docs/config.js` + `docs/` build, `SETTINGS_MENU_PLAN.md`.

## 2026-06-10 (breaking alerts: notification gap analysis + novelty/velocity in the significance scorer)

Researched how best-in-class news/notification products decide *what to send and why* and how they design *preference centers* (NYT, Apple News, Google News, Bloomberg, Techmeme, Substack, Axios, Ground News + academic First-Story-Detection/burst-detection work), then mapped it against our system to find gaps. Wrote `NOTIFICATION_GAP_ANALYSIS.md` (full synthesis + prioritized roadmap + compliance checklist, all cited).

**Top finding, fixed:** our significance score was magnitude-heavy with **no novelty signal** — it couldn't tell a brand-new event from the Nth update to an ongoing thread (the #1 cause of alert fatigue in clustered-news systems). Added two deterministic signals using data we already carry:
- **Velocity term** (`significance.js`) — new angles this cycle vs the thread's prior `entryCount` (burst signal); a story going 2→8 scores far above one flat at 8.
- **Continuation-aware threshold** — a continuation (lead topic has `continues_topic`, or the thread already had a `THREAD_ANALYSIS`) must clear `SIGNIFICANCE_THRESHOLD × 1.8`, so it only re-alerts on genuine escalation (carried by velocity/magnitude), never on staying loud. Deterministic stand-in for First Story Detection.
- `index.js` computes velocity + `isContinuation` per story and gates on `effectiveThreshold(...)`. 39 unit tests pass (added velocity + continuation cases).

**Next (spec'd in the gap analysis, not yet built):** the user-facing settings menu — Account → "Notifications" tab + JWT `get/set_prefs` on `newsRecommend` + opt-in fields (default OFF), separate Breaking vs Digest, double opt-in + one-click unsubscribe when email goes live.

Files: `NOTIFICATION_GAP_ANALYSIS.md` (new), `amplify/backend/function/newsBreakingAlert/src/significance.js` + `index.js` + `test-significance.mjs`.

## 2026-06-10 (breaking-news email alerts: detector + human-review queue + Resend send seam, dry-run)

Started the breaking-news email channel — Component 4 of the recommendations/digest plan (shares its `GlobalPerspectiveUserPrefs` table + compliance). v1 is a **broadcast** alert (global significance, not personalized) that fires when a genuinely significant story breaks, pairing the headline with our already-generated analysis. **Detection + human review + send seam built; nothing sends yet (dry-run, no deploy, no Resend key wired).**

- **New `newsBreakingAlert` Lambda** (`amplify/backend/function/newsBreakingAlert/src/`):
  - `significance.js` — pure, deterministic story scorer (no LLM). Aggregates topics by `threadId`, scores on popularity (`sources.length`), breadth (concurrent angles), country `riskScore` (0–100), and economic `magnitude`. Alerts only above a tuned threshold — **most cycles send nothing, which is the correct, honest outcome**. Emits `reasons[]` for tuning. 32 unit tests pass (scorer + render text/HTML + trace + XSS-escape, `test-significance.mjs`).
  - `render.js` — returns `{subject, text, html}` from real, already-generated analysis only; empty sections omitted, never placeholdered (honesty contract). Sections: *What happened* (SUMMARY) → *How we got here* (TRACE_CAUSE causal chain: trigger → building factors → structural root + underreported angle + Signal-vs-Noise verdict) → *Our read* (PREDICTION) → market impact → sources. HTML is brand-styled (rust `#a2442e` masthead + "BREAKING" badge, serif headline, editor-note callout, CTA button) using email-safe table layout + inline CSS; XSS-escaped. Plain text is the fallback.
  - `index.js` — loads `latest` topics + enrichment (incl. parsing the `TRACE_CAUSE` JSON), dedupes (`GlobalPerspectiveBreakingAlerts`, 5-day window), caps to one story/run, **proposes** (`status:'proposed'`) — never auto-sends. `DRY_RUN=true` default. `verifyStory()` stub seam for the Phase-3 LLM judge.
  - `sendEmail.js` — provider seam. **Resend** (chosen over SES for DX + no sandbox-approval wait), via `fetch`, no npm dep, key from `RESEND_API_KEY`.
- **New `breaking/review.js`** — human confirmation queue (AWS CLI, no npm deps, mirrors `predictions/review.js`): review each proposed alert, **add your own words** (editor note that leads the email), confirm/reject.
- **New `breaking/send-test.js`** — renders a sample and actually sends it: `RESEND_API_KEY=re_xxx node breaking/send-test.js` → delivers to your Resend account email via `onboarding@resend.dev`, zero domain setup.
- **Pipeline:** detect → propose → LLM verify (Phase 3, Gemini judges the DeepSeek-written analysis) → human confirm + words → send (Phase 4, Resend; first test to `benlai310@gmail.com`). Benchmark deferred until dry-run history exists to label.
- Plans: `BREAKING_ALERTS_PLAN.md` (new); `RECOMMENDATIONS_AND_DIGEST_PLAN.md` (provider note: digest switches to Resend too).

Files: `amplify/backend/function/newsBreakingAlert/src/{significance,render,index,sendEmail}.js` + `test-significance.mjs` + `package.json` (new), `breaking/{review,send-test}.js` (new), `BREAKING_ALERTS_PLAN.md` (new), `RECOMMENDATIONS_AND_DIGEST_PLAN.md`.

## 2026-06-10 (fix: `latest` topics now carry `threadId` — narrative links restored)

The served `latest` topics carried **no `threadId`** (0/13 live), so the lede headline, Home's "Story arc →" / "Economic impact →" badges, and the per-topic economic-severity match all silently failed to link. Root cause: `swapStagingToActive` wrote the **raw staging topics** (no threadId) to `latest`, while threadId was only assigned later inside `buildAndWriteArchive` — and computed from `buildTopic`-processed topics that **drop `continues_topic` and `category`**, so archive threading was itself running degraded.

- **`NewsProjectInvokeAgentLambda`** now computes threadIds from the **raw** staging topics (full fields: `continues_topic`, `category`, `search_keywords`) once, stamps `threadId` onto each topic before the swap, and passes the same map to `buildAndWriteArchive` so `latest` and the archive stay in sync. Single-topic manual invokes fall back to local assignment.
- Deployed to `NewsProjectInvokeAgentLambda-dev` (ap-northeast-1) + triggered one run. **Verified: 13/13 live `latest` topics now carry `threadId`**, inheriting prior threads via `continues_topic`/Jaccard.
- **Follow-up (same day):** `buildTopic()` also dropped `search_keywords` + `continues_topic`, so **archive entries** stored empty keywords — starving next-day Jaccard threading. `buildTopic()` now carries both through, so the keyword-overlap fallback works going forward. Deployed + verified: today's 13 fresh archive entries now carry `search_keywords` (older entries age out via the 24h TTL).

Files: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`.

## 2026-06-10 ("Today's lede" orientation band on Home + Map; honest daily-brief date)

Added a deterministic one-line orientation band to the top of Home and the Map so a visitor immediately sees what the day is about and can click into the analysis — mirrors the proven `/economy` "Today in the economy" briefing pattern (pure function, no LLM, honesty-checked).

- **New `utils/composeTopicsLede.js`** — pure compose over the `topics` + economic-disruption data the pages already load. Picks the day's lede by severity of a cited disruption → urgency → trending → source count. Every count traces to a real input; the headline is a verbatim topic title. No fabrication.
- **New `components/atoms/LedeBand.jsx` + `.css`** — the strip. Renders **nothing** when there is no real lede (honest empty state). Headline links into the story-arc thread page **only when the topic carries a real `threadId`** — no fallback link (an unlinked headline is honest; a guessed destination is not).
- **Wired into** `Home.jsx` (between the StatusStrip and masthead) and `WorldMapV2.jsx` (between the map title and search) — no new fetches.
- **Honesty eval:** `quality/briefing/verify_lede.mjs` (4 cases, all pass). Verified against live production data.
- **Daily brief honesty:** `useDailyBrief.js` now exposes `servedDateKey` (the date that actually returned data after the up-to-7-day fallback). `DailyPage.jsx` shows a relative pill ("Yesterday" / "N days ago") next to the date, and an honest notice when you open `/daily` before today's brief is generated ("Today's brief publishes at the end of the day — showing <date>"). Title NOT renamed (would be wrong on archive views).

> **Known follow-up (next):** live `latest` topics currently carry no `threadId`, so the lede headline (and Home's existing "Story arc →" / "Economic impact →" badges) don't link. Fixing the pipeline `threadId` surfacing is the next task.

Files: `src/utils/composeTopicsLede.js` (new), `src/components/atoms/LedeBand.{jsx,css}` (new), `src/components/Home.jsx`, `src/components/WorldMapV2.jsx`, `src/hooks/useDailyBrief.js`, `src/components/DailyPage.{jsx,css}`, `quality/briefing/verify_lede.mjs` (new).

## 2026-06-05 (onboarding: auto-show is now a single welcome popover, not a 6-step walk)

The first-visit experience was a 6-step nav walkthrough — too much procedure to greet a new user with. Replaced the auto-shown tour with a single screen-centered welcome popover (`SITE_WELCOME`) that names the four sections in one glance and points at the "?" for more. The fuller multi-step `SITE_INTRO` walk is now on-demand only — replayed from the "?" button on pages without their own page tour. The `/economy` per-page tour is unchanged.

Files: `src/onboarding/tours.js` (new `SITE_WELCOME`), `useOnboarding.js` (auto-show `SITE_WELCOME` instead of `SITE_INTRO`), `docs/` build.

## 2026-06-02 (onboarding: guided product tour for new users)

New visitors had no guidance on how to read the site (especially the dense `/economy` page). Added a lightweight guided tour built on driver.js.

- **New `src/onboarding/`**: `tours.js` (definitions — a site-wide intro anchored to the nav + a per-page `/economy` tour), `useOnboarding.js` (runner + auto-show logic), `tour-theme.css` (popover theme matching the design tokens — rust Next button, card surface).
- **Auto-show, once each**: the site intro plays on a visitor's first ever load; each page tour plays once per page. Gated by versioned `localStorage` keys (`gp_tour_v1_*`); never chains two tours in one navigation; waits for the anchor element to exist before starting (handles async data). Steps whose anchor is missing are dropped, so a tour never points at nothing.
- **Persistent "?" trigger** in the nav (`Layout.jsx`) replays the current page's tour on demand, ignoring the seen-flag.
- **Bundle-conscious**: driver.js (~25kb) + its CSS are lazy-loaded on first tour run into their own chunk, keeping them out of the main bundle for the majority of views that never start a tour.

Files: `src/onboarding/tours.js` + `useOnboarding.js` + `tour-theme.css` (new), `components/Layout.jsx` + `Layout.css`, `ARCHITECTURE.md`, `package.json` (driver.js dep), `docs/` build.

## 2026-06-02 (/economy: deterministic display gate for FX direction + unbacked analogs)

Two LLM-produced signals on the economic-disruption data were rendering as analyst-grade fact when they shouldn't: FX rows labelled `USD/XXX` whose stored `direction` follows **no consistent quoting convention** across rows (so the arrow was wrong ~1/3 of the time), and `historicalAnalog` realized-move "outcomes" shown even when the named event isn't in our curated catalog (~26% unbacked). Added a pure, no-LLM gate that either produces a trustworthy relabelled signal or suppresses it — never invents a value.

- **New `utils/disruptionGate.js`.** FX: relabels the chip to the foreign currency (`USD/CAD` → `CAD`), derives direction from the rationale's polarity verb nearest the named currency (weaken/pressure→down, strengthen/support→up; inverts when the verb describes USD), and suppresses the arrow when undetectable/conflicting. Analog: resolves the event via `findAnalogEvent`; suppresses the realized-move block (with an honest "not in verified catalog" note) when unbacked.
- **Wired into all three render surfaces:** `EconomyPage` leaderboard (relabel + consensus re-tallied from gated per-story directions) and lean story list; `InstrumentChip` (thread Economy tab); `MechanismCard` analog block.
- **Proof:** `scripts/test-disruption-gate.mjs` over a live ECONOMIC_IMPACT scan — 15 FX rows: 5 had the WRONG raw direction and were flipped (all verified against rationale text), 2 suppressed; 11/43 analogs (26%) gated.
- Also demotes the /economy expand-panel mechanism + closest-analog columns to each story's thread Economy tab (lean row = severity · headline · direction).

Files: `global-perspectives-starter/frontend/src/utils/disruptionGate.js` (new), `scripts/test-disruption-gate.mjs` + `scripts/json-as-module-loader.mjs` (new), `components/EconomyPage.jsx` + `.css`, `components/atoms/InstrumentChip.jsx`, `components/atoms/MechanismCard.jsx`, `components/atoms/atoms.css`, `docs/` build.

## 2026-06-02 (prediction calibration / track record — full 3-phase pipeline)

Built forecast accountability end-to-end: every published prediction is logged with dated, falsifiable triggers, scored as deadlines pass, and surfaced publicly at `/track-record` with a running Brier score + calibration. Hybrid resolution (LLM proposes, human confirms). See `ARCHITECTURE.md` → "Prediction calibration / track record".

- **New table `GlobalPerspectivePredictionLog`** (ap-northeast-1, PAY_PER_REQUEST, no TTL — immutable). PK `PRED#{topicId}` / SK `YYYY-MM-DD` daily snapshot.
- **Phase 1 — capture.** `NewsProjectInvokeAgentLambda` now writes a snapshot whenever it generates a `prediction` (scenarios → numeric probability midpoint + dated triggers parsed from trigger text). Wrapped in try/catch — never throws into the content pipeline. Deployed + verified (1 snapshot, 9 dated triggers).
- **Phase 2 — resolve (hybrid).** New `newsPredictionResolver` Lambda (daily cron `TriggerPredictionResolver` 09:00 UTC) proposes fired/not_fired/unclear verdicts grounded in Brave Search; honest `unclear` rather than guessing. Human confirms via `node predictions/review.js` (interactive / `--list` / `--accept-all`) — no public auth surface. Roundtrip verified.
- **Phase 3 — score + surface.** New `prediction_track_record` proxy action computes totals, Brier score (mean (p−outcome)² per resolved trigger, `unclear` excluded), calibration buckets, recent resolved list. New `/track-record` route (`TrackRecordPage.jsx` + `useTrackRecord`) renders it with an **honest empty state** — no fabricated score until human-confirmed verdicts exist. Nav + footer links added.

Files: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`, `amplify/backend/function/newsPredictionResolver/src/index.js` (new), `predictions/review.js` (new), `amplify/backend/function/newsSensitiveData/src/index.js`, frontend `services/restProxy.js`, `hooks/useTrackRecord.js` (new), `components/TrackRecordPage.jsx` + `.css` (new), `App.jsx`, `Layout.jsx`, `ARCHITECTURE.md`, `docs/` build. Infra (table, Lambda, cron, env vars) via AWS CLI.

## 2026-06-01 (billing teardown: removed newsStripeWebhook + tier/portal code from the proxy)

Completed the backend subscription/billing teardown deferred on 2026-05-26. The frontend billing UI and static-page copy were already removed; this removes the dormant backend. Subscriptions are deprecated and not returning — see `project-billing-deprecated`.

- **Deleted `newsStripeWebhook`.** Backed up the deployed code, then deleted the Lambda, its **public Function URL** (`…tu2abnue3kefs2lkeczezoez3m0fzztr.lambda-url…`; it used a Function URL, never API Gateway; 0 invocations in 30 days), its IAM role `newsStripeWebhook-role-kercpkn5`, and the orphaned per-function exec policy. (Detached the shared `AmazonDynamoDBFullAccess` before role deletion — did not delete that shared managed policy.) Source kept in-repo for reference.
- **Stripped billing code from `newsSensitiveData`.** Removed `resolveUserTier()`, the `user_profile` + `portal_session` actions, the dead `resolveTier()`, and the unused `MEMBER_API_KEYS`/`ENTERPRISE_API_KEYS`/`MEMBER_MAX_DAYS`/`USERS_TABLE`/`PADDLE_API_KEY`/`PADDLE_PORTAL_BASE`/`LOOPS_API_KEY` consts. Kept the generic `verifyFirebaseToken`/`getGoogleCerts`/`FIREBASE_PROJECT_ID` helpers (still used by `newsSavedItems`) and `ENTERPRISE_MAX_DAYS` (live archive cap). `node --check` clean.
- **Redeployed + verified.** `newsSensitiveData-dev` updated via CLI; `topics` test invoke returns fresh data.
- **Optional leftover (not done):** drop `tier`/`paddleCustomerId`/`paddleSubscriptionId` attributes from `USERS_TABLE` records — dormant, no urgency.

Files (no frontend build — backend Lambda + docs): `amplify/backend/function/newsSensitiveData/src/index.js`, `ARCHITECTURE.md`, `BACKEND_TODO.md`. Infra changes via AWS CLI.

## 2026-06-01 (stale-pipeline fix: DeepSeek JSON truncation in newsInvokeGemini)

Fixed the live content stall that `newsFreshnessMonitor` surfaced — content had been frozen since 2026-05-31T20:01 UTC.

- **Root cause.** `newsInvokeGemini-dev` was throwing `Failed to parse JSON from model output` on **every** run since 2026-06-01T00:00 UTC. DeepSeek's `{"topics":[…]}` responses grew past the `max_tokens: 8000` ceiling (`json_object` mode), so the output was truncated mid-object and all four `extractJson` branches failed. The throw is caught and logged, so CloudWatch's Errors metric stayed at 0 — the function looked healthy while silently producing nothing (the exact blind spot the freshness monitor exists to cover). Diagnostic on the recovered run: `finish_reason: stop, completion_tokens: 7830` — output sits right at the cap.
- **Fix (deployed via AWS CLI).** Raised `max_tokens` 8000 → 8192 (model ceiling) for headroom; added `salvageTruncatedTopics()` as a last-resort branch in `extractJson` that walks the `topics` array and recovers every fully-closed object up to the truncation point instead of discarding the whole batch (only runs after the existing branches fail, so the healthy path is unchanged); added `finish_reason`/`completion_tokens`/char-length logging so a future truncation is diagnosable at a glance.
- **Verified.** Manual invoke → 14 topics, fresh `updatedAt`; public proxy `asOf` advanced to 2026-06-01T09:48, `stale: false`; agent Lambda promoted + enriched it server-side.
- **Monitor retune.** Bumped `newsFreshnessMonitor`'s `STALE_HOURS` 5 → 9 (env var, via CLI) — the content pipeline runs every ~4h, so 5h tolerated only ~1 missed cycle (false-positive risk); 9h tolerates ~2. Docs (`BUG_PLAYBOOK.md`, `ARCHITECTURE.md`) updated to match.

Files (no frontend build — backend Lambda + docs): `amplify/backend/function/newsInvokeGemini/src/index.js`, `BUG_PLAYBOOK.md`, `ARCHITECTURE.md`.

## 2026-06-01 (passive 24/7 monitoring: freshness dead-man's-switch + client-error digest + dependabot)

Added the always-on, push-alert complement to the on-demand bug checks. The four `scripts/` checks only run when a human runs them, so a scheduled stall (pipeline dies overnight) or a transient outage is their blind spot. These monitors watch continuously and alert via one SNS topic `GlobalPerspectiveAlerts` → email. All free-tier; no CI added (per solo-dev constraint).

- **`newsFreshnessMonitor` (data-freshness dead-man's-switch).** New Lambda (ap-northeast-1, nodejs24.x, 128MB) invoked by EventBridge `TriggerFreshnessMonitor` every 2h at :30. Hits the public proxy `?action=topics`, reads `asOf`, and alerts if content is older than `STALE_HOURS`=5 **or** the proxy is unreachable/timestampless (doubles as a read-path uptime check). Catches the #1 silent failure for a news site — pipeline stalls, site quietly serves stale content. Role `newsFreshnessMonitor-role` (sns:Publish only). **Found a live stall on first run: content was 9.5h stale.**
- **`newsErrorDigest` (alerting/triage over the client-error sink).** New Lambda invoked by EventBridge `TriggerErrorDigest` every 6h. Scans `GlobalPerspectiveClientErrors`, folds to per-fingerprint totals, diffs vs the prior run (one `DIGEST#STATE` row), and alerts ONLY on new/spiking (Δ ≥ `SPIKE_MIN_DELTA`=5) fingerprints — first run just baselines, known errors never re-alert (no fatigue). Turns the sink's capture into a push alert without a paid Sentry. Role `newsErrorDigest-role` (sns:Publish + dynamodb Scan/Get/Put on the errors table).
- **`GlobalPerspectiveAlerts` SNS topic** + email subscription (benlai310@gmail.com) — **pending the one-time confirmation click** AWS emailed.
- **`.github/dependabot.yml`** — weekly grouped npm version-update PRs for frontend + cli (a repo setting, not CI). The security-alert half is a repo toggle the operator enables once (documented).
- **Honest-failure policy applied:** monitors only ever alert on a real problem; no fake "all clear".
- **Docs:** new "Passive monitoring (24/7)" section in `BUG_PLAYBOOK.md` covering both deployed monitors and the 3 external setups that need the operator's own account (UptimeRobot, Google Search Console, Dependabot alerts toggle; optional Cloudflare Web Analytics).

Files (no frontend build — backend infra + docs): `amplify/backend/function/newsFreshnessMonitor/src/`, `amplify/backend/function/newsErrorDigest/src/`, `.github/dependabot.yml`, `BUG_PLAYBOOK.md`. Infra deployed via AWS CLI (2 Lambdas, 2 IAM roles, 2 EventBridge rules, 1 SNS topic).

## 2026-06-01 (render-crash containment: real error boundary → client-error sink, NO fallback UI)

Turned the passive client-error sink from "captures `window.error`/`unhandledrejection` only" into "also captures React render crashes" — and made render crashes degrade gracefully instead of white-screening the whole app.

- **Root problem.** The app's `ErrorBoundary` was a *function* component (React function components physically cannot catch render errors — only class components with `getDerivedStateFromError`/`componentDidCatch` can) and it wasn't mounted anywhere. Any component that threw during render unmounted the whole tree → blank white page, and React swallows render throws before they reach `window.error`, so the sink never saw them. Render crashes were completely invisible.
- **Real class boundary.** Rewrote `components/ErrorHandling.jsx` `ErrorBoundary` as a class component and mounted it around `<Routes>` in `App.jsx`, so a crash is contained to the routed content area while the nav/chrome outside it survives. `componentDidCatch` reports via a new `reportBoundaryError` export in `services/errorSink.js` (a working boundary swallows the throw, so this is the ONLY path a render crash reaches the sink → `newsClientErrors` Lambda → DynamoDB).
- **NO fallback UI — deliberate.** The boundary renders `null` on a caught crash; it does **not** show a "something went wrong" card. On an intelligence site a generic fallback reads as real content/state — a reader can't distinguish a *broken* render from an *intentionally-empty* one, so a friendly card is **misinformation**. The boundary's only jobs are to contain the crash and report it.
- **`/__boom` test route + automated regression leg.** Added a dev/test `/__boom` route (throws on render) and a permanent **ERROR BOUNDARY** leg in `scripts/smoke-test.mjs`: it navigates to `/__boom`, asserts the persistent nav (`.gp-nav`) survived (crash contained, not a full white-screen), and on prod asserts a sink report POST fired (intercepted + aborted so the test never writes to DynamoDB). New **class 8** documented in `BUG_PLAYBOOK.md`.
- **Verified.** Local smoke-test green (crash contained, no fallback card, no white screen). Prod reporting path verified post-deploy via `node scripts/errors.mjs`.

Files: `global-perspectives-starter/frontend/src/components/ErrorHandling.jsx`, `App.jsx`, `services/errorSink.js`, `scripts/smoke-test.mjs`, `BUG_PLAYBOOK.md`, `docs/` (build).

## 2026-06-01 (smoke-test: general class-7 guard — VISUAL PAINT leg)

Added a second, *general* class-7 detector to `scripts/smoke-test.mjs`, complementing the page-specific MAP LAYER RENDER leg.

- **New VISUAL PAINT leg.** For each route (desktop, reusing the existing settled-page navigation — no extra passes) it grid-samples the key content region and asserts a minimum fraction of points land on real rendered content (text / img / svg / colored bg) vs bare background. A region that silently collapses to blank drops toward 0% and trips `SILENT-EMPTY`. Unlike the MAP LAYER leg (which only knows about Pulse `.today-ring` + Connections `.flow`), this catches *any* region going blank without needing a per-view child selector to count.
- **Why not pixel-diff visual regression.** A `toHaveScreenshot()` baseline would false-positive on every run as headlines churn, rot, and get ignored. Paint-coverage is robust to content churn (different headlines → similar ink) and keeps no baseline image, so it can't rot on a live-data site.
- **Calibrated against prod (2026-06-01).** Healthy regions paint 19–96% (Daily footprint lowest at 19%, CountryList card highest at 96%); `PAINT_MIN=0.06` sits 3× below the floor with churn margin. `/weekly` opts out via `skipPaint` (its empty-state is a legit class-6 condition, not data-present-but-blank). Negative test confirmed teeth: gutting `.ep-row-l1` dropped it 37.7% → 0% → CAUGHT.
- **Final full sweep ran green** before this change: auth-guard 7/7, contract 7/7, link-crawl 184/184 (0 dead), smoke-test all checks healthy. After adding this leg: **ALL 35 CHECKS HEALTHY**.

Files: `scripts/smoke-test.mjs`, `BUG_PLAYBOOK.md`.

## 2026-05-31 (/map urgency halo: same silent-empty-render bug, 2nd instance + BUG_PLAYBOOK class 7)

Follow-up to the Pulse/Connections fix earlier today. Generalized the root cause into a new bug class and found a second live instance of it.

- **New bug class — `BUG_PLAYBOOK.md` Class 7 "Silent empty render (mis-keyed / over-aggressive client filter)".** A data-backed toggleable view renders zero items even though data is present, because a client filter reads a per-item field the payload doesn't carry (topics have no per-item `timestamp`, only batch `updatedAt`) or hard-drops windowed data. Invisible to classes 4/6 + the page-level health checks — the *page* is fine, only the *view* is empty. Added to the class list, the loop contract (detect/green/if-red/scope, receipt `d9b26ae`), exploratory step 9, and bumped the loop from six→seven contracts.
- **2nd instance fixed — `WorldMapV2.jsx:596` urgency halo.** `ts` defaulted to `0`, so `now - 0 > 24h` was always true → no halo ever rendered. Same fix as the Pulse path: fall back to the batch `updatedAt` (via a new `topicsUpdatedAtRef` so the imperative `drawMap` can read it). Found by grepping the whole frontend for the smell after recording the class.

Files: `BUG_PLAYBOOK.md`, `global-perspectives-starter/frontend/src/components/WorldMapV2.jsx`, `docs/` (build → `index-KyQnq70L.js`).

- **Class 7 now auto-detected (2026-06-01).** Added a **MAP LAYER RENDER** leg to `scripts/smoke-test.mjs`: loads `/map`, toggles each data-backed layer, and asserts it draws >0 SVG elements (Pulse `.today-ring`, Connections `.flow` — topics + pairs are reliably present on prod). Economy/Editorial deliberately not asserted (can be legit-empty → that's class 6). Validated against prod: `pulse:12, connections:6`. With the pre-fix bundle Pulse would be 0 → `SILENT-EMPTY` → FAIL, so it catches the regression. Playbook + script header + bug-loop memory updated to reflect class 7 is now machine-checked. Files: `scripts/smoke-test.mjs`, `BUG_PLAYBOOK.md`.

## 2026-05-31 (/map WorldMapV2: fix Connections near-empty + Pulse never-showing — frontend)

Two data-driven map bugs, both confirmed against live production data (not assumptions):

- **Pulse layer showed nothing.** `todaySignal` counted topics within a rolling 24h window using `t.timestamp`, but topics carry **no per-item timestamp** — so the value was always `0`, every topic was filtered out, and zero rings drew. Fix: fall back to the **batch-level `updatedAt`** from `useGeminiTopics()` (the topics batch refreshes every 2h, so it's reliably within 24h). `WorldMapV2.jsx` — wired `updatedAt: topicsUpdatedAt`, added `batchMs` fallback, added it to the `todaySignal` deps.
- **Connections layer showed ≤1 arc.** `realFlows` hard-`continue`d any pair whose `generatedAt` was outside the time window; 6 of 7 live pairs were ~43d old, so the 30d window dropped them all. Fix: stop dropping — push **all** resolvable pairs, tag out-of-window ones as `stale`, and render them **faded (×0.45 opacity) + dashed**. Active in-window arcs render solid/weighted as before.
- **Rail polish:** the "30 days" count read total pair count (misleading 7); now counts pairs actually refreshed within 30d. Added a note: "Count = relationships refreshed in this window. Older ones still show, faded." Empty-state text updated ("No pair relationships available yet").

Note: changes verified by lint (0 errors) + build; **not** browser-clicked (no browser-automation tooling in session) — confirm Connections arcs + Pulse rings on the live site. Backend durability (scheduling `newsPairIntelligence` so pairs stay fresh) is a separate LLM-cost step, not done here. Files: `global-perspectives-starter/frontend/src/components/WorldMapV2.jsx`, `docs/` (build).

## 2026-05-30 (passive error monitoring: roll-your-own client-error sink — BUILT, DEPLOYED, LIVE)

Stood up a passive error-monitoring layer (no paid Sentry) — the complement to the active `BUG_PLAYBOOK.md` checks. Those six contracts detect bug classes we already know; a contract only exists once a bug has shipped, so this sink catches the **novel** uncaught errors first.

- **Frontend catcher — `src/services/errorSink.js`** (wired in `main.jsx` via `installErrorSink()`). Listens for window `error` + `unhandledrejection`, then fire-and-forget `fetch` POSTs `{kind,message,stack,url,userAgent,timestamp}` with `keepalive:true`. Self-protections so a reporter never makes things worse: in-session dedup, 20-send/session cap, never throws, no-ops when the endpoint is unset.
- **Lambda `newsClientErrors` + public Function URL** (ap-northeast-1, nodejs24.x, 128MB). AuthType NONE (errors come from anonymous visitors), CORS limited to the two site origins, POST only. Abuse-bounded: 16KB body cap → 413, per-field length caps. Source: `amplify/backend/function/newsClientErrors/src/`.
- **DynamoDB `GlobalPerspectiveClientErrors`** (PAY_PER_REQUEST, TTL 30d). Counter design: identical errors `ADD count` into one row keyed `day#fingerprint` (sha1 of message + first stack frame, volatile bits normalized out), so a flood collapses to one row + a sample. Least-privilege IAM role (`dynamodb:UpdateItem` on the one table).
- **Read-back — `scripts/errors.mjs`** (`--days N`, `--raw`). Scans the table via the AWS CLI (no SDK dep), folds rows by fingerprint, sorts by count, and de-minifies the top stack frame against the local source map.
- **Private source maps — `vite.config.js` `build.sourcemap:'hidden'`.** Maps emit into gitignored `dist/` with NO `sourceMappingURL` comment in the bundle (never exposed publicly); `source-map` added as a script-only devDependency. **Deploy now strips `docs/assets/*.map`** after the asset copy (documented in `CLAUDE.md`) so maps never ship.
- **`docs/config.js`** — added `window.CLIENT_ERRORS_ENDPOINT` (surgical one-line add; all existing runtime config preserved).

Verified end-to-end against the live Function URL: valid POST → 202; duplicate → same row `count 2×`; oversize → 413; `errors.mjs` read it back and de-minified. Files: `src/services/errorSink.js`, `src/main.jsx`, `vite.config.js`, `docs/` (build), `docs/config.js`, `amplify/backend/function/newsClientErrors/src/`, `scripts/errors.mjs`, `BUG_PLAYBOOK.md`, `CLAUDE.md`.

---

## 2026-05-30 (loop run: all six bug-class contracts green; fixed stale test scaffolding)

First full run of the bug-fighting loop (all six `BUG_PLAYBOOK.md` contracts). Five passed immediately; the unit-test contract (class 6) was red — all from **stale/incomplete test scaffolding**, not product bugs. Fixed so the loop reports green honestly:

- **`economyPage.test.jsx`** — `getByText(/Repricing today/i)` matched *two* nodes after the "Today in the economy" briefing prose started containing that phrase (alongside the `<h2>` section header). Tightened to `getByRole('heading', { name: /Repricing today/i })`.
- **`vite.config.js`** — vitest's default glob was picking up the Playwright `e2e/` spec (which errors on Playwright-only globals). Added `test.exclude` for `e2e/**` (Playwright specs run under Playwright, not vitest).
- **Three map-test d3 mocks** (`layers`, `searchBar`, `signalFilters`) — the mocked projection only exposed `fitSize` *after* `.translate().scale()`, but `WorldMapV2` calls `projection.fitSize(...)` directly; `geoCentroid`/`geoGraticule10` weren't mocked at all. This leaked 16 unhandled rejections that flipped the vitest exit code to 1 despite all assertions passing. Replaced with a self-chaining projection stub + the two missing functions.

Final loop state: class 1 (link-crawl 180/180 HEALTHY + smoke economy-links 37/37), class 2 (auth-guard PASS), class 3 (404 parity + deep-link PASS), class 4 (contract-check 7/7), class 5 (smoke axe — 33 checks healthy), class 6 (vitest 178/178, exit 0). Test-only changes — no product code, no build/deploy.

---

## 2026-05-30 (bug playbook: loop contract + two new checks for the remaining bug classes)

Extended `BUG_PLAYBOOK.md` into a **loop-runnable spec** and closed the two gaps so a fix-until-green loop has a runnable check for all six bug classes.

- **`BUG_PLAYBOOK.md` — "The loop contract" section.** Each of the six bug classes now has a closed, machine-checkable contract: *detect command → green criterion → if-red action → scope*, plus loop guardrails (no deploy/commit without confirmation, never touch `docs/config.js`, etc.) and a stopping condition. Each class is tied to a real commit receipt — a class earns a contract only once this repo has actually shipped that bug.
- **New — `scripts/auth-guard-check.mjs` (class 2).** A regression tripwire: greps an allowlist of 7 public-content hooks (`useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence`, `useDailyBrief`, `useGeminiTopics`, `useMarketsGlobal`, `useMarketsCountry`) for an `if (!user) return` early-bail and fails if any creep in. Three times a leftover guard has shipped and blocked anonymous/incognito visitors from public content (receipts: `94e9b29`, `e3e2875`, `b430159`). `useSavedItems` is deliberately **off** the allowlist — saving genuinely needs auth. Verified the regex fires on a real guard. Result: PASS (all clean).
- **New — `scripts/contract-check.mjs` (class 4).** Zod schemas for 7 key proxy actions (`topics`, `markets_global`, `economic_impact_list`, `daily_brief`, `narrative_thread`, `thread_analysis`, `country_intelligence`), validated against the **live backend**. Schemas encode only the fields the frontend reads, lenient about extra fields. Catches the `b0f84bc` failure mode (a numeric field arriving as a string → NaN% in the UI) — verified by negative test. `daily_brief`'s `data: null` empty state is allowed, not failed. `zod` added as a **script-only devDependency** (never imported by `src/`, so zero bundle weight). Result: PASS (7/7).

These are tooling-only changes (`scripts/` + a devDependency + docs) — no frontend build/deploy required.

---

## 2026-05-30 (bug hunt: site-wide link-integrity crawl finds /daily dead link; fix + playbook)

After fixing the `/economy` dangling-reference bug, ran a **site-wide link-integrity crawl** to check whether other pages share the same class of bug. They mostly don't — 179 of 180 linked destinations were healthy — but the crawl found **one more dead link**: the `/daily` "Rising Thread" deep-link.

- **Root cause (backend).** The daily-brief generator (`newsPostDevTo`) asks the LLM for `risingThread.threadId`, but the prompt never showed it real thread IDs — so the model echoed the thread **title** into the `threadId` field. ThreadPage then looked that up by id and dead-ended at "Story arc not found" (e.g. `/weekly/thread/Ebola%20Outbreak%20Escalates...`). **Fixes:**
  - *Backend:* the arc block now includes `threadId=…`, and after parsing the brief we **deterministically resolve** `risingThread.threadId` by matching the rising thread's title against the loaded thread analyses (`resolveRealThreadId`), setting `null` when there's no confident match. File: `amplify/backend/function/newsPostDevTo/src/index.js`. *(Deploy via AWS CLI `update-function-code`; brief regenerates daily at 23:00 UTC.)*
  - *Frontend guard (ships now, fixes existing bad records immediately):* `DailyPage` only renders the thread link when `threadId` matches `/^thread-/`; otherwise it links to `/weekly`, so a malformed/legacy `threadId` can never dead-end. File: `global-perspectives-starter/frontend/src/components/DailyPage.jsx`.
- **New automated check — `scripts/link-crawl.mjs`.** A standalone Playwright **site-wide link-integrity crawler**: from every hub page it collects all internal links, visits each, and classifies HEALTHY / DEGRADED / DEAD from the rendered DOM (the standard SPA-aware approach — HTTP status is meaningless behind the 404.html fallback). This is the generalized defense against the dangling-reference class on *any* page, not just the one route the smoke-test samples. It is what found this bug.
- **New — `BUG_PLAYBOOK.md`.** A research-grounded bug-fighting playbook: the bug classes we keep hitting, the two automated checks, an ordered run-on-demand checklist, and a project-tailored ROI ranking of techniques (with what we deliberately skip and why).

---

## 2026-05-30 (fix: /economy story-arc links dead-ending — durable by-ID thread pages + automated guard)

The `/economy` page links each "economic disruption" to its story arc at `/weekly/thread/:threadId`. Many of those threads are older than the **30-day rolling archive** that `ThreadPage` used to scan, so ~11 of 36 economy links dead-ended at "Story arc not found." A degraded fallback was shipped earlier (`90b5482`), but the right fix is a durable permalink: serve the detail page by fetching the entity by ID, never by re-scanning a rolling feed (how every permalink-based platform handles this).

- **Permalink fix.** `ThreadPage` now builds its timeline from the **durable 90-day `narrative_thread`** endpoint (by-ID server-side reconstruction over the archive), not the 30-day `useWeeklyArchive`. The weekly archive is demoted to powering only the related-threads sidebar (best-effort, non-load-bearing). Confirmed against production: aged-out economy threads now return full 5–9-entry timelines spanning back to mid-April. New hook `src/hooks/useNarrativeThread.js` (sessionStorage cache, 30-min TTL). Files: `ThreadPage.jsx`, `useNarrativeThread.js` (new). `fetchNarrativeThread` already existed in `restProxy.js`; no backend change (the `narrative_thread` action was already deployed). A loading gate (`threadLoading`, plus an `analysisLoading || economicLoading` guard) prevents a premature "not found" flash; beyond the 90-day window the page still falls back to the analysis/economic record, then to the dead-end as a last resort.
- **Automated regression guard.** `scripts/smoke-test.mjs` gained an **ECONOMY STORY-LINK INTEGRITY** check: it scrapes every `/weekly/thread/*` link off `/economy` (deduped, capped at 20) and asserts each opens the **full** thread page (`.tp-content-tabs`, which renders only on the full path — after both the dead-end and the aged-out fallback return early), never the dead-end and never the aged-out fallback. Folded into the exit code so the playbook fails if economy deep-links rot again.

---

## 2026-05-30 (a11y: clear /economy nested-interactive + CountryList aria-command-name)

Two serious (non-blocking) a11y items the health-check playbook had been reporting.

- **`/economy` `nested-interactive` (20 nodes).** Each leaderboard row was a `role="button"` div that *contained* a real `<button>` (the instrument-name filter) — a button nested inside a button. **Fix:** the row is now a plain `<div>` (mouse-click still toggles, as a convenience), and the chevron `›` was promoted to the real disclosure `<button>` carrying `aria-expanded` + an accessible label. The instrument-name filter button is now a sibling, not a child, of any interactive role — no more nesting, and keyboard users get a proper focusable expand control. Files: `EconomyPage.jsx`, `EconomyPage.css`.
- **`/weekly/countries` `aria-command-name` (66 nodes).** The Google Maps risk markers are clickable (`role="button"`) but had no accessible name. **Fix:** gave each marker a `title` (`"<country> — <n> articles[, <risk> risk]"`), which Google surfaces as the marker's accessible name. File: `CountryOverviewMap.jsx`.

---

## 2026-05-30 (fix: dated daily briefs blank for anonymous visitors + /weekly/country select a11y critical)

Two issues surfaced by the page health-check playbook (`scripts/smoke-test.mjs`).

- **`/daily/:dateKey` rendered "No brief available" for signed-out visitors** even when the brief existed. Root cause: `useDailyBrief` had a leftover `if (!isToday && !user && !import.meta.env.DEV) return;` guard that bailed out of the fetch for any non-today date when no user was signed in — the same `!user` anti-pattern that was removed from the other public hooks on 2026-04-22. The backend `daily_brief` action is fully public (verified: `2026-05-29` returns a brief anonymously), so the guard was pure dead weight that blanked dated briefs for the anonymous majority. **Fix:** removed the guard (and the now-unused `useAuth`/`user`/`isToday` references). File: `global-perspectives-starter/frontend/src/hooks/useDailyBrief.js`. (Today's brief still legitimately shows the empty state until it generates at 23:00 UTC.)
- **`/weekly/country/:name` accessibility — critical `select-name`.** The country-switcher `<select>` in the map hero had no accessible name. **Fix:** added `aria-label="Select country"`. File: `global-perspectives-starter/frontend/src/components/CountryPage.jsx`.

---

## 2026-05-30 (fix: nested-route deep-link blank page + /economy a11y critical; add page health-check)

Found via a new automated page health-check playbook (`scripts/smoke-test.mjs`) run against live production.

- **Nested deep-links rendered blank (`/weekly/countries`, `/weekly/thread/:id`, `/weekly/country/:name`, `/daily/:dateKey`).** Root cause: Vite `base: './'` emitted **relative** asset URLs (`./assets/index-*.js`), which on a nested deep-link/refresh resolved against the path directory (e.g. `/weekly/thread/assets/…`) → 404 on the bundle → blank. This was separate from (and survived) the earlier 404.html fix, which only covered shallow routes. **Fix:** set `base: '/'` (absolute) so hashed bundles resolve at any route depth. Safe because the `*.github.io/globalPerspective-v1/` subpath 301-redirects to the custom domain, and `resolveBasename()` (BrowserRouter basename) is independent of the asset base. Verified locally: no more `404 script/stylesheet` on nested routes. File: `global-perspectives-starter/frontend/vite.config.js`.
- **`/economy` accessibility — critical `aria-required-parent`.** The `.ep-lb-head` column-label row carried `role="row"` + `role="columnheader"`, but the leaderboard body rows are `role="button"` (an expander list, not an ARIA grid), so the row was orphaned. **Fix:** removed the table/grid roles + `aria-sort` from the header; sort state is still conveyed to assistive tech via the existing `aria-live` "Sorted by …" region and the visual sort caret, and the header sort buttons gained `aria-pressed`. File: `global-perspectives-starter/frontend/src/components/EconomyPage.jsx`.
- **New: `scripts/smoke-test.mjs`** — a standalone Playwright health-check for every route (desktop + mobile): loads + console-clean, deep-link refresh (the 404.html SPA-fallback path), real-data content render, network (404 on script/stylesheet = critical; document-404 is the expected GH Pages fallback, not a failure), axe-core a11y (gates on `critical`; `serious`/`color-contrast` reported as non-blocking debt), and a garbage-content guard (NaN/undefined/Invalid Date/[object Object]). Writes a screenshot per route+viewport. Param routes auto-discovered from their listing pages. Added `axe-core` devDependency; screenshots dir gitignored.
- **Known remaining a11y debt (non-blocking, reported by the playbook):** site-wide `color-contrast` (worst: `/weekly` ~282 nodes) and `/economy` `nested-interactive` (the row is a button containing buttons — needs an interaction restructure, deferred).

---

## 2026-05-30 (fix: deep-link refresh blank page — sync 404.html to index.html)

Refreshing or deep-linking `/economy` (and any other route) rendered a blank page. **Root cause:** `docs/404.html` is the GitHub Pages SPA fallback (GitHub serves it for any path that isn't a real file; it must be a byte-for-byte copy of `index.html` so the React app boots and the router renders the requested route). But the deploy workflow only copied `dist/index.html → docs/index.html` and never updated `404.html` — so `404.html` kept pointing at an old content-hashed bundle (`index-BHgBA_dZ.js`) that later builds deleted. On a deep-link refresh, GitHub served `404.html` → it loaded a non-existent JS bundle → blank. `/economy` looked uniquely broken only because, while the old bundle still existed, the fallback booted a stale app version that predated the `/economy` route.

- Synced `docs/404.html` to the current `docs/index.html` (now references the live bundle `index-CM13gMRN.js`; the two files are identical).
- Baked `cp docs/index.html docs/404.html` into the deploy workflow in `CLAUDE.md` (+ `git add docs/404.html`) so the fallback is regenerated every deploy and can't drift again. This recurred once before (commit `32e0735`) because the workflow gap was never closed.
- **Defense in depth so it can't recur:** (1) added a `postbuild` npm script (`cp dist/index.html dist/404.html`) so `npm run build` always emits a matching `dist/404.html` automatically; (2) added a dedicated "Common Mistakes" entry + a Verification-Checklist line in `CLAUDE.md` (resync + `diff` must be empty before pushing).
- Files: `docs/404.html`, `CLAUDE.md`, `CHANGES.md`, `global-perspectives-starter/frontend/package.json`.

---

## 2026-05-30 (/economy UX overhaul: 3-phase industry-standard pass)

Three phases of UX work on `/economy`, planned in `ECONOMY_UX_PLAN.md`. Strategy (operator-aligned): **conform to industry conventions** for table-stakes interactions (Jakob's Law — users expect the same patterns they know from other markets dashboards), **differentiate** only on the news→economy linkage (briefing, "What's priced in" synthesis, trace-cause). Standards drawn from NN/g, GitLab Pajamas, Material, WAI-ARIA APG.

**Phase 1 — URL-synced filters + active-filter chips + sortable headers:**
- Filter/sort/open-drawer state now mirrors to the URL (`?sev=&hor=&instrument=&country=&sort=&dir=&open=`) via `useSearchParams`, replace-mode (clean history) with a `lastWritten` ref guarding the write/read effects against loops — so filtered views are **deep-linkable** and back/forward works.
- **Active-filter chip bar** above "Repricing today" (`.ep-chipbar`): a count badge, one removable chip per active facet (per-chip `×`), and a **Clear all** link. Mirrors the convention of surfacing applied filters above results.
- **Sortable column headers** (Instrument / Chg / Stories) as real `<button>`s inside `role="columnheader"` cells; `aria-sort` set only on the active column (omitted elsewhere per APG), with an `aria-live` region announcing the new sort. Default sort = citations-desc.

**Phase 2 — perceived-speed + freshness honesty + row affordance:**
- **Skeleton screens** replace spinners for the leaderboard (`.ep-skel-list`) and bridge cards (`.ep-skel-bridge`) — shimmer animation, with a `prefers-reduced-motion` guard.
- **Freshness pill** in the leaderboard meta: green "live" ≤3h, **amber** >3h, **red** >12h (stale data must *look* stale), with the `as of …` time-ago.
- Expandable rows are now real `role="button"` elements (Enter/Space to expand, `aria-expanded`, focus-visible outline); a funnel glyph (`.ep-name-fi`) reveals on hover/focus to signal the instrument name filters the story list.

**Phase 3 — mobile + a11y conversions:**
- Mobile (≤1024px): the left Filters rail is hidden and opens as a **bottom sheet** via a "Filters" trigger (with active-count badge); backdrop, sticky sheet header (× close) and sticky footer (Clear all / Show results). Drag-resize handle hidden on mobile.
- Country facet converted from `<label>`+checkbox to a `<button aria-pressed>` with a CSS checkbox box; dormant-drawer trigger converted from `<span onClick>` to `<button aria-expanded>`.

Browser-verified (standalone Playwright, live-data fixtures preseeded into localStorage): chip bar (count badge + per-chip `×` removal + Clear all), one `aria-sort` active at a time, keyboard Enter expands a row, sort/filter both sync to the URL, amber pill @5h + red pill @14h, and the mobile sheet opens/closes with working country `aria-pressed` toggle — 0 component console errors (only the known localhost-CORS proxy block). Lint 0 errors, build OK.
- Files: `EconomyPage.jsx`, `EconomyPage.css`, `ECONOMY_UX_PLAN.md`, `CHANGES.md`, `docs/` (built assets).

---

## 2026-05-30 (/economy: left Filters rail — drag-resize, scroll, country search)

The left-side **Filters** rail matched none of the polish the right rail just got: it was a fixed 220px column, couldn't be resized, never scrolled (nothing overflowed), and the Country facet was a hard-capped `slice(0,9)` with no way to find a country further down the list. Three fixes:
- **Drag-to-resize**, mirroring the Market Context rail but with the handle on the rail's RIGHT edge (`.ep-rail-lresize`, rust accent on hover); dragging right widens it (`w + (ev.clientX - x)`). Width bound through a parallel `--ep-lrail-w` on `.ep-shell` (col 1 now `var(--ep-lrail-w, 220px)`), clamped **200–420px**, persisted in `localStorage` (`ep-lrail-w`). Double-click resets to 220px.
- **Country search** (`.ep-csearch`): a search input now filters the full `countryFacets` list (the `slice(0,9)` cap is gone), with a "No match" message when nothing matches. The longer list lets the rail's existing `overflow-y:auto` actually scroll.
- Browser-verified (Playwright, proxy-mocked 22-country fixture): search → `Iran`, empty-state shows, rail overflows + scrolls (scrollHeight 1000 > clientHeight 630, scrollTop honored), drag 220→336 (cssvar tracks), double-click reset → 220, 0 console errors. Build OK, lint 0 errors.
- Files: `EconomyPage.jsx`, `EconomyPage.css`, `CHANGES.md`.

---

## 2026-05-29 (/economy briefing: story-led re-anchor)

After a 3-agent debate (recorded in `FUNCTION_DEBATE_OUTPUT.md`), re-anchored the "Today in the economy" lead briefing to mimic how real sell-side morning notes open. **Before:** it led with a severity COUNT ("N stories repricing — X severe…") then an instrument-citation cluster — page plumbing, and redundant with the leaderboard/right-rail directly below. **Now** the sentence order is:
- **S1 — the driver:** the dominant story (picker changed from *highest-severity, first-in-feed* → **most-cited-among-the-severe**, i.e. the severe story tied to the day's most-cited instrument) + the instruments it cites. Headline stays bolded → links to the thread Economy tab.
- **S2 — the tape:** real sector winners/losers from `markets.series` ("splitting along it — Brent down 1.6% while KOSPI leads, up 3.3%"); the up/down word is always taken from the realized change, so it can't contradict the data.
- **S3 — the divergence caveat** (consensus vs realized, kept separate).
- **trailing tag:** the severity count, demoted from lead to footnote.

Operator chose the **analyst-leaning** option: a direction-consistent rotation read is allowed even when the sector ETF isn't directly cited, but the non-negotiable core contract holds — no fabricated numbers, no forecasts, consensus-direction never blurred with the realized move. New eval assertion **(e)** bans forecast/prediction language (will/could/expect/rebound/next week…) outside quoted headlines.

Eval: all 5 fixtures pass the honesty contract under the new output (`verify_compose.mjs`), assertions self-test green incl. the new forecast case. Browser-verified live via proxy-mocked fixture — briefing renders, headline links correctly, 0 console errors.

- Files: `composeEconomyBriefing.js`, `quality/briefing/assertions.js`, `quality/briefing/targets/real-2026-05-29.md`, `FUNCTION_DEBATE_OUTPUT.md`, `CHANGES.md`.

---

## 2026-05-29 (/economy: drag-resizable Market Context rail)

The right-side **Market Context** rail was locked at 260px, truncating instrument names ("Techno…", "Semico…", "Health …"). Made it drag-resizable:
- A thin drag handle on the rail's left edge (`.ep-rail-resize`, rust accent on hover) lets the user widen/narrow the panel; the `.nm` column is `1fr`, so widening reveals full labels for free.
- Width is bound through `--ep-rail-w` on `.ep-shell` (`grid-template-columns: 220px minmax(0,1fr) var(--ep-rail-w, 260px)`), clamped **220–560px**, and persisted per-browser in `localStorage` (`ep-rail-w`). Double-click the handle resets to 260px. Mobile stacking unaffected (media query still forces single-column).
- Browser-verified (Playwright): 260→410 on drag, persists, max clamp 560, double-click reset to 260, 0 component errors. Build OK.
- Files: `EconomyPage.jsx`, `EconomyPage.css`, `CHANGES.md`.

---

## 2026-05-29 (/economy: consume quality-judge verdict + cap expanded story list)

Two optimizations from the post-build re-read:
- **Consume the quality judge** — `is_low_quality` / `qualityScores` are on every record (written by `newsEconomicQuality`) but `/economy` ignored them. Now: flagged stories show the existing `QualityFlag` ⚑ chip in the by-story bridge AND the expanded driving-stories sub-table (transparency, not hiding); and the briefing's **sharpest-story pick + the instrument analog pick now skip flagged records** (never headline a story the judge flagged unless nothing else exists). `storiesForInstrument` now carries the quality fields.
- **Cap the expanded driving-stories list** — a heavily-cited instrument (BRENT=27) dumped every row. Now sorted by severity and capped at 6 + a "Show N more stories" toggle. Verified: BRENT 6 → 27 on expand.

Eval re-run green (briefing 5/5, instrument-why 10/10, assertions self-test). Browser-verified: cap toggle works, ⚑ badges render (4 live), 0 console errors. lint clean, build OK.

- Files: `composeEconomyBriefing.js`, `EconomyPage.jsx`, `EconomyPage.css`, `PAGES_GUIDE.md`, `CHANGES.md`.

---

## 2026-05-29 (/economy per-instrument "Why it's moving" synthesis + SPT debate)

After a 3-agent debate (recorded in `FUNCTION_DEBATE_OUTPUT.md`) on whether `/economy` should adopt Home's Summary/Predict/Trace-Cause toolbar: **unanimous "kill Predict"** (a forward forecast violates the page's no-forecast contract), none endorsed full SPT, but all agreed the per-story "why" is thin. Decision: build a **cross-story, instrument-level** synthesis instead — the value the thread Economy tab structurally can't show.

- **New "Why it's moving" line** at the top of each expanded leaderboard drawer (`.ep-why`): a deterministic "What's priced in" readout — consensus split + lean strength + modal magnitude + the closest analog's *real realized move* ("history, not a forecast"). Pure fn `composeInstrumentWhy` in `composeEconomyBriefing.js`; no LLM, no forecast; doesn't duplicate the thread tab's per-story `MechanismCard`.
- **Honesty-checked** by `quality/briefing/verify_instrument_why.mjs` (every number traces to the mover's own counts; 10/10 movers pass).
- **Fixed a latent bug in the eval standard:** `assertions.js` check (a) now scrubs instrument tickers/names before number extraction, so digit-bearing names ("S&P 500", "Russell 2000", "US 10Y") aren't misread as fabricated data. Briefing verify + unit self-test still green.

Method: 3-agent debate → synthesis → build instrument-level synthesis → honesty-verified (10/10) → browser-verified (drawer renders, 0 console errors). lint clean, build OK.

- Files: `composeEconomyBriefing.js`, `EconomyPage.jsx`, `EconomyPage.css`, `quality/briefing/{assertions.js,verify_instrument_why.mjs}`, `FUNCTION_DEBATE_OUTPUT.md`, `PAGES_GUIDE.md`, `CHANGES.md`.

---

## 2026-05-29 (/economy "Today in the economy" briefing + markets series bugfix)

Added a synthesis **lead briefing** to `/economy`, closing the gap that made it the only major content page with no narrative entry point (Home/Daily lead with synthesis; Economy led straight into a leaderboard table). Built eval-driven — the standard came before the prompt.

- **New deterministic briefing band** under the masthead (`.ep-briefing-band`): one analyst-depth paragraph composed from data already on the page (`useTopMovers` / `useDisruptionsList` / `useMarketsGlobal`) — story count + severity split + most-cited cluster + sharpest story (links to its thread Economy tab) + sanitized realized moves with the **consensus-vs-realized divergence flagged**. NO LLM, NO fabrication.
- **Honesty contract enforced by an eval set** (`quality/briefing/`): frozen fixtures (1 real day + 4 edge cases), `assertions.js` (no fabricated numbers / stories resolve / severity counts match / sanitized series / divergence-aware directional check), human-ratified target briefings, and `verify_compose.mjs` which runs the **actual shipped compose function** through the assertions for every fixture (5/5 pass).
- **Markets `series` garbage-keys bug fixed + deployed** (`newsSensitiveData`): crypto `*_24h_change` fields were transposed into fake instruments yielding impossible day-over-day values (`ETH_24H_CHANGE -311%`). Now whitelisted to BTC/ETH + `|change| < 100` bound. Verified live (0 junk keys).

Method: eval set built + ratified (standard before optimizer) → compose verified against it (5/5) → browser-verified band renders with live data, story link works, 0 console errors. lint clean, build OK. Plan: `ECONOMY_BRIEFING_PLAN.md`.

- Files: `composeEconomyBriefing.js` (new), `EconomyPage.jsx`, `EconomyPage.css`, `quality/briefing/*` (new), `newsSensitiveData/src/index.js` (deployed), `PAGES_GUIDE.md`, `ECONOMY_BRIEFING_PLAN.md`, `CHANGES.md`.

---

## 2026-05-29 (/economy UX fixes + dead-link graceful fallback)

From live-user feedback on the `/economy` page:
- **Fixed leaderboard row overlap.** The day-over-day change pill was crammed into the price cell (110px) and overflowed into the "X stories" column ("−1.0%21 stories"). Gave the change its own grid column — `.ep-row-l1` is now `84/110/92/76/1fr/22` (Instrument · Signal · Last · Chg · Stories · chev), pill moved to `.ep-chg-cell`.
- **Added labeled column headers** (`.ep-lb-head`) to the leaderboard — `INSTRUMENT · SIGNAL · LAST · CHG · STORIES` — matching finance-watchlist convention (Yahoo/Bloomberg/FT). The numbers were previously unlabeled.
- **Clarified "Closest analog"** — added a caption + tooltip: "closest past event + what this instrument actually did then — history, not a forecast."
- **Fixed "Story arc not found" on driving-story clicks.** Verified ~32% (11/34) of driving-story links point to a `threadId` that has drifted/aged out of the 30-day archive → `ThreadPage` dead-ended. Now, when the archive thread is missing but we still hold its `thread_analysis`/`economic_impact` record, ThreadPage renders a **focused fallback** (title + "full timeline aged out" note + the `MechanismCard` + back-links) instead of "Story arc not found." Change is isolated to the `!thread` branch — the normal render path is byte-for-byte unchanged (verified).

Method: executor → independent review (GO; confirmed normal ThreadPage path untouched) → browser-verify (no overlap, headers aligned, stale thread → fallback not 404). lint clean, build OK, 178 tests (economyPage 7/7).

- Files: `EconomyPage.jsx`, `EconomyPage.css`, `ThreadPage.jsx`, `test/economyPage.test.jsx`, `CHANGES.md`.

---

## 2026-05-28 (Frontend page audit + country-page cold-500 fix)

**Audit:** browser-swept all 17 routes (Playwright). All render and are correctly wired — nav + footer links resolve, list→detail works (real `threadId`/country pulled from list pages), data hooks load, real params work; 0 console errors on 16/17; `/account`→sign-in and `NotFound` both correct. (PAGES_GUIDE still lists 4 dead routes — `/weekly-map`, `/intelligence-map`, `/cli`, `/upgrade/success` — noted, not yet pruned.)

**Fix — `/weekly/country/:name` cold-start 500s.** The page mounts ~13 hooks that each hit the proxy *simultaneously*, spinning up a burst of cold Lambda containers; a few returned HTTP 500 (recovered on retry, so the page rendered, but with error-flashes + first-load latency). Two-part fix:
- **Backend:** bumped `newsSensitiveData-dev` 128 → 512 MB (memory scales CPU → faster cold starts). Helped (cold 500s 6→4) but the burst was the dominant cause.
- **Frontend:** added a **concurrency limiter** to `restProxy.js` — `runLimited`/`limitedProxyFetch` caps in-flight proxy requests at `MAX_PROXY_CONCURRENCY = 4` (both `proxyAction` + `proxyActionWithAuth` route through it). The 13-call burst now runs in waves of ≤4; the first wave warms the function, later waves hit warm containers. Site-wide (benefits any data-heavy page), additive, drains on success AND error (no deadlock), preserves the 503-stale-topics + Lambda-envelope + pre-limiter token semantics; `savedItemsRequest` (different endpoint) left alone.
- **Verified (Playwright):** forced cold load of the country page → **0× 500** (was 4–6), `maxConcurrent` capped at 4, page fully renders. 5-page smoke (Home/economy/weekly/map/countries) all load clean, cap held, no hangs (a drain leak would have shrunk capacity across sequential loads — it didn't). lint clean, build OK, 177 tests, independent review GO. (The 2× `systems_analysis` 404 for most countries is expected — only ~2 have records — and graceful.)

- Files: `restProxy.js`, `CHANGES.md` (+ `newsSensitiveData-dev` memory config via CLI).

---

## 2026-05-27h (/economy leaderboard polish — synced from mockup refinements)

Mirrored four design refinements made to the `Economy.html` mockup onto the live React page (3 applied; #4 was a mockup-only CSS bugfix our build already excludes):
- **Expand containment** — the expanded panel (`.ep-expand`) now has `border-left: 3px solid var(--ink)` + a `--paper-2` tint, so each open row reads as visually belonging to the row above it.
- **"Stories:" label** — the row-2 direction split now reads "Stories: 22 ↑ · 3 ↓ · 1 ↔" (faint mono label), clarifying what the split counts.
- **Removed the redundant consensus float** — dropped the right-aligned "X% consensus" from each row; line 1's "X of Y agree" already conveys it. Row-2 grid simplified `84px 1fr auto → 84px 1fr`.
- (#4: the mockup's `.affected{}` unclosed-brace fix is mockup-only — our `ep-`-prefixed CSS builds clean.)

Verified: build OK, 177 tests (economy 6/6 — updated the consensus assertion to the new "agree"/"Stories:" reality), browser screenshot confirms (0 consensus floats, "Stories:" label, containment border). Frontend-only.

- Files: `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `CHANGES.md`.

---

## 2026-05-27g (Discovery check + PAGES_GUIDE /economy entry)

Investigated whether `/economy` has a discovery problem (the old wiring audit called it a near-orphan). **It doesn't** — verified via a CloudWatch action-count proxy on `newsSensitiveData-dev` (GA4 `G-VT6QENX4MB` is wired but not API-readable from here): over the last 7 days `/economy` is the **#2 content page** after Home, well ahead of Threads/Daily/Map/Countries (it's in nav + footer + the Daily "View all" link). So no discovery funnel was built — it would have solved a non-problem. The real lever is low site-wide traffic (growth/distribution), not economy-page wiring.

- **Docs:** added the missing `/economy` entry to `PAGES_GUIDE.md` (the audit flagged it had none) following the page schema, incl. the usage finding; corrected the orphan-check table (`/economy` is primary-nav, #2 page — not an orphan).
- No code change. Usage-measurement method recorded in memory (`reference_observability_usage`).

- Files: `PAGES_GUIDE.md`, `CHANGES.md`.

---

## 2026-05-27f (Analog realized-move join + economy doc catch-up)

**Feature — the differentiator cell.** In `/economy`'s expanded driving-stories sub-table, the "Closest analog" now shows the analog's **real historical realized move for that instrument** (e.g. BRENT · "Houthi Red Sea attacks (2024) → +5-8% on each escalation, retraced as Cape rerouting absorbed it"), not just the analog name.
- Bundled `economic_analogs.json` into the frontend (`src/data/economicAnalogs.json` + `.js` with `realizedMoveFor(event, year, instrumentId)`), a mirror of the canonical `newsEconomicImpact/src/economic_analogs.json` (sync note in-file). Join: normalize the story's `historicalAnalog.event` → catalog entry (year as tiebreaker) → `realizedMoves[instrumentId]`, rendered verbatim. Fallback chain: realized-move → `historicalAnalog.outcome` → "no close analog". **Never fabricated** — only verbatim catalog strings.
- The backend prompt already steers the LLM to use the catalog's exact event name+year, so the join hits on real records — **browser-verified: 17 of 26 analog cells matched live** (rest fall back gracefully). Frontend-only; no backend change.
- Verified: lint 0 new, build OK, 177 tests (economyPage 6/6, asserts the real "2019 Abqaiq → BRENT +15%" join), independent review GO, browser screenshot confirms.

**Docs — economy subsystem catch-up** (a doc audit found the concept doc + verification plan lagged the last 48h of rebuilds):
- `ARCHITECTURE.md`: `markets_global` row now documents the additive `series` map (spark + change vs yesterday).
- `ECONOMIC_DISRUPTION.md`: `/economy` surface-map row rebuilt to the current mockup page (was still describing the old EditorialShell page); added the **two-layer model**, the **watchlist rail + Yahoo `seed_history`** note, and corrected the stale "~55 instruments" allowlist description.
- Status banners added to the three spent plans (`ECONOMIC_DISRUPTION_PLAN` = SHIPPED/historical, `..._WIRING_PLAN` = partially shipped, `..._VIZ_PLAN` = partially shipped) so the canonical hierarchy is clear.
- Still open (lower priority): `PAGES_GUIDE.md` has no `/economy` entry; `ECONOMIC_VERIFICATION_PLAN` §9.1 checks the retired page.

- Files: `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `src/data/economicAnalogs.{json,js}`, `ARCHITECTURE.md`, `ECONOMIC_DISRUPTION.md`, `ECONOMIC_DISRUPTION_PLAN.md`, `ECONOMIC_DISRUPTION_WIRING_PLAN.md`, `ECONOMIC_DISRUPTION_VIZ_PLAN.md`, `CHANGES.md`.

---

## 2026-05-27e (Watchlist right rail: day-over-day % change + mini-sparklines)

Made `/economy`'s right-rail Market Context look like a stock-app watchlist — each row now shows a **mini price sparkline** + a **change vs yesterday** (green ▲ / red ▼ / muted →), and the same change % sits on the leaderboard rows next to the price.

- **Backend** (`markets_global`, additive): added a `series: { [INSTRUMENT_ID]: { spark:[≤20 closes], change:%vs-prior-day } }` map, built by scanning the `HISTORY#` rows once per category and transposing. Commodities keyed lowercase→UPPER (`brent→BRENT`…); rates/equities/crypto pass through. `change = (last−prev)/prev·100`, null when <2 points (guards prev=0). The existing `commodities/yields/equities/crypto/fx` LATEST objects are byte-for-byte unchanged — purely additive, so `levelFor` and other consumers are unaffected.
- **Frontend** (`EconomyPage`): a `ChangePill` (green/red/muted, renders nothing when null); right-rail rows became `[name] [mini-sparkline] [level] [▲/▼ %]` (dropped the redundant ticker so the friendly name has room — fixed a single-char truncation caught in browser-verify); leaderboard rows show the change next to the price. Graceful throughout — no series / <2 points → level only, never a fabricated arrow or 0%.
- **Honest data:** change + spark come straight from the seeded daily closes. A few instruments show `→ 0.0%` when their last two *stored* closes coincide (e.g. rates, which FRED feeds and weren't in the Yahoo seed) — real, not faked.
- **Browser-verified** (Playwright): 35 right-rail mini-sparklines + 24 change pills + 7 leaderboard pills rendering, **zero console errors**; screenshot confirms the watchlist look. Verified: `markets_global` returns `series` for 53 instruments live; lint 0 new, build OK, 177 tests (economyPage 6/6), independent review GO.

- Files: `newsSensitiveData/src/index.js`, `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `CHANGES.md`.

---

## 2026-05-27d (Real 30-day sparkline trend — Yahoo history seed)

The `/economy` sparklines were empty because our stored price history only had 2–3 accrued daily points (Stooq's history endpoint is now API-key-gated). Fixed by seeding 30 days from **Yahoo Finance** — no backfill-as-ongoing-process, just a one-time download; the existing daily cron + DynamoDB TTL maintain the rolling window from here.

- **`newsMarketsData`** gains a `seedHistory()` routine (invoke `{ "source": "seed_history" }`): pulls each instrument's daily series from Yahoo (`chart?interval=1d&range=2mo`, sequential at 300ms to dodge Yahoo's burst rate-limit), transposes into the existing per-date `HISTORY#YYYY-MM-DD` rows (35-day TTL), writing only dates **before today** and **skipping any row that already exists** (never clobbers a daily-cron row). All 46 Yahoo symbols verified live before trusting the map (the `^rut` lesson); zero drops.
- **No serving/frontend change:** `markets_history` reads the same per-date rows; the rebuilt EconomyPage already renders the `Sparkline` + Key-levels when ≥2 points. So the **live site now shows the trend with no redeploy** — only the data was missing.
- **Verified live:** ran the seed; `markets_history` now returns **30 points** for BRENT/SPX/BTC/GOLD; public API (frontend shape) returns 30; browser screenshot confirms the sparkline draws a real 30-day line + Key Levels (Today / 30d high / low / Δ) populate.

Why this shape (vs re-fetching 30 days daily, or fetch-through-on-request): the universe is fixed + daily-cadence + the upstream (Yahoo) is unofficial and rate-limits, so the standard pattern is scheduled-ingest-then-serve-from-DB with the third party off the request path. Seed once, append the new day daily (already running), TTL expires the old — nothing to re-fetch.

- Files: `newsMarketsData/src/index.js`, `ARCHITECTURE.md`, `CHANGES.md`.

---

## 2026-05-27c (/economy visual rebuild to match the editorial mockup)

Rebuilt `EconomyPage` to match the `Economy.html` design mockup, wired entirely to real data (no mock values). Masthead band + 3-col shell (220/1fr/260), instrument leaderboard with one-open-at-a-time expand → price sparkline + Key-levels box + a 5-col driving-stories sub-table (Severity·Story·Direction·Mechanism·Closest analog) + affected-country chips, a dormant-instruments drawer, a by-story "Active disruptions" bridge, and the right-rail Market Context (Equities/Sectors/Commodities/Ags&Materials/Risk/Rates/Crypto).

- **Honest degradations** (match the look, never fabricate — these are known data gaps): severity-distribution bar → real direction split from `directions`; dominant-category tag → omitted; analog "+12%/3wk" realized-move → real `historicalAnalog.event/year/outcome` (catalog-join deferred); ISO chips → real country names linking to `/weekly/country/:name`; dormant "last cited" date → omitted; by-story article/outlet counts → omitted; right-rail "% change" → omitted (levels only); 30d high/low/Δ → computed from real history, "—" when too few points.
- **Preserved:** deep links to `/weekly/thread/:id?tab=economy`, per-story rationale on expand, consensus tooltip, instrument→by-story filter, honesty disclaimer → `/disclosures`, loading/empty/error states.
- **Browser-verified** (Playwright, dev server): 20 real leaderboard rows, real market levels, expand renders the sub-table, **zero console errors**. Caught + fixed two layout bugs the static review flagged: sticky rails were overlapping the global nav+LIVE strip (offset `top` to `--nav-h + --strip-h`), and the page wasn't full-bleed (added the `:has(.ep-page)` container escape, matching the other redesigned pages).

Method: plan → executor agent → independent reviewer (GO, no fabricated data) → orchestrator browser-verify + CSS fixes. Verified: lint 0 new, build OK, 176 tests pass (economyPage 5/5), screenshots match the mockup.

Known follow-up (polish, not blocking): a heavily-cited instrument (e.g. BRENT, 23 stories) lists all citing stories on expand — consider a "top N + show more" cap. Medium data gaps still open per `economy-page-design-brief.md`: right-rail % change, dominant-category persist, analog realized-move catalog join.

- Files: `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `CHANGES.md`.

---

## 2026-05-27b (Economy Step 2: commodity menu expansion — NATGAS / DBA / REMX)

Step 2 of `ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`. Unlike sectors (dashboard-only), these geopolitics-flow commodities have plausible *latent leaderboard demand* (Russia energy → natgas, Ukraine/food → grains, China leverage → rare earths), so they're wired into the **AI's instrument menu** to make them citable — then we re-audit to see if the news actually reprices them.

- **Producer:** `newsMarketsData` fetches **NATGAS** (`ng.f` → COMMODITIES#GLOBAL) + **DBA** (agriculture, `dba.us`) + **REMX** (rare earths, `remx.us` → EQUITIES#GLOBAL). `newsEconomicImpact`: added all three to `INSTRUMENT_ALLOWLIST` + `buildInstrumentTable` (the prompt menu), plus 3 real `economic_analogs.json` entries (2022 Europe gas crisis, 2022 Black Sea grain disruption, 2010 China rare-earth curbs) with realized historical moves.
- **Serving:** `markets_global` commodities projection += `natgas` (DBA/REMX flow via the generic `stripMeta` equities path; `markets_history` already generic — no change).
- **Frontend** (`EconomyPage`): `COMMODITY_KEY` += NATGAS; right rail gains Nat Gas in Commodities + a new **Ags & Materials** group (DBA/REMX). All page *consumers* (MechanismCard / DisruptionRow / thread Economy tab) render `instruments[]` generically — zero consumer-side edits needed (confirmed via `PAGES_GUIDE.md` + wiring review).
- **SILVER deliberately excluded** — its `si.f` feed returns an implausible value (7725 vs ~$30/oz); gated until the symbol/scaling is fixed.

Method: plan → executor agent → independent reviewer (GO) → orchestrator deploy + live-verify. **Deployed all 3 Lambdas + verified live:** natgas 3.004 / DBA 27.47 / REMX 98.96 in DDB and served by `markets_global`. Verified: `node --check` ×3, analogs JSON parses (25 events), lint 0 new, build OK, vitest 176 pass, review GO.

**Next:** re-run the citation-coverage audit in ~1–2 weeks to see whether the AI cites NATGAS/DBA/REMX from real news — keep those that earn it on the leaderboard, demote the rest to dashboard-only (compare vs the Step-1 baseline BRENT 23/GOLD 18/VIX 14/WTI 13).

- Files: `newsMarketsData/src/index.js`, `newsEconomicImpact/src/index.js`, `newsEconomicImpact/src/economic_analogs.json`, `newsSensitiveData/src/index.js`, `EconomyPage.jsx`, `ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`, `CHANGES.md`.

---

## 2026-05-27 (Economy dashboard: complete the GICS sector map + small-caps)

Step 1 of the instrument-universe plan (`ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`). Grounded in a citation-coverage audit of live `SummarizeAndPredict` (30 active records, ~117 citations): the oil/gold/VIX complex dominates (top-4 = 58%) and **sector ETFs barely register** (XLE 4, ITA 1; SOXX/XLF zero). Verdict → **two-layer model**: the right-rail "Market Context" is a *standing economic dashboard* (live levels, AI-independent, shown always); the leaderboard stays the *news-cited subset*. So sectors are added to the **dashboard only** — no prompt/allowlist change.

- **Backend** (`newsMarketsData`): `STOOQ_ETFS` += the 9 missing GICS sectors (XLK/XLV/XLI/XLY/XLP/XLU/XLB/XLRE/XLC, `*.us`); `STOOQ_INDICES` += `IWM` (iShares Russell 2000 ETF — small-cap gauge). They flow through `fetchEquitiesAndETFs` → `EQUITIES#GLOBAL`; `markets_global` serves them via generic `stripMeta` (no serving change). **Deployed + invoked live — all 10 return real prices** (IWM 290.51, XLK 185.18, XLV 148.51, XLRE 44.71, XLC 115.55, …).
- **Frontend** (`EconomyPage`): right-rail `MARKET_GROUPS` gains a **Sectors** group (11 GICS + ITA/SOXX) and Russell 2000 in Equities. Rows whose level is null are filtered out (graceful-degrade), so a sector shows only once priced.
- **Live-symbol check caught a dead symbol:** Stooq returns N/D for `^rut`; switched to the `iwm.us` ETF proxy (consistent with the existing INDA/EIS pattern) — exactly the "verify against the live thing, not the name" rule.

Method: plan → executor agent → independent reviewer agent (verdict GO) → orchestrator live-symbol verification + fix. Verified: backend `node --check` OK, frontend lint 0 new / build OK / vitest 176 pass, live invoke confirms all 10 tickers fetch.

- Files: `newsMarketsData/src/index.js`, `EconomyPage.jsx`, `ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md`, `CHANGES.md`.

---

## 2026-05-26j (Real-price sparklines on /economy + markets_history for all instruments)

- **Backend:** `markets_history` (in `newsSensitiveData`) extended from **FX-only** to resolve any `symbol` across commodities / rates / equities / crypto / FX, returning `[{date, value}]`. Deployed + verified (SPX → 2 pts, BRENT → 1 pt, `topics` still healthy → no regression).
- **Frontend:** new `useMarketsHistory(symbol)` hook + `Sparkline` atom in the instrument-pivot expand. Equities/crypto/FX show a trend now; **commodities/rates** (Brent/gold/US10Y) fill in over the next days (history began 2026-05-26) — renders **nothing** until ≥2 points (honest, no fabricated line).
- **Honesty (audited):** the sparkline plots only real fetched price history; no forecast/interpolated points.
- **Docs updated** ("the outdated file"): `ARCHITECTURE.md` `markets_history` row (was wrongly `{ key }` + "FX-only"), hooks table (+`useMarketsHistory`, 24 total), EconomyPage row; `ECONOMIC_DISRUPTION_VIZ_PLAN.md` (sparkline marked done).

Verified: lint clean, build OK, 176 tests pass (new `.ep-spark svg` assertion), independent review clean.

- Files: `newsSensitiveData/src/index.js`, `hooks/useMarketsHistory.js`, `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `ARCHITECTURE.md`, `ECONOMIC_DISRUPTION_VIZ_PLAN.md`.

---

## 2026-05-26i (/economy pivot: source + rationale + deep links on expand)

Reaction to the live page — a row showed *what* ("BRENT ↑ 83% · 96.39 · 23 stories") but not *why* or *who*. Expanding an instrument now answers both:

- **Per driving story:** the headline → deep-link to the thread's Economy tab (source/reference), plus that story's **per-instrument rationale** (the "why") + qualitative direction/magnitude. All pulled from the already-loaded `useDisruptionsList` data matched by `instrumentId` — **no backend change**.
- Tooltip on the consensus % so the number explains itself ("83% of N cited stories agree on ↑").
- **Honesty preserved (audited):** only real cited rationale + qualitative direction/magnitude — no numeric forecast / fake %.

**Sparkline deferred:** `markets_history` is FX-only (hardcodes `pk=FX#…`), so it can't chart BRENT/GOLD/SPX/US10Y — needs a backend extension + accrued commodities/rates history (started 2026-05-26). See `ECONOMIC_DISRUPTION_VIZ_PLAN.md`.

Verified: lint 0 errors, build clean, 176 tests pass (5 economy-page tests incl. new rationale assertion), independent review clean.

- Files: `EconomyPage.jsx`, `EconomyPage.css`, `test/economyPage.test.jsx`, `ECONOMIC_DISRUPTION_VIZ_PLAN.md`.

---

## 2026-05-26h (Remove verify-economic GitHub Action — redundant with local pre-push hook)

Deleted `.github/workflows/verify.yml`. It re-ran `verify_all.sh --fast` on GitHub Actions after every economic-layer push — but the committed `.githooks/pre-push` hook runs the **identical** checks **locally before push** (a stronger gate), the repo is **private** so the Action consumed metered Actions minutes, and it was failing to even start (account hit a $0 Actions spending limit after exhausting included minutes — *not* a code or workflow problem).

- Installed the pre-push hook (`scripts/install_hooks.sh` → `core.hooksPath=.githooks`) so the local gate is active going forward.
- No loss of coverage: `bash quality/verify_all.sh` (full, with live AWS checks) / `--fast` (pre-commit) still run locally; the hook auto-runs `--fast` when economic-layer files change.
- Pages deploys are unaffected (that's a GitHub-managed Pages workflow, not a repo workflow file).

---

## 2026-05-26g (Markets: store commodities + rates history for sparklines)

Prerequisite for the planned `/economy` price sparklines (see `ECONOMIC_DISRUPTION_VIZ_PLAN.md`).

- `newsMarketsData` now writes `COMMODITIES#GLOBAL` and `RATES#GLOBAL` `HISTORY#YYYY-MM-DD` daily snapshots (90-day TTL), mirroring FX/equities/crypto. Previously only `LATEST` was stored for these — so `/economy` couldn't sparkline Brent/gold/US10Y (the most-cited instruments).
- Deployed + verified: invoked the commodities + yields sources, both `HISTORY#2026-05-26` rows confirmed in DynamoDB. History accrues daily from 2026-05-26.
- File: `amplify/backend/function/newsMarketsData/src/index.js`.

---

## 2026-05-26f (Expose equities + crypto in markets_global; surface on /economy)

`newsMarketsData` already ingested `EQUITIES#GLOBAL` and `CRYPTO#GLOBAL` rows, but the `markets_global` API never served them — so `/economy`'s instrument pivot couldn't show a live level for SPX/N225/BTC etc.

- **Backend (`newsSensitiveData`):** `markets_global` now also returns `equities` (SPX, NDX, DJI, N225, HSI, DAX + sector ETFs) and `crypto` (BTC, ETH + 24h changes), via a `stripMeta` helper. Additive + in the existing try/catch. **Deployed + verified** through the live API Gateway (markets_global returns equities/crypto; `topics` still returns 13 → proxy healthy).
- **Frontend (`EconomyPage`):** `levelFor` now resolves equity/crypto instrument levels, and the right-rail Market Context adds **Equities** + **Crypto** groups. Degrades gracefully if absent. (Ships when the GitHub Pages outage clears — backend is already live.)
- Files: `amplify/backend/function/newsSensitiveData/src/index.js`, `EconomyPage.jsx`.

---

## 2026-05-26e (Quality judge fixed — was rejecting every record on a Gemini 400)

`newsEconomicQuality` (the LLM-as-judge) had been failing **every** record since deploy, which is why **zero** production economic-impact records ever carried quality scores.

- **Root cause:** the Gemini request sent *both* `extra_body.google.thinking_config` **and** `reasoning_effort: 'none'`. Gemini rejects having both → `400 "Expected one of either reasoning_effort or custom thinking_config; found both"` → "0 judged, 15 failed" on every daily run.
- **Fix:** removed `reasoning_effort`, kept the explicit `thinking_budget: 0`. Redeployed via `update-function-code` (LastUpdateStatus Successful) and async test-invoked.
- **Verified:** run reported **"9 judged, 0 low-quality, 6 failed"** with **zero 400s**; DynamoDB now has ~9 `ECON#THREAD#` records with `qualityScores` (was 0). The 6 failures were transient **Gemini 503s** (will be re-judged next run).
- File: `amplify/backend/function/newsEconomicQuality/src/index.js`. (Diagnosed via CloudWatch — the EventBridge rule + schedule were fine all along.)

---

## 2026-05-26d (EconomyPage rebuilt — instrument-first hub + center-render bugfix)

Investigated `/economy` against the docs + cross-page references first (it was a documented but thin "index" that turned out to be an orphan). Then rebuilt it with a new goal: the **markets-meets-news command center**.

- **New center hero — "Most-repriced instruments":** cross-story consensus per instrument (`useTopMovers`) with direction, % consensus, **live level** (e.g. BRENT → 82.5), and story count; each row expands to the stories pushing it (link to the thread Economy tab). The aggregate view the per-thread tab can't give.
- **New right rail — live Market Context:** `useMarketsGlobal` commodities / risk / rates with an "as of" date.
- **Kept** the severity-grouped by-story list + facets; clicking an instrument filters the list.
- **🐞 Bugfix (latent, affected the original page too):** the center column **never rendered** — EconomyPage passed `center={center}`, but `EditorialShell` renders center as `children`. Now passed as children. This is why `/economy` looked like just facets + a movers panel.
- **Fixes:** surfaced the `useDisruptionsList` error state; added top-movers/markets loading states; horizon facet now shows counts.
- **Docs:** new goal recorded in `ARCHITECTURE.md` + `ECONOMIC_DISRUPTION.md`; the wiring plan's "do not redesign /economy" non-goal marked **superseded**.

Verification: 5 new render tests (`economyPage.test.jsx`) covering pivot / market context / expand / instrument-filter / by-story — all pass. Full suite 176 pass (1 pre-existing `layers.test.jsx` d3-in-jsdom failure, unrelated); lint 0 errors; build clean. (No live browser click-through — this session has no browser automation.)

---

## 2026-05-26c (Static-page content audit — removed false subscription copy)

Content-staleness audit of the 5 static pages (1 auditor) found **materially false billing/subscription claims** still live, contradicting the billing deprecation. Fixed (mostly deletions + the "free during early access" framing already used elsewhere):

- **Disclosures.jsx** — deleted the entire "Subscription Terms" section ($15/mo Member, Enterprise pricing, 14-day trial, cancellation, refund policy, Stripe/PCI DSS) → replaced with a short "Access & Pricing" note (all free, no plans). "For billing questions" → "For account issues."
- **PrivacyTerms.jsx** — Overview no longer claims paid subscription required; deleted the Stripe "Payment data" bullet + the Stripe third-party-services line; dropped the "subscriptions cancelled on deletion" clause; bumped Last updated → 2026-05-26.
- **Contact.jsx** — "Billing & Account" card → "Account & Data" (deletion/data requests); "Enterprise" card → "Partnerships" (API/integrations); removed "urgent billing issues" line.
- **WhitepaperPage.jsx** — relabeled the Free/Member/Enterprise paywall tiers as "Level 1/2/3" depth (all free, no paywall); removed "team access"/"enterprise account management"; added an explicit "all three levels currently free" note.
- **AboutContact.jsx** — clean (no billing copy).

Also recorded the reusable **page-audit run-book** in `AGENT_REVIEW_METHOD.md`.

Verification: lint 0 errors, build clean, 171 tests pass; review agent verified. Provider names + dead-route links already clean from 2026-05-26b.

---

## 2026-05-26b (Full page audit — problem → fix log)

Ran the multi-agent page audit (all 16 page components, 3 parallel auditors) per `AGENT_REVIEW_METHOD.md`. Each problem + the fix applied:

### Doc drift fixed (`ARCHITECTURE.md`)
- **Home description stale** ("Daily topics, region grouping, AI toolbar") → rewrote to the real 3-col EditorialShell + StatusStrip + AI toolbar + per-topic economic-disruption badge + sidebars.
- **WeeklyPage wrong** ("grouped by region") → feed groups **by category** (region is a left-rail filter); added 3-col + lazy `WeeklyMap` view.
- **ThreadPage too thin** → documented Arc Intelligence AI rail + Timeline/Actors/Sources/**Economy** tabs + `useEconomicImpact`.
- **DailyPage incomplete** → added the `EconomicFootprint` section.
- **SignIn incomplete** → added guest/anonymous sign-in.
- **Google Maps API row wrong** → WorldMapV2 uses **d3 + topojson**, not Google Maps; Google Maps is WeeklyMap (embedded by CountryPage) + legacy WorldMap.
- **`useDisruptionsList` under-described** → lists all consumers, not just `/economy`.
- **"1 service (restProxy.js)" wrong** → documented `contentService.js` as the 2nd module.

### Code fixed
- **Misnamed `graphqlService.js`** (no GraphQL — a restProxy wrapper) → renamed to `utils/contentService.js` (class `GraphQLService`→`ContentService`) across 8 files (Home, MapSidePanel, useGeminiTopics, useSummary, usePrediction, useTraceCause, useTodayArchive).
- **`ThreadPage` "Grok · xAI" model chip** (stale provider, user-facing) → "AI analysis" (provider-agnostic, won't drift again).
- **Stale "xAI Grok" provider credit** in `PrivacyTerms` (×2), `Disclosures`, `AboutContact` → DeepSeek / Google Gemini. (Privacy-relevant: discloses the real third parties receiving data.)

### Deferred (needs your decision — written down, not changed)
- **Subscription copy still live** in `PrivacyTerms.jsx` (paid plans + "payments processed by Stripe") and `Contact.jsx` ("Billing & Account" / "Enterprise" cards). Contradicts the billing deprecation, but it's legal/marketing wording — left for you to direct. Tracked in `BACKEND_TODO.md`.

### Verification
- Lint 0 errors; build clean; vitest 171/171 (1 pre-existing `layers.test.jsx` d3-in-jsdom failure, unrelated). Independent review agent run post-fix.

---

## 2026-05-26 (Subscriptions deprecated + frontend billing cleanup + doc re-verification)

Subscriptions/billing are not in use and are now **deprecated** (not "coming soon"). Removed the dormant billing UI from the frontend and brought `ARCHITECTURE.md` back in line with reality via a multi-agent review (see [`AGENT_REVIEW_METHOD.md`](AGENT_REVIEW_METHOD.md)).

### Shipped (frontend)
- Deleted `TrialBanner.jsx`, `UpgradeSuccess.jsx`, `WeeklyLockedPreview.jsx` (orphan), `useUserProfile.js`.
- Removed the `/upgrade/success` route and TrialBanner usage from `CountryPage`, `ThreadPage`, `WeeklyPage`.
- Stripped tier/perks/billing + the Paddle portal call from `Account.jsx` — kept the Saved-items feature and a basic profile (email, member-since, sign out, delete account).
- Removed `fetchUserProfile` / `fetchPortalSession` from `restProxy.js` and the dead mocks from `redesign.test.jsx`.

### Docs
- `ARCHITECTURE.md`: marked the Tier System, `newsStripeWebhook`, `user_profile`/`portal_session`, and Paddle DEPRECATED; corrected drift the auditors found (TTLs, Brave query count, dead social platforms, ACLED auth vars, `/daily` worker route, frontend routes/components/hooks counts).
- `BACKEND_TODO.md`: frontend cleanup marked done; backend Lambda/API-Gateway teardown logged as a remaining destructive step pending explicit go-ahead.
- New `AGENT_REVIEW_METHOD.md` documenting the orchestrator + parallel-auditor + independent-verification workflow.

### Verification
- Lint 0 errors; build clean (949KB JS / 195KB CSS); vitest 171/171 pass (1 pre-existing `layers.test.jsx` d3-in-jsdom failure, unrelated).
- `/account` is auth-gated so no signed-in browser click-through was possible here — verified via lint/build/tests.
- Deployed to `docs/`.

### Files changed
- Modified: `global-perspectives-starter/frontend/src/{App.jsx, services/restProxy.js, components/{CountryPage,ThreadPage,WeeklyPage,Account}.jsx, test/redesign.test.jsx}`
- Deleted: `components/{TrialBanner,UpgradeSuccess,WeeklyLockedPreview}.jsx`, `hooks/useUserProfile.js`
- Docs: `ARCHITECTURE.md`, `BACKEND_TODO.md`, `CHANGES.md`, new `AGENT_REVIEW_METHOD.md`
- Production: `docs/index.html`, `docs/assets/*`

---

## 2026-05-21 (Economic Disruption — UI Wiring Phase 4, Batch A)

Follow-up to the 2026-05-21 three-agent design debate ("ambient" vs "minimalist" vs "pragmatist") and the surface-map doc. Plan: [`ECONOMIC_DISRUPTION_WIRING_PLAN.md`](ECONOMIC_DISRUPTION_WIRING_PLAN.md). This batch ships the 4 P0 (safe-win) items.

### Shipped

- **P0.1 — DailyPage lead-disruption headline → deep link.** The lead headline in "Today's Economic Footprint" previously rendered as plain text. Now links to `/weekly/thread/{scopeId}?tab=economy` when `scopeId` exists. `DailyPage.jsx:115`.
- **P0.2 — WorldMapV2 country detail panel → "Economic Disruption" section.** The panel previously showed Signal / Articles / Risk Score but never mentioned active disruption. New section lists up to 3 disruptions touching the selected country (matched by name in winners/losers), each labelled WINNER or LOSER, each linking to the underlying thread's Economy tab. `WorldMapV2.jsx` (new `selectedCountryDisruptions` useMemo + panel section above intel headline).
- **P0.3 — Home "Story arc →" → conditional deep-link to Economy tab.** When the topic's thread has an active disruption record, the link now goes to `/weekly/thread/{id}?tab=economy` and renders as **"Economic impact →"**. Otherwise unchanged. `Home.jsx:388`.
- **P0.4 — Cut WeeklyPage StoryCard SeverityBadge.** StoryCard meta row already carried 7-9 chips (AI / Story Arc / category / article count / TrendBadge / activity dot / region tags). The SeverityBadge was decoration without a unique destination — clicking the card already goes to the thread. Removed badge + `useDisruptionsList` hook + `disruptionsByThread` map + `disruption` prop. `WeeklyPage.jsx:273, 322, 549-557, 818`.

### Why this batch first
All four agents in the debate either flagged these explicitly or implicitly accepted them. They're the highest-confidence changes — three additions to *editorial structure* (deep link, panel row, conditional CTA) and one removal of *pure decoration*. Batches B (Home AI button) and C (leaderboard + sidecar line + watch-signal merge) are queued in the wiring plan.

### Verification
- Frontend vitest: 149/149 pass (pre-existing WorldMap d3-in-jsdom warning unchanged)
- Build clean (954KB JS / 195KB CSS)
- Deployed to `docs/`

### Files changed
- Modified: `global-perspectives-starter/frontend/src/components/{DailyPage,Home,WeeklyPage,WorldMapV2}.jsx`
- Production: `docs/index.html`, `docs/assets/*`
- New: `ECONOMIC_DISRUPTION_WIRING_PLAN.md`

---

## 2026-05-20 (Economic Disruption — UI surface map doc)

Added a new section **"Where it surfaces in the UI"** to [`ECONOMIC_DISRUPTION.md`](ECONOMIC_DISRUPTION.md), placed between §"What's running today" and §"How to read a disruption record". Documents:

- **Per-page surface map** — a 10-row table covering `/economy`, `/`, `/daily`, `/weekly/thread/:id`, `/weekly/country/:name`, `/weekly`, `/weekly/countries`, `/map`, Layout, and `/disclosures` — each row lists the visible component, the hook(s) it uses, and the atom(s) it renders.
- **The linking spine** — explains how every chip/preview deep-links into the canonical `/weekly/thread/{scopeId}?tab=economy` path.
- **Two reading hooks, two purposes** — `useEconomicImpact` (single record, ThreadPage) vs `useDisruptionsList` (bulk, everywhere else), plus `useTopMovers`.
- **Quality flag propagation** — why the Phase B `is_low_quality` flag surfaced across all UI touchpoints from one atom change (it lives inside `MechanismCard` / `DisruptionRow` / `DisruptionPreview`).

Pure documentation update — no code changes.

---

## 2026-05-20 (Quality Plan — Status & Roadmap section)

Added a top-of-file **Status & Roadmap** table to [`ECONOMIC_DISRUPTION_QUALITY_PLAN.md`](ECONOMIC_DISRUPTION_QUALITY_PLAN.md) summarising what shipped (Phases A/B/C), what's blocked and on what (Phases D/E), and **concrete check-back dates**:

- **2026-05-21** — verify auto-judge cron ran (check `quality_judged_at` on DDB records, tail CloudWatch logs)
- **Every Monday** — run picker + dashboard scripts
- **~2026-06-17** — start Phase E calibration (after 4 weeks of human reviews)
- **~2026-06-18** — start Phase D backtest (after 30 days of ECON# records)
- **~2026-08-20** — consider publishing dashboard stats to `/disclosures`

Also captured what NOT to do in the interim (don't tune the judge prompt early, don't widen the low-quality threshold, don't add allowlist instruments without re-running golden evals, don't publish stats prematurely). Pure documentation update — no code changes.

---

## 2026-05-20 (Economic Disruption Quality — Phase C: human spot-check workflow)

### What shipped
Layer 4 of the [quality plan](ECONOMIC_DISRUPTION_QUALITY_PLAN.md) — passive but essential: a weekly cadence for grading 5 random `ECON#` records by hand against a 7-question rubric, so the LLM-as-judge (Phase B) has ground truth to calibrate against. Without this, the judge slowly drifts toward its own biases with no external check.

### New files
- **`quality/reviews/README.md`** — workflow explainer (cadence, the 7 questions, when results become meaningful, what not to do).
- **`quality/reviews/TEMPLATE.md`** — blank per-record rubric block.
- **`quality/pick_weekly_review.js`** — CLI that scans live DDB (paginated), stratifies records 2 severe / 2 moderate / 1 minor (tops up from larger buckets when one is short), fetches thread analysis for context, and writes a populated `quality/reviews/YYYY-WW.md` ready for the reviewer.
- **`quality/build_dashboard.js`** — parses all `reviews/*.md` and writes `quality/dashboard.md` with per-week trend, grade distribution, would-publish rate, hallucination levels, and the plan's threshold table. Strict parser — rejects template placeholders so empty rubrics don't inflate stats.
- **`quality/reviews/2026-21.md`** — first populated week (5 records from production: 1 severe / 3 moderate / 1 minor, reflecting current DDB distribution of 1/17/1). Awaits review.
- **`quality/dashboard.md`** — current baseline (5 logged, 0 graded). Regenerated by the script.

### Stratification behaviour
Target is 2 severe / 2 moderate / 1 minor. Production distribution is currently skewed (1 severe / 17 moderate / 1 minor) so the picker correctly fell back to 1/3/1. The "top-up from next-largest bucket" logic prevents the picker from returning fewer than N records when buckets are uneven.

### How the loop closes
- **Week 1–4:** fill in 5 rubrics per week. Don't draw conclusions yet — just log.
- **Week 5+:** the dashboard can cross-reference per-record human grades against auto-judge `is_low_quality`. Mismatches feed Phase E (judge-prompt revision).
- **Month 3+:** publish the would-publish rate on `/disclosures` as the credibility moat.

### Not done (intentional)
- No frontend changes — `quality/dashboard.md` is operator-only until aggregate stats are meaningful. Plan calls for public publication at Month 3+.
- No parser test file — parser is ~30 lines and was verified positively (mixed grades A/B/D parsed correctly with 2.67 GPA + correct would-publish/BS distributions) and negatively (template placeholder lines rejected, dashboard shows 0 graded).
- Phase D (30-day direction-call backtest) — blocked, needs 30+ days of production records. We have ~1.

### Files
- New: `quality/reviews/{README,TEMPLATE,2026-21}.md`, `quality/pick_weekly_review.js`, `quality/build_dashboard.js`, `quality/dashboard.md`

---

## 2026-05-20 (Economic Disruption Quality — Phase B: LLM-as-judge)

### What shipped
Layer 2 of the quality-evaluation plan ([`ECONOMIC_DISRUPTION_QUALITY_PLAN.md`](ECONOMIC_DISRUPTION_QUALITY_PLAN.md)): an automated LLM-as-judge pass that re-reads each `ECON#THREAD#` record with a *different model family* (Gemini 2.5 Flash) and scores it 1–5 on five axes — coherence, citation fidelity, analog match, severity calibration, and "no-BS". Records with any axis ≤ 2 are tagged `is_low_quality` and surface a visible warning chip across the site.

Methodology follows Zheng et al., *Judging LLM-as-a-Judge* (NeurIPS 2023): different-family judge for less-correlated errors, strict JSON-only schema, integer 1–5 scoring with single-sentence reasons.

### Backend
- **NEW Lambda** `newsEconomicQuality` (nodejs22.x, 512MB/600s) — paginated Scan over `ECON#THREAD#` records with `hasImpact:true`, skips records judged in last 7 days, sorts by `severityScore` desc, judges up to 15 per run. Sequential with 13s pacing for Gemini free-tier rate limit. Writes `qualityScores`, `qualityReasons`, `is_low_quality`, `quality_judged_at`, `quality_judge_model` via UpdateCommand. Reuses `newsThreadAnalysis-role-etmr9wj9`.
- **NEW EventBridge rule** `TriggerNewsEconomicQuality` — `cron(0 8 * * ? *)` daily 08:00 UTC, ENABLED. Runs after `newsEconomicImpact` (07:30) and aligns with Gemini free-tier quota reset.
- **IAM** — extended `AWSLambdaBasicExecutionRole-725d3974…` policy v2 to allow log-stream writes to `/aws/lambda/newsEconomicQuality:*` as well as `newsThreadAnalysis`.

### Frontend
- **NEW atom** `QualityFlag.jsx` — small "auto-judged: review" chip that renders only when `is_low_quality === true`. Tooltip lists each failing axis (score ≤ 2) with the judge's one-line reason. CSS in `atoms.css`.
- **MechanismCard, DisruptionRow, DisruptionPreview** — render `<QualityFlag>` next to severity in their header/badge slot.
- **Disclosures.jsx** — added "Automated quality check (LLM-as-judge)" paragraph explaining the five axes, threshold, methodology citation, and that aggregate scores are reviewed weekly.

### Tests
- **NEW** `amplify/backend/function/newsEconomicQuality/test/judge.test.js` — 26 unit tests covering `validateJudgment` (happy path, missing axis, out-of-range, non-numeric, string coercion, unknown-axis filtering, 300-char reason clipping) + `stripCodeFence` + `buildJudgePrompt` structural sanity. All pass.
- Existing suites unchanged and still passing: `newsEconomicImpact` validator (54/54), golden evals (38/38), frontend vitest (149/149).

### Known limitation
Manual smoke-test invocation hit Gemini free-tier daily quota (429) — the daily 08:00 UTC schedule was deliberately chosen to land at quota reset. Live judge verification will happen on the next scheduled run; the structural deploy (function active, schedule enabled, IAM correct, log group writing, validate/prompt logic unit-tested) is complete.

### Files changed
- New: `amplify/backend/function/newsEconomicQuality/src/{index.js,package.json}`
- New: `amplify/backend/function/newsEconomicQuality/test/judge.test.js`
- New: `global-perspectives-starter/frontend/src/components/atoms/QualityFlag.jsx`
- Modified: `global-perspectives-starter/frontend/src/components/atoms/{MechanismCard,DisruptionRow,DisruptionPreview}.jsx`
- Modified: `global-perspectives-starter/frontend/src/components/atoms/atoms.css` (+ `.qflag` rules)
- Modified: `global-perspectives-starter/frontend/src/components/Disclosures.jsx` (+ LLM-as-judge paragraph)
- Production: `docs/index.html`, `docs/assets/*`

---

## 2026-05-19 (Economic Disruption Layer — Phases 1+2+3 DEPLOYED end-to-end)

### What this is
New cross-cutting layer that, for every news thread Global Perspectives tracks, surfaces *how the economy is being repriced*: which instruments move, in what direction, with what severity, the causal mechanism, who wins/loses, and what historical event is the closest analog — all with citations back to the underlying articles.

Concept doc: [`ECONOMIC_DISRUPTION.md`](ECONOMIC_DISRUPTION.md). Implementation plan: [`ECONOMIC_DISRUPTION_PLAN.md`](ECONOMIC_DISRUPTION_PLAN.md).

### Backend (DEPLOYED via `aws lambda` CLI, ap-northeast-1)
- **`newsEconomicImpact`** (NEW Lambda, nodejs22.x, 512MB/300s) — per-thread economic disruption analysis. Reads thread analyses + today/archive entries + market snapshots, calls DeepSeek with a closed instrument allowlist (~55 tickers), validates JSON, drops uncited claims and out-of-allowlist instruments, writes `ECON#THREAD#{id}/ECONOMIC_IMPACT` records to `SummarizeAndPredict` with 21-day TTL. Reuses `newsCountryIntelligence-role-xqboqh2y` IAM role.
- **EventBridge rule** `TriggerNewsEconomicImpact` — `cron(30 7 * * ? *)` daily 07:30 UTC, ENABLED. Runs after thread analysis (06:30), country intel (07:00), systems analysis (07:15).
- **`newsMarketsData` extended** — added `fetchEquitiesAndETFs()` pulling 25 instruments via Stooq (15 indices: SPX/NDX/DJI/FTM/DAX/N225/HSI/SSEC/KS11/TWII/INDA/BVSP/MERV/XU100/EIS; 10 ETFs: XLE/ITA/SOXX/XLF/EEM/EFA/GDX/SHY/EMB/HYG). Added `fetchCrypto()` pulling BTC + ETH via CoinGecko free API. New DDB keys: `EQUITIES#GLOBAL/LATEST + HISTORY#`, `CRYPTO#GLOBAL/LATEST + HISTORY#`. NSEI/TA125 replaced with US-listed ETF proxies (INDA/EIS) — Stooq lacks Nifty 50 and Tel Aviv 125.
- **`newsSensitiveData-dev` extended** — 3 new actions: `economic_impact`, `economic_impact_list`, `economic_top_movers`. All paginate over DDB Scan (bug fix during testing — 1MB scan page limit was hiding records).
- **Analog catalog** — 22 curated historical events (`amplify/backend/function/newsEconomicImpact/src/economic_analogs.json`) with realized asset moves. Loaded into LLM prompt; LLM picks the closest by category overlap; UI shows the *historical* moves, not a fresh prediction.

### Frontend (DEPLOYED)
- New page: `/economy` — flagship 3-col index with severity-grouped DisruptionRow list, facet filters (severity / horizon / instrument / country), and "Today's Top Movers" right-rail panel
- New atoms: `SeverityBadge`, `DirectionArrow`, `InstrumentChip`, `MechanismCard`, `DisruptionPreview`, `DisruptionRow`
- New hooks: `useEconomicImpact`, `useDisruptionsList`, `useTopMovers`
- ThreadPage — 4th center tab "Economy" + right-rail `DisruptionPreview` above Live Web Evidence
- CountryPage — new "Economic Disruption" section above Macro Snapshot (which was relabeled "Macro Baseline" to disambiguate event-driven vs structural)
- WorldMapV2 — 4th lens "Economy" with severity-colored ring overlay on affected countries
- DailyPage — new "Today's Economic Footprint" section between masthead and Top Stories
- Inline `SeverityBadge` on Home kicker / WeeklyPage StoryCard / CountryListPage cards
- Layout nav + footer entry for `/economy`
- Disclosures.jsx — full "not investment advice" methodology section

### Methodology (the anti-hallucination spine)
- **Closed instrument allowlist** — LLM may only reference instruments from a fixed list. Anything outside is dropped server-side. Verified by 31-test validator suite.
- **Citation requirement** — every claim cites topicIds from the actual thread; uncited claims dropped.
- **Magnitude as enum** (small/moderate/large) — never %. LLMs hallucinate financial point estimates (FAITH benchmark).
- **Tombstones** — when no economic dimension exists, write `{hasImpact:false}` to skip regeneration. Refusing to generate beats fabricating.
- **Market prices computed from `MARKETS_DDB_TABLE`** snapshotted at generation time. LLM never emits a price level.

### Files changed
- New: `amplify/backend/function/newsEconomicImpact/src/{index.js,package.json,economic_analogs.json}`
- New: `global-perspectives-starter/frontend/src/components/EconomyPage.{jsx,css}`
- New: `global-perspectives-starter/frontend/src/components/atoms/{SeverityBadge,DirectionArrow,InstrumentChip,MechanismCard,DisruptionPreview,DisruptionRow}.jsx`
- New: `global-perspectives-starter/frontend/src/hooks/{useEconomicImpact,useDisruptionsList,useTopMovers}.js`
- New: `ECONOMIC_DISRUPTION.md`, `ECONOMIC_DISRUPTION_PLAN.md`
- Modified: `amplify/backend/function/{newsMarketsData,newsSensitiveData}/src/index.js`
- Modified: frontend `ThreadPage.jsx`, `CountryPage.jsx`, `Home.jsx`, `WeeklyPage.jsx`, `CountryListPage.jsx`, `DailyPage.{jsx,css}`, `WorldMapV2.jsx`, `Layout.jsx`, `App.jsx`, `Disclosures.jsx`, `services/restProxy.js`, `components/atoms/atoms.css`

### Verification
- Lambda invoked with cap=15: `10 generated, 2 tombstoned, 3 skipped, 0 failed` — first production run wrote 15 records to DDB
- API actions tested via API Gateway — `economic_impact_list` returns 3 records sorted by severity; `economic_top_movers` shows GOLD/BRENT cited 10× each
- Real records include severe Iran/Hormuz oil scenarios and a correctly-classified MINOR for Trump warning Taiwan against independence (de-escalation)
- 31 validator unit tests pass (closed allowlist + citation requirement + enum validation)

### Cost
- Marginal AWS + DeepSeek: ~$0.30/month at daily volume
- One-time deploy run: ~$0.06

## 2026-05-18 (Source diversity — post-LLM enrichment + outlet flags — DEPLOYED)

### Problem
Home topic cards were showing 1-3 sources per topic even when 10+ outlets were covering the same event. Root cause: prompt rule "EXCLUSIVE SOURCES: Each article URL must appear in exactly ONE topic" plus LLM output-token economy. Median was 4 sources / 3 outlets, but two pathological cases hurt credibility — 1 single-source topic and 1 same-outlet-twice topic per 13-topic feed.

### Backend (DEPLOYED — `newsInvokeGemini-dev` ap-northeast-1)
- New `source_enrichment.js`: post-LLM Jaccard match over the full article pool with keyword-in-title boost. Default threshold 0.20, cap 12 per topic. Sorted by score, prefers new outlets when tied. Tier='secondary' with `enrichScore` field for transparency.
- New `outlet_metadata.js`: 50+ outlets mapped to `{country, type}`. Used to annotate every source with `outletCountry` + `outletType` for frontend flag rendering.
- Wired into `index.js` between source-URL validation and category filter. Env flags: `SOURCE_ENRICH_ENABLED` (default on), `SOURCE_ENRICH_THRESHOLD`, `SOURCE_ENRICH_MAX`, `SOURCE_ENRICH_CROSS_TOPIC` (default off). Wrapped in try/catch so failure never blocks publishing.
- Bug fix: enriched source objects no longer set `age: undefined` — DDB v3 marshaller refuses undefined. Now uses conditional property spread.
- 23 unit tests pass (`test_enrichment.js`).
- **Production verified:** first run wrote 44 sources across 15 topics — 100% outletCountry coverage, 5 sources attached by enrichment, 17 secondary-tier total. Sample: AllAfrica's Somaliland-strike piece auto-attached to Iran/UAE drone topic (Jaccard 0.256).

### Frontend (DEPLOYED — `docs/`)
- `Home.jsx`: country-flag row in the topic meta line when ≥2 distinct outlet countries present. Expanded sources panel now sorted (primary tier first, then country-diversity) with per-source flag + `· related` tag on secondary sources.
- New `countryToFlag(cc)` helper — ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols.
- `Home.css`: new rules for `.home-source-flag`, `.home-source-flags`, `.home-flag`, `.home-source-item.is-secondary`, `.home-source-tier`.

### Plan + audit
- `SOURCE_DIVERSITY_PLAN.md` — full design rationale, comparator table (Ground News / AllSides / Memeorandum / Google News / GDELT), 5-step implementation, test strategy, audit data + decision matrix.

---

## 2026-05-18 (Perf: LLM-loop parallelization + active-bug fixes — DEPLOYED)

### Backend (DEPLOYED — all Lambdas ap-northeast-1)

**Performance — measured in production:**

| Lambda | Before | After | Speedup |
|---|---:|---:|---:|
| `NewsProjectInvokeAgentLambda-dev` | 387.7 s, **14% timeouts** (445s wall) | **130.4 s, 0 fails** | **3.0×** |
| `newsCountryIntelligence` | 348 s avg | **60 s** (10 generated + 10 skipped) | **5.8×** |
| `newsInvokeGemini-dev` | 79 s avg | **63 s** | 1.25× (16s/run × 12 runs/day saved) |

**Changes:**
- Added 12-line `mapWithConcurrency(items, limit, worker)` helper to `NewsProjectInvokeAgentLambda/src/index.js` and `newsCountryIntelligence/src/index.js`. No new deps.
- Replaced `for (const x of items) { await ... }` with concurrent worker pool (concurrency 4 via new env `LLM_CONCURRENCY=4`).
- `newsInvokeGemini/src/index.js` Brave Search loop: same pattern with `BRAVE_CONCURRENCY=3` (was sequential with 2s sleep between 9 queries = 16s wasted/run).
- Bumped `NewsProjectInvokeAgentLambda-dev`: memory 128MB → 512MB, timeout 445s → 600s. Max memory used 134MB — plenty of headroom; more memory = more vCPU.

**Active bugs fixed:**
1. **`CATEGORY_LABEL` missing 5 keys** — added `business`, `society`, `energy`, `climate`, `science` to the maps in `newsPostLinkedIn/src/index.js`, `newsSensitiveData/src/index.js`, `newsPostDevTo/src/buildDailySummary.js`. Verified live: 5 of 13 active topics (38%) were tagging "World" as fallback hashtag on every social post. Fixed going forward.
2. **`newsPostDevTo` AI_MODEL hardcoded** — `AI_MODEL` was `const = 'deepseek/deepseek-r1:free'` which OpenRouter removed → 404 every run, brief published without AI overview. Changed to `process.env.AI_MODEL || 'deepseek/deepseek-v4-flash:free'`. Set env var. Verified: brief now generates 1,558-char AI intro (article 10,992 chars vs 9,427 before). Lambda timeout bumped 30s → 120s, memory 128MB → 256MB.
3. **Repo↔deployed drift on `newsPostDevTo`** — deployed `index.js` was 397 lines; repo was 388, missing 8 const declarations + 2 imports. Someone edited in AWS console without committing back. Pulled deployed → repo. md5 spot-checked 4 other Lambdas — all clean.

**Known issue not fixed today:**
- `DEVTO_API_KEY` still returns 401 unauthorized → daily Dev.to publish still fails. `DAILY_BRIEF#YYYY-MM-DD` is stored in DDB (so in-app `/daily` page works); only the Dev.to article publish fails. Rotate the key at https://dev.to/settings/extensions when convenient.

**New foundation docs created at repo root:**
- `SYSTEM_WIRING.md` — code-grounded companion to ARCHITECTURE.md.
- `OPTIMIZATION_REPORT.md` — 30 findings with file:line and CloudWatch evidence; tracks SHIPPED / DEFERRED status per item.

---

## 2026-05-16 (Migration: full AI provider switch to DeepSeek V4 + Gemini free)

### Backend (DEPLOYED — all Lambdas ap-northeast-1)

**Root cause:** xAI Grok monthly credits exhausted 2026-05-03. All 7 Grok-dependent Lambdas dark. Cost had grown from ~$8/mo to ~$25/mo due to two-pass predictions, country intel 10→20 countries, 3×/day schedule.

**Provider routing (final state):**
- `newsThreadAnalysis` → **Gemini 2.5 Flash (free)** — 13s pacing between calls, MAX_TOKENS=6000, trailing-comma JSON fix, daily 06:30 UTC
- `newsInvokeGemini-dev` → **DeepSeek V4 Flash** (`deepseek-chat`) — every 4h (was 2h)
- `NewsProjectInvokeAgentLambda-dev` → **DeepSeek V4 Flash** — every 4h at :05 (was 2h)
- `newsCountryIntelligence` → **DeepSeek V4 Flash** — daily 07:00 UTC (was 3×/day)
- `newsSystemsAnalysis` → **DeepSeek V4 Flash** — daily 07:15 UTC (was broken on Grok)
- `newsPostDevTo` → **DeepSeek V4 Flash** — Daily Brief working; Dev.to publish ⚠️ 401 (key expired)

**Code fixes:**
- `newsThreadAnalysis/src/index.js` — added `sleep()` pacing + `INTER_CALL_DELAY_MS` env var, `stripCodeFence()` trailing-comma stripper, `MAX_TOKENS` env-driven
- `NewsProjectInvokeAgentLambda/src/index.js` — fixed summary preamble: added "Write directly — do not preface with any introduction" to `buildSummaryPrompt()`
- `newsInvokeGemini/src/index.js` — made `baseURL` env-driven with `/chat/completions` strip logic for OpenAI SDK compatibility
- `newsPostLinkedin/src/index.js` — **Nostr removed** (wrong key format, no longer needed): removed `require('nostr-tools')`, platform registration, `postToNostr()`, `publishToNostrRelay()`. Active platforms: LinkedIn, Bluesky, Farcaster, Mastodon, Telegram.

**Schedule changes:**
- `newsInvokeGemini-dev`: every 2h → **every 4h** (`cron(0 */4)`)
- `NewsProjectInvokeAgentLambda-dev`: every 2h → **every 4h** (`cron(5 */4)`)
- `newsCountryIntelligence`: 3×/day → **1×/day 07:00 UTC** (`cron(0 7)`)

**Quality audit:** DeepSeek V4 output assessed vs Grok — predictions and trace causes at analyst level. See `DEEPSEEK_QUALITY_AUDIT.md`.

**Projected cost:** ~$8-10/mo (down from $25/mo). DeepSeek V4 Flash: $0.14/M input · $0.28/M output. Monitor at https://platform.deepseek.com/usage

**Known issues remaining:**
- `linkedInAutoPost` LinkedIn OAuth token expired — needs re-auth
- `newsPostDevTo` DEVTO_API_KEY 401 — key may need rotation on Dev.to dashboard
- OpenRouter model `deepseek/deepseek-r1:free` removed — affects optional Dev.to prose overview only

---

## 2026-04-28 (Fix: newsSensitiveData topics — finish SWR contract)

### Backend (DEPLOYED to Lambda `newsSensitiveData-dev` ap-northeast-1 2026-04-27)
- **`amplify/backend/function/newsSensitiveData/src/index.js`** — `readTopicsCache()`: when cache is past `TOPICS_CACHE_MAX_AGE_SECONDS`, now returns `200 / success:true / cached:true / stale:true / asOf:<updatedAt>` instead of `503 / success:false`. Fresh path also gains `stale:false / asOf` so the response envelope is consistent.
- **Why:** `useGeminiTopics.js` already had `setIsStale(Boolean(data?.stale))` and the "⚠️ Updated X ago (refreshing...)" UI in Home, but the topics path never set the flag — frontend's stale UI was dead code on a 503 path that landed in the catch block. TTL inflation to 9000s (vs the original `continue-news.md` plan of 5400s) had been hiding the contract gap by making stale responses rare.
- **Verified end-to-end via curl:** fresh path → `stale:false`, 11 topics. Forced-stale path (TTL flipped to 60s temporarily) → `stale:true`, 11 topics. TTL restored to env-default (code default 9000s).
- **Genuine cache-miss (Item null) still returns 503** — only the staleness branch flipped.
- **Deferred:** `STALE_HARD_CEILING_SECONDS` (suggested 86400) so genuine multi-day pipeline outages still surface as real 503s instead of multi-day-stale "Today's Topics."
- **No frontend rebuild needed** — hook already speaks this protocol.
- **Doc updated:** `continue-news.md` now has a Status section reflecting actual ship state.

---

## 2026-04-28 (Fix: CountryPage Causal Graph — threadId strings + NaN% confidence)

### Frontend (DEPLOYED to /docs/ 2026-04-28)
- **CountryPage.jsx** — Causal Graph in right rail had two bugs that surfaced as "raw threadId-… → undefined NaN% mechanism" cards:
  - `fromNode.title` referenced a field that never existed on systems-analysis nodes; correct field is `nodeMap[id].summary`. Without the fallback this rendered raw threadIds.
  - `e.confidence` is a string label (`'strong'`/`'medium'`/`'weak'`), not a 0-1 float. `Math.round(string * 100)` produced `NaN%`. Now rendered as label text with color coding (strong=risk-h, medium=accent, weak=ink-faint).
- Applied the same stacked-card layout as the prior WorldMapV2 fix (from-summary → arrow column with lag + confidence label → to-summary → dashed mechanism footnote).
- **Commit:** `b0f84bc`

---

## 2026-04-27 (Tail-end fixes: country kicker link + map search bar position)

### Frontend (DEPLOYED to /docs/ 2026-04-27)
- **Home: country in topic kicker links to /weekly/country/:name** (`379c63e`). Inline link styling (color:inherit, hover underline 2px below baseline) — distinct from the chip-style country links on DailyPage which suit card contexts; the kicker is a flowing breadcrumb-style metadata line where a chip would compete with the TRENDING/URGENT badges.
- **WorldMapV2: search bar moved from absolute overlay to document flow** (`e4a1d99`). `.mv2-search` was overlapping the map (z-index conflict + visual clutter); moved into `.mv2-mapwrap` between title bar and map. Dropdown still uses `position:absolute` relative to `.mv2-search` so it floats over the map when typing.

---

## 2026-04-27 (Feature: Home v2 redesign — incremental rebuild + EditorialShell full-bleed)

### Context
First attempt (caa67a0) was a from-scratch rewrite that silently removed several production features (cache-miss retry logic with MAX_RETRIES=6, expandable sources panel, Google News fallback, filteredArchiveEntries dedup, Buy Me a Coffee CTA). User caught it. Reverted as e4e5848 and redone as 7 small, additive commits that preserve every existing feature.

### Commits (in order)
- **`6511e9c`** Step 1: add StatusStrip chrome at top — pure addition, no logic changes
- **`e8718a0`** Step 2: surface TRENDING badge (`x_trending` was generated every batch but unused) + rename BREAKING → URGENT for consistency with Thread/Country pages + prefer `primaryCountry` over `regions[0]`
- **`e99dab3`** Step 3: add outlet count to topic meta line (`N sources · M outlets`, dedup outlets client-side from sources[].source)
- **`be8ad9a`** Step 4a: add `mode='float'|'rail'` prop to TodayArchiveSidebar — rail mode renders search/chips/grouped list inline without floating chrome; float mode (default) preserves existing behavior. WorldMap.jsx still uses float mode.
- **`2d41a1a`** Step 4b: add `mode='float'|'rail'` prop to TopicNav — same pattern, IntersectionObserver scroll-spy preserved in rail mode
- **`992830d`** Step 4c: cutover Home to `<EditorialShell strip={StatusStrip} left={TodayArchiveSidebar mode=rail + Buy Me a Coffee} right={TopicNav mode=rail}>`. Buy Me a Coffee moved to left rail bottom (mustard yellow `#FFC621` button). All AI handlers, retry logic, sources panel, Google News fallback, ArchiveTopicModal preserved.
- **`2161345`** Step 5 cleanup: removed redundant `home-meta` inline LIVE strip from masthead (duplicated StatusStrip), unused `getTimeAgo()`, unused `generatedDate` destructure, dead `.home-page` / `.home-meta*` / `.home-support` CSS rules. −94 lines net.
- **`027f9f3`** EditorialShell full-bleed: single line in `atoms.css` (`.gp-main:has(.es-shell) > .container { max-width: 100%; padding: 0; }`) makes Home, Weekly, Countries, Country pages all escape Layout's 1200px container cap. Center column reading width unchanged (per-page `.es-center` max-width still applies); only side rails get their full intended width on >1200px viewports. Mirrors WorldMapV2's existing escape pattern.

### Reverted
- **`caa67a0`** (REVERTED via `e4e5848`) — first Home v2 rewrite. Removed retry logic, sources panel, Google News fallback, filteredArchiveEntries dedup, Buy Me a Coffee. Lesson recorded as `feedback_no_unauthorized_removal.md`.

### Hidden data now surfaced on Home
- `topic.x_trending` — red TRENDING badge (Grok generates per batch, was previously discarded)
- `topic.urgency === 'high'` — URGENT badge (was BREAKING, renamed for consistency)
- `topic.primaryCountry` — Change C field, used in kicker
- Outlet count derived client-side from sources[]

### Known issues / deferred
- Mobile (<900px) hides left rail entirely (EditorialShell behavior); archive no longer accessible on mobile via Home. Step 7 (deferred) could add a floating archive pill fallback on mobile.
- Step 6 (deferred): convert `SummaryDisplay`/`PredictionDisplay`/`TraceCauseDisplay` to render `splitToBullets()` cards (Brief.html visual). Skipped because user prefers preserving prose rendering for now.

---

## 2026-04-27 (Feature: Home v2 redesign — 3-col EditorialShell, Brief.html design)

### Frontend (DEPLOYED to /docs/ 2026-04-27)
- **Home.jsx** — full v2 rewrite using `EditorialShell` 3-col layout. Replaces the standalone masthead + topic feed layout.
  - **Left rail (Today's Archive)**: search input + ALL category filter chips (12 categories per recent rebalance) + scrollable archive grouped by category. Items deep-link to `/weekly/thread/:threadId` if available, else jump-anchor to topic on the page.
  - **Center**: StatusStrip (topics · trending · archive · updated) → masthead (date kicker + Fraunces 46px h1 + italic dek) → region sections grouped via `categorizeTopicsByRegion()` (World pinned last).
  - **Right rail (jump-nav)**: per-region topic preview list with IntersectionObserver scroll-spy (rootMargin -30%/-60%) — active region row highlights as user scrolls. Each topic row shows category + `trending` badge if `x_trending`.
- **Topic card v2**: kicker now surfaces `x_trending` (red TRENDING badge — was generated but never displayed) + `urgency: 'high'` (URGENT badge) + `primaryCountry || regions[0]`. Meta line: `N sources · M outlets` (no per-topic timestamps — single batch updatedAt lives in StatusStrip). Title links to `/weekly/thread/:threadId` when available, else plain text. Added **SaveButton** for consistency with Thread/Country pages.
- **AI button toggle**: Summary/Predict/Trace Cause now render as inline bullet cards (not full-text paragraphs). Bullets derived client-side via `splitToBullets()` regex helper — no Grok prompt change. Read-time estimate (`~Xs read`) computed from word count at 250 wpm. Removed legacy `SummaryDisplay`/`PredictionDisplay`/`TraceCauseDisplay` components from Home (still used elsewhere if referenced).
- **Home.css** — full rewrite with `.hb-*` namespace (HomeBrief). Color tokens: AI summary=blue, predict=purple, trace=green. Match Brief.html design exactly.

### Bundle impact
- index.js 979kB → 957kB
- index.css 191kB → 186kB

---

## 2026-04-27 (Feature: Country search bar on WorldMapV2)

### Frontend (DEPLOYED to /docs/ 2026-04-27)
- **WorldMapV2.jsx** — Added floating country search overlay at top-center of the map. Survives left rail collapse (positioned absolute on `.mv2-map`, z-index 20). Searches both `nameToISO` (TopoJSON canonical names, ~177 countries) and `EXTRA_ALIASES` (e.g., "us" → United States). Match ranking: prefix matches first, then substring matches, then alphabetical. Caps at 8 results.
- **WorldMapV2.jsx** — Keyboard: Enter selects first match, Esc clears + blurs. Click-outside (onBlur) closes dropdown after 150ms delay so onMouseDown selection still fires. Selecting a match calls `handleCountryClick(iso)` (existing fn), force-opens the right detail panel.
- **WorldMapV2.jsx** — Empty state: shows `No country matches "<query>"` when query has no hits.
- **WorldMapV2.css** — Added `.mv2-search`, `.mv2-search-row`, `.mv2-search-input`, `.mv2-search-clear`, `.mv2-search-dropdown`, `.mv2-search-match`, `.mv2-search-name`, `.mv2-search-iso`, `.mv2-search-empty` styles. Focus state: ink border + stronger shadow. Width: `min(320px, calc(100% - 120px))` so it doesn't collide with corner toggles.

## 2026-04-27 (Fix: WorldMapV2 Lens controls — Signal level + Time window)

### Frontend (DEPLOYED to /docs/ 2026-04-27)
- **WorldMapV2.jsx** — Signal level checkboxes (High/Elevated/Quiet) had no `onClick` handlers. They looked clickable but did nothing. Added `signalFilters` state (`{H,E,L}` defaulting to all true) + click handlers that toggle each bucket. Filtering now applied to: country fill (filtered buckets fall back to neutral `#f2efe8`), signal markers (skip render if bucket filtered), and "Top signal this week" leaderboard. Pill colors fade to 0.4 opacity when off.
- **WorldMapV2.jsx** — Time window section was always visible but `timeWindow` state only filters `pairAnalyses` in the flows lens — toggling it on the risk lens silently did nothing. Wrapped Time window block in `{lens === 'flows' && ...}` so it only appears where it has effect. Counts now show actual pair-analyses-in-window numbers.
- Added `signalFilters` to drawMap effect dependency array so map redraws when filter changes.

## 2026-04-27 (Fix: Causal Graph readability + IAM logging fix for newsSystemsAnalysis)

### Backend (IAM)
- **newsSystemsAnalysis log group** — fixed missing CloudWatch Logs permission. Lambda was using a borrowed role (`newsCountryIntelligence-role-xqboqh2y`) whose logs policy was scoped to a different function ARN, so log group `/aws/lambda/newsSystemsAnalysis` was never created and the 1 prior error was invisible. Added `/aws/lambda/newsSystemsAnalysis:*` to role's logs permissions. Lambda re-invoked → log group auto-created → Iran graph regenerated cleanly (15 nodes, 7 edges, 0 errors).

### Frontend (DEPLOYED to /docs/ 2026-04-27)
- **WorldMapV2.jsx** — Causal Graph section was rendering raw threadId strings (`thread-trump-issues-expletive-filled--436f45`) for `from`/`to`. Fixed by building `nodeMap` from `systemsData.nodes` and showing the node `summary` as the human-readable title. Falls back to a slug-cleaning function if the node is missing.
- **WorldMapV2.jsx** — Layout restructured from cramped one-line `from → mechanism → to` into a stacked card: `from` title → arrow column with `Nd lag · confidence` (color-coded: strong=red, medium=amber) → `to` title → mechanism in italic dashed-bordered footnote.
- **WorldMapV2.css** — Added `.mv2-causal-edge`, `.mv2-causal-from/to`, `.mv2-causal-arrow`, `.mv2-causal-arrow-line`, `.mv2-causal-meta`, `.mv2-causal-mech` styles.

## 2026-04-27 (Audit: category rebalance confirmed via DynamoDB)

### Verification
- Queried `NewsCache` DynamoDB table directly to audit topic category distribution across two days
- **2026-04-25** (pre-rebalance pipeline run, before new Grok prompt rules took effect): 50 entries, 5 categories — politics 29, conflict 15, economy 3, military 2, disaster 1 (politics+conflict = 88%)
- **2026-04-26** (first full run under new rules): 50 entries, 11 categories — conflict 14, politics 11, energy 5, disaster 4, climate 4, health 3, society 2, science 2, business 2, technology 2, military 1 (politics+conflict = 50%)
- **Finding:** politics+conflict share dropped 38 percentage points in one day; all 5 new categories (climate, science, business, society, energy) appeared immediately
- **Also confirmed:** `TOPICS_LIMIT` AWS env var is set to `13` (not 15) — the `DEFAULT_LIMIT=15` in source code is overridden by env var; to raise live topic count, update the env var in AWS Lambda config

---

## 2026-04-26 (Feature: ThreadPage + CountryPage v2 redesign — 3-col EditorialShell)

### Frontend (DEPLOYED to /docs/ 2026-04-26)
- **ThreadPage.jsx** — full v2 rewrite using `EditorialShell` 3-col layout (240px left / 1fr center / 320px right). Left rail: breadcrumbs + related threads by category/region. Center: `StatusStrip` + thread header with `riskScore`/`sentiment` in meta + 4-stat row + content tabs (Timeline/Actors/Sources). Right AI rail: 4-tab AI panel (Summary/What's Next/Trace Cause/Watch) + Key Actors section + Live Web Evidence. All new backend fields wired: `inflectionTopicId`, `riskScore`, `sentiment`, `keyActors`, `groundingSources`.
- **ThreadPage.css** — added CSS for left rail (`.tp-left`, `.tp-related`), AI rail (`.tp-ai-rail`), content tabs (`.tp-content-tabs`), actor cards/rows (`.tp-actor-card`, `.tp-actor-row`), sources tab (`.tp-source-row`), watch list (`.tp-watch-list`), grounding cards (`.tp-grounding-card`).
- **CountryPage.jsx** — full v2 rewrite using `EditorialShell` 3-col layout. Left rail: breadcrumbs + top-countries nav (6 rows) + filter facets (All/Anchor/Linked by thread type, category, urgency) + actor chips from `intel.keyActors`. Center: existing header + 4-stat strip (now shows `anchorCount`/`linkedCount`) + tabs. Story Arcs tab: thread cards now labeled **ANCHOR** (country is primary) / **LINKED** (country mentioned) + story arc summary snippet + thread-level risk score from `threadAnalyses`. Right rail: Key Actors (from `intel.keyActors`) at top, then risk assessment + watch signals + causal graph + markets/FX.
- **CountryPage.css** — added CSS for left rail navigation (`.cpg-left`, `.cpg-country-nav`, `.cpg-facet`, `.cpg-actor-chips`), arc card enhancements (`.cpg-arc-type`, `.cpg-urg-badge`, `.cpg-arc-card-sum`), right rail actors (`.cpg-actor-row`, `.cpg-actor-av`), shell customizations.

### Backend (deployed earlier this session)
- **newsThreadAnalysis** — added 4 new prompt fields: `inflectionTopicId`, `riskScore` (0-100), `sentiment` (-1 to +1), `keyActors` (top 5 `{name, role, mentionCount}`).
- **newsCountryIntelligence** — added `keyActors` (top 8 `{name, role, threadCount}`) to country briefings. Bumped `MAX_COUNTRIES` 10→20.

## 2026-04-26 (Fix: macro fields rendered as {value,year} objects crash React)

### Bug fix
- **CountryPage.jsx**, **WorldMapV2.jsx** — World Bank macro fields (`gdp`, `cpi_yoy`, `unemployment`, `debt_to_gdp`) are stored as `{value, year}` objects by `newsMarketsData`. Both components were rendering them directly as React children. Fixed by extracting `.value` before formatting.

## 2026-04-26 (Data gap fix: expand country intelligence to top 20 + map empty state)

### Backend
- **newsCountryIntelligence** — bumped `MAX_COUNTRIES` from 10 → 20; redeployed Lambda + triggered backfill run to generate AI briefings for up to 20 most-covered countries.

### Frontend (DEPLOYED to /docs/ 2026-04-26)
- **WorldMapV2.jsx** — added "NO AI BRIEFING YET — NEEDS MORE COVERAGE" mono hint in panel when selected country has no intelligence record (not loading, not found). Replaces silent "—/100" gap.
- **WorldMapV2.css** — added `.mv2-no-intel` style for the hint.

## 2026-04-26 (Tests: redesign smoke + deep fixture tests; fix entryShortTitles bug)

### Bug fix
- **WeeklyPage.jsx** — `entryShortTitles` micro-headlines never rendered: code read `item.date` but real schema uses `item.topicId`. Fixed to iterate by insertion order and deduplicate by `shortTitle`.

### Tests
- **src/test/redesign.test.jsx** (new) — 21 deep render tests for WeeklyPage + CountryListPage using real production fixtures. Tests cover: StatusStrip, EditorialShell 3-col, left/right rail elements, search filter narrowing, sort active state, StoryCard micro-headlines, CountryCard headlines + leaderboard links.
- **tests/fixtures/** (new) — real data from production API: `archive.json` (7-day archive), `thread_analyses.json`, `country_intelligence.json`. Used as fixture source of truth.

## 2026-04-26 (Redesign v2: shared atoms + WeeklyPage + CountryListPage)

### Frontend (DEPLOYED to /docs/ 2026-04-26)

- **src/components/atoms/** — New atom library for v2 editorial design system:
  - `Sparkline.jsx` — inline SVG mini-chart + `RiskSparkline` convenience wrapper
  - `StatusStrip.jsx` — 34px mono "LIVE · N arcs · updated Xm ago" top bar
  - `RiskDeltaPill.jsx` — 24h riskScore delta pill (↗ +5 / ↘ -3), reads `dateKey` or `date`
  - `MacroChip.jsx` — compact GDP $24T · CPI 3.1% inline chip from markets data
  - `RiskScoreBadge.jsx` — 0-100 numeric or enum level badge with risk-color coding
  - `EditorialShell.jsx` — 3-col grid shell (240px left / 1fr center / 320px right), responsive
  - `atoms.css` — all atom styles in one import
- **App.jsx** — imports `atoms.css` once at root
- **WeeklyPage.jsx** — 3-col EditorialShell layout: filters + period/sort/region in left rail, compact FeaturedSection ("Rising This Week") in right rail. StoryCard now surfaces `entryShortTitles` as bullet micro-headlines (prefer over summary hook when analysis available). StatusStrip at top.
- **WeeklyPage.css** — Added v2 rail + compact featured + micro-headline styles
- **CountryListPage.jsx** — Full redesign: EditorialShell 3-col (search/sort/region left rail, highest-risk + most-covered leaderboard right rail, card grid center). CountryCard uses RiskScoreBadge + trajectory arrow + headline + riskSignals[0].
- **CountryListPage.css** — New stylesheet for redesigned CountryListPage

## 2026-04-26 (WorldMapV2 — map polish: hierarchy, layout, leaderboard)

### Frontend (DEPLOYED to /docs/ 2026-04-26, commits cb2683f → 1d2d4ff)

- **WorldMapV2.jsx** — flows slug fix: `pair_analyses_list` returns no `countries[]` field, only `slug` (e.g. `iran-and-saudi-arabia`). Both `realFlows` and `liveDetail` link generation now parse slug by splitting on `-and-` and replacing hyphens with spaces. Arcs and cross-country links now render correctly.
- **WorldMapV2.jsx** — Flow Type checkboxes (FX/Capital, Technology, Geopolitics) now toggle arc visibility in the Flows & Links lens. Time Window radios (7d/30d) filter pair analyses by `generatedAt`. Default window changed to 30d because pair analyses run weekly (7d window filtered everything).
- **WorldMapV2.jsx** — Added `ResizeObserver` on map container — SVG redraws to correct dimensions whenever panel or rail collapses/expands.
- **WorldMapV2.jsx** — Two-tier signal markers: top 5 countries by |z-score| get large dot (r=8) + halo + always-visible full label; ranks 6-15 get small ambient dot (r=4) + ISO-only label, hover reveals full label; rank 16+ gets tiny tail dot (r=2.5), no label. Eliminates cluster clutter in Europe/Middle East.
- **WorldMapV2.jsx** — Right panel empty state replaced with "Top signal this week" leaderboard: 5 numbered rows with risk-colored circles, country name (Fraunces serif), z-score kicker, 7d article count, top topic excerpt. Clicking a row selects the country.
- **WorldMapV2.css** — Map container changed from `min-height` to `height: calc(100vh - 90px)` so CSS grid `1fr` row resolves to a definite height and the Equal Earth aspect-ratio clamp `(100% / 2.05)` works correctly.
- **WorldMapV2.css** — Added `:has(.mv2)` rules to strip Layout shell padding (`2rem`) and container `max-width: 1200px` when the map is mounted, giving the map full-bleed width with no dead zone above it.
- **WorldMapV2.css** — Added CSS classes `lbl-headline`, `lbl-ambient`, `lbl-hover` for signal marker tiers. Hover on ambient markers reveals full label and hides ISO-only label.

## 2026-04-26 (WorldMapV2 — data gap closure, promoted to /map)

### Frontend (DEPLOYED to /docs/ 2026-04-26)
- **WorldMapV2.jsx** — removed all mock constants (COUNTRY_DATA, COORDS, FLOWS, DETAIL, DEFAULT_DETAIL). Country coverage now dynamic from TopoJSON world-atlas (~177 countries). Dynamic `nameToISO` / `isoToName` / `isoToCenter` maps built after TopoJSON load so `useCountrySignal` binds any country in the archive. Comprehensive `NUM_TO_A3` table covers all UN M.49 numeric codes.
- **WorldMapV2.jsx** — wired 4 backend hooks for selected country: `useCountryIntelligence` (riskScore, headline, trajectory, riskSignals, groundingSources), `useCountryHistory` (sparkline), `useSystemsAnalysis` (causal graph top 3 edges), `useMarketsCountry` (GDP/CPI/unemployment/debt snapshot).
- **WorldMapV2.jsx** — right panel updated: risk level pill in header, risk score stat + sparkline, intel headline + trajectory, risk signals list, causal graph cards, markets snapshot grid, web evidence cards. Panel now scrolls.
- **WorldMapV2.jsx** — urgency halo: pulsing SVG ring on map for any country with `urgency: high` topic in last 24h (`primaryCountry` or regions[0]). CSS `@keyframes pulse-halo` added.
- **WorldMapV2.jsx** — flows lens shows empty state when no pair analyses instead of mock arcs. Editorial lens shows empty state when signal data loading.
- **WorldMapV2.jsx** — preview banner removed.
- **App.jsx** — `/map` route now uses `WorldMapV2`; old `WorldMap` import removed; `/map-v2` preview route removed.
- **WorldMapV2.css** — panel changed from `overflow: hidden` to `overflow-y: auto`; urgency halo keyframe animation added.

## 2026-04-26 (Redesign v2 — Backend data layer, Changes A–F)

### Backend Lambdas (deployed via aws lambda update-function-code)
- **NewsProjectInvokeAgentLambda-dev** — Change A: persists prediction research briefing as new SK `RESEARCH_BRIEFING` (was generated then discarded). Change B: prediction + trace_cause prompts now output strict JSON; `normalizeJsonResponse()` strips code fences + validates; items tagged `contentFormat: 'json' | 'markdown'`. New schemas: prediction `{scenarios[{label, probability_range, horizon, rationale, triggers[]}], winners[], losers[]}`; traceCause `{proximate, contributing[], structural, impactScores, biasNote, alternativePerspective, signalVsNoise}`.
- **newsInvokeGemini-dev** — Change C: topic objects now include `urgency` ("high"/"medium"/"low"), `urgencyReason`, `primaryCountry` (anchor), `mentionedCountries[]`. Each source gets `tier: "primary"|"secondary"`. Mapper validates and passes new fields through.
- **newsCountryIntelligence** — Change D: prompt now produces numeric `riskScore` (0-100, calibrated to riskLevel buckets). `writeAnalysis()` writes both the existing `COUNTRY_INTELLIGENCE` SK and a new `HISTORY#{YYYY-MM-DD}` SK snapshot with `{riskLevel, riskScore, trajectory, headline}`, TTL 90d. Change E: persists `groundingSources` from Brave search.
- **newsThreadAnalysis** — Change E: persists `groundingSources` from Brave news + web grounding.
- **newsSensitiveData-dev** — exposes new actions: `research_briefing` (Change A), `country_history` (Change D, uses QueryCommand, returns up to 90 snapshots descending), `systems_analysis` (Change F, exposes existing `SYSTEMS#{country}` data).

### Frontend (DEPLOYED to /docs/ 2026-04-26 after Lambda cycle confirmed)
- **PredictionDisplay.jsx** — JSON-only renderer (legacy markdown path removed). Scenario cards with probability range badge, horizon, triggers, winners/losers tab. Header renamed "Scenario Forecast". Unparseable content shows "Forecast generation failed — please retry."
- **TraceCauseDisplay.jsx** — JSON-only renderer (legacy markdown path removed). Cause Chain nodes (Proximate/Contributing/Structural), Impact bars, Counter Reading tab, signal/noise verdict banner. Unparseable content shows "Analysis generation failed — please retry."
- **Home.jsx + Home.css** — BREAKING urgency pill on topics with `urgency === 'high'`.
- **ThreadPage.jsx** — BREAKING pill in header kicker; "bg" mono label on secondary sources; "Live Web Evidence" section above timeline when grounding sources exist.
- **CountryPage.jsx** — Risk score stat now shows numeric `riskScore` with inline SVG sparkline when ≥2 history snapshots; "Live Web Evidence" rail card; new "Causal Graph" rail section showing top 5 systems-analysis edges with mechanism + lagDays + confidence.
- **New hooks**: `useResearchBriefing.js`, `useCountryHistory.js` (1hr cache), `useSystemsAnalysis.js` (1hr cache).
- **restProxy.js** — added `fetchResearchBriefingCache()`, `fetchCountryHistory()`, `fetchSystemsAnalysis()`.

### What's still pending
- Frontend build → /docs/ deploy (held back pending review)
- v2 frontend layout work (EditorialShell + 3-col + atoms) per REDESIGN_V2_PLAN.md
- Change G (model tiering) — deferred
- One-line fixes: ACLED lat/lng query field, newsMarketsData quarterly macro history

## 2026-04-25h (Redesign A8 — Map page redesign)

### Frontend — WorldMap.jsx + WorldMap.css (A8 complete)
- Full map page redesign matching Map Redesign.html (Direction A editorial + SaaS chrome)
- New full-viewport layout: `wm-page` fills 100vh minus nav/strip/footer — map fills all available space
- Page header: mono kicker "Live Intelligence Map" + Fraunces 24px serif h1 + right-side mono stats row (topics · countries · connections)
- 2-col body: `wm-rail` (240px left sidebar) + `wm-map-area` (flex:1)
- Left filter rail: category checkboxes with custom `wm-rail-chk-box` (checked state via CSS), color pill dots, count in mono, reset button; + legend section + info blurb
- Map canvas: `wm-canvas` fills full height, contains story banner (ink bg pill, mono text) + stats overlay (bottom-left, glass card) + map shell
- Story banner redesigned: dark pill with mono font, "← Clear" button replaces old arrow
- Removed: old `.card` header wrapper, `useNavigate`/`canGoBack` (unused after removing back button), `legendOpen` state, `TodayArchiveSidebar` (removed from layout), old `.map-story-banner` / `.map-legend` / `.map-stats` overlay HTML
- Kept: all map logic unchanged (MapComponent, FallbackMapComponent, buildMapData, story flow highlighting, archive markers, category filtering), MapSidePanel flyout

## 2026-04-25g (Redesign A7 — Country page redesign + markets wired)

### Frontend — CountryPage.jsx (rewritten) + CountryPage.css (new)
- Full Country page redesign matching Country Detail.html (Direction A editorial + SaaS chrome)
- Map hero: 52vh full-width map with floating overlay (back link + country selector + risk/trajectory pills)
- Country header: ISO badge mono kicker, Fraunces 56px serif h1, italic serif dek (from intel.headline), mono meta row, share/copy/save actions
- Stats strip: 4-col border-separated grid — articles / story arcs / days tracked / risk level (with Fraunces 28px numerals)
- 2-col layout: main (1fr) + sticky right rail (320px)
- Main tabs: Situation (bluf + why it matters + background timeline + trajectory/cross-thread accordions) | Story Arcs (expanded card list) | Coverage (full article list)
- Right AI rail (sticky): risk dots indicator + trajectory, watch signals, macro snapshot (GDP/CPI/unemployment/debt-to-gdp from useMarketsCountry), FX rates — all with `asOf` timestamps per honesty contract
- Markets data (useMarketsCountry hook) wired into right rail — gracefully empty when data not yet available
- Removed: SideNav, SectionNav, WeeklyPage.css structural classes (kept for inner CoverageList/cp-deep components), ArcSection accordion (replaced by expanded card list), explainer banner
- Kept: CoverageList (full article browser with filters), BackgroundTimeline, BoldText, all AI analysis sections

## 2026-04-25f (Redesign A6 — Thread page redesign)

### Frontend — ThreadPage.jsx (rewritten) + ThreadPage.css (new)
- Full Thread page redesign matching Thread Detail.html (Direction A editorial)
- Topbar: mono breadcrumb (Home / Threads / title) with share/copy/save in right rail
- Header: mono kicker + category badge, Fraunces 38px serif h1, italic serif dek (first sentence of storyArc), mono meta row (date range · updated · category · regions)
- Stats: 4-box grid — articles / days tracked / regions / sources — Fraunces 26px numerals
- Region chips: mono pill links to country pages
- Body: 2-col grid (main content 1fr | sticky AI rail 360px)
- Main column: watch questions list (dashed rows, ? prefix) + timeline (CompactTimeline when analysis exists, tp-tl rows fallback) + map wrapper
- AI rail: sticky panel capped at viewport height, live dot header, 3 tab buttons (How It Evolved / What's Next / Why It Happened), scrollable body, mono footer with timestamp
- Removed: SideNav, WeeklyPage.css, ThreadAnalysisSection accordion component
- Kept: CompactTimeline, WeeklyMap, StoryEntryCard, ShareButtons, CopyBriefing, SaveButton, TrialBanner, useUserProfile, fromCountry logic

## 2026-04-25e (Redesign A5 — Daily Brief page redesign)

### Frontend — DailyPage.jsx + DailyPage.css (A5 complete)
- Full Daily Brief redesign to newspaper broadsheet style matching Daily.html
- Masthead: mono top bar (Brief | GP™ | date), 72px Fraunces italic "Today's Brief", italic subtitle, stats bar (articles/countries/outlets)
- Lead story: 2-column grid — left has kicker pill + large serif h2 + italic deck + meta row; right has black-header AI Prediction box (uses topStories[0].prediction)
- Top Stories: numbered list (01, 02...) with 3-col grid (italic serif number, body kicker+h4+region links, prediction aside)
- Rising Thread: amber-bordered card with trajectory badge
- Country Watch: risk-colored border card
- Method: 4-col stat grid with Fraunces large numerals
- Category Breakdown: mono pill tags
- Removed: SideNav, WeeklyPage.css dependency, old card layout
- Kept: BoldText, ShareButtons, CopyBriefing, SaveButton, IntelligenceLoader, RISK_COLORS/CATEGORY_BADGE_COLORS imports

## 2026-04-25d (Redesign A4 — Home page redesign)

### Frontend — Home.jsx + Home.css (A4 complete)
- Full Home page redesign to match Brief.html (Direction A editorial soul)
- Masthead: Fraunces 52px serif h1, italic serif subtitle, mono meta pill (live dot · topic count · updated Xm ago)
- Region sections: serif h2 + 2px solid ink border-bottom, mono topic count
- Topic articles: mono kicker (Category · Country), serif h3 title, italic context paragraph
- AI action buttons: pill style (sum=blue/pre=purple/tra=green), dot indicator when active, spinner while loading
- Sources panel: collapsible inline source list with mono metadata
- Support banner: mono text + yellow Buy Me a Coffee button
- Stale/new-data alerts: mono pill banners (amber/green)
- Removed old card layout, CLI banner, "new features" banner — cleaner editorial focus
- All logic unchanged: summary/prediction/trace retries, graphqlService calls, SummaryDisplay/PredictionDisplay/TraceCauseDisplay components

## 2026-04-25c (Redesign A3 — new nav shell + status strip)

### Frontend — Layout.jsx + Layout.css (A3 complete)
- Rebuilt nav shell: 56px sticky top nav (3-column grid: brand | centered links | search + auth)
- Black rounded "G" logo + Fraunces serif wordmark with ™ superscript
- Nav links centered: Topics, Daily, Map, Threads, Countries — active state uses paper-2 bg
- Right rail: ⌘K search bar + Sign in / Account button
- Mobile: hamburger collapses all links into full-width dropdown
- 34px status strip (paper-2 bg, JetBrains Mono, live pulsing dot, topic count from cache)
- 26px footer bar (mono, two-column: tagline | nav links)
- All values from design tokens: --nav-h:56px, --strip-h:34px, --footer-h:26px, --paper-2, --risk-l, etc.
- Layout.css: new scoped `gp-*` class namespace — no conflicts with existing component CSS

## 2026-04-25b (newsSystemsAnalysis Lambda — Phase 1 causal graphs)

### Backend — newsSystemsAnalysis (NEW)
- New Lambda function for cross-domain causal relationship analysis within countries
- Reads 30-day archive; groups entries by threadId; identifies causal links between story threads
- Anti-hallucination: all edges must cite real topicIds, invalid IDs dropped post-LLM, edges capped per node
- Confidence levels: weak (inferential) / medium (2+ citations, 7+ day span) / strong (3+ citations + named mechanism)
- Output: `SYSTEMS#{country}` / `SYSTEMS_ANALYSIS` in `SummarizeAndPredict` DDB table
- Phase 1 restricted to `SYSTEMS_TEST_COUNTRIES=Argentina,Iran` env var (test only)
- First run verified: Iran produced 15 valid nodes, 8 edges tracing escalation sequence (threats → mediation → collapse → blockade)
- Timeout: 300s, Memory: 512MB

**Files added:** `amplify/backend/function/newsSystemsAnalysis/src/index.js`, `package.json`, CFN template

---

## 2026-04-25 (Topic mix rebalance: more climate, science, energy, business, society)

### Backend — newsInvokeGemini
- Expanded `VALID_CATEGORIES` from 7 → 12: added `climate`, `science`, `business`, `society`, `energy`
- Raised `DEFAULT_LIMIT` from 13 → 15 topics per run to support broader category coverage
- Added 4 new RSS feeds: Inside Climate News, Grist (climate), Ars Technica, MIT Technology Review (tech/science)
- Rewrote all Brave Search queries — stripped `"politics economy"` suffix from every query; added 3 queries targeting climate/energy, science, and business/society
- Rewrote Grok prompt: added rule 7 (25% category cap; minimum coverage for climate, science, society, energy, business) and rule 8 (reframed "significance" as material second-order impact, not political theater)
- Updated GOOD EXAMPLES to include diverse non-political topics
- Updated fallback prompt (no-articles mode) to include new categories and balance rule

### Frontend
- `WorldMap.jsx`: added color entries for 5 new categories; updated `CATEGORY_DISPLAY_ORDER`
- `WeeklyPage.jsx`: added badge color pairs for 5 new categories; updated `CATEGORY_ORDER` (removed stale `environment`, `culture`)
- `WeeklyMap.jsx`: updated `ORDER` to match new canonical category list

**Files modified:** `amplify/backend/function/newsInvokeGemini/src/index.js`, `src/components/WorldMap.jsx`, `src/components/WeeklyPage.jsx`, `src/components/WeeklyMap.jsx`

---

## 2026-04-22b (Hide Pair Intelligence from production)

### Feature Flag
- Removed "Pair Intel" nav link from Layout.jsx and /weekly/pairs + /weekly/pair/:slug routes from App.jsx
- Components, hooks, and backend remain intact — can be re-enabled by restoring routes

**Files modified:** `src/App.jsx`, `src/components/Layout.jsx`

## 2026-04-22 (Fix: intelligence visible to anonymous users)

### Bug Fix
- Removed auth guard from `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` hooks — these hooks were blocking the API fetch for unauthenticated visitors (incognito mode), showing "No archive data yet" even though the backend is fully public in early access mode. All three hooks now fetch without requiring a signed-in user.

**Files modified:** `src/hooks/useWeeklyArchive.js`, `src/hooks/useThreadAnalyses.js`, `src/hooks/useCountryIntelligence.js`

## 2026-04-11 (Google Analytics + Search Console sitemap)

### SEO & Discovery
- **Google Analytics:** GA4 measurement ID `G-VT6QENX4MB` installed in `docs/index.html` — tracking live events, user flow, engagement
- **Google Search Console:** Property verified and sitemap.xml submitted — `https://globalperspective.net/sitemap.xml` now discoverable by Google crawler
- **robots.txt:** serves from production, correctly references sitemap
- **Timeline:** Expect Google to crawl sitemap within 2-24 hours, first indexed URLs in 2-7 days

### Next steps for SEO
- Current sitemap lists 18 static pages; dynamic content (daily briefs, countries, threads) not yet in sitemap → consider auto-generating URLs from DDB keys for maximum coverage

---

## 2026-04-11 (RSS feed links to source articles instead of thread pages)

### Backend (`newsSensitiveData`)
- `generateRssFeed`: changed link strategy — items now link to the first source article URL (e.g., `aljazeera.com`) instead of thread pages. Preserves fallback to thread page if no sources, then site root.
- User experience: RSS readers (Feedly, Inoreader) now click through to the original article; readers still see our AI-generated description (BLUF, regions, sources).
- Note: Feedly-cached old items still link to thread pages; new items will link to sources. Cache will naturally refresh over 1-2 days.

---

## 2026-04-11 (Fix archive_range 502 + daily brief 7-day fallback)

### Backend (`newsSensitiveData`)
- `readArchiveRange`: strip archived entries to essential fields only (`topicId, title, category, regions, sources, threadId`) — previously returned full entries with AI summary/prediction/trace_cause text, pushing 30-day responses past Lambda's 6MB payload limit and causing 502 errors on WeeklyPage
- Added `threadId` to today's entry shape so latest and archive days have matching structure

### Frontend (`useDailyBrief`)
- Added 7-day fallback loop: when the requested date returns null data, hook tries the previous day, then the day before, etc. up to 7 days back
- Fixed cache to skip storing null results and to skip returning null from cache (prevents stale empty-state getting stuck)
- User experience: `/daily` now shows the most recent brief available instead of an empty page when today's hasn't been generated yet

### Cloudflare Worker (`globalperspective-rss`)
- `renderDailyPage`: extended fallback from 1 day to 7 days back — bots hitting `/daily` always get pre-rendered HTML with the latest available brief

---

## 2026-04-11 (Redesign Account page — tabs + saved items card grid)

### Frontend
- `Account`: tabs (Profile | Saved) with URL state (`?tab=`); default tab = Saved
- `SavedPanel`: card grid (2-col on desktop), type-color-coded left border, inline unsave with collapse animation, filter chips (All / Threads / Countries / Daily), relative timestamps
- `ProfilePanel`: same content, centered 520px inside wider 900px container
- New `Account.css` for tab, chip, and card styles + hover/animation

---

## 2026-04-11 (SaveButton heart icon — fix CORS duplicate headers)

### Frontend
- `SaveButton`: switched to heart icon (red #ef4444 filled when saved, outline when not), scale animation on saved state

### Backend
- `newsSavedItems`: removed CORS headers from Lambda code — Function URL CORS config handles it exclusively (fixes duplicate Access-Control-Allow-Origin browser error)

---

## 2026-04-11 (Add SaveButton to DailyPage)

### Frontend
- `DailyPage`: SaveButton next to brief headline (itemType=daily, itemId=dateKey)

---

## 2026-04-11 (Save/bookmark feature — newsSavedItems Lambda + DynamoDB)

### Backend
- New `newsSavedItems` Lambda with Function URL — save/unsave/list bookmarks per user
- New `GlobalPerspectiveSavedItems` DynamoDB table (PK: `uid`, SK: `itemType#itemId`)
- Firebase JWT auth; supports itemTypes: thread, country, daily, pair
- Lambda URL: `https://y57kgqdctggtjtieddcts2byke0madfd.lambda-url.ap-northeast-1.on.aws/`

### Frontend
- `restProxy.js`: added `saveItem`, `unsaveItem`, `fetchSavedItems` functions
- New `useSavedItems` hook — fetches from backend, in-memory cache per session
- New `SaveButton` component — bookmark icon (filled=saved, outline=unsaved), auth-gated
- `ThreadPage`: SaveButton in title area (itemType=thread)
- `CountryPage`: SaveButton in title area (itemType=country)
- `Account`: Saved items section lists all bookmarks grouped with links
- `docs/config.js`: added `window.SAVED_ITEMS_ENDPOINT`

---

## 2026-04-11 (Early access: remove all auth gates, remove Pricing page)

### Backend (`newsSensitiveData`)
- Removed auth gates from `daily_brief` (past dates), `narrative_thread`, `archive_range`, `thread_analysis`, `country_intelligence` — all content now public
- `archive_range` now allows up to 90 days for all callers (was capped at 7 for free tier)

### Frontend
- All content accessible without sign-in (auth/save still works for logged-in users)
- Removed gate UI from: WeeklyPage, ThreadPage, CountryPage, CountryListPage, WeeklyMap, DailyPage
- Removed `/pricing` route and nav link; `Pricing.jsx` kept in codebase
- Removed dead `/pricing` links from CLIPage, AboutContact, Contact, WhitepaperPage, Account, TrialBanner

---

## 2026-04-11 (Cloudflare Worker — RSS + bot pre-rendering + OG tags)

### Infrastructure

- **Cloudflare Worker `globalperspective-rss`** — deployed, routes: `globalperspective.net/*` + `globalperspective.net/rss*`
  - **RSS proxy:** `globalperspective.net/rss` → `newsSensitiveData ?action=rss`, 30 min edge cache
  - **Bot pre-rendering:** detects 25+ bot user-agents (Twitterbot, GPTBot, Googlebot, PerplexityBot, ClaudeBot, LinkedInBot, etc.)
    - `/weekly/country/:name` → POSTs `country_preview` to Lambda → returns full HTML with OG tags, real headline, situation summary, key developments, trajectory
    - `/weekly/thread/:id` → POSTs `thread_preview` to Lambda → returns full HTML with OG tags, thread title, story timeline
  - Human visitors always get the normal React app unchanged
  - **Impact:** rich social share previews on Twitter/LinkedIn/Slack; ChatGPT/Perplexity/Claude can now read and cite page content
- **`WORKER_FULL_CODE.md`** — full Worker source code on file
- **`RSS_CLOUDFLARE_TODO.md`** — migration runbook (complete)
- No DNS changes needed — domain already registered in Cloudflare (orange cloud already enabled)

---

## 2026-04-08 (Daily Intelligence Brief — full feature)

### Backend

- **`newsPostDevTo`** — repurposed as Daily Intelligence Brief generator:
  - Runs after Dev.to publish (wrapped in try/catch — brief failure never blocks Dev.to)
  - Reads thread analyses + country intelligence from `SUMMARIZE_PREDICT_TABLE`
  - Calls Grok to generate structured brief JSON (headline, summary, topStories[], risingThread, countryToWatch, categoryBreakdown, stats)
  - Stores as `DAILY_BRIEF#YYYY-MM-DD` / `DAILY_BRIEF` in `SUMMARIZE_PREDICT_TABLE`, TTL 90 days
  - New env vars: `SUMMARIZE_PREDICT_TABLE`, `XAI_API_KEY`, `GROK_MODEL`
  - **Deploy:** `newsPostDevTo-deploy.zip` (3.4MB) — upload + set env vars + trigger manually to seed first brief

- **`newsSensitiveData`** — added `daily_brief` action:
  - Today's date: **public** (no auth required, SEO indexable)
  - Past dates: **member-gated** (JWT required, resolveUserTier check)
  - Also added GET query param support (`?action=daily_brief&dateKey=...`)
  - **Deploy:** `newsSensitiveData-deploy.zip` (13MB)

### Frontend

- **`src/services/restProxy.js`** — added `fetchDailyBrief(dateKey)`:
  - Today → `proxyAction()` (public, no auth)
  - Past → `proxyActionWithAuth()` (JWT required)

- **`src/hooks/useDailyBrief.js`** — new hook:
  - 30-min localStorage cache keyed per dateKey
  - Max 7 cached days (oldest evicted)
  - Today doesn't require auth; past dates do

- **`src/components/DailyPage.jsx`** — new page at `/daily` and `/daily/:dateKey`:
  - Sections: Lead Story, Global Overview (BoldText), Top Stories (with one-line predictions + region links → CountryPage), Rising Thread (→ ThreadPage), Country to Watch (→ CountryPage), Category Breakdown + Stats
  - Prev/next day navigation arrows
  - Auth gate for past dates when not signed in (sign-in prompt)
  - ShareButtons + CopyBriefing
  - `page-with-sidenav` layout with SideNav anchors

- **`src/components/CopyBriefing.jsx`** — added `formatDailyBrief(brief)` export

- **`src/App.jsx`** — added routes `/daily` and `/daily/:dateKey`

- **`src/components/Layout.jsx`** — added "Daily Brief" nav link

### Pending Deploy Steps
1. Upload `newsPostDevTo-deploy.zip` → set env vars `SUMMARIZE_PREDICT_TABLE`, `XAI_API_KEY`, `GROK_MODEL`
2. Upload `newsSensitiveData-deploy.zip`
3. Trigger `newsPostDevTo` manually → verify DDB item `DAILY_BRIEF#today` + CloudWatch log
4. Build frontend + copy to `/docs/` + push

---

## 2026-04-08 (Data retention extended to 90 days)

- **DynamoDB TTL extended** from 31 → 90 days across 3 Lambdas:
  - `NewsProjectInvokeAgentLambda`: `DAILY_ARCHIVE_TTL_DAYS` 31→90
  - `newsThreadAnalysis`: `THREAD_TTL_DAYS` 31→90
  - `newsCountryIntelligence`: `COUNTRY_TTL_DAYS` 31→90
- **Enterprise archive access** extended: `ENTERPRISE_MAX_DAYS` 30→90 in `newsSensitiveData`
- **AI analysis windows unchanged** at 30 days — prevents Grok prompt bloat on long threads
- **Thread matching window unchanged** at 7 days
- **Member tier unchanged** at 7 days
- **Cost impact:** ~$0.02/month extra (18MB storage vs 6MB)
- **Deploy:** 4 Lambda zips

---

## 2026-04-08 (newsPostLinkedIn: font fix — map text now renders correctly)

- **Root cause found:** librsvg (used by sharp) does NOT support `@font-face`, woff2, or data URIs — only system TTF/OTF via fontconfig
- **Fix:** Bundle Inter TTF fonts (Regular, Bold, SemiBold) in `fonts/` dir → copy to `/tmp/fonts/` at Lambda cold start → write fontconfig pointing to `/tmp/fonts/` → set `FONTCONFIG_PATH` env var
- **Connection dots improved:** endpoint dots now have colored ring (r=5) + white center (r=2), thicker connection lines
- **LinkedIn token refreshed** via OAuth 2.0 tools (expires every 60 days)
- **Removed:** old woff2 files, base64 `@font-face` `<style>` injection (never worked with librsvg)

---

## 2026-04-05 (newsPostLinkedIn: map image generation for social posts)

- **New `mapImageGenerator.js`** — generates 1200x630 PNG map images per topic for social media
- **Features:** highlighted countries with glow effect, curved connection lines between involved countries, country name labels, category badge, source count, date stamp, logo branding
- **LinkedIn integration:** 3-step image upload (initializeUpload → PUT binary → attach imageUrn to post)
- **Bluesky integration:** uploadBlob → embed image in post record
- **Fallback:** if image generation or upload fails, posts text-only (existing behavior preserved)
- **Assets bundled:** `world-map-template.svg` (147 countries, ISO-coded paths), `logo_small.png` (60x60), `sharp` with Linux binary
- **Deploy:** `~/Downloads/newsPostLinkedIn-deploy.zip` (20MB)

---

## 2026-04-05 (Home page sidebar UI refresh)

- **Restyle TopicNav + TodayArchiveSidebar** to match the SideNav frosted-glass design from ThreadPage
  - Frosted glass background (`rgba(255,255,255,0.95)` + `backdrop-filter: blur(8px)`)
  - Lighter borders, compact padding, thinned scrollbars
  - Active state: solid black pill instead of blue tint / border-left accent
- **TopicNav now starts collapsed** (matching TodayArchiveSidebar behavior)
- **TopicNav region accordions** — topics grouped by region with collapsible headers instead of flat list with badges
- **Full topic titles** — 2-line CSS clamp replaces hard 35-char JS truncation
- Updated `TopicNav.jsx`, `TopicNav.css`, `TodayArchiveSidebar.css`

---

## 2026-04-05 (NewsProjectInvokeAgentLambda: two-pass prediction agent)

- **Two-pass prediction architecture** — Research Agent → Prediction Agent, inspired by IARPA Hybrid Forecasting Competition
- **Pass 1 (Research Agent, 800 tokens):** Gathers structured context before any prediction:
  - Historical precedents (2-3 analogous events with outcomes)
  - Key actors & motivations (3-5 decision-makers, what they want, constraints)
  - Upcoming deadlines (elections, summits, central bank meetings, treaty dates)
  - Balance of forces (who has initiative, leverage, momentum)
- **Pass 2 (Prediction Agent, 1500 tokens):** Receives topic + snippets + research briefing, generates:
  - 3 scenarios (Most Likely/Optimistic/Pessimistic) grounded in research precedents
  - Winners & Losers
  - 3 trigger signals referencing real upcoming deadlines from research
- **Research output is ephemeral** — not stored, only fed into prediction prompt
- **Per-topic cost:** 4 Grok calls now (summary 600 + trace_cause 600 + research 800 + prediction 1500) vs 3 before
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-05 (NewsProjectInvokeAgentLambda: structured prediction with 3 scenarios)

- **Prediction prompt rewritten** using structured analytic techniques (superforecasting / ACH methodology)
- **5 changes in one commit:**
  1. **Article snippets** now fed into prediction prompt (was only title + description; trace_cause already had this)
  2. **Historical precedent** — prompt asks for 2-3 analogous situations as base rate before predicting
  3. **3 scenarios with probabilities** — Most Likely (~60%), Optimistic (~20%), Pessimistic (~20%) with adjustable weights
  4. **Falsifiable trigger signals** — 3 specific events with real dates/deadlines instead of vague watchlist
  5. **max_tokens raised** from 600 → 1500 for predictions (summary/trace_cause unchanged at 600)
- **`invokeGrok()` updated** to accept per-call `maxTokens` parameter
- **Motivation:** User feedback that single-path predictions aren't credible; professional analysts always provide multiple scenarios
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-04 (NewsProjectInvokeAgentLambda: fix 403 crash bug)

- **Per-topic generation now wrapped in try/catch** — a Grok API 403 on one topic no longer crashes the entire run
- **Partial results published** — if 12/13 topics succeed, the pipeline still swaps staging → latest and writes archives
- **Swap skipped only if zero topics succeed** — prevents publishing empty data
- **Logs improved** — now reports failed count alongside generated count
- **Root cause:** `invokeGrok()` threw on 403, unwound to outer catch, skipped `swapStagingToActive()` entirely → frontend showed stale data 503
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-04 (newsSensitiveData: RSS feed endpoint)

- **New `rss` action** on `newsSensitiveData` Lambda — serves RSS 2.0 XML feed of daily topics
- **Supports GET requests** via `?action=rss` query param (for RSS readers) + POST body
- **Content:** Today's archive entries with AI summaries, regions, sources; falls back to `latest` topics
- **Each item includes:** title, category, description (AI summary + regions + sources), pubDate, link to thread page
- **Headers:** `Content-Type: application/rss+xml`, `Cache-Control: public, max-age=1800` (30min cache)
- **Public, no auth required** — RSS readers/platforms can subscribe directly
- **Self-referencing** `<atom:link>` auto-constructed from API Gateway request context
- **Deploy:** Lambda-only change, zip at `~/Downloads/newsSensitiveData-deploy.zip`
- **Next steps:** Submit feed URL to Feedly, Flipboard, Inoreader; add `<link rel="alternate">` to frontend HTML

---

## 2026-04-02 (newsInvokeGemini: expand RSS sources from 8 → 22)

- **14 new RSS feeds added** to `newsInvokeGemini` Lambda, tripling source diversity:
  - Americas: NPR World, CBC World
  - Europe: The Guardian, DW English, EuroNews (moved from Brave Search → RSS)
  - Africa: AllAfrica, Daily Maverick, The East African
  - Middle East: Middle East Eye, Al-Monitor (moved from Brave Search → RSS)
  - Asia: Channel News Asia, Nikkei Asia, Bangkok Post
  - Oceania: ABC Australia
- **Brave Search queries reduced** from 12 → 7 (removed Guardian, DW, EuroNews, Al-Monitor, generic Africa — all now covered by RSS)
- **Per-feed cap** added: `MAX_ARTICLES_PER_FEED = 8` to keep Grok prompt size manageable
- **Expected article pool:** ~200-250 articles (up from ~80), covering all major world regions
- **Brave fetch time reduced:** 7 queries × 2s = ~14s (down from ~24s)
- **Motivation:** User feedback that source count was too low and hard to trust
- **Deploy:** Lambda-only change, zip at `amplify/backend/function/newsInvokeGemini/deploy.zip`

---

## 2026-04-02 (IntelligenceLoader: animated loading screens)

- **New component: `IntelligenceLoader.jsx` + `IntelligenceLoader.css`** — reusable dark-background loading animation component with two modes:
  - `type="typewriter"` — sentence typewriter effect with country name highlights → fades out → constellation of country nodes connected by co-occurrence edges. Used for data-heavy pages.
  - `type="explode"` — headline list shakes → explodes outward → words cluster by country → constellation. Reserved for future use (stored but not currently active on Home).
- **Showcase page: `/intelligence-map`** — existing tab page (A/B/C/D) serves as live preview of all 4 animation concepts. Tabs C (Typewriter) and D (Explode) are the ones extracted into `IntelligenceLoader`.
- **Applied to:**
  - `WeeklyPage.jsx` — replaces skeleton cards while archive loads (`type="typewriter"`)
  - `ThreadPage.jsx` — replaces `"Loading story arc…"` text (`type="typewriter"`)
  - `CountryPage.jsx` — replaces `"Loading…"` text (`type="typewriter"`)
  - `AuthCallback.jsx` — replaces `⏳ Signing you in…` gate (`type="typewriter"`)
- **Home.jsx** — `type="explode"` ready but reverted; loads too fast from cache to be useful now. Re-add with `<IntelligenceLoader type="explode" />` when needed.
- **Data source:** `useGeminiTopics()` (public, no auth, 1hr localStorage cache) — animation data available near-instantly on repeat visits. Falls back to simple spinner when no topics cached yet.
- **Exports:** `default IntelligenceLoader`, `AnimTypewriter`, `AnimExplode`, `buildGraph`

---

## 2026-04-01 (GEO: publish 3 long-form blog articles)

- **3 new blog articles** published for GEO authority building:
  - `/blog/ai-news-aggregation-guide/` — "What is AI News Aggregation? A Complete Guide" (target: AI news aggregator queries)
  - `/blog/country-risk-analysis-ai/` — "Country Risk Analysis: How AI is Changing Geopolitical Intelligence" (target: country risk tool queries)
  - `/blog/google-news-vs-ai-news/` — "Google News vs AI News Platforms: What's the Difference?" (target: Google News alternative queries)
- Each article includes Article schema JSON-LD, OG tags, canonical URLs
- Article 3 also includes FAQPage schema for direct AI engine citation
- Blog index updated with 3 new entries, sitemap updated with 3 new URLs at priority 0.7
- All articles include balanced competitor mentions (Feedly, Dataminr, Particle, Recorded Future, etc.) for credibility

---

## 2026-03-31 (GEO: sitemap update)

- **Sitemap updated** — Added 4 missing public pages: `/cli`, `/blog/`, `/blog/thread-and-country-intelligence/`, `/blog/geopolitical-intelligence-for-ai-agents/`. Bumped `/whitepaper` priority to 0.7. Organized with section comments.

---

## 2026-03-31 (GEO: noscript fallback for AI crawlers)

- **`<noscript>` content block** — Added keyword-rich fallback content in `index.html` for crawlers that don't execute JavaScript (Perplexity, ChatGPT browse, etc.). Contains product description, feature list, audience info, and FAQ-style content matching the Schema.org FAQ. Invisible to normal users (only rendered when JS is disabled).

---

## 2026-03-31 (GEO optimization: structured data + homepage keywords)

- **Schema.org structured data** — Added `Organization` + `WebApplication` + `FAQPage` JSON-LD to `<head>` for AI search engine discoverability (Perplexity, ChatGPT, Gemini).
- **Twitter Card upgrade** — Changed from `summary` to `summary_large_image`, added `twitter:site` and `twitter:creator` tags.
- **Homepage keyword copy** — Added subtle tagline under main heading with key phrases: "AI news aggregator", "geopolitical intelligence platform", "country risk analysis", "narrative patterns". Helps AI crawlers match page content to structured data.
- Files changed: `index.html` (source + docs), `Home.jsx`, `docs/assets/`.

---

## 2026-03-31 (Guest sign-out button)

- **Guest sign-out in nav** — anonymous (guest) users now see "Guest · Sign out" in the nav bar instead of a blank link. Clicking it calls `signOut()` and returns them to the signed-out state. Registered users are unaffected (still see email → `/account`). Change in `Layout.jsx`.

---

## 2026-03-23 (Share buttons + Copy Briefing)

- **Share buttons always visible** — X/Twitter and LinkedIn share links now always show on desktop alongside the copy-link button. Native OS share sheet (`navigator.share`) shown only when available (mobile/supported browsers). Fixed previous behaviour where X + LinkedIn were hidden on desktop.
- **Copy Briefing button** — new `CopyBriefing.jsx` component with `formatThreadBriefing()` and `formatCountryBriefing()` formatters. Copies plain-text briefing to clipboard with AI analysis, stats, and canonical URL. Used on ThreadPage and CountryPage.
- **Share + Copy Briefing alignment fixed** — removed `margin-bottom: 12px` from `.share-buttons` CSS rule; the parent wrapper div handles spacing, so both buttons now sit on the same baseline.

---

## 2026-03-22c (Blog: Thread Intelligence and Country Intelligence announcement)

- **New blog:** Added `docs/blog/` with index page and first post announcing Thread Intelligence and Country Intelligence features.
- Post URL: `globalperspective.net/blog/thread-and-country-intelligence/`
- Updated `.agents/product-marketing-context.md` to reflect current product state (Paddle, 3 tiers, launch mode, all 5 personas, accurate feature list).

## 2026-03-22b (CLI: global news intelligence from the terminal)

### CLI Package (`cli/`, published to npm as `global-perspectives`)
- **Interactive topic browser** — `gp today` launches a full-screen terminal UI:
  - Category tabs at top (conflict, politics, economy, etc.) — switch with `←→` or `1-9`
  - Reverse-video highlight for selected item
  - `↑↓`/`j`/`k` to navigate, `Enter` to expand
  - `Tab` to cycle AI tabs (Summarize / Predict / Trace Cause)
  - `Esc` to collapse, `g`/`G` for top/bottom
  - Alternate screen buffer (doesn't pollute terminal scrollback)
  - Keybindings bar at bottom
  - Falls back to flat list when piped (non-TTY)
- **Country intelligence** — `gp country "Iran"` shows BLUF, key developments, risk level with trajectory arrow
- **Countries list** — `gp countries` shows top 15 countries by mention count
- **Thread preview** — `gp thread <id>` shows thread title and entry timeline
- **JSON mode** — `--json` flag on any command for raw JSON output (pipeable to `jq`, scripts, agents)
- **Country flag emojis** — each topic shows the flag of its primary region (🇮🇷 🇺🇸 🇮🇱 🇨🇳). Regions without a country code show 🌐
- **Zero dependencies** — pure Node.js 18+, uses built-in `fetch` and ANSI escape codes
- **Published to npm** — `npx global-perspectives today` works globally

### Installation
```bash
npx global-perspectives today              # instant, no install
npm install -g global-perspectives && gp today  # permanent
```

---

## 2026-03-22 (SEO, public previews, Google Sign-In, launch mode, full site open)

### SEO: Public Content Previews
- **`country_preview` public API action** (no auth) in `newsSensitiveData`. Returns `headline`, `bluf`, `keyDevelopments`, `riskLevel`, `trajectory`, `totalArticles`, `dayCount` for a single country. Google can now index real country intelligence content.
- **`thread_preview` public API action** (no auth). Returns `threadTitle` and `entryShortTitles` for a single thread.
- **CountryPage preview gate** now fetches real data via `fetchCountryPreview()`. Non-signed-in users (and Google) see the actual headline, BLUF, key developments timeline, and risk level — not mock placeholder content.
- **ThreadPage preview gate** now fetches real data via `fetchThreadPreview()`. Shows real thread title and entry short titles.
- **`fetchCountryPreview(name)`** and **`fetchThreadPreview(threadId)`** added to `restProxy.js` as public (no auth) functions.

### SEO: Dynamic Page Titles
- Every page now sets `document.title` dynamically:
  - Home: "Global Perspectives™ — AI-Powered News Intelligence"
  - Weekly: "Story Intelligence — Global Perspectives"
  - Thread: "{threadTitle} — Story Arc | Global Perspectives"
  - Country: "{name} Intelligence Briefing — Global Perspectives"
  - Country List: "Country Intelligence — Global Perspectives"
  - Pricing / About / Sign In: unique titles per page

### SEO: robots.txt + sitemap.xml
- **`docs/robots.txt`** — allows all crawlers, points to sitemap.
- **`docs/sitemap.xml`** — 10 public routes with `changefreq` and `priority`. Home (hourly/1.0), Map (hourly/0.8), Weekly + Countries (daily/0.9), Pricing (weekly/0.7), static pages (monthly).
- **`public/robots.txt`** in frontend source so builds include it.

### Auth: Google Sign-In
- **`signInWithGoogle()`** added to `AuthContext.jsx` using Firebase `signInWithPopup` + `GoogleAuthProvider`.
- **SignIn page** redesigned: Google button at top with official logo SVG, "or" divider, magic link form below.
- **Error handling** for `auth/account-exists-with-different-credential` — shows helpful message instead of crash.
- **Logo** replaces emoji on sign-in page.
- **Terms agreement** text: "By signing in, you agree to our Privacy & Terms and Disclosures."
- **Launch messaging**: "All features are free during our launch period — no credit card required."

### Auth: Launch Mode (Free for All)
- **`resolveUserTier()`** in `newsSensitiveData` Lambda — verifies Firebase JWT, auto-creates user record on first sign-in (`uid`, `email`, `trialStartedAt`), returns `member` tier for all signed-in users (launch mode).
- **Trial logic commented out** with clear instructions — uncomment and reset `trialStartedAt` when ready to charge.
- **All gated actions re-gated** with JWT auth: `archive_range`, `thread_analysis`, `country_intelligence`, `narrative_thread`. Non-signed-in requests get 401.
- **Hooks guard restored** — `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` check `!user` in production (with dev bypass).
- **`useUserProfile` hook** — fetches `user_profile` action, returns `{ tier, trialDaysLeft, isTrial }`.
- **`TrialBanner` component** — ready for when trial mode is enabled (blue/amber banner with days countdown).

### Frontend: Full Site Open
- **Construction gate removed** — all routes render real components (no `<Gate>` wrapper).
- **Full nav bar** in production: Home | Map | Weekly Analysis | Country Intel | Pricing | About | Sign in/email.
- **WeeklyLockedPreview** updated — "Sign in to access Story Intelligence" with logo, "Free during launch" messaging, "Sign in free →" as primary button.
- **Pricing page**: green "Currently free for all signed-in users" badge under $15/mo, Member button → "Sign in for free access →", launch offer notice at top.
- **Account page**: billing section replaced with "All features are currently free for early users."
- **Home page**: feature promotion banner — "New: Story Arc Intelligence & Country Briefings" with CTA buttons.
- **Welcome banner** on WeeklyPage after sign-in: "Welcome to Story Intelligence!"
- **Skeleton loading** — WeeklyPage shows pulsing skeleton cards instead of "Loading..." text.

### Frontend: Page Updates
- **About page rewritten** — What We Do, How It Works (4-step grid), Key Features, Who We Are. Technology section removed.
- **Contact page rewritten** — 3 contact cards (General, Billing, Enterprise) with subject-prefixed mailto links.
- **Privacy page**: Stripe → Paddle references updated.
- **Enterprise tier**: fake features removed, replaced with "Custom requirements — we build to your needs."
- **Tier badge** removed from Weekly Analysis header.
- **Loading text**: "Loading Gemini topics..." → "Loading topics..."

### Bug Fixes
- **`intel.riskLevel.toUpperCase()` crash** — fallback to `'moderate'` when undefined (CountryPage + CountryListPage).
- **Auth guards for production** — hooks no longer fire 401 API requests for non-signed-in users.
- **Missing routes in `knownRoutes`** — added `whitepaper`, `upgrade` to AuthContext callback URL resolver.
- **GA4 analytics restored** — `G-VT6QENX4MB` tag re-added to `index.html`.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/TrialBanner.jsx` | Trial countdown banner (ready for trial mode) |
| `src/hooks/useUserProfile.js` | Fetch user tier/trial status |
| `docs/robots.txt` | Search engine instructions |
| `docs/sitemap.xml` | Search engine route discovery |
| `public/robots.txt` | Source copy for builds |

### Files Modified
| File | Changes |
|------|---------|
| `amplify/backend/function/newsSensitiveData/src/index.js` | `resolveUserTier()`, `country_preview`, `thread_preview`, launch mode, auto-create user |
| `src/App.jsx` | Construction gates removed, all routes open |
| `src/components/Layout.jsx` | Full nav, auth links restored |
| `src/components/SignIn.jsx` | Google Sign-In, logo, terms, launch messaging |
| `src/components/AuthCallback.jsx` | Sets welcome flag in sessionStorage |
| `src/contexts/AuthContext.jsx` | `signInWithGoogle()`, `GoogleAuthProvider`, updated `knownRoutes` |
| `src/components/CountryPage.jsx` | Real preview data for SEO, dynamic title |
| `src/components/ThreadPage.jsx` | Real preview data for SEO, dynamic title |
| `src/components/WeeklyPage.jsx` | Dynamic title, welcome banner, skeleton loading, trial banner |
| `src/components/CountryListPage.jsx` | Dynamic title |
| `src/components/Pricing.jsx` | Launch notice, free hint, disabled Member purchase, dynamic title |
| `src/components/Account.jsx` | Billing section → free access message |
| `src/components/AboutContact.jsx` | Full rewrite, dynamic title |
| `src/components/Contact.jsx` | Full rewrite |
| `src/components/Home.jsx` | Feature promo banner, dynamic title, removed "Gemini" loading text |
| `src/components/WeeklyLockedPreview.jsx` | Logo, launch messaging |
| `src/components/PrivacyTerms.jsx` | Stripe → Paddle |
| `src/services/restProxy.js` | `fetchCountryPreview`, `fetchThreadPreview` |
| `src/hooks/useWeeklyArchive.js` | User guard for production |
| `src/hooks/useThreadAnalyses.js` | User guard for production |
| `src/hooks/useCountryIntelligence.js` | User guard for production |
| `index.html` | GA4 restored |

---

## 2026-03-21b (Disclosures update: 14-day free trial, Enterprise contact-us, Paddle payment processor)

### Frontend: Disclosures Page — Subscription Terms Updated
- **Free Trial**: changed from "No free trial is currently offered" to 14-day free trial, no credit card required.
- **Enterprise tier**: removed fixed $45/month price, now "Contact us for pricing" model.
- **Cancellation**: removed Stripe-specific reference, now generic "Customer Portal".
- **Payment Processing**: updated from Stripe to Paddle; added note that Paddle is the Merchant of Record handling VAT/taxes globally.
- Last updated date: 2026-03-21.

## 2026-03-21 (Whitepaper page, Paddle migration, legal/compliance updates, SPA routing fix)

### Frontend: Whitepaper Page
- **New `WhitepaperPage.jsx`** — full white paper rendered as a styled React page at `/whitepaper`. Sections: Executive Summary, Problem (3 parts), Solution (6-step Narrative Arc Intelligence pipeline), Who It's For (5 personas), Platform (3 tiers), Design Principles, Why Now, Conclusion + CTA.
- **Route added** in `App.jsx` — `/whitepaper` is public (no Gate).
- **Footer link added** in `Layout.jsx` — "White Paper" link in footer nav.

### Frontend: Disclosures Page — Strengthened Legal Language
- **AI-Generated Content section rewritten** — explicit "not financial, investment, legal, political, or security advice" statement. Forward-looking statements disclaimer. "Do not rely solely on this platform" language.
- **New Limitation of Liability section** — "as is" disclaimer, no warranties, no consequential damages.
- **Data Sources section updated** — added note that source article text is not reproduced.
- Last updated date bumped to 2026-03-21.

### Payment: Stripe → Paddle Migration
- **`newsStripeWebhook/src/index.js` rewritten for Paddle** — handles `subscription.created`, `subscription.updated`, `subscription.canceled`. Signature verification uses HMAC-SHA256 with built-in Node `crypto` (no external deps). Reads `uid` from `data.custom_data.uid`. Stores `paddleCustomerId` and `paddleSubscriptionId` in `USERS_TABLE`.
- **`newsStripeWebhook/src/package.json`** — removed `stripe` dependency (crypto is Node built-in).
- **`Pricing.jsx` `buildCheckoutUrl()` updated** — reads `window.PADDLE_CHECKOUT_URL` (set in `docs/config.js`). Passes `checkout[custom][uid]` and `customer[email]` as URL params.
- **`newsSensitiveData/src/index.js`** — added `user_profile` action (Firebase JWT auth → DynamoDB lookup → return tier/status). Added `portal_session` action (Firebase JWT auth → get `paddleCustomerId` → call Paddle auth-token API → return portal URL). Firebase JWT verification implemented using Node `crypto` + Google public key fetch (cached 1hr, no firebase-admin needed). New env vars: `USERS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `PADDLE_API_KEY`.

### Docs: Legal Notes
- **New `docs/LEGAL_NOTES.md`** — documents content usage legal research: Brave Search API ToS analysis, industry precedents (Perplexity lawsuits), risk matrix, what keeps the platform protected.

### Frontend: Navigation — Pricing Added to Production Nav
- **`Layout.jsx`** — added "Pricing" link to the production nav bar (previously only visible in dev mode). Pricing page is now accessible from the top nav on the live site.

### Infrastructure: GitHub Pages SPA Routing Fix (two-part)
- **`resolveBasename()` fix in `App.jsx`** — was incorrectly using the first path segment (e.g. `/pricing`) as the React Router basename on custom domain, causing every link to double-prefix (e.g. `/pricing/pricing`) and direct URL loads to render the wrong page. Fix: basename detection now only activates on `github.io` hostname; returns `undefined` on custom domain so all routes are treated as absolute paths.
- **`global-perspectives-starter/frontend/index.html`** — added `sessionStorage.redirect` restore script to the source file (not just `docs/index.html`). When GitHub Pages serves `404.html` for a deep link (e.g. `/whitepaper`), the path is restored after redirect so React Router renders the right page. Moving the script to source ensures it survives every build.

### Pending (requires Paddle account setup)
- Set `window.PADDLE_CHECKOUT_URL` in `docs/config.js` after creating product in Paddle dashboard
- Set Lambda env vars: `PADDLE_WEBHOOK_SECRET` (newsStripeWebhook), `USERS_DDB_TABLE` + `FIREBASE_PROJECT_ID` + `PADDLE_API_KEY` (newsSensitiveData)
- Add webhook in Paddle Dashboard → Notifications pointing to newsStripeWebhook API Gateway URL
- Subscribe to: `subscription.created`, `subscription.updated`, `subscription.canceled`

---

## 2026-03-21 (Country Intelligence structured briefing, timeline, sidebar nav, dev bypass)

### Lambda: `newsCountryIntelligence` — Structured Output
- **New `bluf` field.** Single-sentence bottom-line-up-front assessment.
- **New `keyDevelopments` field.** Array of 5-7 dated events (date + text), most recent first. Replaces scanning paragraphs for key facts.
- **New `whyItMatters` field.** 2-3 sentences with `**bold**` key phrases for scannable reading.
- **New `backgroundTimeline` field.** Array of 10-15 chronological events with `date`, `event`, `category` (conflict/politics/economy/diplomacy/security/society), and `topicId` for article linking.
- **`trajectory` changed to enum.** Now returns "escalating", "stable", or "de-escalating" instead of freeform text. Detailed trajectory moved to `trajectoryDetail`.
- **All text fields use `**bold**` markers** for frontend rendering of key phrases.
- **Watch triggers forced forward-looking.** Prompt includes today's date and requires all signals to reference future dates.
- **`topicId` passed to prompt** so AI can reference specific articles in the timeline.
- **MAX_TOKENS increased to 5000** to accommodate structured output.

### Lambda: `newsSensitiveData` — Auth Bypass for Dev
- **All gated actions temporarily public** (`archive_range`, `thread_analysis`, `country_intelligence`, `narrative_thread`). Auth checks replaced with `// TODO: Add Firebase JWT auth before public release` comments.
- **Local source synced** with deployed version — `thread_analysis`, `country_intelligence` actions now in local index.js. All pass through full DynamoDB item (minus PK/SK/ttl).

### CountryPage — Structured Briefing Redesign
- **Risk indicator as 4-dot visual scale** (low/moderate/elevated/high) with colored dots instead of text-only badge.
- **Trajectory badge** (↗ Escalating / → Stable / ↘ De-escalating) with color next to risk dots.
- **BOTTOM LINE section** — blue left-border card with the one-sentence BLUF assessment. Immediately visible, no click needed.
- **KEY DEVELOPMENTS timeline** — dated bullet list of 5-7 key events with blue dots.
- **Metrics strip moved to header area** — articles/stories/days cards between headline and section nav.
- **WHY IT MATTERS section** — amber callout box with bold key phrases rendered via `BoldText` component.
- **`BoldText` component** — parses `**text**` markdown into `<strong>` tags for inline bold rendering.
- **Background Timeline** (`BackgroundTimeline.jsx`) — vertical day-grouped timeline:
  - Events grouped by date, primary event always visible, "+N more events" expand button
  - Category-colored dots with numbering (conflict #1, politics #2, etc.)
  - Category legend at bottom with totals
  - Click event → scroll to matching article in coverage with yellow flash highlight
  - Related articles shown inline when expanded (fuzzy-matched by keyword overlap with coverage entries)
- **Deep Analysis renamed** — "Full Situation Analysis" → removed (replaced by timeline). "What's Next" and "Cross-Thread Connections" remain as expandable accordions.
- **Watch triggers as amber chips** — ⚡-prefixed pills instead of bullet list. Section renamed to "WHAT TO WATCH".
- **Related coverage collapsed by default** — toggle button "Related coverage (N) ▾" expands to reveal filters and day groups.
- **Dismissible explainer** — "This briefing is generated daily by AI..." with "Got it" button, persists in localStorage.
- **"Updated Xh ago" timestamp** from `intel.generatedAt` in subtitle.
- **Auto-open first AI tab removed** — structured sections (BLUF, developments, why it matters) replaced the need for tab auto-open.
- **Section IDs** on all major sections for scroll-spy navigation.

### SideNav — Reusable Floating Sidebar (`SideNav.jsx`)
- **Desktop only** (1100px+), hidden on mobile. Fixed position on the right side of viewport, outside content container.
- **Scroll-spy** via IntersectionObserver — active section highlighted as user scrolls.
- **Bottom-of-page detection** — when scrolled to bottom, last section activates.
- **Section counts** shown as small badges (e.g., "Coverage 144", "Watch 4").
- **Click to jump** with smooth scroll.
- **Glassmorphism style** — semi-transparent white background with backdrop blur, subtle border, 10px border-radius.
- **Reusable** — any page can use `<SideNav sections={[...]} />` with `page-with-sidenav` / `page-main-content` wrapper classes.

### SectionNav — Floating Pill Bar (kept for mobile)
- Sticky horizontal pill bar with scroll-spy, used on CountryPage for mobile navigation.

### CountryListPage — Full Redesign
- **CountryOverviewMap** (`CountryOverviewMap.jsx`) — clean risk-colored dot map:
  - One dot per country, no connection lines
  - Color = risk level (red/orange/yellow/green/grey)
  - Size = log(article count)
  - Hover tooltip: country name, article count, risk dot, AI headline, "Click for full briefing"
  - Close button hidden on InfoWindow, auto-pan enabled
  - Map hero container `overflow: visible` so tooltip isn't clipped
- **Search bar** — filters featured cards and "other countries" by name and headline
- **Sort toggle** — Risk level (default) / Most covered / A→Z
- **Region filter pills** — All (8) / Middle East (3) / Europe (2) etc.
- **Risk legend** — colored dots for High/Elevated/Moderate/Low + trend arrows
- **Map hint** — "Dot size = coverage volume · Color = risk level · Click any country"
- **Section headers** — "AI BRIEFINGS" with hint, "Other countries" with explanation
- **Featured cards** sorted by risk level (high first), with:
  - Colored left border by risk
  - Trend arrow (↗ Escalating derived from trajectory text)
  - Top 2 category tags with colors
  - "View briefing →" link
- **"Updated Xh ago"** timestamp from intelligence data
- **Compact pill grid** for countries without intelligence

### Dev Mode Bypass
- **All auth gates bypass in dev** — `import.meta.env.DEV` check on WeeklyPage, CountryPage, CountryListPage, ThreadPage. No sign-in needed for `npm run dev`.
- **Hooks fetch without user** — `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` no longer require `user` to be set.
- **Dev-only full nav** — Layout shows Weekly Analysis, Country Intel, Pricing links in dev mode.

### Other
- **Home page FreeGate removed** — all topics visible to everyone, no forced sign-in overlay.
- **WeeklyMap map bounds** — `minZoom: 2`, `maxZoom: 12`, `restriction` with `strictBounds` prevents grey areas.
- **WeeklyMap country selection visuals** — selected country bright + large, connected countries same color at 35% opacity, unrelated hidden entirely.
- **CoverageList show top 3** day groups with "Show N more days" button.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/BackgroundTimeline.jsx` | Vertical day-grouped timeline with category dots, expand, and article linking |
| `src/components/SideNav.jsx` | Reusable floating sidebar nav with scroll-spy (desktop only) |
| `src/components/CountryOverviewMap.jsx` | Clean risk-colored dot map for country list |
| `src/components/SectionNav.jsx` | Sticky horizontal pill bar with scroll-spy (mobile) |

### Files Modified
| File | Changes |
|------|---------|
| `src/components/CountryPage.jsx` | Full structured briefing redesign, SideNav, BackgroundTimeline, BoldText, coverage collapse |
| `src/components/CountryListPage.jsx` | Full redesign with overview map, search, sort, filters, legends, hints |
| `src/components/WeeklyPage.css` | All new CSS for timeline, sidebar, overview map, briefing sections, coverage toggle |
| `src/components/WeeklyPage.jsx` | CATEGORY_ORDER/RISK_COLORS exports, dev auth bypass |
| `src/components/WeeklyMap.jsx` | hidePanel, defaultCountry/Thread, onCountryClick, country selection visuals, map bounds |
| `src/components/ThreadPage.jsx` | Dev auth bypass |
| `src/components/Home.jsx` | FreeGate removed |
| `src/components/Layout.jsx` | Dev-only nav links |
| `src/App.jsx` | Dev mode gate bypass |
| `src/hooks/useWeeklyArchive.js` | User check removed for dev |
| `src/hooks/useThreadAnalyses.js` | User check removed for dev |
| `src/hooks/useCountryIntelligence.js` | User check removed for dev |
| `src/services/restProxy.js` | Added fetchCountryIntelligence |
| `amplify/backend/function/newsCountryIntelligence/src/index.js` | Structured output prompt, backgroundTimeline, forward-looking watch triggers |
| `amplify/backend/function/newsSensitiveData/src/index.js` | Added thread_analysis + country_intelligence actions, auth bypass |

---

## 2026-03-20 (WeeklyMap props, CountryPage/ThreadPage map fixes, CountryListPage redesign)

### WeeklyMap — New Embedding Props
- **`hidePanel` prop.** Hides sidebar panel, toggle button, playback overlay, and legend. Map takes full width. Used by CountryPage and ThreadPage.
- **`defaultCountry` prop.** Sets `activeCountry` on mount, filters markers to that country's threads, auto-zooms to related markers.
- **`defaultThread` prop.** Sets `highlightThread` on mount, auto-zooms to that thread's markers.
- **`onCountryClick` prop.** When set, clicking a map dot calls this callback with the country name instead of showing an InfoWindow. Used by CountryPage to navigate between countries.
- **`disableInfoWindow`** passed to `WeeklyGoogleMap` when `onCountryClick` is set.

### WeeklyMap — Country Selection Visuals
- **Selected country** renders at full color, larger scale (+4), white border, topic count label, z-index 300.
- **Connected countries** keep their thread color but at 35% opacity, normal size — visually linked but clearly not selected.
- **Unrelated markers and lines** are fully hidden (not rendered at all) when a country is active.
- **Connection lines** in country mode use original thread color at 30% opacity, thin weight.

### WeeklyMap — Map Bounds & Zoom
- **`minZoom: 2`** prevents zooming out past the world view.
- **`restriction`** with `strictBounds: true` prevents panning to grey areas outside world bounds (lat ±85, lng ±180).
- **`maxZoom: 12`** added.
- **`fitBounds` clamp.** After auto-fit, an `idle` listener ensures zoom doesn't drop below 2. Single-point coordinates use `setZoom(5)` instead of zero-area bounds.

### CountryPage — Coverage List
- **Show top 3 day groups** by default with a "Show N more days" button for the rest, saving vertical space.

### CountryListPage — Full Redesign
- **CountryOverviewMap** — new lightweight map component (`CountryOverviewMap.jsx`). Shows one dot per country (no connection lines, no thread data). Dots colored by risk level (red=high, orange=elevated, yellow=moderate, green=low, grey=no intel). Size scaled logarithmically by article count.
- **Hover tooltips** on map dots: country name, article count, risk level with colored dot, AI headline, "Click for full briefing" hint. Close button hidden. Map auto-pans to keep tooltip visible (`disableAutoPan: false`). Container `overflow: visible` so tooltip isn't clipped.
- **Featured cards** sorted by risk level (high first, then by article count). Each card shows: colored left border (risk), country name, risk dot + label, trend arrow (Escalating/Stable/De-escalating derived from trajectory text), AI headline, top 2 category tags, article/story count, "View briefing →" link.
- **Region filter pills** above featured cards (All, Middle East, Europe, Asia, etc.) with counts.
- **Other countries** shown as compact tag-style pills (name + article count) below featured section.
- **Hooks rule fix.** All `useState`/`useMemo` hooks moved before early returns to prevent "Rendered more hooks" error.

### Construction Gate + Preview Mode
- **`ComingSoon` component** replaces WIP routes (weekly, signin, pricing, account, etc.) in production.
- **`?preview=1`** URL param bypasses gate, persists in `sessionStorage` for the tab session.
- **`import.meta.env.DEV`** automatically bypasses gate in dev mode (`npm run dev`).
- **Dev-only nav links** — Layout shows full nav (Weekly Analysis, Country Intel, Pricing) in dev, trimmed nav (Home, Map, About) in prod.

### Home Page
- **Removed `FreeGate` overlay** that forced non-authenticated users to sign in after 1 topic. All topics now visible to everyone.

### Other
- **Removed CI auto-deploy workflow** (`.github/workflows/deploy.yml`). Build + copy to `docs/` is done locally. Prevents push conflicts from CI pushing build artifacts.
- **Added `fetchCountryIntelligence`** to `restProxy.js`.
- **Disclosures page updated** — subscription terms (tiers, pricing, refund policy, cancellation, payment processing via Stripe), contact info, business name, corrected data sources (xAI Grok + Brave Search).
- **Privacy page updated** — Firebase auth, Stripe payment data, account deletion process, corrected third-party services, cookies section for GA4/Firebase.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/CountryOverviewMap.jsx` | Lightweight risk-colored dot map for country list page |

### Files Modified
| File | Changes |
|------|---------|
| `src/components/WeeklyMap.jsx` | `hidePanel`, `defaultCountry`, `defaultThread`, `onCountryClick` props; country selection visuals; marker/line hiding; map bounds restriction; `disableInfoWindow` + `activeCountry` on WeeklyGoogleMap |
| `src/components/CountryPage.jsx` | CoverageList show 3 + "Show more" |
| `src/components/CountryListPage.jsx` | Full redesign: overview map, risk-sorted cards, trend arrows, category tags, region filters, compact others grid |
| `src/components/WeeklyPage.css` | CountryOverviewMap hero, featured card, filter pill, trend, others grid CSS |
| `src/components/Layout.jsx` | Dev-only full nav links |
| `src/components/Home.jsx` | Removed FreeGate, unused auth import |
| `src/components/Disclosures.jsx` | Subscription terms, refund policy, contact, Stripe info |
| `src/components/PrivacyTerms.jsx` | Auth, Stripe, account deletion, corrected services |
| `src/App.jsx` | ComingSoon gate, preview mode, dev bypass, real routes behind Gate |
| `src/services/restProxy.js` | Added `fetchCountryIntelligence` |

---

## 2026-03-15 (Category grouping on Weekly Analysis + WeeklyMap panel)
- **Thread list grouped by category.** Both the Weekly Analysis feed (`WeeklyPage.jsx`) and the WeeklyMap side panel (`WeeklyMap.jsx`) now group threads into collapsible category sections (politics, economy, conflict, technology, environment, health, society, culture, science, other) instead of a flat list. Each section shows a colored header with the category name and thread count, and collapses/expands on click with an animated chevron.
- **Show 5 / Show more pattern.** Each category group shows the first 5 threads by default. If more exist, a "Show X more" button appears at the bottom of the group. Expanding one group is independent of others.
- **Category badge color fix.** Category group names were incorrectly using the badge background color (`c.bg`) as text color — fixed to use `c.color` (the dark variant) so labels are legible.
- **Per-item category badge removed from list view.** Now that threads are already grouped under a category header, the redundant inline category badge on each thread card/item has been removed.
- CSS added: `.weekly-category-group`, `.weekly-category-group-header`, `.weekly-category-group-name/count/chevron`, `.weekly-category-show-more` in `WeeklyPage.css`; matching `.wmap-category-group*` and `.wmap-category-show-more` in `WeeklyMap.css`.

## 2026-03-15 (Weekly Analysis + WeeklyMap UI improvements)
- **Trending cards cleaned up.** Removed inline AI summary text from "Rising This Week" featured cards and StoryCard list items — cards now show title, badges, and arc dots only. Full titles no longer truncated.
- **Filter bar improvements.** Period filter labels changed from cryptic "3d/7d" to "3 days / 7 days". "All Xd" button hidden when archive is exactly 7 days (member tier) to avoid duplication. "Show" label added before the period group. Country dropdown added after sort selector — filters threads to a specific country.
- **WeeklyMap side panel widened** from 320px → 500px with consistent 20px horizontal padding. Entry title font size increased, AI buttons larger. Detail header and meta paddings increased throughout.
- **MiniMap single-country zoom fix.** When a story involves only one country, the map now pads out 60°lat × 90°lng so the full country and its neighbors are visible rather than zooming in too close.
- **Map AI toolbar wrapping.** AI Arc Analysis buttons now wrap onto multiple lines in narrow contexts instead of overflowing.
- **CompactTimeline entry click → map focus.** Clicking a daily entry in "Daily coverage" sets the map to that entry's date (paused playback), zooms to that entry's countries, and dims others.
- **Playback overlay removed.** The floating top-right overlay during story playback has been removed. Play/stop is controlled entirely via the side panel button.
- **Country filter on WeeklyMap.** Dropdown in the panel filters the thread list and dims non-matching markers/lines on the map. Hint text shown when no country is selected.
- **Country Replay animation.** Select any country → "▶ Replay [Country] — N days" button appears. Clicking starts a day-by-day animation: map shows that country's active threads stepping forward at 1.5s/day, panel thread list updates to show only threads active on that day, progress bar + ◀ ❚❚ ▶ ✕ controls in the panel (no floating overlay).
- **Category badges unified.** `CATEGORY_BADGE_COLORS` exported from `WeeklyPage.jsx` and imported in `StoryEntryCard.jsx` and `WeeklyMap.jsx` so all category badges (thread list items, entry cards, detail header) use the same color scheme.
- **WeeklyMap thread list.** Colored thread dots removed from panel list cards and detail header (kept on map markers). Category badge added above each thread title and in the detail header meta.
- **Full Map link removed** from Weekly Analysis header — redundant with the Map toggle.
- **Navigation.** "Full Map →" link removed from Weekly Analysis page header.

## 2026-03-15 (Analytics, CI/CD, and deployment infrastructure)
- **Google Analytics 4 added.** Tag `G-VT6QENX4MB` injected into `docs/index.html`. Tracks real-time visitors, page views, traffic sources, countries, new vs returning users. Data starts accumulating from today. Verify via GA4 → Realtime at analytics.google.com.
- **GitHub Actions auto-deploy workflow added.** `.github/workflows/deploy.yml` — triggers on push to `main` when `src/` files change. Automatically runs `npm ci`, `npm run build`, copies `dist/` to `docs/`, and commits back. Eliminates the manual build + copy + commit workflow entirely.
- **Wrangler CLI installed and authenticated.** `wrangler` v4.73.0 installed globally. Authenticated with `globalperspectives.app@gmail.com` (account ID `45efe64168fc55da3937e2c01b1ca43a`). Zone `globalperspective.net` confirmed linked.
- **`.gitignore` updated.** Added `*-firebase-adminsdk-*.json` pattern to prevent Firebase Admin SDK service account keys from being accidentally committed.
- **`weekly-ui-redesign` branch deployed.** Built and pushed all frontend changes (Story Intelligence page, loading indicators, auth components, Firebase config) to `weekly-ui-redesign`. Branch is live on GitHub — merge to `main` when ready to go to production.

## 2026-03-15 (Thread analysis improvements — watchQuestions, Brave Search, richer context)
- **`newsThreadAnalysis`: Brave Search grounding.** Before calling Grok, now performs two web searches on the latest entry title: `/news/search` (past week, 4 results) + `/web/search` (background/analysis, 2 results). Up to 6 external references injected into the prompt with `[1]`, `[2]` citation instructions. Requires `BRAVE_SEARCH_API_KEY` env var (same key as `newsInvokeGemini`).
- **`newsThreadAnalysis`: Full entry context.** Removed 300-char summary truncation — full summaries now passed to Grok. Added individual entry `ai.prediction` (250 chars) and `ai.trace_cause` (200 chars) per entry so Grok sees how analysts assessed the story each day. Added source outlet names per entry.
- **`newsThreadAnalysis`: Prompt overhaul.** All three analysis fields given explicit structure instructions: `storyArc` → analytical journalism style with turning points; `trajectory` → specific actors/scenarios/timeframes, no vague language; `rootCauseChain` → 3-layer causal chain (immediate trigger → enabling condition → structural factor).
- **`newsThreadAnalysis`: `watchQuestions` field added.** New field: array of exactly 3 specific, actor-named follow-up questions a reader should watch for (e.g. "Will the ECB raise rates at its June meeting in response?"). Stored in DDB, passed through to frontend.
- **`newsThreadAnalysis`: MAX_TOKENS raised 2000 → 3000.** Needed for richer multi-field responses.
- **`newsSensitiveData`: `watchQuestions` passthrough.** Added `watchQuestions` to `readThreadAnalyses()` field allowlist so frontend receives the new field.
- **`ThreadIntelligence.jsx`: Tab labels renamed.** "Story Arc" → "How It Evolved", "Trajectory" → "What's Next", "Root Causes" → "Why It Happened". More intuitive for first-time readers.
- **`ThreadIntelligence.jsx`: Watch questions UI.** Always-visible amber-bordered question list shown above the analysis tabs — no click needed. Label "Questions to follow". Renders only when `watchQuestions` array is non-empty.
- **Zips:** `newsThreadAnalysis.zip` and `newsSensitiveData.zip` updated and ready to upload.

## 2026-03-15 (Loading indicators — progress bar + AI toast)
- **`LoadingBar.jsx` (new).** Thin 3px fixed progress bar at the very top of every page. Blue→purple→cyan gradient with glow. Animates 0%→85% on load start, completes to 100% and fades out on finish. Event-driven via `window.dispatchEvent('gp-loading-start' / 'gp-loading-end')` — no context wiring needed.
- **`AIToast.jsx` (new).** Non-blocking frosted-glass pill fixed at bottom-right. Appears when any AI generation operation is running. Shows contextual messages: "Generating summary…" / "Mapping chain reactions…" / "Tracing origins…". Stacks multiple concurrent ops with a `+N` count badge. Slides in with spring animation. Event-driven via `gp-ai-start` (with `{id, message}`) / `gp-ai-end` (with `{id}`).
- **`LoadingIndicators.css` (new).** Styles for both components.
- **`Layout.jsx` updated.** Renders `<LoadingBar />` and `<AIToast />` inside the layout wrapper so they appear on every page.
- **`useGeminiTopics.js` updated.** Fires `gp-loading-start` before network fetch, `gp-loading-end` in finally block.
- **`useWeeklyArchive.js` updated.** Same pattern — fires loading events around archive fetch.
- **`MapSidePanel.jsx` updated.** Each AI handler (Summary, Prediction, TraceCause) fires `gp-ai-start` with contextual message and `gp-ai-end` with per-operation ID on completion.

## 2026-03-15 (Weekly page redesign — Story Intelligence branch)
- **Branch: `weekly-ui-redesign`.** Full visual redesign of the Weekly page on a separate branch.
- **Title renamed.** "Weekly Analysis" → "Story Intelligence".
- **`FeaturedSection` (new component).** Replaces horizontal-scroll `TrendingSection`. 3-column grid of rising/new arcs. Each card has a gradient top border, always-visible summary, "Read full arc →" CTA. Stacks to 1 column on mobile.
- **`StoryCard` redesigned.** Summary always visible (no click needed). `▼ Analyze` pill button on the right expands the full analysis (ThreadIntelligence + MiniMap + CompactTimeline). Dark pill when expanded.
- **`ArcDots` updated.** Date labels on both ends (`Mar 10 ●───○───● Mar 14`). Gap dots for days with no coverage. Only shown for multi-day threads.
- **`FilterControls` (new component).** Replaces `FilterBar` and region accordion. Single bar: search input + 3d/7d/all period toggles + sort select. Region chips row below for one-click filtering. Active chip turns dark.
- **Flat `weekly-feed`.** Single scrollable feed replacing nested region accordion sections. Region chips provide filtering instead of grouping.
- **Category badges.** Each story card and featured card shows a colored category badge (conflict/military/disaster/politics/economy/technology/health) derived from the latest entry.
- **Story activity status dot.** Each card shows ● Active (green, ≤2 days), ● Ongoing (amber, 3–7 days), or ● Quieting (gray, 7+ days) based on `dateRange.to` vs today.
- **Map navigation fixes.** `WorldMap.jsx`: added `← Back` button in page header; story banner replaced with `← Back` + "Showing connections for: …" layout. `MapSidePanel.jsx`: added sticky "← Back to all" bar when a topic is selected; "☆ Related" → "✕ Deselect" when active.
- **`MiniMap.jsx`: `static` prop.** Disables navigation and hides "Open full map →" footer when used inside modals (prevents accidental page change). Keyboard accessible (`role="button"`, `onKeyDown`).
- **New CSS classes.** `.featured-section`, `.featured-card`, `.story-card-main`, `.story-card-content`, `.story-card-summary`, `.story-expand-btn`, `.filter-controls`, `.filter-region-chip`, `.weekly-feed`, `.arc-dot-date-label`, `.story-category-badge`, `.story-activity-dot`, `.watch-questions`, `.watch-question-item`.
- **Files changed:** `WeeklyPage.jsx`, `WeeklyPage.css`, `MiniMap.jsx`, `WorldMap.jsx`, `MapSidePanel.jsx`, `ThreadIntelligence.jsx`.

## 2026-03-15 (Home page freemium gate)
- **Home: Freemium gate.** Signed-out visitors see only the first topic fully (with AI toolbar, sources, Google News link). The rest of today's topics are blurred behind a sign-in gate with a "🌍 N more topics today" CTA, "Sign in free →" button, and "See Member plans" link.
- **Home: `FreeGate` component.** Inline component that renders a blurred preview of up to 3 locked regions with their topic titles (pointer-events disabled), with a gradient overlay fading from transparent to white. Shows exact count of locked topics.
- Signed-in users (any tier) see all topics unchanged. Gate only activates for unauthenticated visitors.
- Updated `src/components/Home.jsx`.

## 2026-03-15 (Nav cleanup + Account page)
- **Nav: Simplified.** Removed Contact, Privacy, Disclosures from main nav (still in footer). Nav is now: Home | Map | Weekly Analysis | Pricing | About | [email / Sign in].
- **Nav: Renamed Weekly → Weekly Analysis.** Label updated in `Layout.jsx`.
- **Nav: Member hint.** Small 🔒 superscript shown next to "Weekly Analysis" for signed-out users only. Hidden for signed-in members — no clutter for paying users.
- **Nav: Removed duplicate Upgrade link.** Signed-out users previously saw both "Pricing" in nav and a separate blue "Upgrade" button. Removed the redundant Upgrade button; Pricing link in nav is sufficient.
- **Account page: Full rebuild.** Replaced minimal 3-field layout with a proper multi-card profile page:
  - **Identity card** — initials avatar (blue circle), email, tier badge, Active/status indicator, "Since [month year]" (from Firebase `user.metadata.creationTime`) all in one row.
  - **Your plan includes** — perks list with icons per tier (member: 4 perks, enterprise: 5 perks, free: hidden). Lists Weekly Analysis, Weekly Map, Thread Intelligence, Trending, Narrative Thread.
  - **Quick access** — direct links to Weekly Analysis and Weekly Map. Member/enterprise only.
  - **Billing card** — Manage billing & subscription button (member/enterprise) or Upgrade CTA (free). "Billing issue? Contact support →" mailto link always visible.
  - **Account card** — Sign out as a proper bordered button (was previously invisible plain muted text). Delete account flow: clicking shows a confirmation panel with instructions to email support for deletion within 24 hours.
- Updated `src/components/Account.jsx`, `src/components/Layout.jsx`.

## 2026-03-15 (Infrastructure setup + bug fixes)
- **Firebase Auth configured.** Added `window.FIREBASE_CONFIG` to `docs/config.js`. Added `.env.local` with `VITE_FIREBASE_*` vars for local dev fallback. Enabled Email link (passwordless) sign-in in Firebase Console. Added `benben05059997.github.io` and `globalperspective.net` to Firebase authorized domains.
- **Stripe setup.** Installed Stripe CLI. Created live product (`prod_U9N7L4KtBAUPso`), price (`price_1TB4NWHAFyhbSKzgEbqhcz3C`, $15/mo recurring), and webhook endpoint (`we_1TB51WHAFyhbSKzgVM8syUnI`) pointing at Lambda Function URL. Webhook subscribes to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **`newsStripeWebhook` Lambda deployed.** New Lambda handling Stripe webhook events — creates/upgrades user to `member` on checkout, downgrades to `free` on cancellation, updates tier on subscription status change. Function URL created: `https://tu2abnue3kefs2lkeczezoez3m0fzztr.lambda-url.ap-northeast-1.on.aws/`. Env vars: `USERS_DDB_TABLE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Users DynamoDB table created.** `GlobalPerspectiveUserTable`, PK: `uid` (String). Stores `tier`, `email`, `stripeCustomerId`, `subscriptionId`, `subscriptionStatus`.
- **`newsSensitiveData` bug fixes deployed.** Fixed `ddb.send()` → `getDynamoClient().send()` crash in `readThreadAnalyses()`. Removed unused `UpdateCommand` import. Zip uploaded to Lambda.
- **`newsSensitiveData` env vars added.** `USERS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FRONTEND_URL` (`https://globalperspective.net`).
- **Phase 5 legacy apiKey cleanup.** Removed all remaining `apiKey` refs from weekly archive flow: `useThreadAnalyses`, `WeeklyPage`, `WeeklyMap` (replaced `embeddedApiKey` prop with `embedded` boolean). Fixed `fetchNarrativeThread` dead param. Fixed `AuthCallback` hardcoded `/signin` href → `<Link>`.

## 2026-03-14 (Firebase Auth + Stripe subscription)
- **Auth system migration.** Replaced manual API key entry (`ApiKeyGate`) with Firebase Authentication (passwordless email link sign-in). Users receive a magic link by email; on click they are signed in. Firebase ID token sent as `Authorization: Bearer <token>` on all gated API calls.
  - Created `src/contexts/AuthContext.jsx` — Firebase Auth provider. Config read from `window.FIREBASE_CONFIG` (set in `docs/config.js`) with VITE env var fallback for local dev. Exports `useAuth()`, `sendSignInLink()`, `completeSignIn()`, `signOut()`, `getIdToken()`.
  - Created `src/components/SignIn.jsx` — email input form, sends magic link via Firebase `sendSignInLinkToEmail`.
  - Created `src/components/AuthCallback.jsx` — `/auth/callback` route, completes sign-in from email link via `signInWithEmailLink`.
  - Updated `src/App.jsx` — wraps app in `AuthProvider`; added `AuthBridge` that wires `getIdToken` into `restProxy.setAuthProvider()` on mount.
  - Updated `src/services/restProxy.js` — added `setAuthProvider(fn)` and `proxyActionWithAuth()` which injects Bearer token header. Gated functions (`fetchArchiveRange`, `fetchThreadAnalyses`, `fetchNarrativeThread`, `fetchPortalSession`, `fetchUserProfile`) use this path. Public functions unchanged.
- **Subscription system.** Stripe billing integration for member/enterprise tiers.
  - Created `src/components/Pricing.jsx` — pricing page with tier comparison and Stripe checkout links.
  - Created `src/components/Account.jsx` — shows user email, current tier, and Stripe customer portal link.
  - Created `src/components/UpgradeSuccess.jsx` — post-checkout success page.
  - Added `portal_session` action to `newsSensitiveData` — creates Stripe billing portal session for authenticated user.
  - Added `user_profile` action to `newsSensitiveData` — returns `{ tier, subscriptionStatus, email }` from `USERS_TABLE`.
- **Backend: Firebase JWT verification.** `newsSensitiveData` Lambda now verifies Firebase ID tokens via Firebase Admin SDK (`verifyIdToken`). Tier resolved from `USERS_TABLE` (DynamoDB) keyed by Firebase UID. New env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `USERS_DDB_TABLE`, `STRIPE_SECRET_KEY`, `FRONTEND_URL`.
- **WeeklyPage: Auth-gated.** Replaced `ApiKeyGate` with `useAuth()`. Unauthenticated → `WeeklyLockedPreview` (blurred mock content + CTA). Free-tier (401) → upgrade prompt. Member/enterprise → full page.
  - Created `src/components/WeeklyLockedPreview.jsx` — blurred mock cards with gradient overlay and "Get Member $15/mo" + "Sign in" CTAs.
- **Navigation.** Layout shows "Sign in" + "Upgrade" links for unauthenticated users; `user.email` → `/account` for signed-in users. Added `/pricing` to main nav.
- **Custom domain.** Production URL `https://globalperspective.net`. CORS list includes both GitHub Pages and custom domain.
- **Hook signatures changed.** `useWeeklyArchive()` and `useThreadAnalyses(threadIds)` no longer accept `apiKey` — auth handled internally via `AuthContext`. Cache keyed by `user.uid`.
- **New routes:** `/signin`, `/auth/callback`, `/pricing`, `/account`, `/upgrade/success`.

## 2026-03-14 (Thread Intelligence)
- **New Lambda: `newsThreadAnalysis`.** Daily batch Lambda that generates thread-level AI analysis for the top 15 narrative threads with 2+ entries. Reads 30 days of archives, calls xAI Grok to produce: thread title, entry short titles (6-10 word sequential narrative per entry), story arc (evolution), trajectory (prediction), and root cause chain (origins). Writes to `SUMMARIZE_PREDICT_TABLE` with key pattern `PK: THREAD#{threadId}`, `SK: THREAD_ANALYSIS`, 31-day TTL. Staleness check skips threads where entry count hasn't changed.
  - Created `amplify/backend/function/newsThreadAnalysis/src/index.js`
  - Created `amplify/backend/function/newsThreadAnalysis/src/package.json`
  - Created `amplify/backend/function/newsThreadAnalysis/newsThreadAnalysis-cloudformation-template.json`
- **Backend: `thread_analysis` action.** Added `thread_analysis` action to `newsSensitiveData` REST proxy. Tier-gated (member/enterprise). Accepts array of `threadIds` (max 20), returns map of `threadId → analysis`. Added `readThreadAnalyses()` function with parallel DynamoDB reads.
  - Updated `amplify/backend/function/newsSensitiveData/src/index.js`
- **Frontend: Thread Intelligence UI.** Thread-level AI (Story Arc / Trajectory / Root Causes) shown at the top of each thread when analysis data exists. Graceful fallback to current layout when no data.
  - Created `src/components/ThreadIntelligence.jsx` — three toggle buttons reusing existing `ai-toolbar` CSS classes
  - Created `src/components/CompactTimeline.jsx` — compact timeline with AI-generated short titles per entry, expand chevron reveals full `StoryEntryCard` with per-entry AI toolbar
  - Created `src/hooks/useThreadAnalyses.js` — fetches and caches thread analyses (localStorage, 30-min TTL)
  - Added `fetchThreadAnalyses()` to `src/services/restProxy.js`
- **WeeklyPage: Thread Intelligence integration.** StoryCard header uses AI-generated thread title when available. Expanded body shows ThreadIntelligence above MiniMap, CompactTimeline replaces flat entry list. Trending modal also uses ThreadIntelligence + CompactTimeline when analysis exists.
  - Updated `src/components/WeeklyPage.jsx`, `src/components/WeeklyPage.css`
- **WeeklyMap: Thread Intelligence integration.** ThreadDetailView shows AI-generated thread title, ThreadIntelligence above play button, CompactTimeline in sidebar. Independent `useThreadAnalyses` hook for standalone `/weekly-map` route.
  - Updated `src/components/WeeklyMap.jsx`
- **Trending section: Modal overlay.** Replaced inline trending card expansion with popup modal overlay. Fixed event bubbling bug where AI toolbar button clicks closed the expanded card.
  - Removed dead CSS: `.trending-card.selected`, `.trending-detail`
  - Added modal CSS: `.trending-modal-overlay`, `.trending-modal`
- **New CSS.** Added `.thread-intelligence`, `.compact-timeline`, `.compact-timeline-entry`, `.compact-timeline-dot`, `.compact-timeline-header`, `.compact-timeline-expanded` styles to `WeeklyPage.css`.

## 2026-03-14 (doc audit)
- **New `ARCHITECTURE.md`.** Single authoritative reference covering all 4 Lambda functions, DynamoDB schemas, frontend routes/components/hooks, API actions, deployment workflow, and key file locations. Replaces the need to read multiple split docs.
- **Updated `BACKEND_GUIDE.md`.** Fixed all xAI Grok references (replaced Gemini + OpenAI throughout), corrected env vars, added RSS feed ingestion, narrative threading, hallucination filtering, 3 new `newsSensitiveData` actions (`today`, `archive_range`, `narrative_thread`), API key tier system, `newsPostLinkedIn` Lambda documentation, and fixed CORS list.
- **Updated `DEPLOYMENT_NOTES.md`.** Fixed PowerShell copy commands → macOS `rm -rf`/`cp`; fixed OpenAI → xAI Grok reference.
- **Updated `FRONTEND_ARCHITECTURE.md`.** Removed non-existent `Sparkline.jsx`, marked AppSync as unused, corrected backend integration note.
- **Updated `onboard` skill.** Now points to single `ARCHITECTURE.md` instead of 4 separate docs; lists stale old docs to ignore.

## 2026-03-14
- **Weekly Page: Region-colored tags.** Region tags on story cards now display in distinct colors per region — Asia (amber), Europe (blue), Middle East (pink), Africa (green), Americas (purple), Oceania (orange), World (gray) — making geographic context scannable at a glance.
- **Weekly Page: Search bar.** Added a search input to the filter bar. Searches across story titles, entry titles, region names, and source names in real time. Filters both threaded stories and standalone entries within each region group.
- **Weekly Page: Clean card style.** Removed distracting colored left borders, color dots, and colored timeline dots from story cards. Cards now use a uniform neutral style matching the home page. Timeline dots default to gray. Dead code (`threadHue`, `threadColor`) removed from WeeklyPage.jsx.
- **Weekly Map: Fixed play animation.** Play button now correctly starts from the oldest available date (~1 week ago) and progressively reveals newer dates toward the present, showing story evolution over time. Fixed date range filter bug where descending sort order caused empty marker sets.
- **Weekly Map: 8 code quality fixes.** Removed dead `dateRange` filtering logic; auto-stop playback when thread is region-filtered away; added empty-state message for region filter; mobile sidebar overlay with `useIsMobile`; separated markers and lines into distinct arrays (removed `_isLine` pattern); shared `groupMarkersByCountry()` utility for dedup; `escapeHtml()` for XSS prevention in info windows; playback resume after pause.
- **Weekly Map: 6 UX features.** Date range label in header; manual prev/next stepping during playback with pause/resume; zoom-to-thread on thread click; back navigation link to `/weekly`; `MapLegend` component; `StoryPlaybackOverlay` with progress bar and country tracking.
- **Weekly Map: Thread detail sidebar.** Clicking a thread in the sidebar now shows a detail view with all entries grouped by date, AI toolbar (Summarize/Predict/Trace), and play/stop controls — matching the regular map page pattern.
- **Weekly Map: Full-Map link.** Added "Full Map →" link in Weekly Page header linking to `/weekly-map`.
- **Code deduplication.** Extracted 3 shared components used by both WeeklyPage and WeeklyMap:
  - `src/components/ApiKeyGate.jsx` — reusable API key gate with `title`/`description` props
  - `src/components/StoryEntryCard.jsx` — reusable entry card with AI toolbar (Summarize/Predict/Trace Cause)
  - `src/hooks/useIsMobile.js` — responsive breakpoint hook (default 600px)
- **WeeklyMap cleanup.** Removed inline `ApiKeyGate`, `useIsMobile`, `ThreadEntryCard` duplicates from `WeeklyMap.jsx`; replaced with shared imports. Extracted Google Maps styles to `MAP_STYLES` constant. Removed dead `.active` class from thread list items. Removed dead `.wmap-entry-*` CSS from `WeeklyMap.css`; replaced with scoped `.wmap-detail-day .story-entry-card` overrides. Removed dead `.wmap-thread-item.active` CSS.
- **WeeklyMap: 5 UX enhancements.**
  - Marker click → thread selection: clicking a single-thread marker selects it in the sidebar; multi-thread markers show an info window with clickable thread links.
  - Thread search: search input in sidebar (shown when >5 threads) filters by title or region.
  - Article count in playback: story playback overlay now shows "Day X of Y · N articles" per date.
  - URL state deep-linking: `?thread=` and `?region=` query params sync with sidebar selection for shareable links.
  - Mobile backdrop: tapping outside the sidebar panel closes it on mobile.
- **Weekly Page: Trending This Week.** New `TrendingSection` component above the filter bar shows rising/new stories with 2+ articles as horizontally scrollable cards. Includes left/right scroll arrows (hidden on mobile), scroll-snap, and a detail panel below that opens on card click showing full thread entries with MiniMap and AI toolbar. Cards show truncated summary preview; selecting a card expands it with interactive `StoryEntryCard` (Summarize/Predict/Trace Cause toggle buttons). Limits to 10 trending cards.
- **Dead CSS cleanup.** Removed unused `.trending-card-ai`, `.trending-card-ai.prediction`, `.trending-card-ai.trace`, `.trending-card-ai-label` styles from `WeeklyPage.css`.
- Updated `WeeklyPage.jsx`, `WeeklyPage.css`, `WeeklyMap.jsx`, `WeeklyMap.css`.

## 2026-03-09 (commit 5)
- **Backend: Phase 1 Narrative Threading — complete.** Topics now carry a stable `threadId` across days so analysts can trace how a story evolved.
- **newsInvokeGemini:** Added `readPastArchiveTitles(7)` — reads past 7 `archive#YYYY-MM-DD` items at clustering time. Added `NARRATIVE CONTINUITY` block to Grok prompt so it can detect story continuations and emit `continues_topic`. Field captured in normalized output and written to staging.
- **NewsProjectInvokeAgentLambda:** Added `readPastArchiveEntries(7)`, Jaccard similarity (`computeJaccardScore` — 0.5×keyword + 0.3×region + 0.2×category, threshold 0.4), and `assignThreadId()` (checks `continues_topic` → Jaccard → new `thread-{slug}-{hash}`). `threadId` and `search_keywords` now written into every archive entry.
- **newsSensitiveData:** Added `narrative_thread` action — member/enterprise key required. Accepts `threadId`, scans past 7 or 30 days of archives, returns matching entries sorted chronologically.
- Updated `docs/ENTERPRISE_WEEKLY_ANALYSIS.md` — Phase 1 fully marked complete.

## 2026-03-09 (commit 4)
- **Backend Bug Fix: Archive TTL:** `DAILY_ARCHIVE_TTL_DAYS` changed from 7 to 31 in `NewsProjectInvokeAgentLambda/src/index.js`. Enterprise users can now retrieve up to 30 days of archive history as intended by the tier model.
- **Backend Bug Fix: OPENAI_MODEL undefined:** `invokeGrok()` return on line 336 referenced undefined `OPENAI_MODEL` — corrected to `GROK_MODEL`. `modelId` field in cached AI items now correctly records the model name.
- Updated `docs/ENTERPRISE_WEEKLY_ANALYSIS.md` implementation status tracker.

## 2026-03-09 (commit 3)
- **Map: Resizable Side Panel:** The map side panel can now be resized by dragging the left edge. Width is constrained between 280px and 640px and persisted in localStorage across sessions.
- **Map: Archive Cards Fix:** Archive topic cards no longer pre-show AI result cards on load. Summary/Prediction/Trace content is hydrated from pre-baked data on first button click, keeping the card clean by default.
- **Map: Collapsible Legend:** "Topic Categories" legend now collapses to a compact pill (4 color dots + "Legend ▼") by default. Click to expand/collapse, preventing it from blocking map content.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`.

## 2026-03-09 (commit 2)
- **Map: AI Toolbar Redesign:** Refactored `MapSidePanel.jsx` AI buttons to reuse shared `AIComponents.css` glass-pill classes instead of duplicate map-specific styles. Added compact overrides (`.map-ai-toolbar-compact`) in `WorldMap.css`. Sources toggle moved to a footer row alongside Google News link. "Related Countries" promoted into the toolbar as a 4th pill button.
- **Repo: Gitignore Zips:** Added `amplify/**/*.zip` to `.gitignore` to exclude Lambda deploy artifacts.
- **Repo: Added docs and planning files:** Committed `BACKEND_GUIDE.md`, `ENTERPRISE_WEEKLY_ANALYSIS.md` and other architecture/planning docs in `docs/`, marketing and blog content, Claude skills in `.claude/skills/`, `.agents/` context, and new Lambda stubs (`linkedInAutoPost`, `newsPostDevTo`, `newsPostLinkedIn`).
- Updated `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx`, `WorldMap.css`.

## 2026-03-09
- **Map: Related Countries Highlight:** Replaced "Story Flow" feature (which dimmed/zoomed map) with a new "Related Countries" highlight. Clicking ▶ Related Countries on any topic card (including archive) now shows yellow translucent circular markers on affected countries. Markers are pixel-sized (zoom-independent) so they stay consistent at all zoom levels. Feature stays active until user explicitly clicks "Hide Related" or the banner "✕ Clear" — clicking the map background no longer exits the mode.
- **Map: Renamed Story Flow → Related Countries:** Button label changed from "▶ Story Flow" / "Clear Story" to "▶ Related Countries" / "Hide Related". Banner now reads "Related: [topic title]".
- **Map: Archive Topics Get Related Countries Button:** Archive topic cards now also show the "▶ Related Countries" button (previously hidden for archive topics).
- **Map: Archive Button Color:** The Related Countries button on archive cards uses a muted slate color (#94a3b8) instead of bold black, consistent with the lighter archive card styling.
- **Map: Connection Line Click No Longer Forces Panel:** Clicking a connection line between countries no longer forces the side panel to jump to a specific country. Story flow activates without hijacking the panel.
- **Backend: Enterprise Archive Range:** Added `archive_range` endpoint to `newsSensitiveData` Lambda for fetching multi-day topic history. Tier-gated: member keys get 7 days, enterprise keys get 30 days. Today's data served from `latest`, past days from `archive#YYYY-MM-DD` DynamoDB items.
- **Backend: Daily Archive Write:** `NewsProjectInvokeAgentLambda` now writes a second archive item per pipeline run (`archive#YYYY-MM-DD` with 7-day TTL, 10 sources) in addition to the existing `today-archive` (24h TTL, 3 sources). Enables weekly/monthly analysis for enterprise tier.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`, `NewsProjectInvokeAgentLambda/src/index.js`, `newsSensitiveData/src/index.js`.

## 2026-03-07
- **Error Handling UX:** Added ErrorModal system with user-friendly error messages instead of raw console errors. Shows friendly messages for 503/cache miss/network errors.
- **Stale Data Banner:** When backend returns stale 503, topics now display with a visible amber warning banner ("Topics are being refreshed. Showing latest available data.") with a Refresh button, replacing the subtle inline orange text.
- **503 Stale Data Fix:** Updated restProxy.js to return stale topics when backend returns 503 instead of throwing an error, so users can see content while new data generates.
- **AI Error Modal Integration:** AI feature errors (summary/prediction/trace cause) now show in the ErrorModal with friendly messages instead of only appearing in browser console.
- Created `global-perspectives-starter/frontend/src/contexts/ErrorContext.jsx` — global error state management.
- Created `global-perspectives-starter/frontend/src/components/ErrorModal.jsx` — user-friendly error modal.
- Updated `global-perspectives-starter/frontend/src/App.jsx` — wrapped with ErrorProvider.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` — amber stale banner, showError in catch blocks, removed redundant inline error div.
- Updated `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx` — added showError to TopicCard error handlers.
- Updated `global-perspectives-starter/frontend/src/services/restProxy.js` — returns stale data on 503 instead of throwing.

## 2026-03-03
- **Map: Clickable Info Window Topics:** Clicking a country dot on the map now shows individual clickable topic rows (with hover highlight) instead of plain text + a "View details" button. Clicking a topic directly opens the side panel and auto-fetches its AI summary.
- **Map: Clickable Topic Cards:** Clicking anywhere on a topic card in the map side panel now triggers the Summarize action (toggles it open/closed). Buttons, links, and AI result areas still work independently via event filtering.
- **Map: Auto-scroll to Selected Topic:** When a topic is selected (from info window or story flow), the side panel scrolls to that card and auto-loads its summary.
- **Backend: Archive 400KB Fix:** The `today-archive` DynamoDB item was exceeding the 400KB per-item limit after 24h of accumulation. Fixed by capping the archive at 50 entries and trimming AI content fields to 1500 characters each in `NewsProjectInvokeAgentLambda`.
- **Bug Fix: Stale 503 Error:** Traced stale error to `newsInvokeGemini` writing topics to `id=staging` while `newsSensitiveData` proxy was reading from `id=latest` (different default keys). The staging→latest promotion is handled by `NewsProjectInvokeAgentLambda` — confirmed pipeline is healthy and running every 2 hours. Also aligned proxy default key to `staging` as defensive fallback.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `NewsProjectInvokeAgentLambda/src/index.js`, `newsSensitiveData/src/index.js`.

## 2026-02-28 (2)
- **Map: Archive Topics Overlay:** Archive (past) topics now appear on the world map alongside current topics. Archive-only countries show smaller muted-color dots; archive connections render as dashed grey lines. Helps users see "what happened earlier" vs "what's happening now" at a glance.
- **Map: Archive Sidebar:** The same "Today's Archive" slide-out sidebar from the home page is now available on the map page — with search and category filters.
- **Map: Story Flow Marker Highlight:** When a story is selected, affected country dots now visually pop (larger scale + thick white ring) instead of just staying at full opacity. Unrelated dots fade to 20% opacity. Clearer selected state.
- **Map Side Panel: Archive Section:** When opening a country that has both current and archive topics, the panel shows current topics first, then an "Earlier today" divider, followed by archive topic cards with pre-loaded AI analysis (no extra API call needed).
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`.

## 2026-02-28
- **World Map Upgrade (Features 1, 2, 7, 9):** Completely rewrote the map page to show meaningful geopolitical connections instead of article counts. Countries are now colored by their dominant news category (conflict, economy, politics, etc.), geodesic spider-web lines connect countries that share topics, clicking a country opens a slide-in side panel with full topic details, and selecting a topic triggers Story Flow mode (dims unrelated lines, auto-zooms to affected countries). The map now reflects how news events link nations rather than raw article volume.
- **AI Analysis in Map Side Panel:** Added Summarize, Predict, and Trace Cause AI buttons to each topic card in the map side panel — same AI features available on the home page, now accessible directly from the map.
- Rewrote `global-perspectives-starter/frontend/src/components/WorldMap.jsx` with new `buildMapData()` data model, Google Maps Polyline spider-web connections, topic-based markers, and Story Flow highlight logic.
- Created `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx` — slide-in panel with topic cards, AI toolbar, sources, and story flow trigger.
- Created `global-perspectives-starter/frontend/src/components/WorldMap.css` — extracted and expanded map styles including side panel, AI toolbar, and mobile bottom-sheet responsive layout.
- Removed map CSS from `global-perspectives-starter/frontend/src/index.css` (moved to WorldMap.css).
- Added `window.GOOGLE_MAPS_API_KEY` to `docs/config.js` (API key no longer hardcoded in source).

## 2026-02-23
- **Archive Sidebar Timestamp:** Updated "Today's Archive" sidebar to show when each topic entered the database with a clearer label. Time display now reads "Showed Xh ago" / "Showed Xm ago" / "Showed just now" instead of a bare compact time, making it explicit that the timestamp reflects when the topic was captured by the pipeline.
- Updated `global-perspectives-starter/frontend/src/components/TodayArchiveSidebar.jsx`.

## 2026-02-06

### LinkedIn Auto-Posting Feature
- **New Lambda Function:** Created `newsPostLinkedIn` Lambda to automatically post new Global Perspectives topics to LinkedIn with AI-generated summaries and chain reaction predictions.
- **Smart Deduplication:** Implemented title fingerprinting (position-independent slugified titles) to detect and skip already-posted topics. Tracks posted topics in DynamoDB with 30-day TTL for automatic cleanup.
- **Rate Limiting:** Configured conservative posting limits (5 posts per run, 100 posts per day) to avoid LinkedIn spam filters. EventBridge schedule triggers every 3 hours (cron: 15 */3 * * ? *).
- **Intelligent Content Formatting:** Posts include category label, full summary, chain reaction prediction, site link, and regional hashtags. Smart truncation at sentence boundaries (3000 char limit). Strips markdown and removes "Watchlist Signals" sections for clean LinkedIn formatting.
- **Post Priority:** Automatically sorts new topics by significance (high → medium → low) and posts highest-priority topics first.
- **LinkedIn API Integration:** Uses LinkedIn Posts API v2 with version 202601. OAuth 2.0 authentication with access token and person ID stored in Lambda environment variables.
- **DynamoDB Table:** Created `NewsProject-linkedin-posts` table with PK key for tracking posted topic fingerprints and 30-day TTL enabled.
- Created `amplify/backend/function/newsPostLinkedIn/src/index.js` with main handler, title fingerprinting, DynamoDB deduplication logic, LinkedIn API posting, markdown stripping, smart truncation, and rate limiting.
- Created `amplify/backend/function/newsPostLinkedIn/src/package.json` with dependencies (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb).
- Created `amplify/backend/function/newsPostLinkedIn/src/event.json` with test event structure.
- Configured environment variables: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID, LINKEDIN_POSTS_TABLE, MAX_POSTS_PER_RUN, MAX_POSTS_PER_DAY, SITE_URL.

### Buy Me a Coffee Support Banner
- **New Feature:** Added donation banner to homepage to help sustain ad-free operation. Banner appears below page header with message "We run ad-free. Help us keep it that way" and yellow "Buy Me a Coffee" button.
- **Non-Intrusive Design:** Subtle light gray background (#fafafa), minimal border, centered layout with max-width 600px for balanced prominence without disrupting content flow.
- **Design Consistency:** Matches existing design system with border-radius 8px, responsive spacing, and inline styling for maintainability.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with support banner component linking to buymeacoffee.com/BenBen990505 (inserted at line 367, above topic list).
- Built and deployed to production: updated `docs/index.html` and `docs/assets/index-DogKfCuV.js`.

## 2026-01-28

### Kickstarter Campaign Banner
- **New Feature:** Added dismissible Kickstarter banner at the top of all pages to promote the mobile app funding campaign.
- **Banner Design:** Green gradient banner with direct messaging ("Support Mobile App on Kickstarter"), "View Campaign" button, and close (✕) button.
- **Persistence:** Banner dismissal is stored in localStorage so users who close it won't see it again.
- **Mobile Responsive:** Banner adjusts layout for smaller screens with stacked content.
- **Placement:** Appears above the navigation header on all pages via Layout component.
- Created `global-perspectives-starter/frontend/src/components/KickstarterBanner.jsx` with dismissible banner logic and Kickstarter link.
- Created `global-perspectives-starter/frontend/src/components/KickstarterBanner.css` with green gradient styling and responsive adjustments.
- Updated `global-perspectives-starter/frontend/src/components/Layout.jsx` to import and render KickstarterBanner at the top of the page.

## 2026-01-27

### Increase Frontend Topic Limit
- **Topic Limit Increase:** Changed frontend to request up to 13 topics from the backend instead of hardcoded 10.
- Updated `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js` to change `getGeminiTopics(10)` to `getGeminiTopics(13)` in both the initial load (line 43) and background polling (line 82).

## 2026-01-25

### Floating Topic Navigation Panel
- **New Feature:** Added floating navigation panel on the right side of the screen (desktop only) that shows all topic titles with region badges. Helps users orient themselves while scrolling and provides quick jump navigation to any topic.
- **Smart Scroll Tracking:** Implemented Intersection Observer API to automatically highlight the currently visible topic as users scroll through the page. Active topic is highlighted with blue accent and bold text.
- **Region Badges:** Each topic displays its region with neutral gray badges (Asia, Europe, Americas, MENA, Global) for easy identification without color distraction.
- **Collapsible Design:** Navigation panel can be collapsed to a compact header by clicking the toggle arrow, preserving screen space when not needed.
- **Smooth Jump Navigation:** Click any topic in the navigation to smoothly scroll to that topic in the main content area.
- **Desktop Only:** Panel automatically hides on screens ≤1200px to preserve mobile/tablet screen space. Mobile users scroll naturally.
- **Ordering Fix:** Navigation panel now displays topics in the exact same order as the main page (grouped by region) instead of original array order. Fixed by iterating through `categorizedTopics` entries to match Home.jsx rendering order.
- Created `global-perspectives-starter/frontend/src/components/TopicNav.jsx` with Intersection Observer scroll tracking, click-to-jump navigation, region badge logic, and collapsible UI state management.
- Created `global-perspectives-starter/frontend/src/components/TopicNav.css` with floating panel styling, scrollbar customization, active state highlighting, and neutral gray badge styling.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` to import TopicNav component, add `id` attributes to topic elements for scroll tracking, and render TopicNav with topics and categorizedTopics props.

## 2026-01-24

### Restore Article Sources Display with Helper Text
- **Sources Feature Restoration:** Re-added the expandable article sources display that was removed on Jan 22. Users can now click "Sources (N)" button to view direct links to actual news articles fetched by Brave Search API, instead of only having a Google News search link.
- **Desktop Layout:** Added "Sources (N)" toggle button next to "View Sources ↗" link on the right side. Button shows article count and chevron (▲/▼) to indicate expand/collapse state. AI button toolbar layout remains unchanged (Summarize, Predict, Trace Cause in horizontal pill-shaped toolbar on left).
- **Mobile Layout:** Added full-width "Sources (N)" toggle button below "View Sources ↗" link. Mobile dropdown "Actions" button layout remains unchanged.
- **Helper Text:** Re-added italic gray helper text below source buttons: "Note: Very recent news may take time to appear in search results"
- **Expandable Sources Card:** When toggled, displays "📰 Article Sources" card with scrollable list (max-height: 300px) of articles showing title (clickable), source name, and age (e.g., "reuters.com • 2 hours ago"). Card includes "Real-time News Sources" footer with close button.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with `sourcesExpanded` state, `toggleSourcesExpanded` function, sources toggle buttons in both desktop (lines 463-506) and mobile (lines 560-606) layouts, and expandable sources card display (lines 609-671).

## 2026-01-22

### Simplify Homepage Layout - Restore Original Clean Design
- **Layout Simplification:** Removed expandable sources list feature and helper text to restore the cleaner, simpler layout from before Jan 20. Both desktop and mobile now show just AI action buttons (Summarize, Predict, Trace Cause) plus a single "View Sources ↗" link that opens Google News search.
- **Desktop Layout:** AI buttons in pill-shaped toolbar on left, "View Sources ↗" link on right, space-between layout. Removed "Sources (N)" expandable button and helper text note.
- **Mobile Layout:** Dropdown "Actions" button containing all three AI actions, plus "View Sources ↗" link below. Maintains separate container from desktop to prevent style conflicts.
- **Code Cleanup:** Removed unused `sourcesExpanded` state, `toggleSourcesExpanded` function, and entire expandable sources display section. Simplified JSX structure while preserving separate desktop/mobile layout containers added on Jan 20.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` to simplify both desktop (lines 424-473) and mobile (lines 475-537) layout containers, removing sources expansion functionality and helper text.

## 2026-01-20

### Separate Desktop/Mobile Layout Implementation
- **Architecture Refactoring:** Implemented completely separate layout containers to eliminate CSS conflicts between desktop and mobile views. Created `.topic-actions-desktop` and `.topic-actions-mobile` containers that are independently controlled via CSS media queries, preventing cross-contamination of styles.
- **Desktop Layout Container:** `.topic-actions-desktop` shows only on screens >768px with horizontal flexbox layout, preserving original desktop button arrangement with "Summarize", "Predict", "Trace Cause" buttons on left and source links on right using `justify-content: space-between`.
- **Mobile Layout Container:** `.topic-actions-mobile` shows only on screens ≤768px with vertical layout, featuring full-width "Actions" dropdown and vertically-stacked source links below. Mobile container completely independent from desktop styles.
- **CSS Media Query Strategy:** Desktop layout: `display: flex` by default, `display: none !important` on mobile. Mobile layout: `display: none` by default, `display: block !important` on mobile. This ensures zero visual interference between layouts.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` by replacing shared container with separate `.topic-actions-desktop` and `.topic-actions-mobile` containers (lines 424-611), each with their own AI toolbar and source links structure.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with new layout container styles (lines 702-783), replacing previous shared container approach with completely independent desktop/mobile styling systems.

### Previous Changes (Earlier today)
- **Mobile UI Enhancement - Dropdown Actions:** Fixed mobile button UI issues by implementing a responsive dropdown pattern. Desktop maintains original circular buttons ("Summarize", "Predict", "Trace Cause"), while mobile (≤768px) shows a single "Actions" dropdown with all three options. Mobile dropdown features proper touch targets (44px minimum), loading spinners, completion checkmarks (✓), click-outside-to-close, and smooth animations. Eliminates text overflow and distorted circular shapes on iPhone.
- **Mobile Layout Improvements:** Enhanced mobile layout with proper spacing and alignment. Actions dropdown now spans full width with larger padding (16px), source links properly stack below on mobile with improved touch targets. Fixed layout conflicts between toolbar and source links that caused alignment issues.
- **Desktop Layout Restoration:** Fixed desktop layout regression by wrapping layout styles in `@media (min-width: 769px)` query and restoring original inline flexbox styles. Desktop now maintains exact original horizontal layout with buttons on left and source links on right, while mobile keeps vertical stacking layout.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with mobile dropdown styles (lines 119-226), responsive display logic (lines 574-583), mobile layout improvements (lines 697-733), and desktop-specific layout preservation (lines 220-234).
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with mobile dropdown state management, action handlers, click-outside event listener, and improved container structure.

## 2026-01-09
- **Timeline Visualization Enhancement:** Replaced plain text timeline with vertical timeline visualization featuring black dots, gray connecting lines, date badges, and event cards with hover effects. Event titles are color-coded by stage: blue (starting events), orange (evolving events), red (result events). Uses hybrid keyword + position detection for intelligent color assignment.
- **Timeline Parsing Fix:** Improved date detection to handle bullet points (`- 2020:`), prose format (`In 2020, something happened`), and dates anywhere in line (not just at start). Added fallback to plain markdown rendering if no dates detected. Strips leading prepositions and separators for cleaner titles.
- **Impact Breakdown Visualization:** Replaced vague numeric scores (9/10) with visual bar chart showing real-world impact. Displays three categories (People 👥, Economy 💰, Regional 🌍) with colored bars (red=High, orange=Moderate, blue=Low) and plain-language explanations extracted from AI response. Removes `**` markdown artifacts for clean display. Filters out duplicate Impact Score text from tab content.
- **Stricter Verdict Classification:** Implemented hybrid scoring system to prevent "True Signal" inflation. True Signal requires: (1) Average impact score ≥8, (2) At least 2 categories ≥8, (3) Global keywords in explanations ("global", "war", "pandemic", "supply chain", etc.). Worth Watching requires moderate scores (≥5) or regional keywords ("regional", "tensions", "spillover"). Everything else classified as Noise.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with timeline styles (lines 319-448) and impact breakdown styles (lines 450-568): impact-breakdown-container, impact-bar-fill with color classes, responsive mobile layout.
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` with parseTimelineEvents() for date extraction, impactBreakdown parsing to extract Human Impact/Economic Reach/Geopolitical Stability scores and explanations, renderImpactBreakdown() to display visual bars, and hybrid verdict calculation logic (lines 168-217).

## 2026-01-08
- **UI Enhancement - Design System:** Added 60+ CSS variables for spacing (8px scale), typography (6 sizes), colors, shadows, and transitions. Replaces hardcoded values with maintainable design tokens across the application. Variables include `--space-xs` through `--space-3xl` (4px-32px), `--font-size-xs` through `--font-size-xl` (11px-16px), `--radius-sm` through `--radius-full`, shadow scales, and transition timings.
- **UI Enhancement - Chain Reaction Flow:** Replaced simple arrow visualization with numbered step cards (① ② ③) featuring violet left borders, hover effects (translateX + shadow), and gradient arrow connectors with downward chevrons. Makes prediction chain steps visually distinct and scannable. Single-step chains display as simplified cards without numbers.
- **UI Enhancement - Mobile Responsiveness:** Added comprehensive media queries for mobile devices (≤768px, ≤480px breakpoints). Tabs now stack vertically on mobile with full-width layout, left border indicators for active state, and 44px minimum touch targets for WCAG 2.1 compliance. Removed inline width/flex styles that blocked CSS media query control.
- Updated `global-perspectives-starter/frontend/src/index.css` with global CSS variables (lines 20-85).
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with accent color variants, chain reaction styles (lines 218-317), and mobile media queries (lines 318-398).
- Updated `global-perspectives-starter/frontend/src/components/PredictionDisplay.jsx` with card-based chain rendering logic (lines 94-130) and removed inline tab styles (lines 183-200).
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` by removing inline tab styles (lines 317-334).

## 2026-01-07
- **Map Country Flags (Complete):** Added country flag emojis to all map UI elements for consistent visual recognition. Flags now appear in: (1) Info window popup when clicking markers, (2) Article list modal when clicking "View all X articles", and (3) Fallback SVG map info panel. All display country flags (🇺🇸, 🇫🇷, 🇯🇵, etc.) with 🌍 globe fallback for unknown countries.
- Updated `global-perspectives-starter/frontend/src/components/WorldMap.jsx` with shared `getFlagEmoji()` utility function and flag display in all three UI contexts.
- **Trace Cause UI Enhancement:** Replaced numeric "Impact: X/10" badge with qualitative Verdict Banner. Now displays AI classification (True Signal 🔴 / Worth Watching 🟠 / Noise 🟢) with 1-sentence explanation above tabs. Provides clearer, more meaningful insights than arbitrary scores.
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` with verdict parsing logic, helper functions, and banner UI component.

## 2025-12-23
- Cache resilience: Serve stale topics with `stale: true` instead of 503 in `amplify/backend/function/newsSensitiveData/src/index.js`.
- Topics hook: Track `isStale`, `updatedAt`, `hasNewData`, store updatedAt in cache, and add background polling in `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js`.
- Home UI: Display freshness timestamp and "New topics available" banner in `global-perspectives-starter/frontend/src/components/Home.jsx`.
- Client: Pass through `stale` from the proxy response in `global-perspectives-starter/frontend/src/utils/graphqlService.js`.
- Docs: Added cache refresh plan in `continue-news.md`.
- Tooling: Bumped Vite to `^7.3.0` and refreshed lockfile in `global-perspectives-starter/frontend/package.json` and `global-perspectives-starter/frontend/package-lock.json`.

## 2025-11-02
- Regional Categorization: Implemented intelligent topic organization by region (Asia, Africa, North America, Europe, Middle East, South America, World). Topics are automatically categorized based on country/region keywords and displayed in separate cards with regional headers and topic counts.
- Increased Topic Limit: Expanded from 7 to 10 topics to provide broader global coverage across all regions.
- Enhanced UI Design: Added regional section headers with visual separators, topic counts, and improved spacing. All existing AI features (summarize, predict) now work within each regional section.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with categorization utility function.
- Modified `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js` to request 10 topics instead of 7.

## 2025-11-01
- Responsive Header: Added dropdown navigation for mobile devices (≤768px). Header height now remains fixed with dropdown expanding below brand text. Includes click-outside functionality and smooth animations. Updated `global-perspectives-starter/frontend/src/components/Layout.jsx` and `global-perspectives-starter/frontend/src/index.css`.

## 2025-10-11
- Sources Link: Use exact homepage title for Google News queries; removed title shortening and keyword augmentation. Updated `global-perspectives-starter/frontend/src/components/Home.jsx`.
- Credentials: Removed OpenAI key from env examples; marked Gemini key optional; updated proxy/docs to treat OpenAI integration as optional.

## 2025-10-09
- Security: Restored direct Amplify AppSync configuration; removed Vite env usage for AppSync.
- Configuration: Added root `.gitignore` to exclude `.env` files; committed sanitized `.env.example` and `frontend/.env.example`.
- Search UX: Shortened topic titles for Google News queries; added location hints; kept 24-hour window.
- Consistency: Unified Home and Map “View sources →” link logic to use the same query builder.
- UI: Removed article list under the map.

## Setup Notes
- AppSync configuration is read from the bundled Amplify config. No `frontend/.env` is required for AppSync.
- Use `.env` at repo root only for backend service keys if needed; do not commit real keys.
