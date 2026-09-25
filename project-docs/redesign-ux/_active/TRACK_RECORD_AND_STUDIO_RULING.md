# Track record & Analysis Studio: do we need them, what for, how shown? (debate ruling, 2026-09-25)

**Status: APPROVED (operator, 2026-09-25: "i like your recommendation"). T1–T3 and S1–S3 accepted as recommended; S3 (DeepSeek vs another provider) remains the operator's business call.** Design only; nothing built. Process:
- a fact pass (code, live proxy, CloudWatch, read-only DynamoDB scan) and a research pass
  (Metaculus, Good Judgment, Nate Silver, Polymarket; Perplexity Pages/Spaces, NotebookLM, Elicit, AlphaSense, Deep Research);
- three advocates: A destinations, B embedded everywhere, C lean/park;
- two critics: product/trust and engineering/statistics.

## Facts that changed the question (verified)
- **Track record is thinner than it looks.**
  - All **122 scored triggers come from one scoring run on 24 Jul**, covering 55 forecasts whose deadlines fall on **6–10 Jul** (one news week).
  - **Nothing has been scored in ~2 months.** Checked live: the recent-resolved list is all deadlines 9–10 Jul, all confirmed 24 Jul.
  - The `newsPredictionResolver` Lambda was never the source of those scores. It is a legacy proposer, dead for 10 days on the DeepSeek balance, with its own bugs: it mixes legacy and v1, takes items in scan order, retries the same 40 forever after a 402, and uses whole-item overwrites.
- **Statistics:**
  - Brier 0.154 vs a base-rate guess of 0.185, so skill ≈ 0.17. Bootstrapped by forecast, the **95% CI for skill is [−0.09, 0.35], i.e. indistinguishable from zero.**
  - Triggers are scored against their parent *scenario's* probability, which is not true calibration.
  - **The "strong" verdict is not defensible.**
- **Pending is two groups:** 14,153 not yet due and **6,454 overdue**. About 250 new dated triggers arrive a day, so scoring every trigger can never catch up.
- **The counter gap** (20,744 vs 122 + 20,607) is **15 triggers marked "unclear"**, counted in the total but in neither group.
- **Studio:**
  - The member server path has had **zero uses since 10 Jul** and is broken now (DeepSeek). BYOK usage is unknown (not logged).
  - Anonymous visitors are blocked entirely.
  - Best discoverability on the site (5 prefilled entry points).
  - Strong but unmarketed features: structured Key Judgments, citation validator, visual blocks.
  - No permalinks, no example.

## Ruling
### Track record: keep it, lean and honest (public)
**What it's for:**
- For readers: "do they admit when they're wrong?"
- For analyst buyers: "is the calibration real?" Today the honest answer is "not yet, and here's proof we know it".

**Page, in order:**
1. **Status line:** "Early: 122 triggers from 55 forecasts in one week of July scored; so far about what a base-rate guess would get. Next scoring: …" plus **last scored date** (freshness).
2. **Corrections ledger first.** "This read changed on <date> because <cited event>" is the real differentiator.
3. **Right and wrong examples** (recently resolved).
4. **"What we've learned so far"** (one click down): "we run too confident: things we rated ~64% likely happened 51% of the time". Buckets carry n and the number of distinct forecasts, and are labelled *early read*.
5. **Methodology**, including counts that add up: "15 unscoreable", "6,454 overdue", "14,153 not yet due".

**Removed now:** the "strong" verdict pill and the home counters (until they add up).

**Links:**
- Keep "How these forecasts are scored →" (story mode) and "All corrections →" (country card).
- Story mode and country cards may show a **ledger line** ("This read changed on <date> →").
- **No per-forecast badges** until sampled scoring makes them resolvable. Never infer "missed" from a passed deadline; unscored = "awaiting".

**Fix the engine first (the real work):**
- **Score a sample:** at capture, pick 1 trigger per forecast at random, score those in deadline order in a weekly run, and mark the rest "not scored (sampled)".
- Deterministic scoring for scheduled events (summits, votes, data releases).
- A **dead-man's alarm to SNS** when no verdict has been written for 10 days.
- Retire or fix the legacy resolver.
- Show calibration buckets with confidence intervals only after about **500 randomly sampled scores**: ≥100 per bucket, ≥30 forecasts, ≥4 deadline weeks.

### Analysis Studio: keep it as a page, "A-lite", entered from context
**What it's for:** the analyst workspace and the product you'd sell. It is also the already-decided home for the country deep-dive + web, bilateral view, "explain this web" and "Generate a briefing". Those need page space and state, so it is not a drawer.

**Anonymous visitors:** a one-line purpose + **one real, complete, cited example run** (read-only permalink, dated) + sign-in. Never a locked mockup.

**Signed in:** lens picker (with story chips prefilled from story mode / country card / briefings) → Bottom line → Key judgments (probability + confidence) → cited prose → visual blocks → **Share** (the next build).

**Copy now:**
- Remove the credits copy.
- The member path is either hidden or honestly labelled "temporarily unavailable".
- BYOK is the working path. Reword the promise to "your key and content never leave your browser" if an anonymous usage count is added (opt-in).

**Next build: a shareable permalink.** It saves the output **plus a frozen snapshot of the cited sources** (unguessable id; **storage corrected to a DynamoDB row with a server-frozen snapshot, see "Studio page design" below**), only when the user clicks Share, with a noindex option, size cap, rate limit and delete link.

**Entry from other pages:**
- Story mode, the country card and briefings keep "Analyze in Studio →" (prefilled).
- Small hand-off drawers are allowed for scenario and explain-the-web; the long lenses open the page.

**Parked:**
- Member path promotion and credits. Un-park at ≥10 runs a month for a quarter, measured *after* the example + permalinks ship.
- New lenses beyond the decided ones.
- A saved-analysis library.

### Studio page design: debate ruling (2026-09-25). PROPOSED, awaiting the operator
Three advocates argued:
- **S-A "Report desk":** a gallery of lenses feeding one fixed report page.
- **S-B "Case board":** map + string board + findings notebook.
- **S-C "Ask anywhere":** drawers on every page; the Studio becomes only a library.

Two critics (product; engineering/data honesty) judged them. The ruling is **S-A's report core in a one-screen "Research Bay" frame**.
- S-B is parked: it is about 3× the permalink work, with no demand signal.
- S-C is rejected: it contradicts the approved ruling and would duplicate BYOK and auth state inside drawers.

**Corrections to the ruling above** (verified in code and AWS by critic 2):
- **The validator never fails a run today.**
  - `hasError` only turns the banner red, and the report still renders (`AnalysisStudio.jsx:387`).
  - "Fails empty" is new behaviour.
- **Latent citation bug.**
  - Perplexity writes its own `[1]`, `[2]` markers against *its* search results.
  - Our validator reads them as *our* story numbers.
  - Result: a deep run can falsely flag a citation, or silently point a web claim at one of our stories. Fix it first.
- **No streaming** (both paths call `res.json()`).
- **The permalink is a new Lambda, not "JSON on S3".**
  - A reader's shared report disappears if they delete their account. The DATA_STRATEGY sorting test therefore makes it a **DynamoDB row**, owned by the reader.
  - The server must be authoritative. If the browser posted prose and sources directly, anyone could publish arbitrary text and `javascript:` links under our domain.
- **Credits/member copy is still live** (`AnalysisStudio.jsx:185, 202`), even though the ruling says it is gone.
- **Data freshness.**
  - Country intelligence is newest 12 Sep; systems webs 10 Sep (14-day TTL, due to expire); the pairs list 7 Sep (cron off).
  - `newsCountryIntelligence` failed 20/20 again today on "Insufficient Balance".
  - So the new country/web/bilateral lenses can't honestly launch until the DeepSeek balance returns.

**Layout v2, which replaces the 3-column v1 below (operator, 2026-09-25: v1 was "just a regular analysis"; "you can do it").**
- **The Studio is story mode for your own question:** map + slide card (with a SOURCES tab) + time bar. It reuses story mode's pieces, so the build depends on C11.
- **Wireframe:** canvas board F1 (`Studio.dc.html`), revised after a design critic and a data-accuracy critic.
- **Two layers, both toggleable:**
  - **Our data** follows the legend tokens (solid = reported, dashed = judged link) and needs no new AI:
    - source places;
    - numbered source dots at their dates over the story's entries per day;
    - the stored cause chain;
    - dated forecast triggers ◆;
    - linked stories as dashed arcs, with confidence named per web.
  - **This run** is **amber hatching only**, never a line style, so it can't be read as a judged link.
- **Scenario slides:** BOTTOM LINE → HOW WE GOT HERE (ours) → SCENARIOS (a band from today to each scenario's last trigger date, plus its places) → WATCH (dated triggers, days left) → CONNECTIONS (ours).
- **Compare:** two time-bar lanes, double rings on shared places, the judged link between the stories, and a cited agree/disagree grid.
- **Economic ripple and free-form:** schematic until built.
- **Place rule:** a place is drawn only if the run's text names it **and** one of the sources lists it. Broad region tags ("Middle East") are never drawn as points.
- **Schema adds (build time):**
  - gp-struct scenarios gain `places[]` + a `by` date, both checked against prose and sources like probabilities are today;
  - `buildAnalysisContext` also reads `thread_analysis` (cause chain) and `prediction_snapshot` (dated triggers);
  - a share freezes the map and time-bar data with the sources.
- **Critic corrections applied to the wireframe:**
  - the scenario stand-in now names its source (the forecast log for source [4], 21 Aug, point probabilities 60/20/20, including Pessimistic);
  - the trigger keeps "above 60% purity";
  - snippets are verbatim;
  - link confidence is named per web;
  - the compare grid no longer claims story A never mentions prices.

v1 zones (kept for reference; still apply as parts of v2: the sources tab = INTEL, the bottom strip = status):
| Zone | Shows |
|---|---|
| **Left: OPERATIONS rail** | Only lenses that are shipped and have a fixed output shape: Scenario · Compare · Free-form · Economic ripple (labelled "market-mechanism read"). No locked tiles, no "coming soon". |
| **Centre: BRIEFING → DEBRIEF** | Objective (lens + question), then assets: up to 4 story chips, each with its date and freshness brightness. Key chip "your key · stays in this browser"; deep-research toggle only when a key supports search; **RUN**. After the run, the same zone becomes the report: Bottom line → Key judgments (probability + confidence) → cited prose → gp-struct visuals. |
| **Right: INTEL dossier** | Numbered sources: `[1]..[n]` our stories (outlet, date, verbatim snippet); `[W1]..` web sources, kept separate. Oldest/newest source date. Validator panel: citations checked n/n, struct valid. |
| **Bottom: status strip** | Model · run time · "made by a reader with their own key" · **SHARE** · COPY AS MARKDOWN |
| **Progress** | Only real steps: sources loaded → running (skeleton + spinner, no streaming in v1) → citations checked → struct valid. No XP, unlocks or gamification. |

- **Validator error:**
  - the run is **not shareable**;
  - the prose is hidden behind "failed checks: show anyway (not shareable)";
  - the reasons are listed.
- **Signed out:** the same screen, loaded with **one real shared example** (read-only), with RUN replaced by "Sign in to run with your own key".
- **Share permalink** `/analyze/s/:id`:
  - read-only DEBRIEF, "run {date} · sources frozen {date}";
  - "Open these stories live →" and "Run your own →";
  - noindex (meta + `X-Robots-Tag`, Worker pre-render skips it);
  - owner-only delete.
- **"Your shared debriefs on this browser":** a browser-only list (storage wrapped in try/catch). Not a library.
- **Entry points:**
  - the existing 5 prefilled links + "Studio" in the nav;
  - 2 hand-off drawers (scenario from story mode; country deep-dive from the country card). They only prefill and open the page; they never render output.

**Lens roadmap (one at a time):**
1. Launch: scenario, compare, free-form, economic ripple.
2. **Country deep-dive**, only when that country's intel is ≤ 48 h old (otherwise "data from {date}" or the lens is withheld). Needs typed sources in `assembleContext`, e.g. `[3] Country intelligence: Japan, generated 12 Sep`.
3. Explain-this-web.
4. Bilateral: from fresh PAIR# data, or built from two intel records + shared actors; otherwise a Compare preset.
5. Generate-a-briefing. It is always labelled "Reader-generated with your own key, from N stories, not a Global Perspectives briefing", is never written to `COUNTRY#`, and is never shown on the card as ours.
- Streaming last.

**Not built:** case board / Cases table, output inside drawers, an 8-tile gallery, more than 1 example at launch, member path/credits, document upload, PDF export.

**Staged build** (replaces the Studio lines in the staged plan below):
- **Stage 0 (~1 day):** fix the Perplexity `[n]` collision, number web sources `[W#]`, add the "not shareable on error" state, remove the credits/member copy.
- **Stage 1 (~3–4 days):** the `newsSharedAnalysis` Lambda.
  - The client sends `{lens, topicIds, prose, struct, webSources}`.
  - The server verifies the Firebase JWT, re-fetches and freezes our sources itself, and re-runs the validator and struct checks; it refuses on error.
  - It allows only http(s) URLs, caps prose at 32 KB and allows 20 shares per user per day.
  - It stores `SHARE#<128-bit id>` in DynamoDB and serves a public GET plus owner delete.
  - CORS is emitted in code (the `newsAnalyze` pattern), so its Function-URL CORS config stays empty.
  - Then the share page and the signed-out example.
- **Stage 2 (~3 days):** the one-screen Research Bay layout + typed sources + the country deep-dive lens (freshness-gated).
- **Stage 3+:** explain-web and bilateral after the DeepSeek balance returns; generate-briefing; streaming.

**Decisions for the operator:**
| # | Decision | Recommendation |
|---|---|---|
| S4 | One-screen "Research Bay" layout (rail · briefing/debrief · intel · status) | Yes |
| S5 | A run that fails the validator is hidden and not shareable | Yes (a change: today it renders with a red banner) |
| S6 | Shares stored as DynamoDB rows owned by the reader (replaces "JSON on S3") | Yes, per the DATA_STRATEGY sorting test |
| S7 | New Lambda `newsSharedAnalysis` + its IAM | Needs your yes when we build (IAM is gated) |
| S8 | Launch with 4 lenses; country deep-dive next, gated to intel ≤ 48 h | Yes |
| S9 | Signed-out: the same screen with one real shared example | Yes |
| S10 | Case board, doc upload, PDF, member path | Parked |

## Staged plan (sizes are the critics' estimates)
- **Track record:**
  - S1 (~0.5 day): copy + counters + ledger first + early-read labels.
  - S2 (~1–2 days): sampled scoring + weekly run + alarm + retire/fix the resolver.
  - S3 (later): buckets with confidence intervals at about 500 samples.
- **Studio:**
  - S1 (~1 day): copy cleanup, park the member path, public example.
  - S2 (~2–3 days): Share permalink with frozen citations.
  - S3 (~1 week+): country deep-dive / bilateral / generate-briefing pages + hand-off drawers.

## Decisions for the operator
| # | Decision | Recommendation |
|---|---|---|
| T1 | Keep the track record page, lean and honest, with the ledger first | Yes |
| T2 | Switch forecast scoring to a **random sample** (1 trigger per forecast) | Yes: otherwise "track record" can never be current |
| T3 | Who scores: a weekly operator/agent run vs a fixed AI resolver | Weekly agent run + deterministic checks; alarm either way |
| S1 | Keep the Studio as a page (A-lite) with a public example | Yes |
| S2 | Studio permalinks: public-but-unlisted by default; may BYOK runs be shared under the site's name? | Unlisted + noindex by default; label "generated by a reader with their own key" |
| S3 | Fund DeepSeek, or move the resolver / member path / other AI jobs to another provider | Operator's business call. Everything stays frozen until one of them |

## What we score: debate ruling (2026-09-25). APPROVED by the operator ("much better design")
Three advocates argued: **P1** clean binary questions with their own probability; **P2** score the three scenarios; **P3** objective-only (market calls, scheduled events, GDACS).
Two critics (forecasting methodology; product + engineering) **both reject P2**:
- the scenarios aren't exhaustive and overlap;
- "which scenario matched" is judgment, decided by the same model family, so it's circular;
- ~1 score per cluster per week never reaches a meaningful n.

**Ruling: a hybrid. P1 is the scored unit; P3 supplies deterministic resolvers and a separate market-call panel.**
1. **Scored unit:** a standalone binary question `{question, p (its OWN probability, whole % in 2–98), resolution_source (named), deadline, resolver: deterministic|human}`.
   - Frozen at issue: no edits; a correction is a new question.
   - **Built in ONE pass:** add `p` + `resolution_source` to each trigger in the existing scenario prompt (`NewsProjectInvokeAgentLambda` ~480–516, gates in `lib.buildGatedScenarios`). The three scenarios stay as narrative.
   - Generation gates: reject a question if its criterion is already met at issue, if it's a certain scheduled formality, if lead time is < 7 days or > 6 months, or if it's a near-duplicate.
2. **Resolution:**
   - Deterministic first: our price `HISTORY#`, official calendars, the GDACS feed, IAEA reports.
   - Otherwise a weekly human-confirmed run; an agent may draft, with a URL + quoted passage. **The resolver doesn't see p.** Model output is never evidence.
   - YES as soon as it happens; NO only after the deadline + 3 days.
   - Ambiguous → **VOID** (logged with a reason, excluded, void rate published; > 15% voids means fix the questions).
3. **Scoring:** Brier + **Brier skill vs a base-rate baseline** (primary); log score clamped to [0.02, 0.98] (secondary).
   Reliability diagram in 10-point bins, a bin shown only at n ≥ 20.
   Confidence intervals by **cluster bootstrap by story**.
4. **Sampling, pre-registered at issue:**
   - A question is scored if SHA-256(weekly seed + id) < threshold; the seed's hash is appended to the immutable log **before** the week starts.
   - **~20–25 questions a week, max 1 per story cluster**, deadlines mostly 2–12 weeks out. Deterministic questions are all scored, as a separate stratum.
   - ~250 resolved needed for a ±0.03 CI, so a **first meaningful read about 4 months after launch** and a calibration curve at about 6 months.
   - Operator time about 1 h a week.
5. **Market calls (P3): PARKED with economy (operator, 2026-09-25: "we are not using the economy and market at the moment").** Nothing is lost while parked:
   - the 139 econ records live in `SummarizeAndPredict` (TTL disabled, kept);
   - past closes are public and can be re-fetched with `newsMarketsData`'s Yahoo backfill whenever economy returns.
   The design below stands for that day:
   - `scoreMarketCalls` compares the close on or before `generatedAt` with the horizon close.
   - Bands **scaled to volatility** (move ÷ trailing 60-day realised vol over the horizon: < 0.5σ small, 0.5–1.5σ moderate, > 1.5σ large), frozen in the methodology doc before the first run. "Mixed" is not scored.
   - Writes immutable `VERDICT#` rows that **store both closes**, because `GlobalPerspectiveMarkets` has TTL ENABLED: history rolls off at ~90 days.
   - Shown in its **own panel**: "direction hit rate vs a drift baseline, no probability, not a calibration measure". Never blended into the headline.
   - Data today: 139 econ records (102 with impact, 19 May → 12 Sep), 378 calls (214 up / 143 down / 21 mixed); ~185 fall inside the current 90-day price window.
   - Caveat: econ records are overwritten per thread (a survivorship sample). Make them immutable going forward (`ECONOMIC_IMPACT#<date>`) and add a probability per call. Once calls have p they become P1 questions ("BRENT closes higher on day 20 than on issue day").
6. **Existing data:**
   - The **122** become an archived "pilot under a flawed method (scored at scenario probability)". No aggregate score shown and no re-scoring or retro-probabilities (that would be hindsight). Individual items may still serve as labelled examples in the ledger.
   - The **~20k** are archived "pre-methodology, unscored"; used internally for base rates only.
7. **Labelled "Not scored: judgment/narrative":** scenarios and their triggers until they carry p, daily-brief prediction text, trajectory labels and risk scores (circular), the weekly watch list, causal links. Dated `riskSignals` are candidates for conversion to P1 later.
8. **Public wording by stage:**
   - **Stage 0 (now):** "We don't have a scored track record yet. Forecasts before <date> used an earlier method and are archived unscored."
   - **Stage 1 (< 150 resolved):** "Since <date> we lock a pre-selected sample each week — probability, rule and deadline fixed at publication. N resolved, V voided — too few to judge accuracy."
   - **Stage 2 (≥ 150):** "Brier x (95% CI a–b) on N questions vs y for a base-rate guess; V% voided; resolved by a human with cited sources." Say "better than baseline" only if the CI excludes it.
   - **Stage 3 (≥ 400, 6 months+):** "well-calibrated" only if every bin with n ≥ 20 sits within its CI.
9. **Reader UI:** story mode's WATCH slide, the country card's "ahead" and briefings show each question with **its own %**, its source and Awaiting / Happened / Didn't happen (Void). The three futures stay as the narrative.

**Staged build (not approved to build). Market-call steps M0/M1 are PARKED with economy; the active path is ~3.5 dev-days:**
- M0: market-call scorer + `VERDICT#` rows (~1–1.5 d, runs now).
- M1: immutable econ records + probability per call (~0.5 d).
- M2: P1 one-pass schema + gates (~1 d, dormant until the AI provider is funded).
- M3: weekly resolution script with the pre-committed seed, deterministic resolvers and voids; retire the legacy resolver (~1 d).
- M4: UI — the market panel, own-% on WATCH, the stage wording (~1 d).
- Plus the approved dead-man's alarm.

## Track record page design: APPROVED (operator, 2026-09-25: "that is better")
**Main page = canvas board E2 "Service record"**, a one-screen, game-style view consistent with story mode, briefing mode and the country card.
Canvas board **E1** (the scroll page) is kept as the plain-text version, for search, print and screen readers, like "Read in full".

| Part | Borrowed from | What it shows |
|---|---|---|
| Status line | — | The stage wording (Stage 0 now: "We don't have a scored track record yet") |
| Accuracy | chess.com game review | Always beside "a plain guess would score…"; **locked with a progress bar until 150 resolved** |
| This week's draw | roguelike seed | The weekly seed's hash, published before the week starts |
| **Forecast board: MAP (default) \| BOARD** | map-first site; Obra Dinn's book of fates | **Map:** every question placed at the country it is about, with **counts per place** (✓ happened · ✗ didn't · ▢ awaiting · ◌ void); click a place to list its questions. **Never a per-country accuracy score** (too few per place; revisit only at ≥30 per country). **Board:** one tile per locked question, filling in as settled |
| Right panel | — | Details of whatever is clicked: question, frozen %, named source, verdict (confirmed by a person who didn't see the %) |
| Settling log | GitHub contribution graph | One square per week. Missed weeks are shown in red (today: one settling on 24 Jul, then two months missed) |
| Ledger | Paradox ledger screen | "When we changed our read", clickable (real notes: France after the Normandy derailment, China after the Hong Kong vigil sentences, Germany "no single news event") |

The July pilot is shown greyed and unscored. The map makes its skew visible: mostly the NATO summit in Ankara (Turkey: 3 happened / 11 didn't among the 30 plotted).

**Weekly settling (T3):** an agent drafts each verdict with the quoted source; the operator confirms. About 1 hour a week once questions come due.
