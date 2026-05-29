# FUNCTION_DEBATE_OUTPUT.md — Synthesis of the Three-Agent Critique

**Generated:** 2026-05-18 from three parallel agents (Minimalist, Strategist, Reliability Engineer) per `FUNCTION_DEBATE.md`. Each agent independently verdicted 24 features without seeing the others' answers.

This doc is for **operator review**. Read the Executive Summary first; jump into per-feature debates where you see SHARP disagreement.

---

## Executive Summary

### Verdict matrix (24 features × 3 agents)

| #   | Feature                | Min         | Strat           | Rel         | Signal    |
| --- | ---------------------- | ----------- | --------------- | ----------- | --------- |
| 1   | Topic clustering       | keep        | keep            | keep        | none      |
| 2   | Two-pass prediction    | consolidate | keep            | consolidate | mild      |
| 3   | Thread analysis        | keep        | keep            | keep        | none      |
| 4   | Country intelligence   | consolidate | keep            | keep        | mild      |
| 5   | Pair intelligence      | cut         | cut\*           | cut         | none      |
| 6   | **Systems analysis**   | **cut**     | **keep+expand** | **defer**   | **SHARP** |
| 7   | Country facts updater  | keep        | keep            | keep        | none      |
| 8   | Markets data           | consolidate | consolidate     | consolidate | none      |
| 9   | Daily brief            | keep        | keep            | keep        | none      |
| 10  | Dev.to publishing      | cut         | cut             | cut         | none      |
| 11  | Multi-platform social  | consolidate | consolidate     | consolidate | none      |
| 12  | RSS feed               | keep        | keep            | keep        | none      |
| 13  | Bot pre-rendering      | keep        | keep            | keep        | none      |
| 14  | **Save / bookmark**    | **cut**     | **defer**       | **rebuild** | **SHARP** |
| 15  | Firebase auth          | consolidate | keep            | keep        | mild      |
| 16  | Paddle scaffolding     | defer       | defer           | cut         | mild      |
| 17  | /map WorldMapV2        | keep        | keep            | keep        | none      |
| 18  | /weekly-map            | cut         | cut             | cut         | none      |
| 19  | /intelligence-map      | cut         | cut             | cut         | none      |
| 20  | /cli marketing         | cut         | cut             | cut         | none      |
| 21  | Drift detection        | keep        | keep            | **rebuild** | mild      |
| 22  | 30-day archive pattern | keep        | **rebuild**     | keep        | mild      |
| 23  | Editorial overrides    | keep        | keep            | keep        | none      |
| 24  | Soft deduplication     | keep        | keep            | keep        | none      |

\* Strategist offered an alternative "rebuild as a CountryPage tab" but agreed the standalone route should go.

### Pattern at a glance

- **Unanimous KEEP (9):** Topic clustering, Thread analysis, Country facts, Daily brief, RSS, Bot pre-render, /map, Editorial overrides, Soft dedup.
- **Unanimous CUT (5):** Pair intel, Dev.to publishing, /weekly-map, /intelligence-map, /cli.
- **Unanimous CONSOLIDATE (2):** Markets data, Multi-platform social.
- **Mild disagreement (5):** Two-pass prediction, Country intel cadence, Firebase auth, Paddle scaffolding, 30-day archive pattern.
- **SHARP disagreement (2):** Systems analysis, Save/bookmark feature.

### Take-aways

1. **The spine is sound.** Every agent kept Topic Clustering, Thread Analysis, Country Intel, Daily Brief, /map, Editorial Overrides, RSS, Bot Pre-render, Soft Dedup. That's the editorial core. Don't touch it.
2. **The orphans are dead.** /intelligence-map, /cli, /weekly-map, Pair UI, Dev.to publish — unanimous cut. ~6 routes/components/Lambda paths to remove with zero strategic cost.
3. **Two features need operator judgment** (sharp disagreement). Both are about ambition vs. focus — see "Decision points" below.
4. **Strategist + Reliability both want the moat content surfaced (Pair, Systems) — but only if it's visible.** Hidden moat = burning $/month on tokens nobody reads.

---

## Decision points for operator

These two questions are the only ones the agents couldn't answer for you.

### DP-1: Systems analysis (causal graph) — Feature 6

- **Minimalist:** cut. Two countries, two render bugs in two months, no proven engagement.
- **Strategist:** keep AND expand. "The screenshot that wins enterprise pitches." Most defensible feature on the site.
- **Reliability:** defer at current 2-country scope. TTL 14d means deferred-with-no-action is operationally free.

**Question for you:** Is the causal graph a demo-day asset you'd pitch to a B2B buyer, or a research experiment nobody asked for? Strategist's "wins enterprise pitches" framing only holds if you're pitching to enterprise. If you're not, Min and Rel are right.

//what is the casual graph again?

### DP-2: Save / bookmark feature — Feature 14

- **Minimalist:** cut. Exists only because auth exists, auth exists only for Save and dormant Paddle. Half-baked (no cap enforcement, no TTL).
- **Strategist:** defer. Pocket does this better. Re-add when there's a "weekly digest of saved items" email to attach it to.
- **Reliability:** rebuild. Two real bugs (silent data loss above 500 items, cross-account LocalStorage leak on signOut). ~50 LOC to fix properly.

**Question for you:** Do you intend to monetize within the next 6 months? If yes → fix Save (Reliability is right); if no → defer or cut.

i think we should keep the bookmark

---

## Per-feature synthesis

For each feature: agent verdicts in a one-line table, the disagreement signal, my synthesized recommendation, and (where relevant) the operator question that would change the call.

### Feature 1 — Topic clustering · Min: keep · Strat: keep · Rel: keep · **none**

Substrate of the whole product. Recently parallelized (387s → 130s). Provider-portable via env vars. **Recommendation: keep. No action.**

### Feature 2 — Two-pass prediction · Min: consolidate · Strat: keep · Rel: consolidate · **mild**

Minimalist + Reliability want to collapse the second pass for cost/blast-radius reasons. Strategist defends it as "analyst-grade output, the editorial moat." Neither side has data on whether single-pass with web grounding would regress quality.
**Recommendation: A/B it.** Generate 1 day of predictions both ways, eyeball the diff, then decide. Cheap experiment, settles the argument.
**Operator question:** are you confident enough in the two-pass quality lift to keep paying double tokens without an eval?

### Feature 3 — Thread analysis · Min: keep · Strat: keep · Rel: keep · **none**

The proprietary schema (storyArc + trajectory + rootCauseChain + inflectionTopicId + keyActors) all three agents called moat. Skip-when-unchanged cache means cost is tiny. **Recommendation: keep, harvest the OPT-9 13s pacing waste next time you're in the file.**

### Feature 4 — Country intelligence · Min: consolidate · Strat: keep · Rel: keep · **mild**

Minimalist wants top-15 × 1/day (vs current top-20 × 3/day). Strategist defends current cadence as moat investment; Reliability says cost is fine and missed runs are invisible. CountryListPage only fetches intel for top 10 (PAGES_GUIDE known issue), so half of production isn't even surfaced.
**Recommendation: fix the page first** (extend the top-10 fetch to top-20 to match the Lambda's output), then re-evaluate cadence with traffic data. **Don't touch the schedule yet.**

### Feature 5 — Pair intelligence · Min: cut · Strat: cut\* · Rel: cut · **none**

Hidden from nav, manual-only, 706 LOC + dead hooks + dead component imports. Strategist's qualifier: bilateral analysis IS moat-grade — but only if it ships. **Recommendation: choose one of two paths within a week:**

- (a) **Surface it** as a "Bilateral" tab inside CountryPage (Strategist's preferred). Wire `usePairIntelligence` to the page, route the slug.
- (b) **Cut it completely**: delete `newsPairIntelligence` Lambda, drop PairPage/PairListPage from App.jsx imports, drop dead hooks.

The middle state (hidden but maintained) is the expensive one. Pick.

### Feature 6 — Systems analysis · **SHARP** — see DP-1.

**My synthesis:** I lean defer over cut. The cost is genuinely tiny (18s/run, 5 countries), the TTL is 14d so silent rot is bounded, and you'd lose the "screenshot for enterprise pitch" optionality. But don't expand it further until the rendering layer is stable for a month — Strategist's "expand!" goes too fast given the recent NaN/threadId bugs.

### Feature 7 — Country facts updater · Min: keep · Strat: keep · Rel: keep · **none**

The anti-hallucination layer. All three agents called it cheap, high-leverage, asymmetric moat. Reliability's caveat: needs a freshness alarm so ACLED failures aren't silent. **Recommendation: keep. Add the CloudWatch alarm on FACTS#<country>.updatedAt staleness — ~30 min of work.**

### Feature 8 — Markets data · Min: consolidate · Strat: consolidate · Rel: consolidate · **none**

Universal "trim and harden." Three specific consolidation moves:

- **Yahoo VIX → FRED VIXCLS** (OPT-12 — fragile scrape silently zeros).
- **Drop hourly FX cadence to 4-6h** (news cycle doesn't change at 1h granularity).
- **Parallelize World Bank macros** (OPT-10 — 300 serial calls = 60s waste).
- Add `asOf`-staleness alarms per source.

**Recommendation: ship the three above as a single PR.**

### Feature 9 — Daily brief · Min: keep · Strat: keep · Rel: keep · **none**

Strategist called it "the page that fits in a tweet" — the canonical acquisition surface. Reliability noted it degrades gracefully (DDB write succeeds even when Dev.to publish 401s). **Recommendation: keep. No action.**

### Feature 10 — Dev.to publishing · Min: cut · Strat: cut · Rel: cut · **none**

401-broken for weeks with nobody noticing or being blocked → by definition not load-bearing. Wrong audience (developer surface for a geopolitics product). **Recommendation: cut the publish path; keep the DDB DAILY_BRIEF write (which powers /daily).** Delete `postToDevTo()` and the DEVTO_API_KEY env var. ~30 LOC.

### Feature 11 — Multi-platform social · Min: consolidate · Strat: consolidate · Rel: consolidate · **none**

Convergence is striking: cut to **LinkedIn + Bluesky** (Min, Rel) or **LinkedIn + Bluesky + X** (Strat). All three flag the same dead code (postToX/postToThreads — OPT-23) and the silent token-expiry pain. Reliability noted linkedInAutoPost's extractRegions bug (OPT-13) means the overlap filter has been broken anyway.
**Recommendation: cut Mastodon, Telegram, Farcaster** (the long tail). Keep LinkedIn + Bluesky. Fix OPT-13. Delete `postToX`, `postToThreads`, `require('ws')`, and the Nostr leftovers per CHANGES.md 2026-05-16.

### Feature 12 — RSS feed · Min: keep · Strat: keep · Rel: keep · **none**

50 items live, near-zero maintenance, AI-crawler-friendly. **Recommendation: keep. Fix OPT-18 NaN-cutoff defensively when you're in the file.**

### Feature 13 — Cloudflare bot pre-rendering · Min: keep · Strat: keep · Rel: keep · **none**

Without it the React SPA is invisible to crawlers; with it country/thread pages get LLM-citation traffic. **Recommendation: keep. No action.**

### Feature 14 — Save / bookmark · **SHARP** — see DP-2.

**My synthesis:** Reliability's "rebuild" is right _if_ you're going to monetize. Strategist's "defer" is right if monetization is far. Minimalist's "cut" is right if monetization isn't coming. The implementation bugs (OPT-15 silent data loss, OPT-16 no TTL, OPT-21 cross-user LocalStorage leak) **must be fixed regardless** — they're active bugs, not nice-to-haves.
**Minimum acceptable action:** even if you defer the strategy decision, fix OPT-21 today (it's a real data-leak between users on shared browsers).

### Feature 15 — Firebase auth · Min: consolidate · Strat: keep · Rel: keep · **mild**

Minimalist wants to gut magic-link + anonymous flows. The other two say cost is essentially zero (Firebase-managed) and ripping it out costs more than keeping it. **Recommendation: keep, but seriously: if you cut Save (DP-2 → cut), reconsider this.** Auth without Save and without billing is a mailing-list signup form.

### Feature 16 — Paddle scaffolding · Min: defer · Strat: defer · Rel: cut · **mild**

Reliability is most aggressive: dead code is the worst kind of code — it doesn't get exercised, so it breaks when you turn it on. Strategist + Minimalist say keep optionality. The webhook idempotency bug (OPT-20) is real but only fires if Paddle re-sends, which it doesn't right now.
**Recommendation: split the difference.** Keep the env vars + DDB schema (so re-enabling is one-day work). Delete the dead `MEMBER_API_KEYS` / `resolveTier` / `Pricing` component / `/upgrade/success` route. That's the unreachable code that costs cognition; the schema costs nothing.

### Feature 17 — /map WorldMapV2 · Min: keep · Strat: keep · Rel: keep · **none**

Just had the v2 redesign land; bug fixes show the operational shakeout is happening. Strategist called it "the demo page." **Recommendation: keep. If you cut Systems analysis (DP-1 → cut), also remove the Causal Graph render block from /map.**

### Feature 18 — /weekly-map · Min: cut · Strat: cut · Rel: cut · **none**

Two maps is one too many. Not in primary nav. Google Maps adds runtime cost. **Recommendation: cut.** Strategist's offer: "fold the playback feature into /map as a 4th layer" — only worth doing if you actually have evidence playback drives engagement. Otherwise just delete the route and component.

### Feature 19 — /intelligence-map · Min: cut · Strat: cut · Rel: cut · **none**

Dev artifact escaped to production. **Recommendation: cut. Pure deletion, no risk.**

### Feature 20 — /cli marketing · Min: cut · Strat: cut · Rel: cut · **none**

Orphan marketing a non-product. **Recommendation: cut.** Strategist offered "add it to footer, prove inbound in 30 days, otherwise delete" — but that's just deferring the deletion. Just cut.

### Feature 21 — Drift detection · Min: keep · Strat: keep · Rel: rebuild · **mild**

The disagreement is about strength, not direction. Min + Strat say "the md5 sweep is good enough." Reliability says automate it in CI (the newsPostDevTo drift was caught manually this session — won't catch the next one without a check).
**Recommendation: ship Reliability's CI guard.** It's a half-day script (`aws lambda get-function` per Lambda → hash → diff against repo → fail build on mismatch). Cheapest insurance you can buy.

### Feature 22 — 30-day archive read pattern · Min: keep · Strat: rebuild · Rel: keep · **mild**

Strategist alone wants to rebuild around a derived `ARCHIVE#ROLLUP-30D` snapshot. Min + Rel both said: measured cost is $0.0009/day, independent failure domains are a feature not a bug, leave it. **Recommendation: keep (Min + Rel win on evidence).** Revisit if NewsCache crosses 500MB.

### Feature 23 — Editorial overrides · Min: keep · Strat: keep · Rel: keep · **none**

The anti-hallucination overlay. All three called it asymmetric moat — cheap to maintain, expensive to replicate. **Recommendation: keep. Fix the OPT-14 mutation race with a non-mutating merge when you're in the file.**

### Feature 24 — Soft deduplication · Min: keep · Strat: keep · Rel: keep · **none**

Boring, hidden, load-bearing. **Recommendation: keep. No action.**

---

## Cross-cutting themes (where all three agreed without prompting)

1. **Finish or delete — never park.** Min calls them "experiments," Strat calls them "hidden moat," Rel calls them "silent failure surfaces." Same idea: the worst state is half-shipped. Applies to Pair UI, Systems Phase 1, Paddle scaffolding, /weekly-map.
2. **Surface what's already proprietary.** Pair, Systems, Country Intel are all moat content the Strategist defends — but Min and Rel both flag that they're hidden or underexposed. Every Strategist "keep" was qualified with "but actually use it."
3. **Replace silent failure with alarms.** Reliability harped on this; Min and Strat agree wherever it's brought up. Specifically: ACLED freshness (Feature 7), Markets `asOf` (Feature 8), social-poster token expiry (Feature 11), Lambda drift (Feature 21).
4. **The orphans are unanimous.** Five features (Pair UI, Dev.to publish, /weekly-map, /intelligence-map, /cli) — three agents independently said cut. No moat argument survived.

---

## Recommended action set (composed from the synthesis)

Ranked by ROI (high) and risk (low) — these are the moves the debate as a whole supports, not just any single agent.

### Now (this week, low risk)

1. **Cut the unanimous orphans** — `/intelligence-map`, `/cli`, `/weekly-map` routes + components + Pair UI imports from App.jsx. One sweep PR.

//why they are useful? 2. **Cut the Dev.to publish path** (keep the DDB DAILY_BRIEF write). Delete `postToDevTo()` + `DEVTO_API_KEY` env var.

//i agree 3. **Fix OPT-21** (signOut LocalStorage purge) — active cross-user data leak, ~10 lines.//good 4. **Decide DP-1 (Systems) and DP-2 (Save).** These two unblock further cuts.//what is this?

### Next (1–2 weeks)

5. **Pair intelligence decision** — surface it inside CountryPage OR delete the Lambda + DDB + components. No middle state.
6. **Cut long-tail social platforms** — Mastodon, Telegram, Farcaster. Keep LinkedIn + Bluesky. Fix OPT-13 (extractRegions) while you're there.
7. **Markets data consolidation PR** — Yahoo→FRED VIXCLS, drop hourly FX, parallelize macros, add staleness alarms.
8. **Two-pass prediction A/B** — generate 1 day both ways, decide.

### Later (when worth it)

9. **Drift detection CI guard** — Reliability's half-day script.
10. **CloudWatch alarms** on every external dep's freshness — ACLED, Markets sources, social tokens.
11. **Rename `GROK_*` → `LLM_*`** — paired with OPT-2b in OPTIMIZATION_REPORT.

### Never (without revisiting strategy)

- Don't touch Topic Clustering, Thread Analysis, Country Intel scheduling, Country Facts, RSS, Bot Pre-render, /map, Editorial Overrides, Soft Dedup. The spine is sound.

---

## Reading the disagreements

If you only have 10 minutes for this doc:

- **Skim the Verdict matrix** at the top.
- **Read DP-1 and DP-2.** Those are the only calls the agents couldn't make for you.
- **Look at "Now" in the action set.** That's the unambiguous to-do list.

Everything else is supporting evidence.

---

# Addendum 2026-05-29 — `/economy`: adopt Home's Summary/Predict/Trace Cause?

**Question debated:** Should `/economy` mimic the Home page's per-item Summary / Predict / Trace Cause (SPT) AI toolbar to "better explain" what's happening? Three parallel agents, distinct mandates, no fence-sitting, each verified against the live code (`EconomyPage.jsx`, `Home.jsx`, the SPT hooks, the thread Economy tab + `MechanismCard`, `ARCHITECTURE.md`).

| Agent (lens) | Verdict | One-line |
| --- | --- | --- |
| A — UX / explanatory depth | **ADAPT** | Add *Trace-Cause-only* at the story (driving-row) level, reusing already-fetched `mechanism`+`watchSignals`; kill Summary + Predict. |
| B — Information architect | **REJECT** | SPT is `topicId`-keyed; economy is `scopeId`/instrument-keyed; story-level SPT duplicates the thread Economy tab. Do an instrument-level synthesis instead. |
| C — Editorial / honesty | **ADAPT** | Keep Trace Cause; **kill Predict** (a winners/losers forecast = category violation on a no-forecast page); replace it with a deterministic "What's priced in" consensus + realized-analog readout. |

## Convergence (the strong signals)
- **Unanimous: do NOT import "Predict."** All three independently call it a category violation — Home's Predict is a forward winners/losers forecast, and `/economy` is engineered to refuse forecasts (analog = "not a forecast", `ChangePill` never fabricates, the briefing flags consensus-vs-realized divergence).
- **None endorse full ADOPT-SPT.** The literal "mimic Home" proposal is rejected by all three.
- **The "explain better" concern is validated.** The per-story "why" is genuinely thin today (one `rationale` clause; can dead-end at "no mechanism recorded").
- **Hard technical fact:** there is no cached SUMMARY/TRACE_CAUSE for an instrument ("copper" isn't a topic) — adopting Home's hooks literally would need *new* backend LLM generation (cost + fresh hallucination surface).

## The split & the call
A wants *story-level* depth; B & C want *instrument-level* synthesis. **B's objection is decisive:** story-level depth is the thread Economy tab's job (where `MechanismCard` lives, and which the page already links to) — inlining it duplicates the one thing the page header says it must not do. The economy page's unique, non-duplicative value is the **cross-story instrument-level** picture.

## Synthesis / decision
**REJECT the SPT mimicry. KILL Predict outright. BUILD a per-instrument deterministic "Why it's moving / What's priced in" synthesis line** at the top of the expanded drawer:
- consensus split + strength ("4 of 5 cited stories expect ↑, 85% agree") + modal magnitude
- closest-analog *realized* move (already computed, verbatim from the catalog)
- built with the existing `composeEconomyBriefing` + `quality/briefing/assertions.js` machinery — deterministic, no LLM, no forecast, honesty-checked, no duplication.

The honest answer to "explain like Home?" is **yes — but as a cross-story instrument synthesis, not Home's per-story forecasting UI.**

---

# Addendum — /economy briefing ANCHOR (2026-05-29, story-led re-anchor)

**Question debated:** What should *anchor* the "Today in the economy" lead briefing? It currently leads with a severity COUNT ("N stories repricing — X severe…") then an instrument-citation cluster. Operator asked: should it instead mimic how real markets analysis opens (lead with the dominant catalyst, then sector winners/losers)? Three debaters, opposing mandates, each instructed to research real market-brief conventions.

## Verdicts
| Debater | Verdict on the anchor |
|---|---|
| A — Markets Analyst | **RE-ANCHOR:** S1 = dominant catalyst story (picker → *most-cited-among-the-severe*), S2 = real sector winners/losers, S3 = mechanism, S4 = divergence; demote the count. Cited Schwab/JPM/Bloomberg "Five Things" — all lead with the protagonist, not an inventory. |
| B — Honesty Guardian | **RE-ANCHOR, GATED:** lead with the story, but never join a story to a sector move by a causal verb unless the story actually cites that instrument; ban flow language + forecasts; add 5 eval assertions. Cited the narrative-fallacy literature (Morningstar/HeyGoTrade): the explanation always *follows* the price. |
| C — Reader-Value Editor | **RE-ANCHOR:** sentence 1 = the named story with a market verb; CUT the count and the most-cited cluster as a lead — both are *redundant* with the leaderboard + right-rail directly below. Cited Axios Smart Brevity / Bloomberg / Matt Levine: the lede is a claim, never a stat. |

## Convergence
- **Unanimous: kill the count as the lead.** It's page plumbing, not a takeaway.
- **Unanimous: anchor on the dominant story, stated cause→effect.** It's the one synthesis the dashboards structurally can't show.
- **Agreement: change the picker** from "highest-severity, first-in-feed" → **most-cited-among-the-severe** (the story moving the most instruments).
- **Reader-Value's redundancy point is decisive** for cutting the old S1b cluster: the leaderboard already lists most-cited instruments six inches lower.

## The split & the call
A vs B on the "why" clause: A wants a free rotation narrative; B forbids causation unless the instrument is cited. C's own rewrite ("Energy −X% *as the move reads as demand-destructive*") would FAIL B's gate — that collision is the signal. **Operator decision (2026-05-29): Analyst-leaning** — allow a direction-consistent rotation read even when the sector ETF isn't directly cited, with lighter gating, but keep the non-negotiable core contract (no fabricated numbers, no forecasts, consensus-direction kept separate from realized move).

## Synthesis / shipped
Re-anchored `composeBriefing` to: **S1 driver** (most-cited-among-severe headline + the instruments it cites) · **S2 tape** ("splitting along it" — real winners/losers from `markets.series`, sign always from the realized change) · **S3 divergence caveat** · **trailing severity tag**. Added assertion **(e)** forecast-ban. All 5 fixtures pass the contract; self-test green; verified live in-browser (headline links to the thread Economy tab). The dull-but-true sector % line carries the analyst payload honestly; an omitted "why" is a feature, not a gap.
