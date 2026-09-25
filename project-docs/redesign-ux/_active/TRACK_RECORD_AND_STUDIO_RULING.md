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

**Next build: a shareable permalink.** It saves the output **plus a frozen snapshot of the cited sources** (JSON on S3, unguessable id), only when the user clicks Share, with a noindex option, size cap, rate limit and delete link.

**Entry from other pages:**
- Story mode, the country card and briefings keep "Analyze in Studio →" (prefilled).
- Small hand-off drawers are allowed for scenario and explain-the-web; the long lenses open the page.

**Parked:**
- Member path promotion and credits. Un-park at ≥10 runs a month for a quarter, measured *after* the example + permalinks ship.
- New lenses beyond the decided ones.
- A saved-analysis library.

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

## What we score: debate ruling (2026-09-25)
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
